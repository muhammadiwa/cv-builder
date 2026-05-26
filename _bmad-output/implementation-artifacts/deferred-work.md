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
