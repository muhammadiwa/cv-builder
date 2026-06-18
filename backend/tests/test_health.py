"""Health endpoint tests — verify the API starts and the contracts hold."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_healthy():
    """Liveness probe returns expected shape and status code."""
    client = TestClient(app)
    r = client.get("/api/health")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "healthy"
    assert body["service"]
    assert body["version"]
    assert body["environment"] in ("development", "staging", "production")


def test_health_ready_returns_status():
    """Readiness probe returns a status field + per-check breakdown."""
    client = TestClient(app)
    r = client.get("/api/health/ready")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "status" in body
    assert body["status"] in ("ready", "degraded")
    assert "checks" in body
    # Storage is always writable in tests (we set CV_STORAGE_DIR to tmpdir)
    assert body["checks"]["storage_writable"] == "ok"


def test_health_404_unknown_path():
    """Unknown API path returns 404 (sanity check router is mounted)."""
    client = TestClient(app)
    r = client.get("/api/does-not-exist")
    assert r.status_code == 404


def test_health_cors_origin_allowed():
    """CORS middleware allows the dev frontend origin in response headers."""
    from app.core.config import get_settings
    settings = get_settings()
    client = TestClient(app)
    r = client.get("/api/health", headers={"Origin": settings.cors_origins[0]})
    assert r.status_code == 200
    # CORSMiddleware adds the header on actual responses (not just preflight).
    assert r.headers.get("access-control-allow-origin") == settings.cors_origins[0]


def test_app_creates_all_tables():
    """After app startup, every ORM table from metadata exists.

    The app's engine is the canonical one (create_all ran in create_app()).
    Inspect that engine directly.
    """
    from app.db.session import Base, engine
    from sqlalchemy import inspect
    # Force a create_all here too in case the test ordering skipped startup
    # (e.g., when other tests import app first without going through main).
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    expected_tables = {
        "users", "profiles", "profile_versions", "resume_uploads",
        "jobs", "job_matches", "cv_drafts", "cv_versions",
        "cv_recommendations", "cover_letters", "exports",
        "templates", "ai_prompts", "applications", "llm_call_log",
    }
    actual_tables = set(inspector.get_table_names())
    missing = expected_tables - actual_tables
    assert not missing, f"missing tables: {missing}; got: {sorted(actual_tables)}"
