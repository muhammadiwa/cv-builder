# Changelog

All notable changes to CV ATS Builder are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md` for open-source launch.
- GitHub issue templates (`bug`, `feature`, `setup`) and PR template.
- 3-tier dark score panel for job cards (Jobright-style: ring + label + max 2 supporting tags).
- `/api/matches/summaries` bulk endpoint for batch match-score fetching.
- Backend pagination: `/api/jobs` returns `PaginatedJobsOut { items, total, skip, limit, has_more }`.

### Changed
- Jobs page simplified: header → sort dropdown → grid → pagination. Filter bar and advanced drawer removed.

### Removed
- "Recommended for You" sort option (now uses `Highest Match Score` as a plain sort key).
- "Analyzed" status badge (now shown via score panel state).
- Status filter tabs (covered by dark score panel states).

---

## [0.10.0] — 2026-06-22

### Phase 10H — Job Detail simplification
- Drop breadcrumb + tab navigation; fold "Match Analysis" into the main layout.
- **Reverted 10G** (over-simplified, lost too much info).

### Phase 10G → 10H (reverted)
- Dedup and slim Job Detail page (reverted; lost useful density).

### Phase 10F — Job Detail layout
- Two-column layout: profile context left, AI Action Center sticky right.
- Match Analysis, Quick Facts, Required Skills sections with evidence-based scoring.

### Phase 10E — Profile editor
- Per-section Update buttons (removed global Refresh + save).
- Portfolio URL field auto-populates from LLM `basics.url`.
- Hoisted `Section` component out of `ProfileEditForm` to fix focus-loss bug.

### Phase 10D — Jobs list revamp
- **Phase A**: Match score badge + drawer with 8-component breakdown.
- **Phase B**: Filter bar + URL query-param sync + 14 sort options.
- **Phase C**: Advanced filters drawer + skeleton loaders.
- **Final**: Filter bar + drawer removed; pagination added (40 jobs seeded for testing).

### Phase 10C — Template decoration presets
- 3 new axes: `accent_color`, `heading_rule`, `sidebar_layout`.
- Skills extended with `proficiency` and `chips`.
- 6 new decoration presets: ATS Bold, Editorial, Sidebar, Tech Sidebar, Mono, Startup.

### Phase 10B — Template structural presets
- 4 new axes: `header_style`, `section_heading_style`, `experience_layout`, `skills_layout`.
- 7 new structural presets: ATS Minimal, Executive, Tech Lead, Creative, Academic, European, Consulting.
- Template config frozen 2026-06-21.

### Phase 10A — Template feature
- CRUD API + 3 original presets + styling keys.
- Frontend Templates page + TemplatePicker + Toast UI.
- Code review score: 7.5 → 8.5/10.

---

## [0.9.0] — 2026-06-20

### Phase 9 — Polish + Application tracking
- **9A**: System-level review (9.0/10).
- **9B**: Application tracking kanban (Applied → Interview → Offer).
- **9C**: Rate limiter + WeasyPrint timeout.
- Dual LLM config eliminated; dev placeholder synced.
- Code review score: 7.0 → 9.0/10.

---

## [0.8.0] — 2026-06-20

### Phase 8 — Frontend UX foundation
- Layout shell: fixed sidebar + mobile drawer + `page-shell` + toast dedup.
- Full layout audit: `PageHeader` component, `page-shell` variants, every page synced.
- Settings page: full-width layout, 4-col grid, vertical action stack.
- Template visual differentiation: schematic thumbnails + metadata pills + section-order flow.

---

## [0.1.0] — 2026-06-19

### Phase 1 — LLM provider abstraction
- Multi-provider support (OpenAI, Anthropic) with cost tracking.
- Provider-agnostic interface for matching, cover letter generation, CV enhancement.

### Phase 0 — Project foundation
- Backend skeleton: FastAPI + 15 ORM tables.
- Frontend skeleton: Vite + React + TS + Tailwind.
- Dashboard redesigned from "template" to "designed".

### Initial commit
- `chore: init cv-ats-builder`.

---

## How to read this

- **Added** — new features.
- **Changed** — modifications to existing features.
- **Deprecated** — soon-to-be-removed features.
- **Removed** — deleted features.
- **Fixed** — bug fixes.
- **Security** — vulnerability fixes (see [SECURITY.md](SECURITY.md)).

Versions follow the format `MAJOR.MINOR.PATCH`. We're pre-1.0, so `MINOR` bumps may include breaking changes with a clear migration note in the PR description.