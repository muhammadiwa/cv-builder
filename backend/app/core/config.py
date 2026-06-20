"""Application configuration via environment variables + .env file.

Single source of truth. All other modules import ``get_settings()`` which
caches a single ``Settings`` instance per process.

Conventions:
- All env vars prefixed with ``CV_`` (project namespace).
- SecretStr for anything sensitive (API keys, master key).
- Field validation happens in Pydantic, not in code.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="CV_",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── Core ────────────────────────────────────────────────────────
    app_name: str = "AI CV ATS Builder"
    app_version: str = "0.1.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # ── Server ─────────────────────────────────────────────────────
    host: str = "127.0.0.1"
    port: int = 8765
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    # ── Rate limiting (Phase 9C) ─────────────────────────────────
    # Per-IP requests/minute cap. In-memory, single-process. For multi-worker
    # prod deployments, swap RateLimitMiddleware for a Redis-backed limiter.
    rate_limit_rpm: int = 60

    # ── Storage ────────────────────────────────────────────────────
    storage_dir: Path = Path("./storage")
    database_url: str = "sqlite:///./storage/cv_builder.db"
    upload_dir: Path = Path("./storage/uploads")
    cv_export_dir: Path = Path("./storage/cv_exports")
    cl_export_dir: Path = Path("./storage/cl_exports")
    raw_html_dir: Path = Path("./storage/raw_html")
    prompts_dir: Path = Path("./storage/prompts")
    templates_dir: Path = Path("./storage/templates")
    log_dir: Path = Path("./storage/logs")

    # ── Security ───────────────────────────────────────────────────
    # Fernet 32-byte key for encrypting user data at rest.
    # The default value (matched by crypto._DEV_PLACEHOLDER) signals dev
    # mode and triggers a loud plaintext-storage warning on first use.
    # For production, generate a real key with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    master_key: SecretStr = Field(
        default=SecretStr("dev-only-please-rotate-in-production"),
        description="Fernet 32-byte key for encrypting user data at rest.",
    )

    # ── LLM providers (tokenrouter is primary, multi-provider fallback) ─
    llm_providers_config: Path = Path("../configs/llm_providers.json")
    default_llm_provider: str = "tokenrouter"
    llm_request_timeout: int = 120
    llm_max_retries: int = 2

    # ── File handling ──────────────────────────────────────────────
    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MB
    allowed_upload_mime: tuple[str, ...] = (
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    )

    # ── Scraping ───────────────────────────────────────────────────
    scraper_user_agent: str = (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 "
        "(cv-ats-builder/0.1.0; +https://github.com/local/cv-ats-builder)"
    )
    scraper_respect_robots: bool = True
    scraper_request_timeout: int = 30
    scraper_cache_ttl_hours: int = 24

    def model_post_init(self, __context):
        # Ensure all storage subdirectories exist on first import.
        for d in (
            self.storage_dir,
            self.upload_dir,
            self.cv_export_dir,
            self.cl_export_dir,
            self.raw_html_dir,
            self.prompts_dir,
            self.templates_dir,
            self.log_dir,
        ):
            d.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor — single instance per process."""
    return Settings()
