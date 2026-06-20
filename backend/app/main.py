"""FastAPI app entry — single create_app() factory.

Test fixture and uvicorn both use the same ``app`` instance.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.middleware import RateLimitMiddleware
from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.session import Base, SessionLocal, engine
# Import models so they register with Base.metadata before create_all() runs.
# Without this, Base.metadata.tables is empty and no schema is created.
from app import models  # noqa: F401
from app.services.cv_renderer import reset_seed_cache, seed_default_templates  # Phase 10A


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    log = get_logger(__name__)

    # Ensure all storage subdirs exist (Settings also does this, but be safe).
    for d in (
        settings.storage_dir,
        settings.upload_dir,
        settings.cv_export_dir,
        settings.cl_export_dir,
        settings.raw_html_dir,
        settings.prompts_dir,
        settings.templates_dir,
        settings.log_dir,
    ):
        d.mkdir(parents=True, exist_ok=True)

    # Create schema on startup (idempotent — only creates missing tables).
    Base.metadata.create_all(bind=engine)
    log.info("schema_ready", tables=len(Base.metadata.tables))

    # Phase 10A: force seed check on every cold start so newly-added
    # presets land in the DB even if the previous process had the
    # module-level cache flag set to ``done``. Also triggers the
    # idempotent upgrade-merge for presets that pre-date the new
    # styling keys (font_family / accent_color / density / ...).
    reset_seed_cache()
    with SessionLocal() as _seed_db:
        seed_default_templates(_seed_db)
        # Phase 10B: one-shot migration from configs/llm_providers.json.
        # Idempotent — no-op if the DB already has rows.
        from app.llm.store import seed_from_json_if_empty

        seeded = seed_from_json_if_empty(_seed_db)
        if seeded:
            log.info("llm_seeded_from_legacy", count=seeded)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        docs_url="/docs" if settings.debug else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Phase 9C: per-IP rate limiting (in-memory, single-process).
    # Exempt /api/health (probes), docs routes, /api/templates/preview
    # (preview is called on every keystroke from the TemplatesPage editor —
    # without exemption, users hit 429 while iterating on a design), and
    # /api/llm-providers/{id}/test (settings page "Test connection" button —
    # users may click it several times in a row while debugging).
    app.add_middleware(
        RateLimitMiddleware,
        requests_per_minute=settings.rate_limit_rpm,
        exempt_paths=(
            "/api/health",
            "/docs",
            "/openapi.json",
            "/api/templates/preview",
            "/api/llm-providers",  # single-user mode — exempt all CRUD + /test
        ),
    )

    app.include_router(api_router)

    @app.exception_handler(Exception)
    async def _unhandled(request, exc):  # noqa: ANN001
        log.error("unhandled_exception", path=str(request.url), error=str(exc), exc_type=type(exc).__name__)
        return JSONResponse(status_code=500, content={"detail": "internal server error"})

    log.info("app_ready", env=settings.environment, port=settings.port)
    return app


app = create_app()
