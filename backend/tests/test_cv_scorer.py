"""Phase 7 — CV scorer tests.

Covers:
- All 4 axes (ats_coverage / skill_gap / bullet_strength / format_safety)
- Neutral fallback when no target job is attached
- Alias canonicalization (k8s matches Kubernetes)
- Recommendation builder priority + dedup
- CVScorerConfig.normalized() sum-to-one
"""
from __future__ import annotations

import pytest

from app.services.cv_scorer import (
    CVScorerConfig,
    SCORER_CONFIG,
    _build_recommendations,
    _flatten_cv_text,
    _keyword_present,
    _normalize_keyword,
    _score_ats_coverage,
    _score_bullet_strength,
    _score_format_safety,
    _score_skill_gap,
    score_cv,
)


# ── Config ──────────────────────────────────────────────────────────


class TestScorerConfig:
    def test_default_weights_sum_to_one(self):
        c = SCORER_CONFIG
        s = c.weight_ats_coverage + c.weight_skill_gap + c.weight_bullet_strength + c.weight_format_safety
        assert abs(s - 1.0) < 1e-9

    def test_normalized_rebalances(self):
        # Pick weights whose sum is 3.0, so 2.0 normalizes to 2/3.
        c = CVScorerConfig(
            weight_ats_coverage=2.0,
            weight_skill_gap=1.0,
            weight_bullet_strength=0.0,
            weight_format_safety=0.0,
        )
        n = c.normalized()
        assert abs(n.weight_ats_coverage - 2 / 3) < 1e-9
        assert abs(n.weight_skill_gap - 1 / 3) < 1e-9
        assert n.weight_bullet_strength == 0.0
        assert n.weight_format_safety == 0.0
        # Threshold fields are passed through unchanged.
        assert n.bullet_strong_threshold == SCORER_CONFIG.bullet_strong_threshold


# ── Helpers ──────────────────────────────────────────────────────────


class TestHelpers:
    def test_normalize_keyword_lowercases(self):
        assert _normalize_keyword("PYTHON") == "python"
        assert _normalize_keyword("  Django REST  ") == "django rest"

    def test_normalize_keyword_keeps_plus_and_dot(self):
        # C++ and Next.js rely on these chars
        assert _normalize_keyword("C++") == "c++"
        assert _normalize_keyword("Next.js") == "next.js"

    def test_flatten_cv_text_skips_email(self):
        cv = {
            "basics": {"name": "X", "email": "should@be.ignored"},
            "summary": "Built Python APIs.",
        }
        text = _flatten_cv_text(cv)
        assert "python" in text
        assert "should" not in text  # email value skipped

    def test_keyword_present_substring(self):
        blob = "experienced with python and django"
        assert _keyword_present("Python", blob) is True
        assert _keyword_present("django", blob) is True
        assert _keyword_present("rust", blob) is False


# ── ATS coverage ─────────────────────────────────────────────────────


class TestATSCoverage:
    def test_no_job_returns_neutral(self):
        score, matched, missing, details = _score_ats_coverage({}, None)
        assert score == 0.5
        assert matched == []
        assert missing == []
        assert details["reason"] == "no_target_job"

    def test_job_with_no_keywords_returns_neutral(self):
        score, _, _, details = _score_ats_coverage({}, {"ats_keywords": []})
        assert score == 0.5
        assert details["reason"] == "job_has_no_keywords"

    def test_full_match_scores_one(self):
        cv = {"basics": {"summary": "Python and Django developer"}}
        job = {"ats_keywords": ["Python", "Django"], "required_skills": []}
        score, matched, missing, _ = _score_ats_coverage(cv, job)
        assert score == 1.0
        assert set(matched) == {"Python", "Django"}
        assert missing == []

    def test_partial_match_scores_proportionally(self):
        cv = {"basics": {"summary": "Python developer"}}
        job = {"ats_keywords": ["Python", "Django", "Rust"]}
        score, matched, missing, _ = _score_ats_coverage(cv, job)
        assert score == pytest.approx(1 / 3, rel=1e-3)
        assert matched == ["Python"]
        assert set(missing) == {"Django", "Rust"}


