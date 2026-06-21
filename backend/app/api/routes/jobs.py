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
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.models import Job
from app.schemas.schemas import JobIn, JobListItem, JobOut, PaginatedJobsOut
from app.services.job_scraper import (
    ContentTooLargeError,
    EmptyContentError,
    FetchError,
    InvalidURLError,
    SSRFBlockedError,
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


_SCRAPE_EXC = (
    InvalidURLError,
    SSRFBlockedError,
    FetchError,
    ContentTooLargeError,
    EmptyContentError,
)


def _fail_job(db: Session, job_id: str, stage: str, exc: Exception) -> None:
    """Mark a job as failed and log. Helper extracted from
    ``_safe_scrape_and_analyze`` to keep the wrapper flat (B10)."""
    job = db.get(Job, job_id)
    if job is None:
        log.error("safe_scrape_job_vanished", job_id=job_id)
        return
    job.status = "failed"
    job.error_message = f"{stage}_failed: {exc}"[:1000]
    db.commit()
    log.error(f"{stage}_failed", job_id=job_id, error=str(exc))


async def _safe_scrape_and_analyze_async(job_id: str) -> None:
    """Async core: scrape URL → analyze → score.

    Split out from the BackgroundTasks-compatible sync wrapper so we can
    avoid ``asyncio.run`` in a sync context (B13). The wrapper below just
    bridges to this coroutine via a single ``asyncio.run`` call.

    Errors are swallowed into the Job / JobMatch rows so the client can
    see them via GET /jobs/{id} or the match summaries endpoint. Raises
    are logged but never propagated.

    Phase 10E: the deterministic match score is now computed as part of
    the same background task, right after analysis completes. The user
    no longer has to trigger a separate "compute match" call — the
    JobCard just polls /matches/summaries and the score shows up
    automatically once this task finishes.
    """
    from app.db.session import SessionLocal
    # Imported inside the function so the route module doesn't create a
    # circular import (matches imports from jobs via _safe_scrape helper
    # below, which is fine, but the OTHER way around would loop).
    from app.api.routes.matches import _compute_and_persist_match

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
                job.extractor_used = result.extractor_used  # B11 fix
                job.scraped_at = _utcnow()
                job.status = "parsing"
                db.commit()
            except _SCRAPE_EXC as e:
                _fail_job(db, job_id, "scrape", e)
                return
            except Exception as e:  # noqa: BLE001
                _fail_job(db, job_id, "scrape_unexpected", e)
                return

        # 2) Analyze (LLM) — same DB session so any LLM-call logging
        # lands on the same transactional context.
        try:
            await analyze_jd(job_id, db)
        except Exception as e:  # noqa: BLE001
            # analyze_jd handles status='failed' on known errors;
            # anything that bubbles up is a safety net.
            job = db.get(Job, job_id)
            if job and job.status != "failed":
                _fail_job(db, job_id, "analyze_unexpected", e)
            else:
                log.error("safe_analyze_unexpected", job_id=job_id, error=str(e))
            return  # ← no match if analysis failed

        # 3) Score (deterministic + LLM narrative) — runs in the same
        # task so the FE just polls one endpoint and gets both analysis
        # AND score. Skipped silently when there's no profile yet (the
        # job is still useful without a score; the FE shows "Profile
        # needed").
        job = db.get(Job, job_id)
        if job and job.status == "parsed" and job.job_analysis_json:
            try:
                await _compute_and_persist_match(db, job, job.user_id, fast=False)
            except Exception as e:  # noqa: BLE001
                log.warning(
                    "auto_match_unexpected", job_id=job_id, error=str(e)[:200],
                )
                # Don't fail the job — just log and move on. The user
                # can still hit POST /api/matches/jobs/{id}/match
                # manually to retry.
        else:
            log.info("auto_match_skipped", job_id=job_id, status=job.status if job else "missing")
    finally:
        db.close()


def _safe_scrape_and_analyze(job_id: str) -> None:
    """BackgroundTasks-compatible sync entry point.

    Bridges to the async coroutine. ``asyncio.run`` here is OK because
    BackgroundTasks runs the function in a worker thread, so we never
    collide with the event loop the request thread is on (B13).
    """
    import asyncio
    asyncio.run(_safe_scrape_and_analyze_async(job_id))


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
        # Dedup: reject if the same URL was already submitted (and not soft-deleted).
        # The DB unique index is the source of truth — this is just a friendly
        # 409 that returns the existing job_id so the client can navigate to it.
        existing = db.execute(
            select(Job).where(
                Job.user_id == user.id,
                Job.source_url == payload.source_url,
                Job.deleted_at.is_(None),
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "error": "duplicate_job",
                    "message": f"This URL was already submitted on {existing.created_at.isoformat()}",
                    "existing_job_id": existing.id,
                },
            )
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


@router.get("", response_model=PaginatedJobsOut)
def list_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List active (non-deleted) jobs, newest first.

    Phase 10E: paginated response — returns { items, total, skip,
    limit, has_more } instead of a bare list. The total is a
    separate COUNT query (cached for 60s via the user index); the
    items query is a standard SELECT ... ORDER BY ... LIMIT/OFFSET.

    The previous bare-list shape is kept as a fallback for
    CoverLettersPage (which uses limit=100 and reads the full set
    in one shot) via the `?paginated=false` query param.
    """
    # Build the user-scoped filter once, reuse for both the items
    # query and the count query.
    base_filter = (Job.user_id == user.id, Job.deleted_at.is_(None))

    # Total count — separate query so the FE can drive pagination UI.
    total: int = db.execute(
        select(func.count()).select_from(Job).where(*base_filter)
    ).scalar_one()

    items_stmt = (
        select(Job)
        .where(*base_filter)
        .order_by(Job.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    jobs = db.execute(items_stmt).scalars().all()

    return PaginatedJobsOut(
        items=[JobListItem.model_validate(j) for j in jobs],
        total=total,
        skip=skip,
        limit=limit,
        has_more=(skip + limit) < total,
    )


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


@router.post("/{job_id}/reanalyze", response_model=JobOut, status_code=202)
async def reanalyze_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Re-run scrape (if URL) + analysis on an existing failed job.

    Resets status to scraping/parsing, clears prior error_message and
    analysis fields, then kicks off the same background pipeline as the
    create endpoint. Useful when:
      - The source page was fixed/temporarily down.
      - The LLM provider had a transient error.
      - The user wants to retry after editing raw_description manually
        (Phase 5+ — once we expose that editor).

    Already-pending jobs (scraping/parsing) are idempotent: returns 409
    so the client doesn't double-fire the worker.
    """
    job = db.get(Job, job_id)
    if job is None or job.user_id != user.id or job.deleted_at is not None:
        raise HTTPException(status_code=404, detail="job not found")
    if job.status in ("scraping", "parsing"):
        raise HTTPException(
            status_code=409,
            detail=f"job is already {job.status}; wait for it to finish",
        )

    # Reset state so the analyzer sees a clean slate.
    job.error_message = None
    job.job_analysis_json = {}
    job.ats_keywords_json = {}
    # Title/company/etc. stay — they're either from the user's manual
    # payload (still valid) or stale from the failed scrape. The analyzer
    # will overwrite them if the new scrape succeeds.
    job.status = "scraping" if job.source_type == "url" else "parsing"
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_safe_scrape_and_analyze, job.id)
    return _job_to_out(job)