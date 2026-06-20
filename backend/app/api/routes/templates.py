"""Template CRUD API routes (Phase 10A).

Endpoints:
  GET    /api/templates               List all templates (slim summary)
  GET    /api/templates/{id}          One template (full config)
  POST   /api/templates               Create custom template
  PATCH  /api/templates/{id}          Patch user-created template (built-ins 403)
  DELETE /api/templates/{id}          Delete user-created template (built-ins 403)
  POST   /api/templates/{id}/duplicate  Clone built-in or user template
  POST   /api/templates/preview       Render dry-run preview (no DB write)

Built-in presets (ats_classic, ats_modern, ats_compact) are seeded on
startup and are read-only — they cannot be PATCHed or DELETEd. Use
``/duplicate`` to fork them into a custom template.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.session import get_db
from app.models.models import Template, User
from app.schemas.schemas import (
    TemplateCreateIn,
    TemplateListItem,
    TemplateOut,
    TemplatePatchIn,
    TemplatePreviewIn,
    TemplatePreviewOut,
)
from app.services.cv_renderer import (
    BUILTIN_PRESETS,
    validate_ats_color,
)
from app.services.resume_parser import get_or_create_default_user

log = get_logger(__name__)
router = APIRouter(prefix="/templates", tags=["templates"])


# ── Single-user auth (same pattern as other routes) ────────────────
def get_current_user(db: Session = Depends(get_db)) -> User:
    """Single-user mode: return the default seeded user (or create)."""
    return get_or_create_default_user(db)


# ── Built-in preset id set (read-only) ───────────────────────────────
_BUILTIN_IDS: frozenset[str] = frozenset(p["id"] for p in BUILTIN_PRESETS)


def _config_from_payload(
    sections: list[str] | None,
    font_family: str | None,
    accent_color: str | None,
    density: str | None,
    bullet_style: str | None,
    date_format: str | None,
    page_size: str | None,
) -> dict[str, Any]:
    """Build a template_config_json blob from styled fields.

    Validates the color against the ATS-safe palette so a custom
    template can never sneak in Comic-Sans red.
    """
    cfg: dict[str, Any] = {}
    if sections is not None:
        cfg["sections"] = sections
    if font_family is not None:
        cfg["font_family"] = font_family
    if accent_color is not None:
        # Raises ValueError -> 400 in route handler.
        cfg["accent_color"] = validate_ats_color(accent_color)
    if density is not None:
        cfg["density"] = density
    if bullet_style is not None:
        cfg["bullet_style"] = bullet_style
    if date_format is not None:
        cfg["date_format"] = date_format
    if page_size is not None:
        cfg["page_size"] = page_size
    return cfg


# ── POST /templates/preview ─────────────────────────────────────────
# IMPORTANT: must be declared before the /{template_id} catch-all below,
# otherwise FastAPI matches "preview" as a template_id literal.
@router.post("/preview", response_model=TemplatePreviewOut)
def preview_template(
    payload: TemplatePreviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> TemplatePreviewOut:
    """Render a template config against a profile (dry-run preview).

    Two input modes:
      - ``profile_id``: pull the user's actual profile data
      - ``cv_json``: use an inline JSON Resume dict (FE preview convenience)

    Useful for the FE "create template" form so the user sees live
    output as they tweak fields, without committing anything to the DB.
    """
    from app.models.models import Profile
    from app.services.cv_renderer import render_html_document

    if not payload.profile_id and not payload.cv_json:
        raise HTTPException(
            400, "preview requires either profile_id or cv_json"
        )

    cfg = dict(payload.template_config_json or {})
    # ``template_config_json`` is ``dict[str, Any]`` in the schema so
    # Pydantic's top-level field_validator can't see the nested
    # ``accent_color``. Re-check here so the preview doesn't render
    # with a silent fallback (#111111) and surprise the user with a
    # color they didn't pick. This intentionally returns 400 (not 422)
    # because the offending field is nested, not top-level.
    if "accent_color" in cfg:
        try:
            cfg["accent_color"] = validate_ats_color(cfg["accent_color"])
        except ValueError as e:
            raise HTTPException(400, str(e)) from e

    if payload.cv_json is not None:
        profile = payload.cv_json
    else:
        prof_row = db.get(Profile, payload.profile_id)
        if prof_row is None or prof_row.user_id != user.id:
            raise HTTPException(404, f"profile '{payload.profile_id}' not found")
        profile = prof_row.base_profile_json or {}

    rendered = render_html_document(profile, cfg)
    return TemplatePreviewOut(rendered_html=rendered, config_used=cfg)


# ── GET /templates ──────────────────────────────────────────────────
@router.get("", response_model=list[TemplateListItem])
def list_templates(
    type: str | None = Query(None, description="Filter by template type ('cv' | 'cover_letter')"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001 — auth required
) -> list[Template]:
    """List all templates (built-in presets + user-created)."""
    q = db.query(Template)
    if type:
        q = q.filter(Template.type == type)
    return q.order_by(Template.is_default.desc(), Template.id.asc()).all()


# ── GET /templates/{id} ─────────────────────────────────────────────
@router.get("/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> Template:
    """Fetch one template by id."""
    tpl = db.get(Template, template_id)
    if tpl is None:
        raise HTTPException(404, f"template '{template_id}' not found")
    return tpl


# ── POST /templates ─────────────────────────────────────────────────
@router.post("", response_model=TemplateOut, status_code=201)
def create_template(
    payload: TemplateCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> Template:
    """Create a new custom template. ``id`` must be unique — 409 if taken."""
    existing = db.get(Template, payload.id)
    if existing is not None:
        raise HTTPException(
            409, f"template id '{payload.id}' already exists; pick a different id or use /duplicate"
        )

    # accent_color was already validated by the Pydantic
    # ``TemplateCreateIn._check_accent_color`` field_validator (M1 fix).
    # We trust the schema and don't re-validate here.

    config: dict[str, Any] = {
        "id": payload.id,
        "name": payload.name,
        "type": payload.type,
        "sections": payload.sections,
        "font_family": payload.font_family,
        "accent_color": payload.accent_color,
        "density": payload.density,
        "bullet_style": payload.bullet_style,
        "date_format": payload.date_format,
        "page_size": payload.page_size,
        "ats_friendly": payload.is_ats_friendly,
        "description": payload.description,
    }

    tpl = Template(
        id=payload.id,
        name=payload.name,
        type=payload.type,
        description=payload.description,
        template_config_json=config,
        is_ats_friendly=payload.is_ats_friendly,
        is_default=False,
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    log.info("template_created", template_id=tpl.id, name=tpl.name)
    return tpl


# ── PATCH /templates/{id} ───────────────────────────────────────────
@router.patch("/{template_id}", response_model=TemplateOut)
def patch_template(
    template_id: str,
    payload: TemplatePatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> Template:
    """Partial update. Built-in presets are immutable — 403."""
    tpl = db.get(Template, template_id)
    if tpl is None:
        raise HTTPException(404, f"template '{template_id}' not found")
    if tpl.id in _BUILTIN_IDS or tpl.is_default:
        raise HTTPException(
            403,
            f"template '{template_id}' is a built-in preset and cannot be modified; "
            f"use POST /templates/{template_id}/duplicate to fork it",
        )

    # accent_color was already validated by the Pydantic
    # ``TemplatePatchIn._check_accent_color`` field_validator (M1 fix).
    # We trust the schema and don't re-validate here.

    cfg = dict(tpl.template_config_json or {})

    # Update scalar columns
    if payload.name is not None:
        tpl.name = payload.name
        cfg["name"] = payload.name
    if payload.description is not None:
        tpl.description = payload.description
        cfg["description"] = payload.description
    if payload.is_ats_friendly is not None:
        tpl.is_ats_friendly = payload.is_ats_friendly
        cfg["ats_friendly"] = payload.is_ats_friendly

    # Update config blob
    style_updates = _config_from_payload(
        sections=payload.sections,
        font_family=payload.font_family,
        accent_color=payload.accent_color,
        density=payload.density,
        bullet_style=payload.bullet_style,
        date_format=payload.date_format,
        page_size=payload.page_size,
    )
    cfg.update(style_updates)

    tpl.template_config_json = cfg
    db.commit()
    db.refresh(tpl)
    log.info("template_patched", template_id=tpl.id)
    return tpl


# ── DELETE /templates/{id} ──────────────────────────────────────────
@router.delete("/{template_id}", status_code=204, response_class=Response)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> Response:
    """Delete a user-created template. Built-in presets are immutable — 403."""
    tpl = db.get(Template, template_id)
    if tpl is None:
        raise HTTPException(404, f"template '{template_id}' not found")
    if tpl.id in _BUILTIN_IDS or tpl.is_default:
        raise HTTPException(
            403,
            f"template '{template_id}' is a built-in preset and cannot be deleted",
        )

    db.delete(tpl)
    db.commit()
    log.info("template_deleted", template_id=template_id)
    return Response(status_code=204)


# ── POST /templates/{id}/duplicate ──────────────────────────────────
@router.post("/{template_id}/duplicate", response_model=TemplateOut, status_code=201)
def duplicate_template(
    template_id: str,
    new_id: str = Query(..., min_length=3, max_length=40, pattern=r"^[a-z0-9_\-]+$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> Template:
    """Fork a template (built-in or custom) into a new editable template.

    ``new_id`` is required and must be unique. The fork copies the full
    config blob, sets ``is_default=False``, and lets the user edit it
    freely via PATCH.
    """
    src = db.get(Template, template_id)
    if src is None:
        raise HTTPException(404, f"template '{template_id}' not found")
    if db.get(Template, new_id) is not None:
        raise HTTPException(409, f"template id '{new_id}' already exists")

    # Deep copy config + append "(copy)" to name
    cfg = dict(src.template_config_json or {})
    cfg["id"] = new_id
    cfg["name"] = f"{src.name} (copy)"

    fork = Template(
        id=new_id,
        name=cfg["name"],
        type=src.type,
        description=src.description,
        template_config_json=cfg,
        is_ats_friendly=src.is_ats_friendly,
        is_default=False,
    )
    db.add(fork)
    db.commit()
    db.refresh(fork)
    log.info("template_duplicated", src=template_id, dst=new_id)
    return fork