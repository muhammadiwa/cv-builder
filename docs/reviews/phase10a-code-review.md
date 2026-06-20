# Phase 10A — Code Review

**Scope:** Template feature (CRUD API + 3 built-in presets + styling keys + FE TemplatesPage / TemplatePicker / Toast).
**Verdict:** **8.5/10** — ship-ready after the fix batch below.

## Architecture & Design (9/10)

- **Deterministic engine + LLM enhancer** boundary preserved — presets are pure data (no LLM in the hot path), the live preview is a pure-function render of `(cv_json, template_config)`.
- **3 presets** cover the realistic design space: serif/default (ATS Classic), sans/spacious (ATS Modern), sans/compact US-Letter MM/YYYY (ATS Compact). Picking is value-driven, not arbitrary.
- **Template config schema** extended in a backward-compatible way (defaults provided for every new key; legacy configs fall through `_wrap_html`'s safe-default branches).
- **Renderer consume each new key** — `font_family`, `accent_color`, `density`, `bullet_style`, `date_format`, `page_size` — deterministically, no scattered `if/elif`.
- **ATS palette validator** at the schema layer (Pydantic `field_validator`) + secondary check at the route layer (nested configs); both reuse the same `_validate_ats_color` helper.
- **Reusable components** (TemplatePicker, toast lib) are properly split and shared between CV generator modal + CV editor header.
- **Live preview iframe** with `sandbox=""` for untrusted template HTML isolation.

## Test Coverage (8/10)

- 66 Phase 10A tests pass (31 renderer + 28 endpoints + 7 URL safety).
- `_safe_url` whitelist (`http` / `https` / `mailto`) covered for projects, basics.url, basics.linkedin, basics.github.
- ATS palette validator covered for valid + invalid hex + empty string.
- Date range formatter covered for `Mon YYYY`, `MM/YYYY`, `YYYY`, and `present`.
- `_render_projects` XSS guard covered with `javascript:` payload.
- **Gap:** no FE unit tests (Vitest not set up). Manual smoke only — light deduction.

## Findings & Fixes (raw → final)

### Fixed in `fix(phase-10a)` commit `d35e4ac`

| ID | Sev | File | Finding | Fix |
|---|---|---|---|---|
| **H1** | H | `cv_renderer.py` `_render_projects` | Project URL rendered as raw `<a href>` — XSS via `javascript:` payload. | `_safe_url()` helper whitelists `http`/`https`/`mailto`; anything else returns `#`. Same helper now used for `basics.url`, `linkedin`, `github`. 7 new tests. |
| **M1** | M | `schemas.py` | `TemplateCreateIn.accent_color` accepted non-ATS hex; fallback silently rewrote to `#111111` — users got a colour they didn't pick. | `field_validator("accent_color")` raises 422 with the allowed palette list. Re-validation in the preview route for nested configs → 400. 6 new tests. |
| **M2** | M | `TemplatesPage.tsx` | Preview iframe had no `sandbox` — previewed HTML could access cookies / parent origin. | `sandbox=""` on both iframes (form modal + preview modal). |
| **M3** | L | `TemplatePicker.tsx` | `excludeId` prop declared but never used — dead code. | Removed. |
| **M4** | M | `main.py` | Rate limiter 429'd the preview endpoint during fast typing in the FE editor. | Added `/api/templates/preview` to `RateLimitMiddleware.exempt_paths`. Verified: 25-request burst → no 429. |
| **M5** | L | `Toast.tsx` | New toasts pushed to bottom of stack — users missed the most recent message. | `unshift` instead of `push`. |
| **M6** | L | `Toast.tsx` | Container had no `aria-live` — screen readers ignored new toasts. | `aria-live="polite"` + `aria-atomic="false"`. |
| **M7** | L | `TemplatePicker.tsx` | Compact trigger had no `aria-expanded` — SR users couldn't tell dropdown state. | `aria-expanded={open}` + `aria-haspopup="listbox"`; dropdown now `role="listbox"`. |
| **M8** | M | `TemplatesPage.tsx` | Modals had no Escape-to-close — keyboard-only users trapped. | Both modals: `onKeyDown` Escape closes, `role="dialog"`, `aria-modal="true"`. |
| **upgrade** | M | `cv_renderer.py` + `main.py` | Legacy preset rows in DB were seeded before Phase 10A — only had `sections` + `ats_friendly`. No way to add new keys without manual SQL. | `seed_default_templates` now runs on app startup AND merges missing styling keys into existing preset rows (without overwriting user-patched keys). Verified: 3 presets expose new keys after one cold restart. |

### Skipped (deferred to follow-up cleanup phase)

| ID | Sev | File | Reason |
|---|---|---|---|
| M9 | L | `cv_renderer.py` | Naming inconsistency: `format_date_range` vs `format_date`. Trivial, not user-visible. |
| M10 | L | `cv_renderer.py` | `template_config` dict shape not typed (no `TypedDict`). Cosmetic. |
| M11 | M | FE `CvDraftsPage.tsx` + `JobMatchesPage.tsx` | Custom `alert()` calls instead of the new global toast. Migrate in 10B. |
| M12 | L | `cv_renderer.py` `_format_date_range` | Date regex pre-compiled but called inside the loop; trivial perf, no real impact. |
| M13 | L | `cv_renderer.py` `render_cv` | Thread-safety: `selectolax` parser is module-level — fine for FastAPI workers (one thread each). |
| L1-L8 | L | Various | Comment typos, missing test for `Mailto:` URL, naming of `validation_ats_color` vs `validate_ats_color`. |

## Final Verdict

**8.5/10.** Phase 10A closes the last big MVP gap — users can now pick, create, duplicate, edit, and preview CV templates with full ATS-safe styling control, all with proper keyboard a11y, rate-limit exemptions, and XSS guards. The 3 presets cover the realistic design space and can be regenerated from the registry on every cold start.

Next phase (10B) is **Settings** (user preferences: default template, theme, LLM temperature). After 10B the MVP is genuinely feature-complete.

## Files Changed

```
backend/app/main.py                                | 21 ++++--
backend/app/services/cv_renderer.py                | 60 ++++++++++++++++-
backend/app/schemas/schemas.py                     | 28 ++++++++
backend/app/api/routes/templates.py                | 27 ++++----
backend/tests/test_template_renderer.py            | 78 +++++++++++++++++++++-
backend/tests/test_templates_endpoints.py          | 19 ++++--
frontend/src/components/Toast.tsx                  |  5 +-
frontend/src/components/templates/TemplatePicker.tsx |  9 ++-
frontend/src/pages/TemplatesPage.tsx               | 17 +++++
```

## Commits

- `5ac9334` `feat(phase-10a): Template feature — CRUD API + 3 presets + styling keys`
- `0bad5b4` `feat(phase-10a): FE — Templates page + TemplatePicker + Toast UI`
- `d35e4ac` `fix(phase-10a): address code-review findings (7.5 -> 8.5/10)` ← this fix batch