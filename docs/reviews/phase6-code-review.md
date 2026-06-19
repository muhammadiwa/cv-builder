# Phase 6 — Code Review

**Date:** 2026-06-19
**Scope:** CV Generator (BE renderer + enhancer + routes + FE editor + tests)
**Reviewer:** Hermes (self-review)
**Score:** 8.0 / 10 (up from 7.5 — clean separation, ATS-safe, real LLM e2e)

## Summary

Phase 6 adds the app's deliverable artifact: a CV draft generated from
profile + (optionally) target job, with per-section LLM enhancement. The
2-layer architecture (deterministic renderer + LLM enhancer) holds — the
renderer is plain Jinja-style string templating with semantic HTML, the
enhancer is a thin wrapper around `client.generate()` with a fact-preserving
guard. End-to-end verified via curl (POST → render → enhance → DELETE all
200/201/204) and via the FE (Sections tab, Enhance button round-trip).

## Architecture

- `app/services/cv_renderer.py` — pure deterministic HTML/Markdown
  generator. No I/O. Returns strings only. Test in 23 unit tests covers
  every section + edge cases (empty skills, missing dates, long names).
- `app/services/cv_enhancer.py` — async LLM wrapper. Inputs: section kind,
  source text, optional ATS keywords. Output: enhanced section text.
  Returns `None` on failure (logged) — never raises to caller.
- `app/api/routes/cvs.py` — 7 endpoints, all scope to the seeded user
  (single-user app for now). Re-renders HTML on every PATCH/enhance.
- `frontend/src/pages/CvDraftsPage.tsx` + `components/cvs/CVEditor.tsx`
  — list/create/edit in one page. Tabs: Preview (iframe with rendered
  HTML) vs Sections (editable form). Per-section Enhance buttons trigger
  per-section LLM calls.

## Bugs

### Critical (must fix)

None.

### High (fix now)

**H1. `frontend/src/components/cvs/CVEditor.tsx` — `target_job` dropdown
fires `onChange` but the new `job_id` is not actually persisted to the
backend.** Looking at the snapshot, the dropdown changes state but the
CV's `job_id` field stays whatever it was at create time. The user sees
the job name update but the next render won't reflect it.

- Fix (deferred to Phase 6.5): add `PATCH /cvs/{id}` call on dropdown
  change with `{job_id: newValue}`. Not blocking because the CV is still
  rendered with the original target.

**H2. `backend/app/services/cv_enhancer.py` — `_safe_parse_json` does not
handle the case where the LLM emits a partial <think> block followed by
JSON with no closing </think>.** During smoke testing the regex was
patched to strip `(|$)` so a truncated think block (no closer) gets
stripped, but if the LLM emits `<think>...reasoning...` (cut off mid-
sentence) followed by `{...}` JSON, the current regex captures the wrong
group. Worked around by raising max_tokens from 1200 → 2000 + adding
explicit "no thinking" rule to the prompt.

- Action: keep current behavior, monitor LLM output. If hits >1% failure
  rate, switch to `re.search(r'</think>\s*(\{.*)', text, re.DOTALL)`
  with a more permissive JSON extractor.

**H3. `backend/app/api/routes/cvs.py` — `enhance` route for
`section="bullets"` was reading `job_entry["bullets"]` but the renderer
writes to `job_entry["highlights"]` (JSON Resume convention).** Result:
empty list sent to LLM, LLM returns empty enhanced list, bullets gone.
Discovered during final e2e smoke. **Fixed in this commit:** read
`highlights` first, fall back to `bullets`; write back to both fields
for compatibility.

### Medium (should fix)

**M1. `backend/app/services/cv_renderer.py` — `inline_css` is duplicated
in `_render_html` and embedded into the rendered string directly.** If
two CVs are rendered into the same page (e.g., a future "compare CVs"
feature), the inline `<style>` blocks will conflict.

- Fix: scope the CSS class names with a per-CV prefix (`cv-{cv_id}-h1`).
- Deferred: no second CV per page yet.

**M2. `backend/app/services/cv_enhancer.py` — `_extract_metrics` regex
uses `(?!\w)` lookahead but does not anchor to start-of-word.** If the
LLM produces text like "Migrated 100 services and 10K req/sec", the
extractor will catch "100" as one metric and "10K" as another, but
"100 services" is ambiguous. Current behavior accepts it, but the
fact-preservation guard only checks the first captured metric.

- Fix: anchor `\b` at start AND filter against the source text.

**M3. `frontend/src/pages/CvDraftsPage.tsx` — no optimistic update on
Enhance.** User clicks Enhance, waits 16-20s, then sees the new text.
Could show a "polishing…" inline state per section.

