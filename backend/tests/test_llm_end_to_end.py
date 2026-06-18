"""End-to-end LLM test against the real configured provider (tokenrouter).

This test makes a real network call. It is skipped if the API key env var
is missing, so the suite still works in offline CI.

We send a minimal prompt to verify:
- the chosen provider responds
- response text is non-empty
- _safe_parse_json can extract JSON from a typical response shape
- the call is logged to llm_call_log (if DB session is set)
"""
from __future__ import annotations

import os

import pytest

from app.db.session import SessionLocal
from app.llm.client import LLMClient, _safe_parse_json
from app.models.models import LLMCallLog


@pytest.mark.skipif(
    not os.environ.get("TOKENROUTER_API_KEY"),
    reason="TOKENROUTER_API_KEY not set — skipping live LLM test",
)
@pytest.mark.asyncio
async def test_live_llm_call_returns_valid_json():
    """Real MiniMax-M3 call: prompt, parse, verify content."""
    client = LLMClient()
    if not any(p.id == "tokenrouter" for p in client.providers):
        pytest.skip("tokenrouter not in providers")

    prompt = (
        "Return ONLY a JSON object with this exact shape (no prose, no markdown):\n"
        '{"status": "ok", "n": 42}\n'
        "Do not include any other text."
    )
    result = await client.generate(prompt, task_type="match", max_tokens=200, temperature=0.0)
    assert result.text
    assert result.provider == "tokenrouter"
    # Result should contain the JSON somewhere in the output
    parsed = _safe_parse_json(result.text)
    assert parsed is not None
    assert parsed.get("status") == "ok"
    assert parsed.get("n") == 42


@pytest.mark.skipif(
    not os.environ.get("TOKENROUTER_API_KEY"),
    reason="TOKENROUTER_API_KEY not set — skipping live LLM test",
)
@pytest.mark.asyncio
async def test_live_llm_call_persists_to_log():
    """A real call (with DB session) writes a row to llm_call_log."""
    client = LLMClient()
    if not any(p.id == "tokenrouter" for p in client.providers):
        pytest.skip("tokenrouter not in providers")

    db = SessionLocal()
    try:
        client.set_db(db)
        before = db.query(LLMCallLog).count()

        result = await client.generate(
            "Return JSON: {\"ping\": \"pong\"}",
            task_type="match",
            max_tokens=100,
            temperature=0.0,
        )
        assert result.text

        after = db.query(LLMCallLog).count()
        assert after == before + 1, f"expected 1 new log row, got {after - before}"
        # Last row should reference tokenrouter
        last = db.query(LLMCallLog).order_by(LLMCallLog.created_at.desc()).first()
        assert last.provider == "tokenrouter"
        assert last.task_type == "match"
    finally:
        db.close()
