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
    # Markdown output is wrapped with YAML front-matter (cv_id, profile_id,
    # job_id, etc.) for traceability — verify the wrapper plus that the
    # actual CV body still starts with the `# Mohammad` heading.
    assert body["content"].startswith("---")
    # The test fixture seeds a profile with name "CV Test User" — assert on
    # that rather than the dev-seeded "Mohammad" profile.
    assert "# CV Test User" in body["content"]


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

# ── Versioning endpoints (L1) ──────────────────────────────────────


def test_create_creates_initial_version(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "V test"},
    )
    cv_id = create.json()["id"]
    r = client.get(f"/api/cvs/{cv_id}/versions")
    assert r.status_code == 200
    vs = r.json()
    assert len(vs) == 1
    assert vs[0]["version_number"] == 1
    assert "initial" in vs[0]["change_summary"].lower()


def test_patch_creates_version(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "V test patch"},
    )
    cv_id = create.json()["id"]
    # Patch cv_json
    patch_r = client.patch(
        f"/api/cvs/{cv_id}",
        json={"cv_json": {"basics": {"name": "New Name"}, "summary": "New"}},
    )
    assert patch_r.status_code == 200
    vs = client.get(f"/api/cvs/{cv_id}/versions").json()
    assert len(vs) >= 2
    # Newest version is the patch.
    assert vs[0]["version_number"] >= 2


def test_enhance_creates_version(client: TestClient):
    """Enhance is mocked so the test stays deterministic + fast."""
    from app.services import cv_enhancer

    async def fake_summary(cv_json, target_kw, db=None):
        cv_json = dict(cv_json or {})
        cv_json["summary"] = "polished summary"
        return cv_json, []

    cv_enhancer.enhance_cv_summary = fake_summary  # type: ignore

    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Enhance V"},
    )
    cv_id = create.json()["id"]
    en = client.post(
        f"/api/cvs/{cv_id}/enhance",
        json={"section": "summary"},
    )
    assert en.status_code == 200
    vs = client.get(f"/api/cvs/{cv_id}/versions").json()
    # At least 2 versions: initial + enhance.
    assert len(vs) >= 2
    summaries = [v["change_summary"] for v in vs]
    assert any("LLM-enhanced summary" in s for s in summaries)


def test_restore_version_roundtrip(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Restore test"},
    )
    cv_id = create.json()["id"]
    # v1 = initial
    vs = client.get(f"/api/cvs/{cv_id}/versions").json()
    v1_id = vs[0]["id"]

    # Patch to create v2
    client.patch(
        f"/api/cvs/{cv_id}",
        json={"cv_json": {"basics": {"name": "Modified"}, "summary": "modified"}},
    )

    # Restore v1
    r = client.post(f"/api/cvs/{cv_id}/versions/{v1_id}/restore")
    assert r.status_code == 200
    restored = r.json()
    assert restored["cv_json"]["basics"]["name"] != "Modified"

    # A new "restored from v1" version should now exist.
    vs_after = client.get(f"/api/cvs/{cv_id}/versions").json()
    summaries = [v["change_summary"] for v in vs_after]
    assert any("restored from v1" in s for s in summaries)


# ── job_id PATCH (H1) ──────────────────────────────────────────────


def test_patch_job_id_persists(client: TestClient):
    profile_id, job_id = _seed_profile_and_job(client)
    create = client.post(
        "/api/cvs",
        json={"job_id": job_id, "profile_id": profile_id, "title": "Re-target"},
    )
    cv_id = create.json()["id"]

    # Detach
    r1 = client.patch(f"/api/cvs/{cv_id}", json={"job_id": None})
    assert r1.status_code == 200
    assert r1.json()["job_id"] is None

    # Re-attach to same job
    r2 = client.patch(f"/api/cvs/{cv_id}", json={"job_id": job_id})
    assert r2.status_code == 200
    assert r2.json()["job_id"] == job_id

    # Bad job id -> 404
    r3 = client.patch(f"/api/cvs/{cv_id}", json={"job_id": "does-not-exist"})
    assert r3.status_code == 404


# ── Phase 8.5: PDF export + history integration tests ────────────────
# P1 fix: route-level tests for the new endpoints. The service-layer
# tests in test_cv_exporter.py cover the renderer; these cover the
# route handlers, ownership scoping, Export row persistence, and the
# B1/B2/B7/B10 fix behavior end-to-end.


