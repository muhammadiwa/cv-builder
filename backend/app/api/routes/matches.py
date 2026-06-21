"""Phase 5 — Match API routes.

POST /api/jobs/{job_id}/match  — compute/refresh a match for a parsed job.
GET  /api/jobs/{job_id}/match  — read the latest match for a job.
DELETE /api/jobs/{job_id}/match — clear the match record.
GET  /api/matches/summaries     — ultra-light match summaries for the
                                  listing grid (Phase 10D: no breakdown
                                  or per-skill detail, just score +
                                  recommendation + confidence per job).

We store the match in the existing ``job_matches`` table; the columns were
defined in Phase 2 as generic JSON containers. The mapping from the
``MatchResult`` dataclass to those columns is::

    match_score          → result.score
    risk_level           → result.recommendation ("apply" | "stretch" | "skip")
    score_breakdown_json → {skill, experience, seniority, education}
    matched_items_json   → [SkillMatchDetail, ...]
    missing_items_json   → [SkillMatchDetail, ...]
    strategy_json        → {experience, seniority, education, llm_summary}
    recommendations_json → [llm_strength, ...]
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.models import Job, JobMatch, Profile
from app.schemas.schemas import JobMatchOut, JobMatchSummary, SkillMatchDetail
from app.services.matcher import MatchResult, compute_match
from app.services.match_narrator import narrate_match

from .jobs import get_current_user


log = get_logger("matches_api")

router = APIRouter(tags=["matches"])


# ── Helpers ──────────────────────────────────────────────────────────


def _load_profile(db: Session, user_id: str) -> tuple[dict[str, Any], str]:
    """Return (profile_dict, profile_id). Raises 400 if no profile yet."""
    profile = db.execute(
        select(Profile).where(Profile.user_id == user_id).limit(1)
    ).scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=400,
            detail="no profile yet — upload a resume first",
        )
    return _profile_to_dict(profile), profile.id


def _profile_to_dict(profile: Profile) -> dict[str, Any]:
    """Coerce ORM Profile → plain dict for the deterministic matcher.

    The Profile row keeps the canonical fields as columns and stores the
    structured section (skills, work, education, …) in ``base_profile_json``.
    The matcher wants a single dict; we merge both into its expected shape.
    """
    base = profile.base_profile_json or {}
    out: dict[str, Any] = {
        "name": profile.name,
        "title": profile.title,
        "email": profile.email,
        "phone": profile.phone,
        "location": profile.location,
        "linkedin": str(profile.linkedin) if profile.linkedin else None,
        "github": str(profile.github) if profile.github else None,
        "skills": base.get("skills") or [],
        "work": base.get("work") or [],
        "education": base.get("education") or [],
        "seniority": base.get("seniority"),
    }
    return out


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _match_to_out(m: JobMatch) -> JobMatchOut:
    """ORM JobMatch → JobMatchOut Pydantic.

    Reads the legacy JSON containers and re-projects them into the rich
    Phase 5 schema (score_breakdown, matched_skills, llm, etc).

    Stays a sync helper — it just unwraps JSON, no DB I/O. The route
    handler above owns the async LLM narration + persistence.
    """
    breakdown = m.score_breakdown_json or {}
    strategy = m.strategy_json or {}

    matched = [
        SkillMatchDetail(
            required_skill=item.get("required_skill", ""),
            required_keyword=item.get("required_keyword", ""),
            matched_keyword=item.get("matched_keyword"),
            strength=float(item.get("strength", 0.0)),
            match_method=item.get("match_method"),  # L2 fix
        )
        for item in (m.matched_items_json or [])
    ]
    missing = [
        SkillMatchDetail(
            required_skill=item.get("required_skill", ""),
            required_keyword=item.get("required_keyword", ""),
            matched_keyword=None,
            strength=0.0,
            match_method=None,
        )
        for item in (m.missing_items_json or [])
    ]

    # L2 fix: telemetry from the persisted matched_items_json (falls
    # back to zeroed counters for legacy rows without match_method).
    telemetry: dict[str, int] = {"exact": 0, "substring": 0, "fuzzy": 0}
    for item in (m.matched_items_json or []):
        method = item.get("match_method")
        if method in telemetry:
            telemetry[method] += 1

    return JobMatchOut(
        id=m.id,
        job_id=m.job_id,
        profile_id=m.profile_id,
        match_score=m.match_score,
        recommendation=m.risk_level,  # "apply" | "stretch" | "skip"
        score_breakdown={
            "skill": float(breakdown.get("skill", 0.0)),
            "experience": float(breakdown.get("experience", 0.0)),
            "seniority": float(breakdown.get("seniority", 0.0)),
            "education": float(breakdown.get("education", 0.0)),
        },
        matched_skills=matched,
        missing_skills=missing,
        experience=strategy.get("experience") or {
            "required_years": None, "profile_years": None, "status": "unknown",
        },
        seniority=strategy.get("seniority") or {
            "job_seniority": None, "profile_seniority": None, "status": "unknown",
        },
        education=strategy.get("education") or {
            "required": None, "profile": None, "status": "unknown",
        },
        llm=(
            {
                "summary": strategy.get("llm_summary"),
                "strengths": m.recommendations_json or [],
                "gaps": strategy.get("llm_gaps") or [],
            }
            if strategy.get("llm_summary") or m.recommendations_json or strategy.get("llm_gaps")
            else None
        ),
        confidence_score=None,
        match_telemetry=telemetry,
        created_at=m.created_at,
        updated_at=m.created_at,  # JobMatch has no updated_at column yet
    )


def _persist_match(
    db: Session, job_id: str, profile_id: str, result: MatchResult, llm: dict | None,
) -> JobMatch:
    """Upsert the match into job_matches."""
    now = _utcnow()
    existing = db.execute(
        select(JobMatch).where(
            JobMatch.job_id == job_id, JobMatch.profile_id == profile_id,
        )
    ).scalar_one_or_none()

    breakdown = {
        "skill": result.skill_score,
        "experience": result.experience_score,
        "seniority": result.seniority_score,
        "education": result.education_score,
    }
    matched_payload = [
        {
            "required_skill": m.required_skill,
            "required_keyword": m.required_keyword,
            "matched_keyword": m.matched_keyword,
            "strength": m.strength,
            "match_method": m.match_method,  # L2 fix: telemetry attribute
        }
        for m in result.matched
    ]
    missing_payload = [
        {
            "required_skill": m.required_skill,
            "required_keyword": m.required_keyword,
            "matched_keyword": None,
            "strength": m.strength,
        }
        for m in result.missing
    ]
    strategy = {
        "experience": (
            {
                "required_years": result.experience.required_years,
                "profile_years": result.experience.profile_years,
                "status": result.experience.status,
            }
            if result.experience else None
        ),
        "seniority": (
            {
                "job_seniority": result.seniority.job_seniority,
                "profile_seniority": result.seniority.profile_seniority,
                "status": result.seniority.status,
            }
            if result.seniority else None
        ),
        "education": (
            {
                "required": result.education.required,
                "profile": result.education.profile,
                "status": result.education.status,
            }
            if result.education else None
        ),
        "llm_summary": llm.get("summary") if llm else None,
        "llm_gaps": llm.get("gaps") if llm else [],
    }
    recs = llm.get("strengths") if llm else []

    if existing is None:
        row = JobMatch(
            job_id=job_id,
            profile_id=profile_id,
            match_score=result.score,
            risk_level=result.recommendation,
            score_breakdown_json=breakdown,
            matched_items_json=matched_payload,
            missing_items_json=missing_payload,
            strategy_json=strategy,
            recommendations_json=recs,
            created_at=now,
        )
        db.add(row)
    else:
        existing.match_score = result.score
        existing.risk_level = result.recommendation
        existing.score_breakdown_json = breakdown
        existing.matched_items_json = matched_payload
        existing.missing_items_json = missing_payload
        existing.strategy_json = strategy
        existing.recommendations_json = recs
        # NOTE: no updated_at column on the JobMatch model yet — we rely on
        # created_at as the canonical timestamp for "latest match" queries.
        row = existing

    db.commit()
    db.refresh(row)
    return row


# ── Routes ───────────────────────────────────────────────────────────


@router.post("/jobs/{job_id}/match", response_model=JobMatchOut, status_code=200)
async def compute_or_refresh_match(
    job_id: str,
    background_tasks: BackgroundTasks,
    fast: bool = Query(
        False,
        description=(
            "M3 fix: when true, skip the LLM narrator and return only the "
            "deterministic score. Useful for instant refreshes / batch "
            "recompute / mobile clients on slow networks."
        ),
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Compute (or refresh) the match for this job.

    - 404 if the job doesn't exist or is soft-deleted
    - 400 if the job hasn't been parsed yet (need the LLM analysis first)
    - 400 if the user has no profile yet
    - 200 with the match payload (LLM narrative runs sync unless
      ``?fast=true``; may be None if the provider fails — the
      deterministic score is still returned).
    """
    job = db.get(Job, job_id)
    if job is None or job.user_id != user.id or job.deleted_at is not None:
        raise HTTPException(404, "job not found")
    if job.status != "parsed" or not job.job_analysis_json:
        raise HTTPException(
            400,
            f"job is not yet parsed (status={job.status!r}) — analyze first",
        )

    row = await _compute_and_persist_match(db, job, user.id, fast=fast)
    return _match_to_out(row)


