import type { EditorSection } from "@/stores/editorStore";

/**
 * Per-field last-write-wins helpers.
 *
 * Each section's `content` carries an optional sibling object under the
 * key `__field_updated_at` mapping every user-visible field key to its
 * last-edit timestamp (ms epoch). Both client and server contribute to
 * this map — the server stamps it on every accepted write so the protocol
 * is convergent under client clock skew (see story 2.4 spec).
 *
 * Conventions:
 *   - timestamps are flat: top-level content keys only. Nested arrays
 *     (e.g. `experience.bullets[]`) sync as a single field replacement.
 *   - the metadata key starts with `__` so user-content schemas can filter
 *     it out without an out-of-band table.
 *   - missing timestamps are treated as `0` (i.e. older than any real edit).
 *   - when timestamps tie, the server side wins by spec.
 */

export const FIELD_TS_KEY = "__field_updated_at";

export type FieldTimestamps = Record<string, number>;

interface ContentWithTs {
    [k: string]: unknown;
    [FIELD_TS_KEY]?: FieldTimestamps;
}

/** Read the field-timestamps map out of a content blob. Defensive: a malformed
 * value (e.g. a string mistakenly stored at this key) is treated as empty. */
export function getFieldTimestamps(
    content: Record<string, unknown> | null | undefined,
): FieldTimestamps {
    if (!content || typeof content !== "object") return {};
    const raw = (content as ContentWithTs)[FIELD_TS_KEY];
    if (!raw || typeof raw !== "object") return {};
    const out: FieldTimestamps = {};
    for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
            out[k] = v;
        }
    }
    return out;
}

/**
 * Return a new content blob with `field` set to `value` and its timestamp
 * stamped to `now`. Pure — never mutates input.
 */
export function stampField(
    content: Record<string, unknown> | null | undefined,
    field: string,
    value: unknown,
    now: number,
): Record<string, unknown> {
    const base: Record<string, unknown> = content && typeof content === "object" ? content : {};
    const prevTs = getFieldTimestamps(base);
    return {
        ...base,
        [field]: value,
        [FIELD_TS_KEY]: { ...prevTs, [field]: now },
    };
}

export interface MergeResult {
    /** Merged content blob with per-field newest values + timestamps. */
    merged: Record<string, unknown>;
    /** Field keys where the client value was discarded (server newer). */
    discardedClientFields: string[];
    /** Field keys where the server value was discarded (client newer). */
    discardedServerFields: string[];
}

/**
 * Last-write-wins per-field merge of two content blobs. The result includes a
 * unified `__field_updated_at` map (max of both sides per field).
 *
 * Tie-breaking: when timestamps are exactly equal, the server side wins.
 * This is documented in the story 2.4 spec.
 */
export function mergeWithLWW(
    clientContent: Record<string, unknown> | null | undefined,
    serverContent: Record<string, unknown> | null | undefined,
): MergeResult {
    const client = clientContent && typeof clientContent === "object" ? clientContent : {};
    const server = serverContent && typeof serverContent === "object" ? serverContent : {};
    const clientTs = getFieldTimestamps(client);
    const serverTs = getFieldTimestamps(server);

    const fields = new Set<string>();
    for (const k of Object.keys(client)) {
        if (k !== FIELD_TS_KEY) fields.add(k);
    }
    for (const k of Object.keys(server)) {
        if (k !== FIELD_TS_KEY) fields.add(k);
    }

    const merged: Record<string, unknown> = {};
    const mergedTs: FieldTimestamps = {};
    const discardedClientFields: string[] = [];
    const discardedServerFields: string[] = [];

    for (const field of fields) {
        const clientHas = Object.prototype.hasOwnProperty.call(client, field);
        const serverHas = Object.prototype.hasOwnProperty.call(server, field);
        const ct = clientTs[field] ?? 0;
        const st = serverTs[field] ?? 0;

        if (clientHas && !serverHas) {
            merged[field] = client[field];
            mergedTs[field] = ct;
        } else if (!clientHas && serverHas) {
            merged[field] = server[field];
            mergedTs[field] = st;
        } else {
            // Both sides have the field — LWW with server-wins on tie.
            if (ct > st) {
                merged[field] = client[field];
                mergedTs[field] = ct;
                discardedServerFields.push(field);
            } else {
                merged[field] = server[field];
                mergedTs[field] = st;
                if (ct < st) discardedClientFields.push(field);
                // ct === st → no discard (same value-identity assumed by spec)
            }
        }
    }

    if (Object.keys(mergedTs).length > 0) {
        merged[FIELD_TS_KEY] = mergedTs;
    }
    return { merged, discardedClientFields, discardedServerFields };
}

/**
 * Compute which top-level fields in `current` have a newer timestamp than
 * the corresponding `before` snapshot. Returned in the order of `current`'s
 * field-timestamps map.
 */
export function computeFieldDeltas(
    before: Record<string, unknown> | null | undefined,
    current: Record<string, unknown> | null | undefined,
): string[] {
    const beforeTs = getFieldTimestamps(before);
    const currentTs = getFieldTimestamps(current);
    const deltas: string[] = [];
    for (const [field, ts] of Object.entries(currentTs)) {
        if ((beforeTs[field] ?? 0) < ts) deltas.push(field);
    }
    return deltas;
}

/**
 * Section-level convenience wrapper: merge two `EditorSection`s by content.
 * Non-content fields (`displayOrder`, `visible`, `aiGenerated`) take the
 * server side except `displayOrder` for which we keep the client value when
 * the client has any unsynced field deltas (drag-reorder is a client event).
 */
export function mergeSectionWithLWW(
    clientSection: EditorSection,
    serverSection: EditorSection,
): { merged: EditorSection; discardedClientFields: string[]; discardedServerFields: string[] } {
    const result = mergeWithLWW(clientSection.content, serverSection.content);
    const clientHasNewerEdits =
        computeFieldDeltas(serverSection.content, clientSection.content).length > 0;
    return {
        merged: {
            id: serverSection.id,
            sectionType: serverSection.sectionType,
            // Keep client display order if the user reordered locally; server
            // is the source of truth otherwise.
            displayOrder: clientHasNewerEdits
                ? clientSection.displayOrder
                : serverSection.displayOrder,
            content: result.merged,
            aiGenerated: serverSection.aiGenerated,
            visible: serverSection.visible,
        },
        discardedClientFields: result.discardedClientFields,
        discardedServerFields: result.discardedServerFields,
    };
}
