"""Tests for cover_letter_generator service.

Covers:
- Deterministic template: 5 tones, content sanity, facts only from input
- LLM enhancement: stub the LLM client to avoid network calls
- Scorer: 4-axis scoring with edge cases (no keywords, short text, etc)
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.cover_letter_generator import (
    VALID_TONES,
    enhance_cover_letter,
    generate_cover_letter_deterministic,
    score_cover_letter,
)


SAMPLE_PROFILE = {
    "basics": {
        "name": "Mohammad Pratama",
        "email": "m@example.com",
        "phone": "+62",
        "location": "Jakarta",
    },
    "summary": "Backend engineer with 6 years",
    "work": [
        {
            "company": "Bukalapak",
            "title": "Senior Engineer",
            "start": "2021-03",
            "end": "present",
            "highlights": [
                "Migrated monolith to microservices, reducing p95 latency by 40%"
            ],
        },
    ],
    "skills": [
        {"name": "Python"},
        {"name": "FastAPI"},
        {"name": "PostgreSQL"},
        {"name": "Kubernetes"},
    ],
}

SAMPLE_JOB = {
    "title": "Senior Python Developer",
    "company": "Acme Corp",
    "job_analysis_json": {
        "required_skills": [
            {"name": "Python"},
            {"name": "FastAPI"},
            {"name": "PostgreSQL"},
        ]
    },
}


# ── Deterministic template ──────────────────────────────────────────


class TestDeterministic:
    def test_all_five_tones_produce_valid_letter(self):
        for tone in VALID_TONES:
            draft = generate_cover_letter_deterministic(
                SAMPLE_PROFILE, SAMPLE_JOB, tone=tone
            )
            assert draft.tone == tone
            assert draft.source == "deterministic"
            assert draft.subject.startswith("Application for")
            assert len(draft.body) > 200, f"{tone} letter too short"
            # No hallucinated facts — should reference Acme + Senior Python
            assert "Acme Corp" in draft.body
            assert "Senior Python Developer" in draft.body

    def test_tone_greetings_differ(self):
        greetings = {
            tone: generate_cover_letter_deterministic(
                SAMPLE_PROFILE, SAMPLE_JOB, tone=tone
            ).body[:80]
            for tone in VALID_TONES
        }
        # Friendly and Formal must produce different greetings
        assert "Hi team" in greetings["friendly"]
        assert "Dear Sir or Madam" in greetings["formal"]
        # Professional / confident / concise share the same greeting
        assert "Dear Hiring Team" in greetings["professional"]

    def test_unknown_tone_falls_back_to_professional(self):
        draft = generate_cover_letter_deterministic(
            SAMPLE_PROFILE, SAMPLE_JOB, tone="bogus"
        )
        assert draft.tone == "professional"

    def test_references_real_highlight_from_profile(self):
        draft = generate_cover_letter_deterministic(
            SAMPLE_PROFILE, SAMPLE_JOB, tone="professional"
        )
        # Highlight must be cited (or referenced via personalization_points)
        assert any(
            "monolith" in p.lower() or "microservices" in p.lower()
            for p in draft.personalization_points
        )

    def test_top_skill_matches_job_required(self):
        draft = generate_cover_letter_deterministic(
            SAMPLE_PROFILE, SAMPLE_JOB, tone="professional"
        )
        # Python is in both profile and required_skills
        assert "Python" in draft.job_keywords_used

    def test_handles_dict_shaped_required_skills(self):
        # LLM sometimes returns dicts {"name": ...}; service must
        # normalize them.
        job = {
            "title": "Senior Python Developer",
            "company": "Acme Corp",
            "job_analysis_json": {
                "required_skills": [
                    {"name": "Python"},
                    {"name": "FastAPI"},
                ]
            },
        }
        draft = generate_cover_letter_deterministic(SAMPLE_PROFILE, job)
        assert "Python" in draft.body or "FastAPI" in draft.body

    def test_handles_string_required_skills(self):
        # Deterministic analyzer returns plain strings
        job = {
            "title": "Senior Python Developer",
            "company": "Acme Corp",
            "job_analysis_json": {"required_skills": ["Python", "FastAPI"]},
        }
        draft = generate_cover_letter_deterministic(SAMPLE_PROFILE, job)
        assert "Python" in draft.job_keywords_used

    def test_handles_missing_skills_gracefully(self):
        empty_profile = {
            "basics": {"name": "Test User", "email": "", "phone": "", "location": ""},
            "summary": "",
            "work": [],
            "skills": [],
        }
        draft = generate_cover_letter_deterministic(
            empty_profile, SAMPLE_JOB, tone="professional"
        )
        # Should still produce a coherent letter (using fallback text)
        assert "Dear Hiring Team" in draft.body
        assert "Test User" in draft.body

    def test_falls_back_to_ats_keywords(self):
        # No job_analysis, only ats_keywords
        job = {
            "title": "Senior Python Developer",
            "company": "Acme",
            "ats_keywords": ["Python", "FastAPI"],
        }
        draft = generate_cover_letter_deterministic(SAMPLE_PROFILE, job)
        assert "Python" in draft.job_keywords_used


# ── LLM enhancement ─────────────────────────────────────────────────


class TestLLMEnhancement:
    @pytest.mark.asyncio
    async def test_successful_enhancement_marks_source(self):
        """LLM returns valid JSON → draft.source = 'llm_enhanced'."""
        mock_client = MagicMock()
        mock_client.generate = AsyncMock(
            return_value=MagicMock(
                text='{"subject": "Enhanced subject line", "body": "Dear Hiring Team,\\n\\nThis is a realistic-length enhanced cover letter body with enough content to pass the >=50 char threshold for LLM acceptance.\\n\\nBest regards,\\nTest", "personalization_points": ["x"], "job_keywords_used": ["Python"]}'
            )
        )
        draft = generate_cover_letter_deterministic(
            SAMPLE_PROFILE, SAMPLE_JOB, tone="professional"
        )
        enhanced = await enhance_cover_letter(
            draft, SAMPLE_PROFILE, SAMPLE_JOB, llm_client=mock_client
        )
        assert enhanced.source == "llm_enhanced"
        assert enhanced.subject == "Enhanced subject line"
        assert "realistic-length enhanced" in enhanced.body
        assert "Python" in enhanced.job_keywords_used

    @pytest.mark.asyncio
    async def test_thinking_block_stripped_before_parse(self):
        """Provider emits <think>...</think> then JSON → parsed correctly."""
        mock_client = MagicMock()
        mock_client.generate = AsyncMock(
            return_value=MagicMock(
                text="<think>Let me reason about this carefully and consider all factors before producing output...</think>\n{\"subject\": \"Stripped\", \"body\": \"Dear Hiring Team,\\n\\nAfter thinking, here is my enhanced body with enough chars to clear the threshold.\\n\\nBest regards,\\nTest\", \"personalization_points\": [], \"job_keywords_used\": []}"
            )
        )
        draft = generate_cover_letter_deterministic(
            SAMPLE_PROFILE, SAMPLE_JOB, tone="professional"
        )
        enhanced = await enhance_cover_letter(
            draft, SAMPLE_PROFILE, SAMPLE_JOB, llm_client=mock_client
        )
        assert enhanced.source == "llm_enhanced"
        assert enhanced.subject == "Stripped"

    @pytest.mark.asyncio
    async def test_llm_failure_falls_back_to_deterministic(self):
        mock_client = MagicMock()
        mock_client.generate = AsyncMock(side_effect=RuntimeError("network down"))
        draft = generate_cover_letter_deterministic(
            SAMPLE_PROFILE, SAMPLE_JOB, tone="professional"
        )
        enhanced = await enhance_cover_letter(
            draft, SAMPLE_PROFILE, SAMPLE_JOB, llm_client=mock_client
        )
        assert enhanced.source == "deterministic"
        assert enhanced.subject == draft.subject  # unchanged

    @pytest.mark.asyncio
    async def test_llm_bad_json_falls_back(self):
        mock_client = MagicMock()
        mock_client.generate = AsyncMock(
            return_value=MagicMock(text="not json at all")
        )
        draft = generate_cover_letter_deterministic(
            SAMPLE_PROFILE, SAMPLE_JOB, tone="professional"
        )
        enhanced = await enhance_cover_letter(
            draft, SAMPLE_PROFILE, SAMPLE_JOB, llm_client=mock_client
        )
        assert enhanced.source == "deterministic"

    @pytest.mark.asyncio
    async def test_llm_body_too_short_falls_back(self):
        mock_client = MagicMock()
        mock_client.generate = AsyncMock(
            return_value=MagicMock(
                text='{"subject": "S", "body": "short", "personalization_points": [], "job_keywords_used": []}'
            )
        )
        draft = generate_cover_letter_deterministic(
            SAMPLE_PROFILE, SAMPLE_JOB, tone="professional"
        )
        enhanced = await enhance_cover_letter(
            draft, SAMPLE_PROFILE, SAMPLE_JOB, llm_client=mock_client
        )
        assert enhanced.source == "deterministic"


# ── Scorer ──────────────────────────────────────────────────────────


class TestScorer:
    def test_full_match_scores_high(self):
        body = (
            "Dear Hiring Team,\n\n"
            "I bring deep Python and FastAPI and PostgreSQL expertise. "
            "Built scalable Python services using FastAPI and PostgreSQL. "
            "Strong on Python, FastAPI, and PostgreSQL.\n\n"
            "Best regards,\nTest"
        )
        score = score_cover_letter(body, ["Python", "FastAPI", "PostgreSQL"])
        assert score.overall > 0.7, f"expected >0.7, got {score.overall}"
        assert score.axes["keyword_coverage"]["score"] == 1.0
        assert score.axes["structure"]["score"] == 1.0

    def test_no_match_scores_low(self):
        body = "Dear Hiring Team,\n\nI am a Rust developer with deep Go experience.\n\nBest regards,\nTest"
        score = score_cover_letter(body, ["Python", "FastAPI", "PostgreSQL"])
        assert score.axes["keyword_coverage"]["score"] == 0.0
        assert score.axes["keyword_coverage"]["missing"] == ["Python", "FastAPI", "PostgreSQL"]

    def test_no_keywords_neutral_zero(self):
        score = score_cover_letter("any text", [])
        # Phase 7 B7/B8 honest-no-data rule: unmeasurable → 0.0
        assert score.axes["keyword_coverage"]["score"] == 0.0

    def test_structure_requires_greeting_and_signoff(self):
        body_no_greeting = "I am a developer.\n\nBest regards,\nTest"
        score = score_cover_letter(body_no_greeting, [])
        assert score.axes["structure"]["score"] < 1.0

        body_no_signoff = "Dear Hiring Team,\n\nI am a developer."
        score = score_cover_letter(body_no_signoff, [])
        assert score.axes["structure"]["score"] < 1.0

    def test_length_ideal_range(self):
        # 250-400 words → 1.0
        body_ideal = "Dear Hiring Team,\n\n" + ("word " * 300) + "\n\nBest regards,\nTest"
        score = score_cover_letter(body_ideal, [])
        assert score.axes["length"]["score"] == 1.0

    def test_length_too_short_penalized(self):
        body_short = "Dear Hiring Team,\n\nShort.\n\nBest regards,\nTest"
        score = score_cover_letter(body_short, [])
        assert score.axes["length"]["score"] < 0.5

    def test_length_too_long_penalized(self):
        body_long = "Dear Hiring Team,\n\n" + ("word " * 800) + "\n\nBest regards,\nTest"
        score = score_cover_letter(body_long, [])
        assert score.axes["length"]["score"] < 0.5

    def test_overall_bounded_0_to_1(self):
        body = "Dear Hiring Team,\n\nTest.\n\nBest regards,\nTest"
        score = score_cover_letter(body, ["Python"])
        assert 0.0 <= score.overall <= 1.0

    def test_handles_dict_shaped_keywords(self):
        body = "I use Python and FastAPI daily."
        score = score_cover_letter(body, [{"name": "Python"}, {"name": "FastAPI"}])
        assert score.axes["keyword_coverage"]["matched"] == ["Python", "FastAPI"]

    def test_recommendations_include_missing_keywords(self):
        body = "Dear Hiring Team,\n\nBrief mention of Python.\n\nBest regards,\nTest"
        score = score_cover_letter(body, ["Python", "Django", "PostgreSQL"])
        rec_ids = {r["id"] for r in score.breakdown["recommendations"]}
        assert "add_keywords" in rec_ids

    def test_to_breakdown_round_trip(self):
        body = "Dear Hiring Team,\n\nTest body.\n\nBest regards,\nTest"
        score = score_cover_letter(body, ["Python"])
        breakdown = score.to_breakdown()
        assert "overall" in breakdown
        assert "axes" in breakdown
        assert breakdown["overall"] == score.overall