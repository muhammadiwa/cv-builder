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


# ── Config (P4 fix) ─────────────────────────────────────────────────
#
# Magic numbers were lifted from this module so thresholds can be tuned
# without code changes. The dataclass is mutable so tests / callers can
# monkey-patch a stricter config, but the default ``MATCHER_CONFIG`` is
# what production uses.

@dataclass
class MatcherConfig:
    """All tunable thresholds for the deterministic matcher (P4 fix).

    Component weights must sum to 1.0. The class itself does not enforce
    that — call :meth:`normalized_weights` to rebalance automatically.
    """

    # Component weights for the overall score.
    weight_skill: float = 0.60
    weight_experience: float = 0.20
    weight_seniority: float = 0.10
    weight_education: float = 0.10

    # Fuzzy match acceptance threshold (0.0–1.0).
    fuzzy_ratio_threshold: float = 0.75

    # Recommendation thresholds (on overall score).
    recommend_apply_threshold: float = 0.75
    recommend_stretch_threshold: float = 0.50

    # Discount applied to fuzzy matches (1.0 for exact/substring).
    fuzzy_strength_multiplier: float = 0.85

    # Substring match strength (when one string contains the other).
    substring_strength: float = 0.9

    def normalized_weights(self) -> "MatcherConfig":
        """Return a copy with weights rebalanced to sum to 1.0."""
        total = (
            self.weight_skill
            + self.weight_experience
            + self.weight_seniority
            + self.weight_education
        )
        if total == 0:
            return self
        return MatcherConfig(
            weight_skill=self.weight_skill / total,
            weight_experience=self.weight_experience / total,
            weight_seniority=self.weight_seniority / total,
            weight_education=self.weight_education / total,
            fuzzy_ratio_threshold=self.fuzzy_ratio_threshold,
            recommend_apply_threshold=self.recommend_apply_threshold,
            recommend_stretch_threshold=self.recommend_stretch_threshold,
            fuzzy_strength_multiplier=self.fuzzy_strength_multiplier,
            substring_strength=self.substring_strength,
        )


# Module-level singleton used by the free functions below. Override in
# tests via ``matcher.MATCHER_CONFIG = MatcherConfig(...)``.
MATCHER_CONFIG = MatcherConfig()


# ── Alias table (H3 fix) ─────────────────────────────────────────────
#
# Tech synonyms that the fuzzy matcher either misses or matches at low
# ratio. The table is consulted BEFORE normalization in ``_score_pair``
# so canonical names always win the exact match branch.

TECH_ALIASES: dict[str, str] = {
    # Container / orchestration
    "k8s": "kubernetes",
    "kube": "kubernetes",
    "k8": "kubernetes",
    # Language/tool shortnames
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "rb": "ruby",
    "rs": "rust",
    "go lang": "go",
    "golang": "go",
    "c sharp": "c#",
    "csharp": "c#",
    # Frameworks / libs
    "reactjs": "react",
    "react js": "react",
    "vuejs": "vue",
    "vue js": "vue",
    "vue.js": "vue",
    "angularjs": "angular",
    "nextjs": "next.js",
    "next js": "next.js",
    "nuxtjs": "nuxt",
    "expressjs": "express",
    "express js": "express",
    "nodejs": "node.js",
    "node js": "node.js",
    "nestjs": "nest",
    # Databases
    "postgres": "postgresql",
    "psql": "postgresql",
    "mongo": "mongodb",
    "mssql": "sql server",
    "mysql server": "mysql",
    # Cloud
    "gcp": "google cloud",
    "amazon web services": "aws",
    "amazon aws": "aws",
    "azure cloud": "azure",
    # CI/CD
    "gh actions": "github actions",
    "gh actions ci": "github actions",
    # REST / HTTP / API
    "rest api": "rest",
    "restful api": "rest",
    "rest apis": "rest",
    "restful apis": "rest",
    "restful": "rest",
    "rest service": "rest",
    "rest services": "rest",
    # Misc
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "nlp": "natural language processing",
    "cv": "computer vision",
    "tf": "tensorflow",
    "pytorch": "torch",
}


# ── Constants (legacy exports kept for back-compat with tests) ──────

# Component weights — must sum to 1.0. Mirrors MatcherConfig defaults.
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

_PUNCT_RE = re.compile(r"[^a-z0-9+#.\\s]")


