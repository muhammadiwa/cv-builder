"""Tests for the BaseProfile (JSON Resume v1.0.0) Pydantic schema.

These exercise the LLM output contract — every section is optional, but
``basics.email`` must be present and valid when ``basics`` is provided.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import (
    BASE_PROFILE_SECTIONS,
    BaseProfileSchema,
)


def test_minimal_profile_valid():
    """The smallest acceptable profile: just basics with a valid email.

    This is the realistic floor — many resumes only have contact info
    + work history, and the LLM may still fail to pull structured work
    rows out of an OCR-ish PDF. The schema must still validate.
    """
    p = BaseProfileSchema(
        basics={"name": "Jane Doe", "email": "jane@example.com"}
    )
    assert p.basics is not None
    assert p.basics.email == "jane@example.com"
    assert p.basics.name == "Jane Doe"
    # Defaults
    assert p.work == []
    assert p.education == []
    assert p.skills == []
    assert p.projects == []
    assert p.certificates == []
    assert p.languages == []
    # Extra fields on input are tolerated (extra="allow" everywhere).
    assert p.basics.model_extra == {}


def test_full_profile_valid():
    """A fully-populated profile with all major sections."""
    raw = {
        "basics": {
            "name": "Mohammad Pratama",
            "label": "Senior Backend Engineer",
            "email": "mohammad@example.com",
            "phone": "+62-812-1234-5678",
            "location": {"city": "Jakarta", "country": "ID"},
            "profiles": [
                {"network": "LinkedIn", "url": "https://linkedin.com/in/mohammad"},
                {"network": "GitHub", "url": "https://github.com/mohammad"},
            ],
            "summary": "Six years building distributed systems.",
        },
        "work": [
            {
                "name": "Bukalapak",
                "position": "Senior Backend Engineer",
                "location": "Jakarta",
                "startDate": "2021-03",
                "endDate": None,
                "highlights": [
                    "Migrated monolith to microservices",
                    "Led team of 4 engineers",
                ],
            }
        ],
        "education": [
            {
                "institution": "Institut Teknologi Bandung",
                "area": "Computer Science",
                "studyType": "Bachelor",
                "startDate": "2015-08",
                "endDate": "2019-07",
                "score": "3.7",
            }
        ],
        "skills": [
            {"name": "Backend", "level": "Expert",
             "keywords": ["Python", "FastAPI", "PostgreSQL"]},
            {"name": "Cloud", "level": "Advanced",
             "keywords": ["AWS", "Docker", "Kubernetes"]},
        ],
        "projects": [
            {
                "name": "Realtime analytics pipeline",
                "description": "Kafka + ClickHouse pipeline",
                "highlights": ["Built with Python, deployed on K8s"],
                "url": None,
            }
        ],
        "certificates": [],
        "languages": [
            {"language": "Indonesian", "fluency": "Native"},
            {"language": "English", "fluency": "Professional"},
        ],
    }
    p = BaseProfileSchema.model_validate(raw)
    assert p.basics is not None and p.basics.email == "mohammad@example.com"
    assert len(p.work) == 1
    assert p.work[0].name == "Bukalapak"
    assert p.work[0].endDate is None  # current job
    assert p.work[0].highlights == [
        "Migrated monolith to microservices",
        "Led team of 4 engineers",
    ]
    assert len(p.education) == 1
    assert p.education[0].institution == "Institut Teknologi Bandung"
    assert len(p.skills) == 2
    assert "Python" in p.skills[0].keywords
    assert len(p.languages) == 2
    # Defaults for omitted sections
    assert p.awards == []
    assert p.volunteer == []
    assert p.publications == []


def test_empty_profile_valid():
    """No fields at all → still validates (LLM may output {} on bad input)."""
    p = BaseProfileSchema.model_validate({})
    assert p.basics is None
    assert p.work == []
    assert p.education == []
    assert p.skills == []
    assert p.projects == []
    assert p.certificates == []
    assert p.languages == []
    # The constant tells the parser how many sections "count" for confidence.
    assert len(BASE_PROFILE_SECTIONS) >= 7


def test_invalid_email_rejected():
    """Malformed email in basics triggers a Pydantic ValidationError."""
    with pytest.raises(ValidationError) as exc:
        BaseProfileSchema.model_validate(
            {"basics": {"name": "Jane", "email": "not-an-email"}}
        )
    # Pydantic surfaces the offending field path in the error.
    assert "email" in str(exc.value).lower()


def test_basics_without_email_rejected():
    """If basics is present but has no email, the model_validator fires."""
    with pytest.raises(ValidationError) as exc:
        BaseProfileSchema.model_validate(
            {"basics": {"name": "Jane Doe"}}  # no email
        )
    assert "email" in str(exc.value).lower()


def test_extras_allowed_at_every_level():
    """The schema uses extra='allow' — LLM fields we don't model yet survive.

    This matters because the JSON Resume spec is richer than what we
    model here (e.g. basics.location.address), and we don't want to
    reject perfectly good output from the LLM.
    """
    raw = {
        "basics": {
            "name": "Jane",
            "email": "jane@example.com",
            "location": {"city": "Jakarta", "timezone": "Asia/Jakarta"},
        },
        "work": [
            {"name": "Acme", "position": "Eng", "remote": True}
        ],
    }
    p = BaseProfileSchema.model_validate(raw)
    assert p.basics is not None
    assert p.basics.location is not None
    assert p.basics.location.model_extra.get("timezone") == "Asia/Jakarta"
    assert p.work[0].model_extra.get("remote") is True


def test_section_constants_used_for_confidence():
    """The section constant includes the canonical 7 expected sections."""
    assert set(BASE_PROFILE_SECTIONS) >= {
        "basics", "work", "education", "skills",
        "projects", "certificates", "languages",
    }
