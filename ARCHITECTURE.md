# AI-Powered ATS Resume/CV Generator — Technical Architecture Document

> **Target:** 10K–100K+ MAU | **Primary Market:** Indonesia (ap-southeast-3) | **Secondary:** Global English

---

## 1. Technology Stack

### 1.1 Backend Runtime: Node.js (NestJS) over Go

**Decision: NestJS (TypeScript)**

| Concern | NestJS | Go (Chi / Gin) |
|---------|--------|----------------|
| Shared types with Next.js frontend | Native via `@nestjs/microservices` + tRPC | Requires code-gen (protobuf/OpenAPI → TypeScript) |
| AI/LLM integration ergonomics | Mature ecosystem (`langchain`, `openai`, `anthropic` SDKs) | Fewer mature LLM SDKs, more boilerplate |
| Developer velocity | Fast for CRUD + AI orchestration | Faster runtime, slower iteration |
| Concurrency for PDF/AI | Single-threaded async (good for I/O) | Excellent goroutines for CPU-bound PDF gen is good, but that work is offloaded to workers |

**Verdict:** NestJS wins for this use case because the platform is I/O-bound (DB queries, AI API calls, PDF generation), not CPU-bound. The type-sharing benefit with a Next.js monorepo eliminates an entire class of integration bugs. The AI/LLM integration story is dramatically better in Node.js. Go would be considered at 500K+ MAU if CPU profiling shows bottlenecks.

**NestJS modules:**
- `@nestjs/core`, `@nestjs/platform-express` (Fastify has edge-case multipart issues)
- `@nestjs/bull` for queue processing
- `@nestjs/throttler` for rate limiting
- `@nestjs/schedule` for cron tasks (credit resets, cleanup)
- `@nestjs/swagger` for OpenAPI generation

### 1.2 API Style: REST + tRPC Hybrid

**Decision:** tRPC for internal frontend↔backend communication; REST for external integrations (webhooks, Zapier, mobile SDK).

**Reasoning:**
- tRPC eliminates the serialization/deserialization boundary between Next.js and NestJS. Every API call is a type-safe function call. No manual `zod` schema duplication.
- REST endpoints are exposed under `/api/v1/` for any client that cannot use tRPC (3rd-party integrations, mobile apps later).
- The NestJS backend exposes tRPC via `@nestjs/trpc` adapter, AND classic REST controllers. Both hit the same service layer.

```typescript
// trpc router example
export const resumeRouter = router({
  getById: protectedProcedure
    .input(z.string().uuid())
    .query(({ ctx, input }) => ctx.resumeService.findById(input)),
  updateSection: protectedProcedure
    .input(z.object({ resumeId: z.string().uuid(), sectionId: z.string().uuid(), data: resumeSectionSchema }))
    .mutation(({ ctx, input }) => ctx.resumeService.updateSection(input)),
});
```

### 1.3 Real-Time Communication: SSE (Server-Sent Events)

**Decision:** SSE over WebSocket.

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Streaming AI responses | Native (single long-lived HTTP response) | Requires manual framing |
| Infrastructure | Works through CloudFront, ALB, any reverse proxy | Requires sticky sessions or WebSocket-specific ALB config |
| Reconnection | Built-in `EventSource` auto-reconnect | Manual |
| Bidirectional needed? | No — client streams AI tokens; user actions are normal API calls | Overkill |

**Implementation:** NestJS `@Sse()` decorator streaming AI responses token-by-token. The client receives a stream of `{ token: string, done: boolean }` events. For PDF generation progress, SSE emits `{ stage: 'analyzing' | 'generating' | 'rendering' | 'done', progress: 0-100 }`.

### 1.4 Background Jobs: BullMQ + Redis

**Decision:** BullMQ. It is Redis-backed, has built-in prioritization, delayed jobs, rate limiting, and excellent NestJS integration via `@nestjs/bull`.

Job types and priority levels:
| Queue | Priority (lower = higher) | Concurrency | Description |
|-------|---------------------------|-------------|-------------|
| `ai-generation` | Paid: 1, Free: 10 | 5 | Resume content gen, cover letter gen |
| `ats-analysis` | Paid: 1, Free: 10 | 5 | Keyword extraction, match scoring |
| `pdf-export` | Paid: 2, Free: 10 | 3 | Puppeteer PDF rendering |
| `docx-export` | Paid: 2, Free: 10 | 3 | DOCX assembly |
| `email` | 5 | 2 | SES transactional emails |
| `cleanup` | 20 | 1 | Temp file cleanup, session expiry |

### 1.5 Database: PostgreSQL 16 + Extensions

**Decision:** PostgreSQL 16 with:
- `pgcrypto` — UUID generation, column encryption for PII
- `pgvector` — Resume/job embedding storage and similarity search
- `citext` — Case-insensitive email lookups
- `pg_trgm` — Fuzzy text search on resume content (GIN trigram indexes)

**pgvector over dedicated vector DB:**
- 10K resumes × 1536-dim embeddings = ~60MB. No need for Pinecone/Weaviate at this scale.
- Eliminates network hop for vector search.
- Single source of truth — no dual-write consistency problems.
- Can scale to ~500K embeddings before considering a dedicated vector DB.

### 1.6 Caching: Redis

**Redis use cases:**
| Use Case | Data Structure | TTL | Eviction |
|----------|---------------|-----|----------|
| Session cache (if JWT not used) | `SET` | 7d | `allkeys-lru` |
| Rate limiter counters | `SORTED SET` (sliding window) | 1min | `noeviction` (dedicated instance or volatile-ttl on shared) |
| AI response cache (exact prompt → response) | `STRING` with hash key | 24h | `allkeys-lru` |
| Template cache (rarely-changed configs) | `HASH` | 1h | `volatile-lru` |
| BullMQ job queues | Native BullMQ keys | N/A | `noeviction` (critical — never evict queue data) |
| Real-time presence | `SET per session` | 5min | `volatile-ttl` |

**Architecture:** Two Redis instances:
1. **Redis-cache** (ElastiCache `cache.r6g.large`, 1-node, `allkeys-lru`) — AI cache, rate limiter, template cache, session cache.
2. **Redis-bull** (ElastiCache `cache.r6g.large`, 1-node, `noeviction`) — BullMQ job queues exclusively. Never allow eviction; queue data loss = job loss.

### 1.7 File Storage: S3 (AWS) + CloudFront

- **AWS S3** in ap-southeast-3 (Jakarta) for primary storage.
- **CloudFront** with origin shield in ap-southeast-3 for CDN.
- **S3 lifecycle policy:** Move generated PDFs to S3 Standard-IA after 30 days, Glacier after 90 days.
- **Pre-signed URLs** for temporary access to generated resumes (7-day expiry).
- User-uploaded assets (profile photos) go to a separate bucket with public-read ACL + CloudFront.

