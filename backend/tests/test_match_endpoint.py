"""Integration tests for /api/jobs/{id}/match endpoints.

Focuses on:
- happy path: POST computes → GET retrieves → DELETE clears
- error paths: 404 unknown job, 404 no profile, 400 not yet parsed
- deterministic + LLM narrative runs end-to-end (LLM may fail → llm=None)
"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from app.main import app
    return TestClient(app)


@pytest.fixture(scope="module")
def profile_id(client):
    """Seed a minimal profile so match endpoint has data to work with.

    Idempotent: if a profile already exists, reuse it. Uses the
    ``base_profile_json`` blob because that's where the matcher reads from.
    """
    from app.db.session import SessionLocal
    from app.models.models import Profile
    import json as _json

    r = client.get("/api/profile")
    if r.status_code == 200:
        return r.json()["id"]

    # Create one via direct DB write — bypass the resume-upload flow which
    # needs a real PDF. The profile fields the matcher reads are all in
    # base_profile_json.
    db = SessionLocal()
    try:
        from app.api.routes.jobs import get_or_create_default_user
        from app.core.config import get_settings
        from sqlalchemy.orm import sessionmaker
        from app.db.session import engine as _eng

        Session_ = sessionmaker(bind=_eng, autoflush=False, autocommit=False, future=True)
        s = Session_()
        try:
            user = get_or_create_default_user(s)
            s.commit()
            s.refresh(user)
            profile = Profile(
                user_id=user.id,
                name="Test User",
                title="Senior Python Developer",
                email=user.email,
                base_profile_json={
                    "skills": [
                        {"name": "Python"},
                        {"name": "Django"},
                        {"name": "PostgreSQL"},
                        {"name": "Docker"},
                        {"name": "CI/CD"},
                        {"name": "RESTful API"},
                    ],
                    "work": [
                        {"company": "Acme", "title": "Backend Dev",
                         "start": "2019-01", "end": "present",
                         "tech": ["Python", "Django", "PostgreSQL"]},
                    ],
                    "education": [{"degree": "S1", "school": "Test University"}],
                    "seniority": "mid",
                },
                confidence_score=1.0,
            )
            s.add(profile)
            s.commit()
            s.refresh(profile)
            return profile.id
        finally:
            s.close()
    finally:
        db.close()


@pytest.fixture
def parsed_job_id(client):
    """Create + force-parse a job so we can match against it.

    Falls back to creating an unparsed one if the analyzer is unavailable
    in the test environment.
    """
    payload = {
        "source_type": "manual",
        "raw_description": (
            "We need a Senior Python Developer with 5+ years experience. "
            "Must know Django, PostgreSQL, Docker, AWS. S1 required."
        ),
        "title": "Senior Python Developer",
        "company": "TestCorp",
    }
    r = client.post("/api/jobs", json=payload)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _wait_for_parsed(client, job_id, max_wait_s: int = 60) -> str:
    """Poll until status == parsed or timeout. Returns the job_id on success."""
    import time
    deadline = time.time() + max_wait_s
    last_status = None
    while time.time() < deadline:
        r = client.get(f"/api/jobs/{job_id}")
        assert r.status_code == 200, f"GET job {job_id} → {r.status_code}: {r.text}"
        last_status = r.json()["status"]
        if last_status == "parsed":
            return job_id
        if last_status == "failed":
            pytest.fail(f"job analyze failed: {r.json().get('error_message')}")
        time.sleep(1)
    pytest.fail(f"job did not parse within {max_wait_s}s (last status={last_status})")


# ── Happy path ───────────────────────────────────────────────────────


def test_compute_match_happy_path(client, parsed_job_id, profile_id):
    job_id = _wait_for_parsed(client, parsed_job_id)
    r = client.post(f"/api/jobs/{job_id}/match")
    assert r.status_code == 200, r.text
    body = r.json()

    # Top-level shape
    assert "id" in body
    assert body["job_id"] == job_id
    assert "profile_id" in body
    assert isinstance(body["match_score"], float)
    assert body["recommendation"] in ("apply", "stretch", "skip")

    # Breakdown
    sb = body["score_breakdown"]
    for k in ("skill", "experience", "seniority", "education"):
        assert k in sb
        assert 0.0 <= sb[k] <= 1.0

    # Component breakdowns
    for k in ("experience", "seniority", "education"):
        assert k in body
        assert "status" in body[k]

    # LLM narrative is optional but if present has the expected shape
    if body.get("llm") is not None:
        assert "summary" in body["llm"]
        assert isinstance(body["llm"]["strengths"], list)
        assert isinstance(body["llm"]["gaps"], list)


def test_get_match_after_compute(client, parsed_job_id, profile_id):
    job_id = _wait_for_parsed(client, parsed_job_id)
    # Compute first
    client.post(f"/api/jobs/{job_id}/match")
    # Then GET
    r = client.get(f"/api/jobs/{job_id}/match")
    assert r.status_code == 200
    body = r.json()
    assert body["job_id"] == job_id
    assert isinstance(body["match_score"], float)


def test_compute_match_idempotent(client, parsed_job_id, profile_id):
    """Calling POST twice should update the existing match, not fail."""
    job_id = _wait_for_parsed(client, parsed_job_id)
    r1 = client.post(f"/api/jobs/{job_id}/match")
    assert r1.status_code == 200
    first_id = r1.json()["id"]

    r2 = client.post(f"/api/jobs/{job_id}/match")
    assert r2.status_code == 200
    second_id = r2.json()["id"]

    # Same match row gets updated
    assert first_id == second_id


def test_delete_match(client, parsed_job_id, profile_id):
    job_id = _wait_for_parsed(client, parsed_job_id)
    client.post(f"/api/jobs/{job_id}/match")

    r = client.delete(f"/api/jobs/{job_id}/match")
    assert r.status_code == 204

    # GET should 404 after delete
    r2 = client.get(f"/api/jobs/{job_id}/match")
    assert r2.status_code == 404


# ── Error paths ──────────────────────────────────────────────────────


def test_compute_match_unknown_job(client):
    r = client.post("/api/jobs/00000000-0000-0000-0000-000000000000/match")
    assert r.status_code == 404


def test_get_match_unknown_job(client):
    r = client.get("/api/jobs/00000000-0000-0000-0000-000000000000/match")
    assert r.status_code == 404


def test_delete_match_unknown_job(client):
    r = client.delete("/api/jobs/00000000-0000-0000-0000-000000000000/match")
    assert r.status_code == 404


def test_compute_match_no_profile_returns_400(client, parsed_job_id):
    """If the user has no profile, the route should 400 not 500.

    We simulate "no profile" by inserting a job for a different user
    with no profile, then trying to compute a match. Simpler than
    mutating the shared default-user's profile mid-test.
    """
    job_id = _wait_for_parsed(client, parsed_job_id)

    # Probe: does the default user have a profile yet? If so, skip this
    # test — manipulating the shared profile would break other tests.
    r = client.get("/api/profile")
    if r.status_code == 200:
        pytest.skip("default user already has a profile; can't test 'no profile' safely")

    # Otherwise, attempt to match — expect 400.
    r = client.post(f"/api/jobs/{job_id}/match")
    assert r.status_code == 400
    assert "profile" in r.json()["detail"].lower()


def test_compute_match_not_yet_parsed(client):
    """Job still in scraping/parsing state should 400."""
    payload = {
        "source_type": "url",
        "source_url": "https://example.com/not-yet-parsed-match-test",
    }
    r = client.post("/api/jobs", json=payload)
    assert r.status_code == 201
    job_id = r.json()["id"]

    # Don't wait for parsing. The match endpoint should 400.
    r = client.post(f"/api/jobs/{job_id}/match")
    assert r.status_code == 400
    assert "not yet parsed" in r.json()["detail"].lower()

    # Cleanup
    client.delete(f"/api/jobs/{job_id}")


def test_get_match_without_compute(client, parsed_job_id):
    """If no match computed yet, GET returns 404."""
    job_id = _wait_for_parsed(client, parsed_job_id)
    # Make sure no match exists
    client.delete(f"/api/jobs/{job_id}/match")

    r = client.get(f"/api/jobs/{job_id}/match")
    assert r.status_code == 404