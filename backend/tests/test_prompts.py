"""Tests for the LLM prompts (loader + parse_resume + analyze_jd content).

The loader resolves prompts from ``settings.prompts_dir`` (a tmp dir in
tests, set by conftest). We copy the source-of-truth from
``app/llm/prompts/*.md`` to that runtime location via session-scoped
fixtures so the loader finds it.

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
SOURCE_PARSE_RESUME = (
    Path(__file__).resolve().parent.parent
    / "app"
    / "llm"
    / "prompts"
    / "parse_resume.md"
)
SOURCE_ANALYZE_JD = (
    Path(__file__).resolve().parent.parent
    / "app"
    / "llm"
    / "prompts"
    / "analyze_jd.md"
)


@pytest.fixture(scope="session", autouse=True)
def install_parse_resume_prompt():
    """Copy the source-of-truth prompt into the loader's runtime dir.

    Done once per session because the prompt doesn't change at runtime.
    """
    if not SOURCE_PARSE_RESUME.exists():
        pytest.fail(f"parse_resume.md source missing at {SOURCE_PARSE_RESUME}")
    settings = get_settings()
    target = settings.prompts_dir / "resume_parse" / "v1.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(SOURCE_PARSE_RESUME.read_text(encoding="utf-8"), encoding="utf-8")
    yield


@pytest.fixture(scope="session", autouse=True)
def install_analyze_jd_prompt():
    """Same trick for the analyze_jd prompt (Phase 4)."""
    if not SOURCE_ANALYZE_JD.exists():
        pytest.fail(f"analyze_jd.md source missing at {SOURCE_ANALYZE_JD}")
    settings = get_settings()
    target = settings.prompts_dir / "job_analyze" / "v1.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(SOURCE_ANALYZE_JD.read_text(encoding="utf-8"), encoding="utf-8")
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


# ── analyze_jd prompt (Phase 4) ─────────────────────────────────


def test_analyze_jd_prompt_loads():
    """load_prompt('job_analyze', 'v1') returns a non-empty string."""
    text = load_prompt("job_analyze", "v1")
    assert isinstance(text, str)
    assert len(text) > 500  # reasonable floor — JD prompt is rich
    # Round-trip: loader serves the exact file we installed.
    assert "job description analyzer" in text.lower()
    assert text.strip() == text or text.endswith("\n")  # no garbage


def test_analyze_jd_prompt_has_required_keywords():
    """The JD prompt contains the keywords we promised + key safety rules.

    - "JSON" — must mention JSON output
    - "job" — must reference the source document
    - "extract" — must describe the task
    Plus the anti-fabrication rule + JSON Resume schema reference.
    """
    text = load_prompt("job_analyze", "v1").lower()
    for kw in ("json", "job", "extract"):
        assert kw in text, f"prompt missing required keyword: {kw!r}"

    # Anti-fabrication — same bar as parse_resume.
    assert "do not invent" in text or "must not invent" in text, (
        "analyze_jd prompt must forbid the LLM from inventing skills/salary/company"
    )

    # Schema reference — we promised JSON Resume JD v1.0.0.
    assert "json resume" in text or "jsonresume" in text, (
        "analyze_jd prompt must reference the JSON Resume JD schema"
    )

    # Prompt-injection defense — JD is data, not instructions.
    assert "prompt" in text and ("injection" in text or "instructions" in text), (
        "analyze_jd prompt should mention prompt-injection / instructions-as-data"
    )