async def _compute_and_persist_match(
    db: Session,
    job: Job,
    user_id: str,
    fast: bool = False,
) -> JobMatch | None:
    """Pipeline-friendly match computation: deterministic score + LLM
    narrative, persisted to the JobMatch table.

    Returns the JobMatch row on success, None when:
      - the user has no profile yet (skipped silently — the job is
        still useful without a score; the FE shows "Profile needed")
      - the deterministic match raised (very rare — logged)

    Used by:
      1. POST /api/matches/jobs/{id}/match (synchronous endpoint)
      2. The job-create background task `_safe_scrape_and_analyze`
         so every new job gets scored automatically after analysis.

    Errors that bubble up here are the caller's problem; we don't
    swallow them.
    """
    try:
        profile_dict, profile_id = _load_profile(db, user_id)
    except Exception as e:  # noqa: BLE001
        log.info("match_skipped_no_profile", job_id=job.id, error=str(e)[:200])
        return None

    if fast:
        # ?fast=true is for batch refreshes that don't need the LLM
        # narrative or AI scorer. Just deterministic score, no AI.
        try:
            result = compute_match(profile_dict, job.job_analysis_json)
        except Exception as e:  # noqa: BLE001
            log.warning("compute_match_unexpected", job_id=job.id, error=str(e)[:200])
            return None
        return _persist_match(db, job.id, profile_id, result, llm=None)

    # Phase 10E: full AI scoring. The LLM scores the candidate with a
    # calibrated rubric and returns evidence-based dimensions. Falls
    # back to the deterministic matcher if AI fails twice in a row.
    from app.services.ai_matcher import ai_score_match

    try:
        result, _ai_raw = await ai_score_match(profile_dict, job.job_analysis_json)
    except Exception as e:  # noqa: BLE001
        log.warning("ai_score_match_unexpected", job_id=job.id, error=str(e)[:200])
        try:
            result = compute_match(profile_dict, job.job_analysis_json)
        except Exception as e2:  # noqa: BLE001
            log.warning("compute_match_unexpected", job_id=job.id, error=str(e2)[:200])
            return None

    # The narrative (Indonesian 2-3 sentences + actionable advice)
    # is generated separately. It describes the score, doesn't
    # determine it. Failures here don't affect the score.
    try:
        llm = await narrate_match(result, db)
    except Exception as e:  # noqa: BLE001
        log.warning("narrate_match_unexpected", error=str(e)[:200])
        llm = None

    return _persist_match(db, job.id, profile_id, result, llm)


