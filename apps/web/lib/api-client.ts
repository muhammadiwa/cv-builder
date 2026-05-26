const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Single in-flight refresh promise so concurrent 401s don't stampede the
// /auth/refresh endpoint.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as { accessToken?: string };
      if (data.accessToken) {
        accessToken = data.accessToken;
        return accessToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      // Allow the next 401 (after this refresh resolves) to start a fresh attempt.
      // We microtask-defer so all currently-awaiting callers see the same result.
      queueMicrotask(() => {
        refreshInFlight = null;
      });
    }
  })();
  return refreshInFlight;
}

export interface ApiFetchOptions extends RequestInit {
  /** Skip auto-refresh on 401. Used internally to avoid recursion. */
  _retried?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { _retried, ...init } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch (err) {
    // Surface network failures (DNS, offline, CORS preflight) as ApiError so
    // callers don't have to discriminate between TypeError and ApiError.
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "Network error", { cause: (err as Error).message });
  }

  if (res.status === 401 && !_retried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      (body as { message?: string }).message ?? res.statusText,
      body,
    );
  }

  // 204 No Content (and any empty body) — return undefined typed as T.
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new ApiError(res.status, "Invalid JSON in response", {
      cause: (err as Error).message,
      body: text.slice(0, 200),
    });
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}
