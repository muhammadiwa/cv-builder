---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 14]
lastStep: 14
status: complete
inputDocuments:
  - brief-cv-builder-2026-05-24/brief.md
  - prd-cv-builder-2026-05-25/prd.md
  - market-ats-resume-builder-indonesia-sea-research-2026-05-24.md
  - market-indonesia-ecosystem-deepdive-research-2026-05-24.md
  - technical-cv-builder-stack-research-2026-05-24.md
---

# UX Design Specification: Lolos

**Author:** Juragan
**Date:** 2026-05-25

---

## Executive Summary

### Project Vision
Lolos translates natural career conversations in Bahasa Indonesia into ATS-optimized CVs. It is not a document editor with AI bolted on — it is an AI-native career companion where the primary interface is conversation, not forms. The product is a translator between Indonesian professionals and recruitment machines that were not designed for them.

### Target Users
- **Rina (22, Fresh Grad):** V1 primary persona. Mobile-only (Oppo A-series, 4G). Zero ATS awareness. Needs full guidance — from blank slate to complete CV. Bahasa Indonesia only. Willing to pay Rp 0-49K/month.
- **Adi (27, Tech Talent):** V1 secondary. Already has a CV. Needs ATS scoring, job-specific optimization, and proof his CV passes screening. Bilingual. Desktop + mobile. Willing to pay Rp 150-300K/month.
- **Dimas (30, Career Switcher):** V2 primary. Has experience but needs AI to translate it into a new industry's language.

### Key Design Challenges
1. **Kak → Editor Transition:** The handoff from conversational AI to structured editor is the most psychologically risky moment. User has invested 10-15 minutes in conversation — the transition must feel like a reveal, not abandonment.
2. **Mobile-First Resume Editing:** TipTap on a 6-inch screen with a soft keyboard. Touch targets, toolbar positioning, section reordering without drag-and-drop.
3. **ATS Score Psychology:** Reveal mechanics for low scores must not discourage. High scores must earn celebration. Score must always come with context ("rata-rata pelamar di posisi ini: 58").
4. **Conversational ↔ Manual Mode:** Users flow between AI-guided and self-directed editing. State transitions must be clear, granular (per-section), and reversible.
5. **Offline Resilience:** Indonesian internet is variable across regions. Progress must never be lost. Auto-save every interaction.

### Design Opportunities
1. **Kak as UX Moat:** A personality, not a chatbot. Emotional connection no competitor replicates. Warm, supportive, helpful — like an older sibling who happens to be a career coach.
2. **ATS Score as Viral Hook:** "CV gue dari 52% ke 91%!" is a transformation story users want to share. Build sharing into the celebration moment.
3. **WhatsApp-Native Distribution:** 96% penetration. Seamless share → referral → growth loop.
4. **Progressive Disclosure:** Guided simplicity for fresh grads (Rina sees a clean, simple flow). Power tools for tech talent (Adi sees advanced options).

---

## Core User Experience

### Defining Experience

The core experience is a **conversation that produces a document.** The interaction model is:

1. **Talk to Kak** — Natural chat in Bahasa Indonesia about career, education, skills, achievements. Kak asks one question at a time, adapts to answers, knows when to probe and when to move on.
2. **See Your CV** — Kak announces completion: "CV kamu udah jadi! Lihat yuk." A preview appears with the CV rendered in the default template. This is the "aha" moment.
3. **Understand Your Score** — ATS score animates in with context. "78/100 — lumayan untuk draft pertama. Rata-rata fresh grad di posisi ini: 62. Yuk kita tingkatkan."
4. **Polish & Export** — Edit in the structured editor, get AI suggestions, switch templates, export to PDF.

**Core loop (iterative, not linear):** Chat ⇄ Preview ⇄ Score ⇄ Reflect ⇄ Edit ⇄ Export → Share

The core loop is a conversation, not an assembly line. Users iterate: they chat, see a preview, get a score, reflect on what to improve, edit, score again, and loop until satisfied. The product must support this back-and-forth — never forcing the user forward before they're ready.

**"Done" criteria:** ATS score ≥80, or user explicitly marks CV as "Siap Apply." Without a clear exit, users loop forever or give up.

### Platform Strategy

