import { describe, expect, it } from "vitest";
import {
    FIELD_TS_KEY,
    computeFieldDeltas,
    getFieldTimestamps,
    mergeSectionWithLWW,
    mergeWithLWW,
    stampField,
} from "../fieldTimestamps";
import type { EditorSection } from "@/stores/editorStore";

const T1 = 1_000_000_000;
const T2 = 2_000_000_000;

describe("getFieldTimestamps", () => {
    it("returns empty for null / undefined / non-object", () => {
        expect(getFieldTimestamps(null)).toEqual({});
        expect(getFieldTimestamps(undefined)).toEqual({});
    });

    it("filters out non-numeric, negative, and non-finite entries", () => {
        const ts = getFieldTimestamps({
            [FIELD_TS_KEY]: {
                a: 1,
                b: "2", // string — drop
                c: -3, // negative — drop
                d: Number.POSITIVE_INFINITY, // non-finite — drop
                e: 4,
            },
        });
        expect(ts).toEqual({ a: 1, e: 4 });
    });

    it("returns empty when the metadata key is malformed", () => {
        expect(getFieldTimestamps({ [FIELD_TS_KEY]: "oops" })).toEqual({});
    });
});

describe("stampField", () => {
    it("sets value and stamps the per-field timestamp", () => {
        const out = stampField({ summary: "hi" }, "summary", "hello", T1);
        expect(out.summary).toBe("hello");
        expect(getFieldTimestamps(out)).toEqual({ summary: T1 });
    });

    it("preserves other fields and prior timestamps", () => {
        const before = stampField({}, "summary", "hi", T1);
        const after = stampField(before, "location", "JKT", T2);
        expect(after).toMatchObject({ summary: "hi", location: "JKT" });
        expect(getFieldTimestamps(after)).toEqual({ summary: T1, location: T2 });
    });

    it("handles null / undefined input as empty content", () => {
        const out = stampField(null, "x", 1, T1);
        expect(out.x).toBe(1);
        expect(getFieldTimestamps(out)).toEqual({ x: T1 });
    });
});

describe("mergeWithLWW", () => {
    it("client newer field wins; server discarded", () => {
        const client = stampField({}, "summary", "client v", T2);
        const server = stampField({}, "summary", "server v", T1);
        const result = mergeWithLWW(client, server);
        expect(result.merged.summary).toBe("client v");
        expect(result.discardedServerFields).toEqual(["summary"]);
        expect(result.discardedClientFields).toEqual([]);
        expect(getFieldTimestamps(result.merged)).toEqual({ summary: T2 });
    });

    it("server newer field wins; client discarded", () => {
        const client = stampField({}, "summary", "client v", T1);
        const server = stampField({}, "summary", "server v", T2);
        const result = mergeWithLWW(client, server);
        expect(result.merged.summary).toBe("server v");
        expect(result.discardedClientFields).toEqual(["summary"]);
        expect(result.discardedServerFields).toEqual([]);
    });

    it("ties go to the server with no discard recorded", () => {
        const client = stampField({}, "summary", "x", T1);
        const server = stampField({}, "summary", "y", T1);
        const result = mergeWithLWW(client, server);
        expect(result.merged.summary).toBe("y");
        expect(result.discardedClientFields).toEqual([]);
        expect(result.discardedServerFields).toEqual([]);
    });

    it("disjoint fields union without conflict", () => {
        const client = stampField({}, "a", 1, T1);
        const server = stampField({}, "b", 2, T2);
        const result = mergeWithLWW(client, server);
        expect(result.merged).toMatchObject({ a: 1, b: 2 });
        expect(result.discardedClientFields).toEqual([]);
        expect(result.discardedServerFields).toEqual([]);
    });

    it("missing timestamps default to 0 (server wins on tie)", () => {
        const client = { summary: "client v" }; // no timestamp
        const server = { summary: "server v" }; // no timestamp
        const result = mergeWithLWW(client, server);
        expect(result.merged.summary).toBe("server v");
    });

    it("does not include __field_updated_at as a regular field", () => {
        const client = stampField({}, "a", 1, T1);
        const server = stampField({}, "a", 2, T2);
        const result = mergeWithLWW(client, server);
        expect("a" in result.merged).toBe(true);
        expect(FIELD_TS_KEY in result.merged).toBe(true);
        expect(Object.keys(getFieldTimestamps(result.merged))).toEqual(["a"]);
    });
});

describe("computeFieldDeltas", () => {
    it("returns fields whose current timestamp is newer than the snapshot", () => {
        const before = stampField({}, "a", 1, T1);
        const current = stampField(before, "a", 2, T2);
        expect(computeFieldDeltas(before, current)).toEqual(["a"]);
    });

    it("returns empty when nothing has been re-stamped", () => {
        const before = stampField({}, "a", 1, T1);
        expect(computeFieldDeltas(before, before)).toEqual([]);
    });

    it("includes brand-new fields not present in `before`", () => {
        const before = stampField({}, "a", 1, T1);
        const current = stampField(before, "b", 2, T2);
        expect(computeFieldDeltas(before, current)).toEqual(["b"]);
    });
});

describe("mergeSectionWithLWW", () => {
    function section(over: Partial<EditorSection> = {}): EditorSection {
        return {
            id: "s",
            sectionType: "summary",
            displayOrder: 0,
            content: {},
            aiGenerated: false,
            visible: true,
            ...over,
        };
    }

    it("preserves client displayOrder when client has unsynced field edits", () => {
        const client = section({
            displayOrder: 3,
            content: stampField({}, "summary", "x", T2),
        });
        const server = section({
            displayOrder: 0,
            content: stampField({}, "summary", "y", T1),
        });
        const out = mergeSectionWithLWW(client, server);
        expect(out.merged.displayOrder).toBe(3);
        expect(out.merged.content.summary).toBe("x");
    });

    it("uses server displayOrder when client has no unsynced edits", () => {
        const client = section({
            displayOrder: 3,
            content: stampField({}, "summary", "x", T1),
        });
        const server = section({
            displayOrder: 0,
            content: stampField({}, "summary", "y", T2),
        });
        const out = mergeSectionWithLWW(client, server);
        expect(out.merged.displayOrder).toBe(0);
        expect(out.merged.content.summary).toBe("y");
        expect(out.discardedClientFields).toEqual(["summary"]);
    });
});
