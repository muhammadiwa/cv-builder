"""Phase 5 — Deterministic job↔profile matcher.

Pure Python. No LLM. Given a parsed Job and the user's Profile, computes:

  - per-skill matches with strength (0.0–1.0)
  - experience / seniority / education breakdown
  - weighted overall match score (0.0–1.0)

The LLM narrator (separate module) takes the deterministic breakdown and
turns it into human-readable prose + recommendation.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher


# ── Constants ────────────────────────────────────────────────────────

# Component weights — must sum to 1.0.
WEIGHT_SKILL = 0.60
WEIGHT_EXPERIENCE = 0.20
WEIGHT_SENIORITY = 0.10
WEIGHT_EDUCATION = 0.10

# Thresholds for "strong enough match" to count as a real hit.
FUZZY_RATIO_THRESHOLD = 0.75

# Recommendation thresholds (on overall score).
RECOMMEND_APPLY_THRESHOLD = 0.75
RECOMMEND_STRETCH_THRESHOLD = 0.50

# Seniority ordering used for "adjacent" detection.
SENIORITY_ORDER = ("junior", "mid", "senior", "staff", "principal", "lead")

# Rough mapping of free-form education strings to a comparable rank.
# Higher number = higher qualification.
EDUCATION_RANK = {
    "sma": 1, "smu": 1, "high school": 1,
    "d3": 2, "diploma": 2, "associate": 2,
    "d4": 3,
    "s1": 4, "bachelor": 4, "sarjana": 4, "undergraduate": 4,
    "s2": 5, "master": 5, "magister": 5,
    "s3": 6, "phd": 6, "doctor": 6, "doktor": 6,
}


# ── Helpers ──────────────────────────────────────────────────────────

_PUNCT_RE = re.compile(r"[^a-z0-9+#.\s]")


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation/whitespace, collapse runs of spaces.

    Keeps ``+`` and ``.`` because they're meaningful in tech names
    (C++, Next.js, Node.js).
    """
    s = text.lower().strip()
    s = _PUNCT_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _score_pair(a: str, b: str) -> float:
    """Return a match strength in [0.0, 1.0] for two skill keywords.

    Heuristic, in order:
      1. Exact (post-normalize)            → 1.0
      2. One normalized string contains the other → 0.9
      3. difflib ratio > 0.75             → ratio × 0.85 (discount fuzzy)
      4. Otherwise                         → 0.0
    """
    if not a or not b:
        return 0.0
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    if na in nb or nb in na:
        return 0.9
    ratio = SequenceMatcher(None, na, nb).ratio()
    if ratio >= FUZZY_RATIO_THRESHOLD:
        return ratio * 0.85
    return 0.0


def _profile_total_years(experiences: list[dict]) -> int | None:
    """Sum years across the user's work history.

    Returns None if NO entries have parseable dates, otherwise an int
    summing the years of entries with valid dates. Invalid entries are
    skipped (not fail-the-whole-call).
    """
    if not experiences:
        return None
    total = 0.0
    parsed_any = False
    for exp in experiences:
        start = exp.get("start")
        end = exp.get("end") or "present"
        years = _years_between(start, end)
        if years is not None:
            total += years
            parsed_any = True
    if not parsed_any:
        return None
    if total <= 0:
        return None
    return int(round(total))


def _years_between(start: str | None, end: str | None) -> float | None:
    """Convert YYYY-MM strings into a year delta. 'present' = today."""
    from datetime import datetime

    if not start:
        return None
    try:
        sy, sm = int(start[:4]), int(start[5:7]) if len(start) >= 7 else 1
    except (ValueError, IndexError):
        return None

    if end and end != "present":
        try:
            ey, em = int(end[:4]), int(end[5:7]) if len(end) >= 7 else 12
        except (ValueError, IndexError):
            return None
    else:
        now = datetime.utcnow()
        ey, em = now.year, now.month

    delta = (ey - sy) + (em - sm) / 12.0
    return max(0.0, delta)


def _seniority_rank(s: str | None) -> int:
    if not s:
        return -1
    s = s.lower().strip()
    if s in SENIORITY_ORDER:
        return SENIORITY_ORDER.index(s)
    # fuzzy match against known levels
    best, best_dist = -1, 999
    for i, level in enumerate(SENIORITY_ORDER):
        d = int((1 - SequenceMatcher(None, s, level).ratio()) * 100)
        if d < best_dist:
            best, best_dist = i, d
    return best if best_dist < 30 else -1


