# Dashboard Design Iterations

Three iterations to get from "template starter" to "designed product":

| File | Description |
|------|-------------|
| `01-dashboard.png` | **v1 — Initial skeleton.** Generic SaaS dashboard. 3 status cards + emoji roadmap + raw monospace checks. Functional but flat/template-y. |
| `v2-dashboard.png` | **v2 — Brand identity pass.** Purple gradient hero, dark sidebar, 3 KPI cards with sparkline + ring + uptime pill, vertical timeline roadmap, quick actions row, recent activity. Big improvement. |
| `v3-dashboard.png` | **v3 — Final.** Added "Top job matches" empty-state card with ghost preview rows (showing realistic sample data at 50%/30% opacity) + Quick Start numbered onboarding card on the right column. Fills the void, demos the product's value before user has data. |

## What changed v1 → v3

| v1 | v3 |
|----|----|
| Flat slate-50 background | Subtle radial gradient accents + dotted pattern overlays |
| Light sidebar, default colors | Slate-950 dark sidebar, brand gradient logo, ⌘K hint |
| 3 identical status cards | 3 unique data widgets: uptime pill, sparkline with trend, circular ring with counter |
| Emoji checklist roadmap | Grouped vertical timeline with progress bar, phase numbers, completion state |
| Empty pages (real data only) | Empty states with ghost preview rows showing what success looks like |
| "0% Profile completeness" | "No jobs analyzed yet — Paste a job description" with 3-step onboarding |
| Raw monospace text in checks | Proper status cards with green/amber/rose borders + Fix buttons |
| Generic placeholder text | Real-shape data: real LLM models, real package names, real job titles |

## Lessons applied

- **Show, don't tell.** Empty states should preview the success state, not just say "nothing here yet."
- **Make data feel real.** Even demo data should look like real data (Senior Backend @ Bukalapak, score 87).
- **Visual hierarchy via type, not just size.** Tiny uppercase tracked labels + big numbers with tabular-nums + soft subtext creates depth without color noise.
- **Asymmetric column balance.** Left = 8/12 (rich content), right = 4/12 (sidebars). Both end roughly at the same vertical line.
- **Brand color = commitment.** Pick one accent (purple), use it in 5+ places (logo, hero, primary buttons, progress bar, active state) — repetition builds identity.