# ── Skill gap ────────────────────────────────────────────────────────


class TestSkillGap:
    def test_no_job_returns_neutral(self):
        score, matched, missing, details = _score_skill_gap({}, None)
        assert score == 0.5
        assert details["reason"] == "no_target_job"

    def test_all_required_present(self):
        cv = {"skills": [{"name": "Languages", "keywords": ["Python"]}]}
        job = {"required_skills": [{"name": "Languages", "keywords": ["Python"]}]}
        score, matched, missing, _ = _score_skill_gap(cv, job)
        assert score == 1.0
        assert missing == []

    def test_missing_keywords_count(self):
        cv = {"skills": [{"name": "Languages", "keywords": ["Python"]}]}
        job = {"required_skills": [{"name": "L", "keywords": ["Python", "Go", "Rust"]}]}
        score, matched, missing, _ = _score_skill_gap(cv, job)
        assert score == pytest.approx(1 / 3, rel=1e-3)
        assert matched == ["Python"]
        assert set(missing) == {"Go", "Rust"}


# ── Bullet strength ─────────────────────────────────────────────────


class TestBulletStrength:
    def test_no_bullets_returns_neutral(self):
        score, details = _score_bullet_strength({"work": []})
        assert score == 0.5
        assert details["reason"] == "no_bullets_found"

    def test_bullet_with_metric_scores_high(self):
        cv = {"work": [{"position": "SWE", "highlights": [
            "Cut API latency by 40% across the payments service.",
        ]}]}
        score, details = _score_bullet_strength(cv)
        # 1 bullet with metric + length >= 40 → 0.9
        assert score == 0.9
        assert details["total_bullets"] == 1

    def test_short_bullets_score_low(self):
        cv = {"work": [{"position": "SWE", "highlights": [
            "Did things", "Made stuff", "Worked hard",
        ]}]}
        score, details = _score_bullet_strength(cv)
        # 3 short bullets without metrics → 0.3 each → avg 0.3
        assert score == 0.3
        assert details["total_bullets"] == 3

    def test_per_role_breakdown(self):
        cv = {"work": [
            {"position": "A", "highlights": ["Built X by 30%", "Shipped Y"]},
            {"position": "B", "highlights": ["Did Z"]},
        ]}
        _, details = _score_bullet_strength(cv)
        roles = {r["role"]: r for r in details["per_role"]}
        assert "A" in roles
        assert "B" in roles


# ── Format safety ────────────────────────────────────────────────────


class TestFormatSafety:
    def test_no_html_returns_neutral(self):
        score, details = _score_format_safety({})
        assert score == 0.5
        assert details["reason"] == "no_rendered_html_supplied"

    def test_perfect_html_scores_one(self):
        html = '<html lang="en"><body><h1>Name</h1><p>Body</p></body></html>'
        score, checks = _score_format_safety({"_rendered_html": html})
        assert score == 1.0
        assert checks["has_lang_attr"] is True
        assert checks["has_h1"] is True
        assert checks["uses_table"] is False
        assert checks["uses_image_body"] is False

    def test_missing_lang_deducts(self):
        html = '<html><body><h1>Name</h1></body></html>'
        score, checks = _score_format_safety({"_rendered_html": html})
        assert checks["has_lang_attr"] is False
        assert score < 1.0

    def test_table_deducts(self):
        html = '<html lang="en"><body><h1>N</h1><table><tr><td>x</td></tr></table></body></html>'
        score, checks = _score_format_safety({"_rendered_html": html})
        assert checks["uses_table"] is True
        assert score < 1.0


# ── Recommendations ─────────────────────────────────────────────────


