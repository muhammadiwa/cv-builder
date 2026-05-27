import type { DimensionScore, ScoringSection } from "../types";
import { ACTION_VERBS_EN, ACTION_VERBS_ID } from "../data/action-verbs";

/**
 * Optimization dimension (weight: 10%)
 *
 * Measures:
 * - Action verbs at bullet/sentence start in experience sections
 * - Bullet count per experience entry (3-5 ideal)
 * - Total word count (300-800 ideal for 1-page CV)
 */

export function scoreOptimization(sections: ScoringSection[]): DimensionScore {
    const details: string[] = [];
    let score = 100;

    const allText = extractAllText(sections);
    const totalWords = allText.split(/\s+/).filter(Boolean).length;

    // Word count check (300-800 ideal for 1-page)
    if (totalWords < 200) {
        score -= 25;
        details.push(`CV too short: ${totalWords} words (target: 300-800)`);
    } else if (totalWords < 300) {
        score -= 10;
        details.push(`CV slightly short: ${totalWords} words (target: 300-800)`);
    } else if (totalWords > 1000) {
        score -= 15;
        details.push(`CV may be too long: ${totalWords} words (target: 300-800 for 1 page)`);
    }

    // Action verbs in experience sections
    const experienceSections = sections.filter(
        (s) => s.visible && s.sectionType === "experience",
    );

    if (experienceSections.length > 0) {
        const expText = extractAllText(experienceSections);
        // Split into bullet-like segments (lines or <li> items)
        const bullets = expText
            .split(/[\n•\-]|<li[^>]*>/i)
            .map((b) => b.replace(/<[^>]*>/g, "").trim())
            .filter((b) => b.length > 10);

        if (bullets.length > 0) {
            const allVerbs = new Set([...ACTION_VERBS_EN, ...ACTION_VERBS_ID]);
            let verbStartCount = 0;

            for (const bullet of bullets) {
                const firstWord = bullet.split(/\s+/)[0]?.toLowerCase() ?? "";
                if (allVerbs.has(firstWord)) verbStartCount++;
            }

            const verbRatio = verbStartCount / bullets.length;
            if (verbRatio < 0.5) {
                score -= Math.min(20, Math.round((0.5 - verbRatio) * 40));
                details.push(
                    `${Math.round(verbRatio * 100)}% of bullets start with action verbs (target: ≥50%)`,
                );
            }
        }
    }

    score = Math.max(0, Math.min(100, score));
    if (details.length === 0) {
        details.push("Structure and optimization look good ✓");
    }

    return { score, weight: 0.10, details };
}

function extractAllText(sections: ScoringSection[]): string {
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
