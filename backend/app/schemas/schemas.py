"""Pydantic schemas for API request/response — single source of truth.

DB models and API schemas are kept separate: models.py is for persistence,
schemas.py is for the HTTP contract. Validation happens here, not in code.

Field naming follows the same convention as models.py (snake_case fields,
Pydantic aliases can be added at the API boundary if needed).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator, model_validator


# ── Common sub-models ────────────────────────────────────────────────

class Skill(BaseModel):
    name: str
    level: Literal["beginner", "intermediate", "advanced", "expert"] | None = None
    years: float | None = None


class Experience(BaseModel):
    company: str
    title: str
    start: str  # YYYY-MM
    end: str | None = None  # YYYY-MM or "present"
    bullets: list[str] = Field(default_factory=list)
    tech: list[str] = Field(default_factory=list)


class Education(BaseModel):
    school: str
    degree: str | None = None
    field: str | None = None
    start: str | None = None
    end: str | None = None
    gpa: str | None = None


class Project(BaseModel):
    name: str
    description: str | None = None
    tech: list[str] = Field(default_factory=list)
    url: str | None = None


class Certification(BaseModel):
    name: str
    issuer: str | None = None
    date: str | None = None
    url: str | None = None


class Language(BaseModel):
    name: str
    level: Literal["beginner", "intermediate", "advanced", "native"] | None = None


# ── Profile / Base Profile ──────────────────────────────────────────

class ProfileIn(BaseModel):
    name: str
    title: str | None = None
    email: str
    phone: str | None = None
    location: str | None = None
    linkedin: HttpUrl | None = None
    github: HttpUrl | None = None
    portfolio: HttpUrl | None = None

    @field_validator("linkedin", "github", "portfolio", mode="before")
    @classmethod
    def _empty_str_url_to_none(cls, v: Any) -> Any:
        """Coerce empty/whitespace strings to None for URL fields.

        Empty inputs from optional form fields used to crash HttpUrl
        validation on BOTH the request and response paths. Coercing at
        field level (mode='before') runs before HttpUrl type-coercion so
        this fixes both directions.
        """
        if isinstance(v, str) and not v.strip():
            return None
        return v

    summary: str | None = None
    skills: list[Skill] = Field(default_factory=list)
    experiences: list[Experience] = Field(default_factory=list)
    education: list[Education] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    certifications: list[Certification] = Field(default_factory=list)
    languages: list[Language] = Field(default_factory=list)
    base_profile_json: dict[str, Any] = Field(default_factory=dict)
    preferences: dict[str, Any] = Field(default_factory=dict)


class ProfileOut(ProfileIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    confidence_score: float = 0.0
    ai_analysis_json: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ProfileVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    profile_id: str
    version_number: int
    change_summary: str
    created_at: datetime


# ── Resume upload ───────────────────────────────────────────────────

class ResumeUploadIn(BaseModel):
    file_name: str
    file_type: Literal["pdf", "docx"]
    file_size: int
    file_path: str


class ResumeUploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    file_name: str
    file_type: str
    file_size: int
    file_path: str
    status: str
    confidence_score: float = 0.0
    parsed_json: dict[str, Any] = Field(default_factory=dict)
    ai_analysis_json: dict[str, Any] = Field(default_factory=dict)
    error_message: str | None = None
    created_at: datetime


# ── Job ─────────────────────────────────────────────────────────────

class JobIn(BaseModel):
    source_type: Literal["url", "manual"]
    source_url: str | None = None
    # Optional: only required for 'manual' intake. The 'url' path scrapes
    # the JD and writes raw_description after the POST returns, so it
    # starts empty here. The API layer enforces the per-source_type rule.
    raw_description: str | None = None
    title: str | None = None
    company: str | None = None
    location: str | None = None
    remote: bool = False
    employment_type: str | None = None
    seniority: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str | None = None
    job_analysis_json: dict[str, Any] = Field(default_factory=dict)
    ats_keywords_json: dict[str, Any] = Field(default_factory=dict)


class JobOut(JobIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    status: str
    error_message: str | None = None
    parsed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    extractor_used: str | None = None


class JobListItem(BaseModel):
    """Slim shape returned by list_jobs — excludes raw_description.

    raw_description can be up to 50K characters per job, so shipping it
    in every list response bloats the payload (50 jobs × 50K = 2.5MB).
    Card-level rendering on the FE only needs the title/company/status
    fields, so we strip everything heavy from this view.
    """
    model_config = ConfigDict(from_attributes=True)
    id: str
    source_type: Literal["url", "manual"]
    source_url: str | None = None
    title: str | None = None
    company: str | None = None
    location: str | None = None
    remote: bool = False
    employment_type: str | None = None
    seniority: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str | None = None
    status: str
    error_message: str | None = None
    parsed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


# ── JSON Resume Job Description v1.0.0 (Phase 4) ─────────────────
#
# Industry-standard schema (https://jsonresume.org/job-description-schema/).
# The LLM analyzer is told to populate ONLY fields that are explicitly
# present in the JD — never invent. To keep the analyzer lenient, almost
# every field is optional, but ``title`` is required so a parsed job
# always has something meaningful to show. Enums gate ``remote_type``,
# ``employment_type``, and ``seniority`` so bad LLM output fails fast
# at validation time instead of poisoning downstream matching.

_REMOTE_TYPES = ("remote", "hybrid", "onsite")
_EMPLOYMENT_TYPES = ("full_time", "part_time", "contract", "internship")
_SENIORITIES = ("junior", "mid", "senior", "staff", "principal", "lead")


class SkillGroup(BaseModel):
    """One skill category with a list of keywords.

    Mirrors the JSON Resume ``skills[].keywords`` shape but flattens
    the surrounding object so the LLM has fewer places to slip up.
    """
    model_config = ConfigDict(extra="allow")
    name: str | None = None
    keywords: list[str] = Field(default_factory=list)


class SalaryRange(BaseModel):
    """Numeric salary band. Currency is the 3-letter ISO code."""
    min: int | None = None
    max: int | None = None
    currency: str | None = None


class JobAnalysisIn(BaseModel):
    """LLM output contract for ``analyze_jd``.

    Every section is optional; ``title`` is the only field we require
    because without it the UI has nothing to label the job by. Enum
    validators reject obviously-bad LLM guesses (e.g. ``seniority="guru"``).
    """
    model_config = ConfigDict(extra="allow")

    title: str
    company: str | None = None
    location: str | None = None
    remote_type: Literal["remote", "hybrid", "onsite"] | None = None
    employment_type: (
        Literal["full_time", "part_time", "contract", "internship"] | None
    ) = None
    seniority: (
        Literal["junior", "mid", "senior", "staff", "principal", "lead"] | None
    ) = None

    salary: SalaryRange | None = None

    summary: str | None = None
    responsibilities: list[str] = Field(default_factory=list)
    required_skills: list[SkillGroup] = Field(default_factory=list)
    preferred_skills: list[SkillGroup] = Field(default_factory=list)
    required_experience_years: int | None = None
    required_education: str | None = None

    # Flat list of ATS-relevant keywords (tech names, methodologies,
    # domain terms). Phase 5 matcher uses this for keyword overlap.
    ats_keywords: list[str] = Field(default_factory=list)


class JobAnalysisOut(JobAnalysisIn):
    """Persisted view: adds metadata fields populated by the analyzer.

    ``confidence_score`` is computed by the analyzer (fraction of
    expected sections that are non-empty). ``parsed_at`` is the UTC
    timestamp written when the Job row was finalized.
    """
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_id: str
    confidence_score: float = 0.0
    parsed_at: datetime | None = None


# ── Job Match ───────────────────────────────────────────────────────

class SkillMatchDetail(BaseModel):
    """One required skill → best profile match (or gap)."""
    required_skill: str          # category name from job (e.g. "Programming Languages")
    required_keyword: str        # specific keyword (e.g. "Java Spring Boot")
    matched_keyword: str | None = None   # profile skill that matched (None if missing)
    strength: float              # 0.0–1.0; 0 means no match found
    # L2 fix: which matcher branch produced this hit ("" | "exact" |
    # "substring" | "fuzzy"). Lets the FE group by strategy and lets
    # ops tune the thresholds later.
    match_method: str | None = None


class ExperienceBreakdown(BaseModel):
    required_years: int | None = None
    profile_years: int | None = None
    status: Literal["exceeds", "meets", "close", "below", "unknown"]


class SeniorityBreakdown(BaseModel):
    job_seniority: str | None = None
    profile_seniority: str | None = None
    status: Literal["match", "close", "mismatch", "unknown"]


class EducationBreakdown(BaseModel):
    required: str | None = None
    profile: str | None = None
    status: Literal["exceeds", "meets", "below", "unknown"]


class ScoreBreakdown(BaseModel):
    """Component scores (each 0.0–1.0) that combined give the overall."""
    skill: float
    experience: float
    seniority: float
    education: float


class LLMNarrative(BaseModel):
    """Optional LLM-generated narrative. None if narrator didn't run (or failed)."""
    summary: str | None = None
    strengths: list[str] = Field(default_factory=list)
    gaps: list[str] = Field(default_factory=list)


