"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEditorStore, isNewSectionId } from "@/stores/editorStore";
import { apiFetch, ApiError } from "@/lib/api-client";
import { showConflictToast, type SyncConflict } from "@/components/editor/ConflictToast";
import type { ResumeSection } from "@/hooks/useResume";

const SYNC_DEBOUNCE_MS = 2000;

interface PatchResponse {
  id: string;
  sections: ResumeSection[];
  conflicts?: SyncConflict[];
}

/**
 * Pushes locally-staged section edits to the backend after the user pauses
 * typing for `SYNC_DEBOUNCE_MS`. Designed to be safe across rapid edits and
 * unmounts:
 *
 * - Each new edit clears the pending timer (true debounce).
 * - The in-flight request is bound to an AbortController scoped to the effect,
 *   so an unmount cancels the request and prevents `markSyncedAll` running on
 *   a dead component.
 * - On `online` transition, any pending dirty state flushes immediately
 *   (no 2 s wait) so reconnect-and-keep-typing feels instant.
 * - Errors surface as a toast so silent save failures are visible.
 *
 * Field-level LWW: the payload includes `__field_updated_at` per section so
 * the server can resolve cross-device conflicts. The response includes
 * `sections` (server's merged truth) and optionally `conflicts[]` for fields
 * the client lost — each conflict toasts via `ConflictToast`.
 */
export function useDebouncedSync(resumeId: string) {
  const sections = useEditorStore((s) => s.sections);
  const dirty = useEditorStore((s) => s.dirty);
  const markSyncedAll = useEditorStore((s) => s.markSyncedAll);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  // Memoize the actual sync runner so the online listener can call it too.
  const flushRef = useRef<() => void>(() => { });
  flushRef.current = () => {
    if (inFlightRef.current) {
      // Replace the in-flight request with a newer payload — abort and retry.
      abortRef.current?.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;

    // Read sections from the live store (not the render closure) so the
    // payload always reflects the latest edits, even if React batched
    // multiple state updates before this flush fires.
    const currentState = useEditorStore.getState();
    const payload = {
      sections: currentState.sections.map((s) => ({
        ...(isNewSectionId(s.id) ? {} : { id: s.id }),
        sectionType: s.sectionType,
        displayOrder: s.displayOrder,
        // content already includes `__field_updated_at` from `updateSectionField`.
        content: s.content,
        visible: s.visible,
      })),
    };

    apiFetch<PatchResponse>(`/resumes/${resumeId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        if (response?.sections) {
          markSyncedAll(response.sections);
        }
        if (response?.conflicts && response.conflicts.length > 0) {
          for (const conflict of response.conflicts) {
            showConflictToast(conflict);
          }
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        if ((err as Error).name === "AbortError") return;
        if (err instanceof ApiError) {
          toast.error("Gagal menyimpan perubahan", {
            description: `${err.status} — ${err.message}`,
          });
        } else {
          toast.error("Gagal menyimpan perubahan", {
            description: (err as Error).message ?? "Tidak diketahui",
          });
        }
        // Leave the store dirty so the next edit (or online reconnect) retries.
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  };

  useEffect(() => {
    if (!dirty) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      // Don't even start the timer while offline — wait for the online
      // listener to flush.
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushRef.current(), SYNC_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dirty, sections, resumeId]);

  // Online transition: flush any pending dirty state immediately.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => {
      const state = useEditorStore.getState();
      if (state.dirty) flushRef.current();
    };
    const onOffline = () => {
      // Cancel any in-flight request so it doesn't sit on a dead socket.
      abortRef.current?.abort();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // On unmount, cancel any in-flight request to avoid `markSyncedAll` after unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);
}
