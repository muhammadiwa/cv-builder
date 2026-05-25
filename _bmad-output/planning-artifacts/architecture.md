---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: complete
completedAt: '2026-05-25'
inputDocuments:
  - brief-cv-builder-2026-05-24/brief.md
  - prd-cv-builder-2026-05-25/prd.md
  - ux-design-specification.md
  - ux-visual-specs.md
  - ux-landing-page-specs.md
  - technical-cv-builder-stack-research-2026-05-24.md
workflowType: 'architecture'
project_name: 'cv-builder'
user_name: 'Juragan'
date: '2026-05-25'
---

# Architecture Decision Document

## Project Context Analysis

### Requirements Overview

**Functional Requirements:** 21 FRs across 7 feature areas — AI Interview (FR1-5), Resume Editor (FR6-9), ATS Scoring (FR10-13), Template System (FR14-15), Export (FR16-18), Share & Referral (FR19-20), Auth (FR21).

**Non-Functional Requirements:**
- **Performance:** PDF P50<5s, page LCP<3s (mid-range Android 4G), AI first-token<500ms
- **Security:** UU PDP data residency (Indonesia), PII never sent to LLM APIs, AES-256 at rest, TLS 1.3 transit
- **Reliability:** 99.5% uptime, AI provider automatic fallback, Redis recovery<5s zero data loss
- **Accessibility:** WCAG 2.1 AA, tagged PDF output, keyboard navigation, 44px touch targets
- **Offline:** PWA with IndexedDB persistence, background sync, graceful AI degradation

### Scale & Complexity

- **Complexity level:** High — AI orchestration, real-time streaming (SSE), structured document editing (TipTap/ProseMirror), multi-template rendering (Puppeteer + docx), PWA offline, payment integration
- **Primary domain:** Full-stack TypeScript (Next.js 14+ App Router + NestJS), AI-integrated, PWA
- **Target:** 10K MAU at launch, architected for 100K MAU
- **Cross-cutting concerns:** AI cost management, UU PDP compliance, offline resilience, mobile performance (mid-range Android, 4G), template versioning, PII isolation

### Technical Constraints & Dependencies

- **Data residency:** Indonesian territory (AWS ap-southeast-3 or Alibaba Cloud Jakarta) — UU PDP Article 28
- **PII isolation (architectural invariant):** PII must be stripped before any LLM API call. Single global gateway/interceptor, not per-service filtering. Injected at PDF/DOCX rendering stage only.
- **Mobile constraints:** Mid-range Android (Snapdragon 6xx, 4GB RAM), 4G variable (2-10Mbps)
- **AI cost ceiling:** Must fit within IDR 49K-75K/mo subscription (~$0.08-0.15/user AI cost)
- **Payment:** GoPay, QRIS, Virtual Account via Xendit (credit card <3% penetration)
- **Stack decisions:** Next.js 14+ App Router, NestJS/TypeScript, PostgreSQL 16+pgvector, Redis (2 instances), BullMQ, TipTap, Shadcn/ui, Framer Motion

### Critical Architecture Decisions (Linchpin Priority)

Per Architecture Party Mode (Winston + Amelia), 5 decisions ranked by irreversibility:

1. **PII Boundary (Most Irreversible):** Single global gateway for PII stripping — architectural invariant. Compliance + trust. Retrofit cost: rewrite.
2. **AI Cost Control:** Hybrid inference tier — cheap models for extraction, premium for generation. Token Budget Guardian per call. Business viability depends on this.
3. **Document State Model (Linchpin):** JSON-structured as source of truth, TipTap as rendering engine. All other decisions (AI updates, offline sync, API design) depend on this.
4. **PWA Offline Sync:** Last-write-wins per-field (not CRDT/OT — too heavy for mid-range Android). Depends on #3.
5. **Monorepo Strategy:** Monorepo (Turborepo/Nx) with strict module boundaries. Modular-first, split per bounded context when scaling demands.

### Production Risk Mitigations (from Amelia)

