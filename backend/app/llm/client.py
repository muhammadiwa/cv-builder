"""LLMClient — orchestrator for multi-provider LLM access.

Single entry point for the rest of the app. Handles:
- Loading + validating provider config from ``configs/llm_providers.json``.
- Instantiating the right provider class per ``kind``.
- Per-task model selection (e.g. cv_generate uses a stronger model than cv_score).
- Priority-based fallback chain (try provider 1, on failure try 2, etc.).
- Robust JSON parsing (``_safe_parse_json`` handles think blocks + fences).
- Logging every call to ``llm_call_log`` table.
- Cost tracking (best-effort, USD).

Usage::

    from app.llm import LLMClient
    client = LLMClient()
    result = await client.generate(prompt, task_type="cv_generate")
    parsed = client.parse_json(result.text)
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.llm.base import LLMProvider, LLMResult
from app.llm.providers.anthropic import AnthropicProvider
from app.llm.providers.openai_compat import OpenAICompatProvider
from app.models.models import LLMCallLog

log = get_logger(__name__)


# ── JSON parsing ───────────────────────────────────────────────────


def _safe_parse_json(text: str) -> Any:
    """Tolerate ```json fences, trailing prose, and <think>...</think> blocks.

    Strips <think> blocks first (some reasoning models emit them with literal
    JSON-like content inside the think text — e.g. "just `{}`" — that
    confuses brace-matching). Then tries strict json.loads. Falls back to
    extracting the first {...} or [...] block.
    """
    if not text:
        return None
    s = text.strip()
    # Strip leading <think>...</think> block (case-insensitive, allow newlines).
    s = re.sub(r"<think>.*?</think>", "", s, flags=re.DOTALL | re.IGNORECASE).strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s.startswith("json"):
            s = s[4:]
        s = s.strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        # Try first {...} or [...] block
        for opener, closer in (("{", "}"), ("[", "]")):
            i = s.find(opener)
            j = s.rfind(closer)
            if i != -1 and j != -1 and j > i:
                try:
                    return json.loads(s[i : j + 1])
                except json.JSONDecodeError:
                    continue
    return None


# ── Per-task model catalog (referenced by task_type) ────────────────
TASK_TYPES = {
    "resume_parse",   # extract structured data from raw resume text
    "job_analyze",    # extract role, requirements, ATS keywords from JD
    "match",          # score base profile against job + narrate
    "cv_generate",    # build tailored CV content
    "cv_score",       # score + critique a CV draft
    "cv_improve",     # generate improvement recommendations
    "cover_letter",   # generate cover letter
}


class LLMClient:
    """Multi-provider LLM orchestrator.

    Created once per request (cheap — providers are stateless). Holds
    config from disk; ``providers`` is the list of enabled, sorted-by-priority
    provider instances. ``generate`` walks them on failure.
    """

    def __init__(self, config_path: Path | None = None, db: Session | None = None):
        self._db = db  # optional: passed per-call or via setter
        self._config_path = config_path or self._resolve_config_path()
        self.config = self._load_config(self._config_path)
        self.providers: list[LLMProvider] = self._instantiate_providers(self.config)
        if not self.providers:
            log.warning("llm_no_providers_enabled", path=str(self._config_path))

    def set_db(self, db: Session) -> None:
        """Inject DB session for cost logging (call before generate)."""
        self._db = db

    # ── Config loading ────────────────────────────────────────
    @staticmethod
    def _resolve_config_path() -> Path:
        """Resolve the llm_providers.json path.

        Default location: <repo_root>/configs/llm_providers.json. We resolve
        relative to the backend's CWD first, then walk up to the project root.
        """
        s = get_settings()
        p = Path(s.llm_providers_config)
        if p.is_absolute():
            return p
        if p.exists():
            return p.resolve()
        # walk up
        for ancestor in Path.cwd().resolve().parents:
            candidate = ancestor / "configs" / "llm_providers.json"
            if candidate.exists():
                return candidate
        return p  # fall back to whatever was configured (will 404 cleanly)

    @staticmethod
    def _load_config(path: Path) -> dict[str, Any]:
        if not path.exists():
            return {"providers": []}
        with path.open() as f:
            return json.load(f)

    @staticmethod
    def _instantiate_providers(config: dict[str, Any]) -> list[LLMProvider]:
        out: list[LLMProvider] = []
        for p in config.get("providers", []):
            if not p.get("enabled", False):
                continue
            kind = p.get("kind", "openai_compat")
            api_key_env = p.get("api_key_env")
            api_key = os.environ.get(api_key_env, "") if api_key_env else ""
            common = {
                "id_": p["id"],
                "name": p.get("name", p["id"]),
                "base_url": p.get("base_url", ""),
                "api_key": api_key,
                "priority": p.get("priority", 99),
                "enabled": p.get("enabled", False),
            }
            if kind == "anthropic":
                out.append(AnthropicProvider(**common))
            else:
                # openai_compat is the default — covers tokenrouter, openai, ollama, etc.
                out.append(OpenAICompatProvider(**common))
        out.sort(key=lambda p: p.priority)
        return out

    # ── Public API ────────────────────────────────────────────
    def list_providers(self) -> list[dict[str, Any]]:
        """Return a list of provider summaries (id, name, priority, enabled, has_api_key, models)."""
        result = []
        for p_cfg in self.config.get("providers", []):
            api_key_env = p_cfg.get("api_key_env")
            api_key = os.environ.get(api_key_env, "") if api_key_env else ""
            # Look up actual provider instance if it was instantiated
            inst = next((x for x in self.providers if x.id == p_cfg["id"]), None)
            result.append(
                {
                    "id": p_cfg["id"],
                    "name": p_cfg.get("name", p_cfg["id"]),
                    "priority": p_cfg.get("priority", 99),
                    "enabled": p_cfg.get("enabled", False),
                    "has_api_key": bool(api_key),
                    "kind": p_cfg.get("kind", "openai_compat"),
                    "base_url": p_cfg.get("base_url", ""),
                    "models": p_cfg.get("models", {}),
                }
            )
        return result

    def get_provider_status(self) -> list[dict[str, Any]]:
        """Enrich list_providers() with health check results (async — caller awaits)."""
        return self.list_providers()  # base impl; richer health is done async separately

    def model_for(self, task_type: str) -> tuple[str | None, str | None]:
        """Return (provider_id, model_name) for a task, or (None, None) if disabled.

        Picks the lowest-priority enabled provider that has a model configured
        for this task. Used internally + by tests.
        """
        if task_type not in TASK_TYPES:
            return None, None
        for p_cfg in self.config.get("providers", []):
            if not p_cfg.get("enabled", False):
                continue
            models = p_cfg.get("models", {}) or {}
            model = models.get(task_type)
            if model:
                return p_cfg["id"], model
        return None, None

    async def generate(
        self,
        prompt: str,
        task_type: str,
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
        json_mode: bool = True,
        prompt_version: str = "v1",
        prompt_id: str | None = None,
    ) -> LLMResult:
        """Run a single completion with priority-based fallback.

        Picks the model for ``task_type`` from the lowest-priority enabled
        provider, then attempts that provider. On any failure, walks the
        rest of the chain (skipping the chosen one). Raises if all fail.
        """
        if not self.providers:
            raise RuntimeError("No LLM providers enabled — check llm_providers.json + API keys")

        # Find the chosen provider for this task.
        chosen_id, chosen_model = self.model_for(task_type)
        providers_in_order: list[LLMProvider] = []
        if chosen_id:
            for prov in self.providers:
                if prov.id == chosen_id:
                    providers_in_order.append(prov)
                    break
        providers_in_order.extend(p for p in self.providers if p.id != chosen_id)

        last_err: Exception | None = None
        for prov in providers_in_order:
            model = (chosen_model if prov.id == chosen_id else None) or self._model_for_provider(prov.id, task_type)
            if not model:
                continue
            t = temperature if temperature is not None else 0.3
            mx = max_tokens if max_tokens is not None else 4000
            try:
                t0 = time.perf_counter()
                result = await prov.generate(
                    prompt, model, temperature=t, max_tokens=mx, json_mode=json_mode,
                )
                wall_ms = int((time.perf_counter() - t0) * 1000)
                log.info(
                    "llm_call_ok",
                    task=task_type, provider=prov.id, model=model,
                    latency_ms=result.latency_ms, wall_ms=wall_ms,
                    in_tokens=result.usage.input_tokens, out_tokens=result.usage.output_tokens,
                )
                self._log_call(
                    task_type=task_type, provider=prov.id, model=model,
                    prompt_version=prompt_version, prompt_id=prompt_id,
                    prompt=prompt, result=result, success=True,
                )
                return result
            except Exception as e:  # noqa: BLE001
                last_err = e
                log.warning(
                    "llm_call_failed",
                    task=task_type, provider=prov.id, model=model, error=str(e)[:300],
                )
                self._log_call(
                    task_type=task_type, provider=prov.id, model=model,
                    prompt_version=prompt_version, prompt_id=prompt_id,
                    prompt=prompt, result=None, success=False, error=str(e),
                )
                continue
        raise RuntimeError(
            f"All LLM providers failed for task={task_type}: {last_err}"
        )

    def parse_json(self, text: str) -> Any:
        """Public wrapper around _safe_parse_json so callers don't import private."""
        return _safe_parse_json(text)

    # ── Internals ─────────────────────────────────────────────
    def _model_for_provider(self, provider_id: str, task_type: str) -> str | None:
        for p_cfg in self.config.get("providers", []):
            if p_cfg["id"] == provider_id:
                return (p_cfg.get("models") or {}).get(task_type)
        return None

    def _log_call(
        self,
        *,
        task_type: str,
        provider: str,
        model: str,
        prompt_version: str,
        prompt_id: str | None,
        prompt: str,
        result: LLMResult | None,
        success: bool,
        error: str | None = None,
    ) -> None:
        """Persist to llm_call_log if DB session is set. Best-effort."""
        if self._db is None:
            return
        try:
            input_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
            row = LLMCallLog(
                id=_new_id(),
                task_type=task_type,
                provider=provider,
                model=model,
                prompt_id=prompt_id,
                prompt_version=int(prompt_version.lstrip("v") or "1"),
                input_hash=input_hash,
                input_tokens=result.usage.input_tokens if result else None,
                output_tokens=result.usage.output_tokens if result else None,
                cost_usd=result.usage.cost_usd if result else None,
                latency_ms=result.latency_ms if result else None,
                success=success,
                error=error,
            )
            self._db.add(row)
            self._db.commit()
        except Exception as e:  # noqa: BLE001
            log.warning("llm_log_failed", error=str(e)[:200])


def _new_id() -> str:
    import uuid
    return str(uuid.uuid4())