class JobMatchOut(BaseModel):
    """Phase 5 — match report between a parsed Job and the user's Profile.

    Stored across the existing JobMatch table columns; the semantic shape
    is enriched here so the FE gets a clean, documented contract.
    """
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_id: str
    profile_id: str

    # The headline number. 0.0 = no fit, 1.0 = perfect fit.
    match_score: float

    # Maps to the legacy ``risk_level`` column. Semantically inverted from
    # the old "low/medium/high chance of being screened out" meaning: here
    # we say what the user should do with the role.
    #   apply    → strong fit, go for it
    #   stretch  → partial fit, worth applying with effort
    #   skip     → too many gaps, not worth the time
    recommendation: Literal["apply", "stretch", "skip"]

    score_breakdown: ScoreBreakdown

    # Per-required-skill detail. Drives the strengths/gaps UI in MatchPanel.
    matched_skills: list[SkillMatchDetail] = Field(default_factory=list)
    missing_skills: list[SkillMatchDetail] = Field(default_factory=list)

    # Non-skill component breakdowns.
    experience: ExperienceBreakdown
    seniority: SeniorityBreakdown
    education: EducationBreakdown

    # LLM narrative — may be None if narrator failed or wasn't run.
    llm: LLMNarrative | None = None
    confidence_score: float | None = None

    # L2 fix: per-strategy hit counts. {"exact": N, "substring": N,
    # "fuzzy": N}. Always present (even on a 0% match).
    match_telemetry: dict[str, int] = Field(default_factory=dict)

    created_at: datetime
    updated_at: datetime | None = None