- **Primary:** Mobile-first PWA (Progressive Web App). Installable to home screen, offline support via Service Worker + IndexedDB.
- **Secondary:** Desktop web (responsive, not a separate app).
- **Not in V1:** Native iOS/Android apps. PWA provides offline, install, and push notification capabilities sufficient for V1-V2.
- **Key constraints:** Mid-range Android devices (Samsung A-series, Xiaomi Redmi, Oppo A-series). 4G connections with variable reliability (urban 10Mbps+, rural 2-5Mbps). Users are data-conscious — keep bundle sizes small.
- **Offline behavior:** Resume editing works offline (IndexedDB). AI features require connectivity — degrade gracefully: cached responses where possible, clear "Kak sedang offline" banner, never lose typed content, queue AI requests for when connectivity returns.
- **Input tension acknowledged:** Typing a full work history on a phone is painful. Kak uses chat as primary input but interleaves structured quick-picks (tap to select skills, choose from suggestions) and offers voice input for longer responses. Goal: minimize free-text typing on mobile, maximize structured input.

### Effortless Interactions

What should feel magical:
- **Warm entry, not blank screen.** User never sees an empty chat. Kak always greets first: "Halo! Aku Kak, asisten karirmu. Ceritain sedikit tentang dirimu — jurusan apa? Ada pengalaman yang paling kamu banggakan?" First message arrives within 1 second of page load on mid-range Android.
- **Auto-save always.** Never a save button. Progress persists through browser close, connection loss, app switch. Auto-save indicator visible: green dot = synced, yellow = pending, red = offline.
- **One-click improvements** (not "one-click fix everything"). ATS keyword suggestions: tap to add. Formatting cleanup: one button. Grammar fixes: accept/reject inline. Each suggestion scoped to one specific change — never "AI fix everything" which erodes trust.
- **Template switching without data loss.** Change templates anytime. CV data persists. Switching is an animation (Framer Motion `layoutId` morph), not a migration.
- **Share in two taps.** Tap share → native share sheet (Web Share API) → WhatsApp opens with pre-filled message + CV link. No copy-paste, no file management.

### Critical Success Moments

1. **First Kak message.** The make-or-break moment. Kak must deliver a warm, specific greeting within 1 second of page load on mid-range Android. The first message sets the tone for the entire relationship: natural, curious, helpful — not robotic. "Halo! Aku Kak, asisten karirmu. Yuk kita bikin CV bareng. Ceritain dikit ya — kamu lulusan apa? Atau lagi kuliah?"

2. **CV Preview reveal.** The Hero's Journey climax: the conversation becomes a document. 300ms crossfade from chat to CV rendered in the default template. ATS score ring animates from 0 to score over 1.5 seconds (spring physics). The preview proves Kak truly listened — this is the user's story, structured.

3. **First ATS score.** Defines the emotional relationship with the product. Critical framing rules:
   - Never show a raw score number first. Always with anchor context.
   - Low score (<50): "Ini awal yang bagus — semua orang mulai dari sini. Yuk kita tingkatkan bareng."
   - One immediate, high-impact suggestion visible.
   - Score is always a *growth meter*, not a judgment.
   - The word "nilai" (grade) must never appear — use "skor" with growth framing.

4. **First export.** Must work flawlessly on mobile. Download starts immediately with progress indicator. File naming is clean: `CV_Rina_Sari_ContentWriter.pdf`. Platform-specific format guidance: "Kirim ke Jobstreet? Pakai PDF. Kirim langsung ke HRD? DOCX lebih disukai di Indonesia."

5. **First return visit.** Kak remembers the user's name, CV is exactly as they left it. Kak has a relevant suggestion waiting: "Hai Rina! CV kamu udah 78 minggu lalu. Ada lowongan Content Writer baru di Gojek — mau Kak bantu sesuaikan?"

### Kak Relationship Arc

Kak is not a static chatbot. The relationship deepens over time:
- **Session 1 (Stranger → Guide):** Kak is warm but professional. Asks questions, builds the CV, celebrates the first preview. User learns to trust Kak.
- **Session 3 (Guide → Coach):** Kak remembers the user's industry, career stage, previous ATS scores. Suggestions become personalized. "Sejak terakhir, skor kamu naik 15 poin. Bagian pengalaman udah makin kuat."
- **Session 10+ (Coach → Companion):** Kak knows the user's career trajectory. Proactive suggestions: "Udah 3 bulan sejak CV terakhir. Mau update? Ada sertifikasi baru?"

### Micro-Coaching Loops

