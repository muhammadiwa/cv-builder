"""Unit tests for the CV template engine.

Pure tests — no DB, no LLM, no network. Just confirm:
- Profile → deterministic CV doc
- HTML escapes unsafe characters
- Markdown fallback produces something copy-paste-able
- ``build_cv_doc_from_json`` handles the simplified CV schema
- Edge cases: empty profile, missing fields, weird dates
"""

from __future__ import annotations

import pytest

from app.services.cv_renderer import (
    SECTION_EXPERIENCE,
    SECTION_SKILLS,
    SECTION_SUMMARY,
    _format_date_range,
    _strip_text,
    build_cv_doc_from_json,
    default_template_config,
    render_cv,
    render_html_document,
)


# ── Helpers ────────────────────────────────────────────────────────
def test_format_date_range_year_only():
    assert _format_date_range("2021", "") == "2021"


def test_format_date_range_year_month():
    assert _format_date_range("2021-03", "") == "Mar 2021"


def test_format_date_range_full_iso():
    assert _format_date_range("2021-03-15", "2022-01-10") == "Mar 2021 – Jan 2022"


def test_format_date_range_present_when_end_none():
    # JSON Resume convention: endDate == None means current job
    assert _format_date_range("2019-06", None) == "Jun 2019 – Present"


def test_format_date_range_empty():
    assert _format_date_range("", "") == ""


def test_format_date_range_garbage():
    # Unknown format passes through unchanged (no crash)
    assert _format_date_range("sometime", "") == "sometime"


def test_strip_text_collapses_whitespace():
    assert _strip_text("  hello\n\n  world  ") == "hello world"


def test_strip_text_none():
    assert _strip_text(None) == ""


# ── Profile → CV doc ───────────────────────────────────────────────
def test_render_cv_basic():
    profile = {
        "basics": {
            "name": "Jane Doe",
            "label": "Backend Engineer",
            "email": "jane@example.com",
            "phone": "+1-555-0100",
            "location": {"city": "SF", "country": "USA"},
        },
        "summary": "Six years building APIs.",
        "work": [
            {
                "name": "Acme",
                "position": "Backend Engineer",
                "location": "Remote",
                "startDate": "2020-01",
                "endDate": None,
                "highlights": ["Shipped payments service"],
            }
        ],
        "education": [
            {
                "institution": "MIT",
                "studyType": "Bachelor",
                "area": "CS",
                "startDate": "2014-09",
                "endDate": "2018-06",
            }
        ],
        "skills": [
            {"name": "Backend", "keywords": ["Python", "PostgreSQL"]},
        ],
    }
    doc = render_cv(profile)
    html = doc.to_html()
    md = doc.to_markdown()

    assert "Jane Doe" in html
    assert "Backend Engineer" in html
    assert "<h2" in html  # section headings present
    assert "Shipped payments service" in html
    assert "<ul" in html  # bullets rendered
    # Markdown roundtrip
    assert "## Experience" in md
    assert "## Education" in md
    assert "## Skills" in md
    assert "Python" in md


def test_render_cv_empty_profile():
    doc = render_cv({})
    # Should not crash; sections just empty
    assert doc.to_html() == doc.header_html


def test_render_cv_html_escapes_unsafe():
    profile = {
        "basics": {"name": "<script>alert('x')</script>"},
        "work": [
            {"name": "A&B Co.", "position": "Eng", "highlights": ["<bad>"]},
        ],
    }
    html = render_html_document(profile)
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "A&amp;B Co." in html
    assert "&lt;bad&gt;" in html


def test_render_cv_excludes_empty_sections():
    profile = {
        "basics": {"name": "Test"},
        "work": [],  # no work
        "education": [],
        "skills": [{"name": "Python"}],  # only skills
    }
    html = render_cv(profile).to_html()
    # Experience and Education headings should NOT appear (since empty)
    assert "## Experience" not in html.replace("<h2 class=\"cv-section\">", "## ").replace("</h2>", "")
    assert "Skills" in html


def test_render_cv_skill_dedup_case_insensitive():
    profile = {
        "basics": {"name": "Test"},
        "skills": [
            {"name": "Backend", "keywords": ["Python", "python", "PYTHON"]},
            {"name": "Frontend", "keywords": ["React"]},
        ],
    }
    html = render_cv(profile).to_html()
    assert html.count("<li>Python</li>") == 1


def test_render_cv_present_job_shows_present():
    profile = {
        "basics": {"name": "Test"},
        "work": [
            {"name": "CurrentCo", "position": "Eng", "startDate": "2020-01", "endDate": None},
        ],
    }
    html = render_cv(profile).to_html()
    assert "Present" in html