class JobMatchBrief(BaseModel):
    """Slim version for list endpoints (no per-skill detail)."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_id: str
    match_score: float
    recommendation: Literal["apply", "stretch", "skip"]
    score_breakdown: ScoreBreakdown
    created_at: datetime


# ── CV Draft ────────────────────────────────────────────────────────

class CVDraftIn(BaseModel):
    # job_id is optional: a CV can be a generic resume with no job target.
    job_id: str | None = None
    profile_id: str
    template_id: str = "ats_classic"
    title: str
    cv_json: dict[str, Any] = Field(default_factory=dict)


class CVDraftOut(CVDraftIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    rendered_html: str | None = None
    score: float = 0.0
    score_breakdown_json: dict[str, Any] = Field(default_factory=dict)
    status: Literal["draft", "ready", "exported"] = "draft"
    created_at: datetime
    updated_at: datetime


class CVRenderOut(BaseModel):
    """Rendered CV output (HTML or Markdown)."""

    cv_draft_id: str
    format: Literal["html", "markdown"]
    content: str
    sections: list[dict[str, Any]] = Field(default_factory=list)


class CVEnhanceIn(BaseModel):
    """Request body for LLM-enhanced section edit."""

    section: Literal["summary", "experience", "bullets", "skills"]
    # Index within experience list when section == "experience" or "bullets"
    experience_index: int | None = None
    # Optional job_id to pull target ATS keywords from
    target_job_id: str | None = None


class CVVersionOut(BaseModel):
    """A snapshot of a CV draft at a point in time.

    Returned by ``GET /api/cvs/{id}/versions`` so the FE can show a
    history sidebar (current, v2, v1, …). Restoring a version is a
    separate ``POST /api/cvs/{id}/versions/{version_id}/restore`` call.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    cv_draft_id: str
    version_number: int
    change_summary: str
    score: float
    created_at: datetime


class CVScoreRecommendation(BaseModel):
    """One prioritized, actionable improvement surfaced by the scorer.

    The FE renders these as cards with a "fix" CTA. ``id`` is a
    stable string (e.g. ``"add_skill:python"``) so the FE can
    key on it across re-renders.
    """
    id: str
    title: str
    impact: Literal["high", "med", "low"]
    axis: Literal["ats_coverage", "skill_gap", "bullet_strength", "format_safety"]
    details: str


