# Full CV Quality Review

Perform a comprehensive quality review of a CV. This is the primary capability — a complete pass across all dimensions.

## Input

- CV content (JSON structure, plain text, or PDF text extraction)
- Target job description (optional — for keyword matching)
- Target ATS platform (optional — Talenta, Mekari, Greenhouse, Workday, or General)

## Review Dimensions

1. **Formatting (weight: 20%)** — Single-column? Standard fonts? No tables/columns/text boxes? Headers/footers clean?
2. **Keyword Match (weight: 30%)** — TF-IDF + semantic similarity against JD or industry baseline
3. **Completeness (weight: 15%)** — All 7 standard sections present? Contact info complete?
4. **Readability (weight: 15%)** — Bullet quality, action verbs, sentence length, quantified metrics
5. **Grammar & Language (weight: 10%)** — Ejaan (Bahasa Indonesia), spelling (English), consistency
6. **Optimization (weight: 10%)** — Length, keyword density (not stuffing), section order

## What Success Looks Like

- Overall ATS score with breakdown per dimension
- Top 3 things the user did well (build confidence)
- Top 5 prioritized improvements with before/after examples
- Each improvement includes: what's wrong, why it matters, exactly how to fix, estimated score impact
- Indonesian-specific checks: photo handling, personal details format, IPK format, organization experience
- Platform-specific rules applied when target ATS is specified

## Tone

Start with the score and the good news. Follow with improvements ranked by impact. End with: "Fix these 3 first — estimated score jump: +12 points."

Never say "this CV is bad." Say "this CV is {score}/100. Here's how we get it to {score+estimated_gain}."
