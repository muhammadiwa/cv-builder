# Deferred Work

This file tracks issues that were identified but consciously deferred.

## Deferred from: code review of story-2.2-tiptap-editor-with-section-blocks (2026-05-26)

- **JWT access token disimpan di module-level variable, bukan via cookies** [`apps/web/lib/api-client.ts:3`] — Task 2.1 minta cookies; deferred karena lintas-cutting auth flow yang lebih natural ditangani bersama hardening Story 1.4.
- **Tidak ada caller `setAccessToken` di diff — bootstrap login flow** [`apps/web/lib/api-client.ts:5`] — deferred, tergantung wiring login UI dengan token capture (Story 1.4 territory).
- **`browserQueryClient` singleton tidak di-reset saat logout** [`apps/web/app/providers.tsx:24-31`] — risk: cache user lama kebawa ke user baru. Deferred bareng auth/logout flow refactor.
- **`removeSection` di store di-import tapi tidak diekspos UI delete** [`apps/web/components/editor/SectionBlock.tsx:23`] — deferred, AC-5 hanya minta toggle visibility; delete UI bisa ditambahkan saat user feedback minta.
- **Date input raw string tanpa validasi (start ≤ end, ISO normalization)** [`apps/web/components/editor/SectionBlock.tsx`] — deferred, butuh content JSON schema enforcement yang lebih komprehensif (separate ticket).
- **`String(unknown)` di SectionPreview bisa render `[object Object]`** [`apps/web/components/editor/SectionBlock.tsx`] — deferred, terkait content schema enforcement (separate ticket).
- **Zustand selector `s.sections.find(...)` re-render semua block tiap edit** [`apps/web/components/editor/SectionBlock.tsx:18-19`] — deferred, optimasi performa pakai `shallow` equality (tidak blocking, masuk ke 2.4 atau saat profiling tunjuk hot path).
- **`displayOrder` server-side tidak normalize duplikat/negative** — render order non-deterministic. Deferred, butuh server-side reindex pass.
- **Out-of-order PATCH responses (in-flight overlap) bisa overwrite state lebih baru** [`apps/web/hooks/useDebouncedSync.ts`] — deferred, butuh sequence/version numbering yang sebaiknya dirancang bareng auto-save Story 2.4.
- **`A4_W/A4_H` pixel approximations vs literal `mm` CSS units** [`apps/web/components/editor/ResumeCanvas.tsx:24-25`] — AC-1 menyebut "210mm×297mm"; deferred, dampak utama muncul saat PDF export (Story 5.3) dan sebaiknya diselesaikan satu paket dengan render pipeline.


## Deferred from: code review of story-4.1-kak-chat-interface (2026-05-28)

- Spec narrative claim about pre-existing CSS variables in `globals.css` is incorrect — chat tokens were actually introduced by this diff. Update the spec template/UX-DR1 wiring during epic retrospective so future stories don't repeat.
- `MOCK_RESPONSES` in `ChatView.tsx` cycles silently after 3 user turns. Acceptable for V1 demo; will be replaced by SSE streaming from `/api/v1/ai/interview` in Story 4.2.
- Dark mode missing explicit override for `--color-user-bubble` / `--color-user-bubble-text`. Indigo-500 reads acceptably on the dark canvas, but design polish pass should add explicit dark tokens.
- `ChatBubble` does not guard against invalid `message.timestamp`. Local-state V1 always supplies fresh timestamps; relevant when Story 4.4 introduces Redis persistence and replay scenarios.
- Story Task 5.4 (manual smoke test for `/interview`) left unchecked. User must validate streaming, send flow, typing indicator, and chips in a real browser before final sign-off.

## Deferred from: code review of story-4.1-kak-chat-interface (2026-05-29, Round 2)

- `MOCK_RESPONSES` not declared `as const`; `chips: string[]` mutable at module level [`apps/web/components/chat/ChatView.tsx:14-29`] — deferred, mock flow is wholesale replaced by SSE streaming in Story 4.2.
- Textarea has no `maxLength` or paste-length guard [`apps/web/components/chat/ChatInput.tsx:81`] — deferred, V1 mock has no length contract; revisit when real AI integration in Story 4.2 defines token/character limits.
- `generateId()` could collide under React 18 strict-mode double-mount (same `Date.now()` + same `Math.random()` slice over two-mount window) [`apps/web/components/chat/ChatView.tsx:33`] — deferred, replaced by server-issued IDs when Redis persistence lands in Story 4.4.
- Empty-string chips would still render and be clickable [`apps/web/components/chat/SuggestedChips.tsx:24`] — deferred, mock data has no empty entries; revisit when real AI generates chips in Story 4.2.
- `window.visualViewport` reference closure-captured in `ChatInput` cleanup [`apps/web/components/chat/ChatInput.tsx:55-71`] — deferred, the viewport object is stable for the tab lifetime so the cleanup works correctly today; not a real bug.
