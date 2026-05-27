import type { SectionType } from "@/types/resume";

/**
 * Curated keyword expectations per section type.
 *
 * `target` = how many unique keywords we expect to find for a good score.
 * `words` = the keyword pool to match against.
 *
 * V1: Static lists. AI-powered JD comparison is Story 3.3+.
 */

interface SectionKeywordConfig {
    target: number;
    words: string[];
}

export type { SectionType };

export const SECTION_KEYWORDS: Partial<Record<SectionType, SectionKeywordConfig>> = {
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