### 1.8 PDF & DOCX Generation

**PDF: Puppeteer (headless Chrome)**

```dockerfile
# Dockerfile for PDF worker
FROM node:20-slim
RUN apt-get update && apt-get install -y chromium --no-install-recommends
ENV CHROME_PATH=/usr/bin/chromium
# Worker runs BullMQ consumer
```

**Why Puppeteer:**
- CSS `@page` rules give exact ATS-compatible print layouts.
- We control the template as an HTML/CSS document, render it in headless Chrome, and pipe PDF to S3.
- Supports Unicode (Bahasa Indonesia diacritics, Arabic script for names, etc.).
- Prince XML is more precise but costs $4K+/year licensing. Not justifiable.

**DOCX: `docx` npm package + LibreOffice fallback**

- Primary: `docx` (Node.js pure-JS docx builder). Used for simple ATS-compatible DOCX.
- Fallback: If the template uses complex layouts, render as HTML → Puppeteer → PDF → `libreoffice --headless --convert-to docx`. This is slower but handles any template.

**Template rendering engine:**
- Resumes rendered as Handlebars/React templates. Each template is an HTML file with CSS variables injected at render time (font family, color scheme, section order).
- Templates stored in S3 (`/templates/{template_id}/index.hbs` + `config.json`).
- Server-side rendering: Quick and consistent. Client-side rendering option for instant preview (same React component, just lacking Puppeteer PDF fidelity).

### 1.9 Authentication

**Decision: NextAuth.js v5 (Auth.js) + custom credential provider**

| Provider | Purpose |
|----------|---------|
| Google OAuth | Social login (global users) |
| LinkedIn OAuth | Professional context |
| Credentials (email + OTP) | Indonesia phone/email login |
| Credentials (WhatsApp OTP) | Indonesia-specific (high conversion) |

**Session strategy:**
- **JWT** (stateless, no DB lookup on every request). Tokens stored in `httpOnly` cookies.
- JWT payload: `{ sub, email, name, tier: 'free' | 'premium' | 'pro', credits, iat, exp }`
- Tier information in JWT avoids a DB call on every authenticated request.
- Short expiry: access token 15min, refresh token 7d.
- Refresh token rotation: every refresh issues a new refresh token, old ones are invalidated (stored in Redis set per user).

**WhatsApp OTP integration:**
- Use Twilio WhatsApp API or local provider (WATI, Jatis Mobile).
- OTP stored in Redis: `OTP:{phone}` with TTL 5min, rate-limited to 3 attempts.
- Max 5 OTP sends per phone per day.

### 1.10 Monitoring & Observability

| Layer | Tool | Reason |
|-------|------|--------|
| Error tracking | Sentry | Best NestJS integration, source maps, performance tracing |
| Structured logging | Pino | Fastest structured logger, native NestJS support |
| Log aggregation | Axiom / Grafana Loki | Self-hosted Loki for cost control at scale |
| Metrics | Prometheus + Grafana | `@nestjs/prometheus` exposes `/metrics` for ECS scraping |
| AI cost monitoring | Custom (usage_logs table) + Grafana dashboard | Track cost per user, per model, per operation |
| Uptime | Checkly / Better Uptime | Playwright-based synthetic checks on critical flows |
| APM | Sentry Performance | Auto-instrumentation of NestJS routes, DB queries, external HTTP |

**Pino log format for production (not dev pretty-print):**
```json
{
  "level": 30,
  "time": 1712345678000,
  "pid": 42,
  "hostname": "ip-10-0-1-42",
  "reqId": "req_abc123",
  "userId": "usr_xyz",
  "op": "resume.create",
  "durationMs": 142,
  "error": null
}
```

### 1.11 Analytics

**Decision: PostHog (self-hosted on a small EC2 in ap-southeast-3)**

**Why self-hosted PostHog over Mixpanel/Amplitude:**
- UU PDP data residency — resume data cannot leave Indonesia without explicit consent.
- Cost: PostHog self-hosted is free; Mixpanel/Amplitude at 100K MAU is $1K+/month.
- Full event-level data access (no sampling at our scale).
- Built-in feature flags and A/B testing.

**Deployment:** Single `t3.medium` EC2 with PostHog + PostgreSQL + Redis (Docker Compose). Upgrade to RDS-managed PG when load demands.

---

## 2. Backend Architecture

