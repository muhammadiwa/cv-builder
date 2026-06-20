"""Phase 9B — Application tracking routes.

Endpoints:
- GET    /api/applications              list the user's applications
- POST   /api/applications              create a new application
- GET    /api/applications/{id}         get one
- PATCH  /api/applications/{id}         edit fields
- POST   /api/applications/{id}/status  transition status (e.g. ready→applied)
- DELETE /api/applications/{id}         delete

All routes verify ownership via job_id chain (application → job → user_id).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import Application, Job, User
from app.schemas.schemas import ApplicationIn, ApplicationOut, ApplicationStatus

from .jobs import get_current_user

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/applications", tags=["applications"])


# ── Helpers ─────────────────────────────────────────────────────────


def _get_owned_application(
    db: Session, application_id: str, user: User
) -> Application:
    """Fetch an application and verify ownership via the job chain."""
    app = db.get(Application, application_id)
    if app is None:
        raise HTTPException(404, f"application {application_id} not found")
    job = db.get(Job, app.job_id)
    if job is None or job.user_id != user.id:
        raise HTTPException(403, "not your application")
    return app


def _serialize(app: Application) -> dict[str, Any]:
    """ORM → dict matching ApplicationOut shape."""
    return {
        "id": app.id,
        "job_id": app.job_id,
        "cv_draft_id": app.cv_draft_id,
        "cover_letter_id": app.cover_letter_id,
        "status": app.status,
        "applied_date": app.applied_date,
        "follow_up_date": app.follow_up_date,
        "contact_person": app.contact_person,
        "contact_email": app.contact_email,
        "notes": app.notes,
        "created_at": app.created_at,
        "updated_at": app.updated_at,
    }


# ── Routes ──────────────────────────────────────────────────────────


@router.get("", response_model=list[ApplicationOut])
def list_applications(
    status: ApplicationStatus | None = Query(None, description="Filter by status"),
    job_id: str | None = Query(None, description="Filter by job"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List the user's applications, newest updated first."""
    q = (
        db.query(Application)
        .join(Job, Application.job_id == Job.id)
        .filter(Job.user_id == user.id)
    )
    if status is not None:
        q = q.filter(Application.status == status)
    if job_id is not None:
        q = q.filter(Application.job_id == job_id)
    rows = q.order_by(Application.updated_at.desc()).limit(limit).all()
    return [_serialize(r) for r in rows]


@router.post("", response_model=ApplicationOut, status_code=201)
def create_application(
    payload: ApplicationIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a new application. Job must belong to user."""
    job = db.get(Job, payload.job_id)
    if job is None:
        raise HTTPException(404, f"job {payload.job_id} not found")
    if job.user_id != user.id:
        raise HTTPException(403, "not your job")

    # Enforce one active application per job (allow re-create only after delete)
    existing = (
        db.query(Application).filter(Application.job_id == payload.job_id).first()
    )
    if existing is not None:
        raise HTTPException(409, f"application already exists for job {payload.job_id}")

    app = Application(
        job_id=payload.job_id,
        cv_draft_id=payload.cv_draft_id,
        cover_letter_id=payload.cover_letter_id,
        status=payload.status,
        applied_date=payload.applied_date,
        follow_up_date=payload.follow_up_date,
        contact_person=payload.contact_person,
        contact_email=payload.contact_email,
        notes=payload.notes,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    log.info("application_created", application_id=app.id, job_id=app.job_id, status=app.status)
    return _serialize(app)


@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Get one application."""
    app = _get_owned_application(db, application_id, user)
    return _serialize(app)


@router.patch("/{application_id}", response_model=ApplicationOut)
def patch_application(
    application_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Edit application fields (status, dates, contact, notes)."""
    app = _get_owned_application(db, application_id, user)
    allowed = {
        "cv_draft_id",
        "cover_letter_id",
        "status",
        "applied_date",
        "follow_up_date",
        "contact_person",
        "contact_email",
        "notes",
    }
    changes: list[str] = []
    for key, value in payload.items():
        if key not in allowed:
            continue
        # If transitioning to "applied" for the first time, stamp applied_date
        if key == "status" and value == "applied" and app.applied_date is None:
            app.applied_date = datetime.now(timezone.utc)
            changes.append("applied_date=auto")
        setattr(app, key, value)
        changes.append(key)
    db.commit()
    db.refresh(app)
    log.info(
        "application_patched",
        application_id=app.id,
        changes=changes,
    )
    return _serialize(app)


@router.post("/{application_id}/status", response_model=ApplicationOut)
def transition_status(
    application_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Convenience endpoint for status transitions. Auto-stamps applied_date
    when moving to 'applied' for the first time."""
    new_status = payload.get("status")
    if new_status not in ("draft", "ready", "applied", "interview", "rejected", "offer"):
        raise HTTPException(400, f"invalid status: {new_status}")
    app = _get_owned_application(db, application_id, user)
    if new_status == "applied" and app.applied_date is None:
        app.applied_date = datetime.now(timezone.utc)
    app.status = new_status
    db.commit()
    db.refresh(app)
    log.info(
        "application_status_changed",
        application_id=app.id,
        new_status=new_status,
    )
    return _serialize(app)


@router.delete("/{application_id}", status_code=204, response_class=Response)
def delete_application(
    application_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Delete an application."""
    app = _get_owned_application(db, application_id, user)
    db.delete(app)
    db.commit()
    log.info("application_deleted", application_id=application_id)
    return Response(status_code=204)