---
baseline_commit: 4c7cdece494a085888265fb19293dac56ed537fc
---

# Story 2.3: Multi-Panel Layout with Mobile Adaptation

**Status:** in-progress
**Epic:** 2 — Resume Editor
**Created:** 2026-05-26

---

## User Story

As a job seeker,
I want a responsive editor layout that works on both my phone and laptop,
So that I can edit my CV wherever I am.

---

## Acceptance Criteria

**AC-1:** Given a desktop viewport (≥1024px), When the editor loads, Then a 3-panel layout is shown: left nav (280px, collapsible to 64px icon-only), center A4 canvas, right panel (360px, collapsible, tabbed: **AI Chat | ATS | Template**).

**AC-2:** Given a mobile viewport (<768px), When the editor loads, Then a bottom tab bar is shown (**Bagian | AI | ATS | Pengaturan**) and the corresponding panel opens as a bottom sheet (70vh of viewport).

**AC-3:** And a bottom status bar shows: ATS score mini ring, word count, last saved timestamp, sync indicator.

**AC-4:** And the right panel remembers the last-open tab per session.

**AC-5:** And the left nav (desktop) highlights the active section with a subtle left-border animation.

---

## Developer Context

### Architecture

The editor route at `apps/web/app/(dashboard)/resume/[id]/page.tsx` currently mounts `<EditorToolbar />` + `<ResumeCanvas />` directly. This story replaces that flat layout with an **`EditorShell`** that orchestrates desktop and mobile layouts behind a single responsive boundary.

```
EditorShell (responsive root)
├── desktop ≥1024px         mobile <768px        tablet 768–1023px
│   ├── LeftNav             ├── ResumeCanvas     ├── ResumeCanvas
│   ├── ResumeCanvas        ├── MobileTabBar     ├── MobileTabBar
│   ├── RightPanel          └── BottomSheet      └── BottomSheet
│   └── StatusBar              (lazy)
```

- **Layout state** (`leftNavCollapsed`, `rightPanelTab`, `rightPanelCollapsed`) lives in `useEditorLayoutStore` (a small zustand slice, separate from the section editor store) and persists through `sessionStorage` so the user keeps their setup across reloads of the same tab.
- **`useBreakpoint()`** is the single source of truth for `desktop / tablet / mobile` to keep media-query logic out of components. It's SSR-safe (returns `desktop` on the server, then re-renders on hydration via `useEffect`).
- The right panel's contents (AI Chat / ATS / Template Picker) are **placeholders** in this story — full integrations land in Stories 2.5 (AI Inline Rewrite), 3.x (ATS), and 5.x (Template Gallery). Each placeholder renders an empty-state card with a CTA describing what the panel will do.
- The bottom-sheet on mobile uses Radix Dialog with a custom drawer-from-bottom animation. We could later swap to `vaul` if the UX needs improvement, but Radix is already a project dep so we avoid adding a new package for this story.

### Technical Specs

- Tailwind breakpoints used: `md` (768px) and `lg` (1024px). Default `desktop` ≥ `lg`, `tablet` from `md` to `<lg`, `mobile` <`md`.
- Three layout regions live in CSS grid on desktop (`grid-template-columns: var(--left-nav-w) 1fr var(--right-panel-w)`). Collapse animates the column tracks via CSS variables.
- StatusBar is a fixed-height row at the bottom on desktop; on mobile it sits above the bottom tab bar (so users can still see saved status while a panel is open).
- ATS mini ring and word count read from the editor store; sync indicator and last-saved timestamp read from a new `useSyncStatus()` hook that observes `dirty` + the last successful `markClean()` timestamp on the editor store.
- Active section highlighting in `LeftNav` uses `IntersectionObserver` over the rendered `[data-section-block]` elements (already present from Story 2.2). The observer reports the topmost visible section to the layout store; the nav animates a 2px left-border via a `transform: translateY` plus a CSS spring.
- Left nav and right panel collapse animations use Framer Motion `layoutId` for shared layout transitions.
- The right-panel tab persists to `sessionStorage` under `editor:rightPanelTab` (typed `'ai' | 'ats' | 'template'`).

### Files (planned)