### 2.1 Overall Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CloudFront (CDN + WAF)                      │
│  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────┐  │
│  │  Static Assets     │  │  API (/api/v1/*,   │  │  SSE Stream  │  │
│  │  (Next.js .next)   │  │  /trpc/*)          │  │  /ai/stream  │  │
│  └────────┬───────────┘  └────────┬───────────┘  └──────┬───────┘  │
└───────────┼────────────────────────┼──────────────────────┼─────────┘
            │                        │                      │
            ▼                        ▼                      ▼
    ┌─────────────────────────────────────────────────────────────┐
    │               ALB (Application Load Balancer)                │
    │              sticky sessions OFF (stateless)                 │
    └───────────┬─────────────────────┬────────────────────┬──────┘
                │                     │                    │
    ┌───────────▼───────────┐ ┌──────▼──────┐  ┌──────────▼─────────┐
    │  Next.js SSR (ECS)    │ │ NestJS API  │  │ NestJS SSE Proxy   │
    │  Frontend + SSR       │ │ (ECS) x2+   │  │ (ECS, same API     │
    │  node.18+, 2GB RAM    │ │ node.18+    │  │  tasks, diff port) │
    └───────────┬───────────┘ └──────┬──────┘  └──────────┬─────────┘
                │                    │                     │
                └────────────────────┼─────────────────────┘
                                     │
                   ┌─────────────────┼─────────────────┐
                   │                 │                 │
                   ▼                 ▼                 ▼
           ┌────────────┐   ┌──────────────┐  ┌───────────────┐
           │ RDS PG 16  │   │ ElastiCache  │  │     S3        │
           │ Multi-AZ   │   │ Redis x2     │  │ (resumes,     │
           │ ap-southeast│  │ (cache +     │  │  templates,   │
           │ -3         │   │  bull)       │  │  uploads)     │
           └────────────┘   └──────────────┘  └───────────────┘
                                     │
                                     ▼
                            ┌────────────────┐
                            │  BullMQ Queue  │
                            │  (Redis)       │
                            └───────┬────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
             ┌───────────┐  ┌───────────┐  ┌───────────────┐
             │ AI Worker │  │PDF Worker │  │ATSD Worker    │
             │ (ECS)     │  │ (ECS)     │  │ (ECS)         │
             │ node.18+  │  │ node.18+  │  │ node.18+      │
             │ + Chromium│  │           │  │               │
             └───────────┘  └───────────┘  └───────────────┘
```

### 2.2 API Design

#### Base URL Pattern

```
https://api.cvbuilder.com/api/v1/{resource}
https://api.cvbuilder.com/trpc/{procedure}
```

#### Full REST Endpoint Map

**Auth:**
```
POST   /api/v1/auth/register              ← Email/password register
POST   /api/v1/auth/login                 ← Email/password login
POST   /api/v1/auth/otp/send              ← Send WhatsApp/email OTP
POST   /api/v1/auth/otp/verify            ← Verify OTP + issue tokens
POST   /api/v1/auth/refresh               ← Rotate refresh token
POST   /api/v1/auth/logout                ← Invalidate refresh token
GET    /api/v1/auth/oauth/{provider}      ← Initiate OAuth flow
GET    /api/v1/auth/oauth/{provider}/callback
```

**Users:**
```
GET    /api/v1/users/me                   ← Current user profile
PATCH  /api/v1/users/me                   ← Update profile
PUT    /api/v1/users/me/photo             ← Upload profile photo (multipart)
DELETE /api/v1/users/me                   ← Account deletion (soft)
```

**Resumes (core resource):**
```
GET    /api/v1/resumes                    ← List user's resumes (?status=draft&page=1&limit=20)
POST   /api/v1/resumes                    ← Create new resume (with optional template_id)
GET    /api/v1/resumes/:id                ← Get full resume with sections
PATCH  /api/v1/resumes/:id                ← Update title, template, language
DELETE /api/v1/resumes/:id                ← Soft delete (archived)
POST   /api/v1/resumes/:id/duplicate     ← Clone resume
PATCH  /api/v1/resumes/:id/template      ← Change template (re-layout)
POST   /api/v1/resumes/:id/publish       ← Set status=published, generate share link
POST   /api/v1/resumes/:id/archive       ← Archive
```

**Resume Sections:**
```
GET    /api/v1/resumes/:id/sections                    ← All sections (ordered)
POST   /api/v1/resumes/:id/sections                    ← Add section (?type=experience)
GET    /api/v1/resumes/:id/sections/:sectionId         ← Single section
PATCH  /api/v1/resumes/:id/sections/:sectionId         ← Update section content
DELETE /api/v1/resumes/:id/sections/:sectionId         ← Remove section
PATCH  /api/v1/resumes/:id/sections/reorder            ← Reorder sections
```

**AI Sessions (conversational interview):**
```
POST   /api/v1/ai/sessions                ← Start new AI session (type=onboarding|interview|cover_letter|job_match)
GET    /api/v1/ai/sessions/:id            ← Session details + extracted data
GET    /api/v1/ai/sessions/:id/messages   ← Message history
POST   /api/v1/ai/sessions/:id/messages  ← Send user message (returns SSE stream)
DELETE /api/v1/ai/sessions/:id            ← Discard session
POST   /api/v1/ai/sessions/:id/apply     ← Apply extracted data to resume
```

**Cover Letters:**
```
GET    /api/v1/cover-letters              ← List user's cover letters
POST   /api/v1/cover-letters             ← Generate (ai_generated=true) or create manually
GET    /api/v1/cover-letters/:id
PATCH  /api/v1/cover-letters/:id
DELETE /api/v1/cover-letters/:id
POST   /api/v1/cover-letters/:id/export  ← Export as PDF/DOCX
```

**Job Analysis:**
```
POST   /api/v1/job-analysis               ← Submit job description for analysis
GET    /api/v1/job-analysis/:id           ← Get analysis results
POST   /api/v1/job-analysis/:id/refresh  ← Re-run analysis
```

**Export & Share:**
```
POST   /api/v1/resumes/:id/export                ← Export (?format=pdf|docx)
GET    /api/v1/resumes/:id/export/:exportId      ← Poll export status (until complete)
GET    /api/v1/resumes/:id/export/:exportId/download  ← Download URL (redirect to pre-signed S3)
POST   /api/v1/resumes/:id/share                 ← Generate shareable link
DELETE /api/v1/resumes/:id/share                 ← Revoke share link
GET    /share/:shareCode                          ← Public resume view (no auth)
```

**Templates:**
```
GET    /api/v1/templates                   ← List templates (?category=professional&locale=id)
GET    /api/v1/templates/:id              ← Template config
```

**Admin (protected, admin role):**
```
GET    /api/v1/admin/users                 ← List users
GET    /api/v1/admin/users/:id            ← User detail
POST   /api/v1/admin/credits/:userId      ← Adjust credits
GET    /api/v1/admin/usage                ← AI usage summary
GET    /api/v1/admin/templates            ← Manage templates
POST   /api/v1/admin/templates            ← Create template
```

#### Rate Limiting

| Endpoint Group | Rate Limit | Burst |
|---------------|------------|-------|
| Auth (login, register, OTP) | 5 req/min per IP | 10 |
| AI session streaming | 20 req/min per user | 30 |
| Resume CRUD | 60 req/min per user | 100 |
| Export generation | 10 req/min per user | 15 |
| Public share views | 100 req/min per IP | 200 |

Implemented via `@nestjs/throttler` with Redis store for distributed rate limiting.

#### Error Response Format

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Retry after 42 seconds.",
    "details": {
      "retryAfter": 42,
      "limit": 5,
      "windowMs": 60000
    },
    "requestId": "req_abc123",
    "timestamp": "2026-05-24T10:30:00Z"
  }
}
```

Error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMIT_EXCEEDED`, `AI_QUOTA_EXCEEDED`, `PAYMENT_REQUIRED`, `INTERNAL_ERROR`, `CONFLICT`.

### 2.3 Service Architecture: Modular Monolith

**Decision:** Modular monolith for 0–50K MAU. Extract services only when proven necessary.

**Why not microservices:**
- Team size will be 3–5 engineers initially. Microservices overhead (deployments, observability, data consistency) kills velocity.
- The bounded contexts naturally map to NestJS modules, not separate services.
- BullMQ workers are already separate deployment units — they form implicit service boundaries.

**NestJS module structure:**
```
src/
├── modules/
│   ├── auth/              ← AuthModule (JWT, OAuth, OTP)
│   ├── users/             ← UsersModule
│   ├── resumes/           ← ResumesModule (sections, versions, sharing)
│   ├── ai-sessions/       ← AISessionsModule (conversation management)
│   ├── ai-provider/       ← AIProviderModule (abstraction layer for LLMs)
│   ├── cover-letters/     ← CoverLettersModule
│   ├── job-analysis/      ← JobAnalysisModule
│   ├── export/            ← ExportModule (PDF, DOCX generation)
│   ├── templates/         ← TemplatesModule
│   ├── subscriptions/     ← SubscriptionsModule (billing)
│   ├── credits/           ← CreditsModule (AI usage metering)
│   ├── admin/             ← AdminModule
│   └── common/            ← Shared utilities, guards, interceptors, filters
├── workers/
│   ├── ai-generation.worker.ts
│   ├── pdf-export.worker.ts
│   ├── docx-export.worker.ts
│   └── ats-analysis.worker.ts
└── main.ts
```

**Module isolation rules:**
- Modules communicate through service classes, not directly through DB.
- Cross-module calls go through an internal service layer (e.g., `ResumesService` → `ExportService.generatePdf()`).
- Events for async flows: NestJS EventEmitter (`@nestjs/event-emitter`) for in-process events, BullMQ for cross-process events.

### 2.4 AI Service Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      AIProviderService                            │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ Anthropic   │  │   OpenAI     │  │   Google Gemini         │  │
│  │ adapter     │  │   adapter    │  │   adapter               │  │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬──────────────┘  │
│         └────────────────┼─────────────────────┘                  │
│                          ▼                                       │
│              ┌──────────────────────┐                            │
│              │  Prompt Template     │                            │
│              │  Manager             │                            │
│              │  - versioned prompts │                            │
│              │  - locale support   │                            │
│              │  - A/B test flag    │                            │
│              └──────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │  AI Response Cache   │
              │  (Redis, keyed by   │
              │   prompt_hash+model) │
              └──────────────────────┘
                          │
                          ▼ (cache miss)
              ┌──────────────────────┐
              │  BullMQ Queue        │
              │  (ai-generation)      │
              │  - priority per tier │
              │  - rate limit 60 RPM │
              │    per API key       │
              └──────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │  SSE Stream Proxy    │
              │  (connects worker   │
              │   to client via      │
              │   Redis Pub/Sub)     │
              └──────────────────────┘
```

**Prompt template management:**
```json
{
  "id": "resume_summary_v2",
  "version": 2,
  "locale": {
    "id": "Buat ringkasan profesional yang menarik...",
    "en": "Write a compelling professional summary..."
  },
  "model": "claude-sonnet-4-20250514",
  "maxTokens": 1024,
  "temperature": 0.7,
  "variables": ["jobTitle", "yearsOfExperience", "keySkills"]
}
```

**AI caching strategy:**
- Cache key: `SHA256(provider + model + prompt + temperature + maxTokens + locale)`
- Cache hit: skip queue entirely, return instantly.
- Cache miss: queue job, cache result on completion.
- Do NOT cache personalized content (user name, address). Only cache generic templates (summary generation prompts with placeholder variables).

### 2.5 Event-Driven Patterns

```typescript
// Event definitions (NestJS EventEmitter)
events.emit('resume.created', { resumeId, userId });
events.emit('resume.published', { resumeId, shareCode });
events.emit('ai.session.completed', { sessionId, userId, tokenCost });
events.emit('export.completed', { resumeId, format, s3Key });
events.emit('user.credits.low', { userId, remaining: 5 });
```

In-process events trigger:
- `resume.created` → Auto-save initial AI session
- `resume.published` → Check ATS score, suggest improvements
- `ai.session.completed` → Log usage, decrement credits
- `user.credits.low` → Send push/email "top up your credits"

---

## 3. Database Schema Design (Full DDL)

### 3.1 Core Tables

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============== USERS ==============
CREATE TYPE auth_provider_enum AS ENUM ('email', 'google', 'linkedin', 'whatsapp');
CREATE TYPE user_role_enum AS ENUM ('user', 'admin', 'superadmin');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE,
    phone           VARCHAR(20) UNIQUE,
    password_hash   VARCHAR(255),             -- nullable for OAuth-only users
    name            VARCHAR(255) NOT NULL,
    photo_url       TEXT,
    language_pref   VARCHAR(5) NOT NULL DEFAULT 'id',  -- 'id' or 'en'
    auth_provider   auth_provider_enum NOT NULL DEFAULT 'email',
    role            user_role_enum NOT NULL DEFAULT 'user',
    email_verified  TIMESTAMPTZ,
    phone_verified  TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for login lookups
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
-- Partial: only index active users (99% of queries are for active users)
CREATE INDEX idx_users_active ON users(id) WHERE is_active = TRUE;

-- ============== USER PROFILES ==============
CREATE TABLE user_profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name       VARCHAR(255) NOT NULL,
    headline        VARCHAR(255),             -- e.g. "Senior Software Engineer at Gojek"
    location        VARCHAR(255),
    linkedin_url    TEXT,
    website         TEXT,
    bio             TEXT,
    phone_secondary VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============== TEMPLATES ==============
CREATE TYPE locale_enum AS ENUM ('id', 'en', 'both');

CREATE TABLE templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    category        VARCHAR(50) NOT NULL,      -- 'professional', 'creative', 'academic', 'executive'
    description     TEXT,
    thumbnail_url   TEXT,
    preview_url     TEXT,                      -- HTML preview URL
    config          JSONB NOT NULL DEFAULT '{}',
    -- config structure:
    -- {
    --   "fonts": { "heading": "Inter", "body": "Inter" },
    --   "colors": { "primary": "#1a365d", "secondary": "#2b6cb0" },
    --   "layouts": { "sidebar": true, "sectionOrder": ["summary","experience","education","skills"] },
    --   "margins": { "top": 20, "bottom": 20, "left": 15, "right": 15 },
    --   "fontSizes": { "name": 24, "heading": 14, "body": 11 }
    -- }
    is_premium      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    locale          locale_enum NOT NULL DEFAULT 'both',
    version         INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_active ON templates(is_active, category) WHERE is_active = TRUE;

-- ============== RESUMES ==============
CREATE TYPE resume_status_enum AS ENUM ('draft', 'published', 'archived');

CREATE TABLE resumes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL DEFAULT 'Untitled Resume',
    template_id     UUID REFERENCES templates(id) ON DELETE SET NULL,
    language        VARCHAR(5) NOT NULL DEFAULT 'id',  -- 'id' | 'en'
    status          resume_status_enum NOT NULL DEFAULT 'draft',
    ats_score       SMALLINT CHECK (ats_score >= 0 AND ats_score <= 100),
    version         INTEGER NOT NULL DEFAULT 1,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compound indexes for common queries
CREATE INDEX idx_resumes_user_status ON resumes(user_id, status) WHERE is_deleted = FALSE;
CREATE INDEX idx_resumes_user_updated ON resumes(user_id, updated_at DESC) WHERE is_deleted = FALSE;
-- For public share queries
CREATE INDEX idx_resumes_published ON resumes(id) WHERE status = 'published' AND is_deleted = FALSE;

-- ============== RESUME SECTIONS ==============
CREATE TYPE section_type_enum AS ENUM (
    'summary', 'experience', 'education', 'skills',
    'certifications', 'projects', 'languages', 'achievements',
    'publications', 'volunteer', 'references'
);

CREATE TABLE resume_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id       UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    section_type    section_type_enum NOT NULL,
    display_order   SMALLINT NOT NULL DEFAULT 0,
    label           VARCHAR(100),             -- Custom section label override
    content         JSONB NOT NULL DEFAULT '{}',
    -- content varies by section_type:
    -- experience: { "company": "...", "title": "...", "location": "...", "startDate": "2020-01", "endDate": "2023-06", "current": false, "bullets": ["..."] }
    -- education:  { "institution": "...", "degree": "...", "field": "...", "startYear": 2015, "endYear": 2019, "gpa": "3.8" }
    -- skills:     { "items": [{"name": "TypeScript", "level": 5}, {"name": "Go", "level": 3}] }
    is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
    ai_generated    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(resume_id, section_type, display_order)  -- no two sections of same type at same position
);

CREATE INDEX idx_sections_resume_order ON resume_sections(resume_id, display_order);

-- GIN index for JSONB content search (e.g., find all resumes mentioning "React")
CREATE INDEX idx_sections_content_gin ON resume_sections USING GIN (content jsonb_path_ops);

-- ============== RESUME VERSIONS ==============
CREATE TABLE resume_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id       UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    snapshot        JSONB NOT NULL,            -- Full resume + sections snapshot
    change_summary  VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(resume_id, version_number)
);

CREATE INDEX idx_versions_resume ON resume_versions(resume_id, version_number DESC);

-- ============== AI SESSIONS ==============
CREATE TYPE session_type_enum AS ENUM ('onboarding', 'interview', 'cover_letter', 'job_match', 'improve');
CREATE TYPE session_status_enum AS ENUM ('active', 'completed', 'expired');

CREATE TABLE ai_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id           UUID REFERENCES resumes(id) ON DELETE SET NULL,
    session_type        session_type_enum NOT NULL,
    status              session_status_enum NOT NULL DEFAULT 'active',
    current_step        VARCHAR(50),           -- For multi-step conversations
    conversation_history JSONB NOT NULL DEFAULT '[]',
    -- [{ "role": "assistant", "content": "Tell me about your experience...", "ts": "..." },
    --  { "role": "user", "content": "I worked at...", "ts": "..." }]
    extracted_data      JSONB DEFAULT '{}',
    -- { "experience": [...], "skills": [...], "education": [...], "summary": "..." }
    token_usage         JSONB NOT NULL DEFAULT '{"input": 0, "output": 0, "total": 0}',
    model_used          VARCHAR(100),
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_sessions_user_active ON ai_sessions(user_id, status) WHERE status = 'active';
CREATE INDEX idx_ai_sessions_expired ON ai_sessions(expires_at) WHERE status = 'active';

-- ============== COVER LETTERS ==============
CREATE TABLE cover_letters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id       UUID REFERENCES resumes(id) ON DELETE SET NULL,
    job_title       VARCHAR(255) NOT NULL,
    company_name    VARCHAR(255) NOT NULL,
    job_description TEXT,
    recipient_name  VARCHAR(255),              -- "Dear [Name],"
    tone            VARCHAR(20) NOT NULL DEFAULT 'professional',  -- professional, enthusiastic, concise
    content         JSONB NOT NULL,            -- { "paragraphs": [...], "subject": "..." }
    ai_generated    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cover_letters_user ON cover_letters(user_id, created_at DESC);

-- ============== JOB ANALYSES ==============
CREATE TABLE job_analyses (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id         UUID REFERENCES resumes(id) ON DELETE SET NULL,
    job_description   TEXT NOT NULL,
    job_title         VARCHAR(255),
    company_name      VARCHAR(255),
    match_percentage  SMALLINT CHECK (match_percentage >= 0 AND match_percentage <= 100),
    keyword_analysis  JSONB DEFAULT '{}',
    -- { "matched": ["TypeScript", "React", "AWS"], "missing": ["Kubernetes", "Terraform"], "total_keywords": 25, "matched_count": 18 }
    gap_analysis      JSONB DEFAULT '[]',
    -- [{ "skill": "Kubernetes", "importance": "high", "suggestion": "Add your K8s experience from Project X" }]
    suggestions       JSONB DEFAULT '[]',
    -- [{ "section": "summary", "action": "add", "text": "..." }]
    resume_embedding  vector(1536),            -- pgvector embedding of the resume
    job_embedding     vector(1536),            -- pgvector embedding of the job description
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- pgvector index for similarity search (IVFFlat with 100 lists, good up to 100K vectors)
CREATE INDEX idx_job_analyses_resume_embedding ON job_analyses USING ivfflat (resume_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_job_analyses_job_embedding ON job_analyses USING ivfflat (job_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_job_analyses_user ON job_analyses(user_id, created_at DESC);

-- ============== SHARE LINKS ==============
CREATE TABLE share_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id       UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    share_code      VARCHAR(20) NOT NULL UNIQUE,  -- e.g., "abc123XYZ"
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at      TIMESTAMPTZ,
    view_count      INTEGER NOT NULL DEFAULT 0,
    last_viewed_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_share_links_code ON share_links(share_code) WHERE is_active = TRUE;

-- ============== SUBSCRIPTIONS ==============
CREATE TYPE plan_tier_enum AS ENUM ('free', 'basic', 'pro', 'enterprise');
CREATE TYPE subscription_status_enum AS ENUM ('active', 'canceled', 'past_due', 'expired', 'trialing');

CREATE TABLE subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_tier           plan_tier_enum NOT NULL DEFAULT 'free',
    status              subscription_status_enum NOT NULL DEFAULT 'active',
    payment_provider    VARCHAR(50),             -- 'midtrans', 'xendit', 'stripe'
    payment_provider_id VARCHAR(255),            -- Subscription ID at payment provider
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
    canceled_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)  -- One active subscription per user
);

CREATE INDEX idx_subscriptions_tier ON subscriptions(plan_tier, status) WHERE status = 'active';

-- ============== AI CREDITS ==============
CREATE TABLE ai_credits (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance             INTEGER NOT NULL DEFAULT 0,       -- Current available credits
    monthly_allocation  INTEGER NOT NULL DEFAULT 50,      -- Free tier: 50/mo
    monthly_used        INTEGER NOT NULL DEFAULT 0,
    bonus_credits       INTEGER NOT NULL DEFAULT 0,       -- One-time purchase or promo
    last_reset_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============== AI USAGE LOGS ==============
CREATE TYPE operation_type_enum AS ENUM (
    'resume_generate', 'resume_improve', 'cover_letter_generate',
    'job_analyze', 'interview_chat', 'ats_score', 'summary_write'
);

CREATE TABLE ai_usage_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id      UUID REFERENCES ai_sessions(id) ON DELETE SET NULL,
    operation_type  operation_type_enum NOT NULL,
    model_used      VARCHAR(100) NOT NULL,
    provider        VARCHAR(50) NOT NULL,       -- 'openai', 'anthropic', 'google'
    tokens_in       INTEGER NOT NULL DEFAULT 0,
    tokens_out      INTEGER NOT NULL DEFAULT 0,
    tokens_total    INTEGER GENERATED ALWAYS AS (tokens_in + tokens_out) STORED,
    cost_usd        NUMERIC(10, 6) NOT NULL DEFAULT 0,
    duration_ms     INTEGER,
    success         BOOLEAN NOT NULL DEFAULT TRUE,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by month for query performance on large volumes
-- (PostgreSQL 16 supports native partitioning)
CREATE TABLE ai_usage_logs_2026_05 PARTITION OF ai_usage_logs
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- ... create monthly partitions via cron job

CREATE INDEX idx_usage_logs_user_date ON ai_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_usage_logs_operation ON ai_usage_logs(operation_type, created_at DESC);

-- ============== EXPORT JOBS ==============
CREATE TYPE export_format_enum AS ENUM ('pdf', 'docx');
CREATE TYPE export_status_enum AS ENUM ('queued', 'processing', 'completed', 'failed');

CREATE TABLE export_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_id       UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    format          export_format_enum NOT NULL,
    status          export_status_enum NOT NULL DEFAULT 'queued',
    s3_key          TEXT,                       -- Path in S3 after completion
    file_size_bytes INTEGER,
    error_message   TEXT,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_export_jobs_user ON export_jobs(user_id, created_at DESC);
CREATE INDEX idx_export_jobs_pending ON export_jobs(status) WHERE status IN ('queued', 'processing');
```

### 3.2 Full-Text Search

```sql
-- Add full-text search support to resumes
ALTER TABLE resumes ADD COLUMN search_vector TSVECTOR;

CREATE FUNCTION resumes_search_update() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('simple', COALESCE(NEW.title, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_resumes_search
    BEFORE INSERT OR UPDATE OF title ON resumes
    FOR EACH ROW EXECUTE FUNCTION resumes_search_update();

CREATE INDEX idx_resumes_search ON resumes USING GIN(search_vector);
```

### 3.3 Soft Delete & Archival Policy

| Data | Strategy | Retention |
|------|----------|-----------|
| User accounts | Soft delete (`is_active=FALSE`) | 90 days before hard delete |
| Resumes | Soft delete (`is_deleted=TRUE`) | 30 days; auto-permanent-delete after 30d via cron |
| AI sessions | Hard delete (conversation history purged after 24h) | 24h after expiry |
| Usage logs | Never deleted (compliance requirement) | Indefinite, partitioned monthly |
| Exported files | S3 lifecycle | Standard-IA 30d, Glacier 90d, expire 365d |
| Share links | Hard delete when resume deleted | Immediate cascade |

**Cleanup cron (BullMQ `cleanup` queue, runs daily):**
```sql
-- Hard-delete resumes archived >30 days ago
DELETE FROM resumes WHERE is_deleted = TRUE AND deleted_at < NOW() - INTERVAL '30 days';

-- Expire stale AI sessions
UPDATE ai_sessions SET status = 'expired' WHERE status = 'active' AND expires_at < NOW();
```

### 3.4 pgvector for Job Matching

The resume and job description embeddings enable similarity-based matching:
```sql
-- Find resumes that best match a given job description
SELECT r.id, r.title, j.match_percentage,
       r.ats_score,
       1 - (r_emb.embedding <=> j_emb.job_embedding) AS similarity
FROM job_analyses j
JOIN LATERAL (
    SELECT resume_embedding FROM job_analyses
    WHERE resume_id = j.resume_id AND resume_embedding IS NOT NULL
    LIMIT 1
) r_emb ON TRUE
CROSS JOIN LATERAL (
    SELECT job_embedding FROM job_analyses
    WHERE id = j.id AND job_embedding IS NOT NULL
) j_emb
WHERE j.id = 'specific-job-id';
```

---

## 4. Infrastructure & Deployment

### 4.1 AWS Architecture (ap-southeast-3, Jakarta)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AWS Account                                   │
│                                                                      │
│  ┌───────────────────────── VPC (10.0.0.0/16) ────────────────────┐ │
│  │                                                                 │ │
│  │  ┌─── Public Subnet AZ-a (10.0.1.0/24) ───┐                    │ │
│  │  │  • NAT Gateway                          │  ┌── Public AZ-b ─┐│ │
│  │  │  • ALB (internet-facing)                │  │ (10.0.2.0/24)  ││ │
│  │  │  • Bastion Host (jump box)              │  │ Same layout    ││ │
│  │  └──────────────────────────────────────────┘  └────────────────┘│ │
│  │                                                                 │ │
│  │  ┌─── Private Subnet AZ-a (10.0.3.0/24) ───┐                    │ │
│  │  │  • ECS Fargate (API servers)            │  ┌── Private AZ-b ─┐│ │
│  │  │  • ECS Fargate (Workers: AI, PDF, ATS) │  │ (10.0.4.0/24)   ││ │
│  │  │  • ECS Fargate (Next.js SSR)            │  │ Same layout     ││ │
│  │  └──────────────────────────────────────────┘  └────────────────┘│ │
│  │                                                                 │ │
│  │  ┌─── DB Private Subnet AZ-a (10.0.5.0/24) ──┐                  │ │
│  │  │  • RDS PostgreSQL (Primary)                 │  ┌── DB AZ-b ──┐│ │
│  │  │  • ElastiCache Redis (cache)                │  │ RDS Standby ││ │
│  │  │  • ElastiCache Redis (bull)                 │  │ (Multi-AZ)  ││ │
│  │  │  • RDS Proxy (connection pooling)           │  └─────────────┘│ │
│  │  └──────────────────────────────────────────────┘                │ │
│  │                                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌──────────── External Services ────────────┐                      │
│  │  • S3 (ap-southeast-3)                     │                      │
│  │  • CloudFront (CDN + WAF)                  │                      │
│  │  • SES (email, verified in ap-southeast-3) │                      │
│  │  • Route53                                  │                      │
│  └─────────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 ECS Fargate Configuration

**Why ECS Fargate over EKS:**
- No control plane management. No node group scaling. No cluster autoscaler tuning.
- At 10K MAU, a single `ecs.API` service with 2–4 tasks handles all API traffic. Pay-per-task pricing is dramatically simpler and cheaper than maintaining an EKS cluster.
- Switch to EKS at 50K+ MAU when the number of services exceeds ~10 and you need namespace isolation, service meshes, or spot instance diversity.

**Task definitions:**

| Service | CPU | Memory | Count (min/max) | Auto-scale trigger |
|---------|-----|--------|-----------------|-------------------|
| `api` (NestJS) | 1024 (1 vCPU) | 2048 MB | 2 / 8 | CPU > 70% for 5min |
| `web` (Next.js) | 1024 (1 vCPU) | 2048 MB | 2 / 6 | CPU > 70%, or request count per target |
| `worker-ai` | 2048 (2 vCPU) | 4096 MB | 1 / 10 | BullMQ queue depth > 20 for 2min |
| `worker-pdf` | 2048 (2 vCPU) | 4096 MB | 1 / 5 | BullMQ queue depth > 10 for 2min |
| `worker-email` | 512 (0.5 vCPU) | 1024 MB | 1 / 2 | Queue depth > 50 (email bursts) |

**Service auto-scaling policy (Application Auto Scaling):**
```json
{
  "TargetTrackingScalingPolicyConfiguration": {
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }
}
```

**Worker scaling on queue depth (custom metric via CloudWatch):**
```typescript
// Publish BullMQ queue depth as CloudWatch metric
import * as AWS from 'aws-sdk';
const cloudwatch = new AWS.CloudWatch();

async function publishQueueDepth(queueName: string, depth: number) {
  await cloudwatch.putMetricData({
    Namespace: 'CVBuilder/Queues',
    MetricData: [{
      MetricName: 'QueueDepth',
      Dimensions: [{ Name: 'QueueName', Value: queueName }],
      Value: depth,
      Unit: 'Count',
      Timestamp: new Date(),
    }],
  }).promise();
}

// ECS scaling policy references this metric
```

### 4.3 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main, develop]

env:
  AWS_REGION: ap-southeast-3
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-southeast-3.amazonaws.com

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: cvbuilder_test }
        ports: [5432:5432]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: pnpm install
      - run: pnpm run lint
      - run: pnpm run test:e2e
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/cvbuilder_test
          REDIS_URL: redis://localhost:6379

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [api, web, worker-ai, worker-pdf]
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@v2
      - run: |
          docker build -t $ECR_REGISTRY/${{ matrix.service }}:${{ github.sha }} \
            -f docker/${{ matrix.service }}.Dockerfile .
          docker push $ECR_REGISTRY/${{ matrix.service }}:${{ github.sha }}

  deploy-staging:
    needs: build-and-push
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with: { aws-region: ${{ env.AWS_REGION }} }
      - run: |
          aws ecs update-service --cluster cvbuilder-staging \
            --service ${{ matrix.service }} \
            --force-new-deployment \
            --region ap-southeast-3
      - run: |
          # Run database migrations
          aws ecs run-task --cluster cvbuilder-staging \
            --task-definition cvbuilder-migrate \
            --launch-type FARGATE \
            --network-configuration "..."

  deploy-production:
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: |
          # Blue/green deployment via CodeDeploy
          aws ecs deploy --cluster cvbuilder --service api \
            --task-definition task-definitions/api.json \
            --codedeploy-app cvbuilder --codedeploy-deploy-group api-dg
```

### 4.4 Database Migration Strategy

**Tool: Drizzle ORM (with drizzle-kit migrations)**

**Why Drizzle over Prisma:**
- Lighter runtime, no 200MB Prisma engine binary in Docker image.
- SQL-like API; easier to write raw queries for complex operations (pgvector, full-text search, CTEs).
- Better performance for our use case (no implicit N+1, no lazy loading).
- Full type safety with TypeScript.
- Migrations are plain SQL files (reviewable, executable outside the ORM).

```typescript
// drizzle/schema/users.ts
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }),
  name: varchar('name', { length: 255 }).notNull(),
  // ...
});
```

**Migration workflow:**
```
# Development: auto-generate migration from schema changes
pnpm run db:generate          # Creates SQL migration file in drizzle/migrations/

# Staging: run migrations automatically on deploy
pnpm run db:migrate           # Applies pending migrations

# Production: run migration as a separate ECS task (not part of app startup)
# This enables rollback: deploy old code + run down migration
```

**Migration rollback protocol:**
1. All migrations must have both `up` and `down` directions.
2. Deploy old code (which works with the schema N-1).
3. Run migration down.
4. Never run destructive migrations (DROP COLUMN, DROP TABLE) without first verifying no queries reference them in production.

### 4.5 Infrastructure as Code

**Tool: AWS CDK (TypeScript)**

```typescript
// cdk/lib/cvbuilder-stack.ts (simplified)
export class CVBuilderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC with public/private subnets across 2 AZs
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2,
      natGateways: 1,  // 1 NAT Gateway for cost (2 AZs would double cost)
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'Database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // RDS PostgreSQL 16 Multi-AZ
    const db = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      multiAz: true,
      storageType: rds.StorageType.GP3,
      allocatedStorage: 100,
      maxAllocatedStorage: 500,
      backupRetention: cdk.Duration.days(30),
      deletionProtection: true,
      parameters: {
        shared_preload_libraries: 'pgcrypto,vector',
      },
    });

    // ECS Fargate cluster
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    // API service
    const apiTaskDef = new ecs.FargateTaskDefinition(this, 'APITaskDef', {
      cpu: 1024, memoryLimitMiB: 2048,
    });
    apiTaskDef.addContainer('API', {
      image: ecs.ContainerImage.fromEcrRepository(ecrRepo, 'latest'),
      portMappings: [{ containerPort: 3000 }],
      environment: {
        NODE_ENV: 'production',
        DATABASE_URL: dbSecret.secretValue.toString(),
        REDIS_URL: redisSecret.secretValue.toString(),
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'api' }),
    });

    // ALB
    const alb = new elb2.ApplicationLoadBalancer(this, 'ALB', {
      vpc, internetFacing: true,
    });
    const listener = alb.addListener('Listener', { port: 443, certificate: cert });
    listener.addTargets('APITarget', {
      port: 3000, targets: [apiService],
      healthCheck: { path: '/health' },
    });
  }
}
```

### 4.6 Secrets Management

**Tool: AWS Secrets Manager (with automatic rotation)**

```
Secret: /cvbuilder/production/database
{
  "host": "cvbuilder.cluster-xxx.ap-southeast-3.rds.amazonaws.com",
  "port": 5432,
  "dbname": "cvbuilder",
  "username": "cvbuilder_app",
  "password": "rotated-automatically"
}

Secret: /cvbuilder/production/redis
{
  "host": "cvb-cache.xxxxx.ng.0001.apse3.cache.amazonaws.com",
  "port": 6379
}

Secret: /cvbuilder/production/ai-providers
{
  "openai_api_key": "sk-...",
  "anthropic_api_key": "sk-ant-...",
  "google_api_key": "..."
}
```

**Principle of least privilege IAM:**
- ECS task roles have read access only to their specific secrets.
- The `api` task cannot read `ai-providers` (only workers need it).
- The migration task has write access to the database secret (for rotation).

---

## 5. Scalability Architecture

### 5.1 Horizontal Scaling Strategy

| Component | Scaling Strategy | Notes |
|-----------|-----------------|-------|
| API servers | Add ECS tasks. ALB distributes. | Stateless. JWT has no server-side session. |
| Next.js SSR | Add ECS tasks. ALB distributes. | Stateless. Session stored in Redis if needed. |
| Workers | Auto-scale on queue depth. | Workers pull from BullMQ. No load balancer needed. |
| PostgreSQL | Read replicas (2 initially) + RDS Proxy. | Read replicas serve resume views, public shares, analytics queries. Writes go to primary. |
| Redis | Scale vertically first (r6g.large → xlarge). Cluster mode at 10GB+ or 200K+ ops/sec. | BullMQ Redis must never cluster in a way that loses queue data. |
| S3 | No scaling needed (virtually unlimited). | CloudFront handles CDN for public assets. Pre-signed URLs for private exports. |

**Connection pooling configuration:**

```
RDS Proxy → PgBouncer (in transaction mode) → PostgreSQL

Max connections:
  RDS Proxy: 100 (default)
  PgBouncer: 50 (transaction mode — connections released after each transaction)
  PostgreSQL max_connections: 80 (leaving headroom for admin/superuser connections)
  
Each API task: max 10 DB connections (5 for queries, 5 for transactions)
  At peak of 8 API tasks + 10 workers = 18 tasks × 10 = 180 connections
  PgBouncer reduces this to max 50 actual Postgres connections.
```

### 5.2 AI Cost Optimization

**The AI cost is the #1 variable cost. It must be managed aggressively.**

| Strategy | Implementation | Estimated Savings |
|----------|---------------|-------------------|
| Model tiering | Free users: Claude Haiku / GPT-4o-mini. Pro users: Sonnet. Enterprise: Opus. | 60% |
| Semantic caching | Cache exact prompt + variable combinations in Redis. TTL 24h. | 30% hit rate |
| Prompt compression | Strip whitespace, use shorthand for repeated context. | 15% token reduction |
| Batching | Combine non-urgent AI requests (background analysis) into batched API calls. | 10% |
| Token budgeting | Hard cap per user per day. Free: 50K tokens/day. Pro: 500K/day. | Prevents runaway costs |
| Caching analysis results | Job analysis results cached for 7 days (identical JD → skip re-analysis). | 20% on job analysis |

**Grafana dashboard metrics (AI Cost):**
```
- Cost per user this month (top 10 spenders)
- Cost per operation type (resume_generate vs cover_letter vs job_analyze)
- Token usage per model per provider
- Cache hit rate for AI prompts
- Average tokens per resume generation (trending up? prompt issue)
- Cost per MAU (target: < $0.10/user/month at scale)
```

### 5.3 Multi-Region & Disaster Recovery

**Phase 1 (0–50K MAU): Single region (ap-southeast-3)**

| Data | Backup Strategy | RPO | RTO |
|------|----------------|-----|-----|
| PostgreSQL | Automated daily snapshots + WAL streaming to S3 (30-day retention) | 5 minutes | 1 hour |
| Redis (cache) | No backup (rebuildable) | N/A | N/A |
| Redis (bull) | No backup (jobs can be re-queued) | N/A | N/A |
| S3 | Cross-region replication to ap-southeast-1 (Singapore) | 15 minutes | 1 hour |
| AI usage logs | pg_dump nightly | 24 hours | 4 hours |

**Disaster recovery runbook (ap-southeast-3 outage):**
1. Route53 health check detects primary region is down.
2. Manual switch: update Route53 failover record to point to Singapore.
3. Promote Singapore RDS read replica to primary.
4. Redeploy ECS services in Singapore region from latest Docker images.
5. Update S3 bucket replication direction.
6. Estimated total RTO: 2–4 hours (manual steps requiring engineer intervention).

**Phase 2 (50K+ MAU): Multi-region active-passive with Singapore DR**
- Read replicas in ap-southeast-1 serving global English users.
- Writes always go to Jakarta primary.
- Route53 latency-based routing: Indonesian users → Jakarta, SEA/Global → Singapore.
- Redis Global Datastore for cross-region replication.

### 5.4 Cost Projection at 10K MAU

| Category | Service | Monthly Cost |
|----------|---------|-------------|
| Compute | ECS Fargate (API 2 + Web 2 + Workers 3) | ~$400 |
| Database | RDS PostgreSQL t3.medium Multi-AZ | ~$150 |
| Cache | ElastiCache r6g.large × 2 | ~$200 |
| Storage | S3 + CloudFront (CDN) | ~$50 |
| AI Inference | ~30K generations/mo × ~$0.02 avg | ~$600 |
| Email | SES (15K emails/mo) | ~$10 |
| Monitoring | Sentry (Team plan) + Grafana | ~$50 |
| Analytics | PostHog self-hosted (EC2) | ~$30 |
| DNS + WAF | Route53 + WAF | ~$20 |
| **Total** | | **~$1,510/mo** |

**Revenue target to be sustainable:**
- Free tier: 80% of users → acquisition funnel.
- Basic (IDR 49K/mo ≈ $3): 15% → $4,500/mo.
- Pro (IDR 99K/mo ≈ $6.50): 5% → $3,250/mo.
- **Total MRR: ~$7,750 → 5x infrastructure cost.** Healthy margin.
