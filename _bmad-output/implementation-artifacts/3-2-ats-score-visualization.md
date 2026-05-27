---
baseline_commit: afe3c52
---

# Story 3.2: ATS Score Visualization

**Status:** ready-for-dev
**Epic:** 3 — ATS Scoring & Optimization
**Created:** 2026-05-27

---

## User Story

As a job seeker,
I want to see my ATS score visualized beautifully,
So that I feel motivated to improve rather than discouraged.

---

## Acceptance Criteria

**AC-1:** Given a computed ATS score, When the score dashboard renders, Then an SVG ring gauge (120px, 12px stroke) displays the score with gradient color: red(0-40)→amber(41-65)→blue(66-85)→emerald(86-100).

**AC-2:** And ring animates from 0 to score via spring physics over 1.5 seconds on first load, 300ms on updates.

**AC-3:** And 6 category breakdown cards show individual dimension scores with horizontal progress bars, staggered entrance (50ms).

**AC-4:** And score history sparkline shows last 5 scores with `pathLength` SVG animation.

**AC-5:** And score context text: "Rata-rata fresh grad di posisi ini: 62" (when JD provided).

**AC-6:** And score never shown without anchor context — never a raw number alone.

---

## Developer Context

### Architecture

This story replaces the `ATSPanelPlaceholder` in the right panel with a real ATS score visualization. All data comes from `editorStore.atsScore` (computed by the Web Worker in Story 3.1). No new backend API calls needed.

**Component placement:**
- `apps/web/components/ats/ScoreRing.tsx` — SVG ring gauge with spring animation (Framer Motion)
- `apps/web/components/ats/CategoryCard.tsx` — single dimension card with progress bar
- `apps/web/components/ats/CategoryBreakdown.tsx` — staggered list of 6 CategoryCards
- `apps/web/components/ats/ScoreHistorySparkline.tsx` — SVG sparkline with pathLength animation
- `apps/web/components/ats/ScoreContextText.tsx` — anchor context text (never raw number alone)
- `apps/web/components/ats/ATSPanel.tsx` — main panel component replacing the placeholder

**Data flow:**
1. `useATSScore` hook (Story 3.1, already mounted) computes score → stores in `editorStore.atsScore`
2. `ATSPanel` reads `editorStore.atsScore` and `editorStore.atsComputing`
3. Score history is stored in a local `useState` array within `ATSPanel` (max 5 entries, persisted to `sessionStorage` for the current editing session). No server persistence in this story.
4. On first render with a score, animate from 0 (1.5s spring). On subsequent score changes, animate from previous value (300ms transition).

**Key design decisions:**
- Score ring uses Framer Motion `useSpring` for the number counter and `motion.circle` for the stroke animation.
- Color gradient is a `linearGradient` SVG def — the ring stroke uses `url(#score-gradient)` with a `strokeDasharray` mask so only the filled portion shows the gradient.
- Category cards use `motion.div` with `staggerChildren: 0.05` (50ms per AC-3).
- Sparkline uses `motion.path` with `pathLength` animation (0→1 over 0.8s).
- Score context text is always shown alongside the score (AC-6). Default context: "Skor ATS CV Anda" when no JD is provided. JD-based context is out of scope (Story 3.3+).
- "Improve" buttons on category cards are visible on hover (desktop) and always visible (mobile). They are non-functional in this story — clicking shows a "Coming soon" toast. Functionality lands in Story 3.3.
- Clicking a category card scrolls the editor to the relevant section (uses `setActiveSectionId` from `editorLayoutStore`).

### Technical Specs

- **Framer Motion** — already installed (`framer-motion@^11`). Use `motion`, `useSpring`, `useMotionValue`, `useTransform`, `AnimatePresence`.
- **Score ring SVG:** 120px size, 12px stroke (right panel). Desktop dashboard hero uses 160px/10px (Story 3.5 scope — NOT this story). The ring in the right panel is the only one we build here.
- **Spring physics (first load):** `{ type: 'spring', stiffness: 60, damping: 12, mass: 1 }` — 1.5s settle time.
- **Spring physics (updates):** `{ type: 'spring', stiffness: 200, damping: 20 }` — ~300ms settle.
- **Color bands:**
  ```ts
  function getScoreColor(score: number): string {
    if (score >= 86) return 'hsl(var(--ats-emerald))';
    if (score >= 66) return 'hsl(var(--ats-blue))';
    if (score >= 41) return 'hsl(var(--ats-amber))';
    return 'hsl(var(--ats-red))';
  }
  ```
  CSS variables are already defined in `globals.css` as HSL values (Shadcn convention): `--ats-red: 0 84% 60%`, `--ats-amber: 38 92% 50%`, `--ats-blue: 217 91% 60%`, `--ats-emerald: 160 84% 39%`. Use as `hsl(var(--ats-*))` in components.
