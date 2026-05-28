---
baseline_commit: b83f779
---

# Story 3.4: Indonesian ATS Platform Rules

**Status:** ready-for-dev
**Epic:** 3 — ATS Scoring & Optimization
**Created:** 2026-05-28

---

## User Story

As a job seeker applying to Indonesian companies,
I want my CV validated against the ATS platforms Indonesian employers actually use,
So that my CV passes screening at companies using Talenta, Mekari, or LinovHR.

---

## Acceptance Criteria

**AC-1:** Given the ATS scoring engine, When platform-specific rules are loaded, Then validation for Talenta (Mekari), LinovHR, and GreatDay HR is applied.

**AC-2:** And rules are stored as JSON configuration files: `config/ats-rules/talenta.json`, `linovhr.json`, `greatday.json` — updateable without deploy.

**AC-3:** And platform-specific checks: single-column format (all three), DOCX preferred for Talenta, standard Indonesian section headers ("Pengalaman Kerja" not "Work Experience").

**AC-4:** And DOCX exports pass `mammoth.extractRawText()` verification (>95% text extraction).

**AC-5:** And PDF exports pass `pdftotext` verification (>90% text extraction).

---

## Developer Context

### Architecture

This story adds a platform validation layer on top of the existing ATS scoring engine (Story 3.1). Platform rules are config-driven JSON files that define platform-specific checks. The validation runs client-side alongside the existing scorer, adding platform-specific warnings/suggestions to the ATS panel.

**Key design decisions:**
- Rules are JSON config files in `apps/web/config/ats-rules/` — loaded at build time via Next.js static imports (no runtime fetch needed for V1).
- Each platform config defines: required section headers (Indonesian), formatting constraints, preferred export format, and parsing quirks.
- Platform validation produces a separate `PlatformValidation` result alongside the existing `ATSScore` — it does NOT modify the 6-dimension score. It's an additional layer of warnings.
- AC-4 and AC-5 (DOCX/PDF verification) are backend concerns for the export pipeline (Story 5.3/5.5). In THIS story, we only validate the CV structure against platform rules. The actual export verification will be wired when the export system is built.
- A platform selector UI (dropdown in the ATS panel) lets users choose which platform to validate against. Default: "General" (no platform-specific rules).

**Data flow:**
1. User selects a platform from dropdown in ATS panel (or leaves as "General")
2. Platform rules JSON is loaded (static import)
3. `validatePlatformRules(sections, platformConfig)` runs alongside scoring
4. Results shown as warnings in the ATS panel below the score breakdown

### Technical Specs

- **Platform config schema:**
  ```ts
  interface PlatformConfig {
    id: string;
    name: string;
    description: string;
    preferredFormat: 'pdf' | 'docx' | 'both';
    requiredHeaders: Record<SectionType, string[]>; // acceptable header names per section
    formatting: {
      singleColumnOnly: boolean;
      maxFontCount: number;
      allowedFonts: string[];
      noTables: boolean;
      noTextBoxes: boolean;
      noHeaders: boolean; // document headers/footers
    };
    warnings: string[]; // platform-specific tips
  }
  ```
- **Validation function:** `apps/web/lib/ats-engine/platform-validator.ts` — pure function, takes sections + config, returns `PlatformValidationResult`.
- **Platform selector:** Simple `<select>` in ATSPanel with options: General, Talenta (Mekari), LinovHR, GreatDay HR. Persisted in `sessionStorage`.
- **Indonesian section headers:** The validator checks if section content uses standard Indonesian headers that the platform can parse. E.g., "Pengalaman Kerja" (not "Work Experience"), "Pendidikan" (not "Education"), "Keahlian" (not "Skills").

### Files (planned)

**New:**
- `apps/web/config/ats-rules/talenta.json` — Talenta (Mekari) platform rules
- `apps/web/config/ats-rules/linovhr.json` — LinovHR platform rules
- `apps/web/config/ats-rules/greatday.json` — GreatDay HR platform rules
- `apps/web/lib/ats-engine/platform-validator.ts` — validation logic (pure function)
- `apps/web/lib/ats-engine/platform-types.ts` — `PlatformConfig`, `PlatformValidationResult` types
- `apps/web/components/ats/PlatformSelector.tsx` — dropdown to select target platform
- `apps/web/components/ats/PlatformWarnings.tsx` — displays validation warnings
- `apps/web/lib/ats-engine/__tests__/platform-validator.test.ts` — unit tests

**Modified:**
- `apps/web/components/ats/ATSPanel.tsx` — add PlatformSelector + PlatformWarnings below score breakdown

### Dependencies

- **Story 3.1 (ATS Scoring Engine)** — done. Existing scorer types and section structure.
- **Story 3.2 (ATS Visualization)** — done. ATSPanel where we add the platform UI.
- **No new npm dependencies** — JSON configs are static imports.

### Out of Scope

