"""Phase 9C — In-memory rate limiter middleware.

Simple token-bucket per client IP. Designed for single-process dev
deployment — does NOT share state across workers. For prod with
multiple workers, swap to Redis-backed limiter.

Why in-memory for now:
- Zero infra dependency
- Sufficient for single-user dev mode
- Easy to swap later (interface is `RateLimiter.check()`)

Usage in main.py:
    from app.api.middleware import RateLimitMiddleware
    app.add_middleware(RateLimitMiddleware, ...)

Endpoint exemptions are configured per-route via the ``exempt_paths``
constructor arg (e.g. /health, /profile).
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Iterable

import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

log = structlog.get_logger(__name__)


class TokenBucket:
    """Per-key token bucket. Refills `rate` tokens per second up to `burst`.

    L2 fix (Phase 9 review): wrap state mutation in a Lock. Without
    this, two concurrent dispatch coroutines could both observe
    ``tokens >= n`` before either decrements, allowing both to pass
    through. The middleware runs in an async event loop where a single
    ``await`` between read and write exposes the race. Under CPython
    GIL + sync code path the window was small but real; with FastAPI's
    async dispatch pool it's larger.
    """

    def __init__(self, rate: float, burst: int):
        self.rate = rate  # tokens per second
        self.burst = burst  # max tokens (== bucket capacity)
        self.tokens = float(burst)
        self.last_refill = time.monotonic()
        self._lock = threading.Lock()

    def take(self, n: int = 1) -> bool:
        """Try to consume `n` tokens. Returns True if allowed."""
        with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_refill
            self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
            self.last_refill = now
            if self.tokens >= n:
                self.tokens -= n
                return True
            return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket rate limiter keyed by client IP.

    Args:
        requests_per_minute: Sustained rate cap (default 60).
        burst: Bucket capacity — max requests in a tight burst
            (default = 2x requests_per_minute / 10 to allow short
            bursts but cap sustained traffic).
        exempt_paths: Iterable of path prefixes to skip limiting
            (e.g. ['/api/health']).
        trusted_proxies: Iterable of IP/CIDR strings for upstream
            proxies that are allowed to set ``X-Forwarded-For``. When
            empty (the default) the middleware never trusts XFF — it
            falls back to ``request.client.host``. M8 fix: prevents
            any client from spoofing XFF to bypass per-IP limits.
        enabled: When False, the middleware is a passthrough. Used by
            tests to disable globally without rewiring the app.
    """

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        burst: int | None = None,
        exempt_paths: Iterable[str] | None = None,
        trusted_proxies: Iterable[str] | None = None,
        enabled: bool = True,
    ):
        super().__init__(app)
        self.enabled = enabled
        self.rate = requests_per_minute / 60.0  # tokens/sec
        self.burst = burst if burst is not None else max(10, requests_per_minute // 2)
        self.exempt_paths = tuple(exempt_paths or [])
        # M8 fix: pre-compute the trusted-proxy set for O(1) lookup.
        # Empty default means XFF is never trusted — secure-by-default.
        self._trusted_proxies: frozenset[str] = frozenset(trusted_proxies or [])
        self._gc_lock = threading.Lock()
        self.buckets: dict[str, TokenBucket] = defaultdict(
            lambda: TokenBucket(self.rate, self.burst)
        )
        # Housekeeping: cap the bucket dict size so a flood of unique
        # IPs can't grow it unboundedly. Trivial LRU: every 1000
        # requests, drop the buckets that are at full capacity (haven't
        # been used recently).
        self._request_count = 0

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)
        path = request.url.path
        if any(path.startswith(p) for p in self.exempt_paths):
            return await call_next(request)

        client_ip = self._client_ip(request)
        # L3 fix: fetch the bucket under the lock so the L4 GC swap
        # doesn't race a dispatch that's about to mutate it.
        with self._gc_lock:
            bucket = self.buckets[client_ip]
        if not bucket.take(1):
            log.warning(
                "rate_limit_exceeded",
                client_ip=client_ip,
                path=path,
                method=request.method,
            )
            retry_after = int((1.0 / self.rate) * (1 - bucket.tokens) + 1)
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "rate limit exceeded — slow down",
                    "retry_after_seconds": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        # Light housekeeping (in-memory only; safe to skip).
        self._request_count += 1
        if self._request_count >= 1000:
            self._request_count = 0
            self._gc_buckets()

        return await call_next(request)

    def _client_ip(self, request: Request) -> str:
        """Best-effort client IP — trust X-Forwarded-For only when the
        direct connection is from a configured trusted proxy.

        M8 fix: prior implementation trusted XFF verbatim, allowing
        any client to spoof the header and bypass per-IP limits. Now
        XFF is honored only when ``request.client.host`` matches a
        trusted proxy IP. With an empty trusted_proxies set (the
        default), this falls back to ``request.client.host`` which
        cannot be spoofed by the client.
        """
        direct_ip = request.client.host if request.client else ""
        if self._trusted_proxies and direct_ip in self._trusted_proxies:
            xff = request.headers.get("x-forwarded-for")
            if xff:
                return xff.split(",")[0].strip()
        return direct_ip or "unknown"

    def _gc_buckets(self) -> None:
        """Drop buckets that are at full capacity (idle). Keeps the
        dict bounded under high-cardinality IP floods.

        L4 fix (Phase 9 review): do an atomic dict swap so concurrent
        dispatches can't trigger ``RuntimeError: dictionary changed
        size during iteration``.
        """
        with self._gc_lock:
            idle = {k: b for k, b in self.buckets.items()
                    if b.tokens >= b.burst * 0.95}
            if len(idle) == len(self.buckets):
                return
            self.buckets = defaultdict(
                lambda: TokenBucket(self.rate, self.burst),
                {k: b for k, b in self.buckets.items() if k not in idle},
            )