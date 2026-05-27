---
baseline_commit: 846492011f8f71cc1fedeb5375c7ebbfb71ae0dd
---

# Story 2.4: Auto-Save and Offline Persistence

**Status:** ready-for-dev
**Epic:** 2 — Resume Editor
**Created:** 2026-05-27

---

## User Story

As a job seeker on unstable Indonesian internet,
I want my CV changes saved automatically and never lost,
So that I can edit without fear of losing progress.

---

## Acceptance Criteria

**AC-1:** Given the user is editing their CV, When any change is made, Then changes are persisted to IndexedDB (Dexie.js) within **800ms** of the last keystroke.

**AC-2:** And changes are synced to the API within **2 seconds** when the browser is online.

**AC-3:** And the StatusBar sync dot reflects the real state — green = synced (API up to date), yellow = pending (debouncing or in-flight to API/IDB), red = offline (`navigator.onLine === false`). The dot reads from a single hook (`useSyncStatus`) that observes both the local IDB queue and the in-flight API request, not just `navigator.onLine` and an in-memory `dirty` flag.

**AC-4:** And if the browser is closed mid-edit and reopened (same tab session OR a fresh tab on the same device), the resume opens with the unsynced edits already restored from IndexedDB before the API response arrives — the user sees their last edit immediately, then the page reconciles with the server.

**AC-5:** And conflict resolution operates at the **field level** with last-write-wins semantics: when the server has a newer value for one field but the client has a newer value for another field on the same section, the merge keeps the newer value per-field rather than overwriting the entire section.

**AC-6:** And the user is notified via a non-blocking toast when the conflict resolver discards any client field in favor of a newer server value (so silent data loss never happens). The toast lists the section + field name and offers an "Pulihkan versi saya" undo affordance for ~10 seconds.

---

## Developer Context

### Architecture

This story finally closes the loop the StatusBar in Story 2.3 was already drawing. Today the editor:

1. Renders sections from a Zustand store (`useEditorStore`).
2. Debounces edits → 2 s → PATCH to `/api/v1/resumes/:id` (`useDebouncedSync`).
3. Sets `dirty=true` on edit, `dirty=false` after a successful PATCH (`markClean`).
4. The StatusBar reads `dirty` + `navigator.onLine` to render `synced | pending | offline`.

What's missing:

- **No local-first persistence.** A page reload loses unsynced edits if the 2 s API debounce hadn't fired yet, or if the API request was in-flight and the user closed the tab.
- **No conflict resolution.** PATCH is fire-and-forget; the server's response replaces the entire section payload, so any concurrent edit from another device is silently overwritten.
- **The sync dot lies.** `pending` is true between keystrokes (debouncing) and during a real in-flight PATCH — those are different states in practice, but more importantly there's no signal for "saved locally, not yet synced".

This story introduces three concrete moving parts:

```
┌────────────────────────────────────────────────────────────────────┐
│ Edit (Zustand updateSectionField)                                  │
│   └─→ field stamped with (clientId, fieldUpdatedAt) in store       │
└─┬──────────────────────────────────────────────────────────────────┘
  │  ≤ 800 ms (idle)
  ↓
┌────────────────────────────────────────────────────────────────────┐
│ useIndexedDBSync — Dexie write                                     │
│   - persists sections + per-field timestamps                       │
│   - persists "dirty since" timestamp                               │
└─┬──────────────────────────────────────────────────────────────────┘
  │  ≤ 2 s (idle)
  ↓
┌────────────────────────────────────────────────────────────────────┐
│ useDebouncedSync — PATCH /resumes/:id                              │
│   - request body: sections[].fields[].value + fieldUpdatedAt        │
│   - server applies per-field LWW, returns merged sections          │
│   - 200 → reconcile store, mark synced, clear IDB row              │
│   - 409 → resolve via merge response, toast on discarded fields    │
│   - 5xx / network → keep IDB row, retry on next debounce/online    │
└────────────────────────────────────────────────────────────────────┘
```

**Field-level LWW protocol** (server side, see Tasks 2.x for backend changes):

