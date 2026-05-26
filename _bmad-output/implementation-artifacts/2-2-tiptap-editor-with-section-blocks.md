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
