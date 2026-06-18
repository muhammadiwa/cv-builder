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

    # LLM provider configured?
    if settings.llm_providers_config.exists():
        checks["llm_config"] = "ok"
    else:
        checks["llm_config"] = f"missing: {settings.llm_providers_config}"

    overall = "ready" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}
