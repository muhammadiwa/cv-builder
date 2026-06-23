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

    Strategy (in order):
    1. Strip leading <think>...</think> (or to end-of-text if truncated).
    2. Strip ```json / ``` fences.
    3. Try strict ``json.loads`` on the cleaned text.
    4. If that fails, scan every ``{`` and ``[`` position and try
       ``json.JSONDecoder.raw_decode`` (handles truncation gracefully —
       returns the longest valid prefix even if the closing brace is cut).
    5. If still nothing, return ``None`` so the caller can decide to
       fall back / retry / log.

    Why ``raw_decode`` over a brace-matcher: brace-matching can grab across
    multiple JSON objects (e.g. ``{a}{b}``), and it silently accepts
    broken content. ``raw_decode`` parses only a complete JSON value and
    returns the position where it stopped, so we know exactly what we
    consumed.
    """
    if not text:
        return None
    s = text.strip()

    # 1. Strip <think> blocks. If the close tag is missing (truncated), drop
    #    everything from <think> to end-of-text so the JSON parser sees the
    #    real response, not the partial chain-of-thought.
    s = re.sub(r"<think>.*?(</think>|$)", "", s, flags=re.DOTALL | re.IGNORECASE).strip()
    if not s:
        return None

    # 2. Strip code fences.
    if s.startswith("```"):
        # Remove leading fence + optional language tag.
        s = re.sub(r"^```[a-zA-Z0-9_-]*\s*\n?", "", s)
        s = re.sub(r"\n?```\s*$", "", s).strip()
    if not s:
        return None

    # 3. Fast path — strict parse.
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        pass

    # 4. Scan for the first valid JSON value (object or array).
    decoder = json.JSONDecoder()
    candidates: list[Any] = []
    for opener in ("{", "["):
        pos = 0
        while True:
            i = s.find(opener, pos)
            if i == -1:
                break
            try:
                obj, end = decoder.raw_decode(s, i)
                candidates.append(obj)
                # Take the first valid parse — later ones are usually
                # fragments (e.g. closing brace of a previous object).
                return obj
            except json.JSONDecodeError:
                pos = i + 1
                continue
    # 5. Nothing parsed cleanly.
    return None


# ── Per-task model catalog (referenced by task_type) ────────────────
TASK_TYPES = {
    "resume_parse",   # extract structured data from raw resume text
    "job_analyze",    # extract role, requirements, ATS keywords from JD
    "match",          # score base profile against job + narrate
    "score_match",    # AI-powered full match scoring (Phase 10E)
    "cv_generate",    # build tailored CV content
    "cv_score",       # score + critique a CV draft
    "cv_improve",     # generate improvement recommendations
    "cv_enhance",     # LLM polish per CV section (bullets, summary)
    "cover_letter",   # generate cover letter
}


class LLMClient:
    """Multi-provider LLM orchestrator.

    Created once per request (cheap — providers are stateless). Holds
    config from disk; ``providers`` is the list of enabled, sorted-by-priority
    provider instances. ``generate`` walks them on failure.
    """

    def __init__(
        self,
        config_path: Path | None = None,  # kept for backward compat tests
        db: Session | None = None,
    ):
        """Construct an LLMClient.

        Phase 10B: provider config is read from the ``llm_providers`` DB
        table (via :mod:`app.llm.store`). ``config_path`` is preserved as
        a fallback for tests that ship a fixture JSON.

        Resolution order:
          1. ``db`` if provided (preferred — DB is the source of truth).
          2. ``config_path`` if provided.
          3. Auto-resolve the legacy ``configs/llm_providers.json`` so
             existing tests + dev workflows still work without changes.

        If none of those resolve, the client starts with zero providers
        and the next :meth:`generate` call raises :class:`RuntimeError`.
        """
        self._db = db
        self._config_path = config_path
        self.config: dict[str, Any] = {"providers": []}
        self.providers: list[LLMProvider] = []
        self._reload()

    def set_db(self, db: Session) -> None:
        """Inject DB session for cost logging + provider loading.

        Also triggers a reload so the new session's view of the
        ``llm_providers`` table is used immediately.
        """
        self._db = db
        self._reload()

    def _reload(self) -> None:
        """Refresh ``config`` + ``providers`` from DB (or fallback JSON).

        Cheap — providers are stateless wrappers around config dicts, so
        building them is just dict construction + class instantiation.
        """
        if self._db is not None:
            from app.llm.store import load_all

            try:
                providers_cfg = load_all(self._db)
            except Exception as e:  # noqa: BLE001 — DB errors must not crash callers
                log.warning("llm_db_load_failed", error=str(e))
                providers_cfg = []
            self.config = {"providers": providers_cfg}
        else:
            # Fallback: explicit config_path, else auto-resolve the legacy
            # JSON file. Preserves backward compat with the existing test
            # suite + any workflow that hasn't been migrated yet.
            path = self._config_path or self._resolve_config_path()
            self.config = self._load_config(path)
            self._config_path = path

        self.providers = self._instantiate_providers(self.config)
        if not self.providers:
            log.warning("llm_no_providers_enabled")

    # ── Config loading (JSON fallback only — primary path is DB) ───
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
            common = {
                "id_": p["id"],
                "name": p.get("name", p["id"]),
                "base_url": p.get("base_url", ""),
                "api_key": p.get("api_key", ""),  # already decrypted by store
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
