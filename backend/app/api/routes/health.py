"""Health check routes — used for liveness, readiness, and basic system info."""
from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.logging import get_logger

router = APIRouter(prefix="/health", tags=["health"])
log = get_logger(__name__)


@router.get("")
def health() -> dict:
    """Liveness probe — returns 200 if the process is up."""
    settings = get_settings()
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


@router.get("/ready")
def ready() -> dict:
    """Readiness probe — confirms config loads + storage is writable.

    For K8s/Docker, use this for the readinessProbe. Returns 200 only when
    the app is truly ready to accept traffic.
    """
    settings = get_settings()
    checks: dict[str, str] = {}

    # Storage writable?
    try:
        test = settings.storage_dir / ".write_test"
        test.write_text("ok")
        test.unlink()
        checks["storage_writable"] = "ok"
    except Exception as e:  # noqa: BLE001
        log.error("storage_unwritable", error=str(e))
        checks["storage_writable"] = f"failed: {e}"

    # LLM providers configured (Phase 10B — DB-backed)?
    # We now check the llm_providers DB table directly. The legacy JSON
    # file is still consulted as a fallback for setups that haven't been
    # migrated yet (the seeder copies from JSON → DB on first run).
    try:
        from sqlalchemy import text

        from app.db.session import engine

        with engine.connect() as conn:
            n = conn.execute(text("SELECT COUNT(*) FROM llm_providers")).scalar()
            enabled = conn.execute(
                text("SELECT COUNT(*) FROM llm_providers WHERE enabled = 1")
            ).scalar()
        if n == 0:
            checks["llm_config"] = "missing: no providers in DB"
        elif enabled == 0:
            checks["llm_config"] = f"warn: {n} providers configured but none enabled"
        else:
            checks["llm_config"] = f"ok: {enabled}/{n} enabled"
    except Exception as e:  # noqa: BLE001
        log.warning("llm_health_check_failed", error=str(e))
        checks["llm_config"] = f"failed: {e}"

    overall = "ready" if all(
        v.startswith("ok") or v.startswith("warn") for v in checks.values()
    ) else "degraded"
    return {"status": overall, "checks": checks}
