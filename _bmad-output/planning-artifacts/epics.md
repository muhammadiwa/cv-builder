---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - prd-cv-builder-2026-05-25/prd.md
  - architecture.md
  - ux-design-specification.md
  - ux-visual-specs.md
  - ux-landing-page-specs.md
---

# Lolos - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Lolos, decomposing requirements from the PRD (21 FRs), UX Design (8 sections + visual specs), and Architecture (6 core decisions) into implementable stories.

## Requirements Inventory

### Functional Requirements

**AI Conversational Interview (§4.1):**
FR1: Adaptive Question Flow — system conducts interview using structured question tree with dynamic follow-ups. Classifies user into 1 of 6 career stages within 3 exchanges. Fresh grads ≤30 questions, Executives ≤45.
FR2: Streaming Chat Interface — Kak responses stream token-by-token via SSE (Vercel AI SDK). Typing indicator with contextual labels. Suggested quick-reply chips.
FR3: Structured Data Extraction — after each response, system extracts resume facts via function calling. Fact verification with confidence scoring. PII never sent to LLM APIs.
FR4: Interview Persistence and Resume — close browser mid-interview, return within 7 days to continue. State stored in Redis with DB backup.
FR5: CV Preview and Handoff — interview completes, 300ms crossfade from chat to CV preview. ATS score ring animates 0→score over 1.5s (spring physics).

**Resume Editor (§4.2):**
FR6: Structured Section Editing — A4 canvas with discrete section blocks (Header, Summary, Experience, Education, Skills, Certifications, Projects, Languages, Achievements). TipTap nodes with drag handles. Toggle visibility.
FR7: AI Inline Rewrite — wand button per section opens AI suggestions as diff view. Write-lock during AI stream. Each AI action = single undo step.
FR8: Multi-Panel Layout — Desktop: 3-panel (nav 280px | canvas | AI 360px). Mobile: bottom tab bar + bottom sheets. Status bar with sync indicator.
FR9: Auto-Save and Offline Persistence — IndexedDB (Dexie.js) every 800ms. API sync every 2s. Offline banner. Field-level last-write-wins conflict resolution.

**ATS Scoring Engine (§4.3):**
FR10: Six-Dimensional Scoring — Keyword Match (30%), Formatting (20%), Completeness (15%), Readability (15%), Metrics Impact (10%), Optimization (10%). Web Worker for non-blocking compute.
FR11: ATS Score Visualization — SVG ring gauge (120px, 12px stroke). Color gradient: red→amber→blue→emerald. Spring animation. Category cards with progress bars.
FR12: Improvement Suggestions with Quick Fix — "Improve" button per category. AI suggestion with diff preview. One-click apply.
FR13: Indonesian ATS Platform Validation — rules for Talenta (Mekari), LinovHR, GreatDay HR. Config-driven (`config/ats-rules/{platform}.json`).

**Template System (§4.4):**
FR14: Template Selection and Switching — horizontal scrollable gallery. CV data pre-rendered in each template. Framer Motion `layoutId` morph animation (300ms). No data loss on switch.
FR15: Template Definition — React component + JSON config: `{ id, name, layout, fonts, colors, spacing, sectionOrder }`. Single render path for browser preview + server PDF.

**Export System (§4.5):**
FR16: PDF Generation — Puppeteer (headless Chrome) via BullMQ workers. CSS @page layouts. Warm browser pool (min 2, max 10). P50<5s, P95<15s.
FR17: DOCX Generation (V2) — `docx` (npm) with JSON-config templates. Verified via `mammoth.extractRawText()`. <500ms per resume.
FR18: Export Queue and Progress — BullMQ `export` queue. Progress indicator (25/50/75/100%). Download on completion. 3 retries + DLQ.

**Share & Referral (§4.6):**
FR19: Shareable Resume Link — `lolos.app/cv/{uuid}`. Privacy controls (public, password, expiry, view cap). View analytics. Native share sheet.
FR20: Referral Credits — unique referral code per user. +50 credits (referrer), +25 credits (referee). 24h cookie window + server-side attribution.

**Auth (§4.7):**
FR21: Multi-Method Authentication — WhatsApp OTP, Google OAuth, LinkedIn OAuth, email magic link. JWT access (15min) + httpOnly refresh (7 days, rotation). Max 5 sessions/user.

### Non-Functional Requirements

NFR1: Performance — PDF P50<5s, P95<15s. Page LCP<3s (mid-range Android 4G). AI first-token<500ms. Lighthouse>85.
NFR2: Security — UU PDP compliance (data residency Indonesia). PII never sent to LLM APIs (global gateway). AES-256 at rest. TLS 1.3. HSTS preloaded.
NFR3: Reliability — 99.5% uptime. AI provider automatic fallback. Redis recovery<5s zero data loss. RDS Multi-AZ, RPO<5min, RTO<1hr.
NFR4: Accessibility — WCAG 2.1 AA. Keyboard navigation. Tagged PDF output. 44px touch targets. axe-core CI gate: 0 critical violations.
NFR5: Offline — PWA with Service Worker. IndexedDB persistence. Background Sync API. Graceful AI degradation.
NFR6: AI Cost — <$0.08/user/month (free), <$0.48/user/month (paid). Token Budget Guardian. Daily per-user $0.10 hard cap.
NFR7: Bundle Budget — Initial JS<180kB gzipped. Editor lazy-loaded<150kB gzipped. next-bundle-analyzer per PR.

### Additional Requirements (Architecture)

