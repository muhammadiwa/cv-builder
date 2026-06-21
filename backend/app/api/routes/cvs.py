"""CV routes — CRUD + render + LLM enhance.

The CV is the heart of the app's output. The flow:

1. ``POST /api/cvs`` — generate a CV draft from a profile (optionally
   job-targeted). Returns the draft id + initial rendered HTML.
2. ``GET  /api/cvs`` — list all CV drafts for the user.
3. ``GET  /api/cvs/{id}`` — get one draft + the latest rendered HTML.
4. ``PATCH /api/cvs/{id}`` — manually update ``cv_json`` (e.g. user edited
   a bullet). Re-renders HTML.
5. ``POST /api/cvs/{id}/enhance`` — run LLM on a section (summary,
   one experience entry, or skills). Returns the enhanced text.
6. ``GET  /api/cvs/{id}/render?format=html|markdown`` — re-render on demand.
7. ``DELETE /api/cvs/{id}`` — delete a draft.

All routes are scoped to the seeded user (single-user app for now — same
pattern as the rest of the API).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import structlog

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.models import CVDraft, CVVersion, Job, Profile, Template, User
from app.schemas.schemas import (
    CVDraftIn,
    CVDraftOut,
    CVEnhanceIn,
    CVRenderOut,
    CVRecommendationItem,
    CVScoreOut,
    CVScoreRecommendation,
    CVVersionOut,
    ExportOut,
)
from app.services.cv_enhancer import enhance_cv_summary, enhance_job_bullets
from app.services.cv_scorer import score_cv
from app.services.cv_renderer import (
    DEFAULT_TEMPLATE_ID,
    SECTION_SKILLS,
    SECTION_SUMMARY,
    build_cv_doc_from_json,
    default_template_config,
    render_cv,
    render_html_document,
    seed_default_templates,
)
from .jobs import get_current_user

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/cvs", tags=["cvs"])


# ── Helpers ────────────────────────────────────────────────────────
def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _load_profile(db: Session, profile_id: str) -> Profile:
    p = db.get(Profile, profile_id)
    if p is None:
        raise HTTPException(404, f"profile {profile_id} not found")
    return p


def _load_job(db: Session, job_id: str) -> Job:
    j = db.get(Job, job_id)
    if j is None:
        raise HTTPException(404, f"job {job_id} not found")
    return j


def _load_template(db: Session, template_id: str) -> Template:
    t = db.get(Template, template_id)
    if t is None:
        # Fall back to default
        t = db.get(Template, DEFAULT_TEMPLATE_ID)
    return t


def _save_version(
    db: Session,
    draft: CVDraft,
    change_summary: str,
) -> CVVersion:
    """Persist a snapshot of ``draft.cv_json`` to ``cv_versions``.

    Called from ``create_cv``, ``patch_cv``, and ``enhance_cv_section``
    so the user can later browse or restore earlier states via
    ``GET /api/cvs/{id}/versions`` and
    ``POST /api/cvs/{id}/versions/{vid}/restore``.

    The version number is monotonic per draft (1, 2, 3, …) — the latest
    snapshot corresponds to the live ``cv_json``. ``change_summary`` is a
    free-form human label (e.g. "LLM-enhanced summary").
    """
    last = (
        db.query(CVVersion)
        .filter(CVVersion.cv_draft_id == draft.id)
        .order_by(CVVersion.version_number.desc())
        .first()
    )
    next_num = (last.version_number + 1) if last else 1
    ver = CVVersion(
        cv_draft_id=draft.id,
        version_number=next_num,
        cv_json=draft.cv_json or {},
        score=draft.score or 0.0,
        change_summary=change_summary[:500],  # bounded
    )
    db.add(ver)
    db.flush()
    return ver


def _cv_json_for_scoring(draft: CVDraft) -> dict[str, Any]:
    """Build the ``cv_json`` dict passed to :func:`score_cv`.

    B12 fix: single source of truth for the synthetic
    ``_rendered_html`` key the format-safety axis grades. Before,
    ``_score_and_persist`` and ``score_cv_draft`` both inlined the
    same ``cv_json_with_html = dict(...) + '_rendered_html'`` block.
    If one ever forgot to inject, format checks would silently return
    0.0 (the B9 honest-no-data signal) without anyone noticing.
    """
    cv_json = dict(draft.cv_json or {})
    if draft.rendered_html:
        cv_json["_rendered_html"] = draft.rendered_html
    return cv_json


def _score_and_persist(draft: CVDraft, target_analysis: dict | None = None) -> None:
    """Recompute the CV score and persist it on the draft row.

    Phase 7 fix: every mutating endpoint (create / patch / enhance /
    restore) calls this so the FE always sees a fresh score. The
    scorer takes a snapshot of ``cv_json`` + optional target-job
    analysis and writes both the headline number and the per-axis
    breakdown into the existing ``CVDraft.score`` and
    ``CVDraft.score_breakdown_json`` columns.

    Side-effect free with respect to LLM calls — the scorer is
    deterministic.

    B8 fix: ``target_analysis`` is now an explicit param. Callers
    pass the already-loaded ``job.job_analysis_json`` so this helper
    doesn't need to rely on ``draft.job`` being eager-loaded. Calling
    it after the session closes (e.g. from a Celery task) used to
    raise ``DetachedInstanceError``; the explicit param avoids the
    implicit lazy load entirely.
    """
    if target_analysis is None and draft.job_id:
        # B8 fix: still try the relationship if the caller didn't
        # pass target_analysis explicitly — but guard the lazy load
        # so a detached session doesn't crash.
        try:
            job = draft.job
            if job is not None and job.job_analysis_json:
                target_analysis = job.job_analysis_json
        except Exception:
            # DetachedInstanceError or similar — fall back to no target.
            target_analysis = None

    result = score_cv(_cv_json_for_scoring(draft), target_analysis)
    draft.score = result.overall
    draft.score_breakdown_json = result.to_breakdown()
    log.debug(
        "cv_score_updated",
        cv_id=draft.id,
        overall=result.overall,
        recs=len(result.recommendations),
    )


def _render_draft_to_html(draft: CVDraft) -> str:
    """Render a draft's cv_json → full HTML document.

    Delegates to the shared ``render_html_document`` and uses the draft's
    id as the CSS scope prefix so multiple drafts can coexist on one page
    (FE compares two CVs side-by-side without style collisions).

    Resolves the draft's ``template_id`` → template config so the
    rendered HTML honours the full styling of whichever template the
    user picked (header style, section heading, experience layout,
    skills layout, etc). Falls back to ``ats_classic`` defaults if the
    template is missing or unknown — keeps old drafts that predate
    Phase 10A templates rendering.
    """
    from app.db.session import SessionLocal
    from app.models.models import Template
    from app.services.cv_renderer import render_html_document

    template_config: dict[str, Any] = {}
    if draft.template_id:
        db = SessionLocal()
        try:
            tpl = db.get(Template, draft.template_id)
            if tpl is not None and isinstance(tpl.template_config_json, dict):
                template_config = tpl.template_config_json
        finally:
            db.close()

    profile_like = draft.cv_json or {}
    return render_html_document(
        profile_like,
        template_config=template_config,
        scope_id=draft.id,
    )


def _with_front_matter(md: str, draft: CVDraft) -> str:
    """Wrap a rendered Markdown CV with YAML front-matter metadata.

    The front-matter includes identifiers (cv_id, profile_id, job_id)
    and provenance (status, updated_at). Useful for traceability when
    the MD is exported, archived, or version-controlled.

    Format:

        ---
        cv_id: ...
        profile_id: ...
        job_id: ...|null
        title: ...
        status: draft|ready|exported
        generated_at: 2026-06-19T21:30:00Z
        ---

    Existing front-matter in the input is detected and replaced (only
    when the input starts with ``---\\n``).
    """
    from datetime import datetime, timezone
    basics = (draft.cv_json or {}).get("basics") or {}
    name = basics.get("name") or "CV"
    generated_at = (
        draft.updated_at.astimezone(timezone.utc).isoformat()
        if draft.updated_at
        else datetime.now(timezone.utc).isoformat()
    )
    lines = [
        "---",
        f"cv_id: {draft.id}",
        f"profile_id: {draft.profile_id}",
        f"job_id: {draft.job_id or 'null'}",
        f"title: \"{(draft.title or '').replace(chr(34), chr(92) + chr(34))}\"",
        f"status: {draft.status}",
        f"name: \"{name.replace(chr(34), chr(92) + chr(34))}\"",
        f"generated_at: {generated_at}",
        "---",
        "",
    ]
    fm = "\n".join(lines)
    body = md.lstrip("\n")
    # Strip any pre-existing front-matter so we don't double up.
    if body.startswith("---\n"):
        end = body.find("\n---", 4)
        if end != -1:
            body = body[end + 4 :].lstrip("\n")
    return f"{fm}{body}"


def _serialize_draft(d: CVDraft) -> dict[str, Any]:
    """CVDraftOut-compatible dict."""
    return {
        "id": d.id,
        "job_id": d.job_id,
        "profile_id": d.profile_id,
        "template_id": d.template_id,
        "title": d.title,
        "cv_json": d.cv_json or {},
        "rendered_html": d.rendered_html,
        "score": d.score,
        "score_breakdown_json": d.score_breakdown_json or {},
        "status": d.status,
        "created_at": d.created_at,
        "updated_at": d.updated_at,
    }


# ── Profile → cv_json helper ───────────────────────────────────────
def _profile_to_cv_json(profile: Profile, job: Job | None) -> dict[str, Any]:
    """Build a cv_json blob from a Profile row, optionally job-targeted.

    The output uses the simplified CV schema (flat lists, ``bullets``,
    ``start``/``end`` keys) consumed by :func:`build_cv_doc_from_json`.
    """
    bpj = profile.base_profile_json or {}
    basics_bpj = bpj.get("basics") or {}

    basics = {
        "name": profile.name or basics_bpj.get("name"),
        "title": profile.title or basics_bpj.get("label"),
        "email": profile.email or basics_bpj.get("email"),
        "phone": profile.phone or basics_bpj.get("phone"),
        "location": profile.location or _basics_location(basics_bpj),
        "linkedin": profile.linkedin,
        "github": profile.github,
        "portfolio": profile.portfolio,
        "url": basics_bpj.get("url"),
    }

    # Experience
    experience: list[dict[str, Any]] = []
    for w in (bpj.get("work") or []):
        if not isinstance(w, dict):
            continue
        experience.append({
            "title": w.get("position") or "",
            "company": w.get("name") or "",
            "location": w.get("location") or "",
            "start": w.get("startDate") or "",
            "end": w.get("endDate"),  # None = present
            "bullets": [h for h in (w.get("highlights") or []) if h],
        })

    # Education
    education: list[dict[str, Any]] = []
    for e in (bpj.get("education") or []):
        if not isinstance(e, dict):
            continue
        education.append({
            "institution": e.get("institution") or "",
            "degree": e.get("studyType") or "",
            "field": e.get("area") or "",
            "start": e.get("startDate") or "",
            "end": e.get("endDate") or "",
            "gpa": e.get("score") or "",
        })

    # Skills
    skills: list[str] = []
    for s in (bpj.get("skills") or []):
        if isinstance(s, dict):
            for kw in (s.get("keywords") or []):
                if kw:
                    skills.append(str(kw))
            if not s.get("keywords") and s.get("name"):
                skills.append(str(s["name"]))
        elif isinstance(s, str):
            skills.append(s)

    # Projects
    projects: list[dict[str, Any]] = []
    for p in (bpj.get("projects") or []):
        if not isinstance(p, dict):
            continue
        projects.append({
            "name": p.get("name") or "",
            "description": p.get("description") or "",
            "tech": [t for t in (p.get("keywords") or []) if t],
            "url": p.get("url") or "",
        })

    summary = profile.summary or basics_bpj.get("summary") or ""

    # Optionally append a "Targeting: …" hint to the summary if a job is given
    if job is not None:
        target = job.title or ""
        if target and summary:
            summary = f"{summary}\n\nTargeting: {target} role."
        elif target:
            summary = f"Targeting: {target} role."

    return {
        "basics": basics,
        "summary": summary,
        "experience": experience,
        "education": education,
        "skills": skills,
        "projects": projects,
    }


def _basics_location(basics: dict[str, Any]) -> str:
    loc = basics.get("location") or {}
    parts = [loc.get("city"), loc.get("region"), loc.get("country")]
    return ", ".join(p for p in parts if p)


# ── List ───────────────────────────────────────────────────────────
@router.get("", response_model=list[CVDraftOut])
def list_cvs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    rows = db.execute(
        select(CVDraft).where(CVDraft.profile_id.in_(
            select(Profile.id).where(Profile.user_id == user.id)
        )).order_by(CVDraft.updated_at.desc())
    ).scalars().all()
    return [_serialize_draft(r) for r in rows]


# ── Create (generate from profile) ─────────────────────────────────
@router.post("", response_model=CVDraftOut, status_code=201)
def create_cv(
    payload: CVDraftIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate a CV draft from a profile (optionally job-targeted)."""
    seed_default_templates(db)

    profile = _load_profile(db, payload.profile_id)
    # Make sure the profile belongs to the user
    if profile.user_id != user.id:
        raise HTTPException(403, "profile does not belong to current user")

    job = None
    if payload.job_id:
        job = _load_job(db, payload.job_id)
        if job.user_id != user.id:
            raise HTTPException(403, "job does not belong to current user")

    # Validate template (or fall back to default)
    tpl = _load_template(db, payload.template_id)
    if tpl is None:
        cfg = default_template_config()
    else:
        cfg = tpl.template_config_json or default_template_config()

    cv_json = _profile_to_cv_json(profile, job)

    draft = CVDraft(
        job_id=payload.job_id,
        profile_id=payload.profile_id,
        template_id=(tpl.id if tpl else DEFAULT_TEMPLATE_ID),
        title=payload.title or (job.title if job and job.title else "My CV"),
        cv_json=cv_json,
        rendered_html=None,
        score=0.0,
        score_breakdown_json={},
        status="draft",
    )
    db.add(draft)
    db.flush()
    draft.rendered_html = _render_draft_to_html(draft)
    _score_and_persist(draft)  # Phase 7: auto-score on create
    _save_version(db, draft, "initial draft from profile")
    db.commit()
    db.refresh(draft)
    log.info(
        "cv_created",
        cv_id=draft.id,
        profile_id=draft.profile_id,
        job_id=draft.job_id,
        template_id=draft.template_id,
    )
    return _serialize_draft(draft)


