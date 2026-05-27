"use client";

import Dexie, { type Table } from "dexie";
import type { EditorSection } from "@/stores/editorStore";

/**
 * Local IndexedDB cache for resume editor state.
 *
 * The cache is the offline source of truth between user edits and successful
 * API syncs. The server remains the durable source of truth — IDB rows are a
 * cache + offline queue, never the only copy of a CV.
 *
 * Schema versioning: bump `DexieResumeRow.schemaVersion` and add a
 * `db.version(N).stores(...).upgrade(...)` migration whenever the row shape
 * changes. Rows with a stale `schemaVersion` are dropped on read (see
 * `resumeRepo.loadResume`) rather than deserialized — Dexie's typed reads
 * combined with our defensive guard mean we never paint a half-broken cache.
 */
export interface DexieResumeRow {
    /** Resume id — primary key. */
    id: string;
    /** Section snapshot, including per-field `__field_updated_at` metadata. */
    sections: EditorSection[];
    /**
     * Earliest local edit timestamp (ms epoch) since the last successful sync.
     * `null` means "no unsynced edits" (i.e. clean — IDB is in step with the
     * server). `dirtySince` survives reload and is the basis for the
     * status-bar `pending` indicator on the next session.
     */
    dirtySince: number | null;
    /** Wall-clock of the most recent successful PATCH (ms epoch). */
    lastSyncedAt: number | null;
    /** Wall-clock of the most recent IDB write (ms epoch). Drives GC. */
    updatedAt: number;
    /** Bump this when the row shape changes; older rows are discarded on read. */
    schemaVersion: number;
}

export const CURRENT_SCHEMA_VERSION = 1;

class CvBuilderDB extends Dexie {
    resumes!: Table<DexieResumeRow, string>;

    constructor() {
        super("cv-builder");
        this.version(1).stores({
            // Primary key on `id`; index `updatedAt` so the GC sweep can scan
            // by recency without loading every row.
            resumes: "id, updatedAt",
        });
    }
}

/**
 * Module-level singleton so every call site shares one open IDB connection.
 * Dexie internally serializes ops on the same handle, which we want here.
 */
export const db = new CvBuilderDB();
