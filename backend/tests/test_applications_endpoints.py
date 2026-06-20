"""Phase 9B — Application tracking endpoint tests."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import engine
from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def seeded(client: TestClient):
    """Seed a User + Profile + Job for application testing.

    The default test DB may be empty; we always wipe the rows we create
    at the end so tests stay isolated.
    """
    # Bootstrap a user (the auth helper accepts any X-User-Id header that
    # matches a real User row, so we create one).
    user_id = "11111111-1111-1111-1111-111111111111"
    profile_id = "22222222-2222-2222-2222-222222222222"
    job_id = "33333333-3333-3333-3333-333333333333"
    app_id = "44444444-4444-4444-4444-444444444444"

    with engine.begin() as conn:
        # Clean slate
        conn.execute(text("DELETE FROM applications WHERE job_id = :j"), {"j": job_id})
        conn.execute(text("DELETE FROM jobs WHERE id = :j"), {"j": job_id})
        conn.execute(text("DELETE FROM profiles WHERE id = :p"), {"p": profile_id})
        conn.execute(text("DELETE FROM users WHERE id = :u"), {"u": user_id})
        conn.execute(
            text(
                "INSERT INTO users (id, email, name, created_at, updated_at) "
                "VALUES (:id, :email, :name, :now, :now)"
            ),
            {
                "id": user_id,
                "email": "app-test@example.com",
                "name": "App Test",
                "now": datetime.now(timezone.utc),
            },
        )
        conn.execute(
            text(
                "INSERT INTO profiles (id, user_id, name, email, base_profile_json, "
                "ai_analysis_json, confidence_score, created_at, updated_at) "
                "VALUES (:id, :uid, 'App Test', 'app-test@example.com', '{}', '{}', 0, :now, :now)"
            ),
            {"id": profile_id, "uid": user_id, "now": datetime.now(timezone.utc)},
        )
        conn.execute(
            text(
                "INSERT INTO jobs (id, user_id, source_type, raw_description, remote, "
                "title, company, job_analysis_json, ats_keywords_json, status, created_at, updated_at) "
                "VALUES (:id, :uid, 'manual', '', 0, 'Backend Engineer', 'Acme', '{}', '{}', "
                "'parsed', :now, :now)"
            ),
            {"id": job_id, "uid": user_id, "now": datetime.now(timezone.utc)},
        )

    yield {
        "user_id": user_id,
        "profile_id": profile_id,
        "job_id": job_id,
        "app_id": app_id,
        "headers": {"X-User-Id": user_id},
    }

    # Cleanup
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM applications WHERE job_id = :j"), {"j": job_id})
        conn.execute(text("DELETE FROM jobs WHERE id = :j"), {"j": job_id})
        conn.execute(text("DELETE FROM profiles WHERE id = :p"), {"p": profile_id})
        conn.execute(text("DELETE FROM users WHERE id = :u"), {"u": user_id})


# ── List ─────────────────────────────────────────────────────────────


def test_list_empty(client, seeded):
    r = client.get("/api/applications", headers=seeded["headers"])
    assert r.status_code == 200, r.text
    assert r.json() == []


# ── Create ───────────────────────────────────────────────────────────


def test_create_application(client, seeded):
    r = client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"], "status": "ready", "notes": "smoke"},
        headers=seeded["headers"],
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["job_id"] == seeded["job_id"]
    assert body["status"] == "ready"
    assert body["notes"] == "smoke"
    assert body["applied_date"] is None


def test_create_duplicate_409(client, seeded):
    payload = {"job_id": seeded["job_id"], "status": "draft"}
    r1 = client.post("/api/applications", json=payload, headers=seeded["headers"])
    assert r1.status_code == 201, r1.text
    r2 = client.post("/api/applications", json=payload, headers=seeded["headers"])
    assert r2.status_code == 409


def test_create_invalid_job_404(client, seeded):
    r = client.post(
        "/api/applications",
        json={"job_id": "nonexistent-id", "status": "draft"},
        headers=seeded["headers"],
    )
    assert r.status_code == 404


def test_create_invalid_status_422(client, seeded):
    r = client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"], "status": "bogus"},
        headers=seeded["headers"],
    )
    assert r.status_code == 422


# ── Get ──────────────────────────────────────────────────────────────


def test_get_application(client, seeded):
    created = client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"]},
        headers=seeded["headers"],
    ).json()

    r = client.get(f"/api/applications/{created['id']}", headers=seeded["headers"])
    assert r.status_code == 200
    assert r.json()["id"] == created["id"]


def test_get_404(client, seeded):
    r = client.get("/api/applications/nonexistent", headers=seeded["headers"])
    assert r.status_code == 404


# ── Patch ────────────────────────────────────────────────────────────


def test_patch_application(client, seeded):
    created = client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"]},
        headers=seeded["headers"],
    ).json()

    r = client.patch(
        f"/api/applications/{created['id']}",
        json={"contact_person": "Sarah Recruiter", "notes": "applied via referral"},
        headers=seeded["headers"],
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["contact_person"] == "Sarah Recruiter"
    assert body["notes"] == "applied via referral"


def test_patch_to_applied_stamps_date(client, seeded):
    created = client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"], "status": "ready"},
        headers=seeded["headers"],
    ).json()
    assert created["applied_date"] is None

    r = client.patch(
        f"/api/applications/{created['id']}",
        json={"status": "applied"},
        headers=seeded["headers"],
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "applied"
    assert body["applied_date"] is not None


def test_patch_idempotent_applied_does_not_overwrite_date(client, seeded):
    # First create as 'ready' (no applied_date)
    created = client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"], "status": "ready"},
        headers=seeded["headers"],
    ).json()
    assert created["applied_date"] is None

    # Patch to 'applied' — first time stamps applied_date
    r = client.patch(
        f"/api/applications/{created['id']}",
        json={"status": "applied"},
        headers=seeded["headers"],
    )
    first_date = r.json()["applied_date"]
    assert first_date is not None

    # Re-apply same status → date stays the same
    r = client.patch(
        f"/api/applications/{created['id']}",
        json={"status": "applied"},
        headers=seeded["headers"],
    )
    assert r.status_code == 200
    assert r.json()["applied_date"] == first_date


# ── Status transition ───────────────────────────────────────────────


def test_transition_status(client, seeded):
    created = client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"], "status": "draft"},
        headers=seeded["headers"],
    ).json()

    r = client.post(
        f"/api/applications/{created['id']}/status",
        json={"status": "interview"},
        headers=seeded["headers"],
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "interview"


def test_transition_to_applied_stamps_date(client, seeded):
    created = client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"], "status": "ready"},
        headers=seeded["headers"],
    ).json()

    r = client.post(
        f"/api/applications/{created['id']}/status",
        json={"status": "applied"},
        headers=seeded["headers"],
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "applied"
    assert body["applied_date"] is not None


def test_transition_invalid_status_400(client, seeded):
    created = client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"]},
        headers=seeded["headers"],
    ).json()

    r = client.post(
        f"/api/applications/{created['id']}/status",
        json={"status": "bogus"},
        headers=seeded["headers"],
    )
    assert r.status_code == 400


# ── List filters ─────────────────────────────────────────────────────


def test_list_filter_by_status(client, seeded):
    client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"], "status": "applied"},
        headers=seeded["headers"],
    )

    r = client.get(
        "/api/applications?status=applied", headers=seeded["headers"]
    )
    assert r.status_code == 200
    items = r.json()
    assert all(a["status"] == "applied" for a in items)
    assert len(items) >= 1


def test_list_filter_by_job(client, seeded):
    client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"]},
        headers=seeded["headers"],
    )

    r = client.get(
        f"/api/applications?job_id={seeded['job_id']}", headers=seeded["headers"]
    )
    assert r.status_code == 200
    assert all(a["job_id"] == seeded["job_id"] for a in r.json())


# ── Delete ───────────────────────────────────────────────────────────


def test_delete_application(client, seeded):
    created = client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"]},
        headers=seeded["headers"],
    ).json()

    r = client.delete(
        f"/api/applications/{created['id']}", headers=seeded["headers"]
    )
    assert r.status_code == 204

    # Verify gone
    r2 = client.get(f"/api/applications/{created['id']}", headers=seeded["headers"])
    assert r2.status_code == 404


def test_delete_404(client, seeded):
    r = client.delete(
        "/api/applications/nonexistent-id", headers=seeded["headers"]
    )
    assert r.status_code == 404


# ── Ownership (single-user mode) ────────────────────────────────────


def test_list_only_shows_users_apps(client, seeded):
    """In single-user mode, list returns the one user's apps."""
    client.post(
        "/api/applications",
        json={"job_id": seeded["job_id"], "status": "ready"},
        headers=seeded["headers"],
    )

    r = client.get("/api/applications", headers=seeded["headers"])
    assert r.status_code == 200
    assert all(a["job_id"] == seeded["job_id"] for a in r.json())


def test_default_user_auth_works(client):
    """Single-user mode: no header still resolves to the default user."""
    r = client.get("/api/applications")
    assert r.status_code == 200