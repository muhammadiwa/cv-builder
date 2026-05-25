# Story 1.3: Database Schema & Migrations

**Status:** ready-for-dev
**Epic:** 1 — Foundation, Auth & Infrastructure
**Created:** 2026-05-25

---

## User Story

As a developer,
I want the PostgreSQL database schema created with all 14 tables and pgvector extension,
So that data persistence is ready for all features.

---

## Acceptance Criteria

**AC-1:** Given a running PostgreSQL instance, When `prisma migrate deploy` runs, Then all tables (`users`, `user_profiles`, `resumes`, `resume_sections`, `resume_versions`, `templates`, `ai_sessions`, `cover_letters`, `job_analyses`, `subscriptions`, `ai_credits`, `ai_usage_logs`, `export_jobs`, `share_links`) are created.

**AC-2:** And pgvector extension is enabled with HNSW indexing.

**AC-3:** And GIN indexes on JSONB columns are created.

**AC-4:** And Prisma client is generated and importable from `packages/database`.

**AC-5:** And seed script inserts 3 default ATS-safe templates.

---

## Developer Context

### Prisma Schema — Full Models

The schema file at `packages/database/src/schema.prisma` must be updated with all models. Database: PostgreSQL 16 with `pgvector` extension. All tables use `snake_case` naming. UUID primary keys. Timestamps on all tables.

### Architecture Compliance

**Model list (14 tables):**

1. `users` — id (UUID), email, phone, password_hash, auth_provider, language_preference, created_at, updated_at
2. `user_profiles` — id (UUID), user_id (FK→users), full_name, headline, location, linkedin_url, website, photo_url, bio
3. `resumes` — id (UUID), user_id (FK→users), title, template_id (FK→templates), language, status (draft/published/archived), ats_score, created_at, updated_at
4. `resume_sections` — id (UUID), resume_id (FK→resumes), section_type (enum), display_order, content (JSONB), ai_generated, created_at, updated_at
5. `resume_versions` — id (UUID), resume_id (FK→resumes), version_number, snapshot (JSONB), created_at
6. `templates` — id (UUID), name, category, thumbnail_url, config (JSONB), is_premium, is_active, locale, created_at
7. `ai_sessions` — id (UUID), user_id (FK→users), resume_id (FK→resumes, nullable), session_type (enum), status (enum), conversation_history (JSONB), extracted_data (JSONB), token_usage, expires_at, created_at
8. `cover_letters` — id (UUID), user_id (FK→users), resume_id (FK→resumes), job_title, company_name, job_description, tone, content (JSONB), created_at
9. `job_analyses` — id (UUID), user_id (FK→users), resume_id (FK→resumes), job_description, match_percentage, keyword_analysis (JSONB), gap_analysis (JSONB), suggestions (JSONB), embedding (vector(1536)), created_at
10. `subscriptions` — id (UUID), user_id (FK→users), plan_tier, status, payment_method, xendit_invoice_id, current_period_start, current_period_end, created_at
11. `ai_credits` — id (UUID), user_id (FK→users), balance, monthly_allocation, monthly_used, last_reset_at
12. `ai_usage_logs` — id (UUID), user_id (FK→users), operation_type, model_used, tokens_in, tokens_out, cost, created_at
13. `export_jobs` — id (UUID), user_id (FK→users), resume_id (FK→resumes), format (PDF/DOCX), status, file_url, error_message, cost, created_at
14. `share_links` — id (UUID), user_id (FK→users), resume_id (FK→resumes), uuid, password_hash (nullable), access_level, expires_at, view_count, max_views, created_at

### Indexing Strategy

- GIN indexes on all JSONB columns: `resume_sections.content`, `templates.config`, `ai_sessions.conversation_history`, `ai_sessions.extracted_data`, `resume_versions.snapshot`, `cover_letters.content`, `job_analyses.keyword_analysis`, `job_analyses.gap_analysis`
- HNSW index on `job_analyses.embedding` for pgvector similarity search
- B-tree indexes: `users.email` (unique), `users.phone` (unique), `resumes.user_id`, `resume_sections.resume_id`, `ai_sessions.user_id`, `export_jobs.status`, `share_links.uuid` (unique)
- Partial index on `resumes` WHERE status = 'published'
- Composite indexes for common query patterns

### Seed Data — 3 Default Templates

Seed script (`packages/database/src/seed.ts`) inserts 3 ATS-safe templates:
1. **Professional** — single-column, Arial/Calibri, traditional section order (Header→Experience→Education→Skills→Certifications)
2. **Modern** — single-column, Inter font, skill-badge layout, tech-focused
3. **Minimal** — single-column, clean spacing, fresh-graduate optimized (Education→Organizations→Experience→Skills)

### Technical Requirements

- Prisma schema file at `packages/database/src/schema.prisma`
- Seed script at `packages/database/src/seed.ts`
- Prisma client exported from `packages/database/src/index.ts`
- PostgreSQL connection via `DATABASE_URL` environment variable
- No migration applied yet — just schema definition + generate
- pgvector extension added via `CREATE EXTENSION IF NOT EXISTS vector;` in a pre-migration step

### Dev Notes

- Story 1.1 (monorepo) and 1.2 (design tokens) are complete
- The placeholder `schema.prisma` from Story 1.1 must be replaced with the full schema
- `packages/database/src/index.ts` must export a Prisma client singleton
- No actual database connection needed yet — `prisma generate` validates the schema
- `DATABASE_URL` should be documented in a `.env.example` file
- Migration won't run in CI until a database is provisioned — this is expected for Story 1.3
- The `vector` field type requires pgvector extension to be enabled in PostgreSQL

### Testing Requirements

- `prisma generate` succeeds from `packages/database`
- `prisma validate` passes (schema is syntactically correct)
- Prisma client types are importable: `import { PrismaClient } from '@lolos/database'`
- Seed script runs without errors (uses `prisma.$transaction` for atomicity)