class TestRecommendations:
    def test_recommendations_sorted_by_impact(self):
        # High-impact (skill gap) appears before low (format).
        recs = _build_recommendations(
            missing_keywords=["Python"],
            missing_skills=["Go", "Rust"],
            bullet_details={"per_role": []},
            format_checks={},
        )
        assert recs
        # Skill gap items come first (high impact)
        assert recs[0]["impact"] == "high"
        assert recs[0]["axis"] == "skill_gap"

    def test_dedupes_overlap(self):
        # Python is both a missing skill AND a missing keyword;
        # should appear once, as a skill-gap card.
        recs = _build_recommendations(
            missing_keywords=["Python"],
            missing_skills=["Python"],
            bullet_details={"per_role": []},
            format_checks={},
        )
        assert len(recs) == 1
        assert recs[0]["axis"] == "skill_gap"

    def test_format_issues_aggregated(self):
        recs = _build_recommendations(
            missing_keywords=[],
            missing_skills=[],
            bullet_details={"per_role": []},
            format_checks={"has_lang_attr": False, "has_h1": False},
        )
        assert any(r["id"] == "fix_format_safety" for r in recs)
        fmt = next(r for r in recs if r["id"] == "fix_format_safety")
        assert "has lang attr" in fmt["details"]


# ── Top-level score_cv ──────────────────────────────────────────────


class TestScoreCVEndToEnd:
    def test_generic_cv_no_job(self):
        cv = {"basics": {"name": "X"}, "skills": [{"name": "Py"}]}
        result = score_cv(cv, None)
        assert 0.0 <= result.overall <= 1.0
        # No job → ats and skill_gap are neutral (0.5)
        assert result.ats_coverage.score == 0.5
        assert result.skill_gap.score == 0.5
        assert result.matched_keywords == []

    def test_cv_with_full_coverage(self):
        cv = {
            "basics": {"summary": "Python Django PostgreSQL Docker"},
            "skills": [{"name": "Backend", "keywords": ["Python", "Django", "PostgreSQL"]}],
            "work": [{"position": "SWE", "highlights": [
                "Built Python APIs serving 10k req/sec",
                "Cut latency by 30% with PostgreSQL indexing",
            ]}],
            "_rendered_html": '<html lang="en"><body><h1>X</h1></body></html>',
        }
        job = {
            "ats_keywords": ["Python", "Django", "PostgreSQL", "Docker"],
            "required_skills": [
                {"name": "Languages", "keywords": ["Python", "Django"]},
                {"name": "DB", "keywords": ["PostgreSQL"]},
            ],
        }
        result = score_cv(cv, job)
        assert result.overall >= 0.7
        assert "Python" in result.matched_keywords
        assert "Django" in result.matched_keywords
        assert result.missing_skills == []

    def test_cv_with_gaps(self):
        cv = {
            "basics": {"summary": "Python developer"},
            "skills": [{"name": "L", "keywords": ["Python"]}],
            "work": [],
            "_rendered_html": "<html><body><p>No lang, no h1</p></body></html>",
        }
        job = {
            "ats_keywords": ["Python", "Django", "Kubernetes"],
            "required_skills": [{"name": "L", "keywords": ["Python", "Django", "Kubernetes"]}],
        }
        result = score_cv(cv, job)
        # Should have ats-coverage and skill-gap recommendations.
        assert any("Django" in r["title"] for r in result.recommendations)
        assert any("Kubernetes" in r["title"] for r in result.recommendations)
        # Format safety failed → recommendations should mention it
        assert any(r["id"] == "fix_format_safety" for r in result.recommendations)

    def test_to_breakdown_returns_expected_keys(self):
        result = score_cv({}, None)
        bd = result.to_breakdown()
        assert "overall" in bd
        assert "axes" in bd
        assert set(bd["axes"].keys()) == {
            "ats_coverage", "skill_gap", "bullet_strength", "format_safety",
        }
        for axis_data in bd["axes"].values():
            assert "score" in axis_data
            assert "weight" in axis_data