**New:**
- `apps/web/hooks/useBreakpoint.ts` — SSR-safe `desktop | tablet | mobile`
- `apps/web/hooks/useSyncStatus.ts` — derives `synced | pending | offline` from the editor store
- `apps/web/stores/editorLayoutStore.ts` — zustand slice for layout chrome
- `apps/web/components/editor/EditorShell.tsx` — responsive root
- `apps/web/components/editor/LeftNav.tsx` — section navigation (desktop)
- `apps/web/components/editor/RightPanel.tsx` — desktop right panel (tabbed)
- `apps/web/components/editor/RightPanelPlaceholders.tsx` — three empty-state placeholders for AI/ATS/Template
- `apps/web/components/editor/StatusBar.tsx`
- `apps/web/components/editor/MobileTabBar.tsx`
- `apps/web/components/editor/BottomSheet.tsx`

**Modified:**
- `apps/web/app/(dashboard)/resume/[id]/page.tsx` — replace flat layout with `<EditorShell>`
- `apps/web/components/editor/ResumeCanvas.tsx` — accept a `paddingY` prop or expose a section-id reporter so `LeftNav` can scroll-spy without owning the canvas

### Dependencies

- Story 2.2 (TipTap Editor with Section Blocks) **done** — `[data-section-block]` elements exist for scroll-spy
- `framer-motion` is already in `apps/web/package.json`
- Radix Dialog (`@radix-ui/react-dialog`) is already in `apps/web/package.json` for the bottom sheet
- Lucide icons are already used elsewhere

### Out of scope (deferred to other stories)

- AI Chat panel UI and actual streaming — Story 2.5 / Epic 4
- Real ATS score calculation — Story 3.1
- Template picker functionality — Story 5.1
- Auto-save IndexedDB layer — Story 2.4 (this story renders the sync indicator UI but reads only the existing in-memory `dirty` flag)
- `⌘K` global command palette — Story 2.6

---

## Tasks/Subtasks

### 1. Foundations: hooks and layout store

- [x] 1.1 Create `apps/web/hooks/useBreakpoint.ts` returning `'desktop' | 'tablet' | 'mobile'`. SSR-safe (returns `'desktop'` on server, hydrates on client).
- [x] 1.2 Create `apps/web/stores/editorLayoutStore.ts` — zustand slice with `leftNavCollapsed`, `rightPanelCollapsed`, `rightPanelTab`, `activeSectionId`. Persist `rightPanelTab` to `sessionStorage` only.
- [x] 1.3 Create `apps/web/hooks/useSyncStatus.ts` — returns `'synced' | 'pending' | 'offline'` plus `lastSyncedAt` based on `useEditorStore.dirty`, `navigator.onLine`, and a timestamp set inside `markClean()`. (Add `lastSyncedAt: number | null` field to the editor store.)

### 2. Status bar

- [x] 2.1 Create `apps/web/components/editor/StatusBar.tsx` — renders ATS mini ring (placeholder value 0 with skeleton), word count derived from sections, last-saved timestamp (`Intl.RelativeTimeFormat`), and sync indicator dot (`bg-green-500` synced, `bg-yellow-500` pending, `bg-red-500` offline) with tooltip.

### 3. Desktop chrome

- [x] 3.1 Create `apps/web/components/editor/LeftNav.tsx` — vertical list of sections (icon + label), 6-dot reorder handle is *not* duplicated here (canvas owns drag), only click-to-scroll-into-view. Collapse toggle (`280px ↔ 64px`) animated via CSS variable on the shell.
- [x] 3.2 Create `apps/web/components/editor/RightPanelPlaceholders.tsx` — three empty-state cards (`AIPanelPlaceholder`, `ATSPanelPlaceholder`, `TemplatePanelPlaceholder`) explaining what's coming.
- [x] 3.3 Create `apps/web/components/editor/RightPanel.tsx` — Radix Tabs with Lucide icons. Tab state read from `editorLayoutStore.rightPanelTab`. Collapse toggle (`360px ↔ 0`). Keyboard: `Esc` collapses.
- [x] 3.4 Add an `IntersectionObserver` in `EditorShell` (desktop only) that watches `[data-section-block]` and writes the topmost visible `data-section-id` into the layout store. `LeftNav` reads that to drive the active-border animation (`framer-motion` `layoutId`).

