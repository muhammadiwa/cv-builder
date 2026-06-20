"""Phase 10A — Template CRUD endpoint tests.

Exercises the full HTTP surface via TestClient + temp DB:
  - GET    /api/templates          (list)
  - GET    /api/templates/{id}     (detail)
  - POST   /api/templates          (create)
  - PATCH  /api/templates/{id}     (update)
  - DELETE /api/templates/{id}     (delete)
  - POST   /api/templates/{id}/duplicate  (fork)
  - POST   /api/templates/preview  (dry-run render)

Built-in presets are immutable — PATCH/DELETE on them returns 403.
User-created templates can be edited freely. ATS-safe color palette
enforced both at create and at patch.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.cv_renderer import BUILTIN_PRESETS


@pytest.fixture
def client():
    """Per-test TestClient. conftest autouse fixture gives us a fresh
    temp DB + bypassed rate limiter. We additionally seed built-in
    presets here so each test sees a populated DB."""
    from app.db.session import SessionLocal
    from app.services.cv_renderer import (
        reset_seed_cache,
        seed_default_templates,
    )
    reset_seed_cache()
    db = SessionLocal()
    try:
        seed_default_templates(db)
    finally:
        db.close()
    with TestClient(app) as c:
        yield c


# ── List ────────────────────────────────────────────────────────────
def test_list_returns_all_builtin_presets(client):
    r = client.get("/api/templates")
    assert r.status_code == 200
    data = r.json()
    ids = {t["id"] for t in data}
    for p in BUILTIN_PRESETS:
        assert p["id"] in ids, f"missing preset {p['id']}"


def test_list_filter_by_type(client):
    r = client.get("/api/templates?type=cv")
    assert r.status_code == 200
    for t in r.json():
        assert t["type"] == "cv"


def test_list_slim_summary_no_config_blob(client):
    """``TemplateListItem`` must not include the full config blob —
    that's what the detail endpoint is for."""
    r = client.get("/api/templates")
    assert r.status_code == 200
    for t in r.json():
        assert "template_config_json" not in t


# ── Detail ──────────────────────────────────────────────────────────
def test_get_preset_returns_full_config(client):
    r = client.get("/api/templates/ats_classic")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == "ats_classic"
    cfg = data["template_config_json"]
    assert cfg["id"] == "ats_classic"
    # New Phase 10A keys must be present
    for key in ("font_family", "accent_color", "density",
                "bullet_style", "date_format", "page_size"):
        assert key in cfg, f"preset missing key: {key}"


def test_get_unknown_returns_404(client):
    r = client.get("/api/templates/does_not_exist")
    assert r.status_code == 404


