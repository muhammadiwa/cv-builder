---
stepsCompleted: [1, 2]
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

**Core loop:** Chat → Preview → Score → Edit → Export → Share

### Platform Strategy

- **Primary:** Mobile-first PWA (Progressive Web App). Installable to home screen, offline support via Service Worker + IndexedDB.
- **Secondary:** Desktop web (responsive, not a separate app).
- **Not in V1:** Native iOS/Android apps. PWA provides offline, install, and push notification capabilities sufficient for V1-V2.
- **Key constraints:** Mid-range Android devices (Samsung A-series, Xiaomi Redmi, Oppo A-series). 4G connections with variable reliability (urban 10Mbps+, rural 2-5Mbps). Users are data-conscious — keep bundle sizes small.
- **Offline:** Resume editing works offline. AI features require connectivity — graceful degradation with clear offline indicator.

### Effortless Interactions

What should feel magical:
- **Zero-setup start.** User clicks "Buat CV Gratis," Kak greets them. No template selection, no form fields, no decisions before value delivery.
- **Auto-save always.** Never a save button. Progress persists through browser close, connection loss, app switch. User returns exactly where they left off.
- **One-click fixes.** ATS suggestions are actionable in one tap. "Tambah keyword 'SQL'" → tap → keyword added to skills section. No manual editing required.
- **Template switching without data loss.** Change templates anytime. CV data persists. Switching is an animation, not a migration.
- **Share in two taps.** Tap share → WhatsApp opens with pre-filled message + CV link. No copy-paste, no file management.

### Critical Success Moments

1. **First Kak message.** User's first interaction with the AI persona. Must feel warm, natural, and immediately useful — not robotic or overwhelming. "Halo! Aku Kak, asisten karirmu. Yuk kita bikin CV bareng. Kamu lulusan jurusan apa?"

2. **CV Preview reveal.** The moment the conversation becomes a document. Must feel like magic: "Kak benar-benar bikin CV dari obrolan kita." Animation, progressive reveal, celebration cues.

3. **First ATS score.** Defines the user's relationship with the product. If score is low, user feels helped, not judged. If high, user feels proud and wants to share. Score must always come with actionable next step.

4. **First export.** User downloads PDF or shares link. Must work flawlessly on mobile. Download starts immediately, naming is clean, file opens correctly.

5. **First return visit.** User comes back days later. Kak remembers them, their CV is exactly as they left it, and there's a helpful suggestion waiting.

### Experience Principles

1. **Conversation over configuration.** Every interaction starts with talking, not clicking. Forms and menus are fallbacks, not defaults.
2. **Reveal, don't dump.** Show results progressively. CV preview before full editor. Score context before raw number. One suggestion at a time.
3. **Coach, not judge.** Every ATS score comes with "here's how to improve." Every issue has a one-click fix. The user should feel more capable after using Lolos, not less.
4. **Mobile-first, not mobile-responsive.** Design for thumb reach, soft keyboard, 4G latency, mid-range hardware. Desktop is a stretched version of mobile, not the other way around.
5. **Indonesian-first.** Kak speaks natural Bahasa Indonesia with code-switch tolerance. CV conventions follow Indonesian norms (photo, personal details, IPK). Trust signals match Indonesian expectations (testimonial, university badges, user count).