def _education_rank(s: str | None) -> int:
    if not s:
        return 0
    s = s.lower().strip()
    if s in EDUCATION_RANK:
        return EDUCATION_RANK[s]
    best, best_dist = 0, 999
    for key, rank in EDUCATION_RANK.items():
        d = int((1 - SequenceMatcher(None, s, key).ratio()) * 100)
        if d < best_dist:
            best, best_dist = rank, d
    return best if best_dist < 30 else 0


# ── Result dataclasses ───────────────────────────────────────────────


@dataclass
class SkillMatch:
    required_skill: str
    required_keyword: str
    matched_keyword: str | None
    strength: float


@dataclass
class ExperienceMatch:
    required_years: int | None
    profile_years: int | None
    score: float
    status: str  # "exceeds" | "meets" | "close" | "below" | "unknown"


@dataclass
class SeniorityMatch:
    job_seniority: str | None
    profile_seniority: str | None
    score: float
    status: str  # "match" | "close" | "mismatch" | "unknown"


@dataclass
class EducationMatch:
    required: str | None
    profile: str | None
    score: float
    status: str  # "exceeds" | "meets" | "below" | "unknown"


@dataclass
class MatchResult:
    """Full deterministic match — what the LLM narrator narrates over."""
    score: float                              # overall
    skill_score: float
    experience_score: float
    seniority_score: float
    education_score: float
    matched: list[SkillMatch] = field(default_factory=list)
    missing: list[SkillMatch] = field(default_factory=list)
    experience: ExperienceMatch | None = None
    seniority: SeniorityMatch | None = None
    education: EducationMatch | None = None

    @property
    def recommendation(self) -> str:
        if self.score >= RECOMMEND_APPLY_THRESHOLD:
            return "apply"
        if self.score >= RECOMMEND_STRETCH_THRESHOLD:
            return "stretch"
        return "skip"


# ── Public entry points ──────────────────────────────────────────────


def compute_skill_matches(
    profile_skills: list[dict],
    job_required_skills: list[dict],
    job_preferred_skills: list[dict] | None = None,
) -> tuple[list[SkillMatch], list[SkillMatch], float]:
    """Match each required-skill keyword against the profile's flat skill list.

    Args:
        profile_skills: list of dicts, each ``{name, level?, years?}``.
            Just ``name`` is used for matching.
        job_required_skills: list of dicts, each ``{name, keywords[]}``.
            Each keyword is treated as a separate required capability.
        job_preferred_skills: same shape; included to give partial credit
            when a profile skill matches a "nice-to-have".

    Returns:
        (matched, missing, overall_skill_score)
        - matched: SkillMatch with strength > 0, sorted by strength desc
        - missing: SkillMatch with strength == 0
        - overall_skill_score: float 0.0–1.0, mean of strengths
    """
    matched: list[SkillMatch] = []
    missing: list[SkillMatch] = []

    # Flatten profile into a list of (keyword, source) tuples.
    profile_keywords = [s.get("name", "") for s in profile_skills if s.get("name")]

    # Treat preferred skills as a 0.5× weight tie-breaker — if a profile skill
    # matches a preferred keyword, we record a partial match in `matched`
    # but don't count it as a real "requirement hit" for the missing list.
    preferred_keywords: list[tuple[str, str]] = []  # (category_name, keyword)
    for group in (job_preferred_skills or []):
        cat = group.get("name") or ""
        for kw in group.get("keywords", []):
            preferred_keywords.append((cat, kw))

    all_strengths: list[float] = []

    for group in job_required_skills:
        cat = group.get("name") or ""
        for kw in group.get("keywords", []):
            best_strength = 0.0
            best_profile_kw: str | None = None
            for pkw in profile_keywords:
                s = _score_pair(pkw, kw)
                if s > best_strength:
                    best_strength = s
                    best_profile_kw = pkw

            detail = SkillMatch(
                required_skill=cat,
                required_keyword=kw,
                matched_keyword=best_profile_kw if best_strength > 0 else None,
                strength=round(best_strength, 3),
            )
            all_strengths.append(best_strength)
            if best_strength > 0:
                matched.append(detail)
            else:
                missing.append(detail)

    # Preferred-skill nudges: if a profile keyword matches a preferred
    # category but missed all required keywords, add a small "matched" entry
    # so the FE shows it as a bonus (not a missing requirement).
    for pkw in profile_keywords:
        for (cat, kw) in preferred_keywords:
            s = _score_pair(pkw, kw)
            if s > 0:
                # Only add if this profile kw didn't already win any required match
                if not any(m.matched_keyword == pkw for m in matched):
                    matched.append(SkillMatch(
                        required_skill=f"{cat} (preferred)",
                        required_keyword=kw,
                        matched_keyword=pkw,
                        strength=round(s * 0.5, 3),  # half-weight for preferred
                    ))
                break

    matched.sort(key=lambda m: m.strength, reverse=True)
    skill_score = (sum(all_strengths) / len(all_strengths)) if all_strengths else 0.0
    return matched, missing, round(skill_score, 4)


