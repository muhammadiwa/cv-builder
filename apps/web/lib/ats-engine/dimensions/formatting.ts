import type { DimensionScore, ScoringSection } from "../types";

/**
 * Formatting dimension (weight: 20%)
 *
 * Detects ATS-unfriendly formatting patterns in HTML content:
 * - Tables (<table>)
 * - Centered text (text-align: center)
 * - Multi-column layouts (column-count, grid, flex with multiple columns)
 * - Non-standard fonts
 * - Headers/footers patterns
 *
 * Score = 100 - (penalties). Each issue deducts points.
 */

const PENALTY_TABLE = 15;
const PENALTY_CENTERED = 10;
const PENALTY_MULTICOLUMN = 15;
const PENALTY_NONSTANDARD_FONT = 10;
const PENALTY_HEADER_FOOTER = 5;

// Standard ATS-safe fonts
const SAFE_FONTS = new Set([
    "arial", "helvetica", "times new roman", "times", "calibri",
    "cambria", "georgia", "garamond", "verdana", "tahoma",
    "trebuchet ms", "courier new", "courier", "inter", "jakarta sans",
]);

export function scoreFormatting(sections: ScoringSection[]): DimensionScore {
    const details: string[] = [];
    let penalty = 0;

    // Collect all HTML content strings
    const allContent = extractTextContent(sections);

    // Check for tables
    if (/<table[\s>]/i.test(allContent)) {
        penalty += PENALTY_TABLE;
        details.push("Table detected — most ATS parsers cannot read tables");
    }

    // Check for centered text
    if (/text-align\s*:\s*center/i.test(allContent)) {
        penalty += PENALTY_CENTERED;
        details.push("Centered text detected — may confuse ATS parsing order");
    }

    // Check for multi-column
    if (/column-count|display\s*:\s*grid|display\s*:\s*flex/i.test(allContent)) {
        penalty += PENALTY_MULTICOLUMN;
        details.push("Multi-column layout detected — ATS reads left-to-right only");
    }

    // Check for non-standard fonts
    const fontMatches = allContent.match(/font-family\s*:\s*["']?([^;"']+)/gi);
    if (fontMatches) {
        for (const match of fontMatches) {
            const fontName = match.replace(/font-family\s*:\s*["']?/i, "").trim().toLowerCase();
            if (!SAFE_FONTS.has(fontName)) {
                penalty += PENALTY_NONSTANDARD_FONT;
                details.push(`Non-standard font: "${fontName}" — may not render in ATS`);
                break; // Only penalize once for fonts
            }
        }
    }

    // Check for header/footer patterns
    if (/<header[\s>]|<footer[\s>]/i.test(allContent)) {
        penalty += PENALTY_HEADER_FOOTER;
        details.push("HTML header/footer elements — some ATS skip these regions");
    }

    const score = Math.max(0, 100 - penalty);
    if (score === 100) {
        details.push("Formatting is ATS-safe ✓");
    }

    return { score, weight: 0.20, details };
}

function extractTextContent(sections: ScoringSection[]): string {
    const parts: string[] = [];
    for (const s of sections) {
        if (!s.content || typeof s.content !== "object") continue;
        for (const [key, value] of Object.entries(s.content)) {
            if (key.startsWith("__")) continue; // Skip metadata keys
            if (typeof value === "string") parts.push(value);
        }
    }
    return parts.join(" ");
}
