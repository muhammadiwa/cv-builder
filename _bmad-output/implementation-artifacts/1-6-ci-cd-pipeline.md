# Story 1.6: CI/CD Pipeline

**Status:** ready-for-dev
**Epic:** 1 — Foundation, Auth & Infrastructure
**Created:** 2026-05-25

---

## User Story

As a developer,
I want automated lint, typecheck, test, and deploy on every PR,
So that quality gates are enforced before merge.

---

## Acceptance Criteria

**AC-1:** Given a PR opened against `main`, When CI runs, Then `pnpm lint`, `pnpm typecheck`, and `pnpm test` must all pass before merge is allowed.

**AC-2:** And `next-bundle-analyzer` report is generated and compared against budget (<180KB initial JS).

**AC-3:** And deploy to staging environment on merge to `main`.

**AC-4:** And production deploy requires manual approval.

---

## Developer Context

### GitHub Actions Workflow

Create `.github/workflows/ci.yml` with jobs: lint, typecheck, test, build, deploy-staging, deploy-prod.

**Environment variables needed:** `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `REDIS_HOST`, `REDIS_PORT` (all as GitHub secrets).

### Technical Requirements

- GitHub Actions as CI/CD platform
- `pnpm` as package manager
- `turbo run lint` / `turbo run typecheck` for code quality
- `next-bundle-analyzer` plugin for bundle size check
- Staging deploy: auto-merge to staging branch or direct deploy
- Production deploy: requires manual approval via GitHub Environments
- Cache: `pnpm-lock.yaml` for dependency caching, Turborepo cache for build outputs

### Dev Notes

- Story 1.1 (monorepo) provides `turbo run lint` and `turbo run typecheck` scripts
- Bundle-analyzer plugin added to `next.config.js` only in CI (not dev)
- Staging environment: `apps/web` on Vercel or similar, `apps/api` on cloud provider
- Production deploy gated by manual approval in GitHub UI
