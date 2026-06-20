# Phase 9 Code Review — 9A + 9B + 9C

**Score: 7.0/10** (commit baseline — fixes bring to ≥ 9.0)

**Commits reviewed:**
- `5920fe0` Phase 9C — Polish: rate limiter + WeasyPrint timeout
- `23c7353` Phase 9B — Application tracking (Kanban)
- `fdbd7a4` Phase 9A — Cover Letter generator (BE + FE)

**Reviewer:** Independent subagent delegated with the 17-pitfall
code-review-pitfalls checklist (substring match, neutral-0.5, dead API
methods, useEffect deps, list[dict] response, N+1, audit log, threshold
mismatch, slice-without-count, FE/BE contract, dedup-set-in-loop, axis
fallback, stale live data, route ordering, ORM check constraint migration,
phantom file_path, bare except Exception).

---

## HIGH (6 — pre-merge blockers)

### H1. FE/BE header contract mismatch on cover-letter export — **P10**
- **BE** `cover_letters.py:458` sets `X-Cover-Letter-Export-Id`
- **FE** `api.ts:719` reads `x-cv-export-id`
- **Impact:** every cover-letter export returns `exportId: ""` — silent
  failure on the FE side. Audit/history wiring is dead.
- **Fix:** Rename FE read to `x-cover-letter-export-id`.

### H2. FE reads nonexistent breakdown keys — **P10**
- **FE** `CoverLettersPage.tsx:388-389` reads
  `letter.score_breakdown_json?.matched_skills` / `?.missing_skills` at the
  top level.
- **BE** `cover_letter_generator.py:441-446` `to_breakdown()` only emits
  `{overall, axes, recommendations}`. Matched/missing live in
  `axes.keyword_coverage.matched/missing`.
- **Impact:** "X matched · Y missing" UI summary (lines 502-510) is
  always hidden.
- **Fix:** Either flatten matched/missing into the top of `to_breakdown`,
  or change FE to read from `axes.keyword_coverage`.

### H3. FE impact enum disagrees with BE — **P10**
- **FE** `api.ts:660` declares `impact: 'high' | 'med' | 'low'`
- **BE** `cover_letter_generator.py:591,603,614,624,633` emits `"medium"`
- **Impact:** chip color logic at CoverLettersPage.tsx:632-638
  (`r.impact === 'med'`) never fires for the most-emitted rec types.
- **Fix:** Standardize on `"medium"` everywhere (or update BE to
  `"med"`).

### H4. Filename sanitization gap in cover-letter export — **P16-adjacent**
- `cover_letters.py:429,502` builds `file_name` from `cl.subject` with
  only `replace('/', '-')` and a length cap.
- Compare to `cvs.py:681-686` (CV exporter) which uses an ASCII
  alnum/hyphen/underscore/space allowlist.
- **Impact:** Subjects containing `"`, `\`, or control chars produce
  malformed `Content-Disposition: attachment; filename="..."` headers.
- **Fix:** Reuse the CV exporter's safe-title helper, or hoist to a
  shared util.

### H5. `payload: dict[str, Any]` accepted on PATCH routes — **P10**
- `cover_letters.py:229` and `applications.py:142` accept raw
  `dict[str, Any]` instead of Pydantic models (`CoverLetterIn`,
  `ApplicationIn`).
- Manual validation only checks a few fields. E.g.
  `setattr(app, "status", value)` at `applications.py:169` lets any
  string persist as `status`, bypassing the `ApplicationStatus` Literal.
- **Fix:** Switch to `CoverLetterIn` / `ApplicationIn` Pydantic models.

### H6. Greedy substring keyword match in cover-letter scorer — **P1**
- `cover_letter_generator.py:477-478,525` uses
  `if k.lower() in text_lower` — matches `"python"` inside `"pythonic"`,
  `"data"` inside `"database"`, `"go"` inside `"google"`, etc.
- Same anti-pattern at line 161 (`_top_skill`) and line 417 (LLM
  fact-check).
- **Impact:** Over-matches inflate the ATS score on short cover letters.
- **Fix:** Tokenize text on `re.findall(r"\b\w+\b", text_lower)` once,
  then test `keyword in tokens`. Mirror the `cv_scorer` strategy.

---

## MED (8 — should fix)

### M1. Untyped response model on `/exports` — **P5**
- `cover_letters.py:540`: `response_model=list[dict]`.
- Compare to `cvs.py:724` which uses `list[ExportOut]`.
- **Fix:** Reuse `ExportOut` (already covers `entity_type='cover_letter'`
  in the schema) or define `CoverLetterExportOut`.

### M2. Bare `except Exception` swallows LLM failures — **P17**
- `cover_letter_generator.py:369` — fallback to deterministic on LLM
  error is intentional, but `except Exception` (with `# noqa: BLE001`)
  also catches `KeyboardInterrupt`, `SystemExit`, programming bugs.