- AR1: Initialize Turborepo monorepo (3 apps + 2 packages)
- AR2: PII Stripping Gateway as single global NestJS interceptor
- AR3: AI Model Routing with 4-tier inference + Token Budget Guardian
- AR4: tRPC v11 for internal API, REST at `/api/v1/` for webhooks
- AR5: PostgreSQL 14-table schema with pgvector HNSW indexes
- AR6: Prisma ORM with shared client from `packages/database`
- AR7: BullMQ with 6 queues (ai, pdf, docx, ats, email, notification) + DLQ + cost-per-job tracking
- AR8: SSR/SSG for landing page, ISR for SEO pages, Client Components for editor
- AR9: Semantic cache for AI responses (Redis, 24h ATS, 12h keywords, never cover letters)
- AR10: Template versioning — pin template version to resume, manual upgrade with diff preview
- AR11: pnpm workspace with `only-allow` enforcement
- AR12: ESLint + Prettier + CI gates (lint, typecheck, test)

### UX Design Requirements

- UX-DR1: Kak Chat Screen — full-screen chat on 360×720px. Streaming messages, suggested reply chips, typing indicator, voice input, progress indicator. 9 component states. iOS keyboard visualViewport handling.
- UX-DR2: CV Preview Reveal — 6-step animated transition (300ms crossfade, 1.5s spring ring, confetti). Quick Win improvement card. Score context text. Dual CTAs.
- UX-DR3: Resume Editor Mobile — TipTap with bottom tab bar. SectionBlock with drag handle, AI wand. Slash commands. FAB "Tanya Kak." Auto-save indicator with 4 states.
- UX-DR4: ATS Score Dashboard Desktop — 3-panel layout. Score ring with gradient. 6 category breakdown cards with hover-reveal Improve buttons. Score history sparkline with pathLength animation.
- UX-DR5: Export & Share Sheet — 70vh bottom sheet with spring entry. Format selection (PDF/DOCX). Download progress. WhatsApp share with #25D366 brand color. Referral card.
- UX-DR6: Landing Page — 10 sections (Hero, How It Works, AI Demo, ATS Showcase, Templates, Features Bento, Pricing, Testimonials, FAQ, CTA+Footer). Framer Motion animations. Dark/light mode. Mobile-responsive. Typewriter hero headline. 3D parallax cards.
- UX-DR7: Design System Tokens — Indigo/Violet palette. Jakarta Sans+Inter+JetBrains Mono. 4px base spacing. Micro 150ms→Narrative 1000ms animation scale. Light/dark CSS custom properties.
- UX-DR8: Shadcn/ui Component Setup — Button, Dialog, Sheet, Tabs, Card, Input/Textarea, Select/Combobox, Toast/Sonner, Progress, Skeleton, Badge, Tooltip, Command.
- UX-DR9: Kak Persona & Tone — warm, supportive, semi-formal ("Anda"). One question per response. Code-switch tolerant. Never judgmental language ("nilai"→"skor").
- UX-DR10: Emotional Design — ATS education moment before first score. Celebration animation at milestones. Doom-scroll prevention for low scores. "System is broken, not you" framing.

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 4 | Adaptive Question Flow |
| FR2 | Epic 4 | Streaming Chat Interface |
| FR3 | Epic 4 | Structured Data Extraction |
| FR4 | Epic 4 | Interview Persistence |
| FR5 | Epic 4 | CV Preview and Handoff |
| FR6 | Epic 2 | Structured Section Editing |
| FR7 | Epic 2 | AI Inline Rewrite |
| FR8 | Epic 2 | Multi-Panel Layout |
| FR9 | Epic 2 | Auto-Save and Offline |
| FR10 | Epic 3 | Six-Dimensional Scoring |
| FR11 | Epic 3 | ATS Score Visualization |
| FR12 | Epic 3 | Improvement Suggestions |
| FR13 | Epic 3 | Indonesian ATS Validation |
| FR14 | Epic 5 | Template Selection |
| FR15 | Epic 5 | Template Definition |
| FR16 | Epic 5 | PDF Generation |
| FR17 | Epic 5 | DOCX Generation (V2) |
| FR18 | Epic 5 | Export Queue & Progress |
| FR19 | Epic 6 | Shareable Resume Link |
| FR20 | Epic 6 | Referral Credits |
| FR21 | Epic 1 | Multi-Method Authentication |

**NFRs covered as horizontal themes in every epic via Definition of Done.**

---

## Epic 1: Foundation, Auth & Infrastructure

**Goal:** User can sign up via WhatsApp/Google/LinkedIn, log in securely. Developer has CI/CD, database, monorepo, design tokens.

### Story 1.1: Monorepo Scaffold with Turborepo

As a developer,
I want a working Turborepo monorepo with all apps and packages scaffolded,
So that all future stories have a home.

**Acceptance Criteria:**
- **Given** the project root, **When** `pnpm install` runs, **Then** all workspace dependencies resolve without errors
- **Given** the monorepo, **When** `turbo run build` runs, **Then** all apps and packages build successfully
- **And** `packages/validators/` exports shared Zod schemas
- **And** `packages/database/` contains Prisma schema and generates client
- **And** `apps/web/` runs Next.js dev server on port 3000
- **And** `apps/api/` runs NestJS dev server on port 4000
- **And** `apps/workers/` has BullMQ worker bootstrap
- **And** `pnpm` is enforced via `only-allow` in root package.json

### Story 1.2: Design System Tokens & Shadcn/ui Setup

As a developer,
I want the design system tokens and Shadcn/ui components configured,
So that all UI work uses consistent colors, fonts, spacing, and accessible primitives.

**Acceptance Criteria:**
- **Given** the Tailwind config, **When** inspecting CSS custom properties, **Then** Indigo/Violet palette, Jakarta Sans+Inter fonts, and 4px base spacing are defined
- **And** dark/light mode CSS custom properties are configured
- **And** all Shadcn/ui primitives (Button, Dialog, Sheet, Tabs, Card, Input, Textarea, Select, Toast, Progress, Skeleton, Badge, Tooltip, Command) are installed and themed
- **And** `components/ui/` exports all primitives
- **And** animation scale tokens (micro 150ms → narrative 1000ms) are in Tailwind config

