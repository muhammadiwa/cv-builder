# Phase 8 — Code Review (PDF Export Pipeline)

**Date:** 2026-06-20
**Scope:** Phase 8 only (commit `daa1055`, 7 files, +757/-7 lines)
**Reviewer:** Independent subagent (backend) + orchestrator manual pass (frontend)
**Pre-fix score:** **7.0 / 10**

---

## TL;DR

Phase 8 ships a working WeasyPrint-backed PDF export with proper ATS-safe
print CSS, ownership scoping, idempotent migration, and route-ordering
discipline that respects the Phase 7.5 `/recommendations` precedent.

The PDF itself is excellent:
- 12 KB, magic `%PDF-1.7` ✓
- `pypdf.extract_text()` returns full CV content ✓
- Long CV (80 bullets) → 2+ pages, all bullets preserved ✓
- Single-column enforced, no body images ✓
- 17 service-layer tests cover magic, size, multi-page, text-extract, edge cases

The bug list below is mostly audit-log lies, error-handling gaps, and
migration hardening. The export actually works end-to-end; what is broken
is the **metadata trail** and **failure surfaces**.

---

## Bugs (14 total: 0 CRITICAL · 4 HIGH · 6 MEDIUM · 4 LOW)

### High

| ID | File:Line | Symptom | Root Cause | Fix |
|---|---|---|---|---|
| **B1** | `app/api/routes/cvs.py:592` | `Export.file_path` points to `storage/cv_exports/{name}.pdf` but no file is ever written. Any redownload/audit query will ENOENT. | DB row records a path for a non-existent artifact. PDF is regenerated on demand. | Use a sentinel `on-demand://{export_id}` (audit tells the truth: virtual artifact, regenerated each time). Drop `file_path` column or repurpose as `output_name`. |
| **B2** | `app/api/routes/cvs.py:569` | If WeasyPrint raises (malformed HTML, missing font, OOM), user gets opaque 500 with NO audit row. Failures invisible in export-history sidebar. | `export_cv_to_pdf` is called without a try/except wrapper. | Wrap in try/except, log `cv_id` + `html_length` + error, return 500 with message. Optionally insert a `Export(file_type="pdf", error=...)` row so the sidebar shows the failure. |
| **B3** | `app/services/cv_exporter.py:145-149` | When `rendered_html` has no `</head>`, fallback produces `<html>...<body><body>...</body></body></html>` — nested `<body>`. WeasyPrint may silently drop content. | Fallback re-wraps input verbatim without stripping existing `<body>` if present. | Strip leading/trailing `<html>/<head>/<body>` wrappers before re-wrapping, or use `lxml.html.fragment_fromstring(html).body` to extract clean content. |
| **B4** | `scripts/migrate_phase7_check_and_extractor.py:57-76` | Migration creates CHECK triggers but never inspects existing rows. Any legacy CV/Version with `score` outside `[0,1]` will 500 the next PATCH. | Trigger DDL added unconditionally; no clamp `UPDATE` first. | Add pre-clamp: `UPDATE cv_drafts SET score=max(0.0,min(1.0,score)) WHERE score<0 OR score>1;` — same for `cv_versions`. Wrap whole migration in a transaction. |

### Medium

