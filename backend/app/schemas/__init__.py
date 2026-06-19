"""Pydantic schemas for API requests/responses.

Single barrel that re-exports every schema from ``schemas.py`` so callers can
do ``from app.schemas import JobIn, JobOut, ...`` without caring about the
internal module structure. Only names defined in ``schemas.py`` are exported
— model classes (CVDraft, Profile, Job, etc.) live in ``app.models`` and are
NOT re-exported here.
"""
from app.schemas.schemas import (  # noqa: F401
    # Common sub-models
    Certification,
    Education,
    Experience,
    Language,
    Project,
    Skill,
    ProjectBrief,
    # JSON Resume v1.0.0 (Phase 2)
    BASE_PROFILE_SECTIONS,
    BaseProfileSchema,
    BasicsLocation,
    BasicsProfile,
    BasicsSchema,
    CertificateEntry,
    EducationEntry,
    InterestEntry,
    LanguageEntry,
    ProjectEntry,
    PublicationEntry,
    ReferenceEntry,
    AwardEntry,
    SkillEntry,
    VolunteerEntry,
    WorkEntry,
    # Profile / Base Profile
    ProfileIn,
    ProfileOut,
    ProfileVersionOut,
    # Resume upload
    ResumeUploadIn,
    ResumeUploadOut,
    # Job
    JobIn,
    JobOut,
    # Job Match
    JobMatchIn,
    JobMatchOut,
    # CV Draft
    CVDraftIn,
    CVDraftOut,
    # Cover Letter
    CoverLetterIn,
    CoverLetterOut,
    # Export
    ExportIn,
    ExportOut,
    # Scrape
    ScrapeTriggerIn,
    ScrapeRunOut,
    # Settings
    LLMSettingsOut,
    LLMSettingsUpdate,
    # Cost dashboard
    CostBucketItem,
    CostDailyItem,
    CostSummaryOut,
    RecentCallOut,
    # Templates
    TemplateOut,
    # AI Prompts
    AIPromptIn,
    AIPromptOut,
    AIPromptTestIn,
    AIPromptTestOut,
    # Application tracking
    ApplicationStatus,
    ApplicationIn,
    ApplicationOut,
)
