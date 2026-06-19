"""Unit tests for the deterministic matcher (no LLM, no DB).

Pure logic — exercises _score_pair, component matchers, and compute_match
across a range of realistic profiles.
"""
import pytest

from app.services.matcher import (
    MatchResult,
    compute_education_match,
    compute_experience_match,
    compute_match,
    compute_seniority_match,
    compute_skill_matches,
    _score_pair,
)


# ── _score_pair ──────────────────────────────────────────────────────


class TestScorePair:
    def test_exact_match(self):
        assert _score_pair("Python", "Python") == 1.0

    def test_substring_match(self):
        # "Java" is a substring of "Java Spring Boot"
        assert _score_pair("Java", "Java Spring Boot") == 0.9
        assert _score_pair("React", "React.js") == 0.9
        assert _score_pair("Postgres", "PostgreSQL") == 0.9

    def test_fuzzy_match(self):
        # "Node.js" vs "NodeJS" — fuzzy match
        s = _score_pair("Node.js", "NodeJS")
        assert 0.6 < s < 0.95

    def test_no_match(self):
        assert _score_pair("Java", "Golang") == 0.0
        assert _score_pair("Python", "JavaScript") == 0.0

    def test_empty_inputs(self):
        assert _score_pair("", "Java") == 0.0
        assert _score_pair("Java", "") == 0.0
        assert _score_pair("", "") == 0.0

    def test_case_insensitive(self):
        assert _score_pair("PYTHON", "python") == 1.0
        assert _score_pair("Django", "django") == 1.0

    def test_punctuation_stripped(self):
        assert _score_pair("C++", "C++") == 1.0
        assert _score_pair("Node.js", "nodejs") >= 0.75

    def test_k8s_vs_kubernetes_no_match(self):
        # difflib ratio of these two strings is ~0.18 — below threshold.
        # Known limitation; future work: alias table.
        assert _score_pair("K8s", "Kubernetes") == 0.0


# ── compute_skill_matches ────────────────────────────────────────────


class TestSkillMatches:
    def test_full_match_all_keywords(self):
        profile = [{"name": "Python"}, {"name": "Java"}, {"name": "PostgreSQL"}]
        required = [
            {"name": "Languages", "keywords": ["Python", "Java"]},
            {"name": "DB", "keywords": ["PostgreSQL"]},
        ]
        matched, missing, score = compute_skill_matches(profile, required)
        assert len(matched) == 3
        assert len(missing) == 0
        assert score == 1.0

    def test_partial_match(self):
        profile = [{"name": "Python"}]
        required = [{"name": "Languages", "keywords": ["Python", "Golang", "Rust"]}]
        matched, missing, score = compute_skill_matches(profile, required)
        assert len(matched) == 1
        assert len(missing) == 2
        assert 0.3 < score < 0.4  # 1.0 / 3 ≈ 0.333

    def test_no_match(self):
        profile = [{"name": "Python"}]
        required = [{"name": "Languages", "keywords": ["Java", "Golang"]}]
        matched, missing, score = compute_skill_matches(profile, required)
        assert matched == []
        assert len(missing) == 2
        assert score == 0.0

    def test_empty_inputs(self):
        matched, missing, score = compute_skill_matches([], [])
        assert matched == []
        assert missing == []
        assert score == 0.0

    def test_preferred_skills_half_weight(self):
        """Profile matches a preferred (not required) keyword → half-weight match."""
        profile = [{"name": "MongoDB"}]
        required = [{"name": "Languages", "keywords": ["Python"]}]
        preferred = [{"name": "Nice to have", "keywords": ["MongoDB"]}]
        matched, missing, score = compute_skill_matches(
            profile, required, preferred
        )
        # The required Python is missing → 1 missing.
        assert len(missing) == 1
        # The MongoDB preferred match shows up with half-weight (0.5).
        assert any(m.required_skill.endswith("(preferred)") for m in matched)
        # MongoDB → preferred "MongoDB" is exact → 1.0 × 0.5 = 0.5
        preferred_match = next(m for m in matched if m.required_keyword == "MongoDB")
        assert preferred_match.strength == 0.5

    def test_matched_sorted_by_strength_desc(self):
        profile = [{"name": "Python"}, {"name": "Java"}, {"name": "Ruby"}]
        required = [
            {"name": "Mixed", "keywords": ["Ruby", "Java", "Python"]},
        ]
        matched, _, _ = compute_skill_matches(profile, required)
        # Python vs "Python" → 1.0, Java vs "Java" → 1.0, Ruby vs "Ruby" → 1.0
        strengths = [m.strength for m in matched]
        assert strengths == sorted(strengths, reverse=True)