class CVScoreOut(BaseModel):
    """Phase 7 — detailed CV score response.

    Returned by ``POST /api/cvs/{id}/score`` (and embedded in
    ``CVDraftOut.score_breakdown_json`` on every mutating endpoint).
    """

    model_config = ConfigDict(extra="forbid")

    cv_id: str
    overall: float
    axes: dict[str, dict[str, Any]] = Field(default_factory=dict)
    matched_keywords: list[str] = Field(default_factory=list)
    missing_keywords: list[str] = Field(default_factory=list)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    recommendations: list[CVScoreRecommendation] = Field(default_factory=list)
    scored_at: datetime

    # F3 fix: the FE TS interface declares
    # ``axes: Record<CVScoreAxis, CVScoreAxisData>`` (strict 4 keys).
    # Pydantic can't natively type dict keys with Literal, so enforce
    # the four known axes must all be present at validation time —
    # closes the FE/BE type-mismatch gap (the FE hydration fallback
    # was hand-rolling the four axes because the type didn't help).
    # The scorer always returns all four (see ``score_cv``), so this
    # only fires on truly malformed input.
    @model_validator(mode="after")
    def _axes_have_all_known_keys(self) -> "CVScoreOut":
        required = {"ats_coverage", "skill_gap", "bullet_strength", "format_safety"}
        missing = required - set(self.axes.keys())
        if missing:
            raise ValueError(
                f"CVScoreOut.axes missing required keys: {sorted(missing)}"
            )
        return self


class CVRecommendationItem(BaseModel):
    """Phase 7 — one CV×job pair surfaced by the recommendation engine.

    Combines the match score (Phase 5) with the CV score (Phase 7) so
    the FE can show "Best matches for your CV" without two separate
    API round-trips.
    """
    cv_id: str
    cv_title: str
    job_id: str
    job_title: str
    company: str | None = None
    match_score: float
    cv_score: float
    composite: float  # 0.6 * match_score + 0.4 * cv_score
    recommendation: Literal["apply", "stretch", "skip"]
    missing_skills: list[str] = Field(default_factory=list)


# ── Cover Letter ────────────────────────────────────────────────────

class CoverLetterIn(BaseModel):
    job_id: str
    profile_id: str
    cv_draft_id: str | None = None
    tone: Literal["professional", "confident", "friendly", "concise", "formal"] = "professional"
    subject: str | None = None
    content: str
    personalization_points: list[str] = Field(default_factory=list)
    job_keywords_used: list[str] = Field(default_factory=list)


# H5 fix (Phase 9 review): separate PATCH schema with optional fields
# (no required job_id / profile_id / content) and a status field the
# create schema doesn't carry. Lets the PATCH endpoint validate enum
# values at the framework boundary instead of via hand-rolled checks.
# ``extra='forbid'`` rejects unknown keys (test_patch_rejects_unknown_keys).
class CoverLetterPatchIn(BaseModel):
    model_config = {"extra": "forbid"}
    tone: Literal["professional", "confident", "friendly", "concise", "formal"] | None = None
    status: Literal["draft", "ready", "exported"] | None = None
    subject: str | None = None
    content: str | None = None
    personalization_points: list[str] | None = None
    job_keywords_used: list[str] | None = None