Feedback happens *during* the work, not at the end. After completing each section: one-line validation plus one suggestion. "Pengalaman organisasi kamu kuat — itu nilai tambah di mata HRD Indonesia. Mau Kak bantu tambahin satu bullet point lagi?" This replaces the "write everything, then get judged at the end" model that crushes Rina's confidence.

### ATS Education Moment

Before the first ATS score, Kak delivers an empowering explanation: "Jadi gini. Sebagian besar perusahaan sekarang pakai sistem robot buat baca CV sebelum dilihat manusia. Robot ini... agak kaku. Dia kadang nolak CV yang sebenernya bagus, cuma gara-gara formatnya aneh. Nah, tugas aku di sini ngebantu kamu ngomong dalam bahasa robot ini — tanpa ngilangin suara kamu sebagai manusia. Oke? Yuk kita lihat skor kamu."

### Experience Principles (Constraint-Based)

1. **Conversation over configuration.** *Constraint: No screen may present more than one decision before value is delivered.*
2. **Reveal, don't dump.** *Constraint: Never show more than 3 improvement suggestions at once. Never show a raw ATS score without anchor context and an actionable next step.*
3. **Coach, not judge.** *Constraint: Every ATS score must include exactly one high-impact, one-click improvement. The word "nilai" (grade) must never appear — use "skor" (score) with growth framing.*
4. **Validate before you educate.** *Constraint: Before any suggestion to improve, acknowledge one thing the user did well — specific to their content, not generic.*
5. **Mobile-first, not mobile-responsive.** *Constraint: Every interaction usable on a 6-inch 720p screen with soft keyboard open. Minimum touch target: 44px. No horizontal scrolling required.*
6. **Indonesian-first.** *Constraint: All UI copy written in Bahasa Indonesia first, translated to English second. CV conventions default to Indonesian norms (photo, personal details, IPK format). English conventions are an explicit toggle, not the default.*
7. **The system is broken, not the user.** *Constraint: Any sentence that could be interpreted as blaming the user for a low score must be rewritten. "Your CV lacks keywords" → "ATS is looking for keywords that aren't in your CV yet. Let's add them."*

### Failure State Treatment

| Failure | Emotional Risk | Design Response |
|---------|---------------|-----------------|
| AI service down | Abandonment, frustration | "Kak sedang istirahat sebentar. Kamu tetap bisa edit CV-mu manual. Data kamu aman." Full editor access, AI features disabled with clear indicator. |
| Connection lost mid-interview | Panic, data loss fear | Auto-save confirmation immediately visible. "Koneksi terputus, tapi jawaban kamu udah tersimpan. Lanjutin pas online ya." Resume exactly where they left off. |
| ATS score below 40 | Shame, discouragement | Never show raw score. Frame as starting point with massive growth potential. "Semua orang mulai dari sini. Rata-rata fresh grad naik 30 poin dalam 3 sesi." One-click "Quick Win" button to immediately boost 10+ points. |
| PDF generation fails | Frustration, distrust | Retry with clear feedback. "Gagal generate PDF. Tenang, data CV kamu aman. Coba lagi?" Retry button, fallback to simpler renderer. |
| User abandons mid-flow | Guilt, feeling of failure | No guilt on return. "Hai! Lanjutin ya?" No "you didn't finish" language. Just "pick up where you left off." |

---

## Desired Emotional Response

### Primary Emotional Goals

**The user must feel:** Seen, capable, and guided — not judged, processed, or abandoned.

1. **"Saya bukan masalahnya."** Rina has been rejected 50+ times with zero feedback. She blames herself. Lolos must reframe her experience: the system is broken, not her. The AI doesn't judge her qualifications — it translates them for broken machines.

2. **"Saya bisa."** Every interaction should leave the user more confident than before. Not "your CV scored 45" — "here are 3 things you can fix in 2 minutes to get to 70."

3. **"Ada yang bantu saya."** Kak is not a tool — Kak is a companion. The user should feel accompanied through the entire journey, never alone with a blank screen.

### Emotional Journey Mapping