- **Score history:** Array of `{ total: number; computedAt: number }` stored in `sessionStorage` key `ats-score-history-{resumeId}`. Max 5 entries. New entry added only when score changes by ≥2 points (avoids noise from minor edits). On page load, hydrate from sessionStorage. Get `resumeId` via `useParams()` from `next/navigation` (the page route is `(dashboard)/resume/[id]/page.tsx`).
- **Accessibility:**
  - Score ring: `role="meter"` `aria-valuenow={score}` `aria-valuemin="0"` `aria-valuemax="100"` `aria-label="Skor ATS: {score} dari 100"`
  - Progress bars: `role="progressbar"` `aria-valuenow={score}` `aria-valuemin="0"` `aria-valuemax="100"` `aria-label="Skor {dimensionName}: {score} persen"`
  - Sparkline: `aria-hidden="true"` with a `sr-only` span providing text: "Riwayat skor: {scores.join(', ')}"
  - Reduced motion: respect `prefers-reduced-motion` — skip spring animations, snap to final values.
- **Dimension label mapping** (from `DimensionKey` to Indonesian display name):
  ```ts
  const DIMENSION_LABELS: Record<DimensionKey, string> = {
    keywordMatch: 'Kata Kunci',
    formatting: 'Format',
    completeness: 'Kelengkapan',
    readability: 'Keterbacaan',
    metricsImpact: 'Metrik & Angka',
    optimization: 'Optimasi',
  };
  ```
- **Dimension → section mapping** (for scroll-to-section on card click):
  ```ts
  const DIMENSION_SECTION_MAP: Partial<Record<DimensionKey, SectionType>> = {
    keywordMatch: 'skills',
    completeness: undefined, // no single section
    readability: 'summary',
    metricsImpact: 'experience',
    optimization: 'experience',
    formatting: undefined, // applies to all
  };
  ```
  When a dimension maps to a section type, find the first section with that type in `editorStore.sections` and call `setActiveSectionId(section.id)`.

### Files (planned)

**New:**
- `apps/web/components/ats/ScoreRing.tsx` — SVG ring gauge with Framer Motion spring animation
- `apps/web/components/ats/CategoryCard.tsx` — single dimension score card with progress bar + "Improve" button
- `apps/web/components/ats/CategoryBreakdown.tsx` — staggered list of 6 CategoryCards
- `apps/web/components/ats/ScoreHistorySparkline.tsx` — SVG sparkline (pathLength animation)
- `apps/web/components/ats/ScoreContextText.tsx` — anchor context text component
- `apps/web/components/ats/ATSPanel.tsx` — main panel assembling all sub-components
- `apps/web/components/ats/ats-colors.ts` — `getScoreColor()`, `getScoreLabel()` utility functions + dimension labels
- `apps/web/components/ats/__tests__/ScoreRing.test.tsx` — unit tests for ScoreRing rendering
- `apps/web/components/ats/__tests__/ATSPanel.test.tsx` — integration test for panel assembly

**Modified:**
- `apps/web/components/editor/RightPanel.tsx` — replace `ATSPanelPlaceholder` import with real `ATSPanel`
- `apps/web/components/editor/RightPanelPlaceholders.tsx` — remove `ATSPanelPlaceholder` export (or keep for fallback)
- `apps/web/components/editor/MobileTabBar.tsx` — replace `ATSPanelPlaceholder` in ATS bottom sheet with `ATSPanel`

### Dependencies

- **Story 3.1 (ATS Scoring Engine)** — done (in review). `editorStore.atsScore` is the data source.
- **Story 2.3 (Multi-Panel Layout)** — done. Right panel with ATS tab exists.
- **framer-motion** — already installed.
- **No new npm dependencies** — everything is built with existing packages.

### Out of Scope

- **Desktop 3-panel ATS dashboard** (center panel hero ring, full-page layout) — Story 3.5.
- **"Improve" button functionality** (AI suggestions) — Story 3.3.
- **JD-based context text** ("Rata-rata fresh grad di posisi ini: 62") — requires JD input, Story 3.3+.
- **Score persistence to server** — V1 uses sessionStorage only.
- **Quick Win card** — Story 3.3 (requires AI suggestion engine).
- **Score ring in CV Preview Reveal** (Kak handoff animation) — Story 4.5.

---

## Tasks/Subtasks

