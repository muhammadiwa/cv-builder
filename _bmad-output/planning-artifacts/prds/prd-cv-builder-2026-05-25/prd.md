---
title: 'PRD: Lolos — AI-Powered ATS Resume Builder'
status: draft
created: 2026-05-25
updated: 2026-05-25
---

# PRD: Lolos

## 0. Document Purpose

This PRD is for the product team, downstream UX design (`bmad-create-ux-design`), technical architecture (`bmad-create-architecture`), and epic/story breakdown (`bmad-create-epics-and-stories`). It builds on the Lolos Product Brief (`brief-cv-builder-2026-05-24`) and four research documents. It does not duplicate the brief's vision, problem statement, or competitive analysis — it adds the detail needed to build.

**How to read this document:** The Glossary (§3) defines every domain noun. Functional Requirements (§4) reference User Journeys by ID. Success Metrics (§7) cross-reference FRs. Assumptions are tagged `[ASSUMPTION: ...]` inline and indexed in §9.

---

## 1. Vision

Lolos is not a resume builder. Lolos is a **translator** between Indonesian professionals and recruitment machines that were not designed for them. It converts a natural conversation in Bahasa Indonesia — about someone's career, skills, and goals — into a structured, ATS-optimized CV that passes through Talenta, Mekari, Greenhouse, Workday, and every other screening system Indonesian employers actually use. The "CV builder" interface is the delivery mechanism. The product is the data pipeline that eliminates the information asymmetry between job seekers and automated hiring systems.

Where a traditional resume builder optimizes for visual appeal, Lolos optimizes for **parseability, discoverability, and match.** Where competitors serve English-speaking professionals in Western markets at Western prices, Lolos serves Indonesian job seekers in their language, on their phones, at their price point.

Five years from now, Lolos is not a CV tool — it is the standard gateway through which Indonesian professionals enter the job market, and the data layer that makes that market transparent.

---

## 2. Target User

### 2.1 Primary Personas

**Rina, 22 — Fresh Graduate (V1 Primary)**
Yogyakarta. 50+ applications, zero interviews. Uses Oppo A-series on 4G. Does not know ATS exists. Her CV is a Canva template with two columns, icons, and a photo. She needs a tool that does the thinking for her — asks questions, builds the CV, tells her why it works. Willing to pay Rp 0-49K/month. Mobile-only. Bahasa Indonesia only.

**Dimas, 30 — Career Switcher (V2 Primary)**
Jakarta. Logistics supervisor moving into tech product management. Has 8 years of experience but cannot translate it into tech-industry language. Uses Samsung mid-range + work laptop. Needs AI that understands career pivots and can reframe operational experience as transferable skills. Willing to pay Rp 100-200K/month.

**Adi, 27 — Tech Talent (V1 Secondary)**
Bandung. Software engineer with 5 years experience. Thinks GitHub is his resume. Resents HR gatekeeping. Wants ATS score proof that his CV passes screening. Uses iPhone + MacBook. Willing to pay Rp 150-300K/month. Bilingual (ID+EN).

### 2.2 Jobs To Be Done

- **JTBD-1:** When I am applying to jobs and don't know why I never hear back, I want an AI to interview me about my career and build a CV that actually reaches human eyes, so that I stop feeling invisible.
- **JTBD-2:** When I need to apply to 20 different roles this week, I want to tailor my CV for each job description in minutes — not hours — so that I can apply to more jobs without burning out.
- **JTBD-3:** When I have built a CV but I'm not sure it will work, I want to see exactly what an ATS sees when it reads my CV — my score, my gaps, my missing keywords — so that I know what to fix before I send it.
- **JTBD-4:** When I land a job interview, I want to share my success and help my friends do the same, so that we all benefit from the tool that got me there.

### 2.3 Non-Users (V1)

- Enterprise HR teams and recruiters (V3+)
- Non-Indonesian speakers (V2 English support)
- Users seeking creative/design-heavy resumes (out of scope permanently — product is ATS-first)

### 2.4 Key User Journeys

**UJ-1. Rina membuat CV pertamanya dalam 10 menit.**
- **Persona + context:** Rina, fresh graduate, belum pernah bikin CV serius. Baru lulus, bingung mulai dari mana.
- **Entry state:** Baru sign up via Google. Belum punya data apapun di Lolos.
- **Path:** (1) Kak menyapa: "Halo! Aku Kak, asisten karirmu. Yuk kita bikin CV bareng. Kamu lulusan jurusan apa?" (2) Rina jawab "Teknik Informatika UGM." (3) Kak lanjut tanya pengalaman — magang, organisasi, proyek kuliah. Rina cerita soal proyek akhir dan jadi asisten dosen. (4) Setelah 12 pertanyaan, Kak bilang "CV kamu udah jadi nih! Lihat yuk." (5) Rina lihat preview CV lengkap dengan ATS score 78 — "Bagus, tapi bisa lebih baik. Mau aku bantu optimasi?" (6) Rina klik "Optimasi" — Kak suggest tambahkan keywords dari job description yang Rina paste.
- **Climax:** Rina lihat ATS score naik dari 78 ke 91. Kak bilang "Sekarang CV kamu siap dilirik HRD!"
- **Resolution:** Rina download PDF (gratis, watermark subtle) dan langsung apply ke 3 lowongan via link yang Kak kasih.
- **Edge case:** Kalau Rina gak punya pengalaman kerja sama sekali, Kak tanya: "Punya pengalaman organisasi atau volunteer? Itu juga dihargai loh sama HRD."

