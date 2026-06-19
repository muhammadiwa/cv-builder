"""Tests for the LLM prompts (loader + parse_resume content).

The loader resolves prompts from ``settings.prompts_dir`` (a tmp dir in
tests, set by conftest). We copy the source-of-truth from
``app/llm/prompts/parse_resume.md`` to that runtime location via a
session-scoped fixture so the loader finds it.

This keeps the prompt version-controllable in git (one file in source)
while still respecting the loader's storage-path contract.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from app.core.config import get_settings
from app.llm.prompts.loader import load_prompt


# Source-of-truth lives in the repo (committed). Runtime copy lives in the
# storage dir (loader reads from there). Tests bridge the two.
SOURCE_PROMPT_PATH = (
    Path(__file__).resolve().parent.parent
    / "app"
    / "llm"
    / "prompts"
    / "parse_resume.md"
)


@pytest.fixture(scope="session", autouse=True)
def install_parse_resume_prompt():
    """Copy the source-of-truth prompt into the loader's runtime dir.

    Done once per session because the prompt doesn't change at runtime.
    """
    if not SOURCE_PROMPT_PATH.exists():
        pytest.fail(f"parse_resume.md source missing at {SOURCE_PROMPT_PATH}")
    settings = get_settings()
    target = settings.prompts_dir / "resume_parse" / "v1.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(SOURCE_PROMPT_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    yield


def test_prompt_loads():
    """load_prompt('resume_parse', 'v1') returns a non-empty string.

    This is the smoke test for the loader + our installed prompt. If the
    file disappeared or the loader lost its way, this fails first.
    """
    text = load_prompt("resume_parse", "v1")
    assert isinstance(text, str)
    assert len(text) > 100  # prompt is several KB
    assert text.strip() == text or text.endswith("\n")  # no garbage


def test_prompt_has_required_keywords():
    """The prompt contains the keywords we promised in the plan.

    - "JSON" — must mention JSON output
    - "resume" — must reference the source document
    - "extract" — must describe the task

    We also do a couple of extra spot-checks (system-role phrasing,
    no-invent rule, date format) so a sloppy prompt rewrite gets caught.
    """
    text = load_prompt("resume_parse", "v1").lower()
    for kw in ("json", "resume", "extract"):
        assert kw in text, f"prompt missing required keyword: {kw!r}"

    # Anti-fabrication rule — the most important safety net for this prompt.
    assert "do not invent" in text or "do  not invent" in text or "must not invent" in text, (
        "prompt must forbid the LLM from inventing data"
    )

    # Date format guidance — YYYY-MM is the canonical JSON Resume shape.
    assert "yyyy-mm" in text

    # Schema reference — we promised JSON Resume v1.0.0 in the plan.
    assert "json resume" in text or "jsonresume" in text