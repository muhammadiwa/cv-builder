"use client";

import { db, CURRENT_SCHEMA_VERSION, type DexieResumeRow } from "./dexie";

/**
 * Thin repository over the Dexie `resumes` table. All public methods are
 * resilient to a missing IDB (e.g. private mode, server-side import) and
 * tolerate stale schema rows — the worst case is a missed cache hit, never a
 * thrown error in the editor's render path.
 */

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function loadResume(id: string): Promise<DexieResumeRow | null> {
    try {
        const row = await db.resumes.get(id);
        if (!row) return null;
        // Defensive: a row from a previous schema would deserialize fine into
        // the typed shape today, but the section content layout might have
        // shifted under it. Drop and let the server hydrate cleanly.
        if (row.schemaVersion !== CURRENT_SCHEMA_VERSION) {
            await db.resumes.delete(id).catch(() => { });
            return null;
        }
        return row;
    } catch {
        // IndexedDB can be disabled or evicted; treat as cache miss.
        return null;
    }
}

export async function saveResume(row: DexieResumeRow): Promise<void> {
    try {
        await db.resumes.put({
            ...row,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            updatedAt: Date.now(),
        });
    } catch {
        // Storage quota / private mode / disabled IDB. The next 2 s API sync
        // is still on track, so silent failure is acceptable here.
    }
}

/**
 * Mark a resume as fully synced. Clears `dirtySince` and stamps
 * `lastSyncedAt`. If the resume isn't in the cache yet, this is a no-op
 * (the next `saveResume` call will create the row).
 */
export async function markSynced(id: string, lastSyncedAt: number): Promise<void> {
    try {
        const row = await db.resumes.get(id);
        if (!row) return;
        await db.resumes.put({
            ...row,
            dirtySince: null,
            lastSyncedAt,
            updatedAt: Date.now(),
            schemaVersion: CURRENT_SCHEMA_VERSION,
        });
    } catch {
        // See `saveResume`.
    }
}

/**
 * Delete non-dirty rows older than `maxAgeMs`. Dirty rows (those with
 * unsynced edits) are *never* GC'd regardless of age — losing offline edits
 * silently would be a data-loss bug.
 *
 * Default age: 90 days, chosen to cover the typical resume-builder
 * returning-user cadence (a few weeks to a few months between sessions).
 */
export async function gcOldRows(maxAgeMs: number = NINETY_DAYS_MS): Promise<void> {
    try {
        const cutoff = Date.now() - maxAgeMs;
        await db.resumes
            .where("updatedAt")
            .below(cutoff)
            .filter((row) => row.dirtySince === null)
            .delete();
    } catch {
        // Best-effort GC.
    }
}

/**
 * Hard-clear the table. Called on logout so a shared device doesn't leak
 * the previous user's CV data into IDB.
 */
export async function clearAll(): Promise<void> {
    try {
        await db.resumes.clear();
    } catch {
        // Best-effort wipe.
    }
}
