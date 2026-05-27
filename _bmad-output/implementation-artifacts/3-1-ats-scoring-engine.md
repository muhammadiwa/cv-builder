---
baseline_commit: 49072d455e9a0739985a85fb7ebf71ef791bff2b
---

# Story 3.1: ATS Scoring Engine

**Status:** ready-for-dev
**Epic:** 3 — ATS Scoring & Optimization
**Created:** 2026-05-27

---

## User Story

As a job seeker,
I want my CV scored across multiple ATS dimensions,
So that I know exactly how to improve my chances of passing screening.

---

## Acceptance Criteria

**AC-1:** Given a CV with content, When ATS scoring runs, Then a 0-100 score is computed from 6 weighted dimensions: Keyword Match (30%), Formatting (20%), Completeness (15%), Readability (15%), Metrics Impact (10%), Optimization (10%).

**AC-2:** And scoring runs in a Web Worker to avoid blocking the UI thread.

**AC-3:** And score updates within 500ms of any edit (debounced).

**AC-4:** And formatting dimension detects: two-column layouts, tables, centered text, text boxes, non-standard fonts, headers/footers.

**AC-5:** And completeness dimension checks all 7 standard sections present (Header, Summary, Experience, Education, Skills, Certifications, Projects — Languages and Achievements are optional).

---

## Developer Context

### Architecture

The ATS scoring engine is a **pure client-side computation** that runs in a Web Worker. No backend API call needed for scoring — the engine reads section content from the editor store and computes a score locally. This keeps scoring instant (<500ms) and works offline.

**Why client-side:**
- Score must update within 500ms of any edit (AC-3) — network round-trip would be too slow
- Scoring logic is deterministic (no AI/LLM needed for the base score)
- Works offline (Story 2.4 already handles offline editing)
- Reduces server load and AI cost

