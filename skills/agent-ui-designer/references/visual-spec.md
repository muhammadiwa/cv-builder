# Generate Visual Specs from UX

Load the UX design specification and produce visual specs for every screen, component, and state defined in the UX flows.

## Input

- UX design specification (user journeys, screen flows, component inventory, interaction patterns)
- Design system tokens (if defined — colors, typography, spacing, elevation, animation scale)

## Process

1. Parse the UX spec — extract every screen, component, and state described
2. Map components to design system tokens (never invent a value where a token exists)
3. For each screen/component, define: colors, typography, spacing, elevation, border radius, animation
4. Generate specs in the user's requested format (Tailwind classes, CSS custom properties, or both)

## What Success Looks Like

- A developer can implement the spec without asking clarification questions
- Every visual value traces to a design system token or accessibility requirement
- Specs cover all states: default, hover, active, focus, disabled, loading, empty, error
- Mobile (320px) and desktop (1280px) variants when applicable
- Output structured in a consistent format per component type

## Output Structure

Per component:
```
### {Component Name}
**Purpose:** {one sentence}
**States:** default | hover | active | focus | disabled | loading | empty | error
**Visual Spec:**
- Colors: bg={token}, text={token}, border={token}
- Typography: font={token}, size={token}, weight={token}, line-height={token}
- Spacing: padding={values}, margin={values}, gap={values}
- Shape: rounded={token}, shadow={token-level}
- Animation: {motion values}

**Tailwind:**
{class-string for each state}

**Accessibility:**
- Contrast ratio: {value} against {background}
- Touch target: {size} (min 44px)
- Focus ring: {spec}
```
