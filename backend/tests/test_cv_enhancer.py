"""Unit tests for the CV LLM enhancer.

Covers:
- Fact-preservation guard (numeric claims must trace back to input)
- Safe JSON parsing (think blocks, fences, bad JSON)
- Section-specific normalization
"""

from __future__ import annotations

import pytest

from app.services.cv_enhancer import (
    _claim_is_grounded,
    _extract_metrics,
    enhance_section,
)
from app.llm.client import _safe_parse_json


# ── Metric extraction ──────────────────────────────────────────────
def test_extract_metrics_percentage():
    metrics = _extract_metrics("Reduced latency by 40% across the board")
    assert any("40" in m for m in metrics)


def test_extract_metrics_throughput():
    metrics = _extract_metrics("Handled 3M daily queries")
    # After unit normalisation, "M" -> "m" and metric is stored as "3 m"
    # (so that "3M" and "3 million" round-trip to the same canonical form).
    assert any(m == "3 m" for m in metrics), f"got {metrics}"


def test_extract_metrics_no_numbers():
    assert _extract_metrics("Built stuff and shipped code") == set()


def test_extract_metrics_units():
    metrics = _extract_metrics("p99 latency under 100ms")
    assert any("100" in m and "ms" in m for m in metrics)


# ── Fact-preservation guard ────────────────────────────────────────
def test_claim_is_grounded_text_only_edits_allowed():
    original = "Led team of 4 engineers"
    enhanced = "Spearheaded a team of four engineers"
    assert _claim_is_grounded(enhanced, original)


def test_claim_is_grounded_new_numeric_rejected():
    original = "Led team of 4 engineers"
    enhanced = "Reduced latency by 60% across all services"
    assert not _claim_is_grounded(enhanced, original)


def test_claim_is_grounded_preserved_numeric_allowed():
    original = "Reduced p95 latency by 40%"
    enhanced = "Cut p95 latency by 40% using async batching"
    assert _claim_is_grounded(enhanced, original)


def test_claim_is_grounded_p99_in_enhanced_but_not_original_rejected():
    original = "Improved latency"
    enhanced = "Improved p99 latency to 50ms"
    assert not _claim_is_grounded(enhanced, original)


# ── JSON parser robustness ─────────────────────────────────────────
def test_safe_parse_json_pure_json():
    parsed = _safe_parse_json('{"bullets": ["a", "b"]}')
    assert parsed == {"bullets": ["a", "b"]}


def test_safe_parse_json_with_think_block():
    raw = "<think>\nLet me think...\n</think>\n\n{\"text\": \"hi\"}"
    parsed = _safe_parse_json(raw)
    assert parsed == {"text": "hi"}


def test_safe_parse_json_with_fence():
    parsed = _safe_parse_json("```json\n{\"x\": 1}\n```")
    assert parsed == {"x": 1}


def test_safe_parse_json_with_trailing_prose():
    parsed = _safe_parse_json('{"bullets": ["a"]}\n\nHope this helps!')
    assert parsed == {"bullets": ["a"]}


def test_safe_parse_json_garbage_returns_none():
    assert _safe_parse_json("not json at all") is None


def test_safe_parse_json_empty_returns_none():
    assert _safe_parse_json("") is None


# ── enhance_section normalization ──────────────────────────────────
@pytest.mark.asyncio
async def test_enhance_section_summary_unwraps_text(monkeypatch):
    """Force the LLM call to return canned text and confirm normalization."""

    class FakeResult:
        text = '{"text": "Polished summary."}'

    class FakeClient:
        def __init__(self):
            self.calls = []

        def set_db(self, db):
            pass

        async def generate(self, *args, **kwargs):
            self.calls.append((args, kwargs))
            return FakeResult()

    # Patch LLMClient inside the enhancer module
    from app.services import cv_enhancer as ce

    fake = FakeClient()
    monkeypatch.setattr(ce, "LLMClient", lambda: fake)

    result = await ce.enhance_section(section_kind="summary", payload={"section": "summary", "text": "Original"})
    assert result == {"text": "Polished summary."}


@pytest.mark.asyncio
async def test_enhance_section_bullets_unwraps_list(monkeypatch):
    class FakeResult:
        text = '{"bullets": ["Did A", "Did B"]}'

    class FakeClient:
        def set_db(self, db):
            pass

        async def generate(self, *args, **kwargs):
            return FakeResult()

    from app.services import cv_enhancer as ce

    monkeypatch.setattr(ce, "LLMClient", FakeClient)
    result = await ce.enhance_section(section_kind="bullets", payload={"section": "bullets", "bullets": ["A", "B"]})
    assert result == {"bullets": ["Did A", "Did B"]}


@pytest.mark.asyncio
async def test_enhance_section_bad_json_returns_none(monkeypatch):
    class FakeResult:
        text = "I cannot help with that."

    class FakeClient:
        def set_db(self, db):
            pass

        async def generate(self, *args, **kwargs):
            return FakeResult()

    from app.services import cv_enhancer as ce

    monkeypatch.setattr(ce, "LLMClient", FakeClient)
    result = await ce.enhance_section(section_kind="summary", payload={"section": "summary", "text": "x"})
    assert result is None


@pytest.mark.asyncio
async def test_enhance_section_empty_list_returns_none(monkeypatch):
    class FakeResult:
        text = '{"bullets": []}'

    class FakeClient:
        def set_db(self, db):
            pass

        async def generate(self, *args, **kwargs):
            return FakeResult()

    from app.services import cv_enhancer as ce

    monkeypatch.setattr(ce, "LLMClient", FakeClient)
    result = await ce.enhance_section(section_kind="bullets", payload={"section": "bullets", "bullets": ["a"]})
    assert result is None

# ── M2: context-aware metric grounding ──────────────────────────────


def test_metric_context_set_membership_passes():
    from app.services.cv_enhancer import _claim_is_grounded
    original = "Led team of 4 to ship payments"
    enhanced = "Led team of 4 to deliver payments"
    assert _claim_is_grounded(enhanced, original) is True


def test_metric_context_invented_number_rejected():
    from app.services.cv_enhancer import _claim_is_grounded
    original = "Migrated monolith to microservices"
    enhanced = "Migrated monolith to microservices, reducing p95 by 99%"
    assert _claim_is_grounded(enhanced, original) is False


def test_metric_context_preserved_when_metric_kept():
    from app.services.cv_enhancer import _claim_is_grounded
    original = "Improved p95 latency by 40%"
    enhanced = "Reduced p95 latency by 40% across all endpoints"
    # Metric is the same, context overlaps (p95, latency) — must pass.
    assert _claim_is_grounded(enhanced, original) is True


def test_metric_extract_unit_aliases():
    """Different unit spellings normalise to the same canonical form."""
    from app.services.cv_enhancer import _extract_metrics
    assert "10 k" in _extract_metrics("Handled 10K requests")
    assert "10 k" in _extract_metrics("Handled 10k requests")
    assert "60 s" in _extract_metrics("Reduced to 60 seconds")
    assert "60 s" in _extract_metrics("Reduced to 60s")
    # Both forms normalise to "3 m" so they round-trip.
    assert "3 m" in _extract_metrics("3M queries")
    assert "3 m" in _extract_metrics("3 million queries")
