"""OpenAI-compatible provider — works for tokenrouter, openai, ollama, etc.

Most modern LLM providers (and local servers like Ollama, vLLM, llama.cpp
chat completions) implement the OpenAI Chat Completions API. This single
class handles all of them — the only differences are base_url and api_key,
which come from the config.

We use the official ``openai`` SDK async client for proper connection pooling,
retries, and streaming (when we add it). For the ``MiniMax-M3`` reasoning
model on tokenrouter, we explicitly do NOT send ``response_format`` because
that token burns reasoning budget. JSON mode is achieved via prompt
instructions + post-hoc ``_safe_parse_json``.
"""
from __future__ import annotations

import os
import time
from typing import Any

import httpx

from app.llm.base import LLMProvider, LLMResult, LLMUsage


class OpenAICompatProvider(LLMProvider):
    """OpenAI Chat Completions compatible provider.

    Works with: tokenrouter, openai, ollama, together.ai, fireworks, etc.
    The provider is identified by ``base_url`` and ``api_key`` from config.
    """

    kind = "openai_compat"

    def __init__(self, id_: str, name: str, base_url: str, api_key: str, priority: int, enabled: bool):
        self.id = id_
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.priority = priority
        self.enabled = enabled

    async def generate(
        self,
        prompt: str,
        model: str,
        *,
        temperature: float = 0.3,
        max_tokens: int = 4000,
        json_mode: bool = True,
    ) -> LLMResult:
        url = f"{self.base_url}/chat/completions"
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        payload: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        # NOTE: We intentionally do NOT send `response_format={"type": "json_object"}`
        # here. Reasoning models (e.g. MiniMax-M3) burn tokens on the think block
        # and then run out of budget before producing JSON, returning truncated
        # output. _safe_parse_json already handles non-JSON output (think blocks,
        # code fences, etc.), so we let the upstream emit naturally.
        if json_mode:
            pass  # intentionally no-op, see note above

        t0 = time.perf_counter()
        async with httpx.AsyncClient(timeout=120) as client:
            try:
                r = await client.post(url, headers=headers, json=payload)
                r.raise_for_status()
            except httpx.HTTPStatusError as e:
                try:
                    err_body = e.response.text[:500]
                except Exception:
                    err_body = "<no body>"
                raise RuntimeError(
                    f"upstream HTTP {e.response.status_code} model={model}: {err_body}"
                ) from e
            data = r.json()
        latency_ms = int((time.perf_counter() - t0) * 1000)

        text = data["choices"][0]["message"]["content"]
        usage_payload = data.get("usage") or {}
        return LLMResult(
            text=text,
            model=model,
            provider=self.id,
            usage=LLMUsage(
                input_tokens=usage_payload.get("prompt_tokens"),
                output_tokens=usage_payload.get("completion_tokens"),
                cost_usd=None,  # cost calc per-provider lives in LLMClient
            ),
            raw=data,
            latency_ms=latency_ms,
        )

    async def health(self) -> bool:
        """HEAD /models — most OpenAI-compat providers support this."""
        if not self.base_url:
            return False
        try:
            headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(f"{self.base_url}/models", headers=headers)
                return r.status_code == 200
        except Exception:
            return False
