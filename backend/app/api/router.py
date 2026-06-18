"""API router aggregator — all routes are mounted under /api here."""
from fastapi import APIRouter

from app.api.routes import health, settings

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(settings.router)