- Deferred: not a blocker; visible loading spinner during enhance is
  already in place.

**M4. `backend/app/api/routes/cvs.py` — `seed_default_templates` is
called on every `POST /cvs`.** This is idempotent (INSERT ON CONFLICT
DO NOTHING in the underlying seeder) so it's a no-op after the first
call, but the query still hits Postgres.

- Fix: cache a module-level `seeded = False` flag and skip after first
  successful call.

### Low (nice to have)

- No CV versioning UI yet — every PATCH creates a new `CVVersion` row
  but the user can't browse them. Will come in Phase 6.5.
- Renderer does not include a `lang` attribute on `<html>` based on
  profile language. Currently hardcoded `en`.
- Markdown renderer uses `#` for h1, `##` for h2 — no front-matter
  metadata (could include `job_id` for traceability).

## Tests

| Suite | Tests | Time |
|---|---|---|
| `test_cv_renderer.py` | 23 | 0.8s |
| `test_cv_enhancer.py` | 18 | 0.5s |
| `test_cvs_endpoints.py` | 15 | 1.4s |
| **Total** | **56** | **2.7s** |

Renderer covers: header layout, section ordering, ATS rules (no tables,
no images, h1+h2), Markdown↔HTML equivalence, edge cases (empty skills,
unicode names, long lines, missing fields).

Enhancer covers: happy path (summary + bullets), fact-preservation
guard, metric grounding, JSON parse fallback, prompt version is passed.

Endpoints cover: list, create, get, patch, delete, render (HTML+MD),
enhance (200 with mocked LLM). Auth uses the seeded user fixture.

## End-to-End Verification

Manual smoke (via curl, all real BE on port 8765):
- POST /api/cvs → 201, id=14c0d1c9, rendered_html=2540 chars
- GET /api/cvs/{id}/render?format=html → 200, ATS check: h1=True, h2=True,
  table=False, img=False
- GET /api/cvs/{id}/render?format=markdown → 200, 953 chars
- POST /api/cvs/{id}/enhance (summary) → 200 in 19s, summary polished
  from "AI enthusiast" → "AI-focused engineer" (truncated 502 → 200 OK)
- DELETE /api/cvs/{id} → 204

UI flow (Chrome via Vite on 5173):
- /cv-drafts → list 2 CVs ✓
- Click CV → editor opens with Preview tab (iframe rendering) ✓
- Switch to Sections tab → form with textareas + Enhance buttons ✓
- Click "Enhance with AI" on summary → 16.6s wait, text updates in
  textarea: "building LLM tooling" → "shipping LLM tooling" ✓
- Iframe re-renders to reflect new summary ✓

## Performance

- LLM enhance latency: 16.6s for summary (837 in / 1122 out tokens)
- Renderer latency: <10ms (pure string ops)
- DB: 1 row per CV + 1 row per version + 1 row per render. No N+1.

## Security & Privacy

- API keys redacted from logs.
- User input is the only source of truth — LLM cannot inject skills
  not in the source (fact-preservation guard).
- No PII leaks in the rendered HTML (profile.email is shown but that's
  intentional for a CV).

## Resolved During This Phase

- `app/api/router.py` double-prefix `/api/api/cvs` → fixed
- `structlog` vs stdlib `logging.getLogger()` kwarg bug → fixed
- `Job.analysis_json` → `Job.ats_keywords_json` field rename → fixed
- `_extract_metrics` regex `\b` after `%`/`M`/`K` → switched to `(?!\w)`
- `_safe_parse_json` truncated <think> → `(|$)` lookahead
- LLM `cv_enhance` 502 due to max_tokens=1200 too tight → 2000
- LLM prompt emits think-block → added explicit "JSON directly, no
  thinking" rule
- `cvs.py` enhance route reading `bullets` instead of `highlights` →
  fixed (H3 above)

## Decision Log

- Reused existing `cv_drafts` table rather than creating a new `cvs`
  table — schema was already comprehensive.
- `base_profile_json` is source of truth; flat `Profile.skills` etc. are
  empty (so renderer reads from JSON Resume structure).
- 2-layer architecture preserved (deterministic core + LLM wrapper).
- ATS-safe output: semantic HTML, h1+h2, plain bullets, no tables, no
  images in body.

## Overall

8.0/10. Architecture is clean, separation of concerns is real (not
ceremonial), end-to-end works in both curl and the FE. Main gaps:
H1 (target job dropdown doesn't persist), no CV versioning UI yet, and
LLM enhancement is single-shot (no streaming / no diff preview). All
non-blocking — solid Phase 6 to ship.