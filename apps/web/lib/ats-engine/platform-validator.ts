import type { ScoringSection } from "./types";
import type {
    PlatformConfig,
    PlatformValidationResult,
    PlatformWarning,
} from "./platform-types";

/**
 * Validates CV sections against platform-specific ATS rules.
 * Pure function — no side effects, fast (< 10ms).
 */
export function validatePlatformRules(
    sections: ScoringSection[],
    config: PlatformConfig,
): PlatformValidationResult {
    const warnings: PlatformWarning[] = [];

    // Check formatting constraints
    if (config.formatting.singleColumnOnly) {
        checkSingleColumn(sections, warnings);
    }
    if (config.formatting.noTables) {
        checkNoTables(sections, warnings);
    }

    // Check Indonesian section headers
    checkSectionHeaders(sections, config, warnings);

    // Add platform-specific format preference warning
    if (config.preferredFormat === "docx") {
        warnings.push({
            severity: "info",
            message: `${config.name} lebih optimal dengan format DOCX. Pertimbangkan export sebagai DOCX.`,
        });
    }

    return {
        platformId: config.id,
        platformName: config.name,
        passed: warnings.every((w) => w.severity !== "error"),
        warnings,
    };
}

function checkSingleColumn(
    sections: ScoringSection[],
    warnings: PlatformWarning[],
): void {
    for (const section of sections) {
        if (!section.visible) continue;
        const content = extractTextContent(section);
        // Detect multi-column CSS patterns
        if (
            content.includes("column-count") ||
            content.includes("columns:") ||
            content.includes("display: grid") ||
            content.includes("display:grid") ||
            content.includes("display: flex") && content.includes("flex-direction: row")
        ) {
            warnings.push({
                severity: "warning",
                message: "Layout multi-kolom terdeteksi. Gunakan layout satu kolom untuk kompatibilitas ATS.",
                sectionType: section.sectionType,
            });
            break; // One warning is enough
        }
    }
}

function checkNoTables(
    sections: ScoringSection[],
    warnings: PlatformWarning[],
): void {
    for (const section of sections) {
        if (!section.visible) continue;
        const content = extractTextContent(section);
        if (content.includes("<table") || content.includes("<TABLE")) {
            warnings.push({
                severity: "error",
                message: `Tabel terdeteksi di bagian "${section.sectionType}". ATS platform ini tidak bisa membaca tabel.`,
                sectionType: section.sectionType,
            });
        }
    }
}

function checkSectionHeaders(
    sections: ScoringSection[],
    config: PlatformConfig,
    warnings: PlatformWarning[],
): void {
    const englishHeaders: Record<string, string[]> = {
        experience: ["work experience", "professional experience", "experience"],
        education: ["education", "academic background"],
        skills: ["skills", "technical skills", "core competencies"],
        summary: ["summary", "professional summary", "about me", "objective"],
        certifications: ["certifications", "licenses", "credentials"],
        projects: ["projects", "portfolio"],
    };

    for (const section of sections) {
        if (!section.visible) continue;
        const requiredNames = config.requiredHeaders[section.sectionType];
        if (!requiredNames || requiredNames.length === 0) continue;

        // Check if section content contains English headers instead of Indonesian
        const content = extractTextContent(section).toLowerCase();
        const englishAlts = englishHeaders[section.sectionType] ?? [];

        const hasEnglishHeader = englishAlts.some((h) => content.includes(h));
        const hasIndonesianHeader = requiredNames.some((h) =>
            content.toLowerCase().includes(h.toLowerCase()),
        );

        if (hasEnglishHeader && !hasIndonesianHeader) {
            warnings.push({
                severity: "warning",
                message: `Bagian "${section.sectionType}" menggunakan header Bahasa Inggris. Gunakan: "${requiredNames[0]}" untuk kompatibilitas ${config.name}.`,
                sectionType: section.sectionType,
            });
        }
    }
}

/** Extract all string content from a section for pattern matching */
function extractTextContent(section: ScoringSection): string {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(section.content)) {
        if (key.startsWith("__")) continue;
        if (typeof value === "string") {
            parts.push(value);
        }
    }
    return parts.join(" ");
}
