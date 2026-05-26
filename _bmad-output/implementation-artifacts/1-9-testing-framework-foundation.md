# Story 1.9: Testing Framework Foundation

**Status:** ready-for-dev
**Epic:** 1 — Foundation, Auth & Infrastructure (retrospective gap-fill)
**Created:** 2026-05-26

---

## User Story

As a developer on this codebase,
I want every package to have a working test framework with a real CI gate,
So that future stories can ship with executable acceptance proofs and we
stop relying on `typecheck + build` as a substitute for behavioural tests.

---

## Background — Why this story exists

A code-review audit during Story 2.3 surfaced a gap between **intent** and
**reality**:

- The architecture document (line 194) prescribes co-located `__tests__/`
  per module with `*.test.ts` / `*.integration.test.ts` / `tests/e2e/`.
- Story 1.6 (CI/CD Pipeline) AC-1 required `pnpm test` to be a hard CI
  gate before merge to `main`.
- In practice, **no package has a `test` script that runs a real test
  framework**, no test-framework dependencies are declared anywhere, and
  CI's "Test" step is gated by `pnpm run test || echo "⚠️  No tests
  defined yet — passing"` — meaning the AC-1 requirement is silently
  bypassed every PR.

Story 1.1 (monorepo scaffold) listed `turbo run build/lint/typecheck` as
its only smoke checks; installing test frameworks was never picked up by
1.6's implementation either. This story closes that gap before it
compounds across Epic 2+ stories.

---

## Acceptance Criteria

**AC-1:** Given any TypeScript sub-package (`apps/api`, `apps/web`,
`apps/workers`, `packages/validators`, `packages/database`), When a
developer runs `pnpm --filter <name> test`, Then a real test framework
executes (not a no-op) and exits with status 0 on a green tree.

**AC-2:** And each package has at least one passing smoke test that
exercises real production code (importing a module and asserting an
observable behaviour), so CI proves the framework is wired correctly.

**AC-3:** And `apps/web` ships a Playwright E2E scaffold with at least
one smoke test that boots the dev server, navigates to the landing
page (`/`), and asserts the hero heading is visible.

**AC-4:** And `.github/workflows/ci.yml`'s "Test" step runs without the
`|| echo "⚠️  No tests defined yet — passing"` workaround and fails the
job on any test failure. The `pnpm run test` invocation also fails the
job on any package that lacks a `test` script (no silent bypass).

**AC-5:** And running `pnpm test` at the repo root (via Turbo) reports
test results per package and produces a coverage summary in CI logs.
A coverage threshold is **not** enforced yet — this story enables
reporting; threshold enforcement is a follow-up.

**AC-6:** And `TESTING.md` at the repo root documents:
  - which framework runs in which package and why
  - how to run tests locally (single package, all packages, watch mode)
  - how to add a new test (file naming, location, conventions)
  - how to debug a failing test in CI

---

## Developer Context

### Architecture / Framework Choices

The split is pragmatic, not religious — each tool was picked because it
fits the runtime it targets:

| Package | Framework | Companion libs | Why this combo |
|---|---|---|---|
| `apps/web` (unit/component) | **Vitest** | `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom` | Native ESM + TypeScript, no transform layer, fast, friendly with Next.js 14 App Router |
| `apps/web` (E2E) | **Playwright** | — | Already implied by `bmad-tea` knowledge files; multi-browser; better DX than Cypress for our headless-first plan |
| `apps/api` (unit/integration) | **Jest** | `@nestjs/testing`, `supertest`, `ts-jest` | NestJS canon; `@nestjs/testing` is built around Jest's module mocking. Switching would lose the `Test.createTestingModule()` ergonomics. |
| `apps/workers` | **Vitest** | — | BullMQ workers are plain Node — no DI graph, Vitest is lighter |
| `packages/validators` | **Vitest** | — | Pure functions, ESM, perfect Vitest fit |
| `packages/database` | **Vitest** | (test DB via Docker in CI) | Tiny package, Vitest is fine. Real Prisma integration tests live in `apps/api`. |

Note: this is a deliberately **two-runner** stack (Vitest + Jest). The
trade-off is one extra dev dependency surface in exchange for keeping
the NestJS DI testing path canonical. We accept that.

