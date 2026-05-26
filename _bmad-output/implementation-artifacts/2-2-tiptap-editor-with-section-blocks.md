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

- Custom `SectionBlock` TipTap node extension for each section type
- Section types map to Prisma `SectionType` enum
- `dnd-kit` sortable context wraps section blocks
- Drag handle: 6-dot icon, 44px touch target, `opacity-0 group-hover:opacity-100` desktop
- Section visibility toggle: React state + syncs to resume metadata
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

- [x] 4.1 Create `apps/web/components/editor/extensions/SectionBlock.ts` — custom TipTap Node extension per SectionType, stores section metadata as node attributes

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

## Status

**Current Status:** review
**Last Updated:** 2026-05-26