### Story 1.3: Database Schema & Migrations

As a developer,
I want the PostgreSQL database schema created with all 14 tables and pgvector extension,
So that data persistence is ready for all features.

**Acceptance Criteria:**
- **Given** a running PostgreSQL instance, **When** `prisma migrate deploy` runs, **Then** all tables (users, user_profiles, resumes, resume_sections, resume_versions, templates, ai_sessions, cover_letters, job_analyses, subscriptions, ai_credits, ai_usage_logs, export_jobs, share_links) are created
- **And** pgvector extension is enabled with HNSW indexing
- **And** GIN indexes on JSONB columns are created
- **And** Prisma client is generated and importable from `packages/database`
- **And** seed script inserts 3 default ATS-safe templates

### Story 1.4: User Registration & Authentication

As a job seeker,
I want to sign up and log in using my preferred method,
So that I can access Lolos and start building my CV.

**Acceptance Criteria:**
- **Given** a new user on the sign-up screen, **When** they choose WhatsApp OTP, **Then** a 6-digit OTP is sent to their phone number within 10 seconds
- **Given** a user with a Google account, **When** they click "Sign in with Google", **Then** they are authenticated via OAuth and redirected to the dashboard
- **Given** a user with a LinkedIn account, **When** they click "Sign in with LinkedIn", **Then** they are authenticated via OAuth
- **And** JWT access token (15min, memory-only) and httpOnly refresh token (7 days, rotation) are issued
- **And** max 5 concurrent sessions per user; exceeding invalidates oldest
- **And** failed login rate limit: 5 attempts per 5 minutes per IP
- **And** users can log out, which invalidates all refresh tokens

### Story 1.5: PII Stripping Gateway

As a security architect,
I want a single global NestJS interceptor that strips PII before all LLM API calls,
So that no personal data ever leaves Indonesian jurisdiction.

**Acceptance Criteria:**
- **Given** any outbound LLM API request, **When** the PII stripping interceptor processes it, **Then** fields (name, email, phone, address, photo, NIK/KTP) are replaced with placeholders
- **And** auto-fail if PII regex is detected in outbound payload (HTTP 500 logged)
- **And** audit log records every strip/inject operation with timestamp and user ID
- **And** original PII values are available to PDF/DOCX rendering service only

### Story 1.6: CI/CD Pipeline

As a developer,
I want automated lint, typecheck, test, and deploy on every PR,
So that quality gates are enforced before merge.

**Acceptance Criteria:**
- **Given** a PR opened against `main`, **When** CI runs, **Then** `pnpm lint`, `pnpm typecheck`, and `pnpm test` must all pass before merge is allowed
- **And** `next-bundle-analyzer` report is generated and compared against budget (<180KB initial JS)
- **And** deploy to staging environment on merge to `main`
- **And** production deploy requires manual approval

### Story 1.7: PWA Service Worker & Offline Shell

As a mobile user on variable Indonesian internet,
I want the app to install on my home screen and work offline,
So that I can edit my CV even when the connection drops.

**Acceptance Criteria:**
- **Given** a supported browser, **When** user visits Lolos, **Then** PWA install prompt appears after second visit
- **And** Service Worker caches app shell (HTML, CSS, JS, fonts) on install
- **And** `manifest.json` defines app name, icons (192px, 512px), theme color, and `display: standalone`
- **And** offline banner appears within 2 seconds of `navigator.onLine` changing to false
- **And** app is functional offline (static pages load, editor opens cached data)

### Story 1.8: User Settings & Account Management

As a registered user,
I want to manage my profile, language preference, and account settings,
So that I can control my Lolos experience.

**Acceptance Criteria:**
- **Given** an authenticated user, **When** navigating to Settings, **Then** they can update name, photo, phone, and email
- **And** toggle language between Bahasa Indonesia and English
- **And** toggle dark/light mode
- **And** view active sessions and revoke any session
- **And** request account deletion (30-day soft delete grace period)

---

## Epic 2: Resume Editor

**Goal:** User creates and edits a structured CV with sections, sees it rendered on A4 canvas, never loses progress.

### Story 2.1: Resume CRUD & Data Model

As a job seeker,
I want to create, read, update, and delete my resumes,
So that I can manage multiple CVs for different job applications.

**Acceptance Criteria:**
- **Given** an authenticated user with no resumes, **When** they click "Buat CV Baru", **Then** a new blank resume is created with default template assigned
- **Given** a user with existing resumes, **When** viewing the dashboard, **Then** all their resumes are listed as cards with title, template name, last-edited timestamp, and ATS score badge
- **And** user can duplicate, rename, archive, and delete resumes
- **And** resume data is stored as JSONB in `resume_sections` table
- **And** user can have unlimited resumes on Pro/Premium, 1 on Free

### Story 2.2: TipTap Editor with Section Blocks

As a job seeker,
I want to edit my CV using structured sections on an A4 canvas,
So that I can build a professional resume with clear organization.

**Acceptance Criteria:**
- **Given** an open resume, **When** the editor loads, **Then** sections render as discrete blocks on a 210mm×297mm A4 canvas
- **And** section types: Header, Summary, Experience, Education, Skills, Certifications, Projects, Languages, Achievements
- **And** each section has a 6-dot drag handle (visible on hover desktop, always on mobile)
- **And** sections can be reordered via drag-and-drop (dnd-kit) with 200ms spring animation
- **And** "Tambah Section" button opens a menu of available section types
- **And** sections can be toggled visible/hidden, excluded from export
- **And** clicking a section opens inline editing (text fields, date pickers, rich text)

### Story 2.3: Multi-Panel Layout with Mobile Adaptation

As a job seeker,
I want a responsive editor layout that works on both my phone and laptop,
So that I can edit my CV wherever I am.