# ── compute_experience_match ─────────────────────────────────────────


class TestExperienceMatch:
    def test_meets_exactly(self):
        m = compute_experience_match(2, 2)
        assert m.status == "meets"
        assert m.score == 1.0

    def test_exceeds(self):
        m = compute_experience_match(7, 2)
        assert m.status == "exceeds"
        assert m.score == 1.0

    def test_close(self):
        m = compute_experience_match(2, 3)  # required 3, have 2 → 2/3 ≈ 0.67, < 0.7 threshold
        # Actually 2 >= 3*0.7 = 2.1 is False, so this falls to "below"
        assert m.status == "below"

    def test_close_at_threshold(self):
        # required=4, profile=3 → 3 >= 4*0.7=2.8 → close
        m = compute_experience_match(3, 4)
        assert m.status == "close"
        assert m.score == 0.7

    def test_just_below_threshold(self):
        # required=4, profile=2 → 2 >= 2.8 is False → below
        m = compute_experience_match(2, 4)
        assert m.status == "below"
        assert 0 < m.score < 1

    def test_below_low(self):
        m = compute_experience_match(1, 5)
        assert m.status == "below"
        assert 0 < m.score < 1

    def test_required_none_returns_1(self):
        m = compute_experience_match(5, None)
        assert m.status == "unknown"
        assert m.score == 1.0

    def test_profile_none_required_set(self):
        m = compute_experience_match(None, 3)
        assert m.status == "unknown"
        assert m.score == 0.0


# ── compute_seniority_match ──────────────────────────────────────────


class TestSeniorityMatch:
    def test_exact(self):
        m = compute_seniority_match("mid", "mid")
        assert m.status == "match"
        assert m.score == 1.0

    def test_close(self):
        m = compute_seniority_match("senior", "mid")  # diff=1
        assert m.status == "close"
        assert m.score == 0.7

    def test_mismatch(self):
        m = compute_seniority_match("junior", "principal")  # diff=4
        assert m.status == "mismatch"
        assert m.score == 0.3

    def test_both_unknown(self):
        m = compute_seniority_match(None, None)
        assert m.status == "unknown"
        assert m.score == 1.0

    def test_one_unknown(self):
        m = compute_seniority_match("mid", None)
        assert m.status == "unknown"
        assert m.score == 0.5


# ── compute_education_match ──────────────────────────────────────────


class TestEducationMatch:
    def test_meets(self):
        m = compute_education_match("S1", "S1")
        assert m.status == "meets"
        assert m.score == 1.0

    def test_exceeds(self):
        m = compute_education_match("S2", "S1")
        assert m.status == "exceeds"
        assert m.score == 1.0

    def test_below(self):
        m = compute_education_match("SMA", "S1")
        assert m.status == "below"
        assert m.score == 0.5

    def test_required_unknown(self):
        m = compute_education_match("S1", None)
        assert m.status == "unknown"
        assert m.score == 1.0

    def test_profile_unknown(self):
        m = compute_education_match(None, "S1")
        assert m.status == "below"
        assert m.score == 0.0

    def test_synonyms(self):
        assert compute_education_match("Bachelor", "S1").status == "meets"
        assert compute_education_match("Master", "S2").status == "meets"


# ── compute_match (top-level) ────────────────────────────────────────


def make_profile():
    return {
        "name": "Test",
        "skills": [
            {"name": "Python"},
            {"name": "Java"},
            {"name": "React"},
            {"name": "PostgreSQL"},
            {"name": "Docker"},
            {"name": "CI/CD"},
        ],
        "work": [
            {"company": "Acme", "title": "Backend", "start": "2019-01", "end": "present"},
        ],
        "education": [{"degree": "S1"}],
        "seniority": "mid",
    }