- Each `ResumeSection.content` field carries a sibling timestamp object `__field_updated_at` (one numeric ms epoch per field key, e.g. `{ summary: 1717000000000, location: 1717000010000 }`). The PATCH payload also includes these.
- Backend applies per-field LWW: for each incoming field, keep the value whose `fieldUpdatedAt` is newer than the stored one. Discarded client fields are returned in the response under `{ conflicts: [{ sectionId, field, kept: "server", serverValue, clientValue }] }`.
- **Server is also a clock authority.** Whenever the backend accepts a write to a field (whether from this client or a different device on a previous round), it stamps `content.__field_updated_at[field] = serverNow()` before persisting. The next round of LWW from any client compares its claimed timestamps against the server's stamp. This keeps the protocol convergent even when client clocks are skewed — the server-stamped value becomes the canonical "this server saw the write at T".
- Client toasts each conflict and offers "Pulihkan versi saya" — clicking it issues a new PATCH with a bumped `fieldUpdatedAt` so the user's value wins on the next round.

**Restore on load** is a coordinated dance between IndexedDB and React Query. IndexedDB access is asynchronous; we cannot paint synchronously from cache before the first React commit. Instead we use a **paint-server-then-patch** strategy:

1. The page mounts as today — `useResume(...)` (React Query) drives the first render. While the network is in flight, React Query returns its cached payload (or `undefined` for a cold load), so the canvas paints either the previously-fetched server state or a skeleton.
2. `useResumeRestore({ resumeId })` mounts in parallel and reads `resumeRepo.loadResume(resumeId)` from IndexedDB. When that promise resolves (typically within ~10 ms on warm IDB, ~50 ms on cold open), it merges the IDB row into the editor store via `mergeWithLWW` — so any unsynced client field deltas patch onto the server-painted canvas.
3. When the React Query result arrives, the same `mergeWithLWW` runs again with the server payload. The merge is idempotent (timestamp-based), so it doesn't matter whether IDB resolves first or the server resolves first — the final state is the per-field newest of (server, IDB, in-memory edits).

**Hook ownership during restore**: `useResume` owns the canonical server state and React Query cache. `useResumeRestore` owns the IDB-cached edits and only writes to the editor store. The editor store is the single source of truth that `<EditorShell>` and `<ResumeCanvas>` render from. Neither hook blocks the other; both feed the same merge function.

### Technical Specs

- **Dexie 4.x** — installed as `dexie` in `apps/web/package.json`. Schema:
  ```ts
  // apps/web/lib/db/dexie.ts
  class CvBuilderDB extends Dexie {
    resumes!: Table<{
      id: string; // resumeId
      sections: ResumeSection[]; // includes per-field __field_updated_at
      dirtySince: number | null; // ms epoch of first dirty edit since last sync
      lastSyncedAt: number | null; // ms epoch of last successful PATCH
      schemaVersion: number; // bump on shape change for migrations
    }>;
  }
  // version 1: by('id')
  ```
- **IndexedDB debounce: 800ms idle**, separate from the 2 s API debounce. The two run independently — IDB write fires faster so a tab close at t=900ms still preserves the edit.
  - **Note on architecture doc.** `_bmad-output/planning-artifacts/architecture.md` Decision 6 cites `150ms → IndexedDB`. Epic AC-1 specifies `800ms`. The AC supersedes the architecture cell — 150 ms was the original aspirational target; 800 ms was chosen for the AC because it batches whole-word edits and reduces IDB churn on mid-range Android (the primary target device). The architecture doc will be reconciled in the Epic 2 retrospective; until then this spec is the source of truth.
- **API debounce stays 2 s** (already in `useDebouncedSync`). The PATCH body grows by including `fieldUpdatedAt` per field; **payload size cap stays at 64 KB per section** (already enforced server-side via `sectionInputSchema`).
- **Conflict response shape** (server → client):
  ```ts
  type PatchResumeResponse = {
    resume: Resume;
    sections: ResumeSection[];
    conflicts?: Array<{
      sectionId: string;
      field: string;
      keptSide: "server" | "client";
      serverValue: unknown;
      clientValue: unknown;
      sectionLabel: string; // human-readable for the toast
    }>;
  };
  ```