### File-and-folder conventions

Per architecture doc:
- Co-located: `<module>/__tests__/<file>.test.ts` (preferred for unit)
- Or sibling: `<module>/<file>.test.ts`
- Integration: `<file>.integration.test.ts`
- E2E: `apps/web/e2e/<scenario>.spec.ts`

### CI integration

The current `.github/workflows/ci.yml` already has a `quality` job that
runs `pnpm run test`. We need to:
1. Drop the `|| echo "..."` escape hatch.
2. Have each sub-package contribute a real `test` script that pnpm/turbo
   can pick up.
3. Add a separate Playwright job (or extend `quality`) — Playwright needs
   browsers installed and Next.js running.

### Out of scope (deferred)

- **Coverage thresholds.** This story enables reporting, not enforcement.
  A follow-up sets per-package thresholds once we have a baseline.
- **Backfilling tests for Stories 1.1–1.8 and 2.1–2.3.** That's a
  multi-story effort. This story just installs the runway. The very next
  story (2.4) and all subsequent stories should ship with tests against
  this framework as part of their DoD.
- **Pact / contract testing.** The `bmad-testarch-*` skills hint at
  this, but it's overkill for v1. Defer until we have multiple
  consumer/provider services with churn.
- **Mutation testing, snapshot testing.** Not for v1.
- **Visual regression.** Story 5.x territory (PDF export pixel diff).

### Dependencies

- Story 1.1 (monorepo scaffold) — done; provides `turbo run` graph
- Story 1.6 (CI/CD) — done; provides `.github/workflows/ci.yml` we'll modify
- No story dependencies block this; it's cross-cutting infrastructure

### Files (planned)

**New (root):**
- `TESTING.md` — single-source doc for the testing strategy

**New per-package:**
- `apps/web/vitest.config.ts`
- `apps/web/vitest.setup.ts` — `@testing-library/jest-dom`, JSDOM polyfills
- `apps/web/playwright.config.ts`
- `apps/web/e2e/landing.spec.ts` — Playwright smoke
- `apps/web/components/__tests__/section-header.test.tsx` — Vitest smoke
- `apps/api/jest.config.js`
- `apps/api/test/setup.ts`
- `apps/api/src/common/__tests__/zod-validation.pipe.test.ts` — Jest smoke (covers existing pipe)
- `apps/workers/vitest.config.ts`
- `apps/workers/src/__tests__/main.test.ts` — Vitest smoke
- `packages/validators/vitest.config.ts`
- `packages/validators/src/__tests__/resume.schema.test.ts` — Vitest smoke (covers `updateResumeSchema`)
- `packages/database/vitest.config.ts`
- `packages/database/src/__tests__/index.test.ts` — Vitest smoke