- Same pattern at `cover_letters.py:143`, `:398`, `:417`.
- **Fix:** Narrow to `(LLMError, asyncio.TimeoutError,
  json.JSONDecodeError)`.

### M3. Bare `except Exception` for fallback — **P17**
- `cv_exporter.py:220` — broad `except` around lxml fallback hides real
  bugs (e.g. `ImportError` on a renamed lxml symbol).
- **Fix:** Narrow to `(lxml.etree.ParserError, lxml.etree.XMLSyntaxError)`.

### M4. Missing audit logs — **P7**
- `cover_letters.py:293` (rescore) and `:317` (delete) emit no
  `log.info` line. Every other mutating endpoint logs structured events.
- **Fix:** Add `log.info("cover_letter_rescored", cover_letter_id=cl.id)`
  and `log.info("cover_letter_deleted", cover_letter_id=cl.id)`.

### M6. Dead API client methods — **P3**
- `applicationsApi.get` (`api.ts:590`): never imported/called from
  `ApplicationsPage.tsx` — detail drawer uses `apps.find()` on
  already-loaded state.
- `coverLettersApi.listExports` (`api.ts:732`): no FE consumer. The
  export-history sidebar that the BE supports is not rendered anywhere.
- **Fix:** Either delete the unused methods, or wire them up. For
  `listExports`, add an export-history dropdown next to the PDF/DOCX
  buttons.

### M7. `CoverLetter.score` missing CHECK constraint + trigger — **P15**
- `CVDraft.score` has a `CheckConstraint("score >= 0 AND score <= 1")`
  (Phase 7.5) and migration triggers for legacy DBs.
- `CoverLetter.score` (Phase 9A) has neither. Phase 9A scoring is [0,1]
  by construction, but nothing enforces it.
- **Fix:** Add `__table_args__` CheckConstraint to `CoverLetter`, and add
  BEFORE INSERT/UPDATE triggers to
  `migrate_phase7_check_and_extractor.py`.

### M8. Rate limiter trusts unvalidated XFF — new finding
- `middleware.py:124-129` uses `X-Forwarded-For` first IP verbatim.
  Without a trusted-proxy allowlist, any client can spoof this header to
  bypass per-IP limits.
- **Fix:** Add `trusted_proxies: Iterable[str]` constructor arg; only
  honor XFF when `request.client.host` is in that set.

---

## LOW (9 — cosmetic / nice-to-have)

### L1. List truncated without "see all" count — **P9**
- `cover_letters.py:195` defaults to `limit=20`; FE
  `CoverLettersPage.tsx:240-242` shows "X cover letter(s)" but no
  indicator of truncation.
- **Fix:** Return total count alongside results; surface "(showing 20 of
  25)" in FE.

### L2. `TokenBucket.take` not atomic — race
- `middleware.py:42-51` — no lock. Under FastAPI async dispatch, two
  concurrent requests could both see `tokens >= 1` and both decrement.
- **Fix:** Add `threading.Lock()` (or note "not thread-safe").