**Acceptance Criteria:**
- **Given** a desktop viewport (≥1024px), **When** the editor loads, **Then** 3-panel layout is shown: left nav (280px, collapsible to 64px icon-only), center A4 canvas, right panel (360px, collapsible, tabbed: AI Chat | ATS | Template)
- **Given** a mobile viewport (<768px), **When** the editor loads, **Then** bottom tab bar is shown (Bagian | AI | ATS | Pengaturan) and panels open as bottom sheets (70vh)
- **And** bottom status bar shows: ATS score mini ring, word count, last saved timestamp, sync indicator
- **And** right panel remembers last-open tab per session
- **And** left nav (desktop) highlights active section with subtle left-border animation

### Story 2.4: Auto-Save & Offline Persistence

As a job seeker on unstable Indonesian internet,
I want my CV changes saved automatically and never lost,
So that I can edit without fear of losing progress.

**Acceptance Criteria:**
- **Given** the user is editing their CV, **When** any change is made, **Then** changes save to IndexedDB (via Dexie.js) within 800ms
- **And** changes sync to API within 2 seconds when online
- **And** green dot in status bar = synced, yellow = pending sync, red = offline
- **And** if browser is closed mid-edit and reopened, the CV is exactly as left
- **And** field-level last-write-wins conflict resolution if same field edited on two devices
- **And** user is notified if conflict is detected

### Story 2.5: AI Inline Rewrite

As a job seeker,
I want to ask AI to improve specific sections of my CV,
So that my bullet points are more impactful and ATS-friendly.

**Acceptance Criteria:**
- **Given** a section with existing content, **When** user clicks the AI wand icon, **Then** a dropdown appears: "Perbaiki wording", "Buat lebih ATS-friendly", "Singkat jadi 1 baris", "Tambah metrik"
- **And** AI suggestion renders within 3 seconds as a diff view (original struck through, AI version with green border)
- **And** user can "Terapkan" or "Coba Lagi"
- **And** applying an AI suggestion creates a single undo step (⌘Z)
- **And** during AI streaming, the targeted section is write-locked with visual indicator
- **And** highlighting text within a section also shows the AI wand with context-specific options

### Story 2.6: Slash Commands & Keyboard Navigation

As a power user,
I want slash commands and keyboard shortcuts in the editor,
So that I can work faster without touching the mouse.

**Acceptance Criteria:**
- **Given** the editor is focused, **When** user types `/`, **Then** a command palette opens with options: `/pengalaman`, `/pendidikan`, `/skill`, `/sertifikasi`, `/proyek`, `/bahasa`
- **And** `⌘K` opens global command palette with: "Analisis ATS", "Ganti Template", "Export PDF", "Tanya Kak"
- **And** Tab navigates between sections; Shift+Tab navigates backward
- **And** `⌘Z` undoes, `⌘⇧Z` redoes
- **And** `⌘S` is NOT a save shortcut (auto-save is always on) — shows "CV tersimpan otomatis" toast instead

---

## Epic 3: ATS Scoring & Optimization

**Goal:** User sees their ATS score, understands gaps, and improves with one-click fixes.

### Story 3.1: ATS Scoring Engine

As a job seeker,
I want my CV scored across multiple ATS dimensions,
So that I know exactly how to improve my chances of passing screening.

**Acceptance Criteria:**
- **Given** a CV with content, **When** ATS scoring runs, **Then** a 0-100 score is computed from 6 weighted dimensions: Keyword Match (30%), Formatting (20%), Completeness (15%), Readability (15%), Metrics Impact (10%), Optimization (10%)
- **And** scoring runs in a Web Worker to avoid blocking the UI thread
- **And** score updates within 500ms of any edit (debounced)
- **And** formatting dimension detects: two-column layouts, tables, centered text, text boxes, non-standard fonts, headers/footers
- **And** completeness dimension checks all 7 standard sections present

### Story 3.2: ATS Score Visualization

As a job seeker,
I want to see my ATS score visualized beautifully,
So that I feel motivated to improve rather than discouraged.

**Acceptance Criteria:**
- **Given** a computed ATS score, **When** the score dashboard renders, **Then** an SVG ring gauge (120px, 12px stroke) displays the score with gradient color: red(0-40)→amber(41-65)→blue(66-85)→emerald(86-100)
- **And** ring animates from 0 to score via spring physics over 1.5 seconds on first load, 300ms on updates
- **And** 6 category breakdown cards show individual dimension scores with horizontal progress bars, staggered entrance (50ms)
- **And** score history sparkline shows last 5 scores with `pathLength` SVG animation
- **And** score context text: "Rata-rata fresh grad di posisi ini: 62" (when JD provided)
- **And** score never shown without anchor context — never a raw number alone

### Story 3.3: Improvement Suggestions with Quick Fix

As a job seeker,
I want specific, one-click improvements for my CV,
So that I can boost my ATS score without manual editing.

**Acceptance Criteria:**
- **Given** a computed ATS score below 100, **When** viewing the score dashboard, **Then** each category card has an "Improve" button that triggers AI suggestion
- **And** AI suggestion returns within 3 seconds with a diff preview
- **And** "Quick Fix" button applies the suggestion in one click with inline undo
- **And** suggestions are ranked by estimated score impact
- **And** user can apply individual suggestions or "Apply All" (max 3 at a time)
- **And** score re-computes after each fix applied

### Story 3.4: Indonesian ATS Platform Rules

As a job seeker applying to Indonesian companies,
I want my CV validated against the ATS platforms Indonesian employers actually use,
So that my CV passes screening at companies using Talenta, Mekari, or LinovHR.

**Acceptance Criteria:**
- **Given** the ATS scoring engine, **When** platform-specific rules are loaded, **Then** validation for Talenta (Mekari), LinovHR, and GreatDay HR is applied
- **And** rules are stored as JSON configuration files: `config/ats-rules/talenta.json`, `linovhr.json`, `greatday.json` — updateable without deploy
- **And** platform-specific checks: single-column format (all three), DOCX preferred for Talenta, standard Indonesian section headers ("Pengalaman Kerja" not "Work Experience")
- **And** DOCX exports pass `mammoth.extractRawText()` verification (>95% text extraction)
- **And** PDF exports pass `pdftotext` verification (>90% text extraction)

