# Story 1.1: Monorepo Scaffold with Turborepo

**Status:** ready-for-dev
**Epic:** 1 — Foundation, Auth & Infrastructure
**Created:** 2026-05-25

---

## User Story

As a developer,
I want a working Turborepo monorepo with all apps and packages scaffolded,
So that all future stories have a home.

---

## Acceptance Criteria

**AC-1:** Given the project root, When `pnpm install` runs, Then all workspace dependencies resolve without errors.

**AC-2:** Given the monorepo, When `turbo run build` runs, Then all apps and packages build successfully.

**AC-3:** And `packages/validators/` exports shared Zod schemas (empty barrel export for now).

**AC-4:** And `packages/database/` contains Prisma schema placeholder and generates client.

**AC-5:** And `apps/web/` runs Next.js dev server on port 3000.

**AC-6:** And `apps/api/` runs NestJS dev server on port 4000.

**AC-7:** And `apps/workers/` has BullMQ worker bootstrap (empty queue registration).

**AC-8:** And `pnpm` is enforced via `only-allow` in root package.json `preinstall` script.

---

## Developer Context

### What This Story Does

Initialize the complete Lolos monorepo structure. This is the FIRST story — it creates the foundation every other story builds on. No business logic. Pure scaffold.

### Architecture Compliance

**Monorepo structure (from Architecture Decision — 3 apps + 2 packages):**

```
lolos/
├── turbo.json                    # Turborepo pipeline config
├── pnpm-workspace.yaml           # Workspace definition
├── package.json                  # Root: scripts, devDeps, only-allow
├── .gitignore                    # Already exists — extend if needed
├── config/
│   ├── eslint.config.js          # Shared ESLint config (flat config)
│   └── prettier.config.js        # Shared Prettier config
├── packages/
│   ├── validators/
│   │   ├── package.json          # name: @lolos/validators
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts          # Barrel: empty export for now
│   └── database/
│       ├── package.json          # name: @lolos/database
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts          # Prisma client singleton export (placeholder)
│           └── schema.prisma     # Placeholder: generator + datasource only
├── apps/
│   ├── web/
│   │   ├── package.json          # name: @lolos/web, Next.js 14+
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── app/
│   │   │   ├── layout.tsx        # Minimal root layout
│   │   │   └── page.tsx          # Hello world placeholder
│   │   └── public/
│   ├── api/
│   │   ├── package.json          # name: @lolos/api, NestJS
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── src/
│   │       ├── main.ts           # Bootstrap, listen on 4000
│   │       └── app.module.ts     # Root module (empty imports)
│   └── workers/
│       ├── package.json          # name: @lolos/workers, BullMQ
│       ├── tsconfig.json
│       └── src/
│           └── main.ts           # Worker bootstrap (no queues yet)

```

### Technical Requirements

**Package Manager:** pnpm (enforced via `only-allow`)
**Monorepo Tool:** Turborepo (`turbo.json` with `build`, `dev`, `lint`, `typecheck` pipelines)
**Languages:** TypeScript 5.x strict mode
**Node:** >=20 LTS

**Root package.json scripts:**
```json
{
  "scripts": {
    "preinstall": "npx only-allow pnpm",
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "format": "prettier --write ."
  }
}
```

**turbo.json pipelines:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "**/.prisma/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

**pnpm-workspace.yaml:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "config"
```

### Library/Framework Versions

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^14.2 | Next.js App Router |
| `@nestjs/core` | ^10.4 | NestJS backend |
| `@nestjs/cli` | ^10.4 | NestJS CLI |
| `@nestjs/bullmq` | ^10.2 | BullMQ NestJS integration |
| `@bull-board/api` | ^5.21 | BullMQ monitoring |
| `prisma` | ^5.22 | Database ORM |
| `@prisma/client` | ^5.22 | Prisma client |
| `turbo` | ^2.3 | Monorepo orchestrator |
| `typescript` | ^5.6 | Type checking |
| `@types/node` | ^20 | Node types |
| `eslint` | ^9.14 | Linting |
| `prettier` | ^3.4 | Formatting |
| `only-allow` | ^1.2 | Package manager enforcement |

### Testing Requirements

- `turbo run build` passes
- `turbo run typecheck` passes
- `turbo run lint` passes
- `pnpm install` completes without errors
- `apps/web/` dev server starts on port 3000
- `apps/api/` dev server starts on port 4000
- `apps/workers/` bootstrap runs without errors

### Definition of Done

- [ ] All directories and files created per structure above
- [ ] `pnpm install` succeeds
- [ ] `turbo run build` succeeds (all apps/packages build)
- [ ] `turbo run lint` succeeds
- [ ] `turbo run typecheck` succeeds
- [ ] `packages/validators` exports from `src/index.ts`
- [ ] `packages/database` has Prisma schema with generator + datasource
- [ ] `apps/web/` serves page on port 3000
- [ ] `apps/api/` starts NestJS on port 4000
- [ ] `apps/workers/` bootstrap script runs
- [ ] Prettier config is shared from `config/prettier.config.js`
- [ ] ESLint flat config is shared from `config/eslint.config.js`
- [ ] Story file committed to git

### Dev Notes

- This is the FIRST story — no prior story learnings
- Landing page code already exists in `apps/web/` (components, app/). Preserve it — this story adds the monorepo wrapper around it.
- NestJS and workers are brand new scaffolds
- `packages/database/schema.prisma` should have only `generator client` and `datasource db` blocks — no models yet (models added in Story 1.3)
- `packages/validators/src/index.ts` is an empty barrel — schemas added in later stories
- No database connection needed yet — Prisma client generation only
- No authentication needed yet — Story 1.4