def test_render_cv_skill_flat_string_list_supported():
    profile = {
        "basics": {"name": "Test"},
        "skills": ["Python", "Go"],  # not the dict-of-keywords shape
    }
    html = render_cv(profile).to_html()
    assert "Python" in html
    assert "Go" in html


# ── build_cv_doc_from_json (simplified CV schema) ──────────────────
def test_build_cv_doc_from_json_summary_only():
    cv_json = {
        "basics": {"name": "Alice"},
        "summary": "A summary line.",
    }
    doc = build_cv_doc_from_json(cv_json)
    html = doc.to_html()
    assert "Alice" in html
    assert "A summary line." in html
    assert "## Summary" in doc.to_markdown()


def test_build_cv_doc_from_json_full():
    cv_json = {
        "basics": {
            "name": "Bob",
            "title": "Dev",
            "email": "b@x.com",
            "phone": "+1",
        },
        "summary": "Eng.",
        "experience": [
            {
                "title": "Eng",
                "company": "Co",
                "start": "2020-01",
                "end": None,
                "bullets": ["Did stuff"],
            }
        ],
        "education": [
            {
                "institution": "Uni",
                "degree": "BS",
                "field": "CS",
                "start": "2016",
                "end": "2020",
            }
        ],
        "skills": ["Python"],
        "projects": [
            {"name": "Proj", "description": "Built it.", "tech": ["Python"]}
        ],
    }
    doc = build_cv_doc_from_json(cv_json)
    html = doc.to_html()
    assert "Bob" in html
    assert "## Summary" in html or "<h2 class=\"cv-section\">Summary" in html
    assert "Did stuff" in html
    assert "BS" in html
    assert "Python" in html
    assert "Proj" in html


def test_build_cv_doc_from_json_no_h2_for_missing_sections():
    cv_json = {
        "basics": {"name": "X"},
        # no summary, experience, etc.
    }
    doc = build_cv_doc_from_json(cv_json)
    # Only header; no section headings
    assert all(s.body_html == "" for s in doc.sections)


# ── Determinism ────────────────────────────────────────────────────
def test_render_cv_is_deterministic():
    profile = {
        "basics": {"name": "X"},
        "work": [{"name": "A", "position": "E", "highlights": ["a"]}],
        "skills": [{"name": "S", "keywords": ["k"]}],
    }
    a = render_html_document(profile)
    b = render_html_document(profile)
    assert a == b  # byte-identical


# ── Template config ────────────────────────────────────────────────
def test_default_template_config():
    cfg = default_template_config()
    assert cfg["id"] == "ats_classic"
    assert cfg["ats_friendly"] is True
    assert SECTION_SUMMARY in cfg["sections"]
    assert SECTION_EXPERIENCE in cfg["sections"]
    assert SECTION_SKILLS in cfg["sections"]


def test_render_cv_with_custom_section_order():
    profile = {
        "basics": {"name": "X"},
        "summary": "S",
        "work": [{"name": "A", "position": "E"}],
        "skills": [{"name": "S", "keywords": ["k"]}],
    }
    cfg = {"sections": [SECTION_SKILLS, SECTION_SUMMARY, SECTION_EXPERIENCE]}
    doc = render_cv(profile, cfg)
    # Skills should come first in the HTML
    html = doc.to_html()
    skills_pos = html.find("cv-skills")
    summary_pos = html.find("cv-summary")
    experience_pos = html.find("cv-job")
    assert skills_pos < summary_pos < experience_pos


def test_render_cv_invalid_section_config_falls_back():
    profile = {"basics": {"name": "X"}}
    cfg = {"sections": ["bogus_kind", "also_bogus"]}
    doc = render_cv(profile, cfg)
    # Should fall back to default and still produce a header
    assert doc.header_html


def test_render_cv_with_orm_profile_object(monkeypatch):
    """Verify render_cv accepts an ORM Profile (has base_profile_json)."""

    class FakeProfile:
        name = "ORM Name"
        title = "ORM Title"
        email = "o@x.com"
        phone = None
        location = None
        linkedin = None
        github = None
        portfolio = None
        summary = None
        base_profile_json = {
            "basics": {"email": "o@x.com", "name": "ORM Name"},
            "work": [],
            "skills": [{"name": "Backend", "keywords": ["Python"]}],
        }

    doc = render_cv(FakeProfile())
    html = doc.to_html()
    assert "ORM Name" in html
    assert "Python" in html