# Full JD Analysis

Perform a comprehensive analysis of a job description. This is the primary capability.

## Input

- Job description text or URL
- User's industry context (optional — for better signal detection)
- User's career stage (optional — fresh grad, experienced, executive)

## Analysis Dimensions

1. **Keyword Extraction** — Required (must appear in CV), nice-to-have (differentiator), culture-fit (context-dependent)
2. **Skills Mapping** — Hard skills (tools, languages, certs), soft skills, domain knowledge
3. **Experience Level** — Years required (explicit and implied), seniority signals, management scope
4. **Industry Context** — Company type (startup, corporate, BUMN, MNC), sector norms, company size signals
5. **Hidden Signals** — Corporate euphemisms decoded, red flags, unstated expectations

## What Success Looks Like

- Keyword priority matrix: Tier 1 (must-have, CV won't pass without), Tier 2 (strong advantage), Tier 3 (nice but skip if CV is full)
- CV optimization checklist: 5-10 specific things to add/change/emphasize in the CV for THIS job
- Red flag report: 3-5 things the user should know before applying
- Industry context: what this company values vs. what the JD actually says

## Output Structure

```
### JD Summary
{Company} — {Role} | {Experience Level} | {Industry}

### Keyword Priority Matrix
| Priority | Keyword | Why It Matters | Put Where in CV |
|----------|---------|---------------|-----------------|
| Tier 1   | ...     | ...           | ...             |

### Skills Breakdown
**Hard Skills:** ...
**Soft Skills:** ...
**Domain Knowledge:** ...

### Hidden Signals
🟢 **Good signs:** ...
🟡 **Watch for:** ...
🔴 **Red flags:** ...

### CV Optimization Checklist
1. [Action] — [Which section] — [Estimated ATS impact: +X]
2. ...

### Bottom Line
{One-sentence verdict — worth applying? competitive? red flags?}
```
