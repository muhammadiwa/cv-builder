import type { SectionType } from "@/types/resume";

export interface PlatformConfig {
    id: string;
    name: string;
    description: string;
    preferredFormat: "pdf" | "docx" | "both";
    /** Acceptable Indonesian header names per section type */
    requiredHeaders: Partial<Record<SectionType, string[]>>;
    formatting: {
        singleColumnOnly: boolean;
        maxFontCount: number;
        allowedFonts: string[];
        noTables: boolean;
        noTextBoxes: boolean;
        noHeadersFooters: boolean;
    };
    /** Platform-specific tips shown to user */
    warnings: string[];
}

export type PlatformWarningSeverity = "error" | "warning" | "info";

export interface PlatformWarning {
    severity: PlatformWarningSeverity;
    message: string;
    /** Which section triggered this warning (if applicable) */
    sectionType?: SectionType;
}

export interface PlatformValidationResult {
    platformId: string;
    platformName: string;
    passed: boolean;
    warnings: PlatformWarning[];
}
