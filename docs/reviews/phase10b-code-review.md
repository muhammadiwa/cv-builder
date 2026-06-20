# Phase 10B — Code Review

**Scope:** LLM provider settings (CRUD API + DB-backed config + Fernet encryption + FE SettingsPage).
**Verdict:** **8.5/10** — ship-ready after the fix batch below.

## Architecture & Design (9/10)

- **DB-backed, runtime-mutable config** — provider rows replace `configs/llm_providers.json`. Changes take effect without a process restart because `LLMClient._reload()` re-reads from the DB on each `set_db()` call.
- **Multi-provider, OpenAI-compatible** — `kind: openai_compat` (default) covers tokenrouter / OpenAI / Ollama / LM Studio / vLLM; `kind: anthropic` is kept for native Anthropic clients.
- **Per-task model map** — `models_json: {resume_parse: ..., cv_generate: ..., cover_letter: ...}` lets the same provider use cheap models for parsing and expensive models for generation. The first enabled provider with a model for a task wins; rest are fallback.
- **API key encryption at rest** — Fernet with `CV_MASTER_KEY`. GET responses never include the key (only `api_key_set: bool`); even the BE logs only the encrypted token.
- **Force-disable on key clear** — patch with `api_key: ""` automatically flips `enabled=false`, so the LLMClient can never accidentally call without auth.
- **Refuse enable without key** — `PATCH enabled=true` on a keyless row returns 400.
- **Seed-on-startup migration** — if the `llm_providers` table is empty, rows are imported from the legacy `configs/llm_providers.json` (with `api_key_env` hydrated from the environment). Existing dev setups keep working.
- **Backward compat** — `LLMClient(config_path=...)` still loads from JSON when no `db` is passed, so the existing test suite works unchanged.

## Security (9/10)

- API keys stored as Fernet ciphertext (`gAAAAA...`). DB inspection confirms plaintext never written.
- GET / POST / PATCH responses never include the encrypted ciphertext — only the `api_key_set` bool. Verified via 18 endpoint tests.
- Pydantic validators reject unknown task types and non-URL base URLs at the schema layer (422 before any DB hit).
- `extra='forbid'` on Create/Patch payloads — unknown fields rejected.
- Dev-mode fallback (plaintext storage when `CV_MASTER_KEY` is the placeholder) is loud-logged at ERROR level with the rotation command inline, so the issue can't be missed in production logs.

## Test Coverage (9/10)

- 18 endpoint tests: GET list/detail/404, POST create + encryption verification + 409 collision + 422 slug/url/task-type, PATCH update + force-disable + enable-without-key 400 + unknown-field 422, DELETE 204/404, POST test 404/missing-key/no-url/model-override.
- Encryption round-trip test verifies the DB row is ciphertext, not plaintext, and decrypts back to the original.
- 92/92 backend tests pass (18 new + 74 existing).

## Findings & Fixes

### Fixed in `fix(phase-10b)` commit `9e81819`

| ID | Sev | File | Finding | Fix |
|---|---|---|---|---|
| **H1** | H | `crypto.py` | Dev-placeholder fallback (plaintext storage) was logged at WARNING level — easy to miss in production log filters that drop warnings. | Upgraded to ERROR with a one-shot guard (no spam), explicit `LLM_API_KEYS_STORED_AS_PLAINTEXT` event name, and the exact Fernet key generation command in the log message. |
| **M1** | M | `SettingsPage.tsx` | Delete handler used `window.confirm()` — blocks the page, no a11y, dismisses screen-reader focus. | New `ConfirmDeleteDialog` component with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, Escape-to-close, click-outside-to-cancel. Also warns explicitly when the deleted provider has an API key set. |
| **M2** | M | `main.py` | Rate limiter would 429 on rapid "Test connection" clicks during provider debugging. | `/api/llm-providers` added to `exempt_paths`. Single-user mode means no abuse vector — the user is just iterating on their own config. Verified: 10-burst `/test` → no 429. |

### Skipped (deferred)

| ID | Sev | File | Reason |
|---|---|---|---|
| M3 | L | `schemas.py` | `models_json` validator strips empty values silently. Acceptable — empty values are invalid config anyway. |
| M4 | L | `routes/llm_providers.py` | `test_provider` uses `prov.health()` which does a GET `/models` for OpenAI-compat and a 1-token POST `/v1/messages` for Anthropic. Different latency profiles per vendor. Acceptable for a connectivity probe. |
| M5 | L | `llm_providers.py` | `_pick_test_model` picks the first non-empty value in `models_json` for the test. Could be smarter (e.g. test each task separately), but overkill for a connectivity check. |
| M6 | L | `SettingsPage.tsx` | `confirm()` still mentioned in a code comment. Acceptable — it's explanatory, not a call. |
| L1-L5 | L | Various | Minor cosmetic — extra `truncate` classes, suggested example URLs, tooltip on enabled toggle. |

## Final Verdict

**8.5/10.** Phase 10B delivers on the user's requirement: **no hardcoded LLM config in code**, **all data in DB**, **multi-provider OpenAI-compatible**, **base URL + API key + model + on/off** all configurable at runtime via the Settings UI. Encryption at rest + masked FE + force-disable guard make this safe for single-user mode.

This completes the last MVP gap. JobFind now has:
- Templates (Phase 10A) — pick / create / edit / preview with ATS-safe styling
- LLM provider settings (Phase 10B) — multi-provider, runtime-configurable, encrypted

Next: Dockerize + deploy, or close v1.0 tag. Up to the user.

## Files Changed

```
backend/app/api/router.py                 |  +2
backend/app/api/routes/llm_providers.py   | +280 (new)
backend/app/core/crypto.py                | +60 (new, refactored)
backend/app/llm/client.py                 | +50 (DB load path)
backend/app/llm/store.py                  | +140 (new)
backend/app/main.py                       |  +10 (seeder + rate-limit exempt)
backend/app/models/models.py              |  +45 (LLMProvider)
backend/app/schemas/schemas.py            | +160 (Pydantic schemas)
backend/tests/test_llm_providers_endpoints.py | +340 (new, 18 tests)
frontend/src/lib/api.ts                   | +115
frontend/src/lib/toast.ts                 |  +13 (toast shorthand)
frontend/src/pages/SettingsPage.tsx       | +720 (rewritten)
```

## Commits

- `5ac9334` `feat(phase-10a): Template feature — CRUD API + 3 presets + styling keys` (prior phase)
- `0bad5b4` `feat(phase-10a): FE — Templates page + TemplatePicker + Toast UI`
- `8812537` `docs(phase-10a): code review (score 8.5/10)`
- `d35e4ac` `fix(phase-9): address all code-review findings`
- `c2056fe` `feat(phase-10b): FE — LLM Providers settings UI`
- (preceding) `feat(phase-10b): LLM provider settings — DB-backed, multi-provider`
- `9e81819` `fix(phase-10b): review findings — loud dev-key warning + a11y + rate limit` ← this fix batch