| Stage | Current Emotional State | Desired Emotional State | How We Get There |
|-------|------------------------|------------------------|------------------|
| **First touch** | Anxious, confused ("Mulai dari mana?") | Welcomed, curious | Warm entry — Kak greets first, asks one simple question, no blank screen |
| **During AI interview** | Vulnerable ("Pengalaman gue biasa aja") | Validated, understood | Kak reframes every answer positively, finds the hidden value |
| **CV Preview reveal** | Nervous ("Kayak apa ya?") | Delighted, surprised | Celebration animation, "CV kamu udah jadi!" reveal |
| **First ATS score** | Scared ("Pasti jelek") | Motivated, informed | Score as growth meter with anchor context, immediate actionable next step |
| **Editing & improving** | Overwhelmed ("Terlalu banyak") | In control, guided | One suggestion at a time, micro-coaching per section |
| **Exporting** | Anxious ("Beneran udah siap?") | Confident, accomplished | Clear "done" criteria, platform-specific format guidance |
| **Sharing** | Excited, proud | Proud, generous | "CV gue dari 52% ke 91%!" — celebration + referral in one action |
| **Returning** | "Ngapain balik?" | Curious, engaged | Kak remembers progress, has a new suggestion or insight waiting |
| **Offline/error** | Frustrated, anxious ("Data gue ilang?") | Calm, reassured | Auto-save confirmation, clear offline indicator, progress never lost |

### Micro-Emotions

**Must maximize:**
- **Trust over Skepticism** — Kak proves competence by asking insightful follow-up questions, not generic ones. The CV preview matches what the user described.
- **Accomplishment over Frustration** — Micro-celebrations at every milestone: first section complete, score improves, CV downloaded.
- **Confidence over Confusion** — Every ATS suggestion includes "why this matters" and "what happens if you skip it."
- **Belonging over Isolation** — "70% fresh graduate mulai di skor 50-an. Kamu 62 — udah di atas rata-rata!" User sees themselves in a community of job seekers.

**Must avoid:**
- **Judgment** — Numbers without context, negative language, comparison to "ideal" CVs
- **Abandonment** — Blank screens, silent loading, no clear next step
- **Overwhelm** — Too many suggestions at once, complex UI, jargon

### Design Implications (Emotion → Screen)

| Emotion | UX Decision | Concrete Implementation |
|---------|------------|----------------------|
| **Trust** | Kak uses the user's name, remembers previous interactions, never fabricates information | Chat bubble: "Hai Rina!" (uses name). CV preview shows actual user data, not templates. |
| **Confidence** | Micro-coaching per section — feedback happens as the user works, not at the end | After completing "Pengalaman" section: one-line validation + one suggestion. Not a score dump at the end. |
| **Accomplishment** | Celebration animation at milestones | CV preview reveal: confetti + ring animation. Score improvement: toast. First export: success screen. |
| **Guidance** | One suggestion at a time. "Quick Fix" buttons. | ATS suggestions: single card with "Terapkan" button. Never a wall of 10+ problems. |
| **Safety** | Auto-save always visible. Offline indicator clear but not alarming. | Status bar: green/yellow/red dot. "Data kamu aman" messaging. |
| **Pride** | Shareable transformation story built into score improvement moment | Share card: "CV gue dari 52% → 91% pake Lolos!" with referral link. |
| **Belonging** | Contextual benchmarks show user where they stand | "Rata-rata fresh grad di posisi ini: 62. Kamu: 78." |

### Emotional Design Principles

1. **Validate before you educate.** Before telling the user what to fix, acknowledge what's already working. "Pengalaman organisasi kamu kuat — itu nilai tambah di mata HRD Indonesia."

2. **Reveal, don't dump.** Never show a full ATS breakdown as the first thing. Show the score. Show one improvement. Let the user explore deeper if they want.

3. **Celebrate the small wins.** First section done? Animation. Score naik 5 poin? Toast. CV terdownload? Confetti moment. Rina needs evidence she's making progress.

4. **Coach through the scary moments.** Low ATS score? "Ini awal yang bagus." Blank section? "Banyak orang bingung di sini. Kak bantu ya." Error state? "Nggak apa-apa, data kamu aman."

5. **Make the user the hero.** Kak is the guide. The user's career story is the point. The product helps tell it — it doesn't replace it with AI-generated filler.

---

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Layer 1: Trust & Familiarity — Indonesian Consumer Apps**

These set the baseline UX expectation. Indonesian users spend hours daily on these — their patterns define what feels "normal."