**UJ-2. Adi mengoptimasi CV-nya untuk satu job spesifik.**
- **Persona + context:** Adi, software engineer, ingin apply ke GoTo. Dia paste job description dari LinkedIn.
- **Entry state:** Sudah login. Sudah punya 1 CV dasar dari AI interview sebelumnya.
- **Path:** (1) Adi paste JD GoTo di Job Match Analyzer. (2) Sistem ekstrak keywords: Go, Kubernetes, gRPC, sistem terdistribusi. (3) ATS score awal: 64 — "Skill Go dan Kubernetes belum muncul di CV-mu." (4) Adi klik "Tambah Skill" — Kak generate bullet points tentang pengalaman Adi yang relevan dengan Go (padahal dia belum pernah pakai Go, tapi dia expert di Rust — skill transfer). (5) Adi review dan approve suggestion. (6) Score naik ke 88. Adi export DOCX dan apply.
- **Climax:** Job match overlay: "CV kamu 88% cocok. 3 kandidat lain dengan score di atas 90% sudah apply. Mau aku bantu naikin lagi?"
- **Resolution:** Adi puas dengan 88%, download DOCX.

**UJ-3. Rina share CV-nya ke teman dan dapat referral credits.**
- **Persona + context:** Rina, baru selesai bikin CV, excited dengan hasilnya.
- **Entry state:** Baru download PDF. Dashboard menampilkan ATS score 91.
- **Path:** (1) Rina lihat tombol "Bagikan ke Teman." (2) Klik — buka WhatsApp share sheet. (3) Kirim pesan: "Gila sih, CV gw dari 52% ke 91% pake ini. Coba deh, gratis!" dengan link referral. (4) Temannya sign up — Rina dapat notifikasi "+50 AI credits." (5) Temannya selesai bikin CV — Rina dapat tambahan +25 credits.
- **Climax:** Rina lihat credit counter naik real-time setelah share.
- **Resolution:** Rina jadi power user — setiap kali temannya daftar, dia dapat credits.

---

## 3. Glossary

- **ATS (Applicant Tracking System)** — Software used by employers to parse, filter, and rank job applications before human review. In Indonesia, common ATS include Talenta (Mekari), LinovHR, GreatDay HR, Greenhouse, Workday, SmartRecruiters.
- **ATS Score** — A 0-100 metric indicating how well a CV is expected to perform against ATS screening, calculated across six dimensions: keyword match (30%), formatting (20%), completeness (15%), readability (15%), metrics impact (10%), and optimization (10%).
- **ATS Parse Test** — Automated test that runs a generated PDF/DOCX through an ATS simulator or actual ATS API, measuring text extraction rate and field mapping accuracy.
- **Kak** — The AI career coach persona. An older-sibling figure: warm, helpful, semi-formal (uses "Anda"), asks one question at a time, praises good answers, gently probes thin ones.
- **CV (Curriculum Vitae)** — In Indonesian context, used interchangeably with "resume." A structured document containing personal info, work experience, education, skills, and achievements. Lolos outputs CV in both PDF and DOCX formats.
- **AI Interview** — A conversational onboarding flow where Kak asks the user about their career and extracts structured data into a CV. NOT a form — natural language, adaptive questioning, Bahasa Indonesia.
- **Template** — A predefined CV layout (fonts, spacing, section ordering, colors) encoded as a React component with CSS custom properties. Templates are ATS-safe by construction: single-column, standard fonts, no tables, no text boxes, no graphics. V1 ships 3 templates. Users apply a template to their CV data; switching templates does not lose data.
- **Resume Draft** — A user's in-progress CV, stored as structured JSON in PostgreSQL JSONB columns. One user can have multiple drafts. Each draft is associated with one Template and one language (ID or EN in V2).
- **Resume Version** — A point-in-time snapshot of a CV, created on each export. Stored in `resume_versions` table as immutable JSONB. Used for version history and rollback.
- **Job Match Analysis** — Comparing a user's CV against a pasted job description. Returns: match percentage, missing keywords, missing skills, gap recommendations, and diff visualization. V2 feature.
- **AI Credit** — Unit of AI consumption. Different operations consume different credit amounts. Free users get 50/month. Pro users get 300/month. Premium users get 600/month. Credits reset monthly. Unused credits roll over up to 2x the monthly limit.
- **PII (Personally Identifiable Information)** — Name, email, phone, address, photo, NIK/KTP. Per UU PDP, PII is never sent to external LLM APIs. It is injected at the PDF/DOCX rendering stage only.

---

## 4. Features

### 4.1 AI Conversational Interview

