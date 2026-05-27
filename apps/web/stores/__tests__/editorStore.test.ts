import { beforeEach, describe, expect, it } from "vitest";
import {
    selectDirtySince,
    useEditorStore,
    type EditorSection,
} from "../editorStore";
import { FIELD_TS_KEY, getFieldTimestamps, stampField } from "@/lib/sync/fieldTimestamps";
import type { ResumeSection } from "@/hooks/useResume";

function resetStore() {
    useEditorStore.setState({
        sections: [],
        dirty: false,
        lastSyncedAt: null,
    });
}

function makeServerSection(over: Partial<ResumeSection> = {}): ResumeSection {
    return {
        id: "s1",
        resumeId: "r1",
        sectionType: "summary",
        displayOrder: 0,
        content: {},
        aiGenerated: false,
        visible: true,
        createdAt: "",
        updatedAt: "",
        ...over,
    };
}

beforeEach(resetStore);

describe("updateSectionField stamping", () => {
    it("stamps __field_updated_at on every edit", () => {
        useEditorStore.getState().setSections([makeServerSection()]);
        useEditorStore.getState().updateSectionField("s1", "summary", "hi");
        const sec = useEditorStore.getState().sections[0];
        expect(sec.content.summary).toBe("hi");
        const ts = getFieldTimestamps(sec.content);
        expect(typeof ts.summary).toBe("number");
        expect(ts.summary).toBeGreaterThan(0);
    });

    it("preserves prior field timestamps when stamping a new field", () => {
        useEditorStore.getState().setSections([makeServerSection()]);
        useEditorStore.getState().updateSectionField("s1", "a", 1);
        useEditorStore.getState().updateSectionField("s1", "b", 2);
        const sec = useEditorStore.getState().sections[0];
        const ts = getFieldTimestamps(sec.content);
        expect(Object.keys(ts).sort()).toEqual(["a", "b"]);
    });
});

describe("selectDirtySince", () => {
    it("returns null when no field timestamp is newer than lastSyncedAt", () => {
        useEditorStore.setState({
            lastSyncedAt: 100,
            sections: [
                {
                    id: "s1",
                    sectionType: "summary",
                    displayOrder: 0,
                    content: { [FIELD_TS_KEY]: { summary: 50 } },
                    aiGenerated: false,
                    visible: true,
                },
            ],
        });
        expect(selectDirtySince(useEditorStore.getState())).toBeNull();
    });

    it("returns the earliest newer timestamp across sections", () => {
        useEditorStore.setState({
            lastSyncedAt: 100,
            sections: [
                {
                    id: "s1",
                    sectionType: "summary",
                    displayOrder: 0,
                    content: { [FIELD_TS_KEY]: { a: 200, b: 300 } },
                    aiGenerated: false,
                    visible: true,
                },
                {
                    id: "s2",
                    sectionType: "experience",
                    displayOrder: 1,
                    content: { [FIELD_TS_KEY]: { c: 150 } },
                    aiGenerated: false,
                    visible: true,
                },
            ],
        });
        expect(selectDirtySince(useEditorStore.getState())).toBe(150);
    });
});

describe("markSyncedAll", () => {
    it("merges server-newer values and reports discarded client fields", () => {
        // Client has local "client v" stamped at T2; server returns "server v" at T3
        useEditorStore.setState({
            sections: [
                {
                    id: "s1",
                    sectionType: "summary",
                    displayOrder: 0,
                    content: stampField({}, "summary", "client v", 2_000),
                    aiGenerated: false,
                    visible: true,
                },
            ],
            dirty: true,
            lastSyncedAt: 0,
        });
        const conflicts = useEditorStore.getState().markSyncedAll(
            [
                makeServerSection({
                    content: stampField({}, "summary", "server v", 3_000),
                }),
            ],
            5_000,
        );
        expect(conflicts).toEqual([{ sectionId: "s1", field: "summary" }]);
        const sec = useEditorStore.getState().sections[0];
        expect(sec.content.summary).toBe("server v");
        expect(useEditorStore.getState().lastSyncedAt).toBe(5_000);
        expect(useEditorStore.getState().dirty).toBe(false);
    });

    it("keeps client-newer fields and stays dirty if any field is post-sync", () => {
        useEditorStore.setState({
            sections: [
                {
                    id: "s1",
                    sectionType: "summary",
                    displayOrder: 0,
                    content: stampField({}, "summary", "newer client", 6_000),
                    aiGenerated: false,
                    visible: true,
                },
            ],
            dirty: true,
            lastSyncedAt: 0,
        });
        const conflicts = useEditorStore.getState().markSyncedAll(
            [makeServerSection({ content: stampField({}, "summary", "server v", 3_000) })],
            5_000,
        );
        expect(conflicts).toEqual([]);
        const sec = useEditorStore.getState().sections[0];
        expect(sec.content.summary).toBe("newer client");
        // Field timestamp 6000 > syncedAt 5000 → still dirty
        expect(useEditorStore.getState().dirty).toBe(true);
    });
});

describe("hydrateFromCache", () => {
    it("restores dirty when a cached field timestamp is newer than lastSyncedAt", () => {
        const cached: EditorSection = {
            id: "s1",
            sectionType: "summary",
            displayOrder: 0,
            content: stampField({}, "summary", "offline edit", 9_000),
            aiGenerated: false,
            visible: true,
        };
        useEditorStore.getState().hydrateFromCache([cached], 1_000);
        expect(useEditorStore.getState().dirty).toBe(true);
        expect(useEditorStore.getState().sections[0].content.summary).toBe(
            "offline edit",
        );
    });

    it("stays clean when all timestamps are at or below lastSyncedAt", () => {
        const cached: EditorSection = {
            id: "s1",
            sectionType: "summary",
            displayOrder: 0,
            content: stampField({}, "summary", "synced", 100),
            aiGenerated: false,
            visible: true,
        };
        useEditorStore.getState().hydrateFromCache([cached], 100);
        expect(useEditorStore.getState().dirty).toBe(false);
    });
});
