"""API router aggregator — all routes are mounted under /api here."""
from fastapi import APIRouter

from app.api.routes import health, settings, profile, jobs, matches

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(settings.router)
api_router.include_router(profile.router)
api_router.include_router(jobs.router)
api_router.include_router(matches.router)