def _normalize(text: str) -> str:
    """Lowercase, strip punctuation/whitespace, collapse runs of spaces.

    Keeps ``+`` and ``.`` because they're meaningful in tech names
    (C++, Next.js, Node.js).
    """
    s = text.lower().strip()
    s = _PUNCT_RE.sub(" ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _apply_alias(name: str) -> str:
    """H3 fix: map a normalized tech name to its canonical form.

    Non-matches return ``name`` unchanged. Aliases are matched against
    the normalized form so casing/whitespace don't matter.
    """
    key = _normalize(name)
    return TECH_ALIASES.get(key, key)


def _score_pair(a: str, b: str, config: MatcherConfig | None = None) -> tuple[float, str]:
    """Return (match_strength, match_method) for two skill keywords (L2 fix).

    ``match_method`` is one of: ``"exact"``, ``"substring"``, ``"fuzzy"``,
    or ``""`` (no match). The method makes it possible to attribute each
    hit in telemetry (L2) without re-running the comparison.

    Heuristic, in order:
      1. Alias-canonicalized exact match → 1.0 ("exact")
      2. One canonical string contains the other → 0.9 ("substring")
      3. difflib ratio > threshold → ratio × multiplier ("fuzzy")
      4. Otherwise → 0.0, "" (no match)
    """
    cfg = config or MATCHER_CONFIG
    if not a or not b:
        return 0.0, ""
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return 0.0, ""
    ca, cb = _apply_alias(a), _apply_alias(b)
    if ca == cb:
        return 1.0, "exact"
    if ca in cb or cb in ca:
        return cfg.substring_strength, "substring"
    ratio = SequenceMatcher(None, na, nb).ratio()
    if ratio >= cfg.fuzzy_ratio_threshold:
        return ratio * cfg.fuzzy_strength_multiplier, "fuzzy"
    return 0.0, ""


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
        start = exp.get("startDate") or exp.get("start")
        end = exp.get("endDate") or exp.get("end") or "present"
        years = _years_between(start, end)
        if years is not None:
            total += years
            parsed_any = True
    if not parsed_any:
        return None
    if total <= 0:
        return None
    return int(round(total))


# ── Known-tech set (work-mention detection helper) ───────────────
# Set of canonical tech names that we recognize as tech keywords in
# work descriptions. Built from TECH_ALIASES values + manual additions.
# Used by ``_tech_from_work_highlights`` to detect tech tokens that
# never made it into the profile's top-level skills list but ARE
# mentioned in work highlights / descriptions.
KNOWN_TECHS: set[str] = {
    # Languages
    "c#", "f#", "python", "javascript", "typescript", "java", "kotlin",
    "swift", "objective-c", "go", "rust", "ruby", "php", "scala",
    "elixir", "erlang", "haskell", "clojure", "lua", "perl", "r",
    "sql", "html", "css", "bash", "powershell",
    # .NET family (canonical form for matching, both '.net' and
    # 'dotnet' would lose the dot in token-split without this)
    ".net", ".net core", ".net framework", "asp.net", "blazor",
    # Frontend frameworks
    "react", "vue", "angular", "svelte", "next.js", "nuxt",
    "ember", "backbone", "jquery", "redux", "tailwind", "bootstrap",
    # Backend frameworks
    "django", "flask", "fastapi", "express", "nest", "spring",
    "spring boot", "laravel", "rails", "django rest", "gin", "echo",
    "fiber", "actix", "rocket",
    # Mobile
    "swiftui", "flutter", "react native", "kotlin multiplatform",
    # Databases
    "postgresql", "mysql", "mongodb", "redis", "memcached", "sqlite",
    "sql server", "mariadb", "cassandra", "elasticsearch", "neo4j",
    "dynamodb", "cosmos", "bigquery", "snowflake", "clickhouse",
    "ms sql", "mssql", "oracle",
    # Cloud
    "aws", "azure", "google cloud", "gcp", "heroku", "digitalocean",
    "cloudflare", "vercel", "netlify", "fly", "render",
    # DevOps / infra
    "docker", "kubernetes", "terraform", "ansible", "helm",
    "prometheus", "grafana", "datadog", "elasticsearch", "kibana",
    "jenkins", "github actions", "circleci", "travis", "argo",
    "istio", "linkerd", "consul", "vault", "nginx", "apache",
    "linux", "windows server", "active directory",
    # Misc dev
    "graphql", "grpc", "kafka", "rabbitmq", "redis", "nats",
    "websocket", "rest", "soap", "openapi", "swagger",
    # Testing
    "jest", "pytest", "junit", "xunit", "mocha", "cypress",
    "selenium", "playwright", "postman", "jmeter",
    # Mobile platforms
    "ios", "android",
    # Common abbreviations
    "ci cd", "ci/cd", "tdd", "bdd", "oop", "ddd", "orm",
    # Big data / ML
    "spark", "hadoop", "kafka", "airflow", "dbt", "pandas",
    "numpy", "scikit-learn", "pytorch", "tensorflow",
}


def _tech_from_work_highlights(
    experiences: list[dict], config: MatcherConfig | None = None,
) -> list[str]:
    """Extract tech keywords from work highlights + descriptions.

    Phase 10E: a user profile might have "C#" / ".NET Core" mentioned
    in work descriptions and highlights even though it never made it
    into the top-level skills list (e.g. the resume parser omitted it,
    or the LLM flattened it into a more generic category). Without
    these mentions, the matcher would say the user doesn't know
    C# even though every job highlight mentions C#.

    Returns a list of distinct normalized tech tokens (post-alias).
    This is a hint list — the matcher treats work-mentions as
    lower-confidence than explicit skills (half-strength), but they're
    way better than a blank score.

    Detection: split each highlight / description into tokens (words
    + punctuation-preserving tech tokens like "C#", ".NET Core",
    "Node.js"). For each token, look it up in the TECH_ALIASES table
    — anything that maps to a known canonical name is a tech mention.
    """
    cfg = config or MATCHER_CONFIG
    mentions: set[str] = set()
    # Common multi-word tokens we want to capture as a unit.
    multi_word = (
        "react native", "vue native", "vue.js", "next.js", "node.js",
        "nuxt.js", "nest.js", "nuxtjs", "express.js", ".net core",
        ".net framework", "asp.net", "ruby on rails", "amazon web services",
        "google cloud", "azure devops", "ci/cd", "github actions",
        "rest api", "restful api", "rest apis", "restful apis",
        "ms sql", "ms sql server", "sql server",
        "google cloud platform", "amazon s3", "spring boot",
        "react native", "react.js",
    )
    for exp in experiences:
        # Highlights are the richest source
        texts: list[str] = []
        for h in exp.get("highlights") or []:
            if isinstance(h, str):
                texts.append(h)
        desc = exp.get("description")
        if isinstance(desc, str) and desc:
            texts.append(desc)
        # Position / company name can also carry tech (e.g. ".NET Developer")
        for fld in ("position", "name"):
            v = exp.get(fld)
            if isinstance(v, str):
                texts.append(v)
        big = " ".join(texts).lower()
        # 1) Multi-word tokens (greedy, longest first)
        for phrase in sorted(multi_word, key=len, reverse=True):
            if phrase in big:
                mentions.add(_apply_alias(phrase))
        # 2) Single tokens — split on whitespace and common punct.
        # Use a regex that preserves dots inside tech tokens ("next.js"
        # → "next.js", not "next" + "js").
        for tok in re.split(r"[\s,/();:]+", big):
            tok = tok.strip().rstrip(".").rstrip(",")
            if not tok:
                continue
            canonical = _apply_alias(tok)
            if canonical in KNOWN_TECHS:
                mentions.add(canonical)
    # Drop noise (very short tokens that are unlikely to be tech)
    return sorted(m for m in mentions if len(m) >= 2)


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
    # L2 fix: which match strategy produced this hit. "" for misses,
    # otherwise "exact" | "substring" | "fuzzy". Telemetry consumer is the
    # JobMatchOut.match_telemetry field below.
    match_method: str = ""


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

    @property
    def match_telemetry(self) -> dict[str, int]:
        """L2 fix: per-strategy hit counts for tuning the thresholds later.

        Counts every matched item in self.matched by ``match_method``.
        Useful for A/B-ing a stricter fuzzy threshold or a larger alias
        table — you can see whether dropping substring matches would
        remove real hits or just luck-of-the-draw ones.
        """
        out: dict[str, int] = {"exact": 0, "substring": 0, "fuzzy": 0}
        for m in self.matched:
            if m.match_method in out:
                out[m.match_method] += 1
        return out


# ── Public entry points ──────────────────────────────────────────────


def compute_skill_matches(
    profile_skills: list[dict],
    job_required_skills: list[dict],
    job_preferred_skills: list[dict] | None = None,
    work_experiences: list[dict] | None = None,
) -> tuple[list[SkillMatch], list[SkillMatch], float]:
    """Match each required-skill keyword against the profile's flat skill list.

    Args:
        profile_skills: list of dicts. Two accepted shapes (auto-detected):
          1. ``{name, keywords[]}`` — categories with a list of keywords
             inside (this is what the resume parser produces, and what
             the LLM emits for ``base_profile_json.skills``). The matcher
             flattens these to keyword-level so each keyword is matched
             individually — matching the same shape the job analyzer uses
             for ``required_skills[*].keywords[]``.
          2. ``{name}`` only — treated as a single-skill keyword (legacy).
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

    # Flatten profile into a list of (keyword, source_category) tuples.
    # Per-category keywords are the meaningful units (a skill like
    # "MS SQL" lives inside the "Databases" category). Without this
    # flatten, the matcher would compare the job's keywords
    # ("Git", "PostgreSQL") against category names ("Databases",
    # "DevOps & Delivery") — which NEVER match — and produce skill_score
    # = 0 even when the user clearly has the skill.
    profile_keywords: list[tuple[str, str]] = []  # (keyword, category_name)
    for s in profile_skills:
        if not isinstance(s, dict):
            continue
        cat = (s.get("name") or "").strip()
        kws = s.get("keywords") or []
        if isinstance(kws, list) and kws:
            for kw in kws:
                if isinstance(kw, str) and kw.strip():
                    profile_keywords.append((kw.strip(), cat))
        elif cat:  # legacy: name-only entry treated as a single keyword
            profile_keywords.append((cat, cat))

    # Fallback: also pull tech mentions from work descriptions and
    # highlights. Phase 10E fix — many users have C# / .NET mentioned
    # in their work history even when it never made it into the top-
    # level skills list. These count at HALF strength so explicit
    # skills still dominate but a missing entry doesn't blank the
    # match to zero.
    work_mentions = _tech_from_work_highlights(
        work_experiences or []
    )

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
            best_method: str = ""
            for pkw, _cat in profile_keywords:
                strength, method = _score_pair(pkw, kw)
                if strength > best_strength:
                    best_strength = strength
                    best_profile_kw = pkw
                    best_method = method

            # If the explicit-skills lookup found nothing, fall back to
            # work-mention tokens at half-strength. We don't replace the
            # explicit match (still wins), just give a hint credit for
            # tech that the LLM-extracted skills list missed.
            if best_strength == 0 and work_mentions:
                # Re-run the score against the work-mention tokens
                for mention in work_mentions:
                    strength, method = _score_pair(mention, kw)
                    if strength > best_strength:
                        best_strength = strength * 0.5  # half-strength hint
                        best_profile_kw = mention
                        best_method = f"{method}+work-mention"

            detail = SkillMatch(
                required_skill=cat,
                required_keyword=kw,
                matched_keyword=best_profile_kw if best_strength > 0 else None,
                strength=round(best_strength, 3),
                match_method=best_method,  # L2 fix: telemetry attribute
            )
            all_strengths.append(best_strength)
            if best_strength > 0:
                matched.append(detail)
            else:
                missing.append(detail)

    # Preferred-skill nudges: if a profile keyword matches a preferred
    # category but missed all required keywords, add a small "matched" entry
    # so the FE shows it as a bonus (not a missing requirement).
    for pkw, _cat in profile_keywords:
        for (cat, kw) in preferred_keywords:
            strength, method = _score_pair(pkw, kw)
            if strength > 0:
                # Only add if this profile kw didn't already win any required match
                if not any(m.matched_keyword == pkw for m in matched):
                    matched.append(SkillMatch(
                        required_skill=f"{cat} (preferred)",
                        required_keyword=kw,
                        matched_keyword=pkw,
                        strength=round(strength * 0.5, 3),  # half-weight for preferred
                        match_method=method,  # L2 fix
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
        profile_skills, job_required, job_preferred,
        # Phase 10E: also feed work entries so the matcher can mine
        # tech mentions from highlights/descriptions for the half-
        # strength fallback (catches cases like "C#" / ".NET Core"
        # mentioned in work but missing from top-level skills).
        work_experiences=profile_experiences,
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