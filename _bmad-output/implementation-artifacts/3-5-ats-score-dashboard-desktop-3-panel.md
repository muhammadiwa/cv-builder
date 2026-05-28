---
baseline_commit: 2af7ace
---

# Story 3.5: ATS Score Dashboard (Desktop 3-Panel)

**Status:** ready-for-dev
**Epic:** 3 — ATS Scoring & Optimization
**Created:** 2026-05-28

---

## User Story

As a desktop user,
I want a comprehensive ATS dashboard in a dedicated panel,
So that I can deep-dive into every dimension of my CV's performance.

---

## Acceptance Criteria

**AC-1:** Given a desktop viewport (≥1024px), When ATS tab is selected in right panel, Then score ring, 6 category cards, and sparkline are displayed in a 360px panel.

**AC-2:** And hovering a category card reveals the "Improve" button (opacity-0 → opacity-100 transition).

**AC-3:** And clicking a category card scrolls the editor to that section.

**AC-4:** And score history sparkline animates `pathLength` from 0 to full on first render.

**AC-5:** And each progress bar uses `role="progressbar"` with `aria-valuenow`.

---

## Developer Context

### Architecture

**Important realization:** All 5 ACs are ALREADY implemented by Stories 3.2, 3.3, and 3.4:
- AC-1: ATSPanel renders in the 360px right panel with score ring, 6 cards, sparkline ✅ (Story 3.2)
- AC-2: CategoryCard has `opacity-0 group-hover:opacity-100` on Improve button ✅ (Story 3.2)
- AC-3: CategoryBreakdown calls `setActiveSectionId` on card click ✅ (Story 3.2)
- AC-4: ScoreHistorySparkline uses `pathLength` animation ✅ (Story 3.2)
- AC-5: CategoryCard progress bar has `role="progressbar"` + `aria-valuenow` ✅ (Story 3.2)

This story's remaining value is **polish and enhancement** of the existing implementation to match the UX visual spec for Screen 4 (Desktop ATS Dashboard):
1. **Larger score ring on desktop** — UX spec says 160px/10px stroke for the desktop hero ring (currently 120px/12px in the right panel). Add responsive sizing.
2. **Score hero section** — center the ring with context text and benchmark comparison in a hero layout.
3. **Enhanced category cards** — the center panel version from UX spec has a richer layout (score icon box, description text, wider progress bars) vs the compact right panel version.
4. **Scroll-to-section visual feedback** — when clicking a category card, the target section should briefly highlight in the editor canvas.

Since the core functionality is done, this story focuses on UX polish for the desktop experience.

### Technical Specs

- **Responsive ScoreRing size:** Add a `className` prop or use the existing `size` prop with a responsive value. On desktop (≥1024px), the right panel ring could be 140px instead of 120px for better visual impact.
- **Section highlight on scroll:** When `setActiveSectionId` is called, the target section block should get a brief highlight animation (e.g., `ring-2 ring-primary/50` for 1.5s then fade). This requires a small update to the SectionBlock component.
- **Category card detail text:** Show the first `details` item more prominently (currently `line-clamp-1` at 11px — could be slightly larger on desktop).

### Files (planned)

**Modified:**
- `apps/web/components/ats/ATSPanel.tsx` — responsive ring size (140px on desktop)
- `apps/web/components/ats/ScoreRing.tsx` — accept className for responsive sizing
- `apps/web/components/ats/CategoryCard.tsx` — slightly enhanced desktop layout
- `apps/web/components/editor/SectionBlock.tsx` — add highlight animation when `activeSectionId` matches (scroll-to feedback)

### Dependencies

- **Story 3.2** — done. All core components exist.
- **Story 3.3** — done. Improve button is functional.
- **Story 3.4** — done. Platform selector integrated.

### Out of Scope

- **Separate full-page ATS dashboard route** — the UX spec shows a 3-panel layout, but the current architecture uses the right panel tab. A dedicated `/resume/[id]/ats` route is a future enhancement.
- **Quick Win card** — requires AI suggestion ranking logic beyond what Story 3.3 provides. Future enhancement.

---

## Tasks/Subtasks

### 1. Responsive score ring sizing

- [ ] 1.1 Update `ATSPanel.tsx` — pass `size={140}` to ScoreRing on desktop (use a media query hook or Tailwind responsive class).

### 2. Section highlight on scroll

- [ ] 2.1 Update `apps/web/components/editor/SectionBlock.tsx` (or equivalent) — when `activeSectionId` matches this section's ID, apply a brief highlight ring animation (1.5s fade-out). Use `useEditorLayoutStore.activeSectionId` subscription.

### 3. Enhanced desktop category cards

- [ ] 3.1 Update `CategoryCard.tsx` — on desktop (md: breakpoint), show detail text at 12px instead of 11px, and increase padding slightly for breathing room.

### 4. Verification

- [ ] 4.1 `pnpm --filter '@lolos/web' typecheck` passes.
- [ ] 4.2 All existing tests pass (no regressions).
- [ ] 4.3 Manual smoke: desktop viewport → ATS tab → ring is 140px, cards have hover Improve, click card → section highlights briefly in editor.

---

## Dev Notes

### Previous Story Learnings

- **All core ACs are already satisfied** by Story 3.2. This story is UX polish.
- **`setActiveSectionId`** is already called on card click — just need the receiving end (SectionBlock) to react visually.
- **ScoreRing `size` prop** already exists and works — just need to pass a larger value on desktop.

### Architecture Compliance

- **No new components** — only modifications to existing ones.
- **No new dependencies** — uses existing Framer Motion and Tailwind.
- **Accessibility already complete** — `role="progressbar"`, `role="meter"`, `aria-valuenow` all in place from Story 3.2.

---

## Dev Agent Record

### Agent Model Used

(to be filled by dev)

### Debug Log References

(to be filled by dev)

### Completion Notes List

(to be filled by dev)

### File List

(to be filled by dev)

---

## Change Log

- 2026-05-28: Story created. Most ACs already satisfied by Story 3.2. This story adds desktop UX polish: responsive ring size, section highlight on scroll, enhanced card layout.

---

## Status

**Current Status:** ready-for-dev
**Last Updated:** 2026-05-28
