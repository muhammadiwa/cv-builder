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
    raw_description: str
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

class JobMatchIn(BaseModel):
    job_id: str
    profile_id: str


class JobMatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    job_id: str
    profile_id: str
    match_score: float
    risk_level: Literal["low", "medium", "high"]
    score_breakdown_json: dict[str, Any] = Field(default_factory=dict)
    matched_items_json: list[Any] = Field(default_factory=list)
    missing_items_json: list[Any] = Field(default_factory=list)
    strategy_json: dict[str, Any] = Field(default_factory=dict)
    recommendations_json: list[Any] = Field(default_factory=list)
    created_at: datetime


# ── CV Draft ────────────────────────────────────────────────────────

class CVDraftIn(BaseModel):
    job_id: str
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
    file_type: Literal["pdf", "docx"]
    file_path: str
    file_size: int


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
