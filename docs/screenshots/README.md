# Phase 0 — Foundation Screenshots

Browser test via Playwright + headless Chrome against:
- BE: `127.0.0.1:8765` (uvicorn)
- FE: `127.0.0.1:5173` (Vite dev server)

| File | Path | Description |
|------|------|-------------|
| `01-dashboard.png` | `/` | Dashboard with status cards (Backend / API ping / Readiness), phase roadmap, readiness checks |
| `02-profile.png`  | `/profile` | Profile placeholder (Phase 2) |
| `04-cvdrafts.png` | `/cv-drafts` | CV Drafts placeholder (Phase 6) |
| `05-coverletters.png` | `/cover-letters` | Cover Letters placeholder (Phase 9) |
| `06-applications.png` | `/applications` | Applications placeholder (Phase 11) |
| `07-templates.png` | `/templates` | Templates placeholder (Phase 6) |
| `08-prompts.png` | `/prompts` | AI Prompt Manager placeholder (Phase 12) |
| `09-settings.png` | `/settings` | Settings placeholder (Phase 12) |

All pages render successfully. Dashboard shows real backend status (Online / Degraded) with API ping latency (~290ms).