### Story 3.5: ATS Score Dashboard (Desktop 3-Panel)

As a desktop user,
I want a comprehensive ATS dashboard in a dedicated panel,
So that I can deep-dive into every dimension of my CV's performance.

**Acceptance Criteria:**
- **Given** a desktop viewport (≥1024px), **When** ATS tab is selected in right panel, **Then** score ring, 6 category cards, and sparkline are displayed in a 360px panel
- **And** hovering a category card reveals the "Improve" button (opacity-0 → opacity-100 transition)
- **And** clicking a category card scrolls the editor to that section
- **And** score history sparkline animates `pathLength` from 0 to full on first render
- **And** each progress bar uses `role="progressbar"` with `aria-valuenow`

---

## Epic 4: AI Career Interview

**Goal:** User talks to Kak in natural Bahasa Indonesia, gets a CV draft from the conversation.

### Story 4.1: Kak Chat Interface

As a job seeker,
I want to chat with Kak through a familiar messaging interface,
So that building a CV feels like talking to a helpful friend.

**Acceptance Criteria:**
- **Given** the user opens the AI interview, **When** the chat loads, **Then** Kak's first message streams in within 1 second: "Halo! Aku Kak, asisten karirmu. Yuk kita bikin CV bareng. Ceritain dikit ya — kamu lulusan apa?"
- **And** chat bubbles use WhatsApp-inspired design: Kak left-aligned (bg-white/light, rounded 16px, top-left 4px), user right-aligned (bg-indigo-500, white text)
- **And** messages animate in with `initial={{ opacity: 0, y: 10 }}` 200ms spring
- **And** typing indicator shows 3 dots with staggered 300ms bounce + contextual label: "Membaca jawaban...", "Menyusun pengalaman..."
- **And** suggested reply chips appear below Kak's messages: tap to send instantly
- **And** input area has voice note button and send button (⌤ icon)

### Story 4.2: Adaptive Question Engine

As a job seeker with a unique career background,
I want Kak to ask relevant questions that adapt to my answers,
So that the interview feels personalized, not scripted.

**Acceptance Criteria:**
- **Given** the user's first 3 responses, **When** the career stage classifier runs, **Then** user is classified into 1 of 6 stages: Fresh Grad, Early Career, Mid Career, Executive, Career Switcher, Freelancer
- **And** question tree adapts: Fresh Grad ≤30 questions (weights: Education 35%, Experience 20%), Executive ≤45 questions (weights: Experience 50%, Leadership 25%)
- **And** follow-up questions trigger when answer length <20 words or no metrics detected
- **And** code-switching handled: "saya pernah doing project management di startup" understood correctly
- **And** user can say "skip" or "nanti" at any question; topic is deferred, not lost
- **And** after 45 questions, Kak offers bullet-point mode to reduce fatigue

### Story 4.3: Structured Data Extraction

As a job seeker,
I want Kak to automatically extract my career details from our conversation,
So that I don't have to manually fill in forms after chatting.

**Acceptance Criteria:**
- **Given** each user response, **When** the extraction pipeline runs, **Then** structured resume facts are extracted via function calling (OpenAI structured outputs)
- **And** extracted data is stored as JSONB in `resume_sections` with source citation (which message)
- **And** fact verification runs after extraction: confidence <70% triggers a clarification question from Kak
- **And** contradictions are flagged (e.g., "2019-2021" vs "2 tahun" for same job)
- **And** extraction completes within 2 seconds of user response
- **And** PII fields (name, email, phone, address) are NEVER sent to LLM — stripped by gateway (see Story 1.5)

### Story 4.4: Interview Persistence & Resume

As a job seeker on the go,
I want to pause my interview and continue later,
So that I can build my CV across multiple sessions.

**Acceptance Criteria:**
- **Given** a user closes the browser mid-interview, **When** they return within 7 days, **Then** Kak greets with a summary: "Halo lagi! Kita udah ngisi pengalaman kerja dan pendidikan. Lanjut ke skills ya?"
- **And** interview state persists in Redis with DB backup
- **And** user can start fresh or import data from previous incomplete interview
- **And** after 7 days inactivity, session expires with notification: "Sesi interview kamu sudah kadaluarsa. Mulai baru?"

### Story 4.5: CV Preview & Handoff from Interview

As a job seeker who finished the interview,
I want to see my CV magically appear from our conversation,
So that I feel the value of talking to Kak.

**Acceptance Criteria:**
- **Given** interview completion (≥85% fields or user opts to finish), **When** Kak announces "CV kamu udah jadi!", **Then** 300ms crossfade transitions from chat to CV preview rendered in default template
- **And** ATS score ring animates from 0→score over 1.5s (spring stiffness=60, damping=12)
- **And** confetti burst triggers (canvas-confetti, 30 particles, indigo/violet/emerald, 400ms)
- **And** CV shows the user's actual extracted data — not placeholder content
- **And** one "Quick Win" improvement card is shown: highest-impact, one-click fix
- **And** "Edit CV" and "Export PDF" CTAs are present

### Story 4.6: Kak Persona & Emotional Design

As a job seeker who is anxious about my career,
I want Kak to feel like a supportive coach, not a judgmental robot,
So that I feel more confident after using Lolos, not less.