| ID | File:Line | Symptom | Root Cause | Fix |
|---|---|---|---|---|
| **B5** | `app/api/routes/cvs.py:428, 526-527` | Comment says literal routes "MUST be declared before `/{cv_id}`". But 2-segment routes (`/{cv_id}/export`) can't conflict with 1-segment catch-all. Misleading future contributor. | Comment copy-pasted from Phase 7.5 fix without rethinking the path-segment-count rule. | Rewrite: "literal routes with same segment count as `{cv_id}` must precede it; 2-segment paths are immune." |
| **B6** | `app/api/routes/cvs.py:430-431` | `GET /recommendations?limit=100000` returns 100k items. No `Query()` validation. | Bare `int` default. | `limit: int = Query(10, ge=1, le=100)`. |
| **B7** | `app/api/routes/cvs.py:534` | `format: str = Query('pdf', pattern='^(pdf)$')` validated but never used in body. Also shadows Python builtin. | Placeholder for future formats. | Either remove (Phase 8.5 will add `?format=docx`) or actually use it. Rename to `fmt`. |
| **B8** | `app/api/routes/cvs.py:155-156` | `_score_and_persist` comment claims `draft.job` is "already loaded", but `create_cv` loads job into a local variable — accessing `draft.job` triggers fresh lazy SELECT. Will raise `DetachedInstanceError` if called from Celery/background. | Comment is inaccurate; helper relies on implicit lazy loading. | Pass `job_analysis` as explicit param from the route, OR use `selectinload(CVDraft.job)` in the callers. |
| **B9** | `app/services/cv_exporter.py:188-194` | `pdf_metadata` swallows all exceptions with bare `except Exception`. Real pypdf bug becomes indistinguishable from "PDF has zero pages". | Overbroad except + `pragma: no cover`. | Catch `(ImportError, pypdf.errors.PdfReadError, ValueError)` explicitly, log at WARNING. |
| **B10** | `app/api/routes/cvs.py:586-594` | Export row's `file_size` is snapshot from export moment. If user edits + re-exports, old row claims old size at old phantom path. Audit-vs-truth drift. | `file_path` + `file_size` coupled to a phantom file. | Add `sha256`/`content_hash` column. Compute on bytes actually returned; gives audit trail something verifiable. |

### Low

| ID | File:Line | Symptom | Fix |
|---|---|---|---|
| **B11** | `app/api/routes/cvs.py:714-757` | When PATCH payload has both `cv_json` and `job_id`, `_score_and_persist` + `_save_version` called twice. Wasteful but correct. | Refactor to score + save-version once at end based on final draft state. |
| **B12** | `app/api/routes/cvs.py:531-562` | `export_cv` auto-renders if `rendered_html` is None and commits, but does NOT write a `CVVersion`. Inconsistent with every other mutating endpoint. | Either call `_save_version("auto-render on first export")` or document the exemption. |
| **B13** | `app/services/cv_exporter.py:188-192` | `BytesIO` not wrapped in context manager. GC handles it but adds churn in loop/background usage. | `with BytesIO(pdf_bytes) as buf:` or pass bytes directly to `PdfReader` (newer pypdf). |
| **B14** | `app/models/models.py:233-235, 251-253` | ORM `CheckConstraint` ignored by SQLite — triggers patch around it, but the constraint never exists on SQLite. Out-of-range scores can be SELECTed (just not INSERTed). | Add dialect comment explaining SQLite vs Postgres split. Clamp UPDATE in migration (paired with B4). |

---

## Polish (10 items)

- **P1** No integration tests for `/export` and `/exports` routes — only service is tested. Add: 201+PDF bytes, 404 unknown cv, 403 cross-user, row created, `GET /exports` returns it, invalid `format=pdfx` → 422.
- **P2** No rate limiting on POST `/export`. WeasyPrint is expensive. Add `slowapi` per-user limiter.
- **P3** `settings.cv_export_dir` is `Path('./storage/cv_exports')` — relative. CWD change = meaningless path. `.resolve()` or use a marker.
- **P4** `safe_title` uses `str.isalnum()` — accepts Unicode letters. Resulting filenames may have multi-byte chars. Restrict to ASCII.
- **P5** Migration creates `cover_letters_tmp` shadow table. Two cover-letter-ish tables is confusing. Add models.py comment explaining when to drop it (after FK re-pointed).
- **P6** POST `/export` has no timeout. WeasyPrint can hang on malformed CSS. Wrap in `asyncio.wait_for` or thread-pool timeout.
- **P7** `_score_and_persist` computes `score_breakdown_json` twice (once via `.to_breakdown()`, once via `result.to_breakdown()['axes']`). Cache in local var.
- **P8** Export response uses raw `Response(binary)`. Add separate `GET /api/cvs/{id}/exports/{export_id}/download` for cached/audit downloads.
- **P9** `format` param shadows Python builtin. Rename to `fmt` or `export_format`.
- **P10** Migration script doesn't verify post-conditions. Add smoke test: try inserting `score=2.0`, expect raise, ROLLBACK.

