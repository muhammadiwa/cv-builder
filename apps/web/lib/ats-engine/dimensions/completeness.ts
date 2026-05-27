import type { DimensionScore, ScoringSection } from "../types";
import { REQUIRED_SECTION_TYPES } from "../types";

/**
 * Completeness dimension (weight: 15%)
 *
 * Checks how many of the 7 required section types are present.
 * Score = (present / 7) * 100
 */
export function scoreCompleteness(sections: ScoringSection[]): DimensionScore {
    const presentTypes = new Set(
        sections
            .filter((s) => s.visible)
            .map((s) => s.sectionType),
    );

    const missing: string[] = [];
    let present = 0;

    for (const required of REQUIRED_SECTION_TYPES) {
        if (presentTypes.has(required)) {
            present++;
        } else {
            missing.push(required);
        }
    }

    const score = Math.round((present / REQUIRED_SECTION_TYPES.length) * 100);
    const details: string[] = [];

    if (missing.length > 0) {
        details.push(`Missing sections: ${missing.join(", ")}`);
    }
    if (present === REQUIRED_SECTION_TYPES.length) {
        details.push("All required sections present ✓");
    }

    return { score, weight: 0.15, details };
}
