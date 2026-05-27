import type { ATSScore, DimensionKey, DimensionScore, ScoringInput } from "./types";
import { DIMENSION_WEIGHTS } from "./types";
import { scoreCompleteness } from "./dimensions/completeness";
import { scoreFormatting } from "./dimensions/formatting";
import { scoreKeywordMatch } from "./dimensions/keyword-match";
import { scoreMetricsImpact } from "./dimensions/metrics-impact";
import { scoreOptimization } from "./dimensions/optimization";
import { scoreReadability } from "./dimensions/readability";

/**
 * Main ATS scoring function. Pure, deterministic, no side effects.
 *
 * Computes a 0-100 weighted score from 6 dimensions. Each dimension
 * scorer is independent and returns its own 0-100 score + details.
 *
 * The total is the weighted sum: Σ(dimension.score * dimension.weight).
 */
export function computeATSScore(input: ScoringInput): ATSScore {
    const { sections } = input;

    // Guard: empty sections → zero score
    if (!sections || sections.length === 0) {
        const emptyDimension: DimensionScore = {
            score: 0,
            weight: 0,
            details: ["No sections to score"],
        };
        return {
            total: 0,
            dimensions: {
                keywordMatch: { ...emptyDimension, weight: DIMENSION_WEIGHTS.keywordMatch },
                formatting: { ...emptyDimension, weight: DIMENSION_WEIGHTS.formatting },
                completeness: { ...emptyDimension, weight: DIMENSION_WEIGHTS.completeness },
                readability: { ...emptyDimension, weight: DIMENSION_WEIGHTS.readability },
                metricsImpact: { ...emptyDimension, weight: DIMENSION_WEIGHTS.metricsImpact },
                optimization: { ...emptyDimension, weight: DIMENSION_WEIGHTS.optimization },
            },
            computedAt: Date.now(),
        };
    }

    // Compute each dimension independently
    const dimensions: Record<DimensionKey, DimensionScore> = {
        keywordMatch: scoreKeywordMatch(sections),
        formatting: scoreFormatting(sections),
        completeness: scoreCompleteness(sections),
        readability: scoreReadability(sections),
        metricsImpact: scoreMetricsImpact(sections),
        optimization: scoreOptimization(sections),
    };

    // Weighted total
    let total = 0;
    for (const key of Object.keys(DIMENSION_WEIGHTS) as DimensionKey[]) {
        total += dimensions[key].score * DIMENSION_WEIGHTS[key];
    }
    total = Math.round(total);

    return {
        total,
        dimensions,
        computedAt: Date.now(),
    };
}
