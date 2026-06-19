"""Tests for the resume parser service.

We mock ``LLMClient.generate`` so these tests are deterministic, fast,
and offline. The real-LLM coverage is in BE-6's end-to-end test.

Each test sets up a fresh DB session, seeds a default User + a
ResumeUpload in ``status='parsing'`` with some extracted text, then
calls ``parse_resume(upload_id, db)`` and asserts on the persisted rows.
"""
from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import docx
import pytest
from reportlab.pdfgen import canvas

from app.core.config import get_settings
from app.llm.base import LLMResult, LLMUsage
from app.llm.prompts.loader import load_prompt
from app.models.models import Profile, ProfileVersion, ResumeUpload, User
from app.services.resume_parser import (
    compute_confidence,
    get_or_create_default_user,
    parse_resume,
)


SOURCE_PROMPT_PATH = (
    Path(__file__).resolve().parent.parent
    / "app"
    / "llm"
    / "prompts"
    / "parse_resume.md"
)


@pytest.fixture(scope="session", autouse=True)
def install_parse_resume_prompt():
    """Mirror the source-of-truth prompt into the loader's runtime dir.

    Same trick as ``test_prompts.py`` — the loader reads from
    ``settings.prompts_dir`` (a tmp dir under tests).
    """
    if not SOURCE_PROMPT_PATH.exists():
        pytest.fail(f"parse_resume.md source missing at {SOURCE_PROMPT_PATH}")
    settings = get_settings()
    target = settings.prompts_dir / "resume_parse" / "v1.md"
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


def _seed_upload(session, user: User, raw_text: str) -> ResumeUpload:
    upload = ResumeUpload(
        id=str(uuid.uuid4()),
        user_id=user.id,
        file_name="sample_resume.pdf",
        file_type="pdf",
        file_path="/tmp/fake.pdf",
        file_size=1024,
        extracted_text=raw_text,
        status="parsing",
    )
    session.add(upload)
    session.commit()
    session.refresh(upload)
    return upload


VALID_PARSED: dict[str, Any] = {
    "basics": {
        "name": "Jane Doe",
        "label": "Senior Engineer",
        "email": "jane@example.com",
        "phone": "+1-415-555-1234",
        "summary": "Five years building payments.",
        "location": {"city": "San Francisco", "country": "US"},
        "profiles": [
            {"network": "LinkedIn", "url": "https://linkedin.com/in/jane"},
            {"network": "GitHub", "url": "https://github.com/jane"},
        ],
    },
    "work": [
        {
            "name": "Acme Corp",
            "position": "Senior Engineer",
            "startDate": "2022-03",
            "endDate": None,
            "highlights": ["Idempotency layer", "Mentored 3 juniors"],
        }
    ],
    "education": [],
    "skills": [
        {"name": "Languages", "keywords": ["Python", "Go", "TypeScript"]},
        {"name": "Infra", "keywords": ["AWS", "Kubernetes"]},
    ],
    "projects": [],
    "certificates": [],
    "languages": [
        {"language": "English", "fluency": "Native"},
    ],
}


def _mock_llm_result(parsed: dict[str, Any] | None) -> LLMResult:
    """Build an LLMResult that looks like the LLM returned ``parsed`` as JSON."""
    import json as _json

    text = _json.dumps(parsed) if parsed is not None else "not json at all"
    return LLMResult(
        text=text,
        model="MiniMax-M3",
        provider="tokenrouter",
        usage=LLMUsage(input_tokens=100, output_tokens=200, cost_usd=0.0001),
        latency_ms=123,
    )


# ── Pure-function test: compute_confidence ────────────────────────────


def test_compute_confidence_basics_only():
    """A profile that only has basics.email scores 1/7 ≈ 0.1429.

    Helper for the main test_parse_confidence_scoring below — confirms
    the scoring helper itself before we lean on it.
    """
    parsed = {"basics": {"email": "a@b.com"}}
    score = compute_confidence(parsed)
    assert score < 0.5
    assert score > 0.0
    assert round(score, 4) == round(1 / 7, 4)