# ── Recommendation Engine (Phase 7) ────────────────────────────────
# B5 fix: route ordering rule. FastAPI matches in declaration order.
# The 1-segment catch-all @router.get("/{cv_id}") further down would
# shadow any 1-segment literal route (e.g. /recommendations would
# match with cv_id="recommendations"). 2-segment routes like
# /{cv_id}/export don't conflict — they're a different shape and
# FastAPI distinguishes by segment count. So this comment is the
# 1-segment version of the rule.
@router.get("/recommendations", response_model=list[CVRecommendationItem])
def cv_recommendations(
    limit: int = Query(10, ge=1, le=100, description="Max items to return (1-100)"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CVRecommendationItem]:
    """Best CV×job pairs, sorted by composite score.

    Composite = 0.6 * match_score + 0.4 * cv_score. The 60/40 split
    favors "is this job right for me?" (match) over "is this CV good
    for this job?" (cv_score) — but both matter.

    Excludes pairs where the job hasn't been parsed yet, and pairs
    where the CV hasn't been scored yet (zero-score CVs still rank,
    just lower).

    B3 fix: response is now ``list[CVRecommendationItem]`` (was
    ``list[dict[str, Any]]``) so FastAPI validates the contract and
    OpenAPI exposes the schema.
    B4 fix: jobs are batch-fetched in a single query rather than
    ``db.get(Job, ...)`` per CV (N+1 → 2 queries total).
    """
    from app.models.models import Job, JobMatch

    # Two queries (CVs + jobs + matches) instead of a join — keeps the
    # response flat and the SQL portable across SQLite / Postgres.
    cvs = (
        db.query(CVDraft)
        .join(Profile, CVDraft.profile_id == Profile.id)
        .filter(Profile.user_id == user.id)
        .all()
    )
    if not cvs:
        return []

    # B4 fix: batch-fetch all referenced jobs in one query.
    cv_job_ids = {cv.job_id for cv in cvs if cv.job_id}
    if not cv_job_ids:
        return []
    jobs_by_id = {
        j.id: j
        for j in db.query(Job).filter(Job.id.in_(cv_job_ids)).all()
        if j.user_id == user.id  # extra safety — only return user's own
    }

    matches = (
        db.query(JobMatch)
        .filter(JobMatch.job_id.in_(set(jobs_by_id.keys()) or {"__none__"}))
        .all()
    )
    match_by_job = {m.job_id: m for m in matches}

    items: list[CVRecommendationItem] = []
    for cv in cvs:
        if not cv.job_id:
            continue
        job = jobs_by_id.get(cv.job_id)
        if job is None:
            continue
        match = match_by_job.get(job.id)
        if match is None:
            continue

        # Reconstruct missing skills from the latest score breakdown so
        # the FE can show "you're missing X, Y" inline.
        missing_skills: list[str] = []
        if isinstance(cv.score_breakdown_json, dict):
            sg = (cv.score_breakdown_json.get("axes") or {}).get("skill_gap") or {}
            missing_skills = list(sg.get("missing") or [])

        composite = round(0.6 * match.match_score + 0.4 * (cv.score or 0.0), 4)
        if composite >= 0.7:
            rec = "apply"
        elif composite >= 0.5:
            rec = "stretch"
        else:
            rec = "skip"
        # B3 fix: build a typed model instead of an untyped dict.
        items.append(
            CVRecommendationItem(
                cv_id=cv.id,
                cv_title=cv.title,
                job_id=job.id,
                job_title=job.title or "Untitled",
                company=job.company,
                match_score=match.match_score,
                cv_score=cv.score or 0.0,
                composite=composite,
                recommendation=rec,
                missing_skills=missing_skills,
            )
        )

    items.sort(key=lambda x: x.composite, reverse=True)
    return items[:limit]


# ── Export (Phase 8) ────────────────────────────────────────────────
# B5 fix: these are 2-segment routes (/{cv_id}/export,
# /{cv_id}/exports) so they don't conflict with the 1-segment
# /{cv_id} catch-all below. They can live here (or anywhere) without
# being shadowed. Stylistic placement: kept next to /recommendations
# for grouping.
from app.services.cv_exporter import export_cv_to_pdf, pdf_metadata  # noqa: E402


@router.post("/{cv_id}/export", response_class=Response)
def export_cv(
    cv_id: str,
    # B7 fix: renamed from ``format`` to ``fmt`` to stop shadowing
    # the Python builtin. The URL query string is still
    # ``?format=pdf|docx`` for backward compat with the FE client
    # (avoids a coordinated FE rename), but FastAPI binds it via
    # ``alias``.
    fmt: str = Query(
        "pdf",
        alias="format",
        pattern="^(pdf|docx)$",
        description="Output format. Only 'pdf' is implemented; 'docx' is reserved for Phase 8.5.",
    ),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stream the CV as an ATS-safe PDF.

    Generates a fresh PDF from the draft's currently-rendered HTML
    (which already has scoped CSS from the renderer), wraps it with
    a print stylesheet that enforces ATS-safe layout (single column,
    selectable text, no body images, sane page breaks), and streams
    the bytes as ``application/pdf``.

    B2 fix: WeasyPrint failures are caught and surfaced as 500 with
    a clear message + structlog ERROR. Failure path also persists an
    Export row with ``file_type="failed"`` so the export-history
    sidebar shows the failure (not an invisible 500).

    B7 fix: the ``fmt`` param (renamed from ``format`` to stop
    shadowing the Python builtin) is now used in the function body
    to dispatch to the right renderer. PDF is the only one
    implemented today; ``docx`` returns 501 Not Implemented as a
    placeholder until Phase 8.5 ships.
    """
    import hashlib
    from app.models.models import Export
    from app.core.config import get_settings

    # B7 fix: dispatch on fmt. Only pdf is wired up; docx is
    # reserved for Phase 8.5.
    if fmt != "pdf":
        raise HTTPException(
            501,
            f"export format '{fmt}' not implemented yet (Phase 8.5)",
        )

    settings = get_settings()

    draft = db.get(CVDraft, cv_id)
    if draft is None:
        raise HTTPException(404, f"cv {cv_id} not found")
    profile = db.get(Profile, draft.profile_id)
    if profile is None or profile.user_id != user.id:
        raise HTTPException(403, "not your cv")

    auto_rendered = False
    if not draft.rendered_html:
        # Edge case: a draft was created but never had HTML rendered.
        # Re-render on the fly so the export still works.
        draft.rendered_html = _render_draft_to_html(draft)
        db.commit()
        # B12 fix: mark auto-render so we write a CVVersion snapshot
        # below — every other mutating endpoint does, this should too.
        auto_rendered = True

    # B2 fix: wrap WeasyPrint in try/except so failures surface as
    # 500 with a clear message instead of an opaque traceback.
    try:
        pdf_bytes = export_cv_to_pdf(draft.rendered_html)
    except Exception as exc:
        log.error(
            "cv_export_render_failed",
            cv_id=cv_id,
            html_length=len(draft.rendered_html or ""),
            error=str(exc),
            error_type=type(exc).__name__,
        )
        # Persist a failure row so the history sidebar shows it.
        try:
            export_row = Export(
                user_id=user.id,
                entity_type="cv",
                entity_id=cv_id,
                cv_draft_id=cv_id,
                file_type="failed",
                file_path=f"on-demand://failed/{cv_id}",
                file_size=0,
            )
            db.add(export_row)
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(
            500,
            "PDF generation failed — please retry or contact support",
        )

    meta = pdf_metadata(pdf_bytes)

    if not meta["is_valid"]:
        log.error(
            "cv_export_invalid_pdf",
            cv_id=cv_id,
            pdf_size=meta["size"],
            magic=meta["magic"],
        )
        raise HTTPException(500, "generated PDF failed validation")

    # B10 fix: hash the actual bytes we're returning so the audit
    # trail is verifiable.
    content_hash = hashlib.sha256(pdf_bytes).hexdigest()

    # B12 fix: write a CVVersion snapshot if we auto-rendered the
    # HTML, matching what every other mutating endpoint does.
    if auto_rendered:
        try:
            _save_version(draft, db, "auto-render on first export")
        except Exception:
            log.warning(
                "cv_export_save_version_failed",
                cv_id=cv_id,
            )
            db.rollback()

    # Persist an export row so the audit trail + history sidebar work.
    # B1 fix: file_path is a sentinel (NOT a real on-disk path) —
    # the PDF is regenerated on demand. Format: "on-demand://<id>"
    # for ephemeral regenerations. file_size + sha256 are real.
    safe_title = "".join(
        # P4 fix: ASCII-only letters/digits/hyphens so filenames
        # survive zip tools + filesystem encoding edge cases.
        c if (c.isascii() and (c.isalnum() or c in "-_ ")) else "_"
        for c in (draft.title or "cv")
    ).strip().replace(" ", "_")[:60] or "cv"
    file_name = f"{safe_title}_v{draft.id[:8]}.pdf"
    export_row = Export(
        user_id=user.id,
        entity_type="cv",
        entity_id=cv_id,
        cv_draft_id=cv_id,
        file_type="pdf",
        file_path=f"on-demand://{cv_id}/{file_name}",  # B1: sentinel, real id set after flush
        file_size=meta["size"],
        sha256=content_hash,
    )
    db.add(export_row)
    db.flush()  # need export_row.id before we reference it
    # Now fix the file_path to include the real export id.
    export_row.file_path = f"on-demand://{export_row.id}/{file_name}"
    db.commit()

    log.info(
        "cv_exported",
        cv_id=cv_id,
        export_id=export_row.id,
        pdf_size=meta["size"],
        pages=meta["page_count"],
        sha256=content_hash[:12],
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{file_name}"',
            "X-Cv-Export-Id": export_row.id,
            "X-Cv-Export-Size": str(meta["size"]),
        },
    )


@router.get("/{cv_id}/exports", response_model=list[ExportOut])
def list_cv_exports(
    cv_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ExportOut]:
    """Return the user's export history for this CV, newest first.

    Each row is one PDF generation event (or a ``file_type='failed'``
    row from B2). The actual file isn't stored on disk — PDFs are
    regenerated on demand to keep exports fresh with the current CV
    state. The row exists for audit and to power the "Export
    history" sidebar in the FE.
    """
    from app.models.models import Export

    draft = db.get(CVDraft, cv_id)
    if draft is None:
        raise HTTPException(404, f"cv {cv_id} not found")
    profile = db.get(Profile, draft.profile_id)
    if profile is None or profile.user_id != user.id:
        raise HTTPException(403, "not your cv")

    rows = (
        db.query(Export)
        .filter(
            Export.cv_draft_id == cv_id,
            Export.user_id == user.id,
            Export.entity_type == "cv",
        )
        .order_by(Export.created_at.desc())
        .limit(limit)
        .all()
    )
    return [ExportOut.model_validate(r) for r in rows]


# ── Get one ────────────────────────────────────────────────────────
@router.get("/{cv_id}", response_model=CVDraftOut)
def get_cv(
    cv_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    draft = db.get(CVDraft, cv_id)
    if draft is None:
        raise HTTPException(404, f"cv {cv_id} not found")
    # Check ownership via profile
    profile = db.get(Profile, draft.profile_id)
    if profile is None or profile.user_id != user.id:
        raise HTTPException(403, "not your cv")
    return _serialize_draft(draft)


# ── Patch cv_json ──────────────────────────────────────────────────
@router.patch("/{cv_id}", response_model=CVDraftOut)
def patch_cv(
    cv_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Update one CV draft. Allowed keys: ``title``, ``cv_json``,
    ``template_id``, ``status``, ``job_id`` (re-target ATS). Re-renders
    HTML after cv_json change.
    """
    draft = db.get(CVDraft, cv_id)
    if draft is None:
        raise HTTPException(404, f"cv {cv_id} not found")
    profile = db.get(Profile, draft.profile_id)
    if profile is None or profile.user_id != user.id:
        raise HTTPException(403, "not your cv")

    allowed = {"title", "cv_json", "template_id", "status", "job_id"}
    unknown = set(payload.keys()) - allowed
    if unknown:
        raise HTTPException(400, f"unknown keys: {sorted(unknown)}")

    if "title" in payload:
        title = payload["title"]
        if not isinstance(title, str) or not title.strip():
            raise HTTPException(400, "title must be non-empty string")
        draft.title = title.strip()

    if "template_id" in payload:
        tpl_id = payload["template_id"]
        tpl = _load_template(db, tpl_id)
        if tpl is None:
            raise HTTPException(400, f"template {tpl_id} not found")
        draft.template_id = tpl.id

    if "status" in payload:
        st = payload["status"]
        if st not in ("draft", "ready", "exported"):
            raise HTTPException(400, f"invalid status: {st}")
        draft.status = st

    if "job_id" in payload:
        new_job_id = payload["job_id"]
        if new_job_id is None or new_job_id == "":
            draft.job_id = None
        else:
            if not isinstance(new_job_id, str):
                raise HTTPException(400, "job_id must be a string or null")
            job = db.get(Job, new_job_id)
            if job is None:
                raise HTTPException(404, f"job {new_job_id} not found")
            if job.user_id != user.id:
                raise HTTPException(403, "job does not belong to current user")
            draft.job_id = new_job_id

    if "cv_json" in payload:
        cj = payload["cv_json"]
        if not isinstance(cj, dict):
            raise HTTPException(400, "cv_json must be an object")
        draft.cv_json = cj
        # Re-render
        draft.rendered_html = _render_draft_to_html(draft)

    # B11 fix: score + save_version ONCE at the end, regardless of
    # which fields were patched. Previous version called
    # ``_score_and_persist`` twice when both ``cv_json`` and
    # ``job_id`` were in the payload (once in the cv_json branch,
    # once in the metadata branch), and wrote two CVVersion rows.
    needs_score = bool(
        set(payload.keys()) & {"cv_json", "job_id"}
    )
    if needs_score:
        # B8 fix: pass the already-loaded job_analysis_json
        # explicitly so the scorer doesn't have to do a lazy load.
        target_analysis = None
        if draft.job_id:
            job = db.get(Job, draft.job_id)
            if job is not None and job.job_analysis_json:
                target_analysis = job.job_analysis_json
        _score_and_persist(draft, target_analysis=target_analysis)

    if payload:
        changed_fields = sorted(payload.keys())
        _save_version(db, draft, f"patch: {', '.join(changed_fields)}")

    draft.updated_at = _utcnow()
    db.commit()
    db.refresh(draft)
    log.info("cv_updated", cv_id=draft.id, fields=list(payload.keys()))
    return _serialize_draft(draft)


# ── Delete ─────────────────────────────────────────────────────────
@router.delete("/{cv_id}", status_code=204, response_class=Response)
def delete_cv(
    cv_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    draft = db.get(CVDraft, cv_id)
    if draft is None:
        raise HTTPException(404, f"cv {cv_id} not found")
    profile = db.get(Profile, draft.profile_id)
    if profile is None or profile.user_id != user.id:
        raise HTTPException(403, "not your cv")
    db.delete(draft)
    db.commit()
    log.info("cv_deleted", cv_id=cv_id)
    return Response(status_code=204)


# ── Render (on demand) ─────────────────────────────────────────────
@router.get("/{cv_id}/render", response_model=CVRenderOut)
def render_cv_endpoint(
    cv_id: str,
    format: str = Query("html", pattern="^(html|markdown)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    draft = db.get(CVDraft, cv_id)
    if draft is None:
        raise HTTPException(404, f"cv {cv_id} not found")
    profile = db.get(Profile, draft.profile_id)
    if profile is None or profile.user_id != user.id:
        raise HTTPException(403, "not your cv")

    doc = build_cv_doc_from_json(draft.cv_json or {})
    if format == "html":
        # Re-render full HTML doc on demand (not from cache) so callers always
        # see fresh output after a patch.
        content = _render_draft_to_html(draft)
    else:
        content = _with_front_matter(doc.to_markdown(), draft)

    sections = [
        {"kind": s.kind, "title": s.title, "body_md": s.body_md}
        for s in doc.sections
    ]
    return {
        "cv_draft_id": cv_id,
        "format": format,
        "content": content,
        "sections": sections,
    }


# ── LLM Enhance ────────────────────────────────────────────────────
@router.post("/{cv_id}/enhance", response_model=CVDraftOut)
async def enhance_cv_section(
    cv_id: str,
    payload: CVEnhanceIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Run the LLM enhancer on one CV section.

    Body:
      - ``section``: ``summary`` | ``bullets`` | ``experience`` | ``skills``
      - ``experience_index``: required when section == ``experience`` or
        ``bullets``. Index into the experience list.
      - ``target_job_id``: optional. If provided, the job's ATS keywords
        are passed to the LLM (fact-preservation still enforced).

    On success, ``cv_json`` is updated and the HTML is re-rendered.
    """
    draft = db.get(CVDraft, cv_id)
    if draft is None:
        raise HTTPException(404, f"cv {cv_id} not found")
    profile = db.get(Profile, draft.profile_id)
    if profile is None or profile.user_id != user.id:
        raise HTTPException(403, "not your cv")

    target_kw: list[str] = []
    if payload.target_job_id:
        job = _load_job(db, payload.target_job_id)
        if job.user_id != user.id:
            raise HTTPException(403, "job does not belong to current user")
        # Pull ATS keywords from ats_keywords_json (newer) or job_analysis_json
        # (legacy). Schema is a dict like {"all": [...], "must_have": [...]}.
        ats = job.ats_keywords_json or {}
        if isinstance(ats, dict):
            kw_list = ats.get("all") or ats.get("ats_keywords") or []
        else:
            kw_list = ats if isinstance(ats, list) else []
        if not kw_list:
            legacy = job.job_analysis_json or {}
            if isinstance(legacy, dict):
                kw_list = legacy.get("ats_keywords") or []
        target_kw = [str(k) for k in kw_list if k]

    cv_json = dict(draft.cv_json or {})

    if payload.section == SECTION_SUMMARY:
        original = cv_json.get("summary") or ""
        enhanced = await enhance_cv_summary(
            profile={"basics": cv_json.get("basics") or {}, "summary": original},
            target_keywords=target_kw,
            db=db,
        )
        if enhanced:
            cv_json["summary"] = enhanced
        else:
            raise HTTPException(502, "LLM enhancement failed — try again or skip")

    elif payload.section in ("experience", "bullets"):
        idx = payload.experience_index
        if idx is None or idx < 0:
            raise HTTPException(400, "experience_index required for experience/bullets")
        experience = cv_json.get("experience") or []
        if idx >= len(experience):
            raise HTTPException(404, f"experience index {idx} out of range")
        job_entry = experience[idx]
        # CV JSON shape uses "highlights" (JSON Resume convention); some
        # older drafts may have "bullets". Accept both, write back to the
        # canonical field.
        bullets = job_entry.get("highlights") or job_entry.get("bullets") or []
        enhanced = await enhance_job_bullets(
            bullets=bullets,
            title=job_entry.get("title") or "",
            company=job_entry.get("company") or "",
            target_keywords=target_kw,
            db=db,
        )
        if enhanced:
            job_entry = dict(job_entry)
            job_entry["highlights"] = enhanced
            job_entry["bullets"] = enhanced  # mirror for legacy readers
            experience[idx] = job_entry
            cv_json["experience"] = experience
        else:
            raise HTTPException(502, "LLM enhancement failed — try again or skip")

    elif payload.section == SECTION_SKILLS:
        skills = cv_json.get("skills") or []
        # Re-use the generic enhancer via enhance_section path
        from app.services.cv_enhancer import enhance_section
        result = await enhance_section(
            section_kind="skills",
            payload={"section": "skills", "skills": skills},
            target_keywords=target_kw,
            db=db,
        )
        if result and result.get("skills"):
            cv_json["skills"] = result["skills"]
        else:
            raise HTTPException(502, "LLM enhancement failed — try again or skip")
    else:
        raise HTTPException(400, f"unknown section: {payload.section}")

    draft.cv_json = cv_json
    draft.rendered_html = _render_draft_to_html(draft)
    _score_and_persist(draft)  # Phase 7: re-score after LLM enhancement
    _save_version(db, draft, f"LLM-enhanced {payload.section}")
    draft.updated_at = _utcnow()
    db.commit()
    db.refresh(draft)
    log.info("cv_enhanced", cv_id=draft.id, section=payload.section)
    return _serialize_draft(draft)


# ── Version history ─────────────────────────────────────────────────
@router.get("/{cv_id}/versions", response_model=list[CVVersionOut])
def list_cv_versions(
    cv_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CVVersionOut]:
    """Return all saved versions for a CV draft, newest first.

    Each row is a snapshot of ``cv_json`` at the moment it was saved
    (create, patch, or enhance). The user can restore any of them
    via the ``/restore`` endpoint below.
    """
    draft = db.get(CVDraft, cv_id)
    if draft is None:
        raise HTTPException(404, f"cv {cv_id} not found")
    profile = db.get(Profile, draft.profile_id)
    if profile is None or profile.user_id != user.id:
        raise HTTPException(403, "not your cv")

    rows = (
        db.query(CVVersion)
        .filter(CVVersion.cv_draft_id == cv_id)
        .order_by(CVVersion.version_number.desc())
        .all()
    )
    return [CVVersionOut.model_validate(r) for r in rows]


@router.post(
    "/{cv_id}/versions/{version_id}/restore",
    response_model=CVDraftOut,
)
def restore_cv_version(
    cv_id: str,
    version_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Restore a previously-saved version into the live draft.

    After restore the draft's ``cv_json`` equals the snapshot's, the
    HTML is re-rendered, and a new version row is recorded with the
    label ``"restored from v<N>"`` so the audit trail is preserved.
    """
    draft = db.get(CVDraft, cv_id)
    if draft is None:
        raise HTTPException(404, f"cv {cv_id} not found")
    profile = db.get(Profile, draft.profile_id)
    if profile is None or profile.user_id != user.id:
        raise HTTPException(403, "not your cv")

    ver = db.get(CVVersion, version_id)
    if ver is None or ver.cv_draft_id != cv_id:
        raise HTTPException(404, f"version {version_id} not found for this cv")

    snapshot = ver.cv_json or {}
    draft.cv_json = snapshot
    draft.rendered_html = _render_draft_to_html(draft)
    _score_and_persist(draft)  # Phase 7: re-score after restore
    _save_version(db, draft, f"restored from v{ver.version_number}")
    draft.updated_at = _utcnow()
    db.commit()
    db.refresh(draft)
    log.info(
        "cv_restored",
        cv_id=draft.id,
        from_version=ver.version_number,
        new_version=None,  # filled by save_version side-effect
    )
    return _serialize_draft(draft)

# ── Score (Phase 7) ─────────────────────────────────────────────────


@router.post("/{cv_id}/score", response_model=CVScoreOut)
def score_cv_draft(
    cv_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CVScoreOut:
    """Force-recompute the CV score and return the full breakdown.

    The same computation runs automatically on create/patch/enhance/
    restore. This endpoint exists so the FE can trigger a refresh
    (e.g. after editing ``cv_json`` via a future bulk editor) without
    going through the enhance round-trip.

    B5 fix: now also writes a version row so the re-score shows up in
    the audit trail — every other mutating endpoint already does.
    """
    draft = db.get(CVDraft, cv_id)
    if draft is None:
        raise HTTPException(404, f"cv {cv_id} not found")
    profile = db.get(Profile, draft.profile_id)
    if profile is None or profile.user_id != user.id:
        raise HTTPException(403, "not your cv")

    target_analysis: dict | None = None
    if draft.job_id:
        job = db.get(Job, draft.job_id)
        if job is not None and job.job_analysis_json:
            target_analysis = job.job_analysis_json

    # B12 fix: use the shared helper so the rendered_html injection is
    # in one place.
    result = score_cv(_cv_json_for_scoring(draft), target_analysis)
    draft.score = result.overall
    draft.score_breakdown_json = result.to_breakdown()
    draft.updated_at = _utcnow()
    # B5 fix: persist a version snapshot so the re-score is visible in
    # the version history.
    _save_version(db, draft, "manual re-score via /score")
    db.commit()
    db.refresh(draft)

    return CVScoreOut(
        cv_id=draft.id,
        overall=result.overall,
        axes=result.to_breakdown()["axes"],
        matched_keywords=result.matched_keywords,
        missing_keywords=result.missing_keywords,
        matched_skills=result.matched_skills,
        missing_skills=result.missing_skills,
        recommendations=[CVScoreRecommendation(**r) for r in result.recommendations],
        scored_at=_utcnow(),
    )
