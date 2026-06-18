"""LLM integration package — multi-provider abstraction.

Key principle: LLM is a NARRATOR, not a calculator. The codebase owns the
deterministic logic (parsing, scoring, structuring). The LLM only fills in
human-quality text inside well-defined JSON schemas.

Components:
- ``LLMResult``: dataclass for normalized call results (text + tokens + cost).
- ``LLMProvider``: abstract base — every concrete provider implements ``generate``.
- ``OpenAICompatProvider``: works for tokenrouter, openai, ollama, any OpenAI-compat API.
- ``AnthropicProvider``: native Anthropic Messages API.
- ``LLMClient``: orchestrator with priority-based fallback chain, JSON parsing,
  cost tracking, and ``llm_call_log`` persistence.
"""
from app.llm.base import LLMProvider, LLMResult, LLMUsage
from app.llm.client import LLMClient, _safe_parse_json

__all__ = [
    "LLMProvider",
    "LLMResult",
    "LLMUsage",
    "LLMClient",
    "_safe_parse_json",
]
