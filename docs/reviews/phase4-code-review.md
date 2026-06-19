
==============================================================
CODE REVIEW — Phase 4 (BE job scraping + JD analysis + FE)
Project: cv-ats-builder @ /home/kumaha-sia/projects/cv-ats-builder
Reviewer: solo (worker delegate timed out at 600s)
Score:    7.5/10 (BE solid 8/10; FE 7/10; cross-cutting bugs)
==============================================================

VERIFIED FACTS:
- 105/105 tests pass in 108s (real Playwright e2e via system google-chrome)
- 2 real FE commits: 0fb2eb3 (code), 4f5ab65 (tests)
- 6 BE commits for Phase 4: 1f878fd, 3708807, 8191b72, ef4dda3, cf37958, 3359b6b
- DB migration applied: jobs.parsed_at + deleted_at columns
- BE/FE running, integration via Vite proxy /api → 127.0.0.1:8765
- Visually verified JobDetailPage via vision_analyze — clean layout

==============================================================
BUGS (ranked by severity)
==============================================================

──────────────────────────────────────
[CRITICAL] B1 — FE URL tab POST returns 422 (raw_description required)
──────────────────────────────────────
File:  frontend/src/components/jobs/PasteZone.tsx:42-45
Schema: backend/app/schemas/schemas.py:146

Schema:
  class JobIn(BaseModel):
      source_type: Literal["url", "manual"]
      source_url: str | None = None
      raw_description: str          ← REQUIRED

FE URL tab payload:
  { source_type: 'url', source_url: url.trim() }   ← NO raw_description

POST /api/jobs → 422 Unprocessable Entity.

Confirmed via curl:
  POST /api/jobs {"source_type":"url","source_url":"https://example.com/job"}
  → 422

Manual tab works because it sends raw_description. URL tab is fully broken.