| App | Core Pattern | Why It Works for Indonesia | Apply to Lolos | Persona | V1/V2 |
|-----|-------------|---------------------------|----------------|---------|-------|
| **Gojek** | Bottom tab nav, FAB, bottom sheets, skeleton loading | Thumb-first, one-handed use, connection-aware. Single-screen-one-action philosophy. | Bottom tabs: Beranda, CV Saya, Kak, Akun. FAB: "Buat CV Baru" as primary action. Bottom sheets for panels. | Rina, all mobile users | V1 |
| **Tokopedia** | Search-first, trust badges, progressive seller verification | Indonesian users research heavily before transacting. Trust is earned, not assumed. | Trust signals: university badges, user counter, testimonial, "dipakai oleh X pencari kerja." Data privacy assurance visible. | All | V1 |
| **Shopee** | Gamification (coins, vouchers, streak), live shopping, wallet integration | Rewards drive retention. Wallet integration is expected by default. | Credit celebration: "+50 credits!" toast. Streak: "3 CV completed this week!" Progress bar gamified. | Rina | V1 |
| **WhatsApp** | Chat bubbles, voice notes, native share sheet, groups | 96% penetration. Default communication tool. | Chat UI patterns: bubble shapes, typing indicators (3-dot staggered), suggested replies (chips), voice note option, native share sheet for CV sharing. | All | V1 |

**Layer 2: Power & Precision — Premium SaaS (Linear as Backbone)**

Linear is the 80% visual CEO. These patterns define the "professional tool" feel.

| App | Core Pattern | Apply to Lolos | Persona | V1/V2 |
|-----|-------------|----------------|---------|-------|
| **Linear** | Cmd+K palette, keyboard shortcuts, zero-clutter, 150ms micro-interactions | Command palette: "Buat CV", "Cek ATS", "Ganti Template". Keyboard-first for power users. 150ms spring on state changes. | Adi, desktop power users | V1 |
| **Vercel** | Dashboard cards, status dots, dark mode layering | Resume cards with thumbnail preview, ATS score badge, last-edited. Green/yellow/red status dots for ATS readiness. | All | V1 |
| **Stripe** | Progressive disclosure, guided setup, status dashboard | Onboarding wizard with progress indicator. ATS dashboard as "status" cards: "Keyword: 92%." Form simplicity. | All | V1 |
| **Notion** | Slash commands, AI inline assistant, drag-and-drop blocks | `/` in editor for quick actions: `/pengalaman`, `/skill`, `/sertifikasi`. AI wand per section. 6-dot drag handles. | Adi, Dimas | V1 |

**Layer 3: Intelligence — AI-Native Patterns**

These inform how Kak appears and behaves contextually.

| App | Core Pattern | Apply to Lolos | Persona | V1/V2 |
|-----|-------------|----------------|---------|-------|
| **Perplexity** | Source citations, follow-up suggestions, conversation threading | Job match: keyword sources cited inline. AI follow-up chips: "Mau Kak perbaiki ini?" | Adi | V2 |
| **Arc Browser** | Spaces (workspaces), AI sidebar (resizable, contextual), hover previews | Workspaces: "Job Search Aktif", "CV Cadangan", "Arsip." AI panel as resizable sidebar with conversation history (desktop only). | Adi | V2 |

### Visual DNA: 80/20 Rule

- **80% Linear/Vercel/Stripe** — Clean, minimalis, professional. Violet/Indigo palette. The dominant visual language.
- **20% Gojek/Shopee/WhatsApp** — Warmth, gamification, trust signals. FAB button, celebration moments, chat familiarity. Accent, not backbone.

**Visual CEO:** Linear-inspired professionalism with Violet as the defining accent. All Gojek/Shopee warmth is seasoning — essential, but never the main course.

### Transferable UX Patterns

**Navigation (V1):**
- **Bottom tab bar (Gojek model):** 4 tabs — Beranda, CV Saya, Kak, Akun. FAB overlay "Buat CV Baru." Thumb-zone optimized.
- **Command palette (Linear model):** `Cmd+K` on desktop. Quick actions with `⌘1-9` shortcuts.

**Interaction (V1):**
- **Chat as primary input (WhatsApp model):** Chat bubbles, typing indicators, suggested replies, streaming text. Core Kak interaction.
- **Progressive disclosure (Stripe model):** Fresh grad sees 4 sections. Power user sees 8+. Complexity grows with confidence.
- **One-click action (Linear model):** Every ATS suggestion actionable in one tap. Tap → applied → score updates. No navigation required.

**Visual (V1):**
- **Status dots (Vercel model):** Green (85+), Yellow (65-84), Red (<65). Pulse animation during analysis.
- **Morphing transitions (Framer):** Template switching via `layoutId`. No jarring cuts.
- **Score ring (Stripe model):** SVG ring gauge. Gradient fill. Spring physics animation. Anchor context always visible.

