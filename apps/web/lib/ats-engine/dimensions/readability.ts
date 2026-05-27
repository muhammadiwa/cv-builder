import type { DimensionScore, ScoringSection } from "../types";

/**
 * Readability dimension (weight: 15%)
 *
 * Measures:
 * - Average sentence length (penalize > 25 words)
 * - Passive voice ratio (penalize > 20%)
 *
 * Adapted for bilingual Indonesian/English text.
 */

// Passive voice indicators
const PASSIVE_EN = /\b(was|were|been|being|is|are|am)\s+\w+ed\b/gi;
const PASSIVE_ID = /\bdi\w+kan\b|\bdi\w+i\b|\bter\w+\b/gi;

export function scoreReadability(sections: ScoringSection[]): DimensionScore {
    const text = extractPlainText(sections);
    const details: string[] = [];

    if (!text.trim()) {
        return { score: 50, weight: 0.15, details: ["No text content to analyze"] };
    }

    // Split into sentences (rough heuristic)
    const sentences = text
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    if (sentences.length === 0) {
        return { score: 50, weight: 0.15, details: ["No sentences detected"] };
    }

    // Average sentence length
    const totalWords = sentences.reduce(
        (sum, s) => sum + s.split(/\s+/).length,
        0,
    );
    const avgSentenceLength = totalWords / sentences.length;
    const longSentences = sentences.filter(
        (s) => s.split(/\s+/).length > 25,
    ).length;

    // Passive voice detection
    const passiveMatchesEN = text.match(PASSIVE_EN) ?? [];
    const passiveMatchesID = text.match(PASSIVE_ID) ?? [];
    const totalPassive = passiveMatchesEN.length + passiveMatchesID.length;
    const passiveRatio = sentences.length > 0 ? totalPassive / sentences.length : 0;

    // Scoring
    let score = 100;

    // Penalize long average sentence length
    if (avgSentenceLength > 25) {
        score -= Math.min(30, Math.round((avgSentenceLength - 25) * 3));
        details.push(
            `Average sentence length: ${Math.round(avgSentenceLength)} words (target: ≤25)`,
        );
    }

    // Penalize long individual sentences
    if (longSentences > 0) {
        score -= Math.min(20, longSentences * 5);
        details.push(`${longSentences} sentence(s) exceed 25 words`);
    }

    // Penalize passive voice
    if (passiveRatio > 0.2) {
        score -= Math.min(25, Math.round((passiveRatio - 0.2) * 100));
        details.push(
            `Passive voice: ${Math.round(passiveRatio * 100)}% (target: ≤20%)`,
        );
    }

    score = Math.max(0, Math.min(100, score));

    if (details.length === 0) {
        details.push("Readability is good ✓");
    }

    return { score, weight: 0.15, details };
}

function extractPlainText(sections: ScoringSection[]): string {
    const parts: string[] = [];
    for (const s of sections) {
        if (!s.content || typeof s.content !== "object") continue;
        for (const [key, value] of Object.entries(s.content)) {
            if (key.startsWith("__")) continue;
            if (typeof value !== "string") continue;
            // Strip HTML tags to get plain text
            parts.push(value.replace(/<[^>]*>/g, " ").trim());
        }
    }
    return parts.join(". ");
}
