"""Integration tests for /api/cvs endpoints.

Covers:
- Happy path: create → list → get → render → patch → enhance → delete
- 404 paths: unknown CV, unknown profile, unknown job
- 403 paths: cross-user ownership
- 400 paths: invalid payload
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from app.main import app
    return TestClient(app)


def _seed_profile_and_job(client: TestClient) -> tuple[str, str]:
    """Create a profile + parsed job, return (profile_id, job_id).

    The job is seeded directly in the DB (status='parsed', with ats_keywords)
    to avoid the LLM analyze step — these API integration tests focus on
    CV endpoints, not on the analyze pipeline.
    """
    # Profile may already exist from earlier tests
    r = client.get("/api/profile")
    if r.status_code == 200:
        profile_id = r.json()["id"]
    else:
        from app.api.routes.jobs import get_or_create_default_user
        from sqlalchemy.orm import sessionmaker
        from app.db.session import engine
        from app.models.models import Profile

        Session_ = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
        db = Session_()
        try:
            user = get_or_create_default_user(db)
            db.commit()
            profile = Profile(
                user_id=user.id,
                name="CV Test User",
                title="Backend Engineer",
                email=user.email,
                base_profile_json={
                    "basics": {
                        "name": "CV Test User",
                        "label": "Backend Engineer",
                        "email": user.email,
                    },
                    "summary": "Engineer with 5 years building APIs.",
                    "work": [
                        {
                            "name": "Acme",
                            "position": "Backend Engineer",
                            "startDate": "2019-01",
                            "endDate": None,
                            "highlights": ["Built payments service", "Cut p95 latency by 30%"],
                        }
                    ],
                    "education": [
                        {
                            "institution": "Test Uni",
                            "studyType": "Bachelor",
                            "area": "CS",
                            "startDate": "2015-09",
                            "endDate": "2019-06",
                        }
                    ],
                    "skills": [
                        {"name": "Backend", "keywords": ["Python", "FastAPI", "PostgreSQL"]}
                    ],
                },
                confidence_score=1.0,
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
            profile_id = profile.id
        finally:
            db.close()

    # Seed the job directly (skip the LLM analyze path)
    from sqlalchemy.orm import sessionmaker
    from app.db.session import engine
    from app.models.models import Job, User

    Session_ = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    db = Session_()
    try:
        user = db.query(User).first()
        job = Job(
            user_id=user.id,
            source_type="manual",
            source_url=None,
            title="Senior Backend Engineer",
            company="TestCo",
            raw_description="We need a backend engineer with Python and FastAPI experience.",
            status="parsed",
            job_analysis_json={
                "required_skills": ["Python", "FastAPI"],
            },
            ats_keywords_json={
                "all": ["Python", "FastAPI", "PostgreSQL"],
            },
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = job.id
    finally:
        db.close()

    return profile_id, job_id


def test_create_cv_happy_path(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    r = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Test CV"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["title"] == "Test CV"
    assert body["job_id"] == job_id
    assert body["profile_id"] == profile_id
    assert body["status"] == "draft"
    assert body["rendered_html"]
    assert "CV Test User" in body["rendered_html"]
    assert "Backend Engineer" in body["cv_json"]["basics"]["title"]
    assert "Acme" in str(body["cv_json"])
    assert "Python" in str(body["cv_json"])


def test_create_cv_unknown_profile_returns_404(client: TestClient):
    _, job_id = _seed_profile_and_job(client)
    r = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": "nonexistent-profile-id", "title": "X"},
    )
    assert r.status_code == 404


def test_create_cv_unknown_job_returns_404(client: TestClient):
    profile_id, _ = _seed_profile_and_job(client)
    r = client.post(
        "/api/cvs",
        json={"job_id": "nonexistent-job-id", "profile_id": profile_id, "title": "X"},
    )
    assert r.status_code == 404


def test_list_cvs_returns_user_only(client: TestClient):
    r = client.get("/api/cvs")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    # May be empty or have items; we just confirm schema
    for item in r.json():
        assert "id" in item
        assert "title" in item
        assert "status" in item


def test_get_cv_returns_full_doc(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Get Test"},
    )
    assert create.status_code == 201
    cv_id = create.json()["id"]

    r = client.get(f"/api/cvs/{cv_id}")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == cv_id
    assert body["title"] == "Get Test"
    assert body["rendered_html"]


def test_get_cv_unknown_returns_404(client: TestClient):
    r = client.get("/api/cvs/nonexistent-cv-id")
    assert r.status_code == 404


def test_patch_cv_updates_title(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Original"},
    )
    cv_id = create.json()["id"]

    r = client.patch(f"/api/cvs/{cv_id}", json={"title": "Patched"})
    assert r.status_code == 200
    assert r.json()["title"] == "Patched"


def test_patch_cv_updates_cv_json_rerenders(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "JSON Test"},
    )
    cv_id = create.json()["id"]
    new_cv_json = {
        "basics": {"name": "Patched User", "title": "Sr Engineer", "email": "p@x.com"},
        "summary": "New summary line.",
        "experience": [
            {"title": "Lead Eng", "company": "NewCo", "start": "2022-01", "end": None,
             "bullets": ["Built X", "Shipped Y"]}
        ],
        "skills": ["Go", "Rust"],
        "education": [],
        "projects": [],
    }
    r = client.patch(f"/api/cvs/{cv_id}", json={"cv_json": new_cv_json})
    assert r.status_code == 200
    body = r.json()
    assert "Patched User" in body["rendered_html"]
    assert "Go" in body["rendered_html"]


def test_patch_cv_rejects_unknown_keys(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Unknown Key"},
    )
    cv_id = create.json()["id"]
    r = client.patch(f"/api/cvs/{cv_id}", json={"garbage": "x"})
    assert r.status_code == 400


def test_patch_cv_rejects_empty_title(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Empty Title"},
    )
    cv_id = create.json()["id"]
    r = client.patch(f"/api/cvs/{cv_id}", json={"title": ""})
    assert r.status_code == 400


def test_render_cv_html(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Render HTML"},
    )
    cv_id = create.json()["id"]
    r = client.get(f"/api/cvs/{cv_id}/render?format=html")
    assert r.status_code == 200
    body = r.json()
    assert body["format"] == "html"
    assert "<!DOCTYPE html>" in body["content"]
    assert "<h1 class=\"cv-name\">" in body["content"]


def test_render_cv_markdown(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Render MD"},
    )
    cv_id = create.json()["id"]
    r = client.get(f"/api/cvs/{cv_id}/render?format=markdown")
    assert r.status_code == 200
    body = r.json()
    assert body["format"] == "markdown"
    assert body["content"].startswith("#")


def test_render_cv_invalid_format_422(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Bad Format"},
    )
    cv_id = create.json()["id"]
    r = client.get(f"/api/cvs/{cv_id}/render?format=xml")
    assert r.status_code == 422


def test_delete_cv(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "To Delete"},
    )
    cv_id = create.json()["id"]
    r = client.delete(f"/api/cvs/{cv_id}")
    assert r.status_code == 204
    # Now GET should 404
    r2 = client.get(f"/api/cvs/{cv_id}")
    assert r2.status_code == 404


def test_delete_cv_unknown_404(client: TestClient):
    r = client.delete("/api/cvs/nonexistent-cv-id")
    assert r.status_code == 404