**Intelligence (V2):**
- **Source citations (Perplexity model):** ATS keyword matches cited. "Keyword 'SQL' ditemukan di bagian Pengalaman — baris 3."
- **Spaces (Arc model):** Resume workspaces. Desktop-only. V2 feature.

### Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails in Indonesia | What We Do Instead |
|-------------|--------------------------|-------------------|
| **Paywall at export** | User invests 30 min, can't download without paying. Anger, not conversion. | Free PDF with subtle "Made with Lolos" footer. Premium = watermark-free + DOCX. |
| **Blank form first screen** | Decision fatigue. "Template apa? Mulai dari mana?" | Kak greets first. Conversation, not form. One question at a time. |
| **Raw score without context** | "45/100" without knowing what's normal. User blames themselves. | Always show anchor: "Rata-rata fresh grad: 58." One immediate improvement visible. |
| **Desktop-first responsive** | Sidebar nav, hover states, drag-and-drop break on mobile. 90%+ Indonesian mobile. | Design for 6-inch 720p first. Bottom sheets, 44px touch targets. PWA offline. |
| **Credit card-only payment** | 2% credit card penetration. Conversion dead end. | GoPay, QRIS, Virtual Account first. Xendit gateway. |
| **Auto-renewal traps (4-week billing)** | 13 charges/year. Users feel scammed. Trust destroyed. | Transparent monthly/annual. Cancel anytime. Data retained. |
| **Creative-first templates (Canva)** | Beautiful CVs that silently fail ATS. Two columns, icons, graphics. | Every template ATS-safe by construction. Single-column, standard fonts, no graphics. |

### Design Inspiration Strategy

**Adopt (directly copy, V1):**
- WhatsApp chat UI — the interaction model Indonesian users already know
- Gojek bottom tab + FAB — thumb-first, zero learning curve
- Stripe progressive disclosure — complexity on demand
- Vercel status dots — instantly understandable ATS readiness

**Adapt (modify for our context):**
- Linear command palette → add AI commands: "Tanya Kak", "Optimasi ATS"
- Notion slash commands → CV-specific: `/pengalaman`, `/pendidikan`, `/skill`
- Perplexity citations → ATS keyword match sources (V2)
- Shopee gamification → credit celebrations, progress streaks (subtle, violet-toned)

**Avoid (explicitly reject):**
- Paywall-at-export — destroys trust. Free tier exports PDF.
- Blank form first screen — Kak always starts the conversation.
- Credit card-only payment — GoPay/QRIS first.
- Creative-first templates — ATS-safe is the only safe.
- 4-week billing tricks — transparent monthly/annual only.

---

## Design System Foundation

### Design System Choice

**Shadcn/ui (Radix UI primitives + Tailwind CSS)** — Themeable System approach. Proven accessible components with full visual customization through CSS custom properties. Components live in the project repo as source, not a dependency.

### Rationale

| Factor | Decision |
|--------|----------|
| **Platform** | Next.js 14+ App Router, TypeScript. Shadcn/ui is built for this stack — copy-paste components, not a dependency. |
| **Visual Uniqueness** | Full CSS custom property control. Violet/Indigo palette, Jakarta Sans + Inter fonts — expressed as Tailwind config. Not locked into a third-party visual language. |
| **Team Size** | 1-2 frontend devs pre-launch. Zero learning curve for Tailwind devs. Components in your codebase, fully modifiable. |
| **Accessibility** | Radix primitives = WCAG 2.1 AA baseline. Keyboard nav, focus management, screen reader support built in. |
| **Performance** | Tree-shakeable — only used components ship. No runtime CSS-in-JS. Tailwind atomic classes cacheable and minimal. |
| **Mobile-First** | Tailwind responsive utilities. Radix supports touch, pointer, keyboard natively. |
| **RSC Compatibility** | Radix components carry `"use client"` — needs clear Server/Client boundaries. Editor = Client, Layout/SEO = Server. |
| **Bundle Budget** | Target <180kB gzip initial JS. Framer Motion (+32kB), TipTap (+45kB), dnd-kit (+20kB) via dynamic import. |
| **Scale** | Not a bottleneck at 10K MAU. Real bottlenecks: TipTap JSON payload, Framer Motion layout without `will-change`, SSR overuse. |

### Component Inventory

