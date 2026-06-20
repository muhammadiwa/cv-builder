"""ORM models — single source of truth for the database schema.

Designed for personal use (one user), so no multi-tenancy, no row-level
security. All IDs are UUID strings (cross-DB safe). JSON columns store
flexible structured data (resume sections, match reports, etc.).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _new_id() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── User (single-user mode, but kept for future expansion) ────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    profiles: Mapped[list["Profile"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    resume_uploads: Mapped[list["ResumeUpload"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    jobs: Mapped[list["Job"]] = relationship(back_populates="user", cascade="all, delete-orphan")


# ── Profile / Base Profile ────────────────────────────────────────────
class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))

    name: Mapped[str] = mapped_column(String(200))
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    linkedin: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github: Mapped[str | None] = mapped_column(String(500), nullable=True)
    portfolio: Mapped[str | None] = mapped_column(String(500), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Structured JSON blobs (validated at the API layer)
    base_profile_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    ai_analysis_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user: Mapped["User"] = relationship(back_populates="profiles")
    versions: Mapped[list["ProfileVersion"]] = relationship(back_populates="profile", cascade="all, delete-orphan")
    cv_drafts: Mapped[list["CVDraft"]] = relationship(back_populates="profile", cascade="all, delete-orphan")


class ProfileVersion(Base):
    __tablename__ = "profile_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"))
    version_number: Mapped[int] = mapped_column(Integer)
    data_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    change_summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    profile: Mapped["Profile"] = relationship(back_populates="versions")


# ── Resume upload + parse result ──────────────────────────────────────
class ResumeUpload(Base):
    __tablename__ = "resume_uploads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))

    file_name: Mapped[str] = mapped_column(String(500))
    file_type: Mapped[str] = mapped_column(String(50))  # pdf, docx
    file_path: Mapped[str] = mapped_column(String(1000))
    file_size: Mapped[int] = mapped_column(Integer)

    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    parsed_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    ai_analysis_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)

    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | parsing | parsed | failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="resume_uploads")


# ── Jobs (input + analysis) ──────────────────────────────────────────
class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))

    source_type: Mapped[str] = mapped_column(String(20))  # url | manual
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    raw_description: Mapped[str] = mapped_column(Text)

    title: Mapped[str | None] = mapped_column(String(500), nullable=True, index=True)
    company: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    remote: Mapped[bool] = mapped_column(default=False)
    employment_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    seniority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_currency: Mapped[str | None] = mapped_column(String(8), nullable=True)

    # Which HTML extractor succeeded for URL-sourced jobs: "selectolax" |
    # "trafilatura" | "beautifulsoup". Nullable for manual-paste jobs that
    # never went through the scraper. Useful for debugging scrape quality
    # without re-running the extractor.
    extractor_used: Mapped[str | None] = mapped_column(String(32), nullable=True)

    job_analysis_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    ats_keywords_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    status: Mapped[str] = mapped_column(String(20), default="pending")
    # parse_status is the public field name (per plan); keep status as the
    # underlying column to avoid a schema migration. New code reads/writes
    # status, older callers (if any) can alias to parse_status in the API.
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
    # Timestamp set when the analyzer flips the row to status='parsed'.
    # Latent gap: jd_analyzer.py was assigning this attribute pre-Phase-4-FE
    # but no column existed, so it never persisted. Adding it now so the
    # parsed_at assertion in tests + the API response actually round-trip.
    parsed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Soft-delete: list endpoint filters where deleted_at IS NULL.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Dedup: a (user, source_url) pair is unique while not soft-deleted.
    # We index it so the API layer can do a fast pre-check before insert
    # (cheaper than catching IntegrityError post-hoc).
    __table_args__ = (
        Index(
            "ix_jobs_user_source_url_active",
            "user_id", "source_url",
            unique=True,
            sqlite_where=text("deleted_at IS NULL AND source_url IS NOT NULL"),
        ),
    )

    user: Mapped["User"] = relationship(back_populates="jobs")
    matches: Mapped[list["JobMatch"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    cv_drafts: Mapped[list["CVDraft"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    cover_letters: Mapped[list["CoverLetter"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    applications: Mapped[list["Application"]] = relationship(back_populates="job", cascade="all, delete-orphan")


# ── Match report (deterministic + LLM narrative) ──────────────────────
class JobMatch(Base):
    __tablename__ = "job_matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"))
    profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"))

    match_score: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(20))  # high | medium | low chance screening

    score_breakdown_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    matched_items_json: Mapped[list[Any]] = mapped_column(JSON, default=list)
    missing_items_json: Mapped[list[Any]] = mapped_column(JSON, default=list)
    strategy_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    recommendations_json: Mapped[list[Any]] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    job: Mapped["Job"] = relationship(back_populates="matches")


# ── CV draft + versions + recommendations ────────────────────────────
class CVDraft(Base):
    __tablename__ = "cv_drafts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    # Nullable: CV drafts can exist without being targeted at a job
    # (generic resume) and the FE can detach via PATCH {job_id: null}.
    job_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True
    )
    profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"))

    template_id: Mapped[str] = mapped_column(String(40), default="ats_classic")
    title: Mapped[str] = mapped_column(String(500))
    cv_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    rendered_html: Mapped[str | None] = mapped_column(Text, nullable=True)

    score: Mapped[float] = mapped_column(Float, default=0.0)
    score_breakdown_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | ready | exported

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    job: Mapped["Job"] = relationship(back_populates="cv_drafts")
    profile: Mapped["Profile"] = relationship(back_populates="cv_drafts")
    versions: Mapped[list["CVVersion"]] = relationship(back_populates="cv_draft", cascade="all, delete-orphan")
    recommendations: Mapped[list["CVRecommendation"]] = relationship(back_populates="cv_draft", cascade="all, delete-orphan")
    exports: Mapped[list["Export"]] = relationship(back_populates="cv_draft", cascade="all, delete-orphan")

    # B11 fix: defense-in-depth — the scorer already clamps to [0, 1]
    # in code (see ``score_cv``), but a CHECK constraint stops any
    # future caller from writing a NaN, inf, or out-of-band value
    # directly. SQLite supports CHECK via the dialect, Postgres enforces
    # it server-side.
    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 1", name="cv_drafts_score_range"),
    )


class CVVersion(Base):
    __tablename__ = "cv_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    cv_draft_id: Mapped[str] = mapped_column(String(36), ForeignKey("cv_drafts.id", ondelete="CASCADE"))
    version_number: Mapped[int] = mapped_column(Integer)
    cv_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    change_summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    cv_draft: Mapped["CVDraft"] = relationship(back_populates="versions")

    __table_args__ = (
        CheckConstraint("score >= 0 AND score <= 1", name="cv_versions_score_range"),
    )


class CVRecommendation(Base):
    __tablename__ = "cv_recommendations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    cv_draft_id: Mapped[str] = mapped_column(String(36), ForeignKey("cv_drafts.id", ondelete="CASCADE"))

    type: Mapped[str] = mapped_column(String(50))  # summary | skill_order | bullet_rewrite | missing_keyword | section_order | ats_format
    priority: Mapped[str] = mapped_column(String(10))  # high | medium | low
    reason: Mapped[str] = mapped_column(Text)
    before_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_score_impact: Mapped[float] = mapped_column(Float, default=0.0)
    safe_to_apply: Mapped[bool] = mapped_column(default=True)
    applied: Mapped[bool] = mapped_column(default=False)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    cv_draft: Mapped["CVDraft"] = relationship(back_populates="recommendations")


# ── Cover Letter ─────────────────────────────────────────────────────
class CoverLetter(Base):
    __tablename__ = "cover_letters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"))
    profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("profiles.id", ondelete="CASCADE"))
    cv_draft_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cv_drafts.id", ondelete="SET NULL"), nullable=True)

    tone: Mapped[str] = mapped_column(String(20), default="professional")  # professional | confident | friendly | concise | formal
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    personalization_points: Mapped[list[str]] = mapped_column(JSON, default=list)
    job_keywords_used: Mapped[list[str]] = mapped_column(JSON, default=list)
    score: Mapped[float] = mapped_column(Float, default=0.0)
    score_breakdown_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="draft")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    job: Mapped["Job"] = relationship(back_populates="cover_letters")
    exports: Mapped[list["Export"]] = relationship(back_populates="cover_letter", cascade="all, delete-orphan")


# ── Exports (PDF / DOCX) ────────────────────────────────────────────
class Export(Base):
    __tablename__ = "exports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))

    entity_type: Mapped[str] = mapped_column(String(20))  # cv | cover_letter
    entity_id: Mapped[str] = mapped_column(String(36))
    cv_draft_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cv_drafts.id", ondelete="SET NULL"), nullable=True)
    cover_letter_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cover_letters.id", ondelete="SET NULL"), nullable=True)

    file_type: Mapped[str] = mapped_column(String(10))  # pdf | docx
    file_path: Mapped[str] = mapped_column(String(1000))
    file_size: Mapped[int] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    cv_draft: Mapped["CVDraft | None"] = relationship(back_populates="exports", foreign_keys=[cv_draft_id])
    cover_letter: Mapped["CoverLetter | None"] = relationship(back_populates="exports", foreign_keys=[cover_letter_id])


# ── Templates ────────────────────────────────────────────────────────
class Template(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    type: Mapped[str] = mapped_column(String(20))  # cv | cover_letter
    description: Mapped[str] = mapped_column(Text)
    template_config_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    is_ats_friendly: Mapped[bool] = mapped_column(default=True)
    is_default: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


# ── AI Prompt Manager ───────────────────────────────────────────────
class AIPrompt(Base):
    __tablename__ = "ai_prompts"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(50))
    prompt_text: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_default: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


# ── Application tracking ────────────────────────────────────────────
class Application(Base):
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"))
    cv_draft_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cv_drafts.id", ondelete="SET NULL"), nullable=True)
    cover_letter_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cover_letters.id", ondelete="SET NULL"), nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | ready | applied | interview | rejected | offer
    applied_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    follow_up_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    job: Mapped["Job"] = relationship(back_populates="applications")


# ── LLM call log (cost tracking) ─────────────────────────────────────
class LLMCallLog(Base):
    __tablename__ = "llm_call_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    task_type: Mapped[str] = mapped_column(String(40), index=True)  # resume_parse | job_analyze | match | cv_generate | cv_score | improvement | cover_letter
    provider: Mapped[str] = mapped_column(String(40))
    model: Mapped[str] = mapped_column(String(80))
    prompt_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    prompt_version: Mapped[int] = mapped_column(Integer, default=1)
    input_hash: Mapped[str] = mapped_column(String(64), index=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    success: Mapped[bool] = mapped_column(default=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