### 4. Mobile chrome

- [x] 4.1 Create `apps/web/components/editor/BottomSheet.tsx` — Radix Dialog wrapper that animates from the bottom, locks viewport at 70vh, has a swipe-down close affordance, and traps focus. Provides a typed `BottomSheetTab` API for the parent.
- [x] 4.2 Create `apps/web/components/editor/MobileTabBar.tsx` — fixed-bottom 4-button bar (Bagian | AI | ATS | Pengaturan), 44px touch targets, active state, opens the corresponding `BottomSheet` content.

### 5. Shell composition

- [x] 5.1 Create `apps/web/components/editor/EditorShell.tsx`. Responsibilities:
  - read breakpoint via `useBreakpoint()`
  - render desktop CSS grid (`leftNav` | `canvas` | `rightPanel`) on `desktop`
  - render single column + bottom tab bar on `mobile`
  - render desktop layout sans `LeftNav` on `tablet` (right panel + canvas)
  - mount `StatusBar` always (above bottom tab bar on mobile)
  - mount `IntersectionObserver` for active-section tracking
- [x] 5.2 Update `apps/web/app/(dashboard)/resume/[id]/page.tsx` to render `<EditorShell>{`<EditorToolbar />` + `<ResumeCanvas />`}</EditorShell>`. The shell owns the chrome; the page owns the data fetch + sync.

### 6. Polish, verification, and tests

- [x] 6.1 `LeftNav` keyboard nav: `Up`/`Down` move focus, `Enter` scrolls section into view, `Tab` exits to canvas.
- [x] 6.2 Verify `pnpm --filter '@lolos/web' build` passes; verify the editor route still renders inside the shell.
- [x] 6.3 Manually verify three breakpoints: ≤375px (small phone), 768–1023px (tablet), ≥1280px (desktop).
- [x] 6.4 Verify reduced-motion: panel collapses become instant when `prefers-reduced-motion` is set.

---

## Dev Agent Record

### Implementation Plan

**Decisions of note:**

1. **Single observer in `EditorShell`, not per-block.** I considered having each `SectionBlock` self-register with the layout store via `useInView`. Rejected — that puts the scroll-spy hot path inside the section-edit render tree, which we deliberately split off. One container-level `IntersectionObserver` plus a `MutationObserver` to pick up newly-added blocks is cheaper and stays out of the editing path.

2. **`SectionBlock` exposes `data-section-id`.** A small one-line addition to the existing `<NodeViewWrapper>` in `apps/web/components/editor/SectionBlock.tsx`. Both `LeftNav` (click → scroll) and `MobileTabBar`'s "Bagian" sheet rely on querying for these. We did not push this id into a new prop on SectionBlock to avoid touching the TipTap NodeView contract; the data attribute is the public hook.

3. **Render every section in the canvas, not just visible ones.** This was already the post-Story-2.2-review state. For the LeftNav we keep the same — hidden sections are listed but rendered with `opacity-50` so users can still navigate to them and toggle visibility back on. Hiding from nav would create a discoverability cliff.

4. **Tablet (768–1023px) collapses LeftNav, keeps RightPanel.** The trigger map says "AI Chat is the daily-use surface, section nav is occasional"; tablets are narrow enough that two side panels would crush the canvas. The rationale is documented inline in `EditorShell`.

5. **Word count strips HTML before counting.** Now that Story 2.2's RichTextField stores HTML strings in `content`, naïvely splitting by whitespace would inflate the count by counting `<p>`, `<strong>`, etc. The `<[^>]*>` strip is conservative — it isn't a security boundary, just a count-input cleanup.

6. **Sync indicator language is Indonesian** ("Tersimpan / Menyimpan… / Offline") because `communication_language` is `id` and the editor surface is the user's daily working environment. The component itself is locale-agnostic — only the labels assume Indonesian.

7. **No new test framework introduced.** The repo currently has no `test` script in any package.json across `apps/*` and `packages/*`. Per the dev-story workflow's guidance to "infer test framework from project structure", I treated tests as out-of-scope for this story and used `pnpm --filter '@lolos/web' typecheck` + `build` as the validation gate. Adding a test framework is a sprint-wide decision that should land in its own ticket.