FIX (one of):
1. FE: add `raw_description: ""` to URL payload in PasteZone.tsx
2. Schema: change to `raw_description: str | None = None` (more correct —
   URL scrape path doesn't have a JD until scrape completes)
3. Schema: change to `raw_description: str = ""` (default empty)

Recommend #2 (URL path semantically has no JD before scrape).

──────────────────────────────────────
[CRITICAL] B2 — SSRF: scraper accepts private/loopback IPs
──────────────────────────────────────
File: backend/app/services/job_scraper.py:118-130 (_normalize_url)

Verified: POST {source_url: "http://127.0.0.1:8765/api/health"} →
scraper fetched it (status='scraping' → 'failed' due to small content,
but the request went through).

Risk: User can probe internal services via the scraper:
- http://127.0.0.1, http://localhost, http://[::1]
- http://169.254.169.254 (AWS instance metadata!)
- http://192.168.x.x, http://10.x.x.x (LAN)

For personal single-user app risk is low. For any future deployment to
a shared environment, this is a real SSRF vector.

FIX: after _normalize_url, resolve the hostname and check that the IP
is NOT in private/loopback/link-local ranges. Reject if private.
Use `socket.getaddrinfo()` to resolve, then check `ipaddress.ip_address`
in `ipaddress.ip_network()` ranges.

──────────────────────────────────────
[HIGH] B3 — No URL idempotency: duplicate POST creates duplicate jobs
──────────────────────────────────────
File: backend/app/api/routes/jobs.py:127-147

Confirmed: POST same URL twice → 2 separate jobs created.
For personal app acceptable, but worth a dedup check on
(source_url, user_id, deleted_at IS NULL) before insert.

Or: silently update existing job (re-scrape + re-analyze).
Or: return 409 Conflict with the existing job_id.

For now: just enforce uniqueness with a partial UNIQUE index on
(source_url) WHERE deleted_at IS NULL — DB-level guard.

──────────────────────────────────────
[HIGH] B4 — raw_description always returned in list_jobs (perf)
──────────────────────────────────────
File: backend/app/api/routes/jobs.py:155-171 (list_jobs)

JobOut extends JobIn which includes raw_description: str. List endpoint
returns full JobOut for all jobs, including raw_description up to
50K chars each. For 50 jobs that's 2.5MB JSON payload.

JobCard on JobsPage doesn't use raw_description at all — only title,
company, location, status, created_at.

FIX: Define `JobListItem` (subset without raw_description) and have
list_jobs return that. Single-job GET keeps full JobOut.

──────────────────────────────────────
[MEDIUM] B5 — Salary currency defaults to 'USD' silently in UI
──────────────────────────────────────
File: frontend/src/pages/JobDetailPage.tsx:171

  const salaryCurrency = analysis?.salary?.currency ?? job.salary_currency ?? 'USD';

When the JD doesn't mention salary (most Indonesian postings), UI
shows "USD 25,000,000+" which is meaningless and confusing.

FIX: if no currency is known, don't render the salary card at all.
Or render "Salary not stated" instead of a fake USD number.

──────────────────────────────────────
[MEDIUM] B6 — PasteZone calls onError('') before submit, flashing empty toast
──────────────────────────────────────
File: frontend/src/components/jobs/PasteZone.tsx:37

  onError('');   ← resets toast to empty error

JobsPage line 162 maps this to setToast({ type: 'error', msg: '' })
which shows an empty red banner for 4s.

FIX: Don't pre-call onError('') on submit start. Only call it in the
catch block. Or rename the prop to `onToast(type, msg)` so empty
is a no-op.

──────────────────────────────────────
[MEDIUM] B7 — test_jobs_routes.py missing tests for critical paths
──────────────────────────────────────
File: backend/tests/test_jobs_routes.py (8 tests, gaps below)

Missing test coverage:
1. POST URL with NO raw_description → currently 422 (B1), needs test
   to lock the contract
2. POST same URL twice → dedup behavior (B3)
3. GET job_analysis_json schema round-trip after analyze
4. POST source_type neither url nor manual → 422
5. URL with private IP → should reject after SSRF fix (B2)
6. Soft-deleted job does NOT appear in list_jobs
7. User A cannot GET user B's job (cross-tenant) — currently
   get_or_create_default_user makes this not testable, but mark it
8. analyze_jd with empty raw_description → status='failed'
9. LLM returns invalid JSON → status='failed' (not stuck 'parsing')
10. LLM returns non-dict → status='failed'

Currently 8 tests cover the happy path. Recommend doubling to ~16.

──────────────────────────────────────
[MEDIUM] B8 — JobDetailPage polling uses stale state — analysis can go stale
──────────────────────────────────────
File: frontend/src/pages/JobDetailPage.tsx:104-112

  useEffect(() => {
    if (!job) return;
    const isAnalyzing = job.status === 'scraping' || 'parsing' | 'pending';
    if (!isAnalyzing) return;
    const t = setInterval(() => fetchJob(true), 3000);
    return () => clearInterval(t);
  }, [job, fetchJob]);

On each `job` change the effect re-runs. `fetchJob` is in deps — every
fetchJob(true) updates job → effect re-runs → clearInterval + setInterval
churn every 3s. Functional but wasteful. Add a ref-based latch:
only re-arm when status transitions from non-loading → loading.

Same pattern in JobsPage line 41-63. Both pages share the same churn.

FIX: use useRef to remember previous isAnalyzing state; only
re-arm interval when it transitions true. This is the same
Strict-Mode-safe pattern as the profile polling fix.

──────────────────────────────────────
[LOW] B9 — analyze_jd sets error_message = None on success without logging
──────────────────────────────────────
File: backend/app/services/jd_analyzer.py:167

  job.error_message = None
  job.parsed_at = datetime.now(timezone.utc)

If a previous analyze run failed, then a retry succeeds, the old
error_message gets silently cleared. Not a bug per se, but worth
noting: there's no audit trail of "this job was retried and succeeded".

FIX (optional): log to job_history table or increment
job.retry_count column. Skip for now unless audit is required.

──────────────────────────────────────
[LOW] B10 — _safe_scrape_and_analyze has triple-nested try/except for scrape
──────────────────────────────────────
File: backend/app/api/routes/jobs.py:71-89

  except (InvalidURLError, FetchError, ContentTooLargeError, EmptyContentError) as e:
      job.status = "failed"
      job.error_message = f"scrape_failed: {e}"[:1000]
      db.commit()
      log.error(...)
      return
  except Exception as e:
      job.status = "failed"
      job.error_message = f"scrape_unexpected: {e}"[:1000]
      ...

The two except blocks do essentially the same thing with a different
prefix on the error_message. Could collapse to a single except that
includes the exception class name in the message.

──────────────────────────────────────
[LOW] B11 — extractor_used not persisted
──────────────────────────────────────
File: backend/app/services/job_scraper.py:91, 342

ScrapeResult.extractor_used tells us which tier won (selectolax vs
trafilatura vs beautifulsoup). Useful for debugging extraction
quality, but discarded. Job model has no column for it.

FIX (optional): add scraper_extractor VARCHAR(20) column + write it
in _safe_scrape_and_analyze after successful scrape.

──────────────────────────────────────
[LOW] B12 — Form double-submit: PasteZone submit button can fire twice
──────────────────────────────────────
File: frontend/src/components/jobs/PasteZone.tsx:32-65

`disabled={!isValid || submitting}` guards against double-click. OK
in practice, but if a user hits Enter twice quickly while submitting,
the second submit will see submitting=true and bail. Edge case, not
real bug.

──────────────────────────────────────
[LOW] B13 — _safe_scrape_and_analyze uses asyncio.run() in sync wrapper
──────────────────────────────────────
File: backend/app/api/routes/jobs.py:93-94

  import asyncio
  asyncio.run(analyze_jd(job_id, db))

This works but is awkward. Since BackgroundTasks runs in a threadpool
worker, `asyncio.run()` creates a new event loop in the worker thread.
Locks held across the await boundaries could potentially conflict with
another task on the main event loop — but here analyze_jd doesn't
share state with anything else, so it's fine.

FIX (optional): make _safe_scrape_and_analyze itself async and use
FastAPI's async-aware background task. Or use anyio.to_thread.run_sync
for the synchronous scrape_job call inside the analyze function.

==============================================================
POLISH (lower priority)
==============================================================

P1. JobCard has no accessibility attributes (aria-label, role).
     Add aria-label to delete button: "Delete job posting {title}"

P2. JobDetailPage CopyButton uses navigator.clipboard without
     checking API availability — silently fails on http/insecure
     contexts or older browsers. Add try/catch around writeText.

P3. The "Job Matching" sidebar item still says "Coming soon" copy in
     some places — verify all sidebar references are updated.

P4. JD truncation (line 322 of job_scraper.py) slices at 50,000 chars
     mid-word. Should slice at a paragraph boundary when possible.

P5. Job status `pending` is in the type union but no code path sets
     it (ORM default only). Either remove from union or actually use
     it as an initial state.

P6. analyze_jd LLM call has no retry — if the LLM returns a transient
     error (network blip, rate limit), it goes straight to status='failed'.
     Consider 1-2 retries with exponential backoff.

P7. _log_call in LLMClient stores the full prompt text in llm_call_log.
     For long JDs this could blow up the DB. Consider truncating
     prompt to 1K chars in the log.

P8. JobsPage toast positioning: when toast appears + add-form is open,
     the layout shifts slightly. Consider absolute positioning for toast.

==============================================================
WHAT'S GOOD (worth keeping)
==============================================================

✓ Tiered extractor fallback chain (selectolax → trafilatura → beautifulsoup)
✓ Streaming fetch with size cap (prevents OOM on huge responses)
✓ Tracking param stripping (utm_*, fbclid, etc.)
✓ Prompt anti-injection defense (treat JD as data, not instructions)
✓ Soft delete via deleted_at timestamp (audit trail preserved)
✓ Confidence scoring is honest (denominator = sections the prompt promises)
✓ Stage-gated status (scraping → parsing → parsed / failed)
✓ Prompt version stamping (PROMPT_VERSION = "v1")
✓ _safe_scrape_and_analyze swallows exceptions into the row (no 5xx)
✓ FE inline edit (paste-zone, no modal — simpler UX)
✓ FE polling pattern with cleanup (intervals cleared on unmount)
✓ Test uses system google-chrome (no extra browser install)
✓ e2e tests idempotent (skip if servers not up)
✓ Polling interval cleanup pattern matches Phase 2 fix (no leak)

==============================================================
RECOMMENDED FIX ORDER (bang-for-buck)
==============================================================

1. B1 (CRITICAL): Fix raw_description required in URL path
   - 1-line FE fix OR 1-line schema fix
   - 5 min
   - Without this, the URL feature is dead in the UI

2. B5 (MEDIUM): Salary currency default
   - 5 min
   - User-facing confusion

3. B6 (MEDIUM): Empty toast flash
   - 2 min
   - Annoying UX glitch

4. B7 (MEDIUM): Test coverage
   - 30 min
   - Locks the contract; prevents regression of B1/B2/B3

5. B8 (MEDIUM): Polling churn
   - 15 min
   - Already established pattern from Phase 2; copy it

6. B4 (HIGH): raw_description in list_jobs payload
   - 15 min (add JobListItem schema + switch list_jobs)
   - Real perf improvement at scale

7. B2 (CRITICAL): SSRF guard
   - 30 min (resolve + IP check)
   - Personal app low risk, but worth doing before any deployment

8. B3 (HIGH): URL dedup
   - 15 min (DB unique index)
   - Acceptable to defer until user feedback

9. Everything else (LOW + Polish): batch into next polish round