**Description:** The core user acquisition and CV creation flow. Kak (the AI career coach) interviews the user in natural Bahasa Indonesia, adapts questions based on career stage, extracts structured resume data, and produces a complete CV draft. This replaces the traditional form-based resume builder. Realizes UJ-1.

The interview follows a state machine with six career-stage branches (Fresh Grad, Early Career, Mid Career, Executive, Career Switcher, Freelancer). Each stage has a question tree: base questions → follow-up probes based on answer depth (word count, metrics detected, STAR elements). Questions adapt based on detected industry and language (handles code-switching — "saya pernah doing project management di startup").

**Functional Requirements:**

#### FR-1: Adaptive Question Flow
The system must conduct an interview using a structured question tree with dynamic follow-ups. After the first 3 responses, the system classifies the user into one of six career stages. Question sequence, depth, and count adapt accordingly. Fresh grads get ≤30 questions. Executives get ≤45. Realizes UJ-1.

**Consequences (testable):**
- System classifies career stage within 3 exchanges (±1 stage accuracy).
- Follow-up questions trigger when answer length <20 words or no metrics detected.
- User can say "skip" or "nanti" at any question; the topic is deferred, not lost.

#### FR-2: Streaming Chat Interface
Kak's responses must stream token-by-token using Server-Sent Events (SSE) via the Vercel AI SDK. The UI shows a typing indicator (three dots, staggered 300ms animation) with contextual labels ("Membaca jawaban...", "Menyusun pengalaman..."). Suggested quick-reply chips appear below Kak's messages. Realizes UJ-1.

**Consequences (testable):**
- First token renders within 500ms of user message send.
- Typing indicator label rotates every 2 seconds.
- User can tap a chip to send it as their response instantly.

#### FR-3: Structured Data Extraction
After each user response, the system extracts structured resume facts via function calling (OpenAI structured outputs / Anthropic tool use). Extracted data is stored as JSONB in `resume_sections`. A fact verification step runs after extraction — if confidence <70%, Kak asks a clarification question rather than silently inferring. Realizes UJ-1.

**Consequences (testable):**
- Extraction completes within 2 seconds of user response.
- Verification flags contradictions (e.g., "2019-2021" vs "2 tahun" for same job).
- PII fields (name, email, phone, address, photo) are never sent to LLM APIs.

#### FR-4: Interview Persistence and Resume
User can close the browser mid-interview and return within 7 days to continue from the last question. Interview state is stored in Redis with DB backup. On return, Kak greets with a summary of progress and resumes from the incomplete field. Realizes UJ-1.

**Consequences (testable):**
- Interview state survives browser close and 7-day gap.
- Returning user sees: "Halo lagi! Kita udah ngisi pengalaman kerja dan pendidikan. Lanjut ke skills ya?"
- After 7 days of inactivity, session expires. User can start fresh or import previous extracted data.

#### FR-5: CV Preview and Handoff
After the interview completes (≥85% of required fields filled or user opts to finish), Kak announces completion: "CV kamu udah jadi! Lihat yuk." The system transitions from chat UI to the resume editor with a 300ms crossfade animation. The CV is rendered in the default template. The ATS score ring animates from 0 to the computed score over 1.5 seconds. Realizes UJ-1.

**Consequences (testable):**
- Transition animation completes in 300ms (crossfade).
- ATS score ring animation: spring physics, 1.5s duration.
- User sees their actual CV data in the template — not placeholder content.

**Feature-specific NFRs:**
- AI interview API: P95 response time <3s per question (including extraction).
- Maximum conversation turns: 50. After 45, Kak offers bullet-point mode.
- Model: GPT-4o-mini for conversation, function calling for extraction.

**Notes:**
- `[ASSUMPTION: 12 questions is the right base count — validated by beta testing.]`
- `[ASSUMPTION: Code-switching (ID+EN) will be handled by the LLM natively — no pre-processing pipeline needed for V1.]`

---

### 4.2 Resume Editor

**Description:** The core document editing surface. After the AI interview produces a CV draft, the user edits it in a structured editor powered by TipTap (ProseMirror). Sections are discrete blocks with drag handles. Each section has an AI "wand" button for inline AI rewriting. Slash commands (`/`) open a command palette. Changes auto-save every 800ms to IndexedDB and every 2s to the API. Realizes UJ-1 (editing phase), UJ-2.

**Functional Requirements:**

#### FR-6: Structured Section Editing
The editor presents the CV as an A4 canvas (210mm × 297mm) with discrete section blocks: Header, Summary, Experience, Education, Skills, Certifications, Projects, Languages, Achievements. Each section is a TipTap node with a 6-dot drag handle (visible on hover, always on mobile). Sections can be reordered via drag-and-drop (dnd-kit). Sections can be toggled visible/hidden. Realizes UJ-1 editing phase.

**Consequences (testable):**
- Drag-and-drop reorder: 200ms spring animation on drop, data persists immediately.
- Hidden sections are excluded from PDF/DOCX output.
- ATS completeness dimension updates in real-time as sections are added/removed.