| Decision | Risk | Mitigation |
|----------|------|-----------|
| PII filter per-service | PII leak via missed route | Global NestJS guard + interceptor, auto-fail on PII regex |
| TipTap JSONB directly | No history, no audit | Event-sourced delta storage + periodic snapshot compaction |
| pgvector pure semantic | Recall dropping at 50K+ vectors | Hybrid pgvector + tsvector (BM25 full-text) |
| App Router streaming | Waterfall blocking on mobile | Granular Suspense per data-fetching segment |
| BullMQ without DLQ | Silent job discard, margin loss | Dead Letter Queue + cost-per-job metadata + user rate limiting |

---

## Starter Template & Monorepo Architecture

### Primary Technology Domain

Full-stack TypeScript — Next.js 14+ App Router (frontend), NestJS/TypeScript (backend), PostgreSQL 16 + pgvector (database), Redis + BullMQ (cache + queue), PWA with offline support.

### Selected Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Monorepo** | Turborepo | Lighter than Nx, sufficient caching, minimal config. Migration path to Nx if team grows 5+. |
| **Frontend** | Next.js 14+ App Router, Tailwind, Shadcn/ui, Framer Motion | Already scaffolded for landing page. RSC for SEO, Client Components for editor. |
| **Backend** | NestJS/TypeScript, tRPC (internal) + REST (public) | I/O-heavy AI workload suits Node.js. End-to-end type safety. |
| **Database** | PostgreSQL 16 + pgvector (HNSW, halfvec) | 75% cheaper than dedicated vector DB. |
| **Cache/Queue** | Redis (2 instances) + BullMQ | Semantic cache + 6 queues with DLQ. |
| **Auth** | JWT + httpOnly refresh, WhatsApp OTP, Google/LinkedIn OAuth | Multi-method for Indonesian market. |
| **PDF** | Puppeteer via BullMQ workers | Browser pool min 2 warm, max 10. |
| **DOCX** | docx (npm) | V2 feature. Verified via mammoth. |
| **Package Manager** | pnpm (locked via `only-allow`) | Deterministic installs, strict dependency resolution. |

### Final Monorepo Structure (3 Apps + 2 Packages)

```
lolos/
├── packages/
│   ├── validators/     # Zod schemas, shared TypeScript types
│   └── database/       # Prisma schema, migrations, seed data
├── apps/
│   ├── web/            # Next.js 14+ (landing + dashboard + editor)
│   ├── api/            # NestJS (tRPC + REST + AI orchestration + auth + payment)
│   └── workers/        # BullMQ workers (pdf, ai, email)
├── turbo.json
└── pnpm-workspace.yaml
```

### Rationale for Each Boundary