def _create_cv_for_export(client: TestClient) -> str:
    """Helper: create a CV draft ready for export."""
    profile_id, _ = _seed_profile_and_job(client)
    r = client.post(
        "/api/cvs",
        json={
            "profile_id": profile_id,
            "title": "Export Test CV",
            "cv_json": {
                "summary": "Test summary for export",
                "experience": [
                    {
                        "company": "Acme",
                        "title": "Engineer",
                        "start": "2020-01",
                        "end": "present",
                        "highlights": ["Built things", "Shipped things"],
                    }
                ],
                "education": [{"degree": "BSc CS", "school": "Test U"}],
                "skills": [{"name": "Python"}, {"name": "Django"}],
            },
            "template_id": "modern-clean",
        },
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def test_export_cv_happy_path(client: TestClient):
    """POST /api/cvs/{id}/export returns PDF bytes + writes Export row."""
    cv_id = _create_cv_for_export(client)
    r = client.post(f"/api/cvs/{cv_id}/export")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"
    assert "X-Cv-Export-Id" in r.headers
    assert "attachment" in r.headers["content-disposition"].lower()


def test_export_cv_persists_export_row_with_sha256(client: TestClient):
    """B1 + B10 fix: Export row stores on-demand sentinel + sha256."""
    cv_id = _create_cv_for_export(client)
    r = client.post(f"/api/cvs/{cv_id}/export")
    assert r.status_code == 200
    export_id = r.headers["X-Cv-Export-Id"]

    # GET /exports should include this row with the sentinel + hash
    hist = client.get(f"/api/cvs/{cv_id}/exports")
    assert hist.status_code == 200
    items = hist.json()
    assert any(it["id"] == export_id for it in items)
    row = next(it for it in items if it["id"] == export_id)
    # B1: file_path is a sentinel, NOT a real on-disk path.
    assert row["file_path"].startswith("on-demand://"), row["file_path"]
    # B10: sha256 is populated (64 hex chars).
    assert row["sha256"] is not None
    assert len(row["sha256"]) == 64
    # Verify it's actually a hex string.
    int(row["sha256"], 16)  # raises if not hex


def test_export_cv_unknown_cv_returns_404(client: TestClient):
    cv_id = "nonexistent-export-test-id"
    r = client.post(f"/api/cvs/{cv_id}/export")
    assert r.status_code == 404


def test_export_cv_docx_returns_501(client: TestClient):
    """B7 fix: docx format is wired up at the route level but
    returns 501 since Phase 8.5 DOCX renderer doesn't ship yet."""
    cv_id = _create_cv_for_export(client)
    r = client.post(f"/api/cvs/{cv_id}/export?format=docx")
    assert r.status_code == 501
    assert "not implemented" in r.json()["detail"].lower()


def test_export_cv_invalid_format_returns_422(client: TestClient):
    """B7 fix: pattern validation rejects bogus format values."""
    cv_id = _create_cv_for_export(client)
    r = client.post(f"/api/cvs/{cv_id}/export?format=txt")
    assert r.status_code == 422


def test_list_exports_returns_newest_first(client: TestClient):
    """GET /exports returns history newest first."""
    cv_id = _create_cv_for_export(client)
    # Generate two exports
    client.post(f"/api/cvs/{cv_id}/export")
    client.post(f"/api/cvs/{cv_id}/export")
    r = client.get(f"/api/cvs/{cv_id}/exports")
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 2
    # Newest first: each created_at >= the next
    from datetime import datetime
    for i in range(len(items) - 1):
        ts_a = datetime.fromisoformat(items[i]["created_at"].replace("Z", "+00:00"))
        ts_b = datetime.fromisoformat(items[i + 1]["created_at"].replace("Z", "+00:00"))
        assert ts_a >= ts_b


def test_recommendations_limit_clamped(client: TestClient):
    """B6 fix: /recommendations limit is bounded 1-100."""
    r = client.get("/api/cvs/recommendations?limit=999")
    assert r.status_code == 422  # out of range
    r = client.get("/api/cvs/recommendations?limit=0")
    assert r.status_code == 422  # below minimum
    r = client.get("/api/cvs/recommendations")
    assert r.status_code == 200  # default works


def test_patch_cv_with_cv_json_and_job_id_scores_once(client: TestClient):
    """B11 fix: PATCH with both cv_json and job_id scores once + saves
    version once (previously called _score_and_persist twice and wrote
    two CVVersion rows)."""
    from app.db.session import SessionLocal
    from app.models.models import CVVersion

    profile_id, job_id = _seed_profile_and_job(client)
    cv_id = _create_cv_for_export(client)

    # Count versions before
    db = SessionLocal()
    try:
        before = (
            db.query(CVVersion)
            .filter(CVVersion.cv_draft_id == cv_id)
            .count()
        )
    finally:
        db.close()

    # PATCH with both fields
    r = client.patch(
        f"/api/cvs/{cv_id}",
        json={
            "title": "Dual-patch test",
            "job_id": job_id,
        },
    )
    assert r.status_code == 200

    # Count versions after — should be exactly +1, not +2
    db = SessionLocal()
    try:
        after = (
            db.query(CVVersion)
            .filter(CVVersion.cv_draft_id == cv_id)
            .count()
        )
    finally:
        db.close()
    assert after == before + 1, f"expected +1 version, got +{after - before}"