---

## Verified-correct (independently confirmed)

- ✅ **Ownership scoping** — both new routes check `draft.profile.user_id == user.id`.
- ✅ **Route ordering** — `/{cv_id}/export` and `/{cv_id}/exports` are 2-segment; can't conflict with 1-segment `/{cv_id}` catch-all. (Comment was wrong, code is right.)
- ✅ **ATS CSS structure** — semantic HTML, no layout tables, no body images, single-column, embedded fonts (`@page { font-family: ... }`).
- ✅ **Test coverage on service layer** — 17 tests cover magic header, size, text-extract, multi-page, error paths.
- ✅ **Migration is idempotent** — `IF NOT EXISTS` everywhere, `try/except` for re-runs.
- ✅ **332 BE tests pass + 1 skip** (intentional — default user already has profile).
- ✅ **FE is clean** — manual review of 360-line FE diff found no bugs. `exportPdf` and `listExports` are both called; `useEffect` deps are correct; Object URL revoke with `setTimeout(1000)` is the standard pattern.

---

## What the score means

**7.0/10** = "functional but ship-after-polish". The PDF export works
end-to-end; the bugs are around audit trail, error visibility, and
migration hardening. None block user success today, but they compound
across future phases (Phase 8.5 DOCX, Phase 9+).

A 9.0/10 would require: B1-B4 fixed, P1 integration tests added, P10
migration smoke test. The rest can move to a "polish next" backlog.

---

**Next:** Phase 8.5 — fix all HIGH + selected MEDIUM (B1, B2, B3, B4
+ P1 tests + B6 limit clamp + B7 format param cleanup).

---

## Phase 8.5 — Code-Review Fixes (2026-06-20)

**Approach:** Layer order (schema → services → routes → FE → tests),
not severity order. Severity-grouped batch summary:

### High (4/4 fixed)

| ID | Status | Resolution |
|---|---|---|
| B1 | ✅ fixed | `Export.file_path` now stores `on-demand://<export_id>/<filename>` sentinel instead of a fake disk path. Comment in `models.py` documents the contract. Live-verified: new rows show the sentinel. |
| B2 | ✅ fixed | `export_cv` wraps WeasyPrint in try/except, logs `cv_export_render_failed` at ERROR level, persists an `Export(file_type="failed")` row, returns 500 with a clear message. FE renders failed rows in red w/ "PDF generation failed" copy. |
| B3 | ✅ fixed | Fallback HTML path now uses `lxml.html.fragment_fromstring(create_parent=True)` to strip any pre-existing `<html>/<head>/<body>` wrappers before re-wrapping. Regression test verifies content survives. |
| B4 | ✅ fixed | Migration now `UPDATE cv_drafts/cv_versions SET score = MAX(0, MIN(1, score))` BEFORE creating CHECK triggers. Live-verified: 0 out-of-range scores, 4 triggers active. |

### Medium (6/6 fixed)

| ID | Status | Resolution |
|---|---|---|
| B5 | ✅ fixed | Both misleading route-ordering comments rewritten to explain the 1-segment vs 2-segment rule. 2-segment `/{cv_id}/export*` routes don't conflict with the 1-segment `/{cv_id}` catch-all. |
| B6 | ✅ fixed | `/recommendations?limit` now `Query(10, ge=1, le=100)`. Live-verified: 999 → 422 (max 100), 0 → 422 (min 1), 50 → 200. |
| B7 | ✅ fixed | `format` param renamed to `fmt` (stops shadowing Python builtin) AND now actually used: `fmt=pdf` works, `fmt=docx` returns 501, `fmt=txt` returns 422. URL alias `?format=...` kept for FE backward compat. |
| B8 | ✅ fixed | `_score_and_persist` now takes explicit `target_analysis: dict | None = None` param. Callers pass loaded analysis; falls back to guarded lazy load if not passed. DetachedInstanceError no longer crashes. |
| B9 | ✅ fixed | `pdf_metadata` narrow except: `(ImportError, ValueError, RuntimeError, AttributeError, pypdf.errors.PdfStreamError)`. Logs WARNING with error type + message on real failures. |
| B10 | ✅ fixed | Added `Export.sha256` column (VARCHAR(64), nullable). Route computes SHA-256 of returned bytes, persists it. FE shows first 8 chars. Live-verified: 64-hex string returned. |

