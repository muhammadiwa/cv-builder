/**
 * Server-side last-write-wins reducer for section content fields.
 *
 * Pairs with `apps/web/lib/sync/fieldTimestamps.ts` on the client. The server
 * is the convergent clock authority: every field the server accepts is
 * stamped with `serverNow` so the next LWW round from any device compares
 * against the server's monotonic clock, immune to client clock skew.
 */

export const FIELD_TS_KEY = '__field_updated_at';

export interface ServerConflict {
    sectionId: string;
    field: string;
    keptSide: 'server' | 'client';
    serverValue: unknown;
    clientValue: unknown;
    sectionLabel: string;
}

interface ContentWithTs {
    [k: string]: unknown;
    [FIELD_TS_KEY]?: Record<string, number>;
}

function readTs(content: Record<string, unknown> | null | undefined): Record<string, number> {
    if (!content || typeof content !== 'object') return {};
    const raw = (content as ContentWithTs)[FIELD_TS_KEY];
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
}

/**
 * Merge `clientContent` into `serverContent` using per-field LWW. The merged
 * result has every field stamped with either the existing server timestamp
 * (when the server kept its value) or `serverNow` (when the server accepted
 * the client's value).
 *
 * Tie-breaking: when both sides have the same field and the timestamps are
 * equal, the server side wins. This is documented in the story 2.4 spec.
 *
 * Conflicts (where the client lost) are returned for the response payload so
 * the UI can toast them. Conflicts are NOT raised when:
 *   - the field is identical on both sides (no semantic disagreement)
 *   - the client never sent a timestamp for that field (treated as 0; the
 *     client may simply be on a path that doesn't track timestamps yet)
 */
export function mergeContentLWW(
    clientContent: Record<string, unknown> | null | undefined,
    serverContent: Record<string, unknown> | null | undefined,
    serverNow: number,
    sectionId: string,
    sectionLabel: string,
): { merged: Record<string, unknown>; conflicts: ServerConflict[] } {
    const client = clientContent && typeof clientContent === 'object' ? clientContent : {};
    const server = serverContent && typeof serverContent === 'object' ? serverContent : {};
    const clientTs = readTs(client);
    const serverTs = readTs(server);

    const fields = new Set<string>();
    for (const k of Object.keys(client)) if (k !== FIELD_TS_KEY) fields.add(k);
    for (const k of Object.keys(server)) if (k !== FIELD_TS_KEY) fields.add(k);

    const merged: Record<string, unknown> = {};
    const mergedTs: Record<string, number> = {};
    const conflicts: ServerConflict[] = [];

    for (const field of fields) {
        const ct = clientTs[field] ?? 0;
        const st = serverTs[field] ?? 0;
        const clientHas = Object.prototype.hasOwnProperty.call(client, field);
        const serverHas = Object.prototype.hasOwnProperty.call(server, field);

        if (clientHas && !serverHas) {
            // Brand-new field from the client — accept and stamp with server clock.
            merged[field] = client[field];
            mergedTs[field] = serverNow;
        } else if (!clientHas && serverHas) {
            // Field the client didn't send — preserve server side.
            merged[field] = server[field];
            mergedTs[field] = st || serverNow;
        } else {
            // Both have the field. LWW with server-wins on tie.
            if (ct > st) {
                merged[field] = client[field];
                mergedTs[field] = serverNow;
            } else {
                merged[field] = server[field];
                mergedTs[field] = st || serverNow;
                const sameValue = JSON.stringify(server[field]) === JSON.stringify(client[field]);
                if (ct < st && !sameValue && ct > 0) {
                    conflicts.push({
                        sectionId,
                        field,
                        keptSide: 'server',
                        serverValue: server[field],
                        clientValue: client[field],
                        sectionLabel,
                    });
                }
            }
        }
    }

    if (Object.keys(mergedTs).length > 0) {
        merged[FIELD_TS_KEY] = mergedTs;
    }
    return { merged, conflicts };
}
