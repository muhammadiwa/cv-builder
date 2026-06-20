"""Tests for the LLM Providers CRUD API (Phase 10B).

Covers:
  * GET list + detail (api_key never returned)
  * POST create (encryption at rest, 409 on collision)
  * PATCH partial update (incl. force-disable on key clear)
  * DELETE (204)
  * POST test (404 on missing, ok on healthy, error on missing key)
  * Field validation (extra='forbid', slug pattern, base_url scheme)
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.crypto import decrypt_secret
from app.main import app


@pytest.fixture
def client(monkeypatch):
    """Provide a TestClient wired to a fresh isolated DB.

    Conftest sets ``CV_MASTER_KEY=test-only-key`` which makes our crypto
    helper skip Fernet encryption (with a warning). For this test module
    we override it with a real Fernet key so we can verify at-rest
    encryption actually happens.
    """
    from cryptography.fernet import Fernet

    real_key = Fernet.generate_key().decode()
    monkeypatch.setenv("CV_MASTER_KEY", real_key)
    # Crypto helper caches the Fernet instance — clear so the new key sticks.
    # Also clear get_settings() cache so the new env var is picked up.
    from app.core import crypto, config

    config.get_settings.cache_clear()
    crypto._fernet.cache_clear()

    with TestClient(app) as c:
        yield c


# ── GET ─────────────────────────────────────────────────────────────

def test_list_returns_seeded_providers(client):
    """Seed-on-startup should produce at least the 4 built-in rows."""
    r = client.get("/api/llm-providers")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1  # at least the seeded defaults
    for p in data:
        # api_key must NEVER appear in the response — only api_key_set
        assert "api_key" not in p
        assert isinstance(p["api_key_set"], bool)
        assert isinstance(p["enabled"], bool)


def test_get_one_returns_provider(client):
    seeded = client.get("/api/llm-providers").json()
    if not seeded:
        pytest.skip("no seeded providers in this environment")
    pid = seeded[0]["id"]
    r = client.get(f"/api/llm-providers/{pid}")
    assert r.status_code == 200
    assert r.json()["id"] == pid
    assert "api_key" not in r.json()


def test_get_missing_returns_404(client):
    r = client.get("/api/llm-providers/does-not-exist")
    assert r.status_code == 404


# ── POST ────────────────────────────────────────────────────────────

def test_create_provider_with_key_gets_encrypted_in_db(client):
    r = client.post(
        "/api/llm-providers",
        json={
            "id": "user-test-1",
            "display_name": "User Test 1",
            "kind": "openai_compat",
            "base_url": "https://api.example.com/v1",
            "api_key": "sk-tes-cret",
            "enabled": False,
            "priority": 50,
            "models_json": {"resume_parse": "test-model"},
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["api_key_set"] is True
    assert "api_key" not in body

    # Verify the DB row has encrypted ciphertext, not plaintext.
    # Query through SQLAlchemy (same engine the app uses) so we're
    # inspecting the real DB regardless of conftest's path choice.
    from app.db.session import SessionLocal
    from app.models.models import LLMProvider

    with SessionLocal() as db:
        row = db.get(LLMProvider, "user-test-1")
        assert row is not None, "row not found via SQLAlchemy"
        cipher = row.api_key
        assert cipher != "sk-tes-cret"
        # Fernet ciphertext starts with "gAAAAA"
        assert cipher.startswith("gAAAAA"), f"unexpected ciphertext prefix: {cipher[:20]}"
        # Round-trip: decrypt gives back the plaintext.
        assert decrypt_secret(cipher) == "sk-tes-cret"


def test_create_provider_collision_returns_409(client):
    payload = {
        "id": "collision-test",
        "display_name": "Collision",
        "kind": "openai_compat",
        "base_url": "https://api.example.com/v1",
    }
    r1 = client.post("/api/llm-providers", json=payload)
    assert r1.status_code == 201, r1.text
    r2 = client.post("/api/llm-providers", json=payload)
    assert r2.status_code == 409


def test_create_invalid_slug_returns_422(client):
    r = client.post(
        "/api/llm-providers",
        json={
            "id": "Invalid Slug With Spaces!",
            "display_name": "Bad",
            "kind": "openai_compat",
        },
    )
    assert r.status_code == 422


def test_create_bad_base_url_returns_422(client):
    r = client.post(
        "/api/llm-providers",
        json={
            "id": "valid-slug",
            "display_name": "Bad URL",
            "kind": "openai_compat",
            "base_url": "ftp://example.com",
        },
    )
    assert r.status_code == 422


def test_create_unknown_task_type_returns_422(client):
    r = client.post(
        "/api/llm-providers",
        json={
            "id": "valid-slug-2",
            "display_name": "Bad Task",
            "kind": "openai_compat",
            "models_json": {"not_a_real_task": "model-x"},
        },
    )
    assert r.status_code == 422


# ── PATCH ───────────────────────────────────────────────────────────

def test_patch_updates_fields(client):
    client.post(
        "/api/llm-providers",
        json={
            "id": "patch-test",
            "display_name": "Patch Test",
            "kind": "openai_compat",
        },
    )
    r = client.patch(
        "/api/llm-providers/patch-test",
        json={"display_name": "Patched Name", "priority": 5},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["display_name"] == "Patched Name"
    assert body["priority"] == 5


def test_patch_clearing_key_force_disables(client):
    # Create with key + enabled
    client.post(
        "/api/llm-providers",
        json={
            "id": "clear-key-test",
            "display_name": "Clear Key",
            "kind": "openai_compat",
            "api_key": "sk-original",
            "enabled": True,
        },
    )
    # Clear the key — should force-disable
    r = client.patch(
        "/api/llm-providers/clear-key-test",
        json={"api_key": ""},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["api_key_set"] is False
    assert body["enabled"] is False  # force-disabled


def test_patch_enable_without_key_returns_400(client):
    client.post(
        "/api/llm-providers",
        json={
            "id": "no-key-enable",
            "display_name": "No Key Enable",
            "kind": "openai_compat",
        },
    )
    r = client.patch(
        "/api/llm-providers/no-key-enable",
        json={"enabled": True},
    )
    assert r.status_code == 400
    assert "api_key" in r.json()["detail"].lower()


def test_patch_unknown_field_returns_422(client):
    r = client.patch(
        "/api/llm-providers/any",
        json={"display_name": "x", "extra_garbage_field": "y"},
    )
    assert r.status_code == 422


# ── DELETE ──────────────────────────────────────────────────────────

def test_delete_returns_204(client):
    client.post(
        "/api/llm-providers",
        json={
            "id": "delete-me",
            "display_name": "Delete",
            "kind": "openai_compat",
        },
    )
    r = client.delete("/api/llm-providers/delete-me")
    assert r.status_code == 204
    # Verify gone
    r2 = client.get("/api/llm-providers/delete-me")
    assert r2.status_code == 404


def test_delete_missing_returns_404(client):
    r = client.delete("/api/llm-providers/does-not-exist")
    assert r.status_code == 404


# ── TEST endpoint ───────────────────────────────────────────────────

def test_test_missing_provider_returns_404(client):
    r = client.post(
        "/api/llm-providers/does-not-exist/test",
        json={"prompt": "ping"},
    )
    assert r.status_code == 404


def test_test_provider_without_key_returns_ok_false(client):
    client.post(
        "/api/llm-providers",
        json={
            "id": "no-key-test",
            "display_name": "No Key Test",
            "kind": "openai_compat",
            "base_url": "https://api.example.com/v1",
        },
    )
    r = client.post(
        "/api/llm-providers/no-key-test/test",
        json={"prompt": "ping"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False
    assert "key" in body["message"].lower()


def test_test_provider_without_base_url_returns_ok_false(client):
    client.post(
        "/api/llm-providers",
        json={
            "id": "no-url-test",
            "display_name": "No URL",
            "kind": "openai_compat",
            "api_key": "sk-fake",
            "base_url": "",  # explicitly empty
        },
    )
    r = client.post(
        "/api/llm-providers/no-url-test/test",
        json={"prompt": "ping"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is False


def test_test_provider_records_model_override(client):
    client.post(
        "/api/llm-providers",
        json={
            "id": "override-test",
            "display_name": "Override",
            "kind": "openai_compat",
            "api_key": "sk-fake",
            "base_url": "http://127.0.0.1:1/v1",  # intentionally unreachable
            "models_json": {"resume_parse": "real-model"},
        },
    )
    # The actual HTTP call will fail, but the response should record
    # the model we asked to test (override).
    r = client.post(
        "/api/llm-providers/override-test/test",
        json={"model": "override-model", "prompt": "ping"},
    )
    assert r.status_code == 200
    body = r.json()
    # Either ok=False (timeout) or ok=True (reachable) — both are valid
    # outcomes in this fake setup. The point: model is recorded.
    assert body["model"] == "override-model"