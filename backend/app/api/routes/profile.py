"""Profile API routes — upload, get, patch, versions.

Endpoints (all under /api/profile):

- ``POST   /resume/upload``     multipart: upload a PDF/DOCX, kick off parse
- ``GET    /resume/upload/{id}`` poll parse status for an upload row
- ``GET    /``                  current Profile (latest parsed/manual)
- ``PATCH  /``                  edit profile fields, bump version
- ``GET    /versions``          version history (newest first)

Phase 2 has no auth. A ``get_current_user`` helper lazy-seeds the single
default user so downstream code can stay user-aware without ceremony.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session as _Session  # noqa: F401  (typing only)

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import get_db
from app.models.models import Profile, ProfileVersion, ResumeUpload
from app.schemas.schemas import ProfileOut, ProfileVersionOut, ResumeUploadOut
from app.services.resume_parser import (
    append_profile_version,
    get_or_create_default_user,
    parse_resume,
)
from app.services.text_extractor import SUPPORTED_TYPES, extract_text

router = APIRouter(prefix="/profile", tags=["profile"])
log = get_logger(__name__)

# Hard limits mirrored from the text extractor. Kept here too so the API
# layer rejects garbage before we even touch the filesystem.
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
_UPLOAD_SUFFIX_MAP = {"pdf": ".pdf", "docx": ".docx"}


# ── Helpers ───────────────────────────────────────────────────────────


def get_current_user(db: Session = Depends(get_db)):
    """Single-user MVP: lazy-seed the default user and return it.

    Wrapped in ``Depends`` so route signatures stay clean. Replaced by
    real auth in a later phase.
    """
    return get_or_create_default_user(db)


def _detect_file_type(file_name: str, content_type: str | None) -> str | None:
    """Map a filename + MIME to one of ``SUPPORTED_TYPES`` (or None)."""
    name = (file_name or "").lower()
    if name.endswith(".pdf"):
        return "pdf"
    if name.endswith(".docx"):
        return "docx"
    # Some browsers send application/msword for legacy .doc — refuse anyway
    # because python-docx can't read it.
    return None


# ── Routes ────────────────────────────────────────────────────────────


@router.post("/resume/upload")
async def upload_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Accept a PDF/DOCX, run text extraction inline, kick off the LLM parse.

    Returns immediately with ``{upload_id, status: "parsing"}`` — the parse
    itself runs in a FastAPI BackgroundTask so the client can poll.
    """
    file_type = _detect_file_type(file.filename or "", file.content_type)
    if file_type not in SUPPORTED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"unsupported file type — expected one of {list(SUPPORTED_TYPES)}",
        )

    # Read the body once and size-check before saving.
    body = await file.read()
    if len(body) == 0:
        raise HTTPException(status_code=400, detail="empty file")
    if len(body) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"file too large ({len(body)} bytes; max {_MAX_UPLOAD_BYTES})",
        )

    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    upload_id = str(uuid.uuid4())
    suffix = _UPLOAD_SUFFIX_MAP[file_type]
    disk_path = settings.upload_dir / f"{upload_id}{suffix}"
    disk_path.write_bytes(body)

    # Create the upload row in 'pending' so a synchronous extract failure
    # is recorded; flip to 'parsing' after extraction succeeds.
    upload = ResumeUpload(
        id=upload_id,
        user_id=user.id,
        file_name=file.filename or f"resume{suffix}",
        file_type=file_type,
        file_path=str(disk_path),
        file_size=len(body),
        status="pending",
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    # Text extraction is fast (sub-second for normal resumes), do it inline
    # so we can fail fast on corrupt/scanned files before returning.
    try:
        text = extract_text(disk_path, file_type)
    except (ValueError, RuntimeError) as e:
        upload.status = "failed"
        upload.error_message = f"extract_failed: {e}"[:1000]
        db.commit()
        db.refresh(upload)
        raise HTTPException(status_code=400, detail=str(e))

    upload.extracted_text = text
    upload.status = "parsing"
    db.commit()
    db.refresh(upload)

    # Hand the actual LLM parse off to the background so the client gets a
    # fast 202-like response (we use 200 with status='parsing').
    background_tasks.add_task(_safe_parse, upload.id)

    return {"upload_id": upload.id, "status": "parsing"}


async def _safe_parse(upload_id: str) -> None:
    """Background-task wrapper: parse, log + swallow exceptions.

    Errors are recorded on the upload row by ``parse_resume`` itself, so
    failing here just means the row stays in status='failed' — no need to
    crash the worker or surface to the user.
    """
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        await parse_resume(upload_id, db)
    except Exception as e:  # noqa: BLE001
        log.error("background_parse_failed", upload_id=upload_id, error=str(e))
    finally:
        db.close()


@router.get("/resume/upload/{upload_id}", response_model=ResumeUploadOut)
def get_upload_status(
    upload_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Poll endpoint: client calls this until status != 'parsing'."""
    upload = db.get(ResumeUpload, upload_id)
    if upload is None or upload.user_id != user.id:
        raise HTTPException(404, f"upload {upload_id} not found")
    return upload


@router.get("", response_model=ProfileOut)
def get_profile(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return the user's single Profile row, or 404 if no parse yet."""
    profile = db.execute(
        select(Profile).where(Profile.user_id == user.id).limit(1)
    ).scalar_one_or_none()
    if profile is None:
        raise HTTPException(404, "no profile yet — upload a resume first")
    return profile


@router.patch("", response_model=ProfileOut)
def patch_profile(
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Edit profile fields + append a new version row.

    Accepts a flat dict (subset of ``ProfileOut``). Only known columns are
    applied; unknown keys are ignored to keep the API forgiving.
    """
    profile = db.execute(
        select(Profile).where(Profile.user_id == user.id).limit(1)
    ).scalar_one_or_none()
    if profile is None:
        raise HTTPException(404, "no profile yet — upload a resume first")

    editable = {
        "name", "title", "email", "phone", "location",
        "linkedin", "github", "portfolio", "summary",
    }
    changed: list[str] = []
    for k, v in payload.items():
        if k in editable:
            setattr(profile, k, v)
            changed.append(k)
        elif k == "base_profile_json" and isinstance(v, dict):
            profile.base_profile_json = v
            changed.append(k)

    # Always bump the version after a manual edit, even if no scalar column
    # changed (e.g. user only touched the structured JSON).
    summary = (
        f"Manual edit ({', '.join(changed)})"
        if changed
        else "Manual edit (no tracked changes)"
    )
    append_profile_version(
        db, profile, profile.base_profile_json or {}, summary
    )
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/versions", response_model=list[ProfileVersionOut])
def list_versions(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return every ProfileVersion for the user's profile, newest first."""
    profile = db.execute(
        select(Profile).where(Profile.user_id == user.id).limit(1)
    ).scalar_one_or_none()
    if profile is None:
        return []
    rows = (
        db.query(ProfileVersion)
        .filter(ProfileVersion.profile_id == profile.id)
        .order_by(ProfileVersion.version_number.desc())
        .all()
    )
    return rows