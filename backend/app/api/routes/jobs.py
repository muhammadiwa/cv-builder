"""Job intake + analysis API routes.

Two intake paths:
- POST /jobs with source_type='url' → scrape + analyze
- POST /jobs with source_type='manual' → analyze only

Background tasks handle the async scrape/analyze so the POST returns
immediately with a job_id; client polls for status.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.models import Job
from app.schemas.schemas import JobIn, JobOut
from app.services.job_scraper import (
    ContentTooLargeError,
    EmptyContentError,
    FetchError,
    InvalidURLError,
    scrape_job,
)
from app.services.jd_analyzer import analyze_jd
from app.services.resume_parser import get_or_create_default_user

log = get_logger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Dependencies ────────────────────────────────────────────────

def get_current_user(db: Session = Depends(get_db)):
    """Single-user mode: return the default seeded user (or create)."""
    return get_or_create_default_user(db)


# ── Helpers ─────────────────────────────────────────────────────

def _job_to_out(job: Job) -> JobOut:
    """Serialize Job ORM → JobOut, dropping soft-deleted rows safely."""
    return JobOut.model_validate(job)


def _safe_scrape_and_analyze(job_id: str) -> None:
    """Background wrapper: scrape URL → update raw_description → analyze.

    Errors are swallowed into the Job row so the client can see them
    via GET /jobs/{id}. Raises are logged but never propagated.
    """
    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if job is None:
            log.error("safe_scrape_job_not_found", job_id=job_id)
            return

        # 1) Scrape if URL
        if job.source_type == "url" and job.source_url:
            try:
                result = scrape_job(job.source_url)
                job.raw_description = result.text
                job.scraped_at = _utcnow()
                job.status = "parsing"
                db.commit()
            except (InvalidURLError, FetchError, ContentTooLargeError, EmptyContentError) as e:
                job.status = "failed"
                job.error_message = f"scrape_failed: {e}"[:1000]
                db.commit()
                log.error("scrape_failed", job_id=job_id, error=str(e))
                return
            except Exception as e:  # noqa: BLE001
                job.status = "failed"
                job.error_message = f"scrape_unexpected: {e}"[:1000]
                db.commit()
                log.error("scrape_unexpected", job_id=job_id, error=str(e))
                return

        # 2) Analyze (LLM)
        try:
            import asyncio
            asyncio.run(analyze_jd(job_id, db))
        except Exception as e:  # noqa: BLE001
            # analyze_jd itself handles status='failed' on known errors,
            # but catch anything that bubbles up here as a safety net.
            job = db.get(Job, job_id)
            if job and job.status != "failed":
                job.status = "failed"
                job.error_message = f"analyze_unexpected: {e}"[:1000]
                db.commit()
            log.error("safe_analyze_unexpected", job_id=job_id, error=str(e))
    finally:
        db.close()


# ── Routes ──────────────────────────────────────────────────────

@router.post("", response_model=JobOut, status_code=201)
async def create_job(
    payload: JobIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Create a job from URL or manual JD. Kicks off background work."""
    # Validate URL path
    if payload.source_type == "url":
        if not payload.source_url:
            raise HTTPException(status_code=400, detail="source_url required for source_type='url'")
    elif payload.source_type == "manual":
        if not payload.raw_description or not payload.raw_description.strip():
            raise HTTPException(status_code=400, detail="raw_description required for source_type='manual'")

    # Pre-fill title/company if user provided them (manual path usually does)
    job = Job(
        user_id=user.id,
        source_type=payload.source_type,
        source_url=payload.source_url,
        raw_description=payload.raw_description if payload.source_type == "manual" else "",
        title=payload.title,
        company=payload.company,
        location=payload.location,
        remote=payload.remote,
        employment_type=payload.employment_type,
        seniority=payload.seniority,
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        salary_currency=payload.salary_currency,
        job_analysis_json=payload.job_analysis_json,
        ats_keywords_json=payload.ats_keywords_json,
        status="scraping" if payload.source_type == "url" else "parsing",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Kick off background work
    background_tasks.add_task(_safe_scrape_and_analyze, job.id)

    return _job_to_out(job)


@router.get("", response_model=list[JobOut])
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List active (non-deleted) jobs, newest first."""
    stmt = (
        select(Job)
        .where(Job.user_id == user.id, Job.deleted_at.is_(None))
        .order_by(Job.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    jobs = db.execute(stmt).scalars().all()
    return [_job_to_out(j) for j in jobs]


@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get one job by id with full analysis."""
    job = db.get(Job, job_id)
    if job is None or job.user_id != user.id or job.deleted_at is not None:
        raise HTTPException(status_code=404, detail="job not found")
    return _job_to_out(job)


@router.delete("/{job_id}", status_code=204)
def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Soft-delete: sets deleted_at timestamp, leaves row for audit."""
    job = db.get(Job, job_id)
    if job is None or job.user_id != user.id or job.deleted_at is not None:
        raise HTTPException(status_code=404, detail="job not found")
    job.deleted_at = _utcnow()
    db.commit()
    return None