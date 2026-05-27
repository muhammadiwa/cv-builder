"use client";

import { useEffect, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";

export type SyncStatus = "synced" | "pending" | "offline";

export interface SyncStatusInfo {
  status: SyncStatus;
  lastSyncedAt: number | null;
}

/**
 * Derives a human-friendly sync state from the editor store and
 * `navigator.onLine`:
 *
 * - `offline`  : browser reports no connectivity (regardless of dirty)
 * - `pending`  : online and the editor has unsaved local edits
 * - `synced`   : online and no unsaved edits
 *
 * The hook is read-only; the actual sync work is owned by `useDebouncedSync`.
 */
export function useSyncStatus(): SyncStatusInfo {
  const dirty = useEditorStore((s) => s.dirty);
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
  else if (dirty) status = "pending";

  return { status, lastSyncedAt };
}
