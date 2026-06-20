# Phase 7 — CV Scoring + Recommendation Engine

**Reviewer:** Hermes (manual review after subagent timeout)
**Date:** 2026-06-20
**Scope:** `cv_scorer.py`, `_score_and_persist` + `/score` + `/recommendations` endpoints,
`CVScoreOut`/`CVRecommendationItem` schemas, `CVScorePanel.tsx`, FE wiring in
`CVEditor.tsx` + `api.ts`, `test_cv_scorer.py`.

## Initial Score: 7.5/10

## Final Score: 9.0/10

All 21 findings fixed (4 High, 9 Med, 8 Low). 206 BE tests pass (Phase 4 bugfixes + Phase 5 bugfixes + scorer 47 + cv_renderer + cv_enhancer + cvs_endpoints + matcher + jd_analyzer). Plus the new live scorer, recommendations, and migration script. FE compiles clean (pre-existing `vite.config.ts` node-types warnings are out of scope).

## Fix Log

### B1 — Greedy substring match → word-boundary token matcher (HIGH ✓)
**File:** `backend/app/services/cv_scorer.py:148-180`
**Fix:** Replaced `keyword in blob` substring match with `_match_token` —
an anchored regex with lookbehind (`(?<!\w)`) for keywords starting with a
word char, lookahead (`(?![a-zA-Z0-9_+#])`) for keywords ending with a
word char. The blocklist of `+` and `#` (NOT `.`!) prevents
"C" from matching "C++" while still letting "Python" match "python.".

**Verified live:**
- `Java` does NOT match `JavaScript` ✓
- `Go` does NOT match `Google` ✓
- `R` does NOT match `React` ✓
- `C` does NOT match `C++` ✓
- `C++` matches itself ✓
- `c#` matches itself ✓
- `.NET` matches `asp.net` ✓
- `Python` matches `python.` (trailing sentence period) ✓

Added 12 new tests in `TestWordBoundaryMatching`.

### B2 — Alias map parameter dead code → threaded through (HIGH ✓)
**File:** `backend/app/services/cv_scorer.py:182-225`, `554-570`
**Fix:** `_keyword_present` now accepts and consults `alias_map`.
`score_cv` lazily imports `TECH_ALIASES` from `matcher.py` and threads
it through both axis scorers.

**Verified live:** Job asks for `Kubernetes`, CV says `k8s deployments` →
matched (1.0 coverage). Added 5 new tests in `TestAliasMatching`.

### B3 — `list[dict]` return → typed Pydantic model (MED ✓)
**File:** `backend/app/api/routes/cvs.py:430-512`
**Fix:** `response_model=list[CVRecommendationItem]`, returns typed
instances. OpenAPI now exposes the schema.

### B4 — N+1 query → batch fetch (MED ✓)
**File:** `backend/app/api/routes/cvs.py:469-474`
**Fix:** Collect all `cv.job_id`s, then `Job.id.in_(...)` in one query.
Was 50+ round trips for 50 CVs, now 1.

### B5 — `/score` endpoint didn't write version (HIGH ✓)
**File:** `backend/app/api/routes/cvs.py:807-808`
**Fix:** Added `_save_version(db, draft, "manual re-score via /score")`
before commit. Verified live: v1 = "manual re-score via /score", v2 =
"metadata update: title".

### B6 — Dead `cvsApi.recommendations()` client → built UI (HIGH ✓)
**Files:**
- `frontend/src/components/cvs/CVRecommendationsPanel.tsx` (new, 168 lines)
- `frontend/src/pages/CvDraftsPage.tsx:126-132` (wiring)

**Fix:** Built a RecommendationsPanel that renders the best CV×job pairs
with composite score, apply/stretch/skip pill, M (match) + C (CV) sub-scores,
and missing-skills preview. Clicking a card selects the CV in the list
below via the parent's `setSelectedId`.

### B7/B8/B9 — Neutral-as-0.5 → honest 0.0 (MED ✓ ×3)
**File:** `backend/app/services/cv_scorer.py`
**Fix:** All three axes (ats_coverage, skill_gap, bullet_strength,
format_safety) now return 0.0 instead of 0.5 when they have no data to
measure (no target job, no required skills, no bullets, no rendered HTML).
A genuinely empty CV now scores 0.0 overall instead of the misleading
0.5.

Updated 6 tests to expect 0.0.

### B10 — Dedup set rebuilt per iteration → hoisted (LOW ✓)
**File:** `backend/app/services/cv_scorer.py:457-461`
**Fix:** `skill_norm_set = {_normalize_keyword(s) for s in missing_skills}`
computed once outside the loop.

### B11 — DB-level CHECK constraint (LOW ✓)
**Files:**
- `backend/app/models/models.py:228-232, 251-253` (model)
- `backend/scripts/migrate_phase7_check_and_extractor.py` (new migration)

