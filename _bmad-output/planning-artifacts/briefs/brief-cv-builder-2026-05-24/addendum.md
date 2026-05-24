# Addendum: Lolos Product Brief

Supporting depth captured during research and brief creation. This content is intended for downstream documents (PRD, technical architecture, solution design) — not the executive brief.

---

## Market Sizing Context

- Global resume builder market: $8.86B (2025) → $12.55B (2030), 7.4% CAGR
- AI resume builder sub-segment: $1.47B (2025) → $5.00B (2035), 13.1% CAGR
- Indonesian HR software market: growing 2025-2031, cloud/SaaS adoption accelerating
- Talenta by Mekari: 1,000+ enterprise clients (4x in 18 months), 35K+ total companies, $100M valuation
- 4.5M Indonesian university graduates per year
- 74.9M Gen Z (27.94% of population)
- Youth unemployment: 16.26%

## Competitor Profiles

### Rezi — The Bootstrapped ATS Leader
- 4M+ users (end 2025), $1M+ projected revenue
- Only $338K raised — extremely capital efficient
- 843K monthly visits, 22 employees
- Community-first growth (Reddit), zero paid ads
- Enterprise pivot: 300+ organizations, 1 Fortune 500
- **Gap:** English-only, US-focused, no Indonesian payment or ATS

### Teal — The Well-Funded Career Platform
- 2M+ members, $19M raised (Series A $7.5M, Jan 2025)
- 275 employees, 7M+ jobs saved, ~400K interviews landed
- Full lifecycle: resume → track → interview → negotiate
- **Gap:** $24/mo pricing, English-only, desktop-first, no Indonesian presence

### No Indonesian Competitors Found
- Zero dedicated AI resume builder startups identified in Indonesia
- Job boards (Jobstreet, Glints, Kalibrr) offer basic profile creation, not AI-powered CV building
- "Jasa bikin CV" services exist but are manual, non-scalable, quality varies widely

## Detailed User Personas

### Rina — Fresh Graduate (Primary)
- **Age:** 22 | **Location:** Yogyakarta
- **Status:** 50+ applications, zero interviews
- **Pain:** Does not know ATS exists. CV is a Canva template with columns and graphics.
- **Device:** Oppo A-series, 4G
- **WTP:** Rp 0-49K/mo (impulse max)
- **Language:** Bahasa Indonesia only

### Dimas — Career Switcher (Primary)
- **Age:** 30 | **Location:** Jakarta
- **Status:** Logistics supervisor → trying to break into tech
- **Pain:** Has experience but cannot translate it into tech-industry language
- **Device:** Samsung mid-range + work laptop
- **WTP:** Rp 100-200K/mo
- **Language:** Bahasa Indonesia primary, some English

### Adi — Tech Talent (Primary)
- **Age:** 27 | **Location:** Bandung
- **Status:** Software engineer, actively applying
- **Pain:** Believes GitHub is his resume. Resents HR gatekeeping. Needs ATS score proof.
- **Device:** iPhone + MacBook
- **WTP:** Rp 150-300K/mo
- **Language:** Bilingual (ID + EN)

### Maya — Remote Worker (Secondary)
- **Age:** 31 | **Location:** Bali
- **Status:** Remote worker, earning in USD
- **Pain:** Fighting "developing country" bias on international CVs
- **Device:** MacBook + iPhone
- **WTP:** USD 10-20/mo
- **Language:** English primary, some Indonesian

## Technical Architecture Highlights

### Stack Summary
- **Frontend:** Next.js 14+ App Router, Tailwind CSS, Framer Motion, TipTap editor, Shadcn/ui
- **Backend:** NestJS/TypeScript, tRPC (internal API) + REST (webhooks/public)
- **Database:** PostgreSQL 16 + pgvector (HNSW indexing, halfvec for memory efficiency)
- **Cache/Queue:** Redis (2 instances: allkeys-lru for cache, noeviction for BullMQ)
- **Infra:** ECS Fargate / Alibaba Cloud Jakarta (ap-southeast-3 alternative)
- **AI:** GPT-4o (generation), GPT-4o-mini (conversation), Gemini Flash (extraction), Claude Sonnet (fallback)
- **Monitoring:** Sentry + CloudWatch + Grafana + Bull Board

### AI Cost Model
- Estimated AI cost per free user: $0.08/month
- Estimated AI cost per paid user: $0.48-0.72/month
- Combined optimization (semantic cache + model tiering + prompt compression): 65-75% reduction
- Monthly AI cost at 10K MAU (optimized): ~$195/month

### Key Architecture Decisions
- Modular monolith (not microservices) — appropriate for current scale
- tRPC for end-to-end type safety between Next.js and NestJS
- pgvector over dedicated vector DB — sufficient up to 10M+ embeddings, 75% cheaper
- Puppeteer for PDF (CSS @page, best ATS text extraction)
- docx (npm) for DOCX (JSON-config templates, 50-300ms generation)
- BullMQ with 6 separate queues, 3-tier priority for paid users

## Pricing & Unit Economics

### Tier Structure
| Tier | Price | AI Credits | Key Features |
|------|-------|-----------|--------------|
| Gratis | IDR 0 | 50/mo | 1 CV, 1 template family, PDF (watermark) |
| Pro | IDR 49K/mo ($3.50) | 300/mo | Unlimited CVs, all templates, ATS scoring, DOCX, cover letter, job match (10/mo) |
| Premium | IDR 75K/mo ($5.00) | 600/mo | All Pro + unlimited job match, 5 tones, bilingual CV, priority AI, AI interview practice |

### Unit Economics (10K MAU)
- Blended ARPU: $3.50/mo
- Blended LTV: ~$55
- CAC: $0.50-4.00 (organic to paid)
- Payback period: <1 month
- Gross margin: 82-83%
- Monthly infra cost: ~$2,160 (incl. AI)

### Payment Integration Priority
1. GoPay (largest e-wallet by transaction volume)
2. QRIS (universal QR, covers all e-wallets)
3. Virtual Account (BCA, Mandiri, BRI — most trusted for subscriptions)
4. DANA + ShopeePay (growing segments)
5. Stripe (international users, V2)

## Key Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Canva adding ATS features | High | Focus on ATS depth + structured CV management (Canva's design-first model cannot easily add parsing validation) |
| Rezi entering Indonesia | Medium | Large localization barrier (language, payment, ATS knowledge) |
| AI cost overruns | Medium | Semantic caching, model tiering, per-user daily spend caps |
| Low conversion (Indonesia price sensitivity) | Medium | Generous free tier, ATS score as upgrade trigger, student pricing |
| UU PDP compliance failure | High | Host in Indonesian data center, appoint DPO, explicit AI consent flow |

## Sources

This brief synthesizes findings from four research documents:
1. `brainstorming-session-2026-05-24.md` — 20-dimension product architecture
2. `market-ats-resume-builder-indonesia-sea-research-2026-05-24.md` — Market research (6 steps)
3. `market-indonesia-ecosystem-deepdive-research-2026-05-24.md` — Ecosystem deep-dive (6 pillars)
4. `technical-cv-builder-stack-research-2026-05-24.md` — Technical research (9 pillars)

All are available at `_bmad-output/planning-artifacts/research/`.
