# Story 2.1: Resume CRUD & Data Model

**Status:** ready-for-dev
**Epic:** 2 — Resume Editor
**Created:** 2026-05-26

---

## User Story

As a job seeker,
I want to create, read, update, and delete my resumes,
So that I can manage multiple CVs for different job applications.

---

## Acceptance Criteria

**AC-1:** Given an authenticated user with no resumes, When they click "Buat CV Baru", Then a new blank resume is created with default template assigned.

**AC-2:** Given a user with existing resumes, When viewing the dashboard, Then all their resumes are listed as cards with title, template name, last-edited timestamp, and ATS score badge.

**AC-3:** And user can duplicate, rename, archive, and delete resumes.

**AC-4:** And resume data is stored as JSONB in `resume_sections` table.

**AC-5:** And user can have unlimited resumes on Pro/Premium, 1 on Free.

---

## Developer Context

### Backend (apps/api)

Create `apps/api/src/resume/resume.module.ts`, `resume.service.ts`, `resume.controller.ts` (or tRPC router).

**Endpoints (tRPC):**

| Router | Purpose |
|--------|---------|
| `resume.create` | Create new resume with default template |
| `resume.list` | List user's resumes (title, template, last-edited, ATS score) |
| `resume.get(id)` | Get resume with all sections |
| `resume.update(id, data)` | Update resume metadata (title, status) |
| `resume.duplicate(id)` | Deep-clone resume with all sections |
| `resume.archive(id)` | Archive (soft-delete via status=archived) |
| `resume.delete(id)` | Hard delete with confirmation |

**Business rules:**
- Free tier: max 1 active resume (draft or published)
- Pro/Premium: unlimited
- Default template: "Professional" (seed from Story 1.3)
- New resumes: status=draft, language=id

### Frontend (apps/web)

**Dashboard page:** `apps/web/app/(dashboard)/page.tsx`
- Resume cards grid, empty state: "Belum punya CV? Yuk bikin sekarang!"
- "Buat CV Baru" CTA (FAB on mobile)
- Card shows: title, template thumbnail, last-edited, ATS score badge
- Actions: Edit, Duplicate, Archive, Delete (confirm dialog)

**Shared schemas:** `packages/validators/src/resume.schema.ts`

### Dependencies

- DB: `resumes`, `resume_sections`, `templates` tables (Story 1.3)
- Auth: JWT guard (Story 1.4)
- UI: Shadcn/ui Card, Button, Badge, Dialog (Story 1.2)

### Dev Notes

- Epic 1 complete and reviewed
- React Query with optimistic updates for archive/delete
- Tier enforcement via `resume.count` check on create
