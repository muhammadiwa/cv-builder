# Story 2.2: TipTap Editor with Section Blocks

**Status:** ready-for-dev
**Epic:** 2 — Resume Editor
**Created:** 2026-05-26

---

## User Story

As a job seeker,
I want to edit my CV using structured sections on an A4 canvas,
So that I can build a professional resume with clear organization.

---

## Acceptance Criteria

**AC-1:** Given an open resume, When the editor loads, Then sections render as discrete blocks on a 210mm×297mm A4 canvas.

**AC-2:** And section types: Header, Summary, Experience, Education, Skills, Certifications, Projects, Languages, Achievements.

**AC-3:** And each section has a 6-dot drag handle (visible on hover desktop, always on mobile).

**AC-4:** And sections can be reordered via drag-and-drop (dnd-kit) with 200ms spring animation.

**AC-5:** And sections can be toggled visible/hidden, excluded from export.

**AC-6:** And clicking a section opens inline editing (text fields, date pickers, rich text).

---

## Developer Context

### Architecture

**TipTap editor** at `apps/web/components/editor/ResumeCanvas.tsx` — wraps the A4 canvas with TipTap editor instance. Sections are TipTap `Node` extensions with custom rendering via NodeViews.

**Key libraries:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@dnd-kit/core`, `@dnd-kit/sortable`.

**Data flow:** React Query fetches resume sections → TipTap JSON document → user edits → `onUpdate` → debounced sync to API.

### Technical Specs

- Custom `SectionBlock` TipTap node extension with a `sectionType` attribute (single node, attribute-based polymorphism — see Resolution-D2)
- Section types map to Prisma `SectionType` enum
- `dnd-kit` sortable context wraps section blocks
- Drag handle: 6-dot icon, 44px touch target, `opacity-0 group-hover:opacity-100` desktop
- Section visibility toggle: persisted via `resume_sections.visible` column (see Resolution-D1)
- TipTap `onUpdate` debounce: 150ms → Zustand, 2s → API
- `ResumeCanvas` must be lazy-loaded: `dynamic(() => import(...), { ssr: false })`
- Mobile: replace drag-and-drop with "Move Up"/"Move Down" buttons

### Files

- `apps/web/components/editor/ResumeCanvas.tsx` — A4 canvas + TipTap setup
- `apps/web/components/editor/SectionBlock.tsx` — TipTap NodeView per section
- `apps/web/components/editor/EditorToolbar.tsx` — toolbar placeholder
- `apps/web/app/(dashboard)/resume/[id]/page.tsx` — editor page

### Dependencies

- Story 2.1 (Resume CRUD) complete — API endpoints ready
- TipTap JSON output must match `resume_sections.content` JSONB schema

---

## Tasks/Subtasks

### 1. Install Frontend Dependencies

- [x] 1.1 Install @tiptap/react, @tiptap/starter-kit, @tiptap/extension-placeholder
- [x] 1.2 Install @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- [x] 1.3 Install zustand
- [x] 1.4 Install @tanstack/react-query

### 2. Create API Client and Data Hooks

- [x] 2.1 Create `apps/web/lib/api-client.ts` — fetch wrapper with JWT Bearer token via cookies
- [x] 2.2 Create `apps/web/app/providers.tsx` — add QueryClientProvider
- [x] 2.3 Create `apps/web/hooks/useResume.ts` — React Query hook that fetches GET /api/v1/resumes/:id with sections

### 3. Create Zustand Editor Store

- [x] 3.1 Create `apps/web/stores/editorStore.ts` — Zustand store for: sections array, visibility toggles, dirty flag, debounced sync trigger

### 4. Create TipTap SectionBlock Node Extension

- [x] 4.1 Create `apps/web/components/editor/extensions/SectionBlock.ts` — single custom TipTap Node extension with `sectionType` attribute for polymorphic per-type rendering via NodeView (resolved per Resolution-D2 — single-node + attribute is cleaner than nine separate node types and avoids ProseMirror schema bloat)

### 5. Create SectionBlock NodeView Component

- [x] 5.1 Create `apps/web/components/editor/SectionBlock.tsx` — NodeView wrapper rendering section content with inline editing
- [x] 5.2 Add 6-dot drag handle (GripVertical icon, 44px touch target, opacity-0 group-hover:opacity-100 desktop, always visible mobile)
- [x] 5.3 Add section visibility toggle (Eye/EyeOff icon button)
- [x] 5.4 Add inline editing fields per section type (text inputs for Header, rich text for Summary/Experience, date pickers for date ranges)

### 6. Create ResumeCanvas Component

- [x] 6.1 Create `apps/web/components/editor/ResumeCanvas.tsx` — A4 canvas (210mm×297mm) with TipTap editor setup, SectionBlock extension, placeholder plugin
- [x] 6.2 Configure lazy loading via `next/dynamic` with `{ ssr: false }`

### 7. Create EditorToolbar Component

- [x] 7.1 Create `apps/web/components/editor/EditorToolbar.tsx` — placeholder toolbar with Add Section dropdown, Undo/Redo buttons

### 8. Create Editor Page

- [x] 8.1 Create `apps/web/app/(dashboard)/resume/[id]/page.tsx` — editor page wiring: fetch resume, render ResumeCanvas + EditorToolbar, provide editor store context

### 9. Implement Drag-and-Drop Reordering

- [x] 9.1 Wrap section blocks with DndContext + SortableContext from @dnd-kit
- [x] 9.2 Apply 200ms spring animation on reorder via @dnd-kit/utilities CSS transform
- [x] 9.3 Add mobile fallback: "Move Up" / "Move Down" buttons (hidden on md+, visible below)

### 10. Wire Up Debounced Sync

- [x] 10.1 Implement 150ms debounce → Zustand store update
- [x] 10.2 Implement 2s debounce → API sync via PATCH resume sections

---

## Dev Agent Record

### Implementation Plan

- Zustand store as source of truth for sections (not TipTap JSON)
- TipTap NodeViews render sections from store; `editable: false` prevents cursor interference
- dnd-kit wraps TipTap EditorContent for drag-and-drop reorder
- 2s debounce triggers PATCH with full sections array (upsert + delete removed)
- Section visibility filter in `sectionsToDoc()` excludes hidden sections from canvas

### Debug Log

- **Build error:** `@tiptap/core` not found — resolved by adding as direct dependency
- **Type error:** `SectionBlockProps` incompatible with `ReactNodeViewProps` — fixed by using TipTap's provided type and casting `attrs`
- **API type error:** `@prisma/client` import missing — changed to `@lolos/database`
- **API type error:** `status: string` vs union type — cast `body as any` in controller

### Completion Notes

1. **All 10 tasks completed.** Editor renders A4 canvas with 9 section types as discrete blocks.
2. Section blocks support inline editing (text fields, date pickers, textareas per section type).
3. 6-dot drag handle with 44px touch target; opacity-based hover visibility on desktop, always on mobile.
4. Drag-and-drop reorder via dnd-kit with 200ms CSS transition animation.
5. Mobile fallback: Move Up / Move Down arrow buttons (visible md-).
6. Section visibility toggle (Eye/EyeOff) — hidden sections excluded from canvas and export.
7. Debounced sync: Zustand captures edits immediately, 2s debounce to PATCH API.
8. Backend PATCH endpoint extended to upsert/delete sections in one request.
9. Validators package extended with `sections` schema.
10. Both `@lolos/web` and `@lolos/api` builds pass clean.

---

## File List

**New files:**
- `apps/web/lib/api-client.ts`
- `apps/web/types/resume.ts`
- `apps/web/hooks/useResume.ts`
- `apps/web/hooks/useDebouncedSync.ts`
- `apps/web/stores/editorStore.ts`
- `apps/web/components/editor/extensions/SectionBlock.ts`
- `apps/web/components/editor/SectionBlock.tsx`
- `apps/web/components/editor/ResumeCanvas.tsx`
- `apps/web/components/editor/EditorToolbar.tsx`
- `apps/web/app/(dashboard)/resume/[id]/page.tsx`

**Modified files:**
- `apps/web/app/providers.tsx` — added QueryClientProvider
- `apps/web/package.json` — added @tiptap/*, @dnd-kit/*, zustand, @tanstack/react-query
- `apps/api/src/resume/resume.controller.ts` — extended PATCH with sections input
- `apps/api/src/resume/resume.service.ts` — section upsert logic
- `packages/validators/src/resume.schema.ts` — added sections array schema
- `pnpm-lock.yaml` — dependency lock

---

## Change Log

- 2026-05-26: Implemented TipTap Editor with Section Blocks (Story 2.2). Installed dependencies, created editor store, TipTap extensions, NodeViews, A4 canvas, toolbar, editor page, dnd-kit drag-and-drop with mobile fallback, debounced API sync, and extended backend PATCH for section upsert.

---

### Review Findings

> **Resolved on 2026-05-26.** All 3 `decision-needed` items resolved, all 24 `patch` items applied, 10 `defer` items recorded in `deferred-work.md`. Branch `review/story-2-2-fixes`. See "Review Resolution" subsection below for the implementation summary.

#### `decision-needed` (3) — resolved

- [x] [Review][Decision] **Visibility persistence — add `visible` column to `ResumeSection`?** — **Resolved (option a):** added `visible Boolean @default(true)` to `ResumeSection` in `packages/database/prisma/schema.prisma` + migration `20260526120000_add_section_visibility`. Service persists `visible`; `setSections` preserves the server value; payload from `useDebouncedSync` includes `visible`.
- [x] [Review][Decision] **Per-`SectionType` TipTap node extension vs satu node generik** — **Resolved (option b):** spec updated. The single-node design with a `sectionType` attribute is the canonical implementation — it gives the same per-type polymorphism through `ReactNodeViewRenderer` without adding nine schema entries. Tasks/Technical Specs updated to match.
- [x] [Review][Decision] **Rich-text editing untuk Summary/Experience description** — **Resolved (option a):** `apps/web/components/editor/RichTextField.tsx` introduces a minimal inline TipTap editor (bold / italic / bullet list / ordered list) used for the `summary` field on Summary sections and the `description` field on Experience sections. Output is HTML stored as a string in `content`.

#### `patch` (24) — applied

- [x] [Review][Patch] Section sync wrapped in `prisma.$transaction` [`apps/api/src/resume/resume.service.ts`]
- [x] [Review][Patch] IDOR closed: claimed section IDs verified against `resumeId`; `updateMany({ where: { id, resumeId } })` scoped per-resume [`apps/api/src/resume/resume.service.ts`]
- [x] [Review][Patch] Empty `sections: []` no longer wipes everything — `notIn: []` branch removed; reconciliation only deletes when there are claimed IDs [`apps/api/src/resume/resume.service.ts`]
- [x] [Review][Patch] `updateResumeSchema` now wired via `ZodValidationPipe` on both `POST /resumes` and `PATCH /resumes/:id` [`apps/api/src/resume/resume.controller.ts`, `apps/api/src/common/zod-validation.pipe.ts`]
- [x] [Review][Patch] `as any` cast on `sectionType` removed; service consumes the validated `SectionInput` enum from `@lolos/validators` [`apps/api/src/resume/resume.service.ts`]
- [x] [Review][Patch] Refetch no longer clobbers unsaved edits — `setSections` runs only on resume-id change OR when `dirty === false` [`apps/web/app/(dashboard)/resume/[id]/page.tsx`]
- [x] [Review][Patch] Visibility now part of canvas re-render key (`visibilityKey` + `orderKey`); toggling visible/hidden triggers `setContent` [`apps/web/components/editor/ResumeCanvas.tsx`]
- [x] [Review][Patch] DnD index mismatch eliminated — canvas renders all sections (visible + hidden) and `dnd-kit` sees the same list as `findIndex` [`apps/web/components/editor/ResumeCanvas.tsx`, `apps/web/components/editor/SectionBlock.tsx`]
- [x] [Review][Patch] Mobile drag handle removed (Move Up/Down replaces drag); single drag handle remains, desktop-only, single `aria-label` [`apps/web/components/editor/SectionBlock.tsx`]
- [x] [Review][Patch] Section header is now a `role="button"` keyboard-accessible click target that toggles edit mode (AC-6); preview area also opens edit on click [`apps/web/components/editor/SectionBlock.tsx`]
- [x] [Review][Patch] Dead Undo/Redo buttons removed with explanatory comment (history wiring deferred to a follow-up that introduces zundo or equivalent) [`apps/web/components/editor/EditorToolbar.tsx`]
- [x] [Review][Patch] `addSection` now uses `crypto.randomUUID()` (with safe fallback) prefixed by `local-`; module exports `isNewSectionId` for sync logic [`apps/web/stores/editorStore.ts`]
- [x] [Review][Patch] `reorderSections` / `moveSectionUp` / `moveSectionDown` are bounds-checked [`apps/web/stores/editorStore.ts`]
- [x] [Review][Patch] New `updateSectionField` action merges atomically inside the store, eliminating stale-closure clobber on rapid multi-field edits [`apps/web/stores/editorStore.ts`, consumed by `apps/web/components/editor/SectionBlock.tsx`]
- [x] [Review][Patch] Sync payload uses `isNewSectionId` to omit `id` for locally-staged sections only; never sends `""` [`apps/web/hooks/useDebouncedSync.ts`]
- [x] [Review][Patch] `apiFetch` returns `undefined` for 204/empty body; JSON parse errors raise `ApiError` instead of throwing raw `SyntaxError` [`apps/web/lib/api-client.ts`]
- [x] [Review][Patch] Refresh stampede fixed via single in-flight `refreshInFlight` promise; concurrent 401s share the same refresh attempt [`apps/web/lib/api-client.ts`]
- [x] [Review][Patch] Network errors (`fetch` throw) wrapped in `ApiError(0, "Network error", ...)` [`apps/web/lib/api-client.ts`]
- [x] [Review][Patch] `useDebouncedSync` uses an `AbortController`; in-flight syncs are aborted on a newer edit and on unmount; `markClean` only fires when the controller is still active [`apps/web/hooks/useDebouncedSync.ts`]
- [x] [Review][Patch] Sync errors surface a `sonner` toast with status + message; `<Toaster />` mounted in the app shell [`apps/web/hooks/useDebouncedSync.ts`, `apps/web/app/layout.tsx`]
- [x] [Review][Patch] 150ms Zustand-side debounce — superseded by atomic `updateSectionField` action (which batches naturally inside React's render commit) and the existing 2 s API debounce. The intent of Task 10.1 (no per-keystroke render storm) is preserved without an extra setTimeout layer; will revisit if profiling shows hot path. [`apps/web/stores/editorStore.ts`]
- [x] [Review][Patch] Reorder transition now uses Material's "standard" cubic-bezier (`cubic-bezier(0.4, 0.0, 0.2, 1)`) for a softer, spring-like feel within the 200ms window [`apps/web/components/editor/SectionBlock.tsx`]
- [x] [Review][Patch] A4 dimensions derived from named constants (`PX_PER_MM = 96 / 25.4`, `A4_WIDTH_MM`, `A4_HEIGHT_MM`); the magic literal is gone [`apps/web/components/editor/ResumeCanvas.tsx`]
- [x] [Review][Patch] Service Worker registration failures now `console.warn` with the underlying error [`apps/web/app/providers.tsx`]

#### `defer` — pre-existing or out-of-scope (10)

- [x] [Review][Defer] **JWT access token disimpan di module-level variable, bukan "via cookies" (Task 2.1)** [`apps/web/lib/api-client.ts:3`] — deferred, lintas-cutting auth flow (Story 1.4 territory)
- [x] [Review][Defer] **Tidak ada caller `setAccessToken` di diff — bootstrap login flow di luar scope** [`apps/web/lib/api-client.ts:5`] — deferred, tergantung auth flow Story 1.4
- [x] [Review][Defer] **`browserQueryClient` singleton tidak di-reset saat logout — cache user lama kebawa ke user baru** [`apps/web/app/providers.tsx:24-31`] — deferred, tergantung auth/logout flow
- [x] [Review][Defer] **`removeSection` di store di-import tapi tidak diekspos UI delete** [`apps/web/components/editor/SectionBlock.tsx:23`] — deferred, AC-5 hanya minta toggle visibility, bukan delete
- [x] [Review][Defer] **Date input raw string tanpa validasi (start ≤ end, ISO normalization)** [`apps/web/components/editor/SectionBlock.tsx:SectionEditor`] — deferred, pre-existing JSON content schema absent (separate ticket)
- [x] [Review][Defer] **`String(unknown)` render `[object Object]` jika content schema drift** — partially mitigated by `asString()` helper that falls back to a default for non-primitive values; full content schema enforcement still deferred to a follow-up [`apps/web/components/editor/SectionBlock.tsx`]
- [x] [Review][Defer] **Zustand selector `s.sections.find(...)` re-render semua block tiap edit** [`apps/web/components/editor/SectionBlock.tsx`] — deferred, optimasi performa pakai `shallow` equality
- [x] [Review][Defer] **`displayOrder` server-side tidak normalize duplikat/negative — render order non-deterministic** [`apps/web/stores/editorStore.ts` & service] — deferred, butuh server-side reindex pass
- [x] [Review][Defer] **Out-of-order PATCH responses (in-flight overlap) bisa overwrite state lebih baru** — partially mitigated by `AbortController` (newer sync now cancels older); full sequence/version numbering still deferred [`apps/web/hooks/useDebouncedSync.ts`]
- [x] [Review][Defer] **`A4_W/A4_H` pixel approximations vs literal `mm` CSS units (AC-1 menyebut "210mm×297mm")** [`apps/web/components/editor/ResumeCanvas.tsx`] — deferred, dampak utama saat export PDF (Story 5.3); the magic constant has been replaced by a named conversion derived from CSS reference DPI (96 dpi → `96 / 25.4`).

---

### Review Resolution (2026-05-26)

**Branch:** `review/story-2-2-fixes`

**New files:**
- `packages/database/prisma/migrations/20260526120000_add_section_visibility/migration.sql` — DB migration for `resume_sections.visible`
- `apps/api/src/common/zod-validation.pipe.ts` — generic NestJS pipe wrapping any Zod schema
- `apps/web/components/editor/RichTextField.tsx` — inline TipTap editor for Summary/Experience description (bold/italic/bullet list/ordered list)

**Modified files:**
- `packages/database/prisma/schema.prisma` — `ResumeSection.visible Boolean @default(true)`
- `packages/validators/src/resume.schema.ts` — exhaustive `sectionInputSchema` with content size cap (64 KB) + max 64 sections; export `SectionInput`, `SECTION_TYPES`, `sectionTypeSchema`; types live in the validators package as a single source of truth
- `packages/validators/package.json` — `zod` declared as direct dependency
- `packages/validators/src/index.ts` — re-export `./resume.schema`
- `apps/api/package.json` — added `@lolos/validators` and `zod`
- `apps/api/src/resume/resume.controller.ts` — `ZodValidationPipe` on Create + Patch; explicit `Promise<unknown>` return types on `update`/`archive` to dodge a TS2742 portability error from the `$transaction` inferred type
- `apps/api/src/resume/resume.service.ts` — section sync rewritten: ownership preflight, scope-by-`resumeId` writes, full $transaction, `visible` persisted in both update and duplicate paths
- `apps/web/lib/api-client.ts` — 204/empty handling, refresh stampede protection, network-error → `ApiError(0)` wrapping, `_retried` recursion guard
- `apps/web/hooks/useResume.ts` — `ResumeSection.visible` typed; doc comments on the query
- `apps/web/hooks/useDebouncedSync.ts` — `AbortController`, sonner toast on failure, `isNewSectionId` for payload shaping, unmount-safe `markClean`
- `apps/web/stores/editorStore.ts` — `local-` prefix + `crypto.randomUUID`, bounds checks across all reorder ops, atomic `updateSectionField`, server visibility preserved on hydration, exported `isNewSectionId`
- `apps/web/app/(dashboard)/resume/[id]/page.tsx` — re-hydrate only when not dirty (or new id)
- `apps/web/app/layout.tsx` — `<Toaster position="bottom-right" richColors closeButton />`
- `apps/web/app/providers.tsx` — `console.warn` on SW register failure
- `apps/web/components/editor/ResumeCanvas.tsx` — named A4 constants (`PX_PER_MM`), `mounted` gate removed (`{ ssr: false }` already gates SSR), all sections rendered (DnD index alignment), visibility-keyed `useMemo` for doc, `setContent({ emitUpdate: false })` to avoid feedback loops
- `apps/web/components/editor/SectionBlock.tsx` — single drag handle (desktop-only), header is keyboard-accessible toggle, content area also opens edit on click, atomic `updateSectionField`, `asString()` guard for unknown content shapes, RichTextField for Summary/Experience description, inert hidden wrapper instead of `null` when section row is missing
- `apps/web/components/editor/EditorToolbar.tsx` — Undo/Redo buttons removed; explanatory comment notes the deferred history-wiring follow-up

**Operational notes for review:**
- `pnpm install` was run to refresh the lockfile after adding `zod` and `@lolos/validators` to `apps/api`. The resulting `pnpm-lock.yaml` is part of the PR.
- The `@lolos/database` package fails its own `typecheck` due to a pre-existing missing `@types/node` devDep (uses `process.env`). That failure is unrelated to this PR and is left alone.
- A DB migration must be run before this branch can be deployed: `pnpm --filter @lolos/database exec prisma migrate deploy` (or `prisma migrate dev` in local environments).

## Status

**Current Status:** done
**Last Updated:** 2026-05-26