### 1. ATS color tokens and utilities

- [ ] 1.1 Verify ATS color CSS variables exist in `apps/web/app/globals.css`. They are already defined as HSL values (`--ats-red: 0 84% 60%`, etc.) per Shadcn convention. Use them as `hsl(var(--ats-red))` in components. No changes needed to globals.css.
- [ ] 1.2 Create `apps/web/components/ats/ats-colors.ts` — export `getScoreColor(score)`, `getScoreLabel(score)` (returns "Perlu ditingkatkan"/"Cukup"/"Baik"/"Sangat baik"), and `DIMENSION_LABELS` map.

### 2. ScoreRing component

- [ ] 2.1 Create `apps/web/components/ats/ScoreRing.tsx`:
  - Props: `value: number` (0-100), `size?: number` (default 120), `strokeWidth?: number` (default 12), `animated?: boolean` (default true), `isFirstRender?: boolean` (controls 1.5s vs 300ms spring).
  - SVG with `linearGradient` def for the color gradient.
  - Background circle (gray stroke).
  - Foreground `motion.circle` with `strokeDasharray`/`strokeDashoffset` animated via spring.
  - Center number counter using `useSpring` + `useTransform` (counts from 0 to value).
  - `/100` label below the number.
  - `role="meter"` with proper aria attributes.
  - Respect `prefers-reduced-motion` via Framer Motion's `useReducedMotion()`.

### 3. CategoryCard and CategoryBreakdown

- [ ] 3.1 Create `apps/web/components/ats/CategoryCard.tsx`:
  - Props: `name: string`, `dimensionKey: DimensionKey`, `score: number`, `details: string[]`, `staggerDelay: number`, `onImprove?: () => void`, `onCardClick?: () => void`.
  - Horizontal progress bar with `motion.div` width animation (0→score%, delay = staggerDelay).
  - Score color from `getScoreColor()`.
  - Label hint below bar: "Perlu ditingkatkan"/"Cukup"/"Baik"/"Sangat baik".
  - "Improve" button: `opacity-0 group-hover:opacity-100` on desktop, always visible on mobile. Shows "Coming soon" toast on click.
  - Card click → scroll to relevant section (via `onCardClick`).
  - `role="progressbar"` with aria attributes on the bar.
- [ ] 3.2 Create `apps/web/components/ats/CategoryBreakdown.tsx`:
  - Reads `editorStore.atsScore.dimensions`.
  - Maps 6 dimensions to CategoryCards with 50ms stagger (staggerChildren: 0.05).
  - Uses `motion.div` variants for staggered entrance.
  - Handles click → `setActiveSectionId` for dimensions that map to a section.

### 4. ScoreHistorySparkline

- [ ] 4.1 Create `apps/web/components/ats/ScoreHistorySparkline.tsx`:
  - Props: `history: Array<{ total: number; computedAt: number }>`.
  - SVG viewBox `0 0 200 60`.
  - Computes line path from data points (normalize Y: 0-100 → 60-0).
  - Area fill with gradient (primary color, 0.2→0 opacity).
  - `motion.path` with `pathLength` animation (0→1, 0.8s, ease).
  - Data point circles with staggered fade-in.
  - `aria-hidden="true"` on SVG + `sr-only` text span with score values.
  - Handles edge cases: 0 points (show nothing), 1 point (single dot), 2+ points (line).

### 5. ScoreContextText and ATSPanel assembly

- [ ] 5.1 Create `apps/web/components/ats/ScoreContextText.tsx`:
  - Props: `score: number`.
  - Always renders anchor context (AC-6). Default: "Skor ATS CV Anda" + score band label.
  - When score < 40: "Ini awal yang bagus. Semua orang mulai dari sini."
  - When score 41-65: "Cukup baik. Beberapa perbaikan bisa meningkatkan skor."
  - When score 66-85: "Bagus! CV Anda sudah cukup kompetitif."
  - When score 86-100: "Sangat baik! CV Anda siap melewati screening ATS."
- [ ] 5.2 Create `apps/web/components/ats/ATSPanel.tsx`:
  - Reads `editorStore.atsScore` and `editorStore.atsComputing`.
  - Manages score history state: `useState<Array<{total, computedAt}>>` hydrated from `sessionStorage`.
  - On score change (≥2 point difference from last entry), append to history (max 5).
  - Persist history to `sessionStorage` on change.
  - Layout: ScoreRing (centered) → ScoreContextText → CategoryBreakdown → ScoreHistorySparkline.
  - Loading state: skeleton pulse when `atsComputing === true` and no score yet.
  - Empty state: show encouraging message when `atsScore === null` (no sections yet).
  - Track `isFirstRender` via ref to control ring animation speed (1.5s first time, 300ms after).

