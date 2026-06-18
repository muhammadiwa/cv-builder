"""Pydantic schemas for API request/response — single source of truth.

DB models and API schemas are kept separate: models.py is for persistence,
schemas.py is for the HTTP contract. Validation happens here, not in code.

Field naming follows the same convention as models.py (snake_case fields,
Pydantic aliases can be added at the API boundary if needed).
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


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
