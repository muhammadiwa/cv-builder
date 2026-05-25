---
stepsCompleted: [1, 2]
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
