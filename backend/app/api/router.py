"""API router aggregator — all routes are mounted under /api here."""
from fastapi import APIRouter

from app.api.routes import (
    applications,  # Phase 9B
    cover_letters,  # Phase 9A
    cvs,
    health,
    jobs,
    matches,
    profile,
    settings,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(settings.router)
api_router.include_router(profile.router)
api_router.include_router(jobs.router)
api_router.include_router(matches.router)
api_router.include_router(cvs.router)
api_router.include_router(cover_letters.router)  # Phase 9A
api_router.include_router(applications.router)  # Phase 9B
