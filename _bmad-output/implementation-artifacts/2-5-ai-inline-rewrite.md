---
baseline_commit: ae2ebd0c1579f81b1fd962d79a88513f036862f2
---

# Story 2.5: AI Inline Rewrite

**Status:** ready-for-dev
**Epic:** 2 — Resume Editor
**Created:** 2026-05-27

---

## User Story

As a job seeker,
I want to ask AI to improve specific sections of my CV,
So that my bullet points are more impactful and ATS-friendly.

---

## Acceptance Criteria

**AC-1:** Given a section with existing content, When user clicks the AI wand icon, Then a dropdown appears with options: "Perbaiki wording", "Buat lebih ATS-friendly", "Singkat jadi 1 baris", "Tambah metrik".

**AC-2:** And AI suggestion renders within 3 seconds as a diff view (original text struck through, AI version with green border).

**AC-3:** And user can "Terapkan" (apply) or "Coba Lagi" (retry with same prompt).

**AC-4:** And applying an AI suggestion creates a single undo step (`⌘Z` reverts the entire AI change atomically).

**AC-5:** And during AI streaming, the targeted section is write-locked with a visual indicator (pulsing border + "AI sedang menulis…" label).

**AC-6:** And highlighting text within a section also shows the AI wand with context-specific options (rewrite selection only, not the whole section).

---

## Developer Context

### Architecture

This story introduces the first AI-powered feature in the editor. The architecture mandates:

1. **PII Stripping** (Story 1.5, already implemented) — `PiiGatewayService` is an injectable service (NOT a global interceptor). The AI service must explicitly inject it and call `sanitize(content, userId)` before sending data to the LLM. There is no auto-applying interceptor on routes.
2. **Vercel AI SDK** for SSE streaming — `ai` (npm) + `@ai-sdk/openai` provide `streamText()` for token-by-token delivery. Both packages needed on the backend (`apps/api`). Frontend uses `useCompletion` from `ai` for consuming the stream.
3. **Token Budget Guardian** — per-user daily cap ($0.10). A NEW guard to be created in this story (Task 1.5). Checks `ai_usage_logs` table before calling the LLM.
4. **Model choice: GPT-4o-mini** — the architecture doc labels this as Tier 1/3 (Extraction/Conversation). For inline rewrite, we intentionally use GPT-4o-mini (not Tier 2's GPT-4o) because the cost target is Rp 10-20 per rewrite and the quality is sufficient for short-text improvements. This is a deliberate override of the architecture's tier assignment for cost reasons — document in Dev Agent Record when implementing.

**Data flow:**
```
User clicks wand → Frontend sends POST /api/v1/ai/rewrite (SSE)
  → PII Stripping Interceptor strips name/email/phone/address
  → Token Budget Guardian checks daily cap
  → AI Service assembles prompt + calls LLM provider
  → Tokens stream back via SSE
  → Frontend renders diff view progressively
  → User clicks "Terapkan" → updateSectionField with AI result
```

**Integration with existing editor:**
- The wand button lives on each `SectionBlock` (Story 2.2 already has the drag handle + visibility toggle; wand is a third action button).
- **Which field per section type:** The wand targets the primary text field of each section: `summary` → "summary", `experience` → "description", `education` → "description", `skills` → "skills", `projects` → "description". Sections without a meaningful text field (`header`) do NOT show the wand.
- Write-lock is NEW state to add to `useEditorStore` in this story — `lockedSections: Set<string>`. When locked, `updateSectionField` for that section is a no-op and the UI shows a pulsing border.
- Undo integration: before applying the AI result, snapshot the current field value. On ⌘Z, restore the snapshot. This is a simple "before/after" pair, not a full undo stack (that's deferred to Story 2.6 which introduces `zundo`). **Migration note:** when Story 2.6 lands, remove the custom `undoStack` and `⌘Z` listener entirely — zundo will handle AI undo atomically via its own middleware.
- The diff view is a temporary overlay on the section — not a separate panel. It shows inline within the section's editing area.

### Technical Specs

- **`ai` (Vercel AI SDK) v4.x** — new dependency on BOTH frontend and backend. Frontend: `useCompletion` hook for consuming SSE. Backend: `streamText()` + `@ai-sdk/openai` for calling the LLM. ~15 KB gzipped (frontend portion).
- **Backend SSE pattern:** NestJS doesn't natively support SSE on POST endpoints via `@Sse()` (that's GET-only). Use the Vercel AI SDK's `toDataStreamResponse()` helper which returns a standard `Response` object, then pipe it through NestJS's `@Res() res: Response` with `passthrough: true`. Alternatively, use `res.setHeader('Content-Type', 'text/event-stream')` and write chunks manually. The Vercel AI SDK approach is preferred for consistency with the frontend consumer.
- **Backend endpoint:** `POST /api/v1/ai/rewrite` — accepts `{ sectionId, sectionType, content: Record<string,unknown>, field, instruction: string, selectedText? }`. Returns SSE stream of tokens. Protected by `AuthGuard('jwt')`. The `resumeId` is NOT needed in the payload — the endpoint only needs the content to rewrite + the user's identity (from JWT) for budget tracking.
- **PII stripping:** Inject `PiiGatewayService` into `AiService`. Call `piiGateway.sanitize(contentToRewrite, userId)` before assembling the prompt. This replaces PII with placeholders. After the LLM responds, the AI text is returned as-is (no PII injection needed — the rewritten text is new prose, not a template fill).
- **Prompt assembly:** System prompt instructs the model to rewrite the given text according to the instruction. Context includes section type (so the model knows it's writing a "summary" vs "experience bullet"). If `selectedText` is provided, only that portion is rewritten (AC-6).
- **Diff rendering:** Use a simple inline diff — original text with `line-through` + `text-muted-foreground`, AI text with `border-l-2 border-emerald-500 bg-emerald-50/50`. Not a full unified-diff library — just visual before/after for a single field.
- **Write-lock state:** `editorStore` gains `lockedSections: Set<string>` (section IDs currently being rewritten). `updateSectionField` checks this set and returns early if locked. The lock is released when streaming completes or errors.
- **Undo:** `editorStore` gains `undoStack: Array<{ sectionId, field, previousValue, previousTs }>` with max depth 1 (only the last AI action). `⌘Z` pops and restores. This is intentionally minimal — a full undo/redo stack is Story 2.6 territory.
- **Streaming timeout:** If no token arrives within 10 seconds, abort and show error toast. If total stream exceeds 30 seconds, abort.
- **Error handling:** Network error / 429 (budget exceeded) / 500 → toast with Indonesian message. Budget exceeded specifically shows "Batas AI harian tercapai. Coba lagi besok."
- **Mobile:** Wand button is always visible (not hover-only). Dropdown opens as a bottom sheet on mobile (reuse `BottomSheet` from Story 2.3).

### Files (planned)

**New:**
- `apps/web/components/editor/AIWandButton.tsx` — wand icon button + dropdown menu (Radix DropdownMenu)
- `apps/web/components/editor/AIDiffView.tsx` — inline diff overlay showing original vs AI suggestion with Terapkan/Coba Lagi buttons
- `apps/web/hooks/useAIRewrite.ts` — manages the streaming lifecycle: request, accumulate tokens, handle completion/error/abort
- `apps/api/src/ai/ai.module.ts` — NestJS module for AI features
- `apps/api/src/ai/ai.controller.ts` — `POST /api/v1/ai/rewrite` endpoint (SSE)
- `apps/api/src/ai/ai.service.ts` — prompt assembly, model routing, LLM provider call
- `apps/api/src/ai/ai-stream.service.ts` — SSE response helper
- `apps/api/src/ai/prompts/rewrite.ts` — prompt templates for the 4 rewrite instructions
- `apps/api/src/common/token-budget.guard.ts` — per-user daily budget check (reads from `ai_usage_logs` table)

**Modified:**
- `apps/web/package.json` — add `ai@^4` (Vercel AI SDK)
- `apps/web/components/editor/SectionBlock.tsx` — add AIWandButton to the section action bar; add write-lock visual state; hide wand for `header` section type
- `apps/web/stores/editorStore.ts` — add `lockedSections`, `lockSection`, `unlockSection`, `undoStack`, `pushUndo`, `popUndo`; guard `updateSectionField` against locked sections
- `apps/api/src/app.module.ts` — import `AiModule`
- `apps/api/package.json` — add `ai@^4` (Vercel AI SDK core) AND `@ai-sdk/openai@^1` (OpenAI provider adapter). Both are needed — `streamText()` comes from `ai`, the model instance comes from `@ai-sdk/openai`.

### Dependencies

- **Story 2.2 (TipTap Editor)** — done. `SectionBlock` exists with action buttons.
- **Story 2.3 (Multi-Panel Layout)** — done. Right panel "AI Chat" placeholder exists; this story does NOT replace it (that's Epic 4). The wand is per-section, not panel-based.
- **Story 2.4 (Auto-Save)** — done. `updateSectionField` stamps `__field_updated_at`; the AI apply action uses the same path so the result auto-syncs.
- **Story 1.5 (PII Stripping Gateway)** — done. The interceptor is already global; the new AI endpoint inherits it.
- **Database:** `ai_usage_logs` table exists in the Prisma schema (Story 1.3). Used by Token Budget Guardian.
- **Environment:** `OPENAI_API_KEY` (or equivalent) must be set. The endpoint gracefully errors if missing.

### Out of scope (deferred)

- **Full Kak Chat interface** — Epic 4. This story is per-section inline rewrite only.
- **AI right panel integration** — the right panel "AI Chat" placeholder stays as-is. Inline rewrite is triggered from the section wand, not the panel.
- **Full undo/redo stack** — Story 2.6 introduces `zundo`. This story has a minimal single-action undo.
- **AI model fallback chain** — if the primary model fails, we show an error. Multi-model fallback is a follow-up.
- **Prompt caching / semantic cache** — deferred to when we have usage telemetry.
- **Text selection rewrite on mobile** — AC-6 (text selection → wand) is desktop-only for V1. Mobile users use the section-level wand.

---

## Tasks/Subtasks

### 1. Backend AI module foundation

- [ ] 1.1 Create `apps/api/src/ai/ai.module.ts` — NestJS module importing `AiController` and `AiService`.
- [ ] 1.2 Create `apps/api/src/ai/ai.service.ts` — injectable service with `rewrite(params)` method. For now, stub that returns a hardcoded stream (real LLM integration in Task 3).
- [ ] 1.3 Create `apps/api/src/ai/ai.controller.ts` — `POST /api/v1/ai/rewrite` endpoint. Protected by `AuthGuard('jwt')`. Returns SSE response (`Content-Type: text/event-stream`). Accepts body: `{ sectionId, sectionType, content: Record<string,unknown>, field, instruction: string, selectedText?: string }`.
- [ ] 1.4 Register `AiModule` in `apps/api/src/app.module.ts`.
- [ ] 1.5 Create `apps/api/src/common/token-budget.guard.ts` — NestJS guard that checks `ai_usage_logs` for the current user's daily token spend. If over $0.10 equivalent, throw `429 Too Many Requests` with message "Daily AI budget exceeded".
- [ ] 1.6 Wire the token budget guard on the rewrite endpoint.
- [ ] 1.7 Vitest/Jest test: stub endpoint returns SSE tokens; budget guard rejects when over limit.

### 2. Prompt assembly and LLM integration

- [ ] 2.1 Create `apps/api/src/ai/prompts/rewrite.ts` — export prompt templates for the 4 instructions:
  - `perbaiki_wording`: "Rewrite this resume text to be more professional and impactful. Keep the same meaning but improve clarity and word choice."
  - `ats_friendly`: "Rewrite this resume text to be more ATS-friendly. Use industry-standard keywords, active verbs, and quantifiable achievements."
  - `singkat`: "Condense this resume text into a single concise line without losing key information."
  - `tambah_metrik`: "Enhance this resume text by adding specific metrics, numbers, or quantifiable results where possible."
- [ ] 2.2 Integrate OpenAI SDK in `ai.service.ts`. Add `ai@^4` and `@ai-sdk/openai@^1` to `apps/api/package.json`. Use `streamText()` from `ai` with `openai('gpt-4o-mini')` model instance from `@ai-sdk/openai`. Temperature: 0.7. Max tokens: 500.
- [ ] 2.3 Wire PII stripping: inject `PiiGatewayService` into `AiService`. Call `piiGateway.sanitize(contentPayload, userId)` before assembling the prompt. Add a test that confirms PII placeholders appear in the outbound prompt (mock the LLM call, inspect the prompt argument).
- [ ] 2.4 Log usage to `ai_usage_logs` after each successful stream completion (tokens used, model, cost estimate). Use `prisma.aiUsageLog.create()`.

### 3. Frontend: AI wand button and dropdown

- [ ] 3.1 Create `apps/web/components/editor/AIWandButton.tsx`:
  - Sparkles icon (lucide) as trigger
  - Radix `DropdownMenu` with 4 items: "Perbaiki wording", "Buat lebih ATS-friendly", "Singkat jadi 1 baris", "Tambah metrik"
  - On mobile: opens as a bottom sheet instead of dropdown (reuse `BottomSheet`)
  - Props: `sectionId`, `field`, `onSelect(instruction)`
  - 44px touch target, visible on hover (desktop) / always (mobile)
- [ ] 3.2 Mount `AIWandButton` in `SectionBlock.tsx` action bar (next to visibility toggle).
- [ ] 3.3 AC-6: Add a floating wand button that appears when text is selected within a section (desktop only). Consider using TipTap's `BubbleMenu` extension (already part of the TipTap ecosystem) rather than raw `window.getSelection()` — BubbleMenu handles positioning, scroll, and blur edge cases that a custom implementation would need to solve. Passes `selectedText` to the rewrite hook. If BubbleMenu is too heavy, fall back to a custom floating div positioned via `getBoundingClientRect()` on the selection range.

### 4. Frontend: streaming hook

- [ ] 4.1 Add `ai@^4` (Vercel AI SDK) to `apps/web/package.json`. Run `pnpm install`.
- [ ] 4.2 Create `apps/web/hooks/useAIRewrite.ts`:
  - Accepts `{ resumeId, sectionId, field, instruction, selectedText? }`
  - Calls `POST /api/v1/ai/rewrite` via fetch with SSE parsing (or `useCompletion` from `ai` SDK)
  - Returns `{ result, isStreaming, error, abort, retry }`
  - Handles: 10s no-token timeout, 30s total timeout, abort on unmount
  - On error: surfaces toast via sonner
  - On 429: shows "Batas AI harian tercapai. Coba lagi besok."
- [ ] 4.3 Vitest test: mock fetch SSE response, verify tokens accumulate, verify timeout fires.

### 5. Frontend: diff view and apply

- [ ] 5.1 Create `apps/web/components/editor/AIDiffView.tsx`:
  - Shows original text with `line-through text-muted-foreground`
  - Shows AI result with `border-l-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30`
  - During streaming: AI text grows token-by-token with a blinking cursor
  - Two buttons: "Terapkan" (primary) and "Coba Lagi" (secondary/ghost)
  - "Terapkan" calls `applyAIResult(sectionId, field, aiText)`
  - "Coba Lagi" calls `retry()` from the hook
  - Renders inline within the section (replaces the normal field view while active)
- [ ] 5.2 Implement `applyAIResult` in the editor store or as a helper:
  - Push current value to `undoStack` (snapshot before AI)
  - Call `updateSectionField(sectionId, field, aiText)` — this stamps `__field_updated_at` and triggers auto-save
  - Unlock the section
  - Clear the diff view
- [ ] 5.3 Implement minimal undo: `⌘Z` listener (global keydown) pops `undoStack` and calls `updateSectionField` with the previous value. Max depth 1. If stack is empty, `⌘Z` is a no-op (full undo/redo deferred to Story 2.6).

### 6. Write-lock

- [ ] 6.1 Add to `editorStore`: `lockedSections: Set<string>`, `lockSection(id)`, `unlockSection(id)`.
- [ ] 6.2 Guard `updateSectionField`: if `lockedSections.has(id)`, return early (no-op). This prevents the user from editing while AI is streaming.
- [ ] 6.3 Visual indicator in `SectionBlock`: when locked, show a pulsing `ring-2 ring-indigo-400 animate-pulse` border + "AI sedang menulis…" label overlay.
- [ ] 6.4 Lock lifecycle: `useAIRewrite` calls `lockSection` on stream start, `unlockSection` on stream end/error/abort.

### 7. Verification

- [ ] 7.1 `pnpm --filter '@lolos/web' typecheck` passes.
- [ ] 7.2 `pnpm --filter '@lolos/web' build` passes; measure bundle delta (Vercel AI SDK ≈ 15 KB gz).
- [ ] 7.3 `pnpm --filter '@lolos/api' typecheck` passes.
- [ ] 7.4 All existing tests (37 web + 13 api) still pass.
- [ ] 7.5 Manual smoke:
  - Click wand → dropdown appears with 4 options
  - Select "Perbaiki wording" → section locks, diff view streams in
  - Click "Terapkan" → field updates, section unlocks, auto-save fires
  - Press ⌘Z → field reverts to pre-AI value
  - Click "Coba Lagi" → new stream starts
  - Go offline → wand click shows error toast
  - Exceed budget → 429 toast "Batas AI harian tercapai"

---

## Dev Notes

### Previous Story Learnings (from 2.4)

- **`updateSectionField` stamps `__field_updated_at`** — the AI apply action uses this same path, so the AI result automatically gets a field timestamp and syncs via the 2s debounce. No special sync handling needed.
- **`useDebouncedSync` reads from `useEditorStore.getState()`** — the flush always gets the latest state, so even if AI applies and the user immediately closes the tab, the 800ms IDB debounce + unmount flush will persist the AI result.
- **Conflict resolution works per-field** — if another device edits a different field while AI is rewriting this one, both changes survive. If the same field is edited on another device during the AI stream, the LWW merge will keep whichever has the newer timestamp (the AI apply stamps `Date.now()` which will be newer than any concurrent edit that started before the stream).

### Architecture Compliance

- **PII Stripping:** `PiiGatewayService` is an injectable service (NOT a global interceptor). Inject it into `AiService` and call `sanitize(content, userId)` before assembling the LLM prompt. The prompt must NOT include raw user PII — only the sanitized content reaches the LLM.
- **Token Budget:** Check BEFORE calling the LLM, not after. If budget is exceeded, return 429 immediately without consuming tokens. The guard reads from `ai_usage_logs` table.
- **Model Choice:** Use GPT-4o-mini (cost target Rp 10-20 per rewrite). This is a deliberate cost-driven override of the architecture's tier labeling (which assigns GPT-4o-mini to Tier 1/3). Document the rationale in Dev Agent Record.
- **Cost tracking:** Log every AI call to `ai_usage_logs` with: userId, model, promptTokens, completionTokens, estimatedCost, timestamp. Use `prisma.aiUsageLog.create()`.

### Testing Standards

- Backend: Jest (existing setup from Story 1.9). Mock the LLM provider; test prompt assembly, PII stripping verification, budget guard, SSE response format.
- Frontend: Vitest (existing). Mock fetch for SSE; test hook lifecycle (streaming, timeout, abort), diff view rendering, undo stack.
- No e2e for AI (would require real API key or complex mock server).

---

## Dev Agent Record

### Implementation Plan

(to be filled by dev)

### Debug Log

(to be filled by dev)

### Completion Notes

(to be filled by dev)

---

## File List

(to be filled by dev)

---

## Change Log

- 2026-05-27: Story created from epic 2.5 spec on branch `spec/story-2-5-ai-inline-rewrite`. First AI-powered feature in the editor. Scoped to per-section inline rewrite only (not full Kak chat). Backend uses Vercel AI SDK + OpenAI GPT-4o-mini via SSE. Frontend integrates with existing SectionBlock action bar + editorStore field timestamps.

---

## Status

**Current Status:** ready-for-dev
**Last Updated:** 2026-05-27