# ── Async DB tests ─────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.services.resume_parser.LLMClient")
async def test_parse_happy_path(mock_client_cls, session):
    """Valid LLM JSON → Profile + ProfileVersion + Upload status=parsed."""
    user = _seed_user(session)
    upload = _seed_upload(session, user, "Jane Doe resume text")

    mock_client = mock_client_cls.return_value
    mock_client.set_db = lambda db: None
    mock_client.generate = AsyncMock(return_value=_mock_llm_result(VALID_PARSED))

    result = await parse_resume(upload.id, session)

    # Upload row was finalized.
    upload = session.get(ResumeUpload, upload.id)
    assert upload.status == "parsed"
    assert upload.error_message is None
    assert upload.confidence_score > 0.0
    assert upload.parsed_json["basics"]["email"] == "jane@example.com"

    # Profile was created and populated.
    profiles = session.query(Profile).all()
    assert len(profiles) == 1
    profile = profiles[0]
    assert profile.email == "jane@example.com"
    assert profile.name == "Jane Doe"
    assert profile.title == "Senior Engineer"
    assert profile.location == "San Francisco, US"
    assert profile.linkedin == "https://linkedin.com/in/jane"
    assert profile.github == "https://github.com/jane"
    assert profile.base_profile_json["basics"]["email"] == "jane@example.com"

    # A version row was appended.
    versions = session.query(ProfileVersion).filter_by(profile_id=profile.id).all()
    assert len(versions) == 1
    assert versions[0].version_number == 1
    assert "sample_resume.pdf" in versions[0].change_summary

    # Return payload.
    assert result["profile"].id == profile.id
    assert result["upload"].id == upload.id
    assert result["version"].version_number == 1


@pytest.mark.asyncio
@patch("app.services.resume_parser.LLMClient")
async def test_parse_invalid_llm_output(mock_client_cls, session):
    """LLM returns garbage → upload marked failed, no Profile created."""
    user = _seed_user(session)
    upload = _seed_upload(session, user, "Some text")

    mock_client = mock_client_cls.return_value
    mock_client.set_db = lambda db: None
    mock_client.generate = AsyncMock(return_value=_mock_llm_result(None))

    with pytest.raises(RuntimeError, match="parseable JSON"):
        await parse_resume(upload.id, session)

    upload = session.get(ResumeUpload, upload.id)
    assert upload.status == "failed"
    assert "json" in (upload.error_message or "").lower()
    # No Profile was created.
    assert session.query(Profile).count() == 0
    assert session.query(ProfileVersion).count() == 0


@pytest.mark.asyncio
@patch("app.services.resume_parser.LLMClient")
async def test_parse_empty_text(mock_client_cls, session):
    """empty_text upload → marked failed without ever calling the LLM."""
    user = _seed_user(session)
    upload = _seed_upload(session, user, "")  # blank extracted text

    mock_client = mock_client_cls.return_value
    mock_client.set_db = lambda db: None
    mock_client.generate = AsyncMock(side_effect=AssertionError("must not be called"))

    with pytest.raises(RuntimeError, match="empty"):
        await parse_resume(upload.id, session)

    upload = session.get(ResumeUpload, upload.id)
    assert upload.status == "failed"
    assert "empty" in (upload.error_message or "").lower()
    mock_client.generate.assert_not_called()
    assert session.query(Profile).count() == 0


@pytest.mark.asyncio
@patch("app.services.resume_parser.LLMClient")
async def test_parse_confidence_scoring(mock_client_cls, session):
    """Sparse profile (basics only) → low confidence_score."""
    user = _seed_user(session)
    upload = _seed_upload(session, user, "Sparse resume")

    sparse = {
        "basics": {"email": "only@email.com", "name": "Sparse"},
        "work": [],
        "education": [],
        "skills": [],
        "projects": [],
        "certificates": [],
        "languages": [],
    }
    mock_client = mock_client_cls.return_value
    mock_client.set_db = lambda db: None
    mock_client.generate = AsyncMock(return_value=_mock_llm_result(sparse))

    await parse_resume(upload.id, session)

    upload = session.get(ResumeUpload, upload.id)
    profile = session.query(Profile).first()

    # confidence should be 1/7 (~0.14), well below 0.5 — UI will flag this.
    assert upload.status == "parsed"
    assert upload.confidence_score < 0.5
    assert profile.confidence_score < 0.5
    # The basics flat fields still get populated (the LLM found them).
    assert profile.email == "only@email.com"
    assert profile.name == "Sparse"