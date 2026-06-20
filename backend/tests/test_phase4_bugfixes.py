"""Phase 4 BE regression tests for code-review bug fixes.

Covers:
- B1: raw_description no longer required for source_type='url' (B1 fix)
- B2: SSRF guard rejects private/loopback/metadata IPs
- B3: duplicate URL returns 409 with existing_job_id
- B4: list_jobs response excludes raw_description (JobListItem)
- B5 (schema): empty raw_description defaults to None
- B7 (additional): soft-deleted jobs don't appear in list_jobs
- B7 (additional): invalid source_type returns 422
- B7 (additional): empty raw_description for manual returns 400
"""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from app.main import app
    return TestClient(app)


# ── B1: URL path no longer requires raw_description ─────────────────

def test_b1_url_no_raw_description_returns_201(client):
    """B1 fix: URL source_type must not require raw_description field."""
    r = client.post("/api/jobs", json={
        "source_type": "url",
        "source_url": "https://example.com/b1-test",
    })
    assert r.status_code == 201, f"got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert body["source_type"] == "url"
    assert body["status"] in ("scraping", "parsed", "failed")


def test_b1_manual_empty_raw_description_returns_400(client):
    """B1 still enforces: manual path requires non-empty raw_description."""
    r = client.post("/api/jobs", json={
        "source_type": "manual",
        "raw_description": "",
    })
    assert r.status_code == 400
    assert "raw_description" in r.json()["detail"].lower()


def test_b1_manual_whitespace_only_returns_400(client):
    """B1: whitespace-only raw_description is treated as empty."""
    r = client.post("/api/jobs", json={
        "source_type": "manual",
        "raw_description": "   \n\t  ",
    })
    assert r.status_code == 400


def test_b1_manual_valid_returns_201(client):
    """B1: manual with valid JD still works."""
    r = client.post("/api/jobs", json={
        "source_type": "manual",
        "raw_description": "We are hiring a senior engineer with Python and FastAPI.",
    })
    assert r.status_code == 201


def test_b1_invalid_source_type_returns_422(client):
    """B1 (defensive): unknown source_type must 422."""
    r = client.post("/api/jobs", json={
        "source_type": "telegram",
        "raw_description": "test",
    })
    assert r.status_code == 422


# ── B2: SSRF guard ──────────────────────────────────────────────────

def test_b2_url_127_0_0_1_rejected(client):
    """B2: loopback IP URL must be rejected at create time (after scrape fails)."""
    # We can't test the scrape path directly via the create endpoint without
    # async wait, so test the scraper service directly.
    from app.services.job_scraper import _normalize_url, SSRFBlockedError
    with pytest.raises(SSRFBlockedError):
        _normalize_url("http://127.0.0.1/admin")


def test_b2_url_localhost_rejected():
    """B2: localhost must be rejected (resolves to 127.0.0.1)."""
    from app.services.job_scraper import _normalize_url, SSRFBlockedError
    with pytest.raises(SSRFBlockedError):
        _normalize_url("http://localhost/admin")


def test_b2_url_aws_metadata_rejected():
    """B2: AWS instance metadata IP must be rejected."""
    from app.services.job_scraper import _normalize_url, SSRFBlockedError
    with pytest.raises(SSRFBlockedError):
        _normalize_url("http://169.254.169.254/latest/meta-data/")


def test_b2_url_private_ip_rejected():
    """B2: RFC1918 private IPs must be rejected."""
    from app.services.job_scraper import _normalize_url, SSRFBlockedError
    for url in [
        "http://10.0.0.1/x",
        "http://192.168.1.1/x",
        "http://172.16.0.1/x",
    ]:
        with pytest.raises(SSRFBlockedError):
            _normalize_url(url)


def test_b2_ip_classification_private_loopback():
    """B2: _is_private_ip covers all dangerous ranges."""
    from app.services.job_scraper import _is_private_ip
    private = [
        "127.0.0.1", "127.0.0.53",
        "10.0.0.1", "192.168.1.1", "172.16.0.1",
        "169.254.169.254",
        "::1", "fe80::1", "fc00::1",
        "224.0.0.1", "0.0.0.0",
    ]
    public = ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111"]
    for ip in private:
        assert _is_private_ip(ip), f"expected {ip} to be private"
    for ip in public:
        assert not _is_private_ip(ip), f"expected {ip} to be public"


