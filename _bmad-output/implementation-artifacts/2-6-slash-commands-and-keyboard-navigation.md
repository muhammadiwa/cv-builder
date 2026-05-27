---
baseline_commit: edab43d13dea4ec65b25f4d8be0c186a83ded080
---

# Story 2.6: Slash Commands & Keyboard Navigation

**Status:** ready-for-dev
**Epic:** 2 — Resume Editor
**Created:** 2026-05-27

---

## User Story

As a power user,
I want slash commands and keyboard shortcuts in the editor,
So that I can work faster without touching the mouse.

---

## Acceptance Criteria

**AC-1:** Given the editor is focused, When user types `/`, Then a command palette opens with options: `/pengalaman`, `/pendidikan`, `/skill`, `/sertifikasi`, `/proyek`, `/bahasa`.

**AC-2:** And `⌘K` opens a global command palette with: "Analisis ATS", "Ganti Template", "Export PDF", "Tanya Kak".

**AC-3:** And Tab navigates between sections; Shift+Tab navigates backward.

**AC-4:** And `⌘Z` undoes, `⌘⇧Z` redoes (full undo/redo stack via `zundo`).

**AC-5:** And `⌘S` is NOT a save shortcut (auto-save is always on) — shows "CV tersimpan otomatis" toast instead.

---

## Developer Context

### Architecture

This story introduces two command palette surfaces and a full undo/redo stack:

1. **Slash command palette** (`/` trigger) — section-type-specific. Opens inline in the editor when the user types `/`. Lists available section types to add. Selecting one calls `addSection(type)` from the editor store.
2. **Global command palette** (`⌘K` trigger) — app-wide actions. Opens as a centered modal overlay (like VS Code / Linear). Actions are stubs for now (ATS, Template, Export, Kak) — they show a "Coming soon" toast since those features land in later epics.
3. **Full undo/redo** via `zundo` (Zustand temporal middleware) — replaces the minimal single-action `undoStack` from Story 2.5. `⌘Z` undoes, `⌘⇧Z` redoes. AI actions are atomic (one undo step per apply).
4. **Tab/Shift+Tab section navigation** — moves focus between section blocks sequentially.
5. **`⌘S` intercept** — prevents browser save dialog, shows toast.

### Technical Specs

- **`cmdk` (already installed)** — the `cmdk` package is already in `apps/web/package.json`. It provides the `<Command>` component for both slash and global palettes.
- **`zundo@^2`** — new dependency. Zustand temporal middleware that wraps the store and provides `undo()` / `redo()` / `pastStates` / `futureStates`. ~3 KB gzipped.
- **Slash palette trigger:** Listen for `/` keydown inside the editor area. Open a `<Command>` popover positioned at the cursor/caret. Filter items as user types after `/`. On select, call `addSection(type)` and close.
- **Global palette trigger:** `⌘K` (or `Ctrl+K` on Windows). Opens a centered `<Command.Dialog>` with a search input. Items are static stubs for now.
- **Tab navigation:** Global keydown listener. When Tab is pressed and focus is inside a `[data-section-block]`, move focus to the next section's header button. Shift+Tab moves backward. Wraps at boundaries.
- **Undo/redo:** Wrap `useEditorStore` with `temporal` middleware from `zundo`. Remove the custom `undoStack` / `pushUndo` / `popUndo` from Story 2.5 — `zundo` handles it natively. The AI apply action becomes a single temporal state change (atomic undo).
- **`⌘S` intercept:** Global keydown listener. `e.preventDefault()` + sonner toast "CV tersimpan otomatis ✓".

### Files (planned)

**New:**
- `apps/web/components/editor/SlashCommandPalette.tsx` — inline command palette triggered by `/`
- `apps/web/components/editor/GlobalCommandPalette.tsx` — `⌘K` modal command palette
- `apps/web/hooks/useEditorKeyboard.ts` — centralized keyboard shortcut handler (⌘K, ⌘S, ⌘Z, ⌘⇧Z, Tab/Shift+Tab)

