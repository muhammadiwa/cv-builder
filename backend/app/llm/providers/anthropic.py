"""Anthropic provider — uses native Anthropic Messages API.

Not OpenAI-compat. Different endpoint, different payload shape, different
auth header. This provider wraps the official ``anthropic`` async client
when installed, otherwise falls back to a raw httpx call.
"""
from __future__ import annotations

import time
from typing import Any

import httpx

from app.llm.base import LLMProvider, LLMResult, LLMUsage


class AnthropicProvider(LLMProvider):
    """Anthropic Messages API provider.

    Uses raw httpx to avoid a hard dependency on the ``anthropic`` SDK
    (smaller install footprint, fewer version conflicts).
    """

    kind = "anthropic"

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
        url = f"{self.base_url}/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        # Anthropic uses system + user messages. We collapse to a single user
        # message for simplicity; the LLM client can prepend system if needed.
        payload: dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": prompt}],
        }
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

        # Anthropic returns content as a list of blocks.
        content = data.get("content", [])
        text_parts = [b.get("text", "") for b in content if b.get("type") == "text"]
        text = "".join(text_parts)
        usage_payload = data.get("usage") or {}
        return LLMResult(
            text=text,
            model=model,
            provider=self.id,
            usage=LLMUsage(
                input_tokens=usage_payload.get("input_tokens"),
                output_tokens=usage_payload.get("output_tokens"),
                cost_usd=None,
            ),
            raw=data,
            latency_ms=latency_ms,
        )

    async def health(self) -> bool:
        try:
            headers = {
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
            }
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    f"{self.base_url}/v1/messages",
                    headers=headers,
                    json={"model": "claude-haiku-4-5", "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}]},
                )
                # 400/401 still means the server is reachable; 5xx = down
                return r.status_code < 500
        except Exception:
            return False