### Low (4/4 fixed)

| ID | Status | Resolution |
|---|---|---|
| B11 | ✅ fixed | `patch_cv` rewritten to score + save_version ONCE at the end of the function. Previously called `_score_and_persist` twice and wrote two CVVersion rows when both `cv_json` and `job_id` were in the payload. Regression test verifies +1 not +2. |
| B12 | ✅ fixed | `export_cv` calls `_save_version("auto-render on first export")` when it auto-renders missing HTML. Now matches every other mutating endpoint. |
| B13 | ✅ fixed | `BytesIO` wrapped in `with` context manager. Smoke test verifies 5x successive calls work cleanly. |
| B14 | ✅ fixed | Updated comment on `CheckConstraint` to clarify SQLite vs Postgres split (SQLite uses triggers, Postgres uses real constraint). |

### Polish (3/10 fixed — rest deferred)

| ID | Status | Resolution |
|---|---|---|
| P1 | ✅ fixed | Added **8 integration tests** for `/export` + `/exports` + recommendation limit clamp + dual-patch. |
| P4 | ✅ fixed | `safe_title` now uses `c.isascii()` filter so filenames are ASCII-only (survives zip + filesystem edge cases). |
| P5 | ✅ fixed | Comment on `Export.cover_letter` relationship explains how to drop the `cover_letters_tmp` shadow table (3 steps). |
| P10 | ✅ fixed | Migration script now runs post-condition smoke test: insert `score=2.5`, expect raise, rollback. Also verifies `exports.sha256` column. |

**Deferred (Phase 9 candidates):**
- P2: Rate limiting on POST /export (expensive WeasyPrint)
- P3: `settings.cv_export_dir` should be `.resolve()`-ed
- P6: Timeout on WeasyPrint (could hang on malformed CSS)
- P7: Double score_breakdown_json compute in `_score_and_persist`
- P8: Separate `GET /exports/{export_id}/download` for cached downloads
- P9: `format` → `fmt` rename (handled in FE URL but param still named `format` for backward compat)

### Test delta

- **Before Phase 8.5:** 332 BE pass + 1 skip
- **After Phase 8.5:** **343 BE pass + 1 skip** (+11 tests)
  - 8 cvs endpoints integration tests (export happy path, sha256 persistence, 404, docx→501, invalid format→422, list order, recommendations clamp, dual-patch score-once)
  - 3 cv_exporter regression tests (B3 nested body, B9 corrupt PDF warning, B13 BytesIO context manager)

### Live verification transcript

```
POST /api/cvs/{id}/export         → 200, 11 KB, magic %PDF-1.7, headers X-Cv-Export-Id + X-Cv-Export-Size
GET  /api/cvs/{id}/exports        → 200, row.file_path=on-demand://<id>/Updated_CV_Title_v0db15ae4.pdf
                                     row.sha256=fc15d3c2866c55af75eb946a3618217d596287f81780753336f9b6eed4d1a529
POST /api/cvs/{id}/export?format=docx → 501 "export format 'docx' not implemented yet (Phase 8.5)"
POST /api/cvs/{id}/export?format=txt  → 422 pattern mismatch
GET  /api/cvs/recommendations?limit=999 → 422 (max=100)
GET  /api/cvs/recommendations?limit=0   → 422 (min=1)
GET  /api/cvs/recommendations?limit=50  → 200
PATCH /api/cvs/{id} {title, job_id}     → 200, CVVersion row count: +1 (was +2)
SQLite CHECK triggers active: 4 (insert + update × cv_drafts + cv_versions)
SQLite out-of-range scores: 0 (clamped)
exports.sha256 column: present
```

### Final score: **9.0/10** (was 7.0)

Remaining gaps are polish/operational (rate limiting, timeouts,
caching) that don't block user success. The export pipeline is
shippable: functional, safe, observable, auditable.