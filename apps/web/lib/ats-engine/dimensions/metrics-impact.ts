import type { DimensionScore, ScoringSection } from "../types";

/**
 * Metrics Impact dimension (weight: 10%)
 *
 * Detects quantifiable achievements: numbers, percentages, currency.
 * More metrics = higher score. Focuses on experience + projects sections.
 *
 * Score = min(100, metricsFound * 15)
 */

// Patterns for quantifiable metrics
const METRIC_PATTERNS = [
    /\d+%/g,                          // percentages: 25%, 150%
    /\d+\+/g,                         // "50+ clients"
    /\b\d{1,3}(,\d{3})+\b/g,         // large numbers: 1,000 or 10,000
    /\b\d+x\b/gi,                     // multipliers: 3x, 10x
    /\bRp\s*[\d.,]+/gi,              // Indonesian currency
    /\$[\d.,]+/g,                     // USD
    /\b\d+\s*(orang|people|users|clients|customers)\b/gi, // people counts
    /\b\d+\s*(project|proyek)\b/gi,   // project counts
];

const RELEVANT_SECTIONS = new Set(["experience", "projects", "achievements"]);

export function scoreMetricsImpact(sections: ScoringSection[]): DimensionScore {
    const relevantSections = sections.filter(
        (s) => s.visible && RELEVANT_SECTIONS.has(s.sectionType),
    );

    if (relevantSections.length === 0) {
        return {
            score: 0,
            weight: 0.10,
            details: ["No experience/projects sections to analyze for metrics"],
        };
    }

    const text = extractPlainText(relevantSections);
    if (!text.trim()) {
        return {
            score: 0,
            weight: 0.10,
            details: ["Experience/projects sections are empty"],
        };
    }

    let metricsFound = 0;
    const foundExamples: string[] = [];

    for (const pattern of METRIC_PATTERNS) {
        const matches = text.match(pattern);
        if (matches) {
            metricsFound += matches.length;
            if (foundExamples.length < 3) {
                foundExamples.push(matches[0]);
            }
        }
    }

    const score = Math.min(100, metricsFound * 15);
    const details: string[] = [];

    if (metricsFound === 0) {
        details.push("No quantifiable metrics found — add numbers, percentages, or results");
    } else {
        details.push(`${metricsFound} metric(s) found (e.g., ${foundExamples.join(", ")})`);
        if (score < 100) {
            details.push("Add more quantifiable results to strengthen impact");
        }
    }

    return { score, weight: 0.10, details };
}

function extractPlainText(sections: ScoringSection[]): string {
    const parts: string[] = [];
    for (const s of sections) {
        if (!s.content || typeof s.content !== "object") continue;
        for (const [key, value] of Object.entries(s.content)) {
            if (key.startsWith("__")) continue;
            if (typeof value !== "string") continue;
            parts.push(value.replace(/<[^>]*>/g, " ").trim());
        }
    }
    return parts.join(" ");
}
