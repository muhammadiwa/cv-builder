# Story 1.2: Design System Tokens & Shadcn/ui Setup

**Status:** ready-for-dev
**Epic:** 1 — Foundation, Auth & Infrastructure
**Created:** 2026-05-25

---

## User Story

As a developer,
I want the design system tokens and Shadcn/ui components configured,
So that all UI work uses consistent colors, fonts, spacing, and accessible primitives.

---

## Acceptance Criteria

**AC-1:** Given the Tailwind config, When inspecting CSS custom properties, Then Indigo/Violet palette, Jakarta Sans+Inter fonts, and 4px base spacing are defined.

**AC-2:** And dark/light mode CSS custom properties are configured.

**AC-3:** And all 13 Shadcn/ui primitives (Button, Dialog, Sheet, Tabs, Card, Input, Textarea, Select, Toast, Progress, Skeleton, Badge, Tooltip, Command) are installed and themed.

**AC-4:** And `components/ui/` exports all primitives.

**AC-5:** And animation scale tokens (micro 150ms → narrative 1000ms) are in Tailwind config.

**AC-6:** And Jakarta Sans and Inter fonts are loaded via `next/font` with proper subsetting for Indonesian characters.

---

## Developer Context

### What This Story Does

Establishes the complete visual foundation for Lolos. Every future UI story depends on these tokens being correct. The design system defines the Indigo/Violet color palette used across the entire product, the Jakarta Sans + Inter typography stack, the 4px-based spacing system, the animation timing scale, and the dark/light mode theming. All 13 Shadcn/ui primitives are installed and themed to match.

### Architecture Compliance

**Color System (from UX Spec & Architecture):**

```css
:root {
  /* Light mode */
  --background: #fafafa;
  --foreground: #18181b;
  --card: #ffffff;
  --card-foreground: #18181b;
  --primary: #6366f1;        /* Indigo-500 */
  --primary-foreground: #ffffff;
  --primary-hover: #4f46e5;  /* Indigo-600 */
  --accent: #8b5cf6;         /* Violet-500 */
  --accent-foreground: #ffffff;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --border: #e4e4e7;
  --ring: #6366f1;
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;

  /* ATS Score Colors */
  --ats-red: #ef4444;
  --ats-amber: #f59e0b;
  --ats-blue: #3b82f6;
  --ats-emerald: #10b981;

  /* Radius */
  --radius: 0.5rem;

  /* Shadows (light) */
  --shadow-level-1: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-level-2: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-level-3: 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.03);
  --shadow-level-4: 0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04);
  --shadow-level-5: 0 20px 40px rgba(0,0,0,0.12), 0 8px 12px rgba(0,0,0,0.06);
}

.dark {
  --background: #0f0f11;
  --foreground: #fafafa;
  --card: #1a1a1e;
  --card-foreground: #fafafa;
  --primary: #818cf8;        /* Indigo-400 */
  --primary-foreground: #0f0f11;
  --primary-hover: #6366f1;  /* Indigo-500 */
  --accent: #a78bfa;         /* Violet-400 */
  --muted: #27272a;
  --muted-foreground: #a1a1aa;
  --border: #27272a;
  --ring: #818cf8;
  --shadow-level-1: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-level-2: 0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3);
  --shadow-level-3: 0 4px 6px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3);
  --shadow-level-4: 0 10px 15px rgba(0,0,0,0.6), 0 4px 6px rgba(0,0,0,0.4);
  --shadow-level-5: 0 20px 40px rgba(0,0,0,0.7), 0 8px 12px rgba(0,0,0,0.5);
}
```

**Typography (from UX Spec):**
- Display: Jakarta Sans (headings, hero)
- Body: Inter (UI, editor)
- Mono: JetBrains Mono (ATS analysis)

**Animation Scale (from UX Spec):**
```
micro:   150ms cubic-bezier(0.16, 1, 0.3, 1)
fast:    200ms cubic-bezier(0.16, 1, 0.3, 1)
normal:  300ms cubic-bezier(0.16, 1, 0.3, 1)
slow:    500ms cubic-bezier(0.16, 1, 0.3, 1)
spring:  spring(60, 12, 1.5s)
```

**Shadcn/ui Primitives to Install (13):**

| Component | Usage in Lolos |
|-----------|---------------|
| `Button` | Primary/Secondary/Outline/Ghost |
| `Dialog` | Modals: template preview, export settings |
| `Sheet` | Bottom sheets: AI chat, section nav, ATS breakdown |
| `Tabs` | Right panel tabs, bottom tab bar |
| `Card` | Resume cards, template cards, ATS cards |
| `Input` | Field editing |
| `Textarea` | Long-form text input |
| `Select` | Template selector, language toggle |
| `Toast` / `Sonner` | Notifications: save success, export complete |
| `Progress` | AI interview progress, export generation |
| `Skeleton` | Loading states |
| `Badge` | ATS score tier, template category |
| `Tooltip` | Icon labels, keyboard shortcut hints |
| `Command` (`cmdk`) | Command palette, slash commands |

### Technical Requirements

- All colors must be CSS custom properties (no hardcoded hex values in components)
- Dark mode must toggle via class strategy (`dark` class on `<html>`)
- ThemeProvider must persist preference in localStorage and respect `prefers-color-scheme`
- Fonts loaded via `next/font/google` with `display: swap` and `subsets: ['latin']`
- Tailwind `darkMode: 'class'` config
- Shadcn/ui components use the CSS variables for theming (configured via `components.json`)
- Animation tokens must be usable as Tailwind utility classes and accessible to Framer Motion

### Testing Requirements

- Tailwind config compiles without errors
- All 13 Shadcn/ui components render correctly in light and dark modes
- Dark mode toggle works: click → class changes → colors update
- Fonts load correctly with no layout shift (confirm in browser dev tools)
- CSS custom properties are defined and inspectable in browser
- Hot reload works (`pnpm dev` in apps/web)

### Dev Notes

- Story 1.1 (Monorepo) is complete. The apps/web directory already has `tailwind.config.ts`, `globals.css`, `fonts.ts`, `providers.tsx` — these need to be UPDATED (not recreated) with the full design system tokens.
- The existing `components/` directory has landing page components that use Tailwind classes — ensure the new tokens don't break existing components.
- Shadcn/ui `components.json` configuration must point to `apps/web/` paths: `"aliases": { "components": "@/components", "utils": "@/lib/utils" }`
- JetBrains Mono is only needed for ATS analysis views — it can be loaded later when those views are built.
- The `providers.tsx` already has a ThemeProvider — review and ensure it works with the class strategy.
- Color contrast must meet WCAG 2.1 AA: all text/background pairs must have ≥4.5:1 ratio for normal text, ≥3:1 for large text.