**Acceptance Criteria:**
- **Given** any Kak message, **When** reviewing the copy, **Then** it uses warm, supportive tone with "Anda" (not "kamu"/"lo"). Never uses the word "nilai" — only "skor"
- **And** ATS education moment delivered before first score: "Perusahaan pakai robot buat baca CV. Robot ini kaku. Tugas aku ngebantu kamu ngomong dalam bahasa robot — tanpa ngilangin suara kamu."
- **And** low score (<50): "Ini awal yang bagus. Semua orang mulai dari sini." Never shaming.
- **And** validates before educating: "Pengalaman organisasi kamu kuat" before suggesting improvement
- **And** micro-celebrations at milestones: first section done ("Mantap! Satu section selesai"), score improves ("Skor naik 5 poin!"), CV downloaded

---

## Epic 5: Templates & Export

**Goal:** User switches between ATS-safe templates without data loss, exports CV as PDF.

### Story 5.1: Template Gallery & Selection

As a job seeker,
I want to browse and switch between professional templates,
So that my CV looks polished for different types of employers.

**Acceptance Criteria:**
- **Given** a user viewing their CV, **When** they open the template gallery, **Then** 3 templates are displayed as preview cards with the user's actual CV data rendered in each
- **And** desktop: 3-column grid. Mobile: horizontal scroll with snap (`drag="x"`)
- **And** hover on desktop: scale 1.02, shadow elevation, "Gunakan Template" overlay
- **And** clicking "Gunakan Template" applies it with 300ms Framer Motion `layoutId` morph animation
- **And** switching templates preserves all CV data — only presentation changes
- **And** active template is indicated with indigo border + "Digunakan" badge

### Story 5.2: Template Definition & Rendering

As a developer,
I want templates defined as React components + JSON config,
So that adding new templates requires zero backend changes.

**Acceptance Criteria:**
- **Given** a template config JSON, **When** the renderer loads, **Then** CV data is rendered with the template's layout, fonts, colors, spacing, and section order
- **And** template config schema: `{ id, name, layout: 'single-column', fonts: { heading, body }, colors: { primary, secondary, accent, text, background, heading }, spacing: { sectionGap, entryGap, paddingX, paddingY }, sectionOrder: [...] }`
- **And** same React component tree renders in browser (DOM preview) and server (Puppeteer → PDF)
- **And** server PDF matches browser preview with <2% pixel difference
- **And** template version is pinned to resume at creation time

### Story 5.3: PDF Generation via BullMQ Worker

As a job seeker,
I want to export my CV as a professional PDF,
So that I can send it to employers.

**Acceptance Criteria:**
- **Given** a user clicks "Export PDF", **When** the job is queued, **Then** a BullMQ job is created in the `export` queue with priority based on user tier
- **And** Puppeteer renders the CV from the shared template renderer with CSS @page layout (A4)
- **And** PDF includes embedded text layer (not image-based), standard PDF fonts, metadata (Title: "CV - {Name}")
- **And** P50 generation <5s, P95 <15s (warm browser pool: min 2, max 10)
- **And** free tier: subtle "Made with Lolos" footer in 8pt gray. Paid: no watermark
- **And** file size <500KB for 2-page CV
- **And** progress indicator updates at 25/50/75/100% in the UI

### Story 5.4: Export Queue & Download Flow

As a job seeker,
I want to track my export progress and download when ready,
So that I'm not left wondering if my CV was generated.

**Acceptance Criteria:**
- **Given** an export job is queued, **When** viewing the UI, **Then** a progress bar shows generation status
- **And** download starts automatically when complete
- **And** if user navigates away, a toast notification appears: "CV kamu siap di-download!" with link
- **And** failed exports retry up to 3 times with exponential backoff, then move to DLQ
- **And** user sees "Gagal generate PDF. Coba lagi?" with retry button on failure
- **And** exported file naming: `CV_{Nama}_{Posisi}.pdf`
- **And** cost-per-job tracked in job metadata for AI cost monitoring

### Story 5.5: DOCX Generation (V2 Marker)

As a job seeker applying to Indonesian companies,
I want to export my CV as DOCX,
So that I can comply with Indonesian HR department format preferences.

**Acceptance Criteria:**
- **Given** a user clicks "Export DOCX", **When** generation runs, **Then** `docx` (npm) generates a DOCX file from JSON-config template
- **And** generation completes in <500ms per resume
- **And** output passes `mammoth.extractRawText()` verification (>95% text extraction)
- **And** DOCX opens correctly in Microsoft Word, Google Docs, and LibreOffice
- **And** format is ATS-safe: single-column, no tables, no text boxes, standard Indonesian section headers
- **And** logged as V2 deferred — implement when DOCX is prioritized

---

## Epic 6: Share, Referral & Landing Page

**Goal:** User shares CV, earns referral credits, and new users discover Lolos through a world-class landing page.

### Story 6.1: Shareable Resume Link

As a job seeker proud of my CV,
I want to share it via a link or WhatsApp,
So that employers can view it online and my friends can discover Lolos.

**Acceptance Criteria:**
- **Given** a user wants to share their CV, **When** they click "Bagikan", **Then** a unique URL is generated: `lolos.app/cv/{uuid}`
- **And** the share page renders the CV as a responsive web page (<2s load on mobile)
- **And** privacy controls: public, password-protected, expiry (7/30/90 days), view cap (1,000 views)
- **And** view analytics: view count, referrer breakdown, average time spent
- **And** native share sheet opens with Web Share API on mobile → WhatsApp with pre-filled message
- **And** WhatsApp pre-filled message: "CV gue dari 52% ke 91% pake Lolos! Coba gratis: {link}"
- **And** user can revoke any share link with one click

### Story 6.2: Referral Credits System

As a job seeker,
I want to earn free AI credits by referring friends,
So that I can use more features without paying.

**Acceptance Criteria:**
- **Given** a user shares their referral link, **When** someone signs up via that link, **Then** referrer gets +50 AI credits credited within 30 seconds of referee's first CV completion
- **And** referee gets +25 bonus credits on signup
- **And** referral tracked via 24h cookie + server-side attribution fallback
- **And** fraud prevention: max 10 referrals per device fingerprint per month
- **And** referral dashboard shows: total referrals, credits earned, pending credits
- **And** credits reset monthly, unused roll over up to 2× monthly limit