**Architecture placement:**
- `apps/web/lib/ats-engine/` — the scoring engine (pure functions, no React)
- `apps/web/lib/ats-engine/worker.ts` — Web Worker entry point
- `apps/web/features/ats/useATSScore.ts` — React hook that manages the worker lifecycle + debounce (placed in `features/ats/` per architecture doc's feature-based organization, not `hooks/`)
- The StatusBar's ATS mini-ring (Story 2.3, currently hardcoded 0%) will read from this hook
- The right panel "ATS" placeholder (Story 2.3) will be replaced by the real dashboard in Story 3.2

**Note on server-side scoring:** The architecture doc shows `apps/api/src/ats/ats.service.ts` with a "6-dimension scoring engine". That's for Story 3.3+ (AI-powered scoring with JD comparison, semantic cache, server-side persistence). THIS story is the V1 client-only implementation — pure algorithmic, no AI, no backend. The server-side module will be built when we need JD-based keyword extraction and score caching.

**Scoring dimensions (6):**

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Keyword Match | 30% | Industry keywords present vs expected (based on section type) |
| Formatting | 20% | ATS-safe formatting (no tables, no multi-column, standard fonts) |
| Completeness | 15% | Required sections present (7 of 9 section types) |
| Readability | 15% | Sentence length, passive voice, jargon density |
| Metrics Impact | 10% | Quantifiable achievements (numbers, percentages, metrics) |
| Optimization | 10% | Action verbs, bullet structure, length appropriateness |

### Technical Specs

- **Web Worker** — `apps/web/lib/ats-engine/worker.ts`. Receives section data via `postMessage`, returns score + per-dimension breakdown. Uses `comlink` for typed RPC over the worker boundary (~2 KB).
- **Worker TypeScript:** Add `/// <reference lib="webworker" />` at the top of `worker.ts` so Worker globals (`self`, `postMessage`) type-check without polluting the main app's tsconfig with `"webworker"` lib.
- **Worker bundling:** Next.js 14 with webpack 5 supports `new Worker(new URL('./worker.ts', import.meta.url))` in client components. The worker file must NOT import any Node.js or `next/server` modules — all imports must be browser-compatible.
- **Worker fallback:** If `typeof Worker === 'undefined'` (SSR or very old browser), fall back to calling `computeATSScore` directly on the main thread (still debounced). This ensures the score always computes.
- **Debounce: 500ms idle** after any `editorStore.sections` change. The hook subscribes to the store and debounces before posting to the worker. If a new edit arrives while scoring is in-flight, discard the stale result when it returns and recompute with latest sections (generation counter pattern).
- **Testing strategy:** Dimension scorers are pure functions — test directly in Vitest without Worker. For the hook integration test, mock comlink's `wrap()` to return the scorer directly (jsdom has no Worker API). Do NOT attempt to instantiate a real Worker in tests.
- **Score shape:**
  ```ts
  interface ATSScore {
    total: number; // 0-100
    dimensions: {
      keywordMatch: { score: number; weight: 0.30; details: string[] };
      formatting: { score: number; weight: 0.20; details: string[] };
      completeness: { score: number; weight: 0.15; details: string[] };
      readability: { score: number; weight: 0.15; details: string[] };
      metricsImpact: { score: number; weight: 0.10; details: string[] };
      optimization: { score: number; weight: 0.10; details: string[] };
    };
    computedAt: number; // ms epoch
  }
  ```
- **`ScoringInput` type:**
  ```ts
  interface ScoringInput {
    sections: Array<{
      sectionType: SectionType;
      content: Record<string, unknown>; // __field_updated_at stripped before posting
      visible: boolean;
    }>;
  }
  ```
  The hook strips `id`, `displayOrder`, `aiGenerated`, and `__field_updated_at` before posting to the worker — the scorer doesn't need them.
- **Keyword matching (V1):** Static keyword lists per section type (e.g., experience sections should have action verbs like "managed", "developed", "increased"). NOT AI-powered in V1 — just pattern matching against curated lists. AI-powered keyword extraction (comparing against a job description) is Story 3.3+ territory. Scoring formula: `score = min(100, (uniqueMatchedKeywords / targetCount) * 100)` where `targetCount` varies by section type (experience: 5 keywords expected, skills: 8, summary: 3, etc.).
- **Formatting detection:** Parse the HTML content strings for patterns: `<table>`, `text-align: center`, multi-column CSS, non-standard font families. Since content is stored as HTML strings in `content` fields, regex/DOM parsing is sufficient.
- **Completeness check:** Count which of the 7 required section types exist in `sections[]`. Missing sections reduce the score proportionally.
- **Readability:** Flesch-Kincaid adapted for Indonesian/English bilingual text. Sentence length > 25 words penalized. Passive voice detection (basic regex for "di-" prefix in Indonesian, "was/were/been" in English).
- **Metrics Impact:** Regex for numbers, percentages, currency amounts in experience/projects sections. More metrics = higher score.
- **Optimization:** Action verb presence at bullet start, bullet count per experience entry (3-5 ideal), total CV length (1-2 pages ideal based on word count).
- **`comlink`** — new dependency. Typed Web Worker RPC. Avoids manual `postMessage`/`onmessage` boilerplate.
- **Worker bundling:** Next.js supports Web Workers via `new Worker(new URL('./worker.ts', import.meta.url))`. No special config needed.

### Files (planned)

**New:**
- `apps/web/lib/ats-engine/types.ts` — `ATSScore`, `DimensionScore`, `ScoringInput` types
- `apps/web/lib/ats-engine/scorer.ts` — main scoring function (pure, no side effects)
- `apps/web/lib/ats-engine/dimensions/keyword-match.ts` — keyword matching logic + curated lists
- `apps/web/lib/ats-engine/dimensions/formatting.ts` — HTML pattern detection
- `apps/web/lib/ats-engine/dimensions/completeness.ts` — section presence check
- `apps/web/lib/ats-engine/dimensions/readability.ts` — Flesch-Kincaid + passive voice
- `apps/web/lib/ats-engine/dimensions/metrics-impact.ts` — number/percentage detection
- `apps/web/lib/ats-engine/dimensions/optimization.ts` — action verbs + structure
- `apps/web/lib/ats-engine/worker.ts` — Web Worker entry (imports scorer, exposes via comlink)
- `apps/web/features/ats/useATSScore.ts` — React hook: worker lifecycle + 500ms debounce + store subscription
- `apps/web/lib/ats-engine/__tests__/scorer.test.ts` — unit tests for scoring logic
- `apps/web/lib/ats-engine/data/action-verbs.ts` — curated action verb lists (EN + ID)
- `apps/web/lib/ats-engine/data/keywords.ts` — industry keyword lists per section type

**Modified:**
- `apps/web/package.json` — add `comlink@^4`
- `apps/web/components/editor/StatusBar.tsx` — replace hardcoded `score={null}` with live score from `useATSScore`
- `apps/web/app/(dashboard)/resume/[id]/page.tsx` — mount `useATSScore` hook
- `apps/web/stores/editorStore.ts` — add `atsScore: ATSScore | null` + `setATSScore` action (so StatusBar and future ATS panel can read it)

### Dependencies

- **Story 2.2 (TipTap Editor)** — done. `editorStore.sections` is the input.
- **Story 2.3 (Multi-Panel Layout)** — done. StatusBar ATS mini-ring exists (hardcoded 0%).
- **Story 2.4 (Auto-Save)** — done. `selectDirtySince` + field timestamps exist; scoring subscribes to the same store.
- No backend dependency — pure client-side computation.

### Out of scope

- **Job description comparison** — V1 uses static keyword lists. JD-based scoring is Story 3.3+.
- **ATS score visualization (ring, cards, sparkline)** — Story 3.2.
- **Improvement suggestions** — Story 3.3.
- **Platform-specific rules (Talenta, LinovHR)** — Story 3.4.
- **Score persistence to server** — V1 computes on-the-fly. Server-side caching is a follow-up.
- **AI-powered keyword extraction** — uses static lists in V1.

---

## Tasks/Subtasks

### 1. Types and scoring infrastructure

- [ ] 1.1 Create `apps/web/lib/ats-engine/types.ts` — `ATSScore`, `DimensionScore`, `ScoringInput`, dimension weight constants.
- [ ] 1.2 Create `apps/web/lib/ats-engine/scorer.ts` — main `computeATSScore(input: ScoringInput): ATSScore` function that calls each dimension scorer and computes the weighted total.
- [ ] 1.3 Add `comlink@^4` to `apps/web/package.json`. Run `pnpm install`.

### 2. Dimension scorers

- [ ] 2.1 Create `apps/web/lib/ats-engine/dimensions/completeness.ts` — checks 7 required section types present. Score = (present / 7) * 100. Details list missing sections.
- [ ] 2.2 Create `apps/web/lib/ats-engine/dimensions/formatting.ts` — scan HTML content for ATS-unfriendly patterns (tables, centered text, multi-column, non-standard fonts). Score = 100 - (penalties). Details list each detected issue.
- [ ] 2.3 Create `apps/web/lib/ats-engine/dimensions/readability.ts` — average sentence length, passive voice ratio. Score penalized for sentences > 25 words and passive voice > 20%.
- [ ] 2.4 Create `apps/web/lib/ats-engine/dimensions/metrics-impact.ts` — regex for numbers/percentages/currency in experience + projects sections. Score = min(100, metricsFound * 15).
- [ ] 2.5 Create `apps/web/lib/ats-engine/dimensions/optimization.ts` — action verb at bullet start, bullet count per entry (3-5 ideal), total word count (300-800 ideal for 1-page CV).
- [ ] 2.6 Create `apps/web/lib/ats-engine/dimensions/keyword-match.ts` — match section content against curated keyword lists. Score = (matched / expected) * 100.
- [ ] 2.7 Create `apps/web/lib/ats-engine/data/action-verbs.ts` — 50+ action verbs in English + Indonesian.
- [ ] 2.8 Create `apps/web/lib/ats-engine/data/keywords.ts` — keyword expectations per section type.

### 3. Web Worker

- [ ] 3.1 Create `apps/web/lib/ats-engine/worker.ts` — Web Worker entry point. Add `/// <reference lib="webworker" />` at top for type-checking. Import `computeATSScore`, expose via `comlink`'s `expose()`.
- [ ] 3.2 Verify Next.js bundles the worker correctly via `new Worker(new URL('./worker.ts', import.meta.url))`. Test in dev mode.
- [ ] 3.3 Add Worker fallback in the hook: if `typeof Worker === 'undefined'`, call `computeATSScore` directly on the main thread (still debounced).
### 4. React hook

- [ ] 4.1 Create `apps/web/features/ats/useATSScore.ts`:
  - Subscribes to `useEditorStore.sections`
  - Debounces 500ms idle
  - Strips `__field_updated_at`, `id`, `displayOrder`, `aiGenerated` from sections before posting
  - Posts to Web Worker via comlink `wrap()` (or calls scorer directly if Worker unavailable)
  - Uses a generation counter: if a new edit arrives while scoring is in-flight, discard the stale result
  - Stores result in `editorStore.atsScore` + `editorStore.atsComputing`
  - Returns `{ score, isComputing }`
  - Handles worker errors gracefully (catch → set score null, log error)
  - Terminates worker on unmount
  - Guards: if `sections.length === 0`, set score to null immediately (don't post to worker)
- [ ] 4.2 Add `atsScore: ATSScore | null` + `atsComputing: boolean` + `setATSScore(score)` + `setATSComputing(computing)` to `editorStore`. **Important:** update the `partialize` option in `temporal()` to include `atsScore` in the excluded set (undo should NOT revert score changes — they're derived state).
- [ ] 4.3 Mount `useATSScore` inside the loaded branch of `apps/web/app/(dashboard)/resume/[id]/page.tsx` (AFTER the loading/error guards, not at the top level — avoids computing score on empty sections during load).

### 5. StatusBar integration

- [ ] 5.1 Update `StatusBar.tsx` `ATSMiniRing` to read `atsScore.total` from the editor store instead of hardcoded `null`. Show skeleton/pulse while `atsComputing === true` (read from store, not from hook — StatusBar doesn't call the hook directly).

### 6. Tests

- [ ] 6.1 Unit tests for `computeATSScore` — verify weighted total calculation, verify each dimension contributes correctly. Pure function tests, no Worker needed.
- [ ] 6.2 Unit tests for each dimension scorer — completeness (missing sections), formatting (table detection), readability (long sentences), metrics (number detection), optimization (action verbs), keyword match. All pure functions.
- [ ] 6.3 Integration test for the hook: mock comlink's `wrap()` to return the scorer directly (bypass Worker since jsdom has no Worker API). Verify: sections change → debounce → score computed → store updated.

### 7. Verification

- [ ] 7.1 `pnpm --filter '@lolos/web' typecheck` passes.
- [ ] 7.2 `pnpm --filter '@lolos/web' build` passes.
- [ ] 7.3 All existing tests still pass + new ATS tests pass.
- [ ] 7.4 Manual smoke: edit a section → score updates in StatusBar within ~500ms. Add/remove sections → completeness score changes. Add numbers to experience → metrics score increases.

---

## Dev Notes

### Defensive Programming Checklist (from Epic 2 retro)

Before first commit, verify:
- [ ] Null guards on all section content access (content can be null/undefined)
- [ ] Worker error handling (worker crash → graceful fallback, not broken UI)
- [ ] Empty sections array → score 0, not NaN or crash
- [ ] HTML content with no text (only tags) → treated as empty
- [ ] Browser without Web Worker support → fallback to main-thread scoring
- [ ] `__field_updated_at` metadata key filtered out before scoring (it's not user content)

### Previous Story Learnings

- **`editorStore.sections` is the single source of truth** — subscribe to it for scoring input.
- **Content is `Record<string, unknown>`** — fields are typed loosely. HTML strings live in fields like `summary`, `description`. Always guard with `typeof v === 'string'`.
- **`__field_updated_at` is a sibling key in content** — filter it out before analyzing content for keywords/metrics/readability.
- **StatusBar already renders `ATSMiniRing`** with `score={null}` — just wire it to the real score.

### Architecture Compliance

- **Web Worker for non-blocking compute** (FR10 requirement).
- **No AI/LLM for base scoring** — pure algorithmic. AI is only for suggestions (Story 3.3).
- **Score shape matches the architecture's "6-dimension" requirement** (FR10).
- **Client-side only** — no new backend endpoint in this story.

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

- 2026-05-27: Story created from epic 3.1 spec. First story in Epic 3 (ATS Scoring). Pure client-side Web Worker computation with 6 weighted dimensions. No backend dependency.

---

## Status

**Current Status:** ready-for-dev
**Last Updated:** 2026-05-27
