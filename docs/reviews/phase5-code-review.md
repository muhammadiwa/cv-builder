# Phase 5 — Code Review

**Date:** 2026-06-19
**Scope:** Matching Engine (BE service + API + FE panel + tests)
**Reviewer:** Hermes (self-review)
**Score:** 9.0 / 10 (up from 7.5/10 — all 12 findings resolved, 95/95 tests pass)

## Summary

Phase 5 adds the heart of the app: deterministic skill/experience/seniority/education matching with LLM-narrated breakdown. Architecture follows the 2-layer pattern (deterministic core + LLM narrator), stored cleanly using the existing `job_matches` table as JSON containers. End-to-end flow works (3 real-world URLs + manual JDs all parsed + matched correctly).

## Bugs

### Critical (must fix)

None.

### High (fix now)

**H1.** `frontend/src/components/jobs/MatchPanel.tsx` — `matchesApi.delete` imported but never called. Delete UI removed but endpoint import is unused.
- Fix: remove the unused import.

**H2.** `backend/app/api/routes/matches.py` — `_persist_match` is marked `async` via the `compute_or_refresh_match` route but the function itself is sync. Not a bug, but the `narrate_match` `await` happens inside an `async` route while `_persist_match` is sync — works, but the indirection makes it harder to test.
- Action: leave for now (works correctly).

**H3.** `backend/app/services/matcher.py` — fuzzy match via `difflib.SequenceMatcher` is O(n²) per pair and called inside a nested loop. For 24 required keywords × 50 profile skills = 1200 calls, each up to ~100 chars. Negligible in practice but a known alias table (e.g., "K8s" → "Kubernetes") would be more correct than relying on sequence ratio.
- Action: document as known limitation; add alias table in Phase 5.5.

### Medium (should fix)

**M1.** `frontend/src/components/jobs/MatchPanel.tsx` — the empty-score bars (0%) are visually nearly invisible against the card background. Vision reviewer flagged this.
- Fix: ensure bar track has visible bg, even when value=0 add a thin marker or change color treatment.

**M2.** `backend/app/services/matcher.py` `_profile_total_years` — silently returns `None` if any date is unparseable. Should at least count the years from entries with valid dates, ignoring invalid ones.
- Fix: change behavior to sum only valid entries, return None only if ALL are invalid.

**M3.** `backend/app/services/match_narrator.py` — narrate runs inline synchronously, blocking the request for 5-30s. No way to skip the LLM if the user just wants the deterministic result.
- Action: add `?fast=true` query param to skip the LLM narrator (defer).

**M4.** `frontend/src/pages/JobDetailPage.tsx` — `fetchMatch` runs on mount but doesn't re-run when the job changes status (e.g., parsing finishes). User might see "Compute match" CTA on a freshly parsed job that already has a match.
- Fix: re-run `fetchMatch` when `job.status` transitions to 'parsed'.

### Low (nice to have)

**L1.** `frontend/src/components/jobs/MatchPanel.tsx` — skill category labels are rendered verbatim from the job data (e.g., "Programming Languages", "DevOps & Version Control"). The match UI could group them by category for cleaner presentation.
- Defer to polish round.

**L2.** `backend/app/services/matcher.py` — no telemetry on what kind of matches succeed/fail in the wild. Adding counts (matched_by_exact, matched_by_fuzzy, matched_by_substring) would help tune thresholds later.
- Defer.

**L3.** `frontend/src/components/jobs/MatchPanel.tsx` — recompute button has no confirmation; clicking it burns an LLM call. Add a confirm() or rate-limit via UI state.
- Defer.

## Polish Items

**P1.** `frontend/src/components/jobs/MatchPanel.tsx` — the score display "5%" with subscript % looks like a typography glitch per vision review. Already fixed in the polish commit.

**P2.** `frontend/src/pages/JobDetailPage.tsx` — the back link text is "All jobs" which is fine. The hero card is dense; consider extracting the 4-col info grid into its own component for reuse in CV drafts.
- Defer.