**Modified:**
- `apps/web/package.json` — add `zundo@^2`
- `apps/web/stores/editorStore.ts` — wrap with `temporal()` middleware from zundo; remove custom `undoStack`, `pushUndo`, `popUndo`; keep `lockedSections` / `lockSection` / `unlockSection` (AI write-lock stays)
- `apps/web/app/(dashboard)/resume/[id]/page.tsx` — mount `useEditorKeyboard`, remove the custom `⌘Z` listener from Story 2.5
- `apps/web/components/editor/EditorShell.tsx` — mount `SlashCommandPalette` and `GlobalCommandPalette`

### Dependencies

- **Story 2.5 (AI Inline Rewrite)** — done. The custom `undoStack` will be replaced by `zundo`. AI apply still creates a single undo step (now via temporal state diff).
- **Story 2.2 (TipTap Editor)** — done. `addSection` store action exists.
- **`cmdk`** — already installed (`apps/web/package.json`).
- **`zundo@^2`** — new dependency.

### Out of scope

- **Real ATS analysis** — "Analisis ATS" in `⌘K` palette is a stub (toast "Coming soon"). Real implementation is Epic 3.
- **Real template switching** — "Ganti Template" is a stub. Real implementation is Epic 5.
- **Real PDF export** — "Export PDF" is a stub. Real implementation is Epic 5.
- **Real Kak chat** — "Tanya Kak" is a stub. Real implementation is Epic 4.
- **Slash commands for AI actions** — only section-type commands in V1. AI slash commands (e.g., `/rewrite`) are a follow-up.
- **Custom keyboard shortcut configuration** — hardcoded shortcuts only.

---

## Tasks/Subtasks

### 1. Undo/redo with zundo

- [ ] 1.1 Add `zundo@^2` to `apps/web/package.json`. Run `pnpm install`.
- [ ] 1.2 Wrap `useEditorStore` with `temporal()` middleware. Configure: `limit: 50` (max undo depth), `equality: (a, b) => a === b` (reference equality for perf).
- [ ] 1.3 Remove the custom `undoStack`, `pushUndo`, `popUndo` from the store interface and implementation. The AI apply in `SectionBlock` should now just call `updateSectionField` directly — zundo captures the state diff automatically.
- [ ] 1.4 Update `SectionBlock.tsx` `handleAIApply`: remove `pushUndo` call (zundo handles it). The `updateSectionField` call is already the atomic action.
- [ ] 1.5 Vitest test: call `updateSectionField` → verify `useEditorStore.temporal.getState().pastStates` has one entry. Call `undo()` → verify field reverts.

### 2. Keyboard shortcut handler

- [ ] 2.1 Create `apps/web/hooks/useEditorKeyboard.ts`. Registers a single global `keydown` listener that handles:
  - `⌘Z` / `Ctrl+Z` → `useEditorStore.temporal.getState().undo()`
  - `⌘⇧Z` / `Ctrl+Shift+Z` → `useEditorStore.temporal.getState().redo()`
  - `⌘S` / `Ctrl+S` → `e.preventDefault()` + toast "CV tersimpan otomatis ✓"
  - `⌘K` / `Ctrl+K` → `e.preventDefault()` + open global command palette (via state setter)
  - `Tab` (inside editor) → focus next section
  - `Shift+Tab` (inside editor) → focus previous section
- [ ] 2.2 Mount `useEditorKeyboard` in `apps/web/app/(dashboard)/resume/[id]/page.tsx`. Remove the old `⌘Z` listener from Story 2.5.
- [ ] 2.3 Tab/Shift+Tab logic: query all `[data-section-block] button[data-leftnav-item]` or the section header buttons, find current focused index, move to next/prev. Wrap at boundaries.

### 3. Slash command palette

