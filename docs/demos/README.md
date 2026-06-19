# Phase 3 Demo — Profile Editor

This directory contains recordings and screenshots demonstrating the
Phase 3 profile editor working end-to-end.

## Files

| File | Size | How to view |
|------|------|-------------|
| `phase3-demo.webm` | ~2.4 MB | Any modern video player (VLC, mpv, Chrome, Firefox) |
| `phase3-trace.zip` | ~2.4 MB | Drag-and-drop into https://trace.playwright.dev |
| `screenshots/01..08-*.png` | ~300 KB each | Image viewer |

## Demo flow (8 steps)

1. **01-dashboard.png** — Dashboard v7 (after Phase 1 polish)
2. **02-profile-loaded.png** — ProfilePage with parsed data from real upload
3. **03-basics-edited.png** — Summary field edited, Save button enabled
4. **04-experience-readonly.png** — Work experience preview (read-only in this Phase)
5. **05-skills-readonly.png** — Skills preview (read-only in this Phase)
6. **06-saved.png** — Save success banner + version history shows new v(N+1)
7. **07-after-refresh.png** — Page reloaded, edit persisted
8. **08-settings.png** — Settings page (LLM provider, costs)

## Interactive trace (Playwright Trace)

Open `phase3-trace.zip` at https://trace.playwright.dev for:
- Full timeline of every action
- DOM snapshots before/after each step
- Network requests/responses
- Embedded video player synced to actions
- Console logs

## What this proves

- ✅ Real PDF → LLM → structured Profile data (Phase 2)
- ✅ Edit Basics form saves to DB (Phase 3)
- ✅ Version history increments per save
- ✅ Page refresh shows persisted state
- ✅ Pydantic HttpUrl coercion handles empty form fields gracefully
- ✅ End-to-end test passes: 7 backend tests + LLM live test

## Known limitations (intentional, per Phase 3 scope)

- Experience and Skills sections are read-only previews
- Inline editing of nested arrays (work[], skills[].keywords[]) is
  scheduled for a future Phase (per the "Inline editing for experience
  comes in Phase 3" note in the UI)

## Reproducing locally

```bash
# 1. Servers must be running
cd /home/kumaha-sia/projects/cv-ats-builder
cd backend && /tmp/jfvenv/bin/python -m uvicorn app.main:app --port 8765 &
cd ../frontend && npx vite --port 5173 &

# 2. Run the demo scripts (use cwd outside /tmp to avoid stdlib shadowing)
cd /home/kumaha-sia
/tmp/jfvenv/bin/python /tmp/demo_video.py     # records webm
/tmp/jfvenv/bin/python /tmp/demo_trace.py     # produces trace.zip
```