- **Field name convention.** `__field_updated_at` lives inside the section's `content` JSONB as a sibling object to the user-facing fields. Double-underscore prefix is used to mark "framework metadata, not user content" so renderers and content schemas can filter it out without a separate column. Keep it **flat** (top-level keys only) — nested-field LWW (e.g., `experience.bullets[2].text`) is out of scope; bullet-array re-orders ship as a single field replacement.
- **Online/offline transition:** when `online` flips to `true`, `useDebouncedSync` triggers a flush of any IDB row marked `dirtySince != null`. When it flips to `false`, the in-flight `AbortController` is aborted and the row stays dirty.
- **Sync states:**
  - `synced` — `dirtySince == null && navigator.onLine === true`
  - `pending` — `dirtySince != null` (regardless of why — debounce, in-flight, or queued)
  - `offline` — `navigator.onLine === false`
  - The UI from Story 2.3 already renders these three states; we just point the hook at IDB-backed state instead of the in-memory flag.
- **Restore is per-tab session.** We do NOT cross-tab broadcast (no `BroadcastChannel`) yet — opening the same resume in two tabs on the same browser will produce a stream of conflict toasts on every sync (each tab's PATCH overwrites the other's last write). This is documented behavior, not a bug, until cross-tab reconciliation lands as a follow-up.
- **Storage durability is best-effort.** IndexedDB can be evicted by the browser under storage pressure (Safari is the most aggressive). The server remains the durable source of truth; IDB is a cache + offline queue, never the only copy. We do NOT call `navigator.storage.persist()` in this story — that surfaces a permission prompt and is a UX decision for a follow-up.
- **Data lifetime in IndexedDB:** rows older than **90 days** with `dirtySince == null` are GC'd on app boot — chosen so users returning after a few weeks (the resume-builder norm) still get instant restore. Dirty rows are never auto-deleted regardless of age.
- **On logout, the IDB store for the logging-out user must be cleared** — see Task 8.2. Leaving CV data in shared-device IDB is a privacy issue, not a deferred polish item.
- **Privacy:** IndexedDB content is NOT encrypted — the device is trusted, the user is logged in, and IDB respects the same-origin policy. PII passes through the existing PII gateway during export, not at rest in IDB.

### Files (planned)

**New:**
- `apps/web/lib/db/dexie.ts` — Dexie database, schema v1, typed Tables
- `apps/web/lib/db/resumeRepo.ts` — Dexie-backed repository: `loadResume`, `saveResume`, `markSynced`, `gcOldRows`
- `apps/web/lib/sync/fieldTimestamps.ts` — pure helpers: `stampField`, `mergeWithLWW`, `computeFieldDeltas`
- `apps/web/hooks/useIndexedDBSync.ts` — 800 ms idle debounce → `resumeRepo.saveResume`; subscribes to `useEditorStore` selectors
- `apps/web/hooks/useResumeRestore.ts` — synchronous (suspense) restore from Dexie before first paint
- `apps/web/components/editor/ConflictToast.tsx` — composes one-line conflict toasts via `sonner`, with the "Pulihkan versi saya" action wired through

**Modified:**
- `apps/web/stores/editorStore.ts`
  - track `__field_updated_at` per section field as edits happen
  - new `markFieldClean(sectionId, field)` and `markSyncedAll(serverSections)` actions for the merge return path
  - `dirtySince: number | null` derived from any field timestamp newer than `lastSyncedAt`
- `apps/web/hooks/useDebouncedSync.ts`
  - include `__field_updated_at` in payload
  - on success, apply merge: client wins on per-field newer; server wins where server is newer
  - on response with `conflicts[]`, hand off to `ConflictToast`
  - flush queued IDB row on `online` transition
- `apps/web/hooks/useSyncStatus.ts`
  - read `dirtySince` from the editor store (which now reflects IDB-truth) instead of the in-memory `dirty` flag