### Story 6.3: Landing Page — Hero & How It Works

As a potential user,
I want to immediately understand what Lolos does and how it works,
So that I'm convinced to try it.

**Acceptance Criteria:**
- **Given** a visitor lands on the homepage, **When** the hero loads, **Then** headline "CV ATS-mu, siap dalam hitungan menit" reveals character-by-character (typewriter, 40ms/char)
- **And** floating 3D resume cards animate with mouse-driven parallax (rotateY ±5°, translateZ)
- **And** gradient background: subtle indigo-to-violet radial
- **And** CTA: "Buat CV Gratis" (primary) + "Lihat Demo" (outline)
- **And** social proof badge: "10,000+ CV dibuat bulan ini"
- **And** below hero, 3-step "How It Works" reveals on scroll: (1) Ngobrol sama Kak, (2) AI Bikin CV, (3) Lamar & Diterima. Connected by animated progress line. Each step stagger-enters via `useInView`.

### Story 6.4: Landing Page — AI Demo & ATS Showcase

As a potential user,
I want to see Lolos in action before signing up,
So that I trust it actually works.

**Acceptance Criteria:**
- **Given** the AI Demo section, **When** scrolled into view, **Then** an embedded chat widget shows a pre-scripted conversation between "Rina" and Kak (4-5 exchanges, typewriter effect 30ms/char)
- **And** conversation culminates in an animated CV preview card reveal
- **And** "Coba sendiri — gratis!" CTA below
- **And** ATS Showcase section show before/after comparison cards: "CV Biasa: 52%" (red, muted) vs "CV dengan Lolos: 94%" (emerald glow, elevated)
- **And** SVG ring gauges animate from 0→score on scroll (useInView, spring physics, 1.5s)
- **And** testimonial quote: "Saya kira CV saya sudah bagus. Ternyata ATS tidak bisa bacanya."

### Story 6.5: Landing Page — Templates, Features & Pricing

As a potential user,
I want to see the templates, features, and pricing,
So that I can evaluate if Lolos is worth upgrading.

**Acceptance Criteria:**
- **Given** the Templates section, **When** scrolled into view, **Then** horizontal scrollable cards on mobile (drag="x", snap), 4-col grid on desktop show template previews with real Indonesian CV content
- **And** Features section uses CSS Grid bento layout (`repeat(4, 1fr)`), AI Career Coach card spans 2×2, cards stagger-enter on scroll (80ms staggerChildren)
- **And** Pricing section shows 3 tiers: Gratis, Pro "Paling Populer" (highlighted glow border, indigo gradient), Premium
- **And** Monthly/Annual toggle with `AnimatePresence mode="wait"` price transition
- **And** "Mulai gratis — tidak perlu kartu kredit" below pricing

### Story 6.6: Landing Page — Testimonials, FAQ & CTA

As a potential user,
I want social proof and answers to my questions,
So that I feel confident signing up.

**Acceptance Criteria:**
- **Given** the Testimonials section, **When** visible, **Then** auto-advancing carousel (5s interval, pause on hover) shows testimonials with photo, name, role, quote, ATS transformation badge ("52% → 91%"), and star rating
- **And** FAQ section uses accordion with `AnimatePresence` height animation and real-time search filter
- **And** Final CTA: "CV impianmu tinggal 5 menit lagi" with "Buat CV Gratis" primary CTA and WhatsApp chat option
- **And** Footer: logo, links, social icons, language switcher, copyright
- **And** all sections implement JSON-LD structured data (Organization, WebApplication, FAQ)

### Story 6.7: Landing Page — Navbar, Dark Mode & SEO

As a visitor,
I want the landing page to work in dark mode, load fast, and be findable on Google,
So that I have a premium experience regardless of my preferences.

**Acceptance Criteria:**
- **Given** the landing page, **When** scrolling down, **Then** navbar transitions from transparent → blur backdrop (`backdrop-filter: blur(12px)`) + border-bottom after 100px scroll
- **And** mobile hamburger menu animates open/close with staggered link entrance
- **And** dark mode toggle in navbar switches between light (`#fafafa`) and dark (`#0f0f11`) via CSS custom properties
- **And** preference persisted in localStorage, respects `prefers-color-scheme`
- **And** page renders as static HTML (SSG) with ISR for dynamic sections
- **And** hreflang tags for ID/EN versions
- **And** LCP<1.5s, TBT<200ms, CLS<0.05 on mid-range Android 4G

---

## Epic 7: Payment & Subscription

**Goal:** User upgrades to Pro/Premium via local payment methods, subscription renews transparently, business generates revenue.

### Story 7.1: Xendit Payment Gateway Integration

As a user ready to upgrade,
I want to pay with GoPay, QRIS, or bank transfer,
So that I can subscribe using the payment methods I already use daily.

**Acceptance Criteria:**
- **Given** a user clicks "Upgrade to Pro", **When** the checkout flow opens, **Then** payment method options shown in priority order: GoPay, QRIS, Virtual Account (BCA, Mandiri, BRI), DANA
- **And** Xendit invoice is created with correct amount (Pro: Rp 49K/mo or Rp 449K/yr, Premium: Rp 75K/mo or Rp 749K/yr)
- **And** GoPay payment: user redirected to GoPay app or shown QR code
- **And** QRIS: single QR code scannable by all Indonesian e-wallets
- **And** Virtual Account: unique VA number generated, user pays via mobile banking or ATM
- **And** payment confirmation webhook updates subscription status within 30 seconds
- **And** failed payment: user sees retry option and alternative payment methods

### Story 7.2: Subscription Management

As a paying user,
I want to manage my subscription,
So that I can upgrade, downgrade, or cancel anytime.