### 6. Integration

- [ ] 6.1 Update `apps/web/components/editor/RightPanel.tsx`:
  - Replace `ATSPanelPlaceholder` with the real `ATSPanel` component in the `ats` tab content.
  - Keep the placeholder import for potential fallback or remove it.
- [ ] 6.2 Update `apps/web/components/editor/MobileTabBar.tsx`:
  - Replace `ATSPanelPlaceholder` in the ATS bottom sheet with `ATSPanel`.

### 7. Tests

- [ ] 7.1 Create `apps/web/components/ats/__tests__/ScoreRing.test.tsx`:
  - Renders with correct aria attributes (`role="meter"`, `aria-valuenow`).
  - Displays score number.
  - Applies correct color class based on score band.
- [ ] 7.2 Create `apps/web/components/ats/__tests__/ATSPanel.test.tsx`:
  - Renders loading skeleton when `atsComputing=true` and no score.
  - Renders empty state when `atsScore=null`.
  - Renders all 6 category cards when score is present.
  - Score history appends when score changes by ≥2 points.

### 8. Verification

- [ ] 8.1 `pnpm --filter '@lolos/web' typecheck` passes.
- [ ] 8.2 `pnpm --filter '@lolos/web' build` passes.
- [ ] 8.3 All existing tests + new tests pass.
- [ ] 8.4 Manual smoke: open editor → ATS tab in right panel shows ring + categories. Edit a section → score updates → ring animates. Multiple edits → sparkline shows history.

---

## Dev Notes

### Previous Story Learnings (from Story 3.1)

- **`editorStore.atsScore`** is the single source of truth for the computed score. Shape: `{ total: number, dimensions: Record<DimensionKey, DimensionScore>, computedAt: number }`.
- **`editorStore.atsComputing`** is `true` while the Web Worker is computing. Use this for loading states.
- **`DimensionScore`** has `{ score: number, weight: number, details: string[] }` — the `details` array contains human-readable explanations (e.g., "Missing sections: certifications, projects").
- **Score can be `null`** when no sections exist or on initial load before first computation.
- **StatusBar's `ATSMiniRing`** already reads from the store — don't duplicate that logic. The right panel `ScoreRing` is a separate, larger component with full animation.

### Architecture Compliance

- **Components in `components/ats/`** — per architecture doc's component organization (`components/ats/` for ScoreRing, CategoryCard, SuggestionCard).
- **Feature logic in `features/ats/`** — the `useATSScore` hook is already there. The panel is a pure presentation component reading from the store, so it lives in `components/`.
- **Framer Motion for animations** — per UX spec. Spring physics values from UX visual specs.
- **Accessibility** — `role="meter"`, `role="progressbar"`, `aria-live`, `prefers-reduced-motion` per UX spec §4.5.
- **No new backend endpoints** — pure client-side visualization of existing store data.

### Existing Code to Reuse

- **`useEditorStore`** — subscribe to `atsScore`, `atsComputing`, `sections`.
- **`useEditorLayoutStore`** — `setActiveSectionId` for scroll-to-section on card click.
- **`ATSScore` type** from `@/lib/ats-engine/types` — import for type safety.
- **`DimensionKey`** type from `@/lib/ats-engine/types` — use for dimension iteration.
- **Shadcn/ui `Skeleton`** — use for loading states (already installed).
- **Shadcn/ui `toast`/Sonner** — use for "Coming soon" toast on Improve button click.
- **`useReducedMotion()`** from `framer-motion` — respect motion preferences.

### Anti-Patterns to Avoid

- **Do NOT call `useATSScore()` in ATSPanel** — the hook is already mounted in the resume page. ATSPanel only reads from the store.
- **Do NOT create a new Zustand store for score history** — use local `useState` + `sessionStorage`. Server persistence is out of scope.
- **Do NOT hardcode score values** — always read from `editorStore.atsScore.dimensions`.
- **Do NOT use `requestAnimationFrame` for animations** — use Framer Motion's declarative API.
- **Do NOT import from `@/lib/ats-engine/scorer`** — the panel is a consumer of computed scores, not a scorer.

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

- 2026-05-27: Story created from epic 3.2 spec. Visualization of ATS score in right panel — SVG ring gauge, category breakdown cards, sparkline history. Pure client-side presentation consuming editorStore.atsScore from Story 3.1.

---

## Status

**Current Status:** ready-for-dev
**Last Updated:** 2026-05-27