# ── B3: URL dedup ────────────────────────────────────────────────────

def test_b3_duplicate_url_returns_409(client):
    """B3: posting the same URL twice returns 409 with existing_job_id."""
    # Use a freshly minted URL that hasn't been used
    url = "https://example.com/b3-dedup-test-unique"
    r1 = client.post("/api/jobs", json={"source_type": "url", "source_url": url})
    assert r1.status_code == 201
    first_id = r1.json()["id"]

    # Second submit of same URL must 409
    r2 = client.post("/api/jobs", json={"source_type": "url", "source_url": url})
    assert r2.status_code == 409, f"got {r2.status_code}: {r2.text[:200]}"
    detail = r2.json()["detail"]
    assert isinstance(detail, dict)
    assert detail["error"] == "duplicate_job"
    assert detail["existing_job_id"] == first_id


def test_b3_manual_jobs_not_deduped(client):
    """B3: manual jobs have no source_url so dedup doesn't apply."""
    jd = "We are hiring a senior engineer with Python."
    r1 = client.post("/api/jobs", json={"source_type": "manual", "raw_description": jd})
    r2 = client.post("/api/jobs", json={"source_type": "manual", "raw_description": jd})
    # Both should succeed (no dedup for manual)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] != r2.json()["id"]


def test_b3_soft_deleted_url_can_be_resubmitted(client):
    """B3: after soft-delete, the same URL can be submitted again."""
    url = "https://example.com/b3-resubmit-after-delete"

    r1 = client.post("/api/jobs", json={"source_type": "url", "source_url": url})
    assert r1.status_code == 201
    first_id = r1.json()["id"]

    # Delete it
    r_del = client.delete(f"/api/jobs/{first_id}")
    assert r_del.status_code == 204

    # Resubmit — should succeed
    r2 = client.post("/api/jobs", json={"source_type": "url", "source_url": url})
    assert r2.status_code == 201, f"resubmit after delete got {r2.status_code}"
    assert r2.json()["id"] != first_id


# ── B4: list_jobs payload slim ───────────────────────────────────────

def test_b4_list_jobs_excludes_raw_description(client):
    """B4: list_jobs must NOT include raw_description."""
    r = client.get("/api/jobs")
    assert r.status_code == 200
    jobs = r.json()
    assert isinstance(jobs, list)
    if jobs:
        for j in jobs:
            assert "raw_description" not in j, \
                f"list response leaked raw_description: {list(j.keys())}"


def test_b4_single_job_includes_raw_description(client):
    """B4: single-job GET keeps raw_description (detail view needs it)."""
    r = client.get("/api/jobs")
    if r.status_code != 200 or not r.json():
        pytest.skip("no jobs available")
    job_id = r.json()[0]["id"]
    r2 = client.get(f"/api/jobs/{job_id}")
    assert r2.status_code == 200
    assert "raw_description" in r2.json()


# ── B7: soft-delete filter in list_jobs ──────────────────────────────

def test_b7_soft_deleted_job_not_in_list(client):
    """B7: soft-deleted jobs are filtered out of list_jobs."""
    # Create a job
    r = client.post("/api/jobs", json={
        "source_type": "manual",
        "raw_description": "test for soft delete filter",
    })
    assert r.status_code == 201
    job_id = r.json()["id"]

    # Verify in list
    r2 = client.get("/api/jobs")
    ids = [j["id"] for j in r2.json()]
    assert job_id in ids

    # Soft-delete
    r_del = client.delete(f"/api/jobs/{job_id}")
    assert r_del.status_code == 204

    # Verify no longer in list
    r3 = client.get("/api/jobs")
    ids_after = [j["id"] for j in r3.json()]
    assert job_id not in ids_after


