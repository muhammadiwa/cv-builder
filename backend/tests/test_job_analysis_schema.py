"""Tests for the JobAnalysis Pydantic schema (JSON Resume JD v1.0.0).

These tests verify:
- Minimal valid input (only title) parses cleanly.
- Full valid input populates every field.
- Invalid enum values are rejected at the field level.
"""
from __future__ import annotations

from datetime import datetime

import pytest
from pydantic import ValidationError

from app.schemas.schemas import (
    JobAnalysisIn,
    JobAnalysisOut,
    SalaryRange,
    SkillGroup,
)


# ── Minimal valid input ──────────────────────────────────────────


def test_minimal_valid():
    """Only ``title`` is required; everything else defaults cleanly.

    This matches the lenient behavior we promise the LLM — it never
    has to invent data, it just returns what it found.
    """
    obj = JobAnalysisIn.model_validate({"title": "Senior Backend Engineer"})
    assert obj.title == "Senior Backend Engineer"
    assert obj.company is None
    assert obj.location is None
    assert obj.remote_type is None
    assert obj.employment_type is None
    assert obj.seniority is None
    assert obj.salary is None
    assert obj.summary is None
    assert obj.responsibilities == []
    assert obj.required_skills == []
    assert obj.preferred_skills == []
    assert obj.required_experience_years is None
    assert obj.required_education is None
    assert obj.ats_keywords == []


def test_minimal_missing_title_rejected():
    """No ``title`` → ValidationError. Title is the one required field."""
    with pytest.raises(ValidationError) as exc:
        JobAnalysisIn.model_validate({"company": "Acme"})
    assert "title" in str(exc.value).lower()


# ── Full valid input ─────────────────────────────────────────────


def test_full_valid():
    """A rich, complete analysis populates every field correctly."""
    payload = {
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
    obj = JobAnalysisIn.model_validate(payload)

    assert obj.title == "Senior Backend Engineer"
    assert obj.company == "Bukalapak"
    assert obj.location == "Jakarta, Indonesia"
    assert obj.remote_type == "hybrid"
    assert obj.employment_type == "full_time"
    assert obj.seniority == "senior"
    assert obj.salary == SalaryRange(min=25000000, max=40000000, currency="IDR")
    assert obj.summary and "10M+" in obj.summary
    assert len(obj.responsibilities) == 2
    assert len(obj.required_skills) == 2
    assert obj.required_skills[0].name == "Backend"
    assert obj.required_skills[0].keywords == ["Python", "FastAPI", "PostgreSQL"]
    assert len(obj.preferred_skills) == 1
    assert obj.preferred_skills[0].name == "Frontend"
    assert obj.required_experience_years == 5
    assert obj.required_education and "Computer Science" in obj.required_education
    assert len(obj.ats_keywords) == 11

    # Out variant adds metadata fields.
    out = JobAnalysisOut.model_validate({
        **obj.model_dump(),
        "id": "ja-1",
        "job_id": "job-1",
        "confidence_score": 0.85,
        "parsed_at": datetime(2026, 6, 19, 12, 0, 0),
    })
    assert out.id == "ja-1"
    assert out.job_id == "job-1"
    assert out.confidence_score == 0.85
    assert out.parsed_at == datetime(2026, 6, 19, 12, 0, 0)


# ── Enum validation ──────────────────────────────────────────────


def test_rejects_invalid_remote_type():
    """Bad remote_type (e.g. "wfh") → ValidationError on that field."""
    with pytest.raises(ValidationError) as exc:
        JobAnalysisIn.model_validate({
            "title": "Engineer",
            "remote_type": "wfh",
        })
    assert "remote_type" in str(exc.value).lower()


def test_rejects_invalid_seniority():
    """Bad seniority (e.g. "guru") → ValidationError on that field."""
    with pytest.raises(ValidationError) as exc:
        JobAnalysisIn.model_validate({
            "title": "Engineer",
            "seniority": "guru",
        })
    assert "seniority" in str(exc.value).lower()


# ── Bonus: SkillGroup + SalaryRange sub-model round-trip ────────


def test_skill_group_handles_missing_name():
    """SkillGroup without a name still validates (just becomes None)."""
    sg = SkillGroup.model_validate({"keywords": ["Python", "Go"]})
    assert sg.name is None
    assert sg.keywords == ["Python", "Go"]


def test_salary_range_partial():
    """SalaryRange with only min and currency is allowed."""
    sr = SalaryRange.model_validate({"min": 10000000, "currency": "IDR"})
    assert sr.min == 10000000
    assert sr.max is None
    assert sr.currency == "IDR"


def test_employment_type_enum_validates():
    """Spot-check the employment_type enum boundary."""
    # Valid
    obj = JobAnalysisIn.model_validate({"title": "Eng", "employment_type": "contract"})
    assert obj.employment_type == "contract"
    # Invalid
    with pytest.raises(ValidationError):
        JobAnalysisIn.model_validate({"title": "Eng", "employment_type": "freelance"})