**Core Components (from Shadcn/ui):** Button, Dialog, Sheet, Tabs, Card, Input/Textarea, Select/Combobox, Toast/Sonner, Progress, Skeleton, Badge, Tooltip, Command (cmdk).

**Custom Components (built on Radix primitives):**

| Component | Base | Usage |
|-----------|------|-------|
| `ScoreRing` | SVG + Framer Motion | ATS score ring gauge, gradient stroke, spring animation |
| `ChatBubble` | Custom | Kak messages with streaming text, typing indicator, reply chips |
| `ResumeCanvas` | TipTap wrapper | A4 canvas (210mm × 297mm), live preview, template rendering |
| `SectionBlock` | TipTap Node + dnd-kit | Draggable section with handle, AI wand, visibility toggle |
| `TemplateCard` | Card + Framer Motion | Preview card with hover animation, "Gunakan Template" CTA |
| `KeywordChip` | Badge | ATS keyword tag with match status (found/missing), tap to add |

### Implementation Gotchas (from Tech Review)

1. **Bundle:** Dynamic import via `next/dynamic` for Framer Motion, TipTap, dnd-kit. `next-bundle-analyzer` per PR.
2. **RSC Boundary:** Server Components for layout/SEO. Client Components for editor. File suffix `.client.tsx` for clear boundary.
3. **TipTap + Radix Portal:** Z-index conflict between `Dialog.Portal` and `.tippy-content`. Fix: `data-radix-portal` + `data-tiptap-portal` attributes, CSS custom property for z-index. Never hardcode z-50.
4. **dnd-kit + TipTap NodeView:** `onDragEnd` must call `editor.chain().focus().lift('sectionBlock').run()`. DragOverlay renders plain HTML from `node.toHTML()`. AC: drag-drop produces correct ProseMirror position.
5. **Mobile Performance:** CSS `transition` for `SectionBlock` reorder (not Framer Motion `layout`). TipTap `onUpdate` debounce 150ms + `shouldRerenderOnTransaction: false`. PWA autosave: `requestIdleCallback` + IndexedDB (`idb` wrapper), not localStorage.
6. **Test Strategy:** Playwright for visual + drag-drop E2E. `@tiptap/test-utils` for editor tests. jsdom cannot test Framer Motion or drag-and-drop.

### Customization Strategy

**Design Tokens:** Extend Tailwind config with Lolos-specific values. Colors: Indigo primary scale (50-950), Violet accent scale. Fonts: Jakarta Sans (display), Inter (body), JetBrains Mono (mono). Spacing: 4px base. Border radius: sm 4px → 2xl 16px. Animation: micro 150ms, fast 200ms, normal 300ms, slow 500ms, spring 1.5s.

**CSS Custom Properties (Light/Dark):** `--background: #fafafa` / `#0f0f11`. `--card: #ffffff` / `#1a1a1e`. `--primary: #6366f1` / `#818cf8`. `--accent: #8b5cf6` / `#a78bfa`. ATS score colors: `--ats-red: #ef4444`, `--ats-amber: #f59e0b`, `--ats-blue: #3b82f6`, `--ats-emerald: #10b981`.

---

## Defining Experience

### The One-Liner

**"Ngobrol 5 menit sama Kak, CV lo jadi — dan robot HRD langsung baca."**

This is what users will tell their friends. The defining interaction is not "building a CV" — it's the moment when conversation becomes document. When Rina realizes Kak actually listened, actually understood her career, and produced something that looks professional.

### User Mental Model

**Current solution:** Indonesian job seekers build CVs in Canva (visual design focus), Microsoft Word (manual formatting), or Google Docs (free but unstructured). They don't know ATS exists. They think a beautiful CV = an effective CV.

**Mental model they bring:** "CV itu kayak poster — makin bagus desainnya, makin dilirik." This is wrong and dangerous. ATS cannot parse beautiful design.

**Mental model we need to teach:** "CV itu kayak formulir pajak — yang penting mesin bisa bacanya. Kak bikin formulir itu tanpa kamu perlu isi manual."

**Where they get confused:** Template selection (decision fatigue), section ordering (what goes first?), keyword optimization (what words matter?), format rules (photo or no photo?).

**Where they get frustrated:** Manual text editing on phone, re-typing the same information for different applications, not knowing why their CV was rejected.

### Success Criteria for Core Experience

