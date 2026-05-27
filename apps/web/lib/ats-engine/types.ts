import type { SectionType } from "@/types/resume";

/**
 * ATS Scoring Engine Types
 *
 * All types are serializable (no functions, no classes) so they can cross
 * the Web Worker boundary via structured clone / comlink.
 */

/** Weights for each scoring dimension. Must sum to 1.0. */
export const DIMENSION_WEIGHTS = {
    keywordMatch: 0.30,
    formatting: 0.20,
    completeness: 0.15,
    readability: 0.15,
    metricsImpact: 0.10,
    optimization: 0.10,
} as const;

export type DimensionKey = keyof typeof DIMENSION_WEIGHTS;

export interface DimensionScore {
    /** 0-100 score for this dimension */
    score: number;
    /** Weight applied to this dimension */
    weight: number;
    /** Human-readable details explaining the score (for UI breakdown) */
    details: string[];
}

export interface ATSScore {
    /** Weighted total score 0-100 */
    total: number;
    /** Per-dimension breakdown */
    dimensions: Record<DimensionKey, DimensionScore>;
    /** When this score was computed (ms epoch) */
    computedAt: number;
}

/** Input shape for the scoring engine. Stripped of non-scoring fields. */
export interface ScoringInput {
    sections: ScoringSection[];
}

export interface ScoringSection {
    sectionType: SectionType;
    /** Content with __field_updated_at already stripped */
    content: Record<string, unknown>;
    visible: boolean;
}

/** The 7 required section types for completeness scoring */
export const REQUIRED_SECTION_TYPES: SectionType[] = [
    "header",
    "summary",
    "experience",
    "education",
    "skills",
    "certifications",
    "projects",
];
