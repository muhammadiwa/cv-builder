"""LLM provider abstractions — base classes + result types.

Every concrete provider (tokenrouter, openai, anthropic, ollama) implements
``LLMProvider.generate()`` and returns an ``LLMResult``. The orchestrator
(``LLMClient``) handles fallback, JSON parsing, cost logging, and retries —
provider implementations stay simple.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMUsage:
    """Token usage for a single call, normalized across providers."""

    input_tokens: int | None = None
    output_tokens: int | None = None
    cost_usd: float | None = None


@dataclass
class LLMResult:
    """Normalized result from any provider.

    ``text`` is the raw response string. ``usage`` is best-effort; some
    providers don't return token counts. ``raw`` is the provider's native
    response payload (for debugging).
    """

    text: str
    model: str
    provider: str
    usage: LLMUsage = None  # type: ignore[assignment]
    raw: dict | None = None
    latency_ms: int = 0

    def __post_init__(self):
        # Dataclass forbids mutable defaults; provide one if caller omitted.
        if self.usage is None:
            self.usage = LLMUsage()


class LLMProvider(ABC):
    """Abstract base for all LLM providers.

    Implementations are stateless and cheap to instantiate. The LLMClient
    creates one provider per call (you can cache if needed).

    ``id``, ``name``, ``priority``, ``enabled`` are set by the LLMClient from
    the loaded config; implementations only define the API call itself.
    """

    id: str = ""
    name: str = ""
    kind: str = ""  # openai_compat | anthropic
    priority: int = 99
    enabled: bool = True
    base_url: str = ""
    api_key: str = ""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: str,
        *,
        temperature: float = 0.3,
        max_tokens: int = 4000,
        json_mode: bool = True,
    ) -> LLMResult:
        """Run a single chat completion. Returns normalized LLMResult.

        ``json_mode=True`` requests a JSON-shaped response; the client still
        runs ``_safe_parse_json`` because providers vary in compliance and
        reasoning models may emit <think> blocks.
        """
        raise NotImplementedError

    async def health(self) -> bool:
        """Quick reachability check. Override per-provider as needed."""
        return True