#### FR-7: AI Inline Rewrite
Each section has an AI "wand" icon button. Clicking it opens a dropdown: "Perbaiki wording", "Buat lebih ATS-friendly", "Singkat jadi 1 baris", "Tambah metrik". Highlighting text within a section also shows the wand with context-specific options. AI-generated suggestions appear as a diff (original struck through, AI version with green border). User clicks "Apply" or "Coba lagi." Each AI action is a single undo step. Realizes UJ-2.

**Consequences (testable):**
- AI suggestion renders within 3 seconds of wand click.
- Diff view: original text visible, AI text clearly distinguished.
- Undo (⌘Z) reverts the AI change in one step. Redo (⌘⇧Z) reapplies.
- Write-lock: during AI stream, user cannot edit the targeted section. Lock releases on completion or cancel.

#### FR-8: Multi-Panel Layout
Desktop: Left sidebar (section navigator, 280px, collapsible to icon-only 64px), Center (A4 canvas with live preview, scrollable), Right panel (AI assistant, ATS breakdown, template tweaks — 360px, collapsible, tabbed), Bottom status bar (ATS score mini ring, word count, last saved timestamp, connection indicator). Mobile: Bottom tab bar (Bagian | AI | ATS | Pengaturan), panels open as bottom sheets via Sheet component. Realizes UJ-1 editing phase.

**Consequences (testable):**
- Desktop: all three panels independently resizable. Right panel remembers last-open tab per session.
- Mobile: bottom sheets slide up over 70% viewport. Swipe down to dismiss.
- Status bar: green dot = synced, yellow dot = pending sync, red dot = offline.

#### FR-9: Auto-Save and Offline Persistence
Changes save to IndexedDB (via Dexie.js) every 800ms. Changes sync to API every 2 seconds. If offline, changes queue in IndexedDB and sync when online via Background Sync API. Offline banner: "Kamu sedang offline. Perubahan tersimpan lokal." Realizes all UJs.

**Consequences (testable):**
- IndexedDB write completes within 50ms.
- API sync: optimistic update. On failure, rollback to last known server state.
- Offline banner appears within 2 seconds of `navigator.onLine` change.
- Sync reconciliation: if server state and local state diverge (multi-device), latest timestamp wins with user notification.

**Feature-specific NFRs:**
- Editor first contentful paint: <2s on mid-range Android, 4G connection.
- TipTap editor bundle: <150KB gzipped (lazy-loaded, not in initial bundle).
- Keystroke-to-render latency: <16ms (single frame).

**Notes:**
- `[ASSUMPTION: Three templates (Professional, Modern, Minimal) is sufficient for V1. User feedback may escalate template count for V2.]`

---

### 4.3 ATS Scoring Engine

**Description:** Real-time ATS compatibility analysis across six dimensions. The score is computed client-side by a Web Worker to avoid blocking the UI thread, with server-side verification for export. Results render as an animated ring gauge and six category breakdown cards. Each card has an "Improve" button that triggers AI suggestion. Realizes JTBD-3, UJ-1 climax, UJ-2.

**Functional Requirements:**

#### FR-10: Six-Dimensional Scoring
The system computes an ATS score (0-100) from six weighted dimensions: Keyword Match (30% — TF-IDF + semantic similarity against target job description if provided, or industry baseline), Formatting (20% — font compatibility, no tables/columns/text boxes, section header standard naming), Completeness (15% — all standard sections present), Readability (15% — bullet quality, action verbs, sentence length), Metrics Impact (10% — quantified achievements detected), Optimization (10% — length, keyword density, section order). Realizes JTBD-3.

**Consequences (testable):**
- Score updates within 500ms of any edit (debounced, Web Worker).
- Formatting dimension: detects and flags two-column layouts, tables, centered text, text boxes, non-standard fonts, headers/footers.
- Indonesian-specific: flags photo placement, KTP/NIK fields, agama field, marital status — optional, user chooses.