8. **Animations honor `prefers-reduced-motion`.** Both the LeftNav active-border indicator (Tailwind `motion-reduce:transition-none`) and the BottomSheet (Framer Motion override to `tween/120ms`) collapse to instant transitions. Acceptance covered by AC implicit-quality + Task 6.4.

### Debug Log

- **TS error fixed during build:** initial `editorLayoutStore` typed `RightPanelTab` import was unused at consumption site of `RightPanel.tsx` — fixed by importing `type RightPanelTab` only when needed.
- **No issues with Radix Dialog + Framer Motion `<motion.div>` `asChild` pattern.** Used `Dialog.Overlay asChild` and `Dialog.Content asChild` so motion's `forwardRef` wrappers receive the right ref.
- **Build size jump** for `/resume/[id]`: 7.64 kB → 27.5 kB (FirstLoad 111 → 169 kB). Acceptable: framer-motion is the largest contributor and was already bundled, just not previously imported on this route.

### Completion Notes

1. **All 13 subtasks complete** across 6 task groups. Editor route now renders inside `EditorShell` with desktop 3-panel, tablet 2-panel, and mobile + bottom-tabs layouts.
2. `pnpm --filter '@lolos/web' typecheck` and `build` pass clean. `/resume/[id]` route compiles into a 27.5 kB chunk.
3. The right panel placeholders explicitly point at the follow-up stories that will replace them (2.5/Epic-4 for AI, 3.1 for ATS, 5.1 for Template).
4. `lastSyncedAt: number | null` added to `useEditorStore`; `markClean()` and `setSections()` both stamp the timestamp so the StatusBar shows a sensible "Disimpan baru saja" right after page load and again after every successful PATCH.
5. The IntersectionObserver in `EditorShell` plus the existing `data-section-id` on `SectionBlock` give the LeftNav active-border animation and the MobileTabBar's sections list a single source of truth — `editorLayoutStore.activeSectionId` — without per-block subscriptions.
6. Tablet experience hides the LeftNav (since it's narrow and the canvas is the focal point), but the user can still reach the section list via keyboard nav or — once Story 2.6 lands — the command palette.

---

## File List

**New files:**
- `apps/web/hooks/useBreakpoint.ts`
- `apps/web/hooks/useSyncStatus.ts`
- `apps/web/stores/editorLayoutStore.ts`
- `apps/web/components/editor/EditorShell.tsx`
- `apps/web/components/editor/LeftNav.tsx`
- `apps/web/components/editor/RightPanel.tsx`
- `apps/web/components/editor/RightPanelPlaceholders.tsx`
- `apps/web/components/editor/StatusBar.tsx`
- `apps/web/components/editor/MobileTabBar.tsx`
- `apps/web/components/editor/BottomSheet.tsx`

**Modified files:**
- `apps/web/app/(dashboard)/resume/[id]/page.tsx` — replaced flat layout with `<EditorShell>` wrapper
- `apps/web/components/editor/SectionBlock.tsx` — added `data-section-id={sectionId}` on `NodeViewWrapper` so LeftNav scroll-spy and MobileTabBar can target sections
- `apps/web/stores/editorStore.ts` — added `lastSyncedAt` field; `markClean()` and `setSections()` stamp it
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status `ready-for-dev` → `in-progress` → `review`

---

## Change Log

- 2026-05-26: Story created from epic 2.3 spec by code-review follow-up. Branched on green Story 2.2 implementation; layout state intentionally kept in a separate slice to avoid polluting the section-edit hot path.
- 2026-05-26: Implemented all 13 subtasks. New responsive `EditorShell` orchestrates desktop 3-panel, tablet 2-panel, and mobile single-column + bottom tab layouts. Added scroll-spy via container-level `IntersectionObserver` keyed on `data-section-id`. Status bar tracks word count, last-saved timestamp (`Intl.RelativeTimeFormat`), and sync state. Right panel renders informative placeholders for AI / ATS / Template that point at their follow-up stories. `useEditorStore` extended with `lastSyncedAt` so the status bar can render a meaningful "Disimpan baru saja" without coupling to the network layer.

---

## Status

**Current Status:** review
**Last Updated:** 2026-05-26