class CoverLetterOut(CoverLetterIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    score: float = 0.0
    score_breakdown_json: dict[str, Any] = Field(default_factory=dict)
    status: Literal["draft", "ready", "exported"] = "draft"
    created_at: datetime
    updated_at: datetime


# ── Export ──────────────────────────────────────────────────────────

class ExportIn(BaseModel):
    entity_type: Literal["cv", "cover_letter"]
    entity_id: str
    cv_draft_id: str | None = None
    cover_letter_id: str | None = None
    # B2 fix: 'failed' is a real value (renderer failure path). The
    # /export endpoint persists a failed row so the history sidebar
    # shows the failure instead of an invisible 500.
    file_type: Literal["pdf", "docx", "failed"] = "pdf"
    file_path: str
    file_size: int
    # B10 fix: content hash of the actual returned bytes.
    sha256: str | None = None


class ExportOut(ExportIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    user_id: str
    created_at: datetime


# ── Scrape ──────────────────────────────────────────────────────────

class ScrapeTriggerIn(BaseModel):
    source: str
    keyword: str | None = None
    max_pages: int = 3


class ScrapeRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    source: str
    started_at: datetime
    finished_at: datetime | None
    status: str
    jobs_added: int
    jobs_updated: int
    pages_fetched: int
    error: str | None = None


# ── Settings (LLM) ──────────────────────────────────────────────────

class LLMSettingsUpdate(BaseModel):
    provider_id: str
    enabled: bool | None = None
    priority: int | None = None


class LLMSettingsOut(BaseModel):
    providers: list[dict[str, Any]]
    default_provider: str


# ── Cost dashboard ──────────────────────────────────────────────────

class CostBucketItem(BaseModel):
    """One bucket for cost rollups: total cost + call count + success rate."""

    key: str
    cost_usd: float
    calls: int
    successes: int
    avg_latency_ms: float | None = None


class CostDailyItem(BaseModel):
    """One day in the daily cost trend."""

    date: str  # ISO date YYYY-MM-DD
    cost_usd: float
    calls: int


class CostSummaryOut(BaseModel):
    """Aggregated cost view over the requested window."""

    window_days: int
    total_cost_usd: float
    total_calls: int
    success_calls: int
    success_rate: float  # 0..1
    avg_cost_per_call_usd: float
    avg_latency_ms: float | None
    by_provider: list[CostBucketItem]
    by_model: list[CostBucketItem]
    by_task_type: list[CostBucketItem]
    daily: list[CostDailyItem]


class RecentCallOut(BaseModel):
    """Single LLM call row for the recent-calls table."""

    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    task_type: str
    provider: str
    model: str
    success: bool
    input_tokens: int | None
    output_tokens: int | None
    cost_usd: float | None
    latency_ms: int | None
    error: str | None = None


# ── Templates ───────────────────────────────────────────────────────

# Phase 10A: template styling options surfaced as Pydantic Literals
# so the API rejects bad input before it reaches the renderer.
# Mirrors the constants in app.services.cv_renderer.

from typing import Literal  # noqa: E402  (kept here for local clarity)

FontFamilyLiteral = Literal["serif", "sans", "mono"]
DensityLiteral = Literal["compact", "normal", "spacious"]
BulletStyleLiteral = Literal["dash", "bullet", "arrow"]
DateFormatLiteral = Literal["Mon YYYY", "MM/YYYY", "YYYY"]
PageSizeLiteral = Literal["A4", "Letter"]


class TemplateListItem(BaseModel):
    """Slim template summary for list endpoints (no full config)."""

    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    type: str
    description: str
    is_ats_friendly: bool
    is_default: bool
    created_at: datetime


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    type: str
    description: str
    template_config_json: dict[str, Any] = Field(default_factory=dict)
    is_ats_friendly: bool
    is_default: bool
    created_at: datetime


class TemplateCreateIn(BaseModel):
    """Create a new custom template. Built-in presets are read-only —
    POST always creates a new ``user:*`` id. Idempotent on (id) — if
    a row already exists with that id we return 409."""

    model_config = ConfigDict(extra="forbid")
    id: str = Field(..., min_length=3, max_length=40, pattern=r"^[a-z0-9_\-]+$")
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=2000)
    type: Literal["cv", "cover_letter"] = "cv"
    sections: list[str] = Field(default_factory=list)
    font_family: FontFamilyLiteral = "sans"
    accent_color: str = "#111111"
    density: DensityLiteral = "normal"
    bullet_style: BulletStyleLiteral = "dash"
    date_format: DateFormatLiteral = "Mon YYYY"
    page_size: PageSizeLiteral = "A4"
    is_ats_friendly: bool = True


class TemplatePatchIn(BaseModel):
    """Partial template update. All fields optional. ``id`` is NOT
    patchable — create a new template instead."""

    model_config = ConfigDict(extra="forbid")
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    sections: list[str] | None = None
    font_family: FontFamilyLiteral | None = None
    accent_color: str | None = None
    density: DensityLiteral | None = None
    bullet_style: BulletStyleLiteral | None = None
    date_format: DateFormatLiteral | None = None
    page_size: PageSizeLiteral | None = None
    is_ats_friendly: bool | None = None


class TemplatePreviewIn(BaseModel):
    """Render a template config against a profile (dry run, no DB write).

    Used by the FE ``Create Template`` form to show live preview as
    the user edits fields.
    """

    model_config = ConfigDict(extra="forbid")
    profile_id: str | None = None
    cv_json: dict[str, Any] | None = None
    template_config_json: dict[str, Any] = Field(default_factory=dict)


class TemplatePreviewOut(BaseModel):
    rendered_html: str
    config_used: dict[str, Any] = Field(default_factory=dict)


# ── AI Prompts ──────────────────────────────────────────────────────

class AIPromptIn(BaseModel):
    name: str
    category: str
    prompt_text: str
    version: int = 1
    is_default: bool = True


class AIPromptOut(AIPromptIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


class AIPromptTestIn(BaseModel):
    prompt_id: str | None = None
    prompt_text: str
    test_input: dict[str, Any] = Field(default_factory=dict)


class AIPromptTestOut(BaseModel):
    output: str
    parsed: Any = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    cost_usd: float | None = None
    latency_ms: int | None = None


# ── Application tracking ───────────────────────────────────────────

ApplicationStatus = Literal["draft", "ready", "applied", "interview", "rejected", "offer"]


class ApplicationIn(BaseModel):
    job_id: str
    cv_draft_id: str | None = None
    cover_letter_id: str | None = None
    status: ApplicationStatus = "draft"
    applied_date: datetime | None = None
    follow_up_date: datetime | None = None
    contact_person: str | None = None
    contact_email: str | None = None
    notes: str | None = None


# H5 fix (Phase 9 review): separate PATCH schema with optional fields
# (no required job_id) so the PATCH endpoint validates enum values at
# the framework boundary. Previously accepted ``dict[str, Any]`` and
# ``setattr(app, "status", value)`` would persist any string,
# bypassing the ApplicationStatus Literal.
class ApplicationPatchIn(BaseModel):
    model_config = {"extra": "forbid"}
    cv_draft_id: str | None = None
    cover_letter_id: str | None = None
    status: ApplicationStatus | None = None
    applied_date: datetime | None = None
    follow_up_date: datetime | None = None
    contact_person: str | None = None
    contact_email: str | None = None
    notes: str | None = None


# L1 fix (Phase 9 review): removed PaginatedList wrapper. Returning
# a wrapped {items, total} would be a breaking API change for the FE.
# Instead, the list endpoints expose the same default limit
# (limit=100 for applications, limit=500 for jobs) the FE requests
# in bulk. The FE can fall back to "showing all N" once the data
# set fits the default. If the user grows past the default, we can
# add pagination later.
class ApplicationOut(ApplicationIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime
    updated_at: datetime


# ── Project (lite) ──────────────────────────────────────────────────

class ProjectBrief(BaseModel):
    """A short project summary used in CV preview, matching output, etc."""
    model_config = ConfigDict(from_attributes=True)
    name: str
    description: str | None = None
    tech: list[str] = Field(default_factory=list)


# ── JSON Resume v1.0.0 — BaseProfile (Phase 2) ─────────────────────
#
# Industry-standard schema (https://jsonresume.org/schema/). The LLM
# parser is told to populate ONLY fields that are explicitly present in
# the resume text — never invent. To keep the parser lenient, every
# section is optional, but ``basics.email`` must validate as an email
# when ``basics`` is present. Models here are used both as the LLM
# output contract AND as the response shape for /api/profile.


class BasicsLocation(BaseModel):
    """Nested location object inside ``basics``."""
    model_config = ConfigDict(extra="allow")
    city: str | None = None
    region: str | None = None
    country: str | None = None
    countryCode: str | None = None
    address: str | None = None


class BasicsProfile(BaseModel):
    """One social/portfolio profile entry inside ``basics.profiles``."""
    model_config = ConfigDict(extra="allow")
    network: str | None = None
    username: str | None = None
    url: str | None = None


class BasicsSchema(BaseModel):
    """Top-level contact info block — required to have a valid email
    when present at all (downstream matcher relies on it)."""
    model_config = ConfigDict(extra="allow")
    name: str | None = None
    label: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    url: str | None = None
    summary: str | None = None
    location: BasicsLocation | None = None
    profiles: list[BasicsProfile] = Field(default_factory=list)


class WorkEntry(BaseModel):
    """One work-experience row."""
    model_config = ConfigDict(extra="allow")
    name: str | None = None           # company
    position: str | None = None
    location: str | None = None
    description: str | None = None
    startDate: str | None = None      # YYYY-MM or YYYY-MM-DD
    endDate: str | None = None        # YYYY-MM, YYYY-MM-DD, or null for current
    highlights: list[str] = Field(default_factory=list)
    url: str | None = None


class EducationEntry(BaseModel):
    """One education row."""
    model_config = ConfigDict(extra="allow")
    institution: str | None = None
    url: str | None = None
    area: str | None = None           # field of study
    studyType: str | None = None      # "Bachelor", "Master", etc.
    startDate: str | None = None
    endDate: str | None = None
    score: str | None = None
    courses: list[str] = Field(default_factory=list)


class SkillEntry(BaseModel):
    """One skill row — typically a category (e.g. "Backend") with keywords."""
    model_config = ConfigDict(extra="allow")
    name: str | None = None
    level: str | None = None
    keywords: list[str] = Field(default_factory=list)


class ProjectEntry(BaseModel):
    """One project row."""
    model_config = ConfigDict(extra="allow")
    name: str | None = None
    description: str | None = None
    highlights: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    startDate: str | None = None
    endDate: str | None = None
    url: str | None = None
    roles: list[str] = Field(default_factory=list)
    entity: str | None = None
    type: str | None = None


class CertificateEntry(BaseModel):
    """One certificate row."""
    model_config = ConfigDict(extra="allow")
    name: str | None = None
    date: str | None = None
    issuer: str | None = None
    url: str | None = None


class LanguageEntry(BaseModel):
    """One language row."""
    model_config = ConfigDict(extra="allow")
    language: str | None = None
    fluency: str | None = None


class InterestEntry(BaseModel):
    """One interest/hobby row."""
    model_config = ConfigDict(extra="allow")
    name: str | None = None
    keywords: list[str] = Field(default_factory=list)


class ReferenceEntry(BaseModel):
    """One reference row."""
    model_config = ConfigDict(extra="allow")
    name: str | None = None
    reference: str | None = None


class AwardEntry(BaseModel):
    """One award row."""
    model_config = ConfigDict(extra="allow")
    title: str | None = None
    date: str | None = None
    awarder: str | None = None
    summary: str | None = None


class PublicationEntry(BaseModel):
    """One publication row."""
    model_config = ConfigDict(extra="allow")
    name: str | None = None
    publisher: str | None = None
    releaseDate: str | None = None
    url: str | None = None
    summary: str | None = None


class VolunteerEntry(BaseModel):
    """One volunteer row."""
    model_config = ConfigDict(extra="allow")
    organization: str | None = None
    position: str | None = None
    url: str | None = None
    startDate: str | None = None
    endDate: str | None = None
    summary: str | None = None
    highlights: list[str] = Field(default_factory=list)


class BaseProfileSchema(BaseModel):
    """Top-level JSON Resume v1.0.0 schema.

    Every section is optional — a sparse resume (e.g. only basics + email)
    must still validate. When ``basics`` is provided, ``basics.email`` is
    required and must look like an email. This is the LLM's output
    contract; downstream code should treat any unexpected field as
    best-effort metadata.
    """
    model_config = ConfigDict(extra="allow")

    basics: BasicsSchema | None = None
    work: list[WorkEntry] = Field(default_factory=list)
    education: list[EducationEntry] = Field(default_factory=list)
    skills: list[SkillEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    certificates: list[CertificateEntry] = Field(default_factory=list)
    languages: list[LanguageEntry] = Field(default_factory=list)
    interests: list[InterestEntry] = Field(default_factory=list)
    references: list[ReferenceEntry] = Field(default_factory=list)
    awards: list[AwardEntry] = Field(default_factory=list)
    publications: list[PublicationEntry] = Field(default_factory=list)
    volunteer: list[VolunteerEntry] = Field(default_factory=list)

    @model_validator(mode="after")
    def _require_basics_email_when_basics_present(self) -> "BaseProfileSchema":
        """If basics was extracted, it must have a valid email."""
        if self.basics is not None and not self.basics.email:
            raise ValueError("basics.email is required when basics is present")
        return self


# Convenience: how many "expected sections" exist for confidence scoring.
# Used by resume_parser.compute_confidence().
BASE_PROFILE_SECTIONS: tuple[str, ...] = (
    "basics", "work", "education", "skills", "projects",
    "certificates", "languages",
)