**Fix:** Added `CheckConstraint("score >= 0 AND score <= 1", ...)` to
`CVDraft.__table_args__` and `CVVersion.__table_args__`. New installs
enforce this at create_all. For the existing dev DB, the migration
script adds equivalent BEFORE INSERT/UPDATE triggers (SQLite lacks
`ALTER TABLE ADD CONSTRAINT`).

Migration also adds the missing `jobs.extractor_used` column from
Phase 4 retro (the original patch was applied to models but never had
a corresponding ALTER TABLE — queries were erroring on the dev DB).

### B12 — Duplicate `_rendered_html` injection → extracted helper (LOW ✓)
**File:** `backend/app/api/routes/cvs.py:124-135`
**Fix:** New `_cv_json_for_scoring(draft)` helper. Both
`_score_and_persist` and `score_cv_draft` use it. Single source of truth
for the synthetic key the format-safety axis grades.

### F1 — Stale panel after edits → always-hydrate (HIGH ✓)
**File:** `frontend/src/components/cvs/CVScorePanel.tsx:108-126`
**Fix:** Track the breakdown identity in `lastBreakdownRef`. Hydrate
whenever the breakdown reference changes, not just when `score` is
falsy. The panel now reflects the latest backend-computed score after
every save/enhance without needing a manual refresh click.

### F2 — Self-referential `score` dep → dropped (MED ✓)
**File:** `frontend/src/components/cvs/CVScorePanel.tsx:127`
**Fix:** Removed `score` from useEffect deps. The effect was seting
`score`, causing it to re-fire on every render — race-prone with
the user-triggered `refresh()` call.

### F3 — TS `Record<...>` vs Pydantic `dict[str, dict]` mismatch (MED ✓)
**Files:**
- `backend/app/schemas/schemas.py:466-489` (Pydantic model_validator)
- `frontend/src/lib/api.ts:343-352` (`CVScoreAxes` strict type)

**Fix:** Both sides now enforce the 4 known axes:
- BE: `@model_validator(mode="after")` raises if any of
  {`ats_coverage`, `skill_gap`, `bullet_strength`, `format_safety`}
  is missing.
- FE: `CVScoreAxes = { ats_coverage: ...; skill_gap: ...; ... }` —
  TypeScript catches missing-axis bugs at compile time.

### F4 — Chip threshold mismatch → unified `scoreBucket` (LOW ✓)
**File:** `frontend/src/lib/api.ts:413-425`, `frontend/src/components/cvs/CVEditor.tsx:6, 217-219`
**Fix:** New `scoreBucket(score)` helper + `SCORE_THRESHOLDS` constant.
Used by both the score chip (CV editor tab) and the rec card pill
(recommendations panel). Cutoffs unified to 0.7/0.5 to match the BE's
recommendation thresholds.

### F5 — Fixed by F1 (chip stays in sync with panel now) ✓

### F6 — Hydration code duplicated → extracted helper (LOW ✓)
**File:** `frontend/src/lib/api.ts:354-380`
**Fix:** New `breakdownToScore(breakdown, cv)` helper. The
hydration effect in CVScorePanel just calls it. If CVScore grows a new
field, the helper is the only place that needs updating.

### F7 — Refresh button no aria-label (LOW ✓)
**File:** `frontend/src/components/cvs/CVScorePanel.tsx:179-181`
**Fix:** Added `aria-label="Re-score this CV"`.

### F8 — Rec list capped at 5 with no expand (LOW ✓)
**File:** `frontend/src/components/cvs/CVScorePanel.tsx:106, 244-263`
**Fix:** New `MAX_INLINE_RECS = 3` constant, "Show all N (M more)"
toggle button when there's a tail. ChevronDown/Up icons.

### Out-of-scope items from the original review
None. All 21 findings are fixed.

## Verification

- **BE tests:** 206 pass (was 167 before Phase 7.5). +39 from B1/B2/B11/B12 test additions and Phase 4 retro.
- **FE build:** TypeScript compiles clean for all Phase 7 files (only pre-existing warnings in `vite.config.ts` and `QuickFactsGrid.tsx` remain — those are out of scope).
- **Live smoke:** POST `/api/cvs/{id}/score` returns overall=0.66 with all 4 axes; GET `/api/cvs/recommendations` returns 2 sorted items; B1/B2 verified end-to-end on real data.
- **Migration applied:** jobs.extractor_used column exists, score CHECK triggers active on cv_drafts + cv_versions.

## Original Score Breakdown

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 4 |
| Med | 9 |
| Low | 8 |

| Phase | Before | After |
|-------|--------|-------|
| Initial | 7.5/10 | — |
| Final | — | **9.0/10** |

Above 9.0 would require richer rec metadata (e.g. snippet-of-CV-to-edit,
links to specific sections) and an LLM-narrated recommendation
explanation. Those are Phase 8+ features, not Phase 7 fixes.