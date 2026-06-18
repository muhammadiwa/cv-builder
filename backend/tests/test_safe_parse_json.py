"""Tests for ``_safe_parse_json`` — handles LLM output quirks robustly.

Real LLM responses are messy: think blocks, code fences, trailing prose,
truncated JSON, brace-in-think-text. The parser must extract the first
valid JSON object/array regardless.
"""
from __future__ import annotations

from app.llm.client import _safe_parse_json


def test_parses_clean_json():
    assert _safe_parse_json('{"a": 1, "b": "x"}') == {"a": 1, "b": "x"}


def test_parses_json_array():
    assert _safe_parse_json('[1, 2, 3]') == [1, 2, 3]


def test_strips_think_block_then_parses():
    text = "<think>\nThe user wants JSON. Let me think... just {}.\n</think>\n\n{\"ok\": true, \"n\": 42}"
    assert _safe_parse_json(text) == {"ok": True, "n": 42}


def test_strips_code_fences():
    text = "```json\n{\"key\": \"value\"}\n```"
    assert _safe_parse_json(text) == {"key": "value"}


def test_strips_code_fences_no_lang_tag():
    text = "```\n[1, 2]\n```"
    assert _safe_parse_json(text) == [1, 2]


def test_handles_trailing_prose():
    text = '{"status": "ok", "value": 99}\n\nNote: this is a comment that should be ignored.'
    parsed = _safe_parse_json(text)
    assert parsed == {"status": "ok", "value": 99}


def test_handles_think_block_with_braces_inside():
    """The 'just {}' inside the think text must not fool the brace-matching fallback."""
    text = (
        "<think>\nThe user wants JSON. With no data, I return `{}` (empty).\n"
        "</think>\n"
        "{\"real\": true}"
    )
    assert _safe_parse_json(text) == {"real": True}


def test_extracts_first_object_when_garbage_around():
    text = "Here's the result: {\"a\": 1} and some more text after."
    assert _safe_parse_json(text) == {"a": 1}


def test_returns_none_for_garbage():
    assert _safe_parse_json("not json at all") is None


def test_returns_none_for_empty_string():
    assert _safe_parse_json("") is None


def test_handles_nested_objects():
    text = '{"outer": {"inner": [1, 2, 3], "flag": true}}'
    assert _safe_parse_json(text) == {"outer": {"inner": [1, 2, 3], "flag": True}}


def test_handles_whitespace_and_newlines():
    text = '\n\n   {"a": 1}\n  \n'
    assert _safe_parse_json(text) == {"a": 1}


def test_handles_unicode():
    text = '{"name": "Andi Pratama", "city": "Jakarta 🏙️"}'
    parsed = _safe_parse_json(text)
    assert parsed["name"] == "Andi Pratama"
    assert "Jakarta" in parsed["city"]


def test_handles_truncated_json_gracefully():
    """Truncated JSON (missing closing brace) returns None — caller handles."""
    text = '{"a": 1, "b": 2, "c": 3'  # no closing brace
    # The strict parse fails; the brace fallback finds '{' and '}' mismatch
    # so it also fails; result is None.
    assert _safe_parse_json(text) is None


def test_think_with_real_json_after_handles_braces_in_think():
    """Regression: 'just {}' inside think must not preempt the real JSON."""
    # Simulate: think text mentions `{}` and `[]` and `{"k": "v"}` as examples,
    # but the real answer is at the end after </think>.
    text = (
        '<think>\n'
        'Examples: {} or [] or {"k": "v"}. Need to return one. Here it is.\n'
        '</think>\n'
        '{"final": "answer"}'
    )
    parsed = _safe_parse_json(text)
    assert parsed == {"final": "answer"}
