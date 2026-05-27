import type { DimensionScore, ScoringSection } from "../types";
import type { SectionType } from "@/types/resume";

/**
 * Keyword Match dimension (weight: 30%)
 *
 * Matches section content against curated keyword lists per section type.
 * Score = min(100, (uniqueMatchedKeywords / targetCount) * 100)
 *
 * V1: Static keyword lists. AI-powered JD comparison is Story 3.3+.
 */

interface SectionKeywordConfig {
    target: number;
    words: string[];
}

const SECTION_KEYWORDS: Partial<Record<SectionType, SectionKeywordConfig>> = {
    summary: {
        target: 3,
        words: [
            "professional", "experienced", "skilled", "passionate",
            "results-driven", "detail-oriented", "team player",
            "profesional", "berpengalaman", "terampil",
            "berorientasi hasil", "teliti", "kolaboratif",
        ],
    },
    experience: {
        target: 5,
        words: [
            "managed", "developed", "implemented", "increased", "reduced",
            "led", "designed", "optimized", "delivered", "achieved",
            "collaborated", "analyzed", "improved", "launched", "built",
            "memimpin", "mengembangkan", "mengelola", "meningkatkan",
            "mengoptimalkan", "meluncurkan", "menganalisis",
        ],
    },
    education: {
        target: 2,
        words: [
            "degree", "bachelor", "master", "gpa", "cum laude",
            "sarjana", "magister", "ipk", "gelar", "universitas",
            "honors", "scholarship", "beasiswa",
        ],
    },
    skills: {
        target: 8,
        words: [
            "javascript", "typescript", "python", "react", "node",
            "sql", "git", "docker", "aws", "api", "agile", "scrum",
            "leadership", "communication", "problem-solving",
            "project management", "data analysis", "machine learning",
            "microsoft office", "excel", "powerpoint",
            "komunikasi", "kepemimpinan", "analisis data",
        ],
    },
    projects: {
        target: 3,
        words: [
            "built", "developed", "created", "designed", "implemented",
            "deployed", "launched", "automated", "integrated",
            "membangun", "mengembangkan", "membuat", "meluncurkan",
        ],
    },
    certifications: {
        target: 2,
        words: [
            "certified", "certification", "license", "accredited",
            "sertifikasi", "bersertifikat", "lisensi",
            "aws", "google", "microsoft", "pmp", "scrum",
        ],
    },
};

export function scoreKeywordMatch(sections: ScoringSection[]): DimensionScore {
    const details: string[] = [];
    let totalMatched = 0;
    let totalExpected = 0;

    for (const section of sections) {
        if (!section.visible) continue;
        const keywords = SECTION_KEYWORDS[section.sectionType as SectionType];
        if (!keywords) continue;

        const text = extractSectionText(section).toLowerCase();
        if (!text.trim()) continue;

        const { target, words } = keywords;
        totalExpected += target;

        let matched = 0;
        for (const word of words) {
            if (text.includes(word.toLowerCase())) {
                matched++;
            }
        }
        totalMatched += Math.min(matched, target);

        if (matched < target) {
            details.push(
                `${section.sectionType}: ${matched}/${target} keywords matched`,
            );
        }
    }

    if (totalExpected === 0) {
        return { score: 50, weight: 0.30, details: ["No sections to analyze for keywords"] };
    }

    const score = Math.min(100, Math.round((totalMatched / totalExpected) * 100));

    if (score >= 80) {
        details.unshift("Good keyword coverage ✓");
    } else if (score < 50) {
        details.unshift("Low keyword coverage — add industry-standard terms");
    }

    return { score, weight: 0.30, details };
}

function extractSectionText(section: ScoringSection): string {
    if (!section.content || typeof section.content !== "object") return "";
    const parts: string[] = [];
    for (const [key, value] of Object.entries(section.content)) {
        if (key.startsWith("__")) continue;
        if (typeof value !== "string") continue;
        parts.push(value.replace(/<[^>]*>/g, " "));
    }
    return parts.join(" ");
}
