"""Regression tests for POST /api/jobs/{id}/reanalyze endpoint."""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from app.main import app
    return TestClient(app)


def test_reanalyze_failed_job_returns_202(client: TestClient) -> None:
    """Failed job → reanalyze returns 202 with status reset to scraping/parsing."""
    # Create a manual job with no source_url to bypass URL scraping.
    r = client.post(
        "/api/jobs",
        json={
            "source_type": "manual",
            "raw_description": "We need a Python developer with 3 years experience.",
            "title": "Python Dev",
        },
    )
    assert r.status_code == 201, r.text
    job_id = r.json()["id"]

    # Manually flip to failed to simulate a prior failure.
    from app.db.session import SessionLocal
    from app.models.models import Job

    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        job.status = "failed"
        job.error_message = "simulated prior failure"
        db.commit()
    finally:
        db.close()

    # Re-analyze
    r2 = client.post(f"/api/jobs/{job_id}/reanalyze")
    assert r2.status_code == 202, r2.text
    body = r2.json()
    assert body["status"] in ("scraping", "parsing")
    assert body["error_message"] is None


def test_reanalyze_unknown_job_returns_404(client: TestClient) -> None:
    """Unknown id → 404."""
    r = client.post("/api/jobs/00000000-0000-0000-0000-000000000000/reanalyze")
    assert r.status_code == 404


def test_reanalyze_already_pending_returns_409(client: TestClient) -> None:
    """Job currently scraping/parsing → 409 (idempotency guard)."""
    # Create + immediately flip to scraping so the test is deterministic.
    # (If we relied on the create response's status='parsing', the LLM
    # could finish before our re-analyze call and we'd race the guard.)
    r = client.post(
        "/api/jobs",
        json={
            "source_type": "manual",
            "raw_description": "Hiring now",
            "title": "Hiring",
        },
    )
    assert r.status_code == 201
    job_id = r.json()["id"]

    from app.db.session import SessionLocal
    from app.models.models import Job

    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        job.status = "scraping"  # force the pending state
        db.commit()
    finally:
        db.close()

    r2 = client.post(f"/api/jobs/{job_id}/reanalyze")
    assert r2.status_code == 409
    assert "already" in r2.json()["detail"].lower()


def test_reanalyze_soft_deleted_returns_404(client: TestClient) -> None:
    """Soft-deleted job cannot be re-analyzed."""
    r = client.post(
        "/api/jobs",
        json={
            "source_type": "manual",
            "raw_description": "Old JD",
            "title": "Old",
        },
    )
    job_id = r.json()["id"]

    # Delete it
    client.delete(f"/api/jobs/{job_id}")
    r2 = client.post(f"/api/jobs/{job_id}/reanalyze")
    assert r2.status_code == 404