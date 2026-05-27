"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { loadResume } from "@/lib/db/resumeRepo";

export type RestoreStatus = "loading" | "restored" | "empty";

/**
 * Read the cached IndexedDB row for `resumeId` and merge its sections into
 * the editor store. The merge happens via `hydrateFromCache`, which preserves
 * `__field_updated_at` so a later `markSyncedAll(serverSections)` call from
 * `useResume` can resolve any field-level conflicts via LWW.
 *
 * Hook ownership (story 2.4 spec):
 *   - `useResume` owns the React Query cache + canonical server payload.
 *   - `useResumeRestore` owns the IDB read.
 *   - Both write into the editor store via store actions; the per-field LWW
 *     merge makes their resolution order irrelevant — IDB-first or
 *     server-first both end at the same final state.
 *
 * Returns a status flag for tests and loading-skeleton callers. The actual
 * canvas paints from the editor store regardless of this status.
 */
export function useResumeRestore(resumeId: string | undefined): RestoreStatus {
    const hydrateFromCache = useEditorStore((s) => s.hydrateFromCache);
    const [status, setStatus] = useState<RestoreStatus>("loading");

    useEffect(() => {
        let cancelled = false;
        if (!resumeId) {
            setStatus("empty");
            return;
        }
        setStatus("loading");
        loadResume(resumeId)
            .then((row) => {
                if (cancelled) return;
                if (row) {
                    hydrateFromCache(row.sections, row.lastSyncedAt);
                    setStatus("restored");
                } else {
                    setStatus("empty");
                }
            })
            .catch(() => {
                if (!cancelled) setStatus("empty");
            });
        return () => {
            cancelled = true;
        };
    }, [resumeId, hydrateFromCache]);

    return status;
}
