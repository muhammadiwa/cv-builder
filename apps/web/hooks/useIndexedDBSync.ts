"use client";

import { useEffect, useRef } from "react";
import { selectDirtySince, useEditorStore } from "@/stores/editorStore";
import { saveResume } from "@/lib/db/resumeRepo";
import { CURRENT_SCHEMA_VERSION } from "@/lib/db/dexie";

const IDB_DEBOUNCE_MS = 800;

/**
 * Persist the current editor state to IndexedDB when the user pauses typing
 * for `IDB_DEBOUNCE_MS`. Independent of `useDebouncedSync` (the API path) —
 * IDB writes much faster so a tab close at t≈900ms still preserves the edit.
 *
 * The hook is fire-and-forget: failures are swallowed at the repo layer
 * because the API sync is the durable path. We never block the editor on IDB.
 *
 * On unmount with a pending timer, the write is flushed synchronously to
 * minimize the window where a user closing the tab loses the last edit.
 */
export function useIndexedDBSync(resumeId: string): void {
    const sections = useEditorStore((s) => s.sections);
    const lastSyncedAt = useEditorStore((s) => s.lastSyncedAt);
    const dirtySince = useEditorStore(selectDirtySince);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestRef = useRef({ resumeId, sections, lastSyncedAt, dirtySince });

    // Keep a live ref so the unmount flush always sees the latest values,
    // even when the timer fires after the latest commit has settled.
    latestRef.current = { resumeId, sections, lastSyncedAt, dirtySince };

    useEffect(() => {
        if (!resumeId) return;

        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
            const snapshot = latestRef.current;
            void saveResume({
                id: snapshot.resumeId,
                sections: snapshot.sections,
                dirtySince: snapshot.dirtySince,
                lastSyncedAt: snapshot.lastSyncedAt,
                updatedAt: Date.now(),
                schemaVersion: CURRENT_SCHEMA_VERSION,
            });
        }, IDB_DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [resumeId, sections, lastSyncedAt, dirtySince]);

    // Flush on unmount: a user closing the tab mid-debounce should not lose
    // the staged edit. We skip the flush if there's nothing to write (no
    // pending timer means we're already up to date).
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                const snapshot = latestRef.current;
                void saveResume({
                    id: snapshot.resumeId,
                    sections: snapshot.sections,
                    dirtySince: snapshot.dirtySince,
                    lastSyncedAt: snapshot.lastSyncedAt,
                    updatedAt: Date.now(),
                    schemaVersion: CURRENT_SCHEMA_VERSION,
                });
            }
        };
    }, []);
}
