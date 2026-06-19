"""Tests for the JD analyzer service.

We mock ``LLMClient.generate`` so these tests are deterministic, fast,
and offline. The real-LLM coverage is in BE-6's end-to-end test.

Each test sets up a fresh DB session, seeds a User + a Job in
``status='parsing'`` with some raw_description, then calls
``analyze_jd(job_id, db)`` and asserts on the persisted Job row.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import get_settings
from app.llm.base import LLMResult, LLMUsage
from app.llm.prompts.loader import load_prompt
from app.models.models import Job, User
from app.services.jd_analyzer import (
    analyze_jd,
    compute_confidence,
    extract_ats_keywords,
)


SOURCE_PROMPT_PATH = (
    Path(__file__).resolve().parent.parent
    / "app"
    / "llm"
    / "prompts"
    / "analyze_jd.md"
)


@pytest.fixture(scope="session", autouse=True)
def install_analyze_jd_prompt():
    """Mirror the source-of-truth prompt into the loader's runtime dir.

    Same trick as test_prompts.py — the loader reads from
    ``settings.prompts_dir`` (a tmp dir under tests).
    """
    if not SOURCE_PROMPT_PATH.exists():
        pytest.fail(f"analyze_jd.md source missing at {SOURCE_PROMPT_PATH}")
    settings = get_settings()
    target = settings.prompts_dir / "job_analyze" / "v1.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(SOURCE_PROMPT_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    yield


# ── DB / fixture helpers ──────────────────────────────────────────────


def _seed_user(session) -> User:
    user = User(
        id=str(uuid.uuid4()),
        name="Default User",
        email="default@local",
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _seed_job(session, user: User, raw_description: str, source_type: str = "manual") -> Job:
    job = Job(
        id=str(uuid.uuid4()),
        user_id=user.id,
        source_type=source_type,
        raw_description=raw_description,
        status="parsing",
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


VALID_ANALYSIS: dict[str, Any] = {
    "title": "Senior Backend Engineer",
    "company": "Bukalapak",
    "location": "Jakarta, Indonesia",
    "remote_type": "hybrid",
    "employment_type": "full_time",
    "seniority": "senior",
    "salary": {"min": 25000000, "max": 40000000, "currency": "IDR"},
    "summary": "Build distributed payment systems serving 10M+ users.",
    "responsibilities": [
        "Design and implement microservices",
        "Lead technical architecture decisions",
    ],
    "required_skills": [
        {"name": "Backend", "keywords": ["Python", "FastAPI", "PostgreSQL"]},
        {"name": "Cloud", "keywords": ["AWS", "Kubernetes", "Terraform"]},
    ],
    "preferred_skills": [
        {"name": "Frontend", "keywords": ["React", "TypeScript"]},
    ],
    "required_experience_years": 5,
    "required_education": "Bachelor in Computer Science or related field",
    "ats_keywords": [
        "Python", "FastAPI", "Microservices", "AWS", "Kubernetes",
        "PostgreSQL", "Distributed Systems", "REST API", "CI/CD",
        "Docker", "Terraform",
    ],
}


def _mock_llm_result(parsed: Any) -> LLMResult:
    """Build an LLMResult that looks like the LLM returned ``parsed`` as JSON."""
    if parsed is None:
        text = "not json at all — model went off the rails"
    elif isinstance(parsed, str):
        text = parsed
    else:
        text = json.dumps(parsed)
    return LLMResult(
        text=text,
        model="MiniMax-M3",
        provider="tokenrouter",
        usage=LLMUsage(input_tokens=200, output_tokens=400, cost_usd=0.0002),
        latency_ms=250,
    )


# ── Pure-function tests ────────────────────────────────────────────


def test_compute_confidence_full():
    """All sections populated → confidence == 1.0."""
    score = compute_confidence(VALID_ANALYSIS)
    assert score == 1.0


def test_compute_confidence_title_only():
    """Only title set → score is 1 / len(EXPECTED_SECTIONS)."""
    score = compute_confidence({"title": "Engineer"})
    assert 0.0 < score < 0.2


def test_extract_ats_keywords_unions_required_preferred():
    """Union of required + preferred skill keywords, dedup, first-seen order."""
    out = extract_ats_keywords(VALID_ANALYSIS)
    # Every required/preferred keyword appears.
    for kw in ["Python", "FastAPI", "PostgreSQL", "AWS", "Kubernetes",
               "Terraform", "React", "TypeScript"]:
        assert kw in out
    # First required group comes before preferred group.
    assert out.index("Python") < out.index("React")
    # No duplicates.
    assert len(out) == len(set(out))


def test_extract_ats_keywords_falls_back_to_flat_list():
    """No skill groups → fall back to ats_keywords field."""
    parsed = {"title": "Eng", "ats_keywords": ["Go", "Rust"]}
    out = extract_ats_keywords(parsed)
    assert out == ["Go", "Rust"]


# ── Async DB tests ────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.jd_analyzer.LLMClient")
async def test_analyze_happy_path(mock_client_cls, session):
    """Valid LLM JSON → Job fields populated, status=parsed."""
    user = _seed_user(session)
    job = _seed_job(session, user, "Bukalapak is hiring a Senior Backend Engineer...")

    mock_client = mock_client_cls.return_value
    mock_client.set_db = lambda db: None
    mock_client.generate = AsyncMock(return_value=_mock_llm_result(VALID_ANALYSIS))

    result = await analyze_jd(job.id, session)

    job = session.get(Job, job.id)
    assert job.status == "parsed"
    assert job.error_message is None
    assert job.title == "Senior Backend Engineer"
    assert job.company == "Bukalapak"
    assert job.location == "Jakarta, Indonesia"
    assert job.remote is False  # hybrid != remote
    assert job.employment_type == "full_time"
    assert job.seniority == "senior"
    assert job.salary_min == 25000000
    assert job.salary_max == 40000000
    assert job.salary_currency == "IDR"

    # JSON columns populated.
    assert job.job_analysis_json["title"] == "Senior Backend Engineer"
    assert isinstance(job.ats_keywords_json.get("keywords"), list)
    assert len(job.ats_keywords_json["keywords"]) >= 8
    assert "Python" in job.ats_keywords_json["keywords"]

    # parsed_at set.
    assert job.parsed_at is not None

    # Return payload.
    assert result["job"].id == job.id
    assert result["confidence"] == 1.0
    assert len(result["ats_keywords"]) >= 8


@pytest.mark.asyncio
@patch("app.services.jd_analyzer.LLMClient")
async def test_analyze_invalid_llm_output(mock_client_cls, session):
    """LLM returns garbage → job marked failed, no parse artifacts saved."""
    user = _seed_user(session)
    job = _seed_job(session, user, "Some JD text here")

    mock_client = mock_client_cls.return_value
    mock_client.set_db = lambda db: None
    mock_client.generate = AsyncMock(return_value=_mock_llm_result(None))

    with pytest.raises(RuntimeError, match="parseable JSON"):
        await analyze_jd(job.id, session)

    job = session.get(Job, job.id)
    assert job.status == "failed"
    assert "json" in (job.error_message or "").lower()
    # Nothing was populated.
    assert job.title is None
    assert job.company is None
    assert job.salary_min is None


@pytest.mark.asyncio
@patch("app.services.jd_analyzer.LLMClient")
async def test_analyze_empty_description(mock_client_cls, session):
    """Empty raw_description → marked failed without ever calling the LLM."""
    user = _seed_user(session)
    job = _seed_job(session, user, "")  # blank

    mock_client = mock_client_cls.return_value
    mock_client.set_db = lambda db: None
    mock_client.generate = AsyncMock(side_effect=AssertionError("must not be called"))

    with pytest.raises(RuntimeError, match="empty"):
        await analyze_jd(job.id, session)

    job = session.get(Job, job.id)
    assert job.status == "failed"
    assert "empty" in (job.error_message or "").lower()
    mock_client.generate.assert_not_called()


@pytest.mark.asyncio
@patch("app.services.jd_analyzer.LLMClient")
async def test_analyze_confidence_scoring(mock_client_cls, session):
    """Sparse analysis (only title + a couple sections) → low confidence_score."""
    user = _seed_user(session)
    job = _seed_job(session, user, "Sparse JD")

    sparse = {
        "title": "Backend Engineer",
        "company": "Acme",
        "ats_keywords": ["Python", "PostgreSQL"],
    }
    mock_client = mock_client_cls.return_value
    mock_client.set_db = lambda db: None
    mock_client.generate = AsyncMock(return_value=_mock_llm_result(sparse))

    result = await analyze_jd(job.id, session)

    job = session.get(Job, job.id)
    assert job.status == "parsed"
    # 3 sections present (title, company, ats_keywords) out of 14.
    assert job.job_analysis_json["confidence_score"] < 0.5
    assert result["confidence"] < 0.5
    # ATS keywords still came through.
    assert "Python" in job.ats_keywords_json["keywords"]
    assert "PostgreSQL" in job.ats_keywords_json["keywords"]


# ── Remote-type handling (bonus coverage) ────────────────────────────


@pytest.mark.asyncio
@patch("app.services.jd_analyzer.LLMClient")
async def test_analyze_remote_type_sets_remote_true(mock_client_cls, session):
    """remote_type='remote' → Job.remote=True."""
    user = _seed_user(session)
    job = _seed_job(session, user, "Remote job")

    parsed = {
        "title": "Remote Engineer",
        "company": "RemoteCo",
        "remote_type": "remote",
    }
    mock_client = mock_client_cls.return_value
    mock_client.set_db = lambda db: None
    mock_client.generate = AsyncMock(return_value=_mock_llm_result(parsed))

    await analyze_jd(job.id, session)

    job = session.get(Job, job.id)
    assert job.remote is True