- [ ] 3.1 Create `apps/web/components/editor/SlashCommandPalette.tsx`:
  - Uses `cmdk` `<Command>` component
  - Triggered when user types `/` inside the editor area (listen for `/` keydown on the editor shell)
  - Shows a floating popover near the cursor position
  - Items: Pengalaman, Pendidikan, Keahlian, Sertifikasi, Proyek, Bahasa (maps to `SectionType`)
  - On select: calls `addSection(type)`, closes palette, removes the `/` character from the input
  - Filterable: typing after `/` narrows the list (e.g., `/peng` shows only "Pengalaman")
  - Escape closes without action
- [ ] 3.2 Mount in `EditorShell.tsx` (or the editor page). Wire the `/` trigger.

### 4. Global command palette

- [ ] 4.1 Create `apps/web/components/editor/GlobalCommandPalette.tsx`:
  - Uses `cmdk` `<Command.Dialog>` (modal overlay, centered, max-w-lg)
  - Triggered by `⌘K` (handled in `useEditorKeyboard`)
  - Items: "Analisis ATS" (Target icon), "Ganti Template" (Palette icon), "Export PDF" (Download icon), "Tanya Kak" (Sparkles icon)
  - On select: show toast "Coming soon — fitur ini akan hadir di update berikutnya" + close
  - Filterable search input at top
  - Escape closes
- [ ] 4.2 Wire open/close state: `useEditorKeyboard` sets a state flag; `GlobalCommandPalette` reads it.

### 5. Verification

- [ ] 5.1 `pnpm --filter '@lolos/web' typecheck` passes.
- [ ] 5.2 `pnpm --filter '@lolos/web' build` passes.
- [ ] 5.3 All existing tests (37+) still pass.
- [ ] 5.4 Manual smoke:
  - Type `/` → slash palette opens, type `peng` → filters to "Pengalaman", Enter → section added
  - `⌘K` → global palette opens, select "Analisis ATS" → toast "Coming soon"
  - Edit a field → `⌘Z` → reverts → `⌘⇧Z` → re-applies
  - AI wand → Terapkan → `⌘Z` → AI change reverts (single step)
  - `⌘S` → toast "CV tersimpan otomatis ✓", no browser save dialog
  - Tab → focus moves to next section; Shift+Tab → previous

---

## Dev Notes

### Previous Story Learnings (from 2.5)

- **Custom `undoStack` was minimal (depth 1)** — zundo replaces it with a proper temporal middleware that tracks N states. The migration is: remove `undoStack`/`pushUndo`/`popUndo` from the store, wrap with `temporal()`, and the existing `updateSectionField` calls automatically become undo-able.
- **`⌘Z` listener was in the editor page** — move it into `useEditorKeyboard` for centralization. The new listener calls `undo()` from zundo's temporal store.
- **`cmdk` is already installed** — no new dep needed for the command palettes. Just import and use.
- **AI write-lock (`lockedSections`) stays** — zundo doesn't interfere with it. The lock prevents edits during streaming; zundo just tracks the state changes that DO happen.

### Architecture Compliance

- **Keyboard shortcuts follow platform conventions:** `⌘` on Mac, `Ctrl` on Windows/Linux. Detect via `e.metaKey || e.ctrlKey`.
- **Command palette follows the Notion/Linear pattern** (per UX spec): slash for inline actions, `⌘K` for global actions.
- **No new backend changes** — this is a pure frontend story.
- **Accessibility:** Command palette items are keyboard-navigable (cmdk handles this). Tab navigation between sections uses standard focus management.

### Testing Standards

- Vitest for zundo integration (store state + undo/redo).
- No e2e needed — keyboard shortcuts are best tested manually or via Playwright (existing framework).

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

- 2026-05-27: Story created from epic 2.6 spec. Last story in Epic 2 (Resume Editor). Introduces zundo for full undo/redo, cmdk-based slash + global command palettes, and centralized keyboard shortcut handling. Pure frontend — no backend changes.

---

## Status

**Current Status:** ready-for-dev
**Last Updated:** 2026-05-27
