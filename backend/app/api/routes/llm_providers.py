"""LLM provider CRUD API (Phase 10B).

Endpoints:
  GET    /api/llm-providers              List all (enabled + disabled, no api_key)
  GET    /api/llm-providers/{id}         Detail (no api_key)
  POST   /api/llm-providers              Create new provider row
  PATCH  /api/llm-providers/{id}         Update fields (incl. enabled toggle)
  DELETE /api/llm-providers/{id}         Delete row
  POST   /api/llm-providers/{id}/test    Health check (calls provider.health())

Security notes:
  * The ``api_key`` column is Fernet-encrypted at rest. ``GET`` responses
    never include the key — only ``api_key_set: bool`` so the FE can show
    "••••" without round-tripping the ciphertext.
  * Built-in seed rows (tokenrouter, openai, anthropic, ollama) are
    freely editable via PATCH — they're not system-protected because
    users may want to swap defaults entirely. DELETE on a built-in is
    allowed too (they can re-seed by restarting, or use the Settings UI
    to add a custom one).
"""
from __future__ import annotations

import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.logging import get_logger
from app.db.session import get_db
from app.llm.client import LLMClient
from app.llm.providers.anthropic import AnthropicProvider
from app.llm.providers.openai_compat import OpenAICompatProvider
from app.models.models import LLMProvider, User
from app.schemas.schemas import (
    LLMProviderCreateIn,
    LLMProviderOut,
    LLMProviderPatchIn,
    LLMProviderTestIn,
    LLMProviderTestOut,
)
from app.services.resume_parser import get_or_create_default_user

log = get_logger(__name__)
router = APIRouter(prefix="/llm-providers", tags=["llm-providers"])


def get_current_user(db: Session = Depends(get_db)) -> User:
    """Single-user mode — same pattern as other routes."""
    return get_or_create_default_user(db)


# ── GET /llm-providers ──────────────────────────────────────────────
@router.get("", response_model=list[LLMProviderOut])
def list_providers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> list[LLMProviderOut]:
    """List all providers (enabled + disabled) sorted by priority.

    Sorted ascending so the FE renders them in priority order — the
    first enabled provider is the primary one LLMClient uses first.
    """
    rows = (
        db.query(LLMProvider)
        .order_by(LLMProvider.priority.asc(), LLMProvider.id.asc())
        .all()
    )
    return [LLMProviderOut.model_validate(r) for r in rows]