def test_b7_get_soft_deleted_job_returns_404(client):
    """B7: GET on a soft-deleted job returns 404 (looks deleted to user)."""
    r = client.post("/api/jobs", json={
        "source_type": "manual",
        "raw_description": "test for soft delete 404",
    })
    job_id = r.json()["id"]
    client.delete(f"/api/jobs/{job_id}")
    r2 = client.get(f"/api/jobs/{job_id}")
    assert r2.status_code == 404


def test_b7_list_excludes_ats_keywords_json(client):
    """B4 follow-up: list_jobs shouldn't carry heavy ats_keywords_json either."""
    r = client.get("/api/jobs")
    assert r.status_code == 200
    for j in r.json():
        # JobListItem intentionally excludes job_analysis_json + ats_keywords_json
        assert "job_analysis_json" not in j
        assert "ats_keywords_json" not in j


# ── B11: extractor_used is persisted to the Job row ─────────────────


class TestExtractorUsedPersisted:
    """B11 fix: which HTML extractor succeeded is saved on the Job row.

    Before the fix, ``ScrapeResult.extractor_used`` was returned by
    ``scrape_job`` but discarded by ``_safe_scrape_and_analyze``.
    """

    def test_job_out_has_extractor_used_field(self):
        from app.schemas.schemas import JobOut
        # Pydantic exposes the field; default is None for manual jobs.
        assert "extractor_used" in JobOut.model_fields
        assert JobOut.model_fields["extractor_used"].default is None

    def test_job_model_has_extractor_used_column(self):
        from app.models.models import Job
        col = Job.__table__.columns.get("extractor_used")
        assert col is not None
        assert col.nullable is True
        assert str(col.type) == "VARCHAR(32)"


# ── B10: _safe_scrape_and_analyze is now flat (no triple try/except) ──


class TestSafeScrapeHelper:
    """B10 fix: the wrapper now delegates to a single _fail_job helper
    instead of repeating the same status='failed' block three times."""

    def test_fail_job_helper_exists(self):
        from app.api.routes.jobs import _fail_job, _safe_scrape_and_analyze_async
        assert callable(_fail_job)
        assert callable(_safe_scrape_and_analyze_async)

    def test_async_wrapper_is_awaitable(self):
        # The wrapper is now an `async def` so callers can `await` it
        # directly (B13 fix). Verify by inspecting the function kind.
        import inspect
        from app.api.routes.jobs import _safe_scrape_and_analyze_async
        assert inspect.iscoroutinefunction(_safe_scrape_and_analyze_async)

    def test_scrape_exception_tuple_exported(self):
        # The five scrape exceptions are grouped into a tuple so the
        # except clause stays one-liner-readable.
        from app.api.routes.jobs import _SCRAPE_EXC
        assert len(_SCRAPE_EXC) == 5


# ── B13: no nested asyncio.run in sync context ────────────────────────


class TestAsyncBridgePattern:
    """B13 fix: sync BackgroundTasks wrapper now calls asyncio.run ONCE
    at the boundary, not nested inside the analyze_jd call."""

    def test_sync_wrapper_calls_async_helper(self):
        import inspect
        from app.api.routes.jobs import _safe_scrape_and_analyze, _safe_scrape_and_analyze_async
        # The sync wrapper still exists for BackgroundTasks compat.
        assert callable(_safe_scrape_and_analyze)
        # The actual work moved to an async coroutine.
        assert inspect.iscoroutinefunction(_safe_scrape_and_analyze_async)


# ── B9: analyze_jd success log when clearing prior error ─────────────


class TestAnalyzeJDClearsPriorError:
    """B9 fix: a successful re-analyze that wipes a stale error_message
    now emits an ``analyze_jd_cleared_prior_error`` log line."""

    def test_log_helper_uses_structlog_kwarg(self):
        # Just confirm the code path uses structlog-style kwargs (the
        # historical bug was stdlib logger being called with kwargs).
        from app.services.jd_analyzer import _apply_to_job
        import inspect
        src = inspect.getsource(_apply_to_job)
        assert "analyze_jd_cleared_prior_error" in src
        assert "prior_error=" in src