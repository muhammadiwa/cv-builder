import { describe, it, expect } from "vitest";
import { validatePlatformRules } from "../platform-validator";
import type { PlatformConfig } from "../platform-types";
import type { ScoringSection } from "../types";
import talentaConfig from "@/config/ats-rules/talenta.json";
import linovhrConfig from "@/config/ats-rules/linovhr.json";
import greatdayConfig from "@/config/ats-rules/greatday.json";

const talenta = talentaConfig as unknown as PlatformConfig;
const linovhr = linovhrConfig as unknown as PlatformConfig;
const greatday = greatdayConfig as unknown as PlatformConfig;

const validSections: ScoringSection[] = [
    {
        sectionType: "header",
        content: { title: "Data Pribadi", name: "John Doe" },
        visible: true,
    },
    {
        sectionType: "summary",
        content: { text: "Ringkasan profesional saya yang panjang dan detail" },
        visible: true,
    },
    {
        sectionType: "experience",
        content: { description: "Pengalaman Kerja di perusahaan besar selama 5 tahun" },
        visible: true,
    },
    {
        sectionType: "education",
        content: { description: "Pendidikan S1 Teknik Informatika" },
        visible: true,
    },
    {
        sectionType: "skills",
        content: { list: "Keahlian: JavaScript, TypeScript, React" },
        visible: true,
    },
];

const sectionsWithEnglishHeaders: ScoringSection[] = [
    {
        sectionType: "experience",
        content: { description: "Work Experience at a large company for 5 years" },
        visible: true,
    },
    {
        sectionType: "education",
        content: { description: "Education in Computer Science" },
        visible: true,
    },
];

const sectionsWithTable: ScoringSection[] = [
    {
        sectionType: "skills",
        content: { html: "<table><tr><td>Skill 1</td><td>Skill 2</td></tr></table>" },
        visible: true,
    },
];

describe("validatePlatformRules", () => {
    it("passes valid CV with Indonesian headers for Talenta", () => {
        const result = validatePlatformRules(validSections, talenta);
        // Should only have info-level warnings (format preference)
        const nonInfoWarnings = result.warnings.filter((w) => w.severity !== "info");
        expect(nonInfoWarnings).toHaveLength(0);
        expect(result.passed).toBe(true);
    });

    it("detects English headers for Talenta", () => {
        const result = validatePlatformRules(sectionsWithEnglishHeaders, talenta);
        const headerWarnings = result.warnings.filter(
            (w) => w.message.includes("Bahasa Inggris"),
        );
        expect(headerWarnings.length).toBeGreaterThan(0);
    });

    it("detects tables as error", () => {
        const result = validatePlatformRules(sectionsWithTable, talenta);
        const tableErrors = result.warnings.filter(
            (w) => w.severity === "error" && w.message.includes("Tabel"),
        );
        expect(tableErrors).toHaveLength(1);
        expect(result.passed).toBe(false);
    });

    it("all 3 platform configs are valid and parseable", () => {
        expect(talenta.id).toBe("talenta");
        expect(talenta.name).toContain("Mekari");
        expect(linovhr.id).toBe("linovhr");
        expect(greatday.id).toBe("greatday");
        expect(talenta.preferredFormat).toBe("docx");
        expect(greatday.preferredFormat).toBe("pdf");
    });

    it("LinovHR passes valid sections", () => {
        const result = validatePlatformRules(validSections, linovhr);
        expect(result.passed).toBe(true);
        expect(result.platformName).toBe("LinovHR");
    });

    it("GreatDay HR passes valid sections", () => {
        const result = validatePlatformRules(validSections, greatday);
        expect(result.passed).toBe(true);
        expect(result.platformName).toBe("GreatDay HR");
    });

    it("skips hidden sections", () => {
        const hiddenTable: ScoringSection[] = [
            {
                sectionType: "skills",
                content: { html: "<table><tr><td>x</td></tr></table>" },
                visible: false,
            },
        ];
        const result = validatePlatformRules(hiddenTable, talenta);
        const tableErrors = result.warnings.filter((w) => w.severity === "error");
        expect(tableErrors).toHaveLength(0);
    });
});