# ── GET /llm-providers/{id} ─────────────────────────────────────────
@router.get("/{provider_id}", response_model=LLMProviderOut)
def get_provider(
    provider_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> LLMProviderOut:
    row = db.get(LLMProvider, provider_id)
    if row is None:
        raise HTTPException(404, f"provider '{provider_id}' not found")
    return LLMProviderOut.model_validate(row)


# ── POST /llm-providers ─────────────────────────────────────────────
@router.post("", response_model=LLMProviderOut, status_code=201)
def create_provider(
    payload: LLMProviderCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> LLMProviderOut:
    """Create a new provider row.

    409 if the id collides. We don't silently merge because provider ids
    are user-facing slugs (referenced by llm_call_log rows).
    """
    if db.get(LLMProvider, payload.id) is not None:
        raise HTTPException(409, f"provider '{payload.id}' already exists")
    encrypted = encrypt_secret(payload.api_key) if payload.api_key else ""
    row = LLMProvider(
        id=payload.id,
        display_name=payload.display_name,
        kind=payload.kind,
        base_url=payload.base_url,
        api_key=encrypted,
        api_key_set=bool(payload.api_key),
        enabled=payload.enabled and bool(payload.api_key),
        priority=payload.priority,
        models_json=dict(payload.models_json),
        max_tokens_default=payload.max_tokens_default,
        temperature_default=payload.temperature_default,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log.info("llm_provider_created", id=row.id, kind=row.kind)
    return LLMProviderOut.model_validate(row)


# ── PATCH /llm-providers/{id} ───────────────────────────────────────
@router.patch("/{provider_id}", response_model=LLMProviderOut)
def patch_provider(
    provider_id: str,
    payload: LLMProviderPatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> LLMProviderOut:
    """Update fields on an existing provider.

    Special-cases ``api_key`` (encrypt on write) and ``enabled`` (must
    be false if there's no key — we never let the app call an LLM with
    an empty key).
    """
    row = db.get(LLMProvider, provider_id)
    if row is None:
        raise HTTPException(404, f"provider '{provider_id}' not found")

    data = payload.model_dump(exclude_unset=True)
    if "api_key" in data:
        new_key = data.pop("api_key") or ""
        row.api_key = encrypt_secret(new_key) if new_key else ""
        row.api_key_set = bool(new_key)
        # If the caller cleared the key, force-disable so the LLMClient
        # doesn't try to call without auth.
        if not new_key:
            row.enabled = False

    if "enabled" in data:
        new_enabled = data.pop("enabled")
        # Refuse to enable without a key.
        if new_enabled and not row.api_key_set:
            raise HTTPException(
                400,
                "cannot enable provider without an api_key — set the key first",
            )
        row.enabled = new_enabled

    for field in (
        "display_name",
        "kind",
        "base_url",
        "priority",
        "models_json",
        "max_tokens_default",
        "temperature_default",
    ):
        if field in data:
            setattr(row, field, data[field])

    db.commit()
    db.refresh(row)
    log.info("llm_provider_patched", id=row.id, fields=list(data.keys()))
    return LLMProviderOut.model_validate(row)


# ── DELETE /llm-providers/{id} ──────────────────────────────────────
@router.delete("/{provider_id}", status_code=204)
def delete_provider(
    provider_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> Response:
    row = db.get(LLMProvider, provider_id)
    if row is None:
        raise HTTPException(404, f"provider '{provider_id}' not found")
    db.delete(row)
    db.commit()
    log.info("llm_provider_deleted", id=provider_id)
    return Response(status_code=204)


# ── POST /llm-providers/{id}/test ───────────────────────────────────
@router.post("/{provider_id}/test", response_model=LLMProviderTestOut)
async def test_provider(
    provider_id: str,
    payload: LLMProviderTestIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),  # noqa: ARG001
) -> LLMProviderTestOut:
    """Issue a cheap health probe against the provider.

    Strategy: instantiate a fresh provider instance from the saved row
    (decrypt the key, build the right class), call ``.health()`` if
    ``base_url`` looks usable, otherwise run a 1-token completion.

    Why not reuse the cached :class:`LLMClient`? Settings changes
    wouldn't be reflected without a reload — and we want this test to
    cover the *current* DB state, not whatever the LLMClient cached.
    """
    row = db.get(LLMProvider, provider_id)
    if row is None:
        raise HTTPException(404, f"provider '{provider_id}' not found")
    api_key = decrypt_secret(row.api_key) or ""
    if not api_key:
        return LLMProviderTestOut(
            ok=False,
            message="no api_key set — provider can't authenticate",
        )
    if not row.base_url:
        return LLMProviderTestOut(
            ok=False,
            message="no base_url configured",
        )

    common = {
        "id_": row.id,
        "name": row.display_name,
        "base_url": row.base_url,
        "api_key": api_key,
        "priority": row.priority,
        "enabled": row.enabled,
    }
    if row.kind == "anthropic":
        prov = AnthropicProvider(**common)
    else:
        prov = OpenAICompatProvider(**common)

    # Pick a model to test against — explicit override, else first entry
    # in models_json, else a safe default per kind.
    test_model = payload.model or _pick_test_model(row)
    if not test_model:
        return LLMProviderTestOut(
            ok=False,
            message=(
                "no model configured for any task — set models_json or pass "
                "'model' in the request"
            ),
        )

    t0 = time.perf_counter()
    try:
        # Try cheap /models probe first.
        healthy = await prov.health()
        latency_ms = int((time.perf_counter() - t0) * 1000)
        if not healthy:
            return LLMProviderTestOut(
                ok=False,
                message=f"GET {row.base_url}/models returned non-200",
                model=test_model,
                latency_ms=latency_ms,
            )
        return LLMProviderTestOut(
            ok=True,
            message=f"reachable — {row.base_url}/models responded 200",
            model=test_model,
            latency_ms=latency_ms,
        )
    except Exception as e:  # noqa: BLE001
        return LLMProviderTestOut(
            ok=False,
            message=f"health probe failed: {e}",
            model=test_model,
            latency_ms=int((time.perf_counter() - t0) * 1000),
        )


def _pick_test_model(row: LLMProvider) -> str | None:
    """Pick a model to test with — first non-empty value in models_json."""
    for v in (row.models_json or {}).values():
        if v:
            return v
    return None