**Modified:**
- `package.json` (root) — keep `"test": "turbo run test"`; add `"test:e2e": "turbo run test:e2e"`
- `apps/api/package.json` — add `test`, `test:watch`, `test:cov` scripts; add deps `jest`, `ts-jest`, `@nestjs/testing`, `supertest`, `@types/jest`, `@types/supertest`
- `apps/web/package.json` — add `test`, `test:watch`, `test:e2e` scripts; add deps `vitest`, `@vitejs/plugin-react`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`
- `apps/workers/package.json` — add `test`, `test:watch` scripts; add deps `vitest`
- `packages/validators/package.json` — add `test`, `test:watch` scripts; add deps `vitest`
- `packages/database/package.json` — add `test` script; add deps `vitest`, `@types/node`
- `turbo.json` — wire up `test` task with proper inputs/outputs; add `test:e2e` task
- `.github/workflows/ci.yml` — drop the `|| echo` escape hatch; add a Playwright job
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — flip `epic-1` back to `in-progress`; add `1-9-testing-framework-foundation: ready-for-dev` → `in-progress` → `review` → `done`

### Pre-existing typecheck blocker to fix

`packages/database` currently fails its own `typecheck` because `process`
is referenced without `@types/node` declared. Adding `@types/node` is
already on this story's modifications list — the typecheck pass becomes
a happy by-product.

---

## Tasks/Subtasks

### 1. Frontend unit/component (Vitest + Testing Library)

- [ ] 1.1 Add devDeps to `apps/web/package.json`: `vitest@^2`, `@vitejs/plugin-react@^4`, `@vitest/coverage-v8@^2`, `@testing-library/react@^16`, `@testing-library/user-event@^14`, `@testing-library/jest-dom@^6`, `jsdom@^25`, `@types/jsdom@^21`.
- [ ] 1.2 Create `apps/web/vitest.config.ts` — environment `jsdom`, alias `@` to `./`, include `**/__tests__/**/*.test.{ts,tsx}` and `**/*.test.{ts,tsx}`, coverage reporter `text`+`html`+`lcov`.
- [ ] 1.3 Create `apps/web/vitest.setup.ts` — `import '@testing-library/jest-dom'`, polyfill `ResizeObserver` and `IntersectionObserver` (used by `EditorShell`, `SectionBlock`).
- [ ] 1.4 Add scripts to `apps/web/package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:cov": "vitest run --coverage"`.
- [ ] 1.5 Write `apps/web/components/__tests__/section-header.test.tsx` — render the existing `SectionHeader` component, assert the heading text is in the DOM. (Pick `SectionHeader` because it's pure props-in-DOM-out — minimal mocking surface.)
- [ ] 1.6 Verify `pnpm --filter @lolos/web test` passes.

### 2. Frontend E2E (Playwright)

- [ ] 2.1 Add devDep `@playwright/test@^1.49` to `apps/web/package.json`.
- [ ] 2.2 Create `apps/web/playwright.config.ts` — `webServer.command: 'pnpm dev'`, base URL `http://localhost:3000`, projects: `chromium`, `webkit`. Reduce parallelism to 1 in CI.
- [ ] 2.3 Create `apps/web/e2e/landing.spec.ts` — navigate to `/`, assert the hero heading text from `<Hero>` is visible.
- [ ] 2.4 Add script to `apps/web/package.json`: `"test:e2e": "playwright test"`.
- [ ] 2.5 Document in `TESTING.md` how to run `pnpm --filter @lolos/web exec playwright install chromium webkit` for local browsers.

### 3. Backend (Jest + @nestjs/testing)

- [ ] 3.1 Add devDeps to `apps/api/package.json`: `jest@^29`, `ts-jest@^29`, `@types/jest@^29`, `supertest@^7`, `@types/supertest@^6`. Note: `@nestjs/testing` is already a transitive of `@nestjs/common` but we'll add it explicitly: `@nestjs/testing@^10`.
- [ ] 3.2 Create `apps/api/jest.config.js` — `preset: 'ts-jest'`, `testEnvironment: 'node'`, `roots: ['<rootDir>/src']`, `moduleFileExtensions`, `testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts']`, coverage reporter.
- [ ] 3.3 Add scripts to `apps/api/package.json`: `"test": "jest"`, `"test:watch": "jest --watch"`, `"test:cov": "jest --coverage"`.
- [ ] 3.4 Write `apps/api/src/common/__tests__/zod-validation.pipe.test.ts` — exercise `ZodValidationPipe` with `updateResumeSchema`: valid input passes, invalid `displayOrder` (negative) throws `BadRequestException` with structured `issues` payload.
- [ ] 3.5 Verify `pnpm --filter @lolos/api test` passes.

### 4. Workers (Vitest)

- [ ] 4.1 Add devDep `vitest@^2` to `apps/workers/package.json`.
- [ ] 4.2 Create `apps/workers/vitest.config.ts` — environment `node`, basic config.
- [ ] 4.3 Add script to `apps/workers/package.json`: `"test": "vitest run"`.
- [ ] 4.4 Write `apps/workers/src/__tests__/main.test.ts` — smoke import, assert the bootstrap function is a function.
- [ ] 4.5 Verify `pnpm --filter @lolos/workers test` passes.

### 5. Validators (Vitest)

- [ ] 5.1 Add devDep `vitest@^2` to `packages/validators/package.json`.
- [ ] 5.2 Create `packages/validators/vitest.config.ts`.
- [ ] 5.3 Add script `"test": "vitest run"`.
- [ ] 5.4 Write `packages/validators/src/__tests__/resume.schema.test.ts` — table-driven cases for `updateResumeSchema`: empty body OK, `sections: []` OK, `sections` over `MAX_SECTIONS_PER_RESUME` rejected, oversized `content` (> 64KB serialized) rejected, invalid `sectionType` rejected, valid full payload passes.
- [ ] 5.5 Verify `pnpm --filter @lolos/validators test` passes.

### 6. Database (Vitest + fix pre-existing typecheck)

- [ ] 6.1 Add devDeps to `packages/database/package.json`: `vitest@^2`, `@types/node@^20`.
- [ ] 6.2 Create `packages/database/vitest.config.ts`.
- [ ] 6.3 Add script `"test": "vitest run"`.
- [ ] 6.4 Write `packages/database/src/__tests__/index.test.ts` — smoke: `prisma` is defined, has expected delegates (`resume`, `resumeSection`).
- [ ] 6.5 Verify `pnpm --filter @lolos/database typecheck` passes (was failing pre-story).
- [ ] 6.6 Verify `pnpm --filter @lolos/database test` passes.

### 7. Turbo + CI wiring

- [ ] 7.1 Update `turbo.json` `test` task with `inputs: ["src/**", "test/**", "vitest.config.*", "jest.config.*"]` and `outputs: ["coverage/**"]`. Add `test:e2e` task with `cache: false` (Playwright is not cacheable in this form).
- [ ] 7.2 In `.github/workflows/ci.yml`, change the "Test" step from
  `run: pnpm run test || echo "⚠️ No tests defined yet — passing"`
  to `run: pnpm run test`. Remove the comment.
- [ ] 7.3 Add a new job `e2e:` in CI that depends on `quality`, installs Playwright browsers (`pnpm --filter @lolos/web exec playwright install --with-deps chromium`), and runs `pnpm --filter @lolos/web test:e2e`. Time-budget 10 min.
- [ ] 7.4 Update root `package.json` with `"test:e2e": "turbo run test:e2e"`.

### 8. Documentation

- [ ] 8.1 Create `TESTING.md` at the repo root with sections:
  - **Why** (link back to this story / the architecture decision)
  - **Stack at a glance** (table from Developer Context)
  - **How to run** (`pnpm test`, `pnpm --filter <pkg> test`, watch mode, coverage)
  - **How to add a test** (file naming, location, naming conventions, mocking guidance)
  - **CI behaviour** (which jobs run what)
  - **Common pitfalls** (e.g., NestJS `Test.createTestingModule` patterns; React 18 Concurrent + JSDOM caveats; Playwright `webServer` reuse)
- [ ] 8.2 Add a one-line "Tests" section to root `README.md` linking to `TESTING.md`.

### 9. Validation

- [ ] 9.1 Run `pnpm install` to refresh the lockfile after all the new deps land. Commit `pnpm-lock.yaml`.
- [ ] 9.2 Run the full quality gate locally: `pnpm lint`, `pnpm typecheck`, `pnpm test`. All must pass.
- [ ] 9.3 Push branch, open PR, verify CI's "Test" step runs and fails on a deliberately broken assertion (then revert the break). This proves AC-4.
- [ ] 9.4 Verify Playwright E2E job runs and passes in CI.

---

## Dev Agent Record

_(to be populated during implementation)_

### Implementation Plan

_(to be populated during implementation)_

### Debug Log

_(to be populated during implementation)_

### Completion Notes

_(to be populated during implementation)_

---

## File List

_(to be populated during implementation)_

---

## Change Log

- 2026-05-26: Story drafted as a retrospective gap-fill for Epic 1. Discovered during Story 2.3 implementation that `pnpm test` is silently bypassed in CI (`|| echo "⚠️ No tests defined yet — passing"`) and no package has a real test framework installed, despite Story 1.6 AC-1 mandating tests as a CI gate. This story closes that gap before Story 2.4 (auto-save + offline persistence) lands — auto-save logic is exactly the kind of concurrency-heavy behaviour that's painful to validate without tests.

---

## Status

**Current Status:** ready-for-dev
**Last Updated:** 2026-05-26
