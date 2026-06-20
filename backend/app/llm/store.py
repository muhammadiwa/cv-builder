"""LLM provider repository (Phase 10B).

Persists provider config in the DB instead of ``configs/llm_providers.json``.
The store hydrates :class:`LLMProvider` rows into the dict shape that
:class:`app.llm.client.LLMClient` already expects, so the rest of the LLM
stack doesn't change.

API keys are stored Fernet-encrypted (``app.core.crypto.encrypt_secret``)
and decrypted on read when instantiating provider instances.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.logging import get_logger
from app.models.models import LLMProvider

log = get_logger(__name__)

# Keys we know how to round-trip from the legacy JSON file. Used by
# ``seed_from_json_if_empty`` so existing setups aren't blown away.
_LEGACY_CONFIG_PATHS: tuple[str, ...] = (
    "configs/llm_providers.json",
    "../configs/llm_providers.json",
)


def _resolve_legacy_config_path() -> Path | None:
    """Find the legacy ``llm_providers.json`` if it exists.

    Search order:
      1. ``CV_LLM_PROVIDERS_CONFIG`` env var (relative or absolute).
      2. ``configs/llm_providers.json`` relative to the repo root.
      3. ``configs/llm_providers.json`` relative to cwd.

    Returns ``None`` if none of them exist.
    """
    env = os.environ.get("CV_LLM_PROVIDERS_CONFIG")
    if env:
        p = Path(env)
        if not p.is_absolute():
            p = Path.cwd() / p
        if p.exists():
            return p
    # Walk up from CWD to find configs/llm_providers.json.
    for ancestor in (Path.cwd(), *Path.cwd().parents):
        candidate = ancestor / "configs" / "llm_providers.json"
        if candidate.exists():
            return candidate
    return None


def seed_from_json_if_empty(db: Session) -> int:
    """One-shot migration: copy rows from JSON into the DB on first run.

    Idempotent — only runs when the ``llm_providers`` table has zero rows.
    API keys are hydrated from the env var referenced by ``api_key_env``
    in the JSON file (matching the old behavior) and then encrypted before
    insert. If the env var isn't set, ``api_key`` stays empty and the
    provider is seeded as ``enabled=false`` so a Settings toggle won't
    silently send requests with an empty key.

    Returns the number of rows seeded.
    """
    existing = db.query(LLMProvider).count()
    if existing > 0:
        return 0
    path = _resolve_legacy_config_path()
    if path is None:
        log.info("llm_seed_no_legacy_config")
        return 0
    try:
        with path.open() as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        log.warning("llm_seed_legacy_read_failed", path=str(path), error=str(e))
        return 0

    seeded = 0
    for p in data.get("providers", []):
        api_key_env = p.get("api_key_env")
        plain_key = os.environ.get(api_key_env, "") if api_key_env else ""
        if not plain_key:
            # Seed disabled so the LLM stack doesn't try to call without auth.
            log.info(
                "llm_seed_no_key",
                provider=p.get("id"),
                hint=f"set {api_key_env} in the environment",
            )
        encrypted = encrypt_secret(plain_key) if plain_key else ""
        row = LLMProvider(
            id=p["id"],
            display_name=p.get("name", p["id"]),
            kind=p.get("kind", "openai_compat"),
            base_url=p.get("base_url", ""),
            api_key=encrypted,
            api_key_set=bool(plain_key),
            enabled=bool(p.get("enabled", False)) and bool(plain_key),
            priority=int(p.get("priority", 99)),
            models_json=p.get("models", {}) or {},
            max_tokens_default=int(p.get("max_tokens_default", 4000)),
            temperature_default=float(p.get("temperature_default", 0.3)),
        )
        db.add(row)
        seeded += 1
    if seeded:
        db.commit()
        log.info("llm_seeded_from_legacy", count=seeded, source=str(path))
    return seeded


def hydrate_provider_dict(row: LLMProvider) -> dict[str, Any]:
    """Build the dict shape :class:`LLMClient` expects from a DB row.

    Decrypts ``api_key`` here — callers should only use the dict in
    memory and never serialize it to disk or logs.
    """
    return {
        "id": row.id,
        "name": row.display_name,
        "enabled": row.enabled,
        "priority": row.priority,
        "kind": row.kind,
        "base_url": row.base_url,
        "api_key": decrypt_secret(row.api_key) or "",
        "models": dict(row.models_json or {}),
        "max_tokens_default": row.max_tokens_default,
        "temperature_default": row.temperature_default,
    }


def load_all(db: Session) -> list[dict[str, Any]]:
    """Return all providers hydrated for :class:`LLMClient`."""
    rows = db.query(LLMProvider).order_by(LLMProvider.priority.asc()).all()
    return [hydrate_provider_dict(r) for r in rows]