def compute_experience_match(
    profile_years: int | None,
    required_years: int | None,
) -> ExperienceMatch:
    if required_years is None:
        return ExperienceMatch(
            required_years=None,
            profile_years=profile_years,
            score=1.0,
            status="unknown",
        )
    if profile_years is None:
        return ExperienceMatch(
            required_years=required_years,
            profile_years=None,
            score=0.0,
            status="unknown",
        )
    if profile_years >= required_years:
        score = 1.0
        status = "exceeds" if profile_years > required_years + 2 else "meets"
    elif profile_years >= required_years * 0.7:
        score = 0.7
        status = "close"
    else:
        score = max(0.0, round(profile_years / required_years, 3))
        status = "below"
    return ExperienceMatch(
        required_years=required_years,
        profile_years=profile_years,
        score=score,
        status=status,
    )


def compute_seniority_match(
    profile_seniority: str | None,
    job_seniority: str | None,
) -> SeniorityMatch:
    j = _seniority_rank(job_seniority)
    p = _seniority_rank(profile_seniority)
    if j < 0 and p < 0:
        return SeniorityMatch(job_seniority, profile_seniority, 1.0, "unknown")
    if j < 0 or p < 0:
        return SeniorityMatch(job_seniority, profile_seniority, 0.5, "unknown")
    diff = abs(j - p)
    if diff == 0:
        return SeniorityMatch(job_seniority, profile_seniority, 1.0, "match")
    if diff == 1:
        return SeniorityMatch(job_seniority, profile_seniority, 0.7, "close")
    return SeniorityMatch(job_seniority, profile_seniority, 0.3, "mismatch")


def compute_education_match(
    profile_education: str | None,
    required_education: str | None,
) -> EducationMatch:
    if not required_education:
        return EducationMatch(required_education, profile_education, 1.0, "unknown")
    if not profile_education:
        return EducationMatch(required_education, profile_education, 0.0, "below")
    p_rank = _education_rank(profile_education)
    r_rank = _education_rank(required_education)
    if p_rank >= r_rank:
        status = "exceeds" if p_rank > r_rank else "meets"
        return EducationMatch(required_education, profile_education, 1.0, status)
    return EducationMatch(required_education, profile_education, 0.5, "below")


def compute_match(
    profile: dict,
    job_analysis: dict,
) -> MatchResult:
    """Top-level: takes a Profile dict + JobAnalysis dict, returns MatchResult.

    Inputs are tolerant — missing keys yield neutral scores rather than errors.
    """
    profile_skills = profile.get("skills") or []
    profile_experiences = profile.get("work") or profile.get("experiences") or []
    profile_seniority = profile.get("seniority")  # optional field, may be None
    profile_education = (
        # Highest-degree string (try a few common locations)
        (profile.get("education") or [{}])[0].get("degree")
        if profile.get("education") else None
    )
    profile_years = _profile_total_years(profile_experiences)

    job_required = job_analysis.get("required_skills") or []
    job_preferred = job_analysis.get("preferred_skills") or []
    job_seniority = job_analysis.get("seniority")
    job_required_years = job_analysis.get("required_experience_years")
    job_required_education = job_analysis.get("required_education")

    matched, missing, skill_score = compute_skill_matches(
        profile_skills, job_required, job_preferred
    )

    exp = compute_experience_match(profile_years, job_required_years)
    sen = compute_seniority_match(profile_seniority, job_seniority)
    edu = compute_education_match(profile_education, job_required_education)

    overall = (
        WEIGHT_SKILL * skill_score
        + WEIGHT_EXPERIENCE * exp.score
        + WEIGHT_SENIORITY * sen.score
        + WEIGHT_EDUCATION * edu.score
    )
    overall = round(max(0.0, min(1.0, overall)), 4)

    return MatchResult(
        score=overall,
        skill_score=skill_score,
        experience_score=exp.score,
        seniority_score=sen.score,
        education_score=edu.score,
        matched=matched,
        missing=missing,
        experience=exp,
        seniority=sen,
        education=edu,
    )