def make_job_analysis():
    return {
        "required_skills": [
            {"name": "Languages", "keywords": ["Java Spring Boot", "Python", "Golang"]},
            {"name": "DB", "keywords": ["PostgreSQL", "MongoDB"]},
            {"name": "DevOps", "keywords": ["CI/CD", "Docker"]},
        ],
        "required_experience_years": 2,
        "required_education": "S1",
        "seniority": "mid",
    }


class TestComputeMatch:
    def test_full_profile_strong_match(self):
        result = compute_match(make_profile(), make_job_analysis())
        assert isinstance(result, MatchResult)
        # 5 of 7 keywords matched (4 exact + 1 substring=0.9, 2 missing=0.0)
        # = 4.9 / 7 = 0.7
        assert 0.65 <= result.skill_score <= 0.75
        # Experience: 7 years >= 2 → exceeds → 1.0
        assert result.experience_score == 1.0
        # Seniority: mid == mid → match → 1.0
        assert result.seniority_score == 1.0
        # Education: S1 == S1 → meets → 1.0
        assert result.education_score == 1.0
        # Weighted: 0.6*0.7 + 0.2*1 + 0.1*1 + 0.1*1 = 0.72 → "stretch"
        assert 0.65 < result.score < 0.85
        assert result.recommendation in ("apply", "stretch")

    def test_empty_profile_low_match(self):
        empty_profile = {"skills": [], "work": [], "education": [], "seniority": None}
        result = compute_match(empty_profile, make_job_analysis())
        # All keywords missing → skill 0
        assert result.skill_score == 0.0
        # No profile_years → 0.0
        assert result.experience_score == 0.0
        # No profile_seniority → 0.5
        assert result.seniority_score == 0.5
        # No profile education → 0.0
        assert result.education_score == 0.0
        # Overall: 0.6*0 + 0.2*0 + 0.1*0.5 + 0.1*0 = 0.05
        assert result.score == pytest.approx(0.05, abs=0.001)
        assert result.recommendation == "skip"

    def test_recommendation_thresholds(self):
        # Force score ≈ 0.5 boundary
        p = {"skills": [{"name": "Python"}], "work": [], "education": [], "seniority": "mid"}
        j = {
            "required_skills": [{"name": "X", "keywords": ["Python", "Other"]}],
            "seniority": "mid",
        }
        result = compute_match(p, j)
        # Skill: 0.5 (1 of 2). Sen: 1.0. Exp: 1.0 (None). Edu: 1.0 (None).
        # Overall: 0.6*0.5 + 0.2*1 + 0.1*1 + 0.1*1 = 0.7 → "stretch" (0.5 ≤ 0.7 < 0.75)
        assert result.recommendation == "stretch"

    def test_missing_picks_up_required_keyword(self):
        p = {"skills": [{"name": "Python"}], "work": [], "education": [], "seniority": None}
        j = {"required_skills": [{"name": "Languages", "keywords": ["Python", "Rust"]}]}
        result = compute_match(p, j)
        assert len(result.matched) == 1
        assert len(result.missing) == 1
        assert result.missing[0].required_keyword == "Rust"
        assert result.missing[0].matched_keyword is None
        assert result.missing[0].strength == 0.0

    def test_work_years_computation(self):
        from app.services.matcher import _profile_total_years

        # 2 jobs: 3 years + 2 years = 5 years total
        years = _profile_total_years([
            {"start": "2020-01", "end": "2023-01"},
            {"start": "2018-06", "end": "2020-06"},
        ])
        # 3.0 + 2.0 = 5.0 (rounded)
        assert years == 5

    def test_work_years_with_present(self):
        from app.services.matcher import _profile_total_years
        from datetime import datetime

        years = _profile_total_years([
            {"start": "2019-01", "end": "present"},
        ])
        # ~7 years from 2019 to now (2026)
        current_year = datetime.utcnow().year
        assert years >= (current_year - 2019 - 1)  # at least (now-1) years
        assert years <= (current_year - 2019 + 1)

    def test_work_years_handles_invalid_dates(self):
        from app.services.matcher import _profile_total_years
        # Invalid date strings should be skipped, not crash
        years = _profile_total_years([
            {"start": None, "end": "2023-01"},
            {"start": "invalid", "end": "also-invalid"},
        ])
        assert years is None  # no parseable years → None