# ── Create ──────────────────────────────────────────────────────────
def test_create_user_template_returns_201(client):
    payload = {
        "id": "user_jane_doe",
        "name": "Jane's Style",
        "description": "Custom minimal look",
        "sections": ["summary", "experience", "skills"],
        "font_family": "sans",
        "accent_color": "#1f2937",
        "density": "compact",
        "bullet_style": "dash",
        "date_format": "Mon YYYY",
        "page_size": "A4",
    }
    r = client.post("/api/templates", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["id"] == "user_jane_doe"
    assert data["is_default"] is False
    assert data["template_config_json"]["accent_color"] == "#1f2937"


def test_create_rejects_duplicate_id(client):
    payload = {
        "id": "user_dup_test",
        "name": "Dup",
        "accent_color": "#111111",
    }
    r1 = client.post("/api/templates", json=payload)
    assert r1.status_code == 201
    r2 = client.post("/api/templates", json=payload)
    assert r2.status_code == 409
    assert "already exists" in r2.json()["detail"]


def test_create_rejects_unsafe_color(client):
    payload = {
        "id": "user_bad_color",
        "name": "Red Alert",
        "accent_color": "#ff0000",
    }
    r = client.post("/api/templates", json=payload)
    assert r.status_code == 400
    assert "ATS-safe palette" in r.json()["detail"]


def test_create_rejects_invalid_id_pattern(client):
    """``id`` must be lowercase alphanumeric + dash/underscore only."""
    payload = {
        "id": "Has Spaces And CAPS",
        "name": "Bad ID",
    }
    r = client.post("/api/templates", json=payload)
    assert r.status_code == 422  # Pydantic validation


def test_create_rejects_unknown_font_family(client):
    payload = {
        "id": "user_bad_font",
        "name": "Bad Font",
        "font_family": "comic-sans",
    }
    r = client.post("/api/templates", json=payload)
    assert r.status_code == 422


def test_create_with_all_optional_defaults(client):
    """Minimal payload works — every optional field has a safe default."""
    payload = {"id": "user_minimal", "name": "Minimal"}
    r = client.post("/api/templates", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["template_config_json"]["font_family"] == "sans"
    assert data["template_config_json"]["accent_color"] == "#111111"
    assert data["template_config_json"]["density"] == "normal"


# ── Patch ───────────────────────────────────────────────────────────
def test_patch_user_template_updates_field(client):
    create = client.post("/api/templates", json={
        "id": "user_patchable",
        "name": "Original",
        "accent_color": "#111111",
    })
    assert create.status_code == 201

    r = client.patch(
        "/api/templates/user_patchable",
        json={"name": "Renamed", "accent_color": "#0f172a"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "Renamed"
    assert data["template_config_json"]["accent_color"] == "#0f172a"


def test_patch_rejects_unsafe_color(client):
    create = client.post("/api/templates", json={
        "id": "user_safe",
        "name": "Safe",
        "accent_color": "#111111",
    })
    assert create.status_code == 201

    r = client.patch("/api/templates/user_safe", json={"accent_color": "#ff0000"})
    assert r.status_code == 400
    assert "ATS-safe palette" in r.json()["detail"]


def test_patch_builtin_preset_returns_403(client):
    r = client.patch("/api/templates/ats_classic", json={"name": "Hijack"})
    assert r.status_code == 403
    assert "built-in" in r.json()["detail"].lower()


def test_patch_unknown_returns_404(client):
    r = client.patch("/api/templates/nope", json={"name": "X"})
    assert r.status_code == 404


# ── Delete ──────────────────────────────────────────────────────────
def test_delete_user_template_returns_204(client):
    create = client.post("/api/templates", json={
        "id": "user_deletable",
        "name": "Bye",
    })
    assert create.status_code == 201

    r = client.delete("/api/templates/user_deletable")
    assert r.status_code == 204

    # Confirm gone.
    r2 = client.get("/api/templates/user_deletable")
    assert r2.status_code == 404


def test_delete_builtin_preset_returns_403(client):
    r = client.delete("/api/templates/ats_classic")
    assert r.status_code == 403


def test_delete_unknown_returns_404(client):
    r = client.delete("/api/templates/does_not_exist")
    assert r.status_code == 404


# ── Duplicate ───────────────────────────────────────────────────────
def test_duplicate_builtin_creates_editable_fork(client):
    r = client.post(
        "/api/templates/ats_classic/duplicate",
        params={"new_id": "user_my_classic"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["id"] == "user_my_classic"
    assert data["is_default"] is False
    # Copy preserves original config keys
    assert data["template_config_json"]["id"] == "user_my_classic"
    assert "copy" in data["template_config_json"]["name"].lower()


def test_duplicate_fork_is_editable(client):
    fork = client.post(
        "/api/templates/ats_modern/duplicate",
        params={"new_id": "user_my_modern"},
    )
    assert fork.status_code == 201

    patch = client.patch(
        "/api/templates/user_my_modern",
        json={"accent_color": "#1f2937"},
    )
    assert patch.status_code == 200, "forked template should be editable"


def test_duplicate_rejects_existing_target_id(client):
    client.post("/api/templates", json={"id": "user_target", "name": "Target"})
    r = client.post(
        "/api/templates/ats_classic/duplicate",
        params={"new_id": "user_target"},
    )
    assert r.status_code == 409


def test_duplicate_unknown_source_returns_404(client):
    r = client.post(
        "/api/templates/nope/duplicate",
        params={"new_id": "user_orphan"},
    )
    assert r.status_code == 404


def _ensure_profile(client):
    """Get the profile id, creating one in the DB if missing.

    Mirrors ``_seed_profile_and_job`` in test_cvs_endpoints.py — fresh
    test DBs may not have a profile row yet, and /api/profile returns
    404 until one exists.
    """
    r = client.get("/api/profile")
    if r.status_code == 200:
        return r.json()["id"]
    # Seed profile directly via DB (avoid scraping a resume in tests).
    from app.api.routes.jobs import get_or_create_default_user
    from app.db.session import engine
    from app.models.models import Profile
    from sqlalchemy.orm import sessionmaker

    Session_ = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    db = Session_()
    try:
        user = get_or_create_default_user(db)
        profile = Profile(
            user_id=user.id,
            name="Test Profile",
            title="Engineer",
            email=user.email,
            base_profile_json={
                "basics": {
                    "name": "Test Profile",
                    "label": "Engineer",
                    "email": user.email,
                },
                "summary": "Test engineer for preview rendering.",
                "work": [],
                "education": [],
                "skills": ["Python"],
                "projects": [],
            },
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
        return profile.id
    finally:
        db.close()


# ── Preview ─────────────────────────────────────────────────────────
def test_preview_with_profile_id_returns_rendered_html(client):
    profile_id = _ensure_profile(client)

    r = client.post("/api/templates/preview", json={
        "profile_id": profile_id,
        "template_config_json": {
            "font_family": "sans",
            "accent_color": "#0f172a",
            "density": "spacious",
        },
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "<!DOCTYPE html>" in data["rendered_html"]
    assert data["config_used"]["accent_color"] == "#0f172a"


def test_preview_with_inline_cv_json(client):
    r = client.post("/api/templates/preview", json={
        "cv_json": {
            "basics": {"name": "Test User", "email": "t@x.com"},
            "summary": "Test summary",
            "work": [],
            "education": [],
            "skills": ["Python"],
            "projects": [],
        },
        "template_config_json": {"font_family": "mono"},
    })
    assert r.status_code == 200, r.text
    assert "Test User" in r.json()["rendered_html"]


def test_preview_requires_profile_or_cv_json(client):
    r = client.post("/api/templates/preview", json={})
    assert r.status_code == 400
    assert "requires" in r.json()["detail"]


def test_preview_rejects_unsafe_color(client):
    profile_r = client.get("/api/profile")
    profile_id = profile_r.json()["id"]

    r = client.post("/api/templates/preview", json={
        "profile_id": profile_id,
        "template_config_json": {"accent_color": "#ff0000"},
    })
    assert r.status_code == 400
    assert "ATS-safe palette" in r.json()["detail"]


def test_preview_unknown_profile_returns_404(client):
    r = client.post("/api/templates/preview", json={
        "profile_id": "00000000-0000-0000-0000-000000000000",
        "template_config_json": {},
    })
    assert r.status_code == 404


# ── End-to-end: create + patch + duplicate + delete ─────────────────
def test_full_lifecycle_user_template(client):
    # Create
    r = client.post("/api/templates", json={
        "id": "lifecycle_test",
        "name": "Lifecycle",
        "accent_color": "#111827",
    })
    assert r.status_code == 201
    cid = r.json()["id"]

    # List shows it
    ids = {t["id"] for t in client.get("/api/templates").json()}
    assert cid in ids

    # Patch
    r = client.patch(f"/api/templates/{cid}", json={"name": "Updated"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated"

    # Duplicate
    r = client.post(
        f"/api/templates/{cid}/duplicate",
        params={"new_id": "lifecycle_test_copy"},
    )
    assert r.status_code == 201

    # Delete original
    r = client.delete(f"/api/templates/{cid}")
    assert r.status_code == 204

    # Copy survives
    r = client.get("/api/templates/lifecycle_test_copy")
    assert r.status_code == 200

    # Cleanup copy
    assert client.delete("/api/templates/lifecycle_test_copy").status_code == 204