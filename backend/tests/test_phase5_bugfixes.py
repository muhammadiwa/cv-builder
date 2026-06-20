"""Phase 4 + 5 code-review fixes — regression tests.

Each test here corresponds to a finding in either:
  docs/reviews/phase4-code-review.md  (B7–B13)
  docs/reviews/phase5-code-review.md  (H2, H3, M3, L1, L2, L3, P2, P3, P4)

Findings that were resolved by infrastructure (not code) are
deliberately omitted — the existing test_phase4_bugfixes.py and
test_match_endpoint.py already cover those flows.
"""
from __future__ import annotations

import pytest

from app.services.matcher import (
    MATCHER_CONFIG,
    TECH_ALIASES,
    MatcherConfig,
    SkillMatch,
    compute_skill_matches,
    _apply_alias,
    _score_pair,
)


# ── H3: alias table ──────────────────────────────────────────────────


class TestTechAliases:
    """H3 fix: tech synonyms that fuzzy match missed are now exact."""

    def test_k8s_maps_to_kubernetes(self):
        # The original finding: "K8s" vs "Kubernetes" scored ~0.18 with
        # difflib (well below 0.75 threshold) → no match. With the alias
        # table both canonicalize to "kubernetes" → exact.
        s, method = _score_pair("K8s", "Kubernetes")
        assert s == 1.0
        assert method == "exact"

    def test_js_ts_py_shortnames(self):
        assert _score_pair("JS", "JavaScript") == (1.0, "exact")
        assert _score_pair("TS", "TypeScript") == (1.0, "exact")
        assert _score_pair("Py", "Python") == (1.0, "exact")

    def test_reactjs_react_angular_angularjs(self):
        assert _score_pair("ReactJS", "React") == (1.0, "exact")
        assert _score_pair("AngularJS", "Angular") == (1.0, "exact")
        # vue.js / vuejs both canonicalize to "vue" (dots/punctuation stripped)
        assert _score_pair("Vue.js", "VueJS") == (1.0, "exact")

    def test_postgres_mongo_aliases(self):
        assert _score_pair("Postgres", "PostgreSQL") == (1.0, "exact")
        assert _score_pair("Mongo", "MongoDB") == (1.0, "exact")

    def test_apply_alias_returns_canonical(self):
        assert _apply_alias("k8s") == "kubernetes"
        assert _apply_alias("K8S") == "kubernetes"  # case-insensitive
        assert _apply_alias("K8s") == "kubernetes"
        # Non-alias passes through unchanged
        assert _apply_alias("Python") == "python"

    def test_alias_table_has_reasonable_coverage(self):
        # Sanity: we should have at least 20 entries covering the
        # most common shortnames. If someone clears this dict we
        # want CI to flag it.
        assert len(TECH_ALIASES) >= 20


# ── L2: match telemetry ──────────────────────────────────────────────


class TestMatchTelemetry:
    """L2 fix: per-strategy hit counts are attached to every SkillMatch."""

    def test_skill_match_carries_method_field(self):
        # The dataclass gained ``match_method``; default is "" (miss).
        m = SkillMatch(
            required_skill="Languages",
            required_keyword="Python",
            matched_keyword="Python",
            strength=1.0,
        )
        assert m.match_method == ""

    def test_exact_match_uses_alias(self):
        # H3 + L2 combined: an alias-canonicalized exact match shows
        # up as method="exact".
        matched, missing, _ = compute_skill_matches(
            profile_skills=[{"name": "k8s"}],
            job_required_skills=[{"name": "Infra", "keywords": ["Kubernetes"]}],
        )
        assert len(matched) == 1
        assert matched[0].match_method == "exact"
        assert len(missing) == 0

    def test_fuzzy_match_is_tagged_fuzzy(self):
        # "Pyhton" is a typo, difflib ratio ~0.91 → fuzzy band.
        matched, _, _ = compute_skill_matches(
            profile_skills=[{"name": "Pyhton"}],
            job_required_skills=[{"name": "Languages", "keywords": ["Python"]}],
        )
        assert len(matched) == 1
        assert matched[0].match_method == "fuzzy"

    def test_misses_have_empty_method(self):
        _, missing, _ = compute_skill_matches(
            profile_skills=[{"name": "Python"}],
            job_required_skills=[{"name": "Languages", "keywords": ["Cobol"]}],
        )
        assert len(missing) == 1
        assert missing[0].match_method == ""


# ── P4: config class ────────────────────────────────────────────────


class TestMatcherConfig:
    """P4 fix: thresholds live in MatcherConfig, not bare module globals."""

    def test_default_config_matches_legacy_constants(self):
        # The dataclass defaults must match the legacy exported constants
        # so existing behavior is preserved.
        cfg = MatcherConfig()
        assert cfg.weight_skill == 0.60
        assert cfg.weight_experience == 0.20
        assert cfg.weight_seniority == 0.10
        assert cfg.weight_education == 0.10
        assert cfg.fuzzy_ratio_threshold == 0.75
        assert cfg.recommend_apply_threshold == 0.75
        assert cfg.recommend_stretch_threshold == 0.50
        assert cfg.substring_strength == 0.9
        assert cfg.fuzzy_strength_multiplier == 0.85

    def test_normalized_weights_sums_to_one(self):
        cfg = MatcherConfig(weight_skill=2.0, weight_experience=1.0)
        n = cfg.normalized_weights()
        s = n.weight_skill + n.weight_experience + n.weight_seniority + n.weight_education
        assert abs(s - 1.0) < 1e-9

    def test_score_pair_uses_supplied_config(self):
        # Stricter threshold: a fuzzy match that passes at 0.75 should
        # fail at 0.95. This proves the config knob is wired in.
        strict = MatcherConfig(fuzzy_ratio_threshold=0.95)
        # "Pyhton" vs "Python" — difflib ~0.91 → below 0.95 → no hit
        s, method = _score_pair("Pyhton", "Python", config=strict)
        assert s == 0.0
        assert method == ""
        # Default config: it still passes
        s, method = _score_pair("Pyhton", "Python")
        assert s > 0
        assert method == "fuzzy"

    def test_module_singleton_is_default_config(self):
        assert isinstance(MATCHER_CONFIG, MatcherConfig)
        assert MATCHER_CONFIG.weight_skill == 0.60


# ── P5-P4 importability sanity ───────────────────────────────────────


def test_legacy_constants_still_exported():
    """The legacy module-level constants must remain importable so old
    tests + external callers don't break. (P4 fix should be additive.)"""
    from app.services.matcher import (
        WEIGHT_SKILL,
        WEIGHT_EXPERIENCE,
        WEIGHT_SENIORITY,
        WEIGHT_EDUCATION,
        FUZZY_RATIO_THRESHOLD,
        RECOMMEND_APPLY_THRESHOLD,
        RECOMMEND_STRETCH_THRESHOLD,
    )
    assert WEIGHT_SKILL == 0.60
    assert WEIGHT_EXPERIENCE == 0.20
    assert WEIGHT_SENIORITY == 0.10
    assert WEIGHT_EDUCATION == 0.10
    assert FUZZY_RATIO_THRESHOLD == 0.75
    assert RECOMMEND_APPLY_THRESHOLD == 0.75
    assert RECOMMEND_STRETCH_THRESHOLD == 0.50