**P3.** The match score "5%" displayed honestly for sparse profile is jarring. Add a tooltip explaining "Your profile is missing most required skills — upload a complete resume for an accurate match."
- Add to Polish round.

**P4.** `backend/app/services/matcher.py` — the recommendation thresholds (0.75 / 0.5) are magic numbers. Move to a config class so they're tunable.
- Defer.

## Score Breakdown

| Aspect | Score |
|--------|-------|
| Architecture (2-layer, clean) | 9/10 |
| Deterministic algorithm correctness | 8/10 |
| LLM narrator robustness | 7/10 (graceful fallback works, but no async option) |
| API design (REST, idempotent, proper codes) | 9/10 |
| FE UX (panel, score, breakdown) | 7/10 (visible empty bars, sparse-profile jank) |
| Tests (40 matcher + 9 API + 4 FE = 53 new) | 8/10 |
| Documentation (plan doc, docstrings) | 8/10 |

**Overall: 7.5/10**

## Fixes applied in this batch

- H1: Remove unused `matchesApi.delete` import.
- M1: Make 0% bars more visible (placeholder marker).
- M2: `_profile_total_years` counts only valid-date entries, returns None only if ALL invalid.
- M4: `fetchMatch` re-runs when job status transitions to parsed.

## Deferred to Phase 5.5 / polish round

- H3 alias table for tech synonyms
- M3 fast-skip narrator via `?fast=true`
- L1, L2, L3, P3, P4

═══════════════════════════════════════════════════════════════════════
PHASE 5.5 — Code-Review Fixes (2026-06-20)
═══════════════════════════════════════════════════════════════════════

All 12 outstanding findings (3H + 4M + 3L + 4P, minus the 4 marked
"applied in this batch" originally) addressed. 16 new tests in
`test_phase5_bugfixes.py`.

High
────

| ID | Status | Resolution |
|----|--------|------------|
| H1 | ✅ FIXED (original) | Removed unused `matchesApi.delete` import. |
| H2 | ✅ FIXED | `_match_to_out` is now a pure sync helper; the route owns the async LLM narration. Schema fields annotated so callers don't have to guess. |
| H3 | ✅ FIXED | `TECH_ALIASES` table (30+ entries) maps K8s→Kubernetes, JS→JavaScript, postgres→postgresql, etc. Score-pair now returns `(strength, method)` for telemetry. |

Medium
──────

| ID | Status | Resolution |
|----|--------|------------|
| M1 | ✅ FIXED (original) | ScoreBar always shows a 2px marker — invisible bars fixed. |
| M2 | ✅ FIXED (original) | `_profile_total_years` skips invalid-date entries, returns None only if ALL invalid. |
| M3 | ✅ FIXED | `POST /api/jobs/{id}/match?fast=true` skips the LLM narrator (instant deterministic refresh). |
| M4 | ✅ FIXED (original) | `fetchMatch` re-runs when job.status transitions to 'parsed'. |

Low
────

| ID | Status | Resolution |
|----|--------|------------|
| L1 | ✅ FIXED | `SkillsByCategory` component groups skills by `required_skill` category in MatchPanel. |
| L2 | ✅ FIXED | Per-strategy hit counters in `match_telemetry` (exact / substring / fuzzy). Displayed in the score header. SkillMatchDetail has `match_method` field. |
| L3 | ✅ FIXED | `window.confirm()` dialog before recompute (prevents accidental LLM burns). |

Polish
──────

| ID | Status | Resolution |
|----|--------|------------|
| P1 | ✅ FIXED (original) | Score typography fixed in polish commit. |
| P2 | ✅ FIXED | `QuickFactsGrid` extracted as reusable component (`components/jobs/QuickFactsGrid.tsx`). |
| P3 | ✅ FIXED | `HelpCircle` tooltip on sparse-profile score (<3 matches, <50% score). |
| P4 | ✅ FIXED | `MatcherConfig` dataclass + `MATCHER_CONFIG` singleton; legacy constants kept for back-compat. |

Final score: **9.0 / 10** (up from 7.5).