**Acceptance Criteria:**
- **Given** an authenticated user, **When** viewing subscription settings, **Then** current plan, renewal date, and payment method are displayed
- **And** user can upgrade from Pro → Premium (prorated)
- **And** user can switch from monthly to annual billing (prorated)
- **And** user can cancel subscription (downgrade to Free at period end, data retained 180 days)
- **And** cancel flow includes "pause instead" option (data safe, reminder sent after 30/60/90 days)
- **And** annual billing: 24% discount Pro, 17% discount Premium
- **And** student pricing: verified `.ac.id` email gets 50% off Pro

### Story 7.3: AI Credit System

As a user,
I want to see my AI credit balance and understand consumption,
So that I know when to upgrade or buy more credits.

**Acceptance Criteria:**
- **Given** a user on any tier, **When** viewing the credit meter, **Then** current balance, monthly allocation, and used this month are displayed
- **And** credit costs are transparent per operation: AI Interview (20), Section Rewrite (5), ATS Analysis (3), Cover Letter (15, V2), Job Match (10, V2)
- **And** credits reset on the 1st of each month; unused roll over up to 2× monthly limit
- **And** credit exhaustion modal appears: "Kamu kehabisan kredit. Upgrade atau top up?"
- **And** credit top-up options: 100 credits Rp 15K, 500 credits Rp 59K, 1000 credits Rp 99K
- **And** credit usage log shows history: date, operation, credits consumed, remaining balance

### Story 7.4: Pricing Page & Checkout UX

As a potential customer,
I want to understand pricing clearly and check out smoothly,
So that I feel confident upgrading.

**Acceptance Criteria:**
- **Given** the pricing page, **When** loaded, **Then** 3-tier comparison is shown with feature checklist and checkmark animations
- **And** monthly/annual toggle with spring transition between prices
- **And** "Pro" card highlighted with glow border + "Paling Populer" badge
- **And** checkout flow is single-page, no redirects
- **And** one-click payment for returning users (saved payment method via Xendit tokenization)
- **And** payment success → immediate credit allocation + celebration toast: "Selamat! Kamu sekarang Pro!"
- **And** abandoned checkout: WhatsApp notification within 2 hours with return link

### Story 7.5: Revenue Analytics & Subscription Dashboard (Internal)

As the business owner,
I want to see MRR, churn, conversion, and AI costs,
So that I can make data-driven decisions about pricing and costs.

**Acceptance Criteria:**
- **Given** an admin user, **When** viewing the analytics dashboard, **Then** MRR, ARPU, churn rate, and conversion rate are displayed with trend lines
- **And** AI cost per user tier (Free/Pro/Premium) tracked daily
- **And** cost-per-operation breakdown (which AI operations cost the most)
- **And** subscription events logged: created, renewed, upgraded, downgraded, cancelled, expired
- **And** payment failure rate by method
- **And** credit top-up revenue tracked separately from subscription revenue

## Epic List

### Epic 1: Foundation, Auth & Infrastructure
**User Outcome:** User can sign up via WhatsApp/Google/LinkedIn, log in securely, and the platform is ready for development. Developer has working CI/CD, database, monorepo, and design tokens.
**FRs covered:** FR21
**NFRs covered:** NFR2 (PII Gateway), NFR5 (PWA scaffold), NFR7 (bundle budget)
**ARs covered:** AR1, AR2, AR5, AR6, AR11, AR12
**UX covered:** UX-DR7, UX-DR8, UX-DR9

### Epic 2: Resume Editor
**User Outcome:** User creates and edits a structured CV with sections (Experience, Education, Skills), sees it rendered on an A4 canvas, and never loses progress thanks to auto-save. User gets immediate value — a working CV without AI.
**FRs covered:** FR6, FR7, FR8, FR9
**NFRs covered:** NFR4 (accessibility), NFR5 (offline persistence)
**UX covered:** UX-DR3

### Epic 3: ATS Scoring & Optimization
**User Outcome:** User sees their ATS score with 6-dimension breakdown, understands what to improve, and applies one-click fixes. User experiences the "aha moment" — "skor saya 52, bisa naik ke 91."
**FRs covered:** FR10, FR11, FR12, FR13
**NFRs covered:** NFR4 (accessibility)
**UX covered:** UX-DR2, UX-DR4

### Epic 4: AI Career Interview
**User Outcome:** User talks to Kak in natural Bahasa Indonesia. Kak interviews them about their career, extracts structured data, and feeds it directly into the working editor. The conversation becomes a CV — this is the differentiator.
**FRs covered:** FR1, FR2, FR3, FR4, FR5
**NFRs covered:** NFR1 (AI first-token<500ms), NFR6 (AI cost), NFR3 (AI fallback)
**ARs covered:** AR3, AR4, AR9
**UX covered:** UX-DR1, UX-DR10

### Epic 5: Templates & Export
**User Outcome:** User switches between ATS-safe templates without losing data, exports CV as PDF (and DOCX in V2), and tracks export progress. CV is ready to send to employers.
**FRs covered:** FR14, FR15, FR16, FR17 (V2), FR18
**NFRs covered:** NFR1 (PDF P50<5s), NFR3 (queue resilience)
**ARs covered:** AR7, AR10

### Epic 6: Share, Referral & Landing Page
**User Outcome:** User shares CV via WhatsApp, earns referral credits when friends sign up, and new users discover Lolos through a world-class landing page with animations and SEO.
**FRs covered:** FR19, FR20
**UX covered:** UX-DR6

### Epic 7: Payment & Subscription
**User Outcome:** User upgrades to Pro/Premium via GoPay/QRIS/Virtual Account, sees AI credit balance, and subscription renews transparently. The business generates revenue.
**NFRs covered:** NFR2 (payment security), NFR6 (credit tracking)
**ARs covered:** AR8 (ISR for SEO/pricing pages)