#### FR-11: ATS Score Visualization
Score renders as an SVG ring gauge (120px diameter, 12px stroke). Color gradient: 0-40 red (#ef4444), 41-65 amber (#f59e0b), 66-85 blue (#3b82f6), 86-100 emerald (#10b981). Ring animates from 0 to score via spring physics over 1.5 seconds on first load, 300ms on subsequent updates. Six category breakdown cards below with horizontal progress bars and staggered entrance animation (50ms stagger). Realizes UJ-1 climax.

**Consequences (testable):**
- Ring animation: spring stiffness=60, damping=12, 1.5s to settle.
- Category bars animate on viewport entry (IntersectionObserver, once: true).
- Score <40: doom-scroll prevention — first card shown is "Perbaiki ini dulu" with highest-impact fix, not the full six-card breakdown.

#### FR-12: Improvement Suggestions with Quick Fix
Each category card has an "Improve" button. Clicking triggers AI to generate a specific suggestion. For high-impact, automatable fixes (missing keywords, weak action verbs, missing metrics), a "Quick Fix" button applies the change in one click with inline undo. Suggestions are ranked by estimated score impact. Realizes JTBD-3, UJ-2.

**Consequences (testable):**
- AI suggestion returns within 3 seconds.
- "Quick Fix" applies and shows diff within 1 second.
- Score re-computes after fix applied.

#### FR-13: Indonesian ATS Platform Validation
The ATS scoring engine includes validation rules specific to Indonesian HR platforms: Talenta (Mekari), LinovHR, GreatDay HR. Rules include: single-column format mandatory (all three fail on multi-column), DOCX preferred over PDF for Talenta (97% vs 76% parsing accuracy per research), section headers must use standard Indonesian terms ("Pengalaman Kerja" not "Work Experience"), photo placement rules, KTP/NIK field handling. These rules are maintained as a configuration file, not hardcoded — updateable without deploy. Realizes JTBD-3.

**Consequences (testable):**
- Platform-specific validation rules file: `config/ats-rules/{platform}.json`. Updated via CMS or PR.
- DOCX exports pass `mammoth.extractRawText()` verification: >95% text extraction.
- PDF exports pass `pdftotext` verification: >90% text extraction.

**Notes:**
- `[ASSUMPTION: Indonesian ATS validation rules will be manually curated initially, with automated testing against real platforms added in V2.]`

---

### 4.4 Template System

**Description:** Pluggable CV templates that define layout, typography, colors, and section ordering. Templates are ATS-safe by construction. Users select a template after the AI interview (or switch anytime). Template switching uses Framer Motion `layoutId` for morphing animation. V1 ships 3 templates. Realizes UJ-1 template selection.

**Functional Requirements:**

#### FR-14: Template Selection and Switching
After the AI interview, the user sees a horizontal scrollable template gallery with their CV data pre-rendered in each template. Card hover shows a larger preview. "Gunakan Template" applies the template with a 300ms morphing animation (layoutId). Switching templates does not lose data — the CV data model is shared, only the presentation layer changes. Realizes UJ-1 template selection.

**Consequences (testable):**
- Template switching: animation completes in 300ms. No data loss.
- Gallery: 3 cards, horizontal scroll on mobile (drag="x" with snap).
- Active template indicator on the selected card.

#### FR-15: Template Definition
Each template is a React component with CSS custom properties and a JSON config: `{ id, name, layout ('single-column'), fonts: { heading, body }, colors: { primary, secondary, accent, text, background, heading }, spacing: { sectionGap, entryGap, paddingX, paddingY }, sectionOrder: [...] }`. V1 templates are hardcoded in the application. V2+ adds a template marketplace. Template rendering uses the same React component tree for both in-browser preview and server-side PDF generation (react-pdf for server, DOM for preview). Realizes all UJs.

**Consequences (testable):**
- Server-rendered PDF matches browser preview with <2% pixel difference.
- Template config is pure JSON — no code change needed to adjust colors/spacing.
- Template versions: when a template is updated (V2), existing CVs remain pinned to the version they were created with. User can manually upgrade with a diff preview.

---

### 4.5 Export System

**Description:** PDF and DOCX generation with ATS-safe rendering. V1: PDF export with subtle watermark on free tier. V2: DOCX export. Export uses BullMQ queue for async processing with progress UI. Realizes UJ-1 download, UJ-2 download.

**Functional Requirements:**

#### FR-16: PDF Generation
Server-side PDF generation via Puppeteer (headless Chrome) with CSS @page layouts. Text layer embedded (not image-based). Standard 14 PDF fonts embedded as subset. Metadata fields set: Title = "CV - {Name} - {Position}", Author = "{Name}". File naming: `CV_{Nama}_{Posisi}.pdf`. Free tier: subtle "Made with Lolos" footer in 8pt gray on last page. Paid tier: no watermark. Realizes UJ-1 download.

**Consequences (testable):**
- PDF generation: P50 <5s, P95 <15s (warm Puppeteer pool).
- Text extraction via `pdftotext`: >90% of text preserved.
- File size: <500KB for 2-page CV.
- Puppeteer browser pool: minimum 2 warm instances, max 10. Cold start <8s.

#### FR-17: DOCX Generation (V2)
Server-side DOCX generation via `docx` (npm) with JSON-config templates. ATS-safe: single-column, no tables, no text boxes, standard section headers in Bahasa Indonesia. Post-generation verification via `mammoth.extractRawText()`. Realizes UJ-2 download.

**Consequences (testable):**
- DOCX generation: <500ms per resume.
- Text extraction via mammoth: >95% text preserved.
- DOCX opens correctly in Microsoft Word, Google Docs, and LibreOffice.

#### FR-18: Export Queue and Progress
PDF and DOCX generation are queued via BullMQ `export` queue. The UI shows a progress indicator during generation. On completion, the download starts automatically. If the user navigates away, a notification appears: "CV kamu siap di-download!" with a link. Failed exports retry up to 3 times with exponential backoff, then move to dead letter queue with user notification. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- Export job: priority queue, paid users get higher priority.
- Progress updates at 25%, 50%, 75%, 100%.
- Failed export: user sees "Gagal generate CV. Tim kami sudah diberitahu. Coba lagi nanti?" with retry button.
- Queue resilience: survives Redis restart, 0 data loss. Recovers within 5 seconds.

---

### 4.6 Shareable Resume & Referral

**Description:** Users can share their CV via a unique URL or directly to WhatsApp. The share link is a public profile page. Built-in referral tracking credits the sharer when their link drives signups. Realizes UJ-3.

**Functional Requirements:**

#### FR-19: Shareable Resume Link
Each CV can generate a shareable link: `lolos.app/cv/{uuid}`. The link renders the CV as a responsive web page. Privacy controls: public (anyone with link), password-protected, expiry (7/30/90 days), view cap (1,000 views). View analytics: view count, referrer breakdown. Share button opens native share sheet on mobile (Web Share API) and WhatsApp share sheet with pre-filled message. Realizes UJ-3.

**Consequences (testable):**
- Share link page renders in <2s on mobile.
- UUID v4 — effectively unguessable. Password protection adds bcrypt layer.
- WhatsApp share: pre-filled message = "CV gue naik dari 52% ke 91% pake Lolos. Coba deh, gratis!"

#### FR-20: Referral Credits
Each user has a unique referral code. When someone signs up via their link or code, both referrer and referee get bonus AI credits: referrer +50 credits, referee +25 credits on first CV completion. Referral tracking via UTM parameters and server-side attribution. Referral dashboard shows: total referrals, credits earned, pending credits. Realizes UJ-3.

**Consequences (testable):**
- Referral attribution: 24-hour cookie window + server-side fallback.
- Credits credited within 30 seconds of referee's first CV completion.
- Fraud prevention: max 10 referrals per device fingerprint per month.

---

### 4.7 Authentication & User Management

#### FR-21: Multi-Method Authentication
Users can sign up/login via: WhatsApp OTP (primary, 6-digit, 5-min TTL, 3 req/hour), Google OAuth, LinkedIn OAuth, or email magic link. Social accounts are always linked to a local user record. QRIS and GoPay authentication for payment (not login). Session: JWT access token (15min, memory-only) + httpOnly refresh token (7 days, rotation on use). Max 5 concurrent sessions per user. Realizes all UJs.

**Consequences (testable):**
- WhatsApp OTP: delivered within 10 seconds, TTL 5 minutes.
- Session revocation: changing password/logging out invalidates all refresh tokens.
- Audit log: login timestamps, IP, device fingerprint.

---

## 5. Non-Goals (Explicit)

- **Creative/visual-first CV templates.** Lolos is ATS-first. Templates that sacrifice parsability for design are permanently out of scope.
- **Human resume review service.** V1-V2 are AI-only. Human review may be a V3 marketplace feature.
- **Job board or job listing aggregation.** Lolos optimizes CVs for jobs; it does not host jobs. Integration with job boards (Jobstreet, Glints) for direct apply is V3.
- **Enterprise recruiter dashboard.** V1-V2 are B2C only. Employer-side features are V3+.
- **Native mobile apps (iOS/Android).** V1-V2 are PWA. Native apps are V3+ if PWA adoption or capability gaps warrant.
- **Multi-language CV beyond ID + EN.** V1 is Bahasa Indonesia only. V2 adds English. Additional languages are not planned.
- **CV translation service.** The AI can optimize content; it does not translate between languages. Bilingual CV management (V2) means maintaining two separate CVs in two languages, not machine-translating between them.

---

## 6. MVP Scope

### 6.1 In Scope (V1 — Month 1)

- AI conversational interview in Bahasa Indonesia (FR-1 through FR-5)
- TipTap resume editor with structured sections (FR-6 through FR-9)
- ATS scoring engine with 6 dimensions and Indonesian platform rules (FR-10 through FR-13)
- 3 ATS-safe templates with selection and switching (FR-14, FR-15)
- PDF export with free-tier watermark (FR-16, FR-18)
- Shareable resume link with WhatsApp sharing (FR-19)
- Referral credits system (FR-20)
- Multi-method authentication (FR-21)
- AI credit system (50/300/600 monthly per tier)
- GoPay + QRIS + Virtual Account payment via Xendit
- Mobile-responsive PWA with offline editing
- Error handling and graceful degradation for all AI-dependent features

### 6.2 Out of Scope for MVP (V2+)

- DOCX export `[NON-GOAL for MVP — V2]`
- English language support (UI + AI) `[NON-GOAL for MVP — V2]`
- AI cover letter generator `[NON-GOAL for MVP — V2]`
- Job match analyzer (FR-2 in brief) `[NON-GOAL for MVP — V2]`
- Resume version history `[NON-GOAL for MVP — V2]`
- Template marketplace `[NON-GOAL for MVP — V3]`
- Premium template designer tools `[NON-GOAL for MVP — V3]`
- AI interview practice mode `[NON-GOAL for MVP — V3]`
- LinkedIn profile optimizer `[NON-GOAL for MVP — V3]`
- Chrome extension for job application auto-fill `[NON-GOAL for MVP — V3]`
- Enterprise/university dashboard `[NON-GOAL for MVP — V3]` `[NOTE FOR PM: This is emotionally load-bearing for the "platform" vision — revisit at V2 gate if university inbound demand is significant.]`

---

## 7. Success Metrics

**Primary**
- **SM-1: AI Interview Completion Rate** — % of users who start the AI interview and reach the CV preview screen. Target: >70% at 90 days post-launch. Validates FR-1 through FR-5.
- **SM-2: First Export Rate** — % of registered users who export (download or share) at least one CV within 7 days of signup. Target: >40%. Validates FR-16 through FR-19.
- **SM-3: Free-to-Paid Conversion** — % of free users who upgrade to Pro or Premium. Target: >5% at Month 3. Validates overall product value and pricing model.

**Secondary**
- **SM-4: Day-30 Retention** — % of users who return and take any action (edit, score, export) within 30 days of signup. Target: >25% at Month 3. Validates product stickiness.
- **SM-5: ATS Score Improvement** — Average absolute difference between user's initial ATS score (first CV) and their highest score within 30 days. Target: >15 points improvement. Validates FR-10 through FR-13.
- **SM-6: Share-to-Signup Rate** — % of share link viewers who sign up. Target: >8%. Validates FR-19, FR-20.
- **SM-7: NPS** — Net Promoter Score from monthly user survey. Target: >30 at Month 3. Validates overall user satisfaction.

**Counter-metrics (do not optimize)**
- **SM-C1: AI Credit Consumption** — Total credits consumed per user per month. Do NOT optimize for maximum consumption (creates perverse incentive to waste credits). Counterbalances SM-3.
- **SM-C2: Session Duration** — Time spent in the editor. Do NOT optimize for longer sessions (Lolos should be fast). Counterbalances SM-4.
- **SM-C3: CV Count per User** — Number of CVs per user. Do NOT optimize for quantity (quality over quantity — one great CV beats five mediocre ones). Counterbalances SM-1.

---

## 8. Cross-Cutting NFRs

### 8.1 Performance
- Page load (editor): FCP <2s, LCP <3s on mid-range Android, 4G Indonesian connection.
- AI interview: first token <500ms, full response <3s per question.
- PDF generation: P50 <5s, P95 <15s (warm worker).
- API responses (non-AI): P95 <500ms.
- Lighthouse: Performance >85, Accessibility >90, Best Practices >90.
- Bundle size: initial JS <150KB gzipped, editor lazy-loaded <150KB gzipped.

### 8.2 Security & Privacy
- UU PDP compliance: primary database in Indonesian data center (AWS ap-southeast-3 or Alibaba Cloud Jakarta). Explicit, separable consent for AI processing. DPO appointed. Data subject rights portal (access, correction, erasure within 14 days, portability). Breach notification <3×24 hours to Kominfo.
- PII never sent to external LLM APIs (OpenAI, Anthropic, Google). Injected at PDF/DOCX rendering stage.
- Encryption: AES-256 at rest (database + S3), TLS 1.3 in transit, HSTS preloaded.
- Password hashing: bcrypt (cost factor 12). Session tokens: JWT + httpOnly refresh with rotation.
- Rate limiting: 10 AI calls/hour/user, 50 req/min/IP unauthenticated, 200 req/min/IP authenticated.
- Share links: UUID v4 (128-bit entropy), optional password protection, expiry, view cap.
- Prompt injection prevention: blocklist pattern filtering, structured delimiters (`<user_input>` tags), output validation scan.

### 8.3 Reliability
- Overall uptime target: 99.5% (allows for 3.65 hours downtime/month).
- AI provider fallback: if primary model unavailable, automatic failover to secondary within 10 seconds.
- Redis (BullMQ queue): survives restart, 0 data loss, recovers within 5 seconds.
- Database: RDS Multi-AZ with automated daily backups. RPO <5 minutes (transaction log shipping every 5 min). RTO <1 hour (automated failover).
- PDF worker pool: minimum 2 warm instances always available.
- Graceful degradation: if all AI providers are down, editor functions in manual mode. User sees: "Kak sedang istirahat sebentar. Kamu tetap bisa edit CV-mu secara manual."

### 8.4 Accessibility
- WCAG 2.1 AA compliance for the editor and all public-facing pages.
- Keyboard navigation: complete Tab order through all editor sections, toolbar, panels.
- Screen reader: all UI elements have aria-labels. PDF output includes tagged PDF structure for screen reader compatibility.
- axe-core scan: 0 critical violations before every release.
- Color contrast: minimum 4.5:1 for normal text, 3:1 for large text.

---

## 9. Constraints and Guardrails

### 9.1 AI Cost
- Per-free-user AI cost: <$0.08/month (50 credits, cached).
- Per-paid-user AI cost: <$0.48/month (Pro, 300 credits, cached).
- AI spend cap: $0.10/user/day hard limit. Alert at 80% of daily budget.
- Combined optimization (semantic cache + model tiering + prompt compression): target 65-75% cost reduction vs unoptimized baseline.

### 9.2 Data Residency
- Primary user data (PII, CVs, AI sessions): must reside in Indonesian territory (AWS ap-southeast-3 or Alibaba Cloud Jakarta).
- AI API calls to external providers (OpenAI, Anthropic, Google): permitted with explicit user consent and PII stripped. Documented in privacy policy as cross-border data transfer.

### 9.3 Content Safety
- AI-generated content must not fabricate experience, skills, or qualifications.
- Fact verification step after extraction: flag confidence <70%, trigger clarification.
- User must explicitly approve each AI-generated section before it enters the CV.
- Prohibited: generating CV content for roles the user has not held.

---

## 10. Monetization

### 10.1 Pricing Tiers
| Tier | Price (IDR) | Price (USD) | AI Credits/mo | Key Differentiators |
|------|------------|-------------|---------------|---------------------|
| Gratis | Rp 0 | $0 | 50 | 1 CV, basic template, PDF with "Made with Lolos" footer, ATS score view-only |
| Pro | Rp 49K/mo | ~$3.50 | 300 | Unlimited CVs, all templates, full ATS scoring + suggestions, PDF no watermark |
| Premium | Rp 75K/mo | ~$5.00 | 600 | All Pro + priority AI, premium templates, bilingual CV (V2), advanced analytics |

Annual billing: Pro Rp 449K/yr (24% discount), Premium Rp 749K/yr (17% discount). Student pricing: 50% off Pro with verified .ac.id email. `[NOTE FOR PM: Pricing validated by market research but not yet by live A/B test. Run pricing experiment within 2 weeks of launch — test Rp 39K vs Rp 49K vs Rp 59K for Pro.]`

### 10.2 AI Credit Consumption
| Operation | Credits |
|-----------|---------|
| AI interview (full flow, one-time) | 20 |
| AI section rewrite (per section) | 5 |
| ATS score analysis (per run) | 3 |
| Cover letter generation (V2) | 15 |
| Job match analysis (V2) | 10 |

Credits reset monthly. Unused credits roll over up to 2× monthly limit. Credit top-up: 100 credits Rp 15K, 500 credits Rp 59K, 1000 credits Rp 99K.

---

## 11. Why Now

- **Market window:** Zero dedicated AI resume tools in Bahasa Indonesia. The global AI resume builder market is growing at 13.1% CAGR (to $5B by 2035). First-mover advantage in Indonesia is available but won't last — Canva or a local startup will enter within 18-24 months.
- **ATS acceleration:** Talenta grew from 250 to 1,000+ enterprise clients in 18 months. Indonesian companies are adopting ATS faster than job seekers are learning about it. The knowledge gap is widening — Lolos bridges it.
- **Payment infrastructure maturity:** QRIS reached 60.77M users. GoPay, DANA, ShopeePay are mainstream. For the first time, an Indonesian SaaS can collect recurring payments from the mass market without credit cards.
- **AI cost inflection:** GPT-4o-mini, Gemini Flash, and Claude Haiku have driven per-token costs down 10-20x since 2023. A conversational CV builder that would have been uneconomical two years ago is viable today at IDR 49K/month pricing.

---

## 12. Open Questions

1. **Business model beyond B2C subscriptions.** Victor's critique is valid — unemployed Gen Z have limited WTP. What is the B2B or government revenue path? Kartu Prakerja integration? Employer-sponsored CV tools? University licensing? `[NOTE FOR PM: Schedule strategy session on B2B revenue before V2.]`
2. **AI interview optimal question count vs. completion rate.** 12 questions is assumed. Beta testing must validate: what question count maximizes completion rate × CV quality? If completion drops below 60% at 12 questions, reduce.
3. **Template count for V1.** 3 templates assumed. Is the difference between Professional, Modern, and Minimal meaningful enough that users perceive choice — or do they all look similar because they are all ATS-safe (single-column, no graphics)?
4. **DOCX in V1?** Market research shows Indonesian HR departments strongly prefer DOCX (97% vs 76% PDF parsing on Talenta). Deferring DOCX to V2 risks frustrating early adopters. Should it be P0?
5. **Pricing validation.** Pro at Rp 49K and Premium at Rp 75K are research-backed but untested. First-month A/B test: Rp 39K/49K/59K for Pro — confirm price point before scaling marketing spend.

---

## 13. Assumptions Index

- `[ASSUMPTION: 12 questions is the right base count for AI interview — §4.1 FR-1.]`
- `[ASSUMPTION: Code-switching (ID+EN) handled natively by LLM — §4.1 FR-1.]`
- `[ASSUMPTION: 3 templates sufficient for V1 — §4.2 FR-9.]`
- `[ASSUMPTION: Indonesian ATS validation rules manually curated initially — §4.3 FR-13.]`
- `[ASSUMPTION: GPT-4o-mini sufficient for conversation quality in Bahasa Indonesia — §4.1 NFRs.]`
- `[ASSUMPTION: 5% free-to-paid conversion achievable — §7 SM-3.]`
- `[ASSUMPTION: PWA sufficient for mobile experience; native apps not needed until V3+ — §6.2.]`
- `[ASSUMPTION: GoPay + QRIS + VA via Xendit covers >95% of Indonesian payment scenarios — §4.7.]`
