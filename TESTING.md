# Testing

This document is the single source of truth for how testing works in the
Lolos monorepo.

> **History:** Stories 1.1 (monorepo scaffold) and 1.6 (CI/CD pipeline)
> implicitly assumed a test framework would be in place, but neither
> story actually installed one. The CI gate was bypassed with
> `pnpm run test || echo "⚠️ No tests defined yet — passing"` until
> Story 1.9 (this foundation) closed the gap.

## Stack at a glance

| Package | Runner | Companions | Why |
|---|---|---|---|
| `apps/web` (unit) | **Vitest** | `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw` | Native ESM + TS, no transform layer, Next.js 14 friendly. MSW intercepts `apiFetch` calls so component tests don't know our HTTP layer. |
| `apps/web` (E2E) | **Playwright** | — | Multi-browser, headless-first, modern async API. The repo's `bmad-tea` knowledge files already assume Playwright. |
| `apps/api` | **Jest** | `@nestjs/testing`, `supertest`, `ts-jest` | NestJS canon — `Test.createTestingModule()` is built around Jest's mock module system. |
| `apps/workers` | **Vitest** | — | Plain Node, no DI graph, lighter is better. |
| `packages/validators` | **Vitest** | — | Pure functions, ESM, perfect Vitest fit. |
| `packages/database` | **Vitest** | — | Tiny package. Real Prisma integration tests live in `apps/api`. |

We deliberately run **two test runners** (Vitest + Jest). The cost of
the extra dev-deps is small; the cost of breaking NestJS's canonical
`@nestjs/testing` ergonomics by forcing Vitest there would be higher.

## File and folder conventions

- **Co-located preferred:** `<module>/__tests__/<file>.test.ts`
- **Sibling acceptable:** `<module>/<file>.test.ts`
- **Integration:** `<file>.integration.test.ts`
- **E2E:** `apps/web/e2e/<scenario>.spec.ts`

`*.test.ts` and `*.test.tsx` are the canonical extensions for in-package
tests. `*.spec.ts` is reserved for Playwright E2E so the two runners
never argue about ownership.

## How to run

### From the repo root

```bash
# Run all unit/integration suites across every package
pnpm test

# Run E2E (Playwright) — needs browsers installed first time
pnpm --filter @lolos/web exec playwright install chromium webkit
pnpm test:e2e

# Lint + typecheck + test all at once (matches the CI quality gate)
pnpm lint && pnpm typecheck && pnpm test
```

### Per package

```bash
# Web component tests
pnpm --filter @lolos/web test
pnpm --filter @lolos/web test:watch
pnpm --filter @lolos/web test:cov

# API
pnpm --filter @lolos/api test
pnpm --filter @lolos/api test:watch
pnpm --filter @lolos/api test:cov

# Workers / validators / database (Vitest)
pnpm --filter @lolos/workers test
pnpm --filter @lolos/validators test
pnpm --filter @lolos/database test
```

### Watch mode

All Vitest packages support `pnpm --filter <pkg> test:watch`. Jest in
`apps/api` is `pnpm --filter @lolos/api test:watch`. Playwright is
intentionally not exposed in watch mode — re-run the full suite.

## How to add a new test

### A React component (apps/web)

```ts
// apps/web/components/__tests__/my-thing.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyThing } from "../my-thing";

describe("MyThing", () => {
  it("renders the label", () => {
    render(<MyThing label="hello" />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
```

For tests that hit `apiFetch`, mock the network with MSW (handlers go in
`apps/web/test/msw-handlers.ts` once the suite needs it; until then,
keep tests pure-DOM).

### A NestJS service or pipe (apps/api)

```ts
// apps/api/src/foo/__tests__/foo.service.test.ts
import { Test } from "@nestjs/testing";
import { FooService } from "../foo.service";

describe("FooService", () => {
  let svc: FooService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [FooService],
    }).compile();
    svc = mod.get(FooService);
  });

  it("does the thing", () => {
    expect(svc.doTheThing()).toBe("done");
  });
});
```

For controller integration tests, use Supertest against
`mod.createNestApplication()`.

### A Playwright E2E

```ts
// apps/web/e2e/my-flow.spec.ts
import { expect, test } from "@playwright/test";

test("user can do X", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /start/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
```

The Playwright `webServer` config auto-starts `pnpm dev` for you.

## CI behaviour

Two jobs in `.github/workflows/ci.yml` care about tests:

- **`quality`** — `lint` + `typecheck` + `test`. Hard fail on any test
  failure; no escape hatch. Postgres + Redis services are wired in.
- **`e2e`** — installs Playwright browsers, runs `test:e2e`. Failures
  upload the Playwright HTML report as an artifact.

## Coverage

Enabled (`pnpm <pkg> test:cov`) but **not enforced** as of Story 1.9.
Adding per-package coverage thresholds is a deliberate follow-up once
the tree has a baseline of 2–3 stories' worth of test data.

## Common pitfalls

- **JSDOM is missing browser APIs.** `vitest.setup.ts` polyfills
  `ResizeObserver`, `IntersectionObserver`, and `matchMedia`. Add new
  globals there if a component needs them.
- **NestJS DI in unit tests.** Don't `new FooService()` directly — use
  `Test.createTestingModule({ providers: [...] })` so DI graph and
  decorators resolve correctly.
- **Playwright `webServer` reuse.** Locally, if `pnpm dev` is already
  running, Playwright will reuse it (`reuseExistingServer: true` outside
  CI). This means a stale dev server can mask issues — restart the dev
  server when the build output changes meaningfully.
- **Prisma in unit tests.** Mock the `prisma` import with Jest's module
  mocking or Vitest's `vi.mock`. Real DB integration tests run inside
  `apps/api` against the Postgres service in CI.
