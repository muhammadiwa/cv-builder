"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useEditorStore, isNewSectionId } from "@/stores/editorStore";
import { apiFetch, ApiError } from "@/lib/api-client";

const SYNC_DEBOUNCE_MS = 2000;

/**
 * Pushes locally-staged section edits to the backend after the user pauses
 * typing for `SYNC_DEBOUNCE_MS`. Designed to be safe across rapid edits and
 * unmounts:
 *
 * - Each new edit clears the pending timer (true debounce).
 * - The in-flight request is bound to an AbortController scoped to the effect,
 *   so an unmount cancels the request and prevents `markClean` running on a
 *   dead component.
 * - Errors surface as a toast so silent save failures are visible.
 */
export function useDebouncedSync(resumeId: string) {
  const sections = useEditorStore((s) => s.sections);
  const dirty = useEditorStore((s) => s.dirty);
  const markClean = useEditorStore((s) => s.markClean);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!dirty) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      // Cancel any earlier in-flight sync; only the latest payload should win.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const payload = {
        sections: sections.map((s) => ({
          // Only send `id` for sections persisted on the server. Locally-staged
          // sections submit without an id so the server creates them.
          ...(isNewSectionId(s.id) ? {} : { id: s.id }),
          sectionType: s.sectionType,
          displayOrder: s.displayOrder,
          content: s.content,
          visible: s.visible,
        })),
      };

      apiFetch(`/resumes/${resumeId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .then(() => {
          if (!controller.signal.aborted) markClean();
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
          // Leave `dirty` true so the next edit retries the sync.
        });
    }, SYNC_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dirty, sections, resumeId, markClean]);

  // On unmount, cancel any in-flight request to avoid `markClean` after unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);
}
