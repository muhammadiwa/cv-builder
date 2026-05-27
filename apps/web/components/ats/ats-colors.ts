import type { DimensionKey } from "@/lib/ats-engine/types";
import type { SectionType } from "@/types/resume";

/**
 * ATS Score color and label utilities.
 * Uses HSL CSS variables defined in globals.css.
 */

export function getScoreColor(score: number): string {
    if (score >= 86) return "hsl(var(--ats-emerald))";
    if (score >= 66) return "hsl(var(--ats-blue))";
    if (score >= 41) return "hsl(var(--ats-amber))";
    return "hsl(var(--ats-red))";
}

export function getScoreLabel(score: number): string {
    if (score >= 86) return "Sangat baik";
    if (score >= 66) return "Baik";
    if (score >= 41) return "Cukup";
    return "Perlu ditingkatkan";
}

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
    keywordMatch: "Kata Kunci",
    formatting: "Format",
    completeness: "Kelengkapan",
    readability: "Keterbacaan",
    metricsImpact: "Metrik & Angka",
    optimization: "Optimasi",
};

/**
 * Maps dimensions to the most relevant section type for scroll-to-section.
 * `undefined` means the dimension applies globally (no single section target).
 */
export const DIMENSION_SECTION_MAP: Partial<Record<DimensionKey, SectionType>> = {
    keywordMatch: "skills",
    readability: "summary",
    metricsImpact: "experience",
    optimization: "experience",
};