- `apps/web/app/(dashboard)/resume/[id]/page.tsx`
  - call `useResumeRestore({ resumeId })` before `useResume(...)` so the editor paints from the IDB row before the API hydrates
  - remove the `dirty===false` re-hydration shortcut from Story 2.2 — replaced by the LWW merge below
- `apps/web/app/providers.tsx`
  - register a `gcOldRows()` IIFE on app boot (kicks in once on initial mount)
- `apps/api/src/resume/resume.service.ts`
  - extend section update path to apply per-field LWW
  - return `conflicts[]` payload when fields are discarded
- `apps/api/src/resume/resume.controller.ts`
  - response type for `PATCH /resumes/:id` updated to include `conflicts?`
- `packages/validators/src/resume.schema.ts`
  - add an optional `__field_updated_at: Record<string, number>` to `sectionInputSchema.content` (with the same 64 KB cap as content); export `PatchResumeResponse` type
- `packages/database/prisma/schema.prisma`
  - **NO schema change** for this story — `__field_updated_at` lives inside the existing `content` JSONB. We deliberately avoid a sibling table for now; if conflict volume justifies it later (Story 2.x retrospective), extracting the timestamps to a `resume_section_fields` table is a refactor we can do without changing this story's protocol.

### Dependencies

- **Story 2.2 (TipTap Editor with Section Blocks)** — done. `useEditorStore` and `useDebouncedSync` exist; `updateSectionField` is the atomic edit hook this story extends with field timestamps.
- **Story 2.3 (Multi-Panel Layout)** — done. StatusBar dot already rendered; `useSyncStatus` already in place. We're rewiring its inputs, not the UI.
- **Story 1.7 (PWA + Service Worker)** — done. Service worker + offline shell are live; we sit on top of that, no SW changes in this story.
- `dexie@^4` — new dependency, ~30 KB gzipped, mature, single-purpose.
- `sonner` — already a dependency (used by `useDebouncedSync` for sync error toasts since Story 2.2 review).

### Out of scope (deferred to other stories)

- **Multi-tab edit collisions on the same browser** — when a user opens the same resume in two tabs concurrently, every sync from either tab will trigger a conflict toast on the other. The two-tab race is documented behavior for this story. Cross-tab reconciliation needs `BroadcastChannel` and is a separate ticket.
- **Background Sync API** — using vanilla `online`/`offline` events plus on-load flush gets us the AC. The Service Worker Background Sync API is broader and gated on browser availability; deferred until we have telemetry showing it's worth the complexity.
- **Per-edit operational transform / CRDT** — explicitly rejected by Architecture Decision 6. Field-level LWW is the bargain.
- **Conflict UI beyond toast** — a full diff viewer / merge editor is a UX research project. Toast + "Pulihkan versi saya" undo is the contract for this story.
- **Encrypted IDB at rest** — see Privacy note above; out of scope without a key-management story.
- **`navigator.storage.persist()` opt-in** — surfaces a permission prompt on most browsers; UX decision for a follow-up.
- **Sync queue depth indicator** — the dot is binary (synced/pending/offline). A "queue: 3 changes" badge is a follow-up if user testing shows people want it.
- **Nested-field LWW** — `__field_updated_at` is flat (top-level content keys only). Sub-arrays like `experience.bullets[]` are a single LWW unit; per-bullet conflict resolution is a separate ticket if telemetry shows it's needed.

---

## Tasks/Subtasks

### 1. IndexedDB foundation (Dexie)