### L3. Bucket fetched then mutated without re-fetch — race
- `middleware.py:96-97` — same root cause as L2.

### L4. `_gc_buckets` iterates while deleting
- `middleware.py:131-139` — `RuntimeError: dictionary changed size during
  iteration` if any other dispatch touches `self.buckets` during the
  loop.
- **Fix:** `self.buckets = {k: b for k, b in self.buckets.items() if
  b.tokens < b.burst * 0.95}` — atomic swap.

### L5. `_get_owned_cover_letter` does two DB round-trips
- `cover_letters.py:48-54` — `db.get(CoverLetter, ...)` then
  `db.get(Profile, ...)`. Single JOIN suffices.
- Same pattern at `applications.py:41-47`.
- **Fix:** JOIN-based ownership check.

### L6. Redundant profile/job fetch in `generate_cover_letter`
- `cover_letters.py:115-125` — two separate `db.get()` calls. Negligible
  perf; minor cleanliness.

### L7. `list_cover_letters` doesn't enforce `status` literal
- `cover_letters.py:206-208` — `?status=lol` returns `[]` instead of
  400. Add validation.

### L8. `_serialize_cover_letter` recomputes defensive copy
- `cover_letters.py:61-78` — `dict(cl.score_breakdown_json or {})`.
  Negligible perf, inconsistent with `cvs._serialize_draft`.

### L9. `CoverLetter.content` unbounded
- `cover_letters.py:269-270` — `str(payload["content"])` has no length
  cap. Bound to e.g. 20_000 chars.

---

## VERIFIED CLEAN (no issue)

- **P2** (neutral 0.5): correctly uses 0.0 (not 0.5) for no-keywords
  case (line 484). Honest-no-data rule applied.
- **P8** (per-axis thresholds): `SCORE_THRESHOLDS = {good: 0.7, ok: 0.5}`
  shared across CV + cover-letter scorers.
- **P11** (dedup set): `user_skills` set built once per call (line 411).
- **P12** (axis fallback): `axes` dict always contains all 4 keys even
  when `required_keywords` is empty (lines 548-573).
- **P13** (stale live data): `fetchList`/`fetchAll` refresh after
  mutations; detail `useEffect`s reset local state on selection change.
- **P14** (FastAPI route ordering): `/generate` literal declared before
  any `/{cover_letter_id}` catch-all. `applications.py` has no
  1-segment literal to conflict.
- **P16** (phantom file_path): `on-demand://...` sentinel is intentional
  and documented. `failed` sentinel at `on-demand://failed/{id}` follows
  the same pattern.
- **Phase 9C timeout**: SIGALRM-based timeout correctly scoped
  (main-thread only, POSIX only) with safe no-op fallback. Good design.
- **Phase 9C conftest autouse**: Correctly skipped for the middleware
  test module via `request.module.__name__.endswith("test_phase9c_polish")`.

---

## Recommended Fix Order (priority for fix-batch commit)

1. **H6** (substring match) — affects scoring correctness, broad blast
   radius. ~30 min.
2. **H2** (breakdown keys) — affects every cover letter render. ~10 min.
3. **H1** (header name) — single-line FE fix. ~5 min.
4. **H3** (impact enum) — pick one, sweep all. ~10 min.
5. **H5** (PATCH payload types) — affects 2 routes. ~15 min.
6. **H4** (filename sanitize) — extract helper, apply in 2 places. ~10 min.
7. **M1** (typed /exports response) — 1-line. ~5 min.
8. **M2 + M3** (narrow exceptions) — 4 sites. ~10 min.
9. **M4** (audit logs) — 2 sites. ~5 min.
10. **M6** (dead methods) — delete or wire. ~15 min for wire, 5 for
    delete.
11. **M7** (CHECK constraint + trigger) — schema + migration. ~20 min.
12. **M8** (XFF trust) — config arg. ~15 min.
13. **L1-L9** as time allows.

Target after fixes: **9.0/10**.