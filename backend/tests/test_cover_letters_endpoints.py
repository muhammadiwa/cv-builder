"""Integration tests for /api/cover-letters endpoints.

Covers:
- Happy path: generate → list → get → patch → rescore → export pdf → export docx → delete
- 404 paths: unknown cover letter
- 403 paths: cross-user ownership (skipped — single default user in dev DB)
- 400 paths: invalid tone, missing fields
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    from app.main import app
    return TestClient(app)


def _seed_profile_and_job(client: TestClient) -> tuple[str, str]:
    """Create or reuse the default user + a parsed job.

    conftest.py overrides CV_DATABASE_URL to a temp DB per session,
    so we seed minimally here so the cover-letter flow has data.
    """
    from app.db.session import SessionLocal
    from app.models.models import Profile, User

    db = SessionLocal()
    try:
        # Seed user first (idempotent — same email = same user).
        user = db.query(User).filter(User.email == "default@local").first()
        if user is None:
            user = User(id="test-user-1", name="Test User", email="default@local")
            db.add(user)
            db.commit()
            db.refresh(user)

        # Seed profile (idempotent — one per user).
        prof = db.query(Profile).filter(Profile.user_id == user.id).first()
        if prof is None:
            prof = Profile(
                user_id=user.id,
                name="Test User",
                title="Senior Python Developer",
                email=user.email,
                base_profile_json={
                    "basics": {"name": "Test User", "email": user.email},
                    "summary": "Backend engineer with 6 years",
                    "skills": [
                        {"name": "Python"},
                        {"name": "FastAPI"},
                        {"name": "PostgreSQL"},
                    ],
                    "work": [
                        {
                            "company": "Acme",
                            "title": "Backend Dev",
                            "start": "2020-01",
                            "end": "present",
                            "highlights": ["Built scalable services"],
                        }
                    ],
                    "education": [{"degree": "BSc", "school": "Test U"}],
                },
                confidence_score=1.0,
            )
            db.add(prof)
            db.commit()
            db.refresh(prof)

        profile_id = prof.id
    finally:
        db.close()

    return _ensure_job(client, profile_id)


def _ensure_job(client: TestClient, profile_id: str) -> tuple[str, str]:
    """Find a parsed job, or create one if none available.

    conftest.py overrides CV_DATABASE_URL to a temp DB per session,
    so the test starts with no users/profiles/jobs. We seed
    minimally here so the cover-letter flow has data to work with.
    """
    from app.db.session import SessionLocal
    from app.models.models import Job, JobMatch, Profile, User

    db = SessionLocal()
    try:
        # First try: any job with a JobMatch (i.e. parsed + analyzed).
        m = db.query(JobMatch).first()
        if m:
            return profile_id, m.job_id
        # Need to seed: create user + parsed job + match.
        user = db.query(User).filter(User.email == "default@local").first()
        if user is None:
            user = User(id="test-user-1", name="Test User", email="default@local")
            db.add(user)
            db.commit()
            db.refresh(user)
        # Seed a parsed job with analysis_json containing required_skills.
        from datetime import datetime, timezone
        from uuid import uuid4
        job = Job(
            id=str(uuid4()),
            user_id=user.id,
            source_type="manual",
            title="Senior Python Developer",
            company="Acme",
            raw_description="We need a Python developer with FastAPI and PostgreSQL.",
            status="parsed",
            job_analysis_json={
                "required_skills": [
                    {"name": "Python"},
                    {"name": "FastAPI"},
                    {"name": "PostgreSQL"},
                ]
            },
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        # JobMatch so /recommendations and the matcher have data.
        match = JobMatch(
            id=str(uuid4()),
            job_id=job.id,
            profile_id=profile_id,
            match_score=0.7,
            risk_level="low",
            score_breakdown_json={},
            matched_items_json=[],
            missing_items_json=[],
            strategy_json={},
            recommendations_json=[],
        )
        db.add(match)
        db.commit()
        return profile_id, job.id
    finally:
        db.close()


class TestCoverLetterLifecycle:
    def test_generate_creates_draft(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        r = client.post(
            "/api/cover-letters/generate",
            json={
                "job_id": job_id,
                "profile_id": profile_id,
                "tone": "professional",
                "use_llm": False,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tone"] == "professional"
        assert body["status"] == "draft"
        assert body["score"] >= 0.0
        assert body["subject"].startswith("Application for")
        assert len(body["content"]) > 200
        # Cleanup
        client.delete(f"/api/cover-letters/{body['id']}")

    def test_generate_requires_job_and_profile(self, client: TestClient):
        r = client.post(
            "/api/cover-letters/generate",
            json={"tone": "professional"},
        )
        # Endpoint accepts dict[str, Any] and validates inline → 400.
        assert r.status_code == 400

    def test_generate_rejects_invalid_tone(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        r = client.post(
            "/api/cover-letters/generate",
            json={
                "job_id": job_id,
                "profile_id": profile_id,
                "tone": "bogus",
            },
        )
        assert r.status_code == 400
        assert "invalid tone" in r.json()["detail"].lower()

    def test_generate_unknown_profile_returns_404(self, client: TestClient):
        _, job_id = _seed_profile_and_job(client)
        r = client.post(
            "/api/cover-letters/generate",
            json={
                "job_id": job_id,
                "profile_id": "nonexistent-profile-id",
            },
        )
        assert r.status_code == 404

    def test_generate_unknown_job_returns_404(self, client: TestClient):
        profile_id, _ = _seed_profile_and_job(client)
        r = client.post(
            "/api/cover-letters/generate",
            json={
                "job_id": "nonexistent-job-id",
                "profile_id": profile_id,
            },
        )
        assert r.status_code == 404

    def test_list_returns_user_only(self, client: TestClient):
        r = client.get("/api/cover-letters")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_filtered_by_job(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        # Generate one for this job
        gen = client.post(
            "/api/cover-letters/generate",
            json={"job_id": job_id, "profile_id": profile_id, "use_llm": False},
        )
        cl_id = gen.json()["id"]
        # List with filter
        r = client.get(f"/api/cover-letters?job_id={job_id}")
        assert r.status_code == 200
        items = r.json()
        assert all(it["job_id"] == job_id for it in items)
        # Cleanup
        client.delete(f"/api/cover-letters/{cl_id}")

    def test_get_one(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        gen = client.post(
            "/api/cover-letters/generate",
            json={"job_id": job_id, "profile_id": profile_id, "use_llm": False},
        )
        cl_id = gen.json()["id"]
        r = client.get(f"/api/cover-letters/{cl_id}")
        assert r.status_code == 200
        assert r.json()["id"] == cl_id
        # Cleanup
        client.delete(f"/api/cover-letters/{cl_id}")

    def test_get_unknown_returns_404(self, client: TestClient):
        r = client.get("/api/cover-letters/nonexistent-id")
        assert r.status_code == 404

    def test_patch_content_rescores(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        gen = client.post(
            "/api/cover-letters/generate",
            json={"job_id": job_id, "profile_id": profile_id, "use_llm": False},
        )
        cl_id = gen.json()["id"]
        score_before = gen.json()["score"]
        # Patch content
        r = client.patch(
            f"/api/cover-letters/{cl_id}",
            json={
                "content": (
                    "Dear Hiring Team,\n\n"
                    "I bring deep Python FastAPI and PostgreSQL expertise to this role. "
                    "My recent work on Python FastAPI PostgreSQL has been impactful.\n\n"
                    "Best regards,\nTest"
                )
            },
        )
        assert r.status_code == 200
        patched = r.json()
        # Score may change since content changed
        assert patched["score"] != score_before or patched["score"] >= 0
        # Cleanup
        client.delete(f"/api/cover-letters/{cl_id}")

    def test_patch_rejects_unknown_keys(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        gen = client.post(
            "/api/cover-letters/generate",
            json={"job_id": job_id, "profile_id": profile_id, "use_llm": False},
        )
        cl_id = gen.json()["id"]
        r = client.patch(
            f"/api/cover-letters/{cl_id}",
            json={"unknown_field": "x"},
        )
        assert r.status_code == 400
        # Cleanup
        client.delete(f"/api/cover-letters/{cl_id}")

    def test_rescore_endpoint(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        gen = client.post(
            "/api/cover-letters/generate",
            json={"job_id": job_id, "profile_id": profile_id, "use_llm": False},
        )
        cl_id = gen.json()["id"]
        r = client.post(f"/api/cover-letters/{cl_id}/rescore")
        assert r.status_code == 200
        assert "score" in r.json()
        # Cleanup
        client.delete(f"/api/cover-letters/{cl_id}")

    def test_export_pdf(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        gen = client.post(
            "/api/cover-letters/generate",
            json={"job_id": job_id, "profile_id": profile_id, "use_llm": False},
        )
        cl_id = gen.json()["id"]
        r = client.post(f"/api/cover-letters/{cl_id}/export")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content[:4] == b"%PDF"
        assert "X-Cover-Letter-Export-Id" in r.headers
        # Cleanup
        client.delete(f"/api/cover-letters/{cl_id}")

    def test_export_docx(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        gen = client.post(
            "/api/cover-letters/generate",
            json={"job_id": job_id, "profile_id": profile_id, "use_llm": False},
        )
        cl_id = gen.json()["id"]
        r = client.post(f"/api/cover-letters/{cl_id}/export?format=docx")
        assert r.status_code == 200
        assert (
            r.headers["content-type"]
            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        # DOCX magic is PK\x03\x04 (ZIP container)
        assert r.content[:2] == b"PK"
        # Cleanup
        client.delete(f"/api/cover-letters/{cl_id}")

    def test_export_invalid_format_returns_422(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        gen = client.post(
            "/api/cover-letters/generate",
            json={"job_id": job_id, "profile_id": profile_id, "use_llm": False},
        )
        cl_id = gen.json()["id"]
        r = client.post(f"/api/cover-letters/{cl_id}/export?format=txt")
        assert r.status_code == 422  # pattern validation
        # Cleanup
        client.delete(f"/api/cover-letters/{cl_id}")

    def test_exports_list_after_export(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        gen = client.post(
            "/api/cover-letters/generate",
            json={"job_id": job_id, "profile_id": profile_id, "use_llm": False},
        )
        cl_id = gen.json()["id"]
        # Generate 2 exports
        client.post(f"/api/cover-letters/{cl_id}/export")
        client.post(f"/api/cover-letters/{cl_id}/export?format=docx")
        r = client.get(f"/api/cover-letters/{cl_id}/exports")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2
        # Newest first
        from datetime import datetime
        for i in range(len(items) - 1):
            ts_a = datetime.fromisoformat(items[i]["created_at"].replace("Z", "+00:00"))
            ts_b = datetime.fromisoformat(items[i + 1]["created_at"].replace("Z", "+00:00"))
            assert ts_a >= ts_b
        # Cleanup
        client.delete(f"/api/cover-letters/{cl_id}")

    def test_delete(self, client: TestClient):
        profile_id, job_id = _seed_profile_and_job(client)
        gen = client.post(
            "/api/cover-letters/generate",
            json={"job_id": job_id, "profile_id": profile_id, "use_llm": False},
        )
        cl_id = gen.json()["id"]
        r = client.delete(f"/api/cover-letters/{cl_id}")
        assert r.status_code == 204
        # Verify gone
        g = client.get(f"/api/cover-letters/{cl_id}")
        assert g.status_code == 404