- [ ] 1.1 Add `dexie@^4` to `apps/web/package.json` (runtime dep) and `fake-indexeddb@^6` to `apps/web/devDependencies` (test-only — JSDOM doesn't ship an IDB implementation, and Story 1.9's Vitest setup currently doesn't pull it in). Run `pnpm install` to update the lock.
- [ ] 1.2 Extend `apps/web/vitest.setup.ts` to import `fake-indexeddb/auto` at the top of the file so every test gets a fresh in-memory IDB. Document with a one-line comment that this exists *because* JSDOM ≠ a real browser.
- [ ] 1.3 Create `apps/web/lib/db/dexie.ts` — `CvBuilderDB` class extending Dexie, schema v1: `resumes` table keyed by `id` with the shape from Technical Specs.
- [ ] 1.4 Create `apps/web/lib/db/resumeRepo.ts` exposing:
  - `loadResume(id: string): Promise<DexieResume | null>`
  - `saveResume(row: DexieResume): Promise<void>`
  - `markSynced(id: string, lastSyncedAt: number): Promise<void>` — clears `dirtySince`, stamps `lastSyncedAt`
  - `gcOldRows(maxAgeMs = 90*24*3600*1000): Promise<void>` — deletes non-dirty rows older than `maxAgeMs`
  - `clearAll(): Promise<void>` — drops the whole `resumes` table; called on logout
- [ ] 1.5 Add a Vitest unit test for `resumeRepo` against `fake-indexeddb`. Cover: round-trip save→load, GC respects `dirtySince != null`, GC respects 90-day boundary, `clearAll` empties the table, schema-version mismatch is dropped not crashed.

### 2. Field-level timestamps in the editor store

- [ ] 2.1 Add a pure helper module `apps/web/lib/sync/fieldTimestamps.ts`:
  - `stampField(content, field, now)` — returns new content with `content.__field_updated_at[field] = now`
  - `mergeWithLWW(clientSection, serverSection)` — returns `{ merged, discardedClientFields, discardedServerFields }` with per-field LWW based on each side's `__field_updated_at`
  - `computeFieldDeltas(beforeSync, current)` — returns the field paths whose timestamp is newer than `beforeSync.__field_updated_at`
  - Vitest unit tests for all three (table-driven, covering tied timestamps → server wins by spec).
- [ ] 2.2 Extend `updateSectionField` in `apps/web/stores/editorStore.ts` to call `stampField(content, field, Date.now())` on every edit.
- [ ] 2.3 Add a derived selector `selectDirtySince(state)` that returns the smallest `__field_updated_at` newer than `lastSyncedAt`, or `null` if none. Used by `useSyncStatus`.
- [ ] 2.4 Add `markSyncedAll(serverSections)` store action that:
  - merges server sections with current store via `mergeWithLWW` per section
  - sets `lastSyncedAt = Date.now()`
  - clears any field-level "dirty" markers that were synced
- [ ] 2.5 Add a Vitest unit test for the store actions: `updateSectionField` stamps, `markSyncedAll` clears appropriately.

### 3. IndexedDB write hook

- [ ] 3.1 Create `apps/web/hooks/useIndexedDBSync.ts`. Subscribes to `useEditorStore` for `(resumeId, sections, lastSyncedAt)`. On any change, debounce 800 ms idle, then call `resumeRepo.saveResume({ id: resumeId, sections, dirtySince, lastSyncedAt, schemaVersion: 1 })`.
- [ ] 3.2 Mount the hook in `apps/web/app/(dashboard)/resume/[id]/page.tsx`. The hook is a side effect, no return value needed beyond a flush ref for tests.
- [ ] 3.3 Vitest test: rapid edits within 800 ms → exactly one `saveResume` call. Edit then idle 1 s → write happens. Unmount during pending debounce → write still flushes (no lost edits).

### 4. Restore-on-load

- [ ] 4.1 Create `apps/web/hooks/useResumeRestore.ts`. On mount, calls `resumeRepo.loadResume(resumeId)` (async). When the promise resolves, dispatches `markSyncedAll(idbSections)` so the IDB-cached `__field_updated_at`s merge cleanly into the existing store via the same LWW reducer used for server payloads. The hook returns `{ status: "loading" | "restored" | "empty" }` for tests; the actual canvas paints from the editor store and doesn't block on this hook.
- [ ] 4.2 Wire into `apps/web/app/(dashboard)/resume/[id]/page.tsx`. **Hook ownership:** `useResume(...)` owns the React Query cache + server payload; `useResumeRestore(...)` owns the IDB read. Both hooks write to the editor store via `markSyncedAll`. The editor store's per-field timestamps + the LWW merge make the order in which they resolve irrelevant — IDB-first or server-first both end at the same final state.
- [ ] 4.3 When the React Query result arrives, call `markSyncedAll(serverSections)` (which uses `mergeWithLWW` per section) so any unsynced client fields stay client-side and the rest is replaced from server.
- [ ] 4.4 Remove the previous shortcut at `apps/web/app/(dashboard)/resume/[id]/page.tsx` that only re-hydrates when `!dirty` — superseded by the merge.
- [ ] 4.5 Vitest+RTL test: seed Dexie with a row whose `summary` field has `fieldUpdatedAt` newer than the mock server's value; mount the editor; expect the canvas to paint server values first, then patch to the IDB value within the next React commit, with the StatusBar dot starting `pending` and staying `pending` until the next sync. Also test the inverse — server newer than IDB → server value sticks.

### 5. Conflict-resolving sync

- [ ] 5.1 Backend: extend `apps/api/src/resume/resume.service.ts` `update()` so that when the incoming section payload includes `__field_updated_at`, it does per-field LWW vs the stored row's `__field_updated_at` (also kept in `content`). For every field the server accepts (whether the client value wins OR the server value wins after the round), it stamps `content.__field_updated_at[field] = serverNow()` before persisting — this makes the server the convergent clock authority and immunizes the protocol against client clock skew. Build a `conflicts[]` array of fields where the stored timestamp was newer (i.e., client lost).
- [ ] 5.2 Backend: response shape from `PATCH /resumes/:id` becomes `{ resume, sections, conflicts? }`. Update the controller's return type and `apps/api/src/resume/resume.controller.ts`.
- [ ] 5.3 Validators: extend `sectionInputSchema.content` to allow an optional `__field_updated_at: Record<string, number>` (each value a positive integer ≤ `Date.now() + 60_000` for clock-skew leniency). Export `PatchResumeResponse` type.
- [ ] 5.4 Frontend: in `apps/web/hooks/useDebouncedSync.ts`, include the latest `__field_updated_at` per section in the PATCH payload. On 200 response: `markSyncedAll(response.sections)`; if `conflicts?.length`, hand off to `ConflictToast`.
- [ ] 5.5 Frontend: on `online` transition, `useDebouncedSync` flushes any row with `dirtySince != null` immediately (no 2 s debounce). On `offline`, abort the in-flight controller.
- [ ] 5.6 Vitest test for the LWW reducer in service: client newer → client wins; server newer → server wins, conflict reported; equal timestamps → server wins.
- [ ] 5.7 Vitest+MSW integration test on the frontend: edit `summary` locally, mock the server response with a `conflicts[]` entry for `summary`, expect the toast to render with section label + field name.

### 6. Conflict toast UI

- [ ] 6.1 Create `apps/web/components/editor/ConflictToast.tsx` — exports `showConflictToast(conflict)` that calls `sonner`'s `toast.message()` with action button "Pulihkan versi saya" (text in `id` locale), dismiss after 10 s, no max — separate toast per conflict.
- [ ] 6.2 The action handler:
  - reads the current store value and `__field_updated_at[field]` for `(sectionId, field)`
  - **race guard**: if the user has already typed a newer value (current store `fieldUpdatedAt > conflict.clientFieldUpdatedAt`), do nothing — they have already moved past the conflict and a re-stamp would clobber their newer keystrokes
  - if the user's stored value still equals `conflict.clientValue`, calls `updateSectionField(sectionId, field, conflict.clientValue)` which stamps a new `__field_updated_at` and triggers the standard 2 s sync
  - otherwise dismiss silently — the user's value differs from both the conflict's client value and the server value, meaning they kept editing past the conflict point and a re-stamp would surprise them
- [ ] 6.3 Vitest test: clicking "Pulihkan versi saya" re-stamps and triggers a PATCH. Multiple conflicts → multiple toasts.

### 7. Sync status wiring

- [ ] 7.1 Update `apps/web/hooks/useSyncStatus.ts` to read `dirtySince` from `useEditorStore` (the new derived selector) instead of `dirty`. The existing `synced | pending | offline` mapping stays.
- [ ] 7.2 Verify StatusBar (Story 2.3) renders the right dot for: clean, mid-debounce edit, in-flight PATCH, offline-with-pending. No new UI; visual regression check only.

### 8. GC and lifecycle

- [ ] 8.1 In `apps/web/app/providers.tsx`, kick off `gcOldRows()` once on app boot via `useEffect(() => { resumeRepo.gcOldRows().catch(() => {}) }, [])` in a small client provider.
- [ ] 8.2 **Logout cleanup.** Wire `resumeRepo.clearAll()` into the logout flow in `apps/web/lib/api-client.ts` (the `setAccessToken(null)` path that already exists for token clearing). Leaving CV data in IDB after logout is a privacy regression on shared devices; this is a real subtask, not deferred. Best-effort `.catch(noop)` is fine — IDB clear is fire-and-forget on the way out.
- [ ] 8.3 Vitest test for the lifecycle: seed two resumes in IDB, call `clearAll()`, confirm both are gone; seed one dirty + one clean row 100 days old, call `gcOldRows()`, confirm only the clean old row is deleted.

### 9. Verification

- [ ] 9.1 `pnpm --filter '@lolos/web' typecheck` passes clean.
- [ ] 9.2 `pnpm --filter '@lolos/web' build` passes; **measure** the actual bundle delta for `/resume/[id]` (Dexie + helpers) and record both the size and the source map breakdown in Dev Agent Record. Flag in review if the delta exceeds 50 KB gzipped.
- [ ] 9.3 `pnpm --filter '@lolos/api' typecheck` and `build` clean.
- [ ] 9.4 Manual smoke (documented in Dev Agent Record):
  - edit a field → IDB row written within 800 ms (verify in DevTools → Application → IndexedDB)
  - online: PATCH fires within 2 s → `lastSyncedAt` updates → dot goes green
  - go offline (DevTools throttling) → edit → dot goes red, IDB still updates
  - go back online → PATCH flushes immediately → dot goes green
  - close tab mid-edit → reopen → IDB-restored content paints first, then server merges
  - simulate conflict via mocked server response → toast shows, "Pulihkan versi saya" works
- [ ] 9.5 Vitest + Playwright runs from Story 1.9 framework all green; new tests added in subtasks above all pass.

---

## Dev Agent Record

### Implementation Plan

(to be filled by dev)

### Debug Log

(to be filled by dev)

### Completion Notes

(to be filled by dev)

---

## File List

(to be filled by dev)

---

## Change Log

- 2026-05-27: Story created from epic 2.4 spec on branch `spec/story-2-4-auto-save-and-offline-persistence`. Builds directly on Stories 2.2 (editor store + debounced sync) and 2.3 (StatusBar UI + useSyncStatus hook). Architecture Decision 6 (Dexie 800 ms / API 2 s, field-level LWW, no CRDT) honored as-is.
- 2026-05-27: Spec self-review pass — clarified server-as-clock-authority for `__field_updated_at`, switched restore-on-load to async paint-server-then-patch (IDB is async; the previous "synchronous" claim was wrong), added the missing `fake-indexeddb` test dep + `vitest.setup.ts` wiring task, promoted logout IDB cleanup from deferred TODO to a real Task 8.2 subtask (privacy concern, not polish), added a conflict-toast race guard in Task 6.2, expanded multi-tab note + storage-quota note in Out of Scope, raised GC retention from 30 → 90 days to match returning-user cadence, replaced fabricated "≈35 KB gz" bundle estimate with a measurement subtask (50 KB gz hard cap), called out the architecture-doc 150ms vs AC 800ms reconciliation, and added the `__field_updated_at` flat-keys-only convention.

---

## Status

**Current Status:** ready-for-dev
**Last Updated:** 2026-05-27
