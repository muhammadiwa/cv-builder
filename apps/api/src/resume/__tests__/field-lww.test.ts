import { mergeContentLWW, FIELD_TS_KEY } from '../field-lww';

const SECTION_ID = 'sec-1';
const LABEL = 'summary';
const SERVER_NOW = 5_000_000;

function withTs(content: Record<string, unknown>, ts: Record<string, number>) {
    return { ...content, [FIELD_TS_KEY]: ts };
}

describe('mergeContentLWW', () => {
    test('client newer field wins; server stamp moves to serverNow', () => {
        const client = withTs({ summary: 'client v' }, { summary: 2_000 });
        const server = withTs({ summary: 'server v' }, { summary: 1_000 });
        const { merged, conflicts } = mergeContentLWW(client, server, SERVER_NOW, SECTION_ID, LABEL);
        expect(merged.summary).toBe('client v');
        expect((merged[FIELD_TS_KEY] as Record<string, number>).summary).toBe(SERVER_NOW);
        expect(conflicts).toEqual([]);
    });

    test('server newer field wins; conflict reported with both values', () => {
        const client = withTs({ summary: 'client v' }, { summary: 1_000 });
        const server = withTs({ summary: 'server v' }, { summary: 2_000 });
        const { merged, conflicts } = mergeContentLWW(client, server, SERVER_NOW, SECTION_ID, LABEL);
        expect(merged.summary).toBe('server v');
        expect((merged[FIELD_TS_KEY] as Record<string, number>).summary).toBe(2_000);
        expect(conflicts).toHaveLength(1);
        expect(conflicts[0]).toMatchObject({
            sectionId: SECTION_ID,
            field: 'summary',
            keptSide: 'server',
            serverValue: 'server v',
            clientValue: 'client v',
            sectionLabel: LABEL,
        });
    });

    test('ties go to server with no conflict raised', () => {
        const client = withTs({ summary: 'x' }, { summary: 1_000 });
        const server = withTs({ summary: 'y' }, { summary: 1_000 });
        const { merged, conflicts } = mergeContentLWW(client, server, SERVER_NOW, SECTION_ID, LABEL);
        expect(merged.summary).toBe('y');
        // Conflict NOT raised on tie even though values differ — protocol design choice.
        expect(conflicts).toEqual([]);
    });

    test('client field with timestamp 0 (no-stamp) does not raise a conflict on loss', () => {
        // A client that hasn't been upgraded to send timestamps just gets
        // overwritten silently. Conflict toasts would be noise.
        const client = { summary: 'client v' };
        const server = withTs({ summary: 'server v' }, { summary: 2_000 });
        const { merged, conflicts } = mergeContentLWW(client, server, SERVER_NOW, SECTION_ID, LABEL);
        expect(merged.summary).toBe('server v');
        expect(conflicts).toEqual([]);
    });

    test('identical values do not produce a conflict even when client lost', () => {
        const client = withTs({ summary: 'same' }, { summary: 1_000 });
        const server = withTs({ summary: 'same' }, { summary: 2_000 });
        const { conflicts } = mergeContentLWW(client, server, SERVER_NOW, SECTION_ID, LABEL);
        expect(conflicts).toEqual([]);
    });

    test('brand-new client field is accepted and stamped with serverNow', () => {
        const client = withTs({ summary: 'a', location: 'JKT' }, { summary: 1_000, location: 1_500 });
        const server = withTs({ summary: 'a' }, { summary: 1_000 });
        const { merged, conflicts } = mergeContentLWW(client, server, SERVER_NOW, SECTION_ID, LABEL);
        expect(merged.location).toBe('JKT');
        expect((merged[FIELD_TS_KEY] as Record<string, number>).location).toBe(SERVER_NOW);
        expect(conflicts).toEqual([]);
    });

    test('server field client did not send is preserved as-is', () => {
        const client = withTs({ summary: 'a' }, { summary: 1_000 });
        const server = withTs({ summary: 'a', location: 'BDG' }, { summary: 1_000, location: 500 });
        const { merged, conflicts } = mergeContentLWW(client, server, SERVER_NOW, SECTION_ID, LABEL);
        expect(merged.location).toBe('BDG');
        expect((merged[FIELD_TS_KEY] as Record<string, number>).location).toBe(500);
        expect(conflicts).toEqual([]);
    });

    test('strips __field_updated_at from regular field iteration', () => {
        const client = withTs({ summary: 'a' }, { summary: 1_000 });
        const server = withTs({ summary: 'b' }, { summary: 2_000 });
        const { merged } = mergeContentLWW(client, server, SERVER_NOW, SECTION_ID, LABEL);
        const ts = merged[FIELD_TS_KEY] as Record<string, number>;
        expect(Object.keys(ts)).toEqual(['summary']);
    });

    test('handles null content on either side', () => {
        const { merged, conflicts } = mergeContentLWW(null, null, SERVER_NOW, SECTION_ID, LABEL);
        expect(merged).toEqual({});
        expect(conflicts).toEqual([]);
    });

    test('malformed __field_updated_at is treated as empty (defensive)', () => {
        const client = { summary: 'a', [FIELD_TS_KEY]: 'oops' as unknown };
        const server = withTs({ summary: 'b' }, { summary: 1_000 });
        const { merged, conflicts } = mergeContentLWW(
            client as Record<string, unknown>,
            server,
            SERVER_NOW,
            SECTION_ID,
            LABEL,
        );
        // ct=0, st=1000 → server wins. No conflict (ct=0 is unstamped client).
        expect(merged.summary).toBe('b');
        expect(conflicts).toEqual([]);
    });
});