| Component | Decision | Why |
|-----------|----------|-----|
| `packages/validators` | **Keep** | Shared Zod schemas prevent frontend↔backend schema drift — production bug jika tidak sync. Single PR updates both apps. |
| `packages/database` | **Keep** | Prisma client shared between `api` and `workers`. Prevents migration version mismatch. Easier integration testing. |
| `packages/ui` | **Defer** | Single frontend consumer. Collocate in `apps/web/components/ui/`. Extract when second frontend app exists. |
| `apps/workers` | **Keep** | Isolates crash radius (worker OOM doesn't affect HTTP). Prevents BullMQ↔Prisma connection pool fight. Scale independently. |
| `apps/api` | **Keep** | NestJS modular monolith. Workers called via BullMQ, not direct imports. |

### Implementation Gotchas

1. **pnpm lock:** `"preinstall": "npx only-allow pnpm"` in root package.json.
2. **tRPC type sync:** `turbo.json` explicit `dependsOn: ["^build"]`. CI: `turbo run build --force` on staging merges.
3. **Prisma build chain:** `outputs: ["**/.prisma/**"]` in turbo.json. Prisma in `dependencies`, not `devDependencies`.
4. **Prisma singleton:** `PrismaModule` as global NestJS module — share 1 instance across all services.
5. **BullMQ idempotency:** All job handlers use unique job ID as idempotency key. `concurrency: 1` for sensitive queues.
6. **NestJS circular deps:** `CommonModule` for shared DI. `forwardRef` as fallback.

---

## Core Architectural Decisions

### Already Decided (from PRD, Research, Starter Evaluation)

| Decision | Choice | Source |
|----------|--------|--------|
| Monorepo structure | Turborepo, 3 apps + 2 packages | Step 3 + Party Mode |
| Frontend | Next.js 14+ App Router, Tailwind, Shadcn/ui, Framer Motion | PRD + Tech Research |
| Backend | NestJS/TypeScript, tRPC (internal) + REST (public) | Tech Research |
| Database | PostgreSQL 16 + pgvector (HNSW, halfvec) | Tech Research |
| Cache/Queue | Redis (2 instances) + BullMQ (6 queues, DLQ) | Tech Research |
| Auth | JWT (15min access, 7-day refresh rotation), WhatsApp OTP, Google/LinkedIn OAuth | PRD §4.7 |
| PDF | Puppeteer (headless Chrome) via BullMQ worker pool | Tech Research |
| DOCX | docx (npm) with JSON-config templates (V2) | Tech Research |
| Document State | JSON-structured as source of truth, TipTap as rendering engine | Arch Context + Winston |
| PWA Offline | Service Worker + IndexedDB, last-write-wins per-field | UX Spec + Amelia |

### Decision 1: PII Stripping Gateway

**Decision:** Single global NestJS interceptor strips all PII before any outbound LLM API call. PII fields: name, email, phone, address, photo URL, NIK/KTP. Stripped fields replaced with placeholders. Original values injected at PDF/DOCX rendering stage.

**Architecture:** `User Request → Controller → PIIStrippingInterceptor → LLM Provider`. Auto-fail if PII regex detected in outbound LLM payload. Audit log for every strip/inject operation. Single enforcement point — no per-service filtering.

### Decision 2: AI Model Routing & Cost Control

**Decision:** Hybrid 4-tier inference with Token Budget Guardian.

| Tier | Models | Tasks | Max Cost/Task |
|------|--------|-------|---------------|
| Extraction | Gemini Flash, GPT-4o-mini | Keyword extraction, entity parsing, fact verification | Rp 5-15 |
| Generation | GPT-4o, Claude Sonnet | Resume content, cover letters, achievement rewrites | Rp 150-300 |
| Conversation | GPT-4o-mini, Claude Haiku | Kak interview flow, follow-up questions | Rp 15-25 |
| Analysis | GPT-4o-mini, Gemini Flash | ATS scoring, job match analysis | Rp 20-40 |

Routing: Primary → Secondary → Tertiary fallback. Premium users get priority on primary models. Token Budget Guardian enforces per-user daily cap ($0.10). Semantic cache for ATS scores (24h TTL) and keyword extraction (12h TTL).

### Decision 3: Database Schema Core

**Decision:** 14-table PostgreSQL schema with JSONB for flexible resume sections. GIN indexes on JSONB. IVFFlat/HNSW on pgvector embedding column. Partial indexes for active resumes. Monthly partitioned ai_usage_logs. Immutable JSONB snapshots for resume versioning.

### Decision 4: tRPC API Contract

**Decision:** tRPC v11 for all internal API. REST at `/api/v1/` for webhooks (Xendit), public share links, future integrations. Core routers: auth, resume, ai (SSE subscriptions), ats, export (job queue), payment, share.

### Decision 5: Template Rendering Pipeline

**Decision:** Templates as React components + JSON config. Single render path: browser DOM (preview) and Puppeteer → PDF (export). Template version pinned per resume. Manual upgrade with diff preview. Switch via Framer Motion `layoutId`.

### Decision 6: Offline & Sync Strategy

**Decision:** Optimistic local-first. IndexedDB via Dexie.js. Debounce 150ms → IndexedDB, 2s → API sync. Field-level last-write-wins conflict resolution. Graceful degradation: cached Kak responses when offline, queued AI requests for reconnect.

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database:** `snake_case` tables and columns. `users`, `resume_sections`, `ai_usage_logs`. Foreign keys: `{table}_id`. Indexes: `idx_{table}_{column}`. GIN indexes: `idx_{table}_{column}_gin`.

**API:** tRPC routers `camelCase`: `resume.create`, `ai.interview.stream`. REST: `/api/v1/resumes/:id`. Headers: `X-Lolos-*`.

**Code:** PascalCase components (`ResumeCanvas`), camelCase functions (`getResumeById`), UPPER_SNAKE constants (`MAX_AI_CREDITS`). Files: PascalCase components, kebab-case utilities.

### Structure Patterns

**Tests:** Co-located `__tests__/` per module. `*.test.ts` unit, `*.integration.test.ts` integration, `tests/e2e/` E2E.

**Components:** Feature-based. `features/resume/ResumeEditor.tsx`. Shared UI: `components/ui/` (Shadcn). Layout: `components/layout/`.

**API Modules:** NestJS per domain: `auth/`, `resume/`, `ai/`, `ats/`, `export/`, `payment/`, `share/`. Each: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`.

### Format Patterns

**API:** `{ data: T }` success. `{ error: { code, message } }` errors. ISO 8601 dates. `TIMESTAMPTZ` PostgreSQL. `camelCase` JSON keys in API, `snake_case` in DB JSONB.

### Process Patterns

**Errors:** Global `HttpExceptionFilter` (NestJS), `ErrorBoundary` (Next.js). Friendly Indonesian user messages. Structured logs with trace IDs.

**Loading:** `loading.tsx` per route. IDLE→LOADING→SUCCESS/ERROR. Skeleton screens match layout.

**AI Streaming:** SSE via Vercel AI SDK. Token-by-token with contextual typing indicators.

### Enforcement

**ESLint:** `naming-convention`, `no-console`, `no-unused-vars`. **Prettier:** single config 100 chars. **CI Gates:** lint + typecheck + test must pass.

---

## Project Structure & Boundaries

### Complete Project Tree

```
lolos/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json                    # Root: scripts, devDependencies, only-allow pnpm
│
├── packages/
│   ├── validators/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # Barrel export
│   │       ├── resume.schema.ts    # Resume, Section, Template types + Zod schemas
│   │       ├── user.schema.ts      # User, Profile, Subscription types
│   │       ├── ai.schema.ts        # AISession, AIExtraction, ATS analysis types
│   │       ├── payment.schema.ts   # Payment, Credit, Subscription types
│   │       └── api.contract.ts     # tRPC router input/output types
│   │
│   └── database/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # Prisma client singleton export
│           ├── schema.prisma       # Full Prisma schema (14+ models)
│           ├── migrations/         # Prisma migration history
│           ├── seed.ts             # Dev seed data (templates, sample resumes)
│           └── test-utils.ts       # Test database helpers
│
├── apps/
│   ├── web/                        # Next.js 14+ App Router
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── public/                 # Static assets, PWA manifest, icons
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout (providers, fonts, metadata)
│   │   │   ├── page.tsx            # Landing page
│   │   │   ├── globals.css         # Tailwind + CSS custom properties
│   │   │   ├── providers.tsx       # ThemeProvider, AuthProvider, QueryClient
│   │   │   ├── (marketing)/        # Landing page route group (SSG)
│   │   │   │   ├── page.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── (dashboard)/        # Authenticated routes
│   │   │   │   ├── layout.tsx      # Sidebar + header shell
│   │   │   │   ├── page.tsx        # Dashboard home
│   │   │   │   ├── resume/
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── page.tsx         # Editor page (Client Component)
│   │   │   │   │       └── loading.tsx      # Editor skeleton
│   │   │   │   ├── templates/
│   │   │   │   │   └── page.tsx     # Template gallery
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx     # User settings
│   │   │   ├── api/                # Next.js API routes (tRPC + REST)
│   │   │   │   ├── trpc/
│   │   │   │   │   └── [trpc]/
│   │   │   │   │       └── route.ts        # tRPC HTTP handler
│   │   │   │   └── v1/             # REST endpoints (webhooks, public)
│   │   │   │       └── webhooks/
│   │   │   │           └── xendit/
│   │   │   │               └── route.ts    # Xendit payment callbacks
│   │   │   └── cv/
│   │   │       └── [uuid]/
│   │   │           └── page.tsx     # Public shareable CV page
│   │   ├── components/
│   │   │   ├── ui/                  # Shadcn/ui primitives
│   │   │   ├── layout/              # Navbar, Sidebar, Footer, StatusBar
│   │   │   ├── editor/              # ResumeCanvas, SectionBlock, Toolbar
│   │   │   ├── ai/                  # ChatBubble, StreamingText, AIPanel
│   │   │   ├── ats/                 # ScoreRing, CategoryCard, SuggestionCard
│   │   │   ├── templates/           # TemplateCard, TemplateGallery
│   │   │   ├── export/              # ExportDialog, ProgressIndicator
│   │   │   └── landing/             # Hero, HowItWorks, Pricing, FAQ, etc.
│   │   ├── features/
│   │   │   ├── auth/                # useAuth, AuthGuard, LoginForm
│   │   │   ├── resume/              # useResume, useResumeHistory, auto-save
│   │   │   ├── ai/                  # useInterview, useStreamingText
│   │   │   ├── ats/                 # useATSScore, ATS worker (Web Worker)
│   │   │   ├── templates/           # useTemplate, template registry
│   │   │   ├── export/              # useExport, usePDFGeneration
│   │   │   └── payment/             # useCheckout, useCredits
│   │   ├── hooks/                   # useDebounce, useMediaQuery, useAutoSave
│   │   ├── lib/                     # api-client, ats-engine, pdf-utils
│   │   └── stores/                  # Zustand: editorStore, aiStore, appStore
│   │
│   ├── api/                         # NestJS/TypeScript
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── src/
│   │       ├── main.ts              # Bootstrap, global pipes/guards/filters
│   │       ├── app.module.ts        # Root module imports
│   │       ├── common/              # Shared: guards, interceptors, filters, decorators
│   │       │   ├── pii-stripping.interceptor.ts   # PII gateway (architectural invariant)
│   │       │   ├── token-budget.guard.ts          # AI cost per-call enforcement
│   │       │   ├── rate-limit.guard.ts
│   │       │   └── exception.filter.ts            # Global HTTP exception handler
│   │       ├── auth/
│   │       │   ├── auth.module.ts
│   │       │   ├── auth.controller.ts    # Login, logout, refresh, WhatsApp OTP
│   │       │   ├── auth.service.ts       # JWT issuance, token rotation
│   │       │   └── auth.guard.ts         # JWT verification guard
│   │       ├── resume/
│   │       │   ├── resume.module.ts
│   │       │   ├── resume.service.ts     # CRUD, versioning, template assignment
│   │       │   └── resume.trpc.ts        # tRPC router (internal API)
│   │       ├── ai/
│   │       │   ├── ai.module.ts
│   │       │   ├── ai.service.ts         # Model routing, prompt assembly, extraction
│   │       │   ├── ai.gateway.ts         # LLM provider abstraction (OpenAI/Anthropic/Google)
│   │       │   ├── ai-stream.service.ts  # SSE streaming handler
│   │       │   └── ai.trpc.ts
│   │       ├── ats/
│   │       │   ├── ats.module.ts
│   │       │   ├── ats.service.ts        # 6-dimension scoring engine
│   │       │   ├── ats.rules/            # Platform-specific validation rules (JSON)
│   │       │   └── ats.trpc.ts
│   │       ├── export/
│   │       │   ├── export.module.ts
│   │       │   ├── export.service.ts     # Queue PDF/DOCX generation jobs
│   │       │   └── export.trpc.ts
│   │       ├── payment/
│   │       │   ├── payment.module.ts
│   │       │   ├── payment.service.ts    # Xendit integration
│   │       │   ├── payment.controller.ts # REST webhooks
│   │       │   └── payment.trpc.ts
│   │       ├── share/
│   │       │   ├── share.module.ts
│   │       │   ├── share.service.ts      # UUID link generation, access control
│   │       │   └── share.trpc.ts
│   │       └── analytics/
│   │           ├── analytics.module.ts
│   │           └── analytics.service.ts   # AI usage tracking, cost attribution
│   │
│   └── workers/                     # BullMQ workers
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main.ts              # Worker bootstrap, queue registration
│           ├── pdf.worker.ts        # Puppeteer PDF generation (browser pool)
│           ├── ai.worker.ts         # AI batch processing, async extraction
│           └── email.worker.ts      # Transactional email via SES
│
└── config/
    ├── eslint.config.js             # Shared ESLint config
    └── prettier.config.js           # Shared Prettier config
```

### Component → FR Mapping

| Directory | FRs Covered |
|-----------|------------|
| `apps/web/features/ai/` | FR-1 (Adaptive Question Flow), FR-2 (Streaming Chat), FR-3 (Extraction), FR-4 (Persistence), FR-5 (CV Handoff) |
| `apps/web/features/resume/` | FR-6 (Section Editing), FR-7 (AI Inline Rewrite), FR-8 (Multi-Panel), FR-9 (Auto-Save) |
| `apps/web/features/ats/` | FR-10 (Scoring), FR-11 (Visualization), FR-12 (Quick Fix), FR-13 (Indonesian ATS) |
| `apps/web/components/templates/` | FR-14 (Selection), FR-15 (Definition) |
| `apps/web/features/export/` | FR-16 (PDF), FR-17 (DOCX V2), FR-18 (Queue) |
| `apps/web/features/auth/`, `apps/web/app/cv/[uuid]/` | FR-19 (Share Link), FR-20 (Referral), FR-21 (Auth) |
| `apps/api/ai/` | AI Gateway, PII Stripping, Model Routing, Streaming |
| `apps/api/ats/` | Scoring Engine, Platform Rules, Keyword Analysis |
| `apps/workers/` | PDF Rendering, AI Batch, Email |

---

## Architecture Validation Results

### Coherence Validation ✅

All technology choices verified compatible. Next.js 14+ + NestJS/TypeScript + PostgreSQL 16 + Redis + BullMQ + TipTap + Shadcn/ui + Framer Motion — no version conflicts. tRPC v11 bridges frontend↔backend type safety. Prisma connects both `api` and `workers` to shared schema. Turborepo orchestrates correct build ordering. Patterns consistent across all layers.

### Requirements Coverage Validation ✅

All 21 FRs traced to architectural components. NFRs addressed: performance (Puppeteer pool, SSE streaming, IndexedDB), security (PII Stripping Interceptor, JWT+httpOnly, AES-256, TLS 1.3), reliability (BullMQ DLQ, AI fallback, Redis Sentinel, RDS Multi-AZ), accessibility (Radix WCAG 2.1 AA, tagged PDF), offline (Dexie.js, Service Worker, Background Sync). Scale: 3 apps enable independent horizontal scaling.

### Implementation Readiness Validation ✅

All critical decisions documented with rationale and trade-offs. Technology versions specified. Implementation gotchas documented. Patterns enforceable via automated tooling. Full directory tree with FR mapping.

### Gap Analysis

**No Critical Gaps.** Architecture is implementation-ready.

**Minor Gaps (non-blocking):** CI/CD pipeline config (`.github/workflows/`), environment variable schema, Docker compose for local dev, Storybook (V2 when `packages/ui` extracted).

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION — 16/16 checklist items confirmed. High confidence. All 21 FRs traced. 6 core decisions with rationale. Patterns comprehensive with CI enforcement.