@router.get("/jobs/{job_id}/match", response_model=JobMatchOut)
def get_match(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return the latest match for this job, or 404 if none computed."""
    job = db.get(Job, job_id)
    if job is None or job.user_id != user.id or job.deleted_at is not None:
        raise HTTPException(404, "job not found")

    match = db.execute(
        select(JobMatch).where(JobMatch.job_id == job_id)
    ).scalar_one_or_none()
    if match is None:
        raise HTTPException(404, "no match computed yet")
    return _match_to_out(match)


@router.delete("/jobs/{job_id}/match", status_code=204)
def delete_match(
    job_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Remove the match record for this job."""
    job = db.get(Job, job_id)
    if job is None or job.user_id != user.id or job.deleted_at is not None:
        raise HTTPException(404, "job not found")

    match = db.execute(
        select(JobMatch).where(JobMatch.job_id == job_id)
    ).scalar_one_or_none()
    if match is None:
        raise HTTPException(404, "no match to delete")

    db.delete(match)
    db.commit()
    return None

# ── Phase 10D: bulk match summaries for the listing grid ──────────────


@router.get("/matches/summaries", response_model=list[JobMatchSummary])
def list_match_summaries(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return one JobMatchSummary per job that has a match.

    Scoped to jobs the current user owns (via user_id on Job). Jobs
    without a match are simply absent from the response — the FE
    uses the absence as the "no score yet" state.

    This is intentionally a separate endpoint from /api/jobs so the
    jobs list payload stays focused on job metadata. The summaries
    endpoint is one query, one row per matched job, and the FE
    indexes it by job_id in a Map for O(1) lookup per card.
    """
    stmt = (
        select(JobMatch, Job)
        .join(Job, JobMatch.job_id == Job.id)
        .where(Job.user_id == user.id, Job.deleted_at.is_(None))
    )
    rows = db.execute(stmt).all()
    out: list[JobMatchSummary] = []
    for m, _j in rows:
        out.append(
            JobMatchSummary(
                job_id=m.job_id,
                match_score=m.match_score,
                recommendation=m.risk_level,  # apply | stretch | skip
                confidence_score=None,  # populated when we wire LLM confid
                created_at=m.created_at,
            )
        )
    return out