1. **"Ini gue banget."** User sees their CV preview and recognizes themselves in it — not generic AI filler.
2. **"Gampang banget."** Zero friction from first Kak message to first CV preview. Under 10 minutes for a fresh grad with no CV experience.
3. **"Skor gue naik."** User sees tangible improvement from their first score. The aha moment: "Oh, CV gue ternyata perlu dioptimasi — dan gue bisa."
4. **"Langsung kepake."** Export is instant. Format is correct for the target platform. File name is clean. No manual reformatting needed.

### Novel vs. Established Patterns

**Novel:** Conversational AI as the primary CV creation interface. No competitor does this. Kak is the differentiator. This requires user education — the first Kak message must establish "why conversation, not form."

**Established (adopted):** Chat UI (WhatsApp pattern — familiar to 96% of Indonesians), structured editor (Notion/Google Docs — familiar to most), score/gauge visualization (fitness apps — familiar concept).

**Combined innovatively:** Chat flows naturally into a structured document. The conversation IS the form — users don't perceive they're "filling fields." This is the novel synthesis: familiar chat pattern producing structured, ATS-validated output.

### Experience Mechanics

**Initiation:** Kak greets. No blank screen. No decision required. First message within 1 second.

**Interaction:** User responds to Kak's questions in natural language. Kak extracts, validates, and structures. After 12 questions (adaptive by career stage), Kak announces completion.

**Feedback:** Micro-coaching per section. ATS score with anchor context. One-click improvements. Progress indicators at every step.

**Completion:** CV preview reveal with celebration animation. ATS score ring. "Siap Apply" when score ≥80 or user marks as done. Export → Share → Kak remembers for next time.

---

## Visual Design Foundation

### Color System

**Primary:** Indigo `#6366f1` (light) / `#818cf8` (dark) — buttons, links, active states.

**Accent:** Violet `#8b5cf6` (light) / `#a78bfa` (dark) — AI features, Kak branding, gradient accents.

**Semantic:** Success (Emerald `#10b981`), Warning (Amber `#f59e0b`), Error (Red `#ef4444`), Info (Blue `#3b82f6`).

**Background:** `#fafafa` (light page) / `#0f0f11` (dark page), `#ffffff` (light card) / `#1a1a1e` (dark card), `#242428` (dark elevated).

**ATS Score Gradient:** Red (0-40) → Amber (41-65) → Blue (66-85) → Emerald (86-100).

**Accessibility:** All text/background pairs meet WCAG 2.1 AA minimum (4.5:1 normal text, 3:1 large text). Indigo on white: 5.2:1. Violet on white: 4.7:1.

### Typography System

**Display:** Jakarta Sans — headings, hero text, Kak messages. Warm geometry, Indonesian-optimized glyphs (proper diacritics).

**Body:** Inter — UI text, editor content, labels. Excellent multilingual support, highly readable at 14-16px.

**Mono:** JetBrains Mono — ATS analysis display, code views (13px).

**Scale:** h1 32px/700, h2 24px/600, h3 20px/600, body 15px/400, small 13px/400, micro 12px/500.

**Line heights:** headings 1.3, body 1.6.

### Spacing & Layout Foundation

**Base unit:** 4px (Tailwind convention).

**Content max-width:** 1280px desktop. Full-width mobile.

**Sidebar:** 64px collapsed (icon-only), 280px expanded. AI panel: 360px default, draggable to 480px.

**Card padding:** 24px. Section gap: 32px. Item gap: 12px.

**Grid:** 12-column, 16px column gap, 24px row gap.

**Layout principles:** Content-first — editor canvas central, panels contextual. Mobile: single-column with bottom sheets (70vh). Desktop: 3-panel (nav | canvas | AI). Whitespace generous — CV editing is focus work, not dashboard scanning.

### Accessibility Foundation

- **WCAG 2.1 AA** minimum for all UI. AAA where reasonable (large text contrast).
- **Keyboard navigation:** Complete Tab order through editor sections, toolbar, panels, modals.
- **Screen reader:** All UI elements have descriptive aria-labels. PDF output includes tagged PDF structure for screen reader compatibility.
- **axe-core CI gate:** 0 critical violations before every release. Scanned per PR.
- **Touch targets:** Minimum 44×44px. Mobile-optimized for thumb reach.
- **Reduced motion:** `prefers-reduced-motion` respected — animations degrade to instant opacity transitions.
- **Color is never the sole indicator of state:** Icons + text labels always accompany status dots and score colors.
