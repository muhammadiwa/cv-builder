"use client";

import { useEffect, useState } from "react";
import { selectDirtySince, useEditorStore } from "@/stores/editorStore";

export type SyncStatus = "synced" | "pending" | "offline";

export interface SyncStatusInfo {
  status: SyncStatus;
  lastSyncedAt: number | null;
}

/**
 * Derives a human-friendly sync state from the editor store and
 * `navigator.onLine`:
 *
 * - `offline`  : browser reports no connectivity (regardless of pending edits)
 * - `pending`  : online and the editor has unsynced edits — driven by
 *                `selectDirtySince` which checks per-field timestamps against
 *                `lastSyncedAt`. This reflects the same truth the IDB cache
 *                writes, so the dot is honest about local-vs-server state.
 * - `synced`   : online and no field timestamps newer than `lastSyncedAt`
 *
 * The hook is read-only; the actual sync work is owned by `useDebouncedSync`
 * (API path) and `useIndexedDBSync` (local cache).
 */
export function useSyncStatus(): SyncStatusInfo {
  const dirtySince = useEditorStore(selectDirtySince);
  const lastSyncedAt = useEditorStore((s) => s.lastSyncedAt);

  // `navigator.onLine` is reliably present in browsers; for SSR we assume
  // online so the status badge doesn't flash "offline" during hydration.
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    // Some test/embed environments leave `navigator.onLine` undefined; treat
    // that as online so we don't show a permanent red dot when no API exists
    // to ask.
    const read = () =>
      typeof navigator !== "undefined" &&
        typeof navigator.onLine === "boolean"
        ? navigator.onLine
        : true;
    const update = () => setOnline(read());
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  let status: SyncStatus = "synced";
  if (!online) status = "offline";
  else if (dirtySince !== null) status = "pending";

  return { status, lastSyncedAt };
}
