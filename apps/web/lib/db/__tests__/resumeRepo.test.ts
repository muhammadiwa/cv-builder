import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    CURRENT_SCHEMA_VERSION,
    db,
    type DexieResumeRow,
} from "../dexie";
import {
    clearAll,
    gcOldRows,
    loadResume,
    markSynced,
    saveResume,
} from "../resumeRepo";
import type { EditorSection } from "@/stores/editorStore";

function row(
    id: string,
    overrides: Partial<DexieResumeRow> = {},
): DexieResumeRow {
    const now = Date.now();
    const sections: EditorSection[] = [
        {
            id: "sec-1",
            sectionType: "summary",
            displayOrder: 0,
            content: { summary: "hello" },
            aiGenerated: false,
            visible: true,
        },
    ];
    return {
        id,
        sections,
        dirtySince: null,
        lastSyncedAt: now,
        updatedAt: now,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        ...overrides,
    };
}

beforeEach(async () => {
    await db.resumes.clear();
});

afterEach(async () => {
    await db.resumes.clear();
});

describe("resumeRepo round-trip", () => {
    it("saves and loads a row", async () => {
        await saveResume(row("r-1"));
        const loaded = await loadResume("r-1");
        expect(loaded).not.toBeNull();
        expect(loaded?.id).toBe("r-1");
        expect(loaded?.sections).toHaveLength(1);
        expect(loaded?.sections[0].content).toEqual({ summary: "hello" });
    });

    it("returns null for a missing row", async () => {
        expect(await loadResume("does-not-exist")).toBeNull();
    });

    it("stamps schemaVersion + updatedAt on save even if caller forgot", async () => {
        await saveResume({
            id: "r-bare",
            sections: [],
            dirtySince: null,
            lastSyncedAt: null,
            updatedAt: 0, // overridden by saveResume
            schemaVersion: 0, // overridden by saveResume
        });
        const loaded = await db.resumes.get("r-bare");
        expect(loaded?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        expect(loaded?.updatedAt).toBeGreaterThan(0);
    });
});

describe("loadResume schema-version guard", () => {
    it("drops a stale-schema row instead of returning it", async () => {
        await db.resumes.put({
            ...row("r-old"),
            schemaVersion: CURRENT_SCHEMA_VERSION - 1,
        });
        expect(await loadResume("r-old")).toBeNull();
        // ...and the stale row is purged so a future write doesn't collide.
        expect(await db.resumes.get("r-old")).toBeUndefined();
    });
});

describe("markSynced", () => {
    it("clears dirtySince and stamps lastSyncedAt", async () => {
        await saveResume(row("r-1", { dirtySince: 100 }));
        await markSynced("r-1", 12345);
        const loaded = await db.resumes.get("r-1");
        expect(loaded?.dirtySince).toBeNull();
        expect(loaded?.lastSyncedAt).toBe(12345);
    });

    it("is a no-op when the row doesn't exist", async () => {
        await markSynced("ghost", 1);
        expect(await db.resumes.get("ghost")).toBeUndefined();
    });
});

describe("gcOldRows", () => {
    const HUNDRED_DAYS_MS = 100 * 24 * 60 * 60 * 1000;
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

    it("deletes clean rows older than the cutoff", async () => {
        const longAgo = Date.now() - HUNDRED_DAYS_MS;
        await db.resumes.put(row("r-old", { updatedAt: longAgo, dirtySince: null }));
        await db.resumes.put(row("r-fresh"));

        await gcOldRows(NINETY_DAYS_MS);

        expect(await db.resumes.get("r-old")).toBeUndefined();
        expect(await db.resumes.get("r-fresh")).not.toBeUndefined();
    });

    it("preserves dirty rows even when they are old", async () => {
        const longAgo = Date.now() - HUNDRED_DAYS_MS;
        await db.resumes.put(
            row("r-old-dirty", { updatedAt: longAgo, dirtySince: longAgo }),
        );

        await gcOldRows(NINETY_DAYS_MS);

        expect(await db.resumes.get("r-old-dirty")).not.toBeUndefined();
    });
});

describe("clearAll", () => {
    it("removes every row", async () => {
        await saveResume(row("r-1"));
        await saveResume(row("r-2"));
        expect(await db.resumes.count()).toBe(2);

        await clearAll();

        expect(await db.resumes.count()).toBe(0);
    });
});