- **Actual DOCX/PDF export verification** (AC-4, AC-5) — requires the export pipeline (Story 5.3/5.5). This story validates CV structure only. Export verification will be added when the export system is built.
- **Auto-fix for platform issues** — future enhancement. This story only shows warnings.
- **Platform-specific scoring weights** — all platforms use the same 6-dimension weights. Platform rules are an additional validation layer.
- **Dynamic rule updates from server** — V1 uses static JSON. Server-driven config is a future enhancement.

---

## Tasks/Subtasks

### 1. Platform types and config files

- [ ] 1.1 Create `apps/web/lib/ats-engine/platform-types.ts` — `PlatformConfig`, `PlatformValidationResult`, `PlatformWarning` types.
- [ ] 1.2 Create `apps/web/config/ats-rules/talenta.json` — Talenta (Mekari) rules: single-column only, DOCX preferred, standard Indonesian headers, no tables/text boxes, max 2 fonts.
- [ ] 1.3 Create `apps/web/config/ats-rules/linovhr.json` — LinovHR rules: single-column only, PDF or DOCX, Indonesian headers, no tables, standard fonts only.
- [ ] 1.4 Create `apps/web/config/ats-rules/greatday.json` — GreatDay HR rules: single-column only, PDF preferred, Indonesian headers, no complex formatting.

### 2. Platform validator

- [ ] 2.1 Create `apps/web/lib/ats-engine/platform-validator.ts`:
  - `validatePlatformRules(sections: ScoringSection[], config: PlatformConfig): PlatformValidationResult`
  - Checks: section headers match platform's required Indonesian names, formatting constraints (single-column, no tables), font usage.
  - Returns array of `PlatformWarning` objects with severity (error/warning/info) and actionable message.

### 3. UI components

- [ ] 3.1 Create `apps/web/components/ats/PlatformSelector.tsx`:
  - Dropdown with options: "Umum (General)", "Talenta (Mekari)", "LinovHR", "GreatDay HR".
  - Persists selection in sessionStorage key `ats-platform-{resumeId}`.
  - Emits `onChange(platformId)` to parent.
- [ ] 3.2 Create `apps/web/components/ats/PlatformWarnings.tsx`:
  - Renders list of `PlatformWarning` items with severity icons (⚠️ warning, ❌ error, ℹ️ info).
  - Each warning shows actionable text in Indonesian.
  - Empty state: "✅ CV Anda sesuai dengan aturan {platformName}."

### 4. Integration

- [ ] 4.1 Update `apps/web/components/ats/ATSPanel.tsx`:
  - Add PlatformSelector below the score ring.
  - Run `validatePlatformRules` when platform changes or sections change.
  - Show PlatformWarnings below CategoryBreakdown.

### 5. Tests

- [ ] 5.1 Unit tests for `validatePlatformRules`:
  - Missing Indonesian headers detected.
  - Table/multi-column formatting flagged.
  - Valid CV passes with no warnings.
  - Each platform config loads and validates correctly.
- [ ] 5.2 Verify all 3 JSON configs are valid and parseable.

### 6. Verification

- [ ] 6.1 `pnpm --filter '@lolos/web' typecheck` passes.
- [ ] 6.2 `pnpm --filter '@lolos/web' build` passes.
- [ ] 6.3 All existing tests + new tests pass.
- [ ] 6.4 Manual smoke: select Talenta → warnings appear for non-Indonesian headers. Switch to General → warnings disappear.

---

## Dev Notes

### Previous Story Learnings (from Story 3.3)

- **ATSPanel** now has `useATSImprove`, `ApplyAllButton`, and `ATSImproveSheet`. New platform UI should integrate cleanly without conflicting.
- **`ScoringSection`** type from `@/lib/ats-engine/types` is the input shape — same as what the scorer uses.
- **Formatting dimension** already detects tables and multi-column. Platform validator can reuse some of that logic or call the formatting scorer's helpers.

### Architecture Compliance

- **Config-driven rules** per architecture doc (FR13: "config/ats-rules/{platform}.json — updateable without deploy"). V1 uses static imports in `apps/web/config/ats-rules/` for simplicity — "updateable without deploy" is achieved via Next.js ISR rebuild or a future server-driven config endpoint. The path deviates from the root-level `config/` in the epic spec because the rules are consumed client-side only in V1.
- **Client-side validation** — no backend needed. Rules are static JSON loaded at build time.
- **Pure function validator** — same pattern as dimension scorers (testable, no side effects).

### Anti-Patterns to Avoid

- **Do NOT modify the 6-dimension scoring** — platform rules are a separate validation layer, not a scoring modifier.
- **Do NOT fetch rules from an API** — V1 uses static imports. Dynamic loading is a future enhancement.
- **Do NOT block the UI** — validation should be fast (< 10ms for JSON rule checking).

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

- 2026-05-28: Story created from epic 3.4 spec. Indonesian ATS platform validation rules for Talenta, LinovHR, GreatDay HR. Config-driven JSON, client-side validation, platform selector UI.

---

## Status

**Current Status:** ready-for-dev
**Last Updated:** 2026-05-28
