import { describe, expect, it } from "vitest";
import { computeATSScore } from "../scorer";
import type { ScoringInput, ScoringSection } from "../types";

function section(
    sectionType: string,
    content: Record<string, unknown> = {},
    visible = true,
): ScoringSection {
    return { sectionType: sectionType as any, content, visible };
}

describe("computeATSScore", () => {
    it("returns 0 for empty sections array", () => {
        const result = computeATSScore({ sections: [] });
        expect(result.total).toBe(0);
        expect(result.dimensions.completeness.score).toBe(0);
    });

    it("returns a score between 0 and 100", () => {
        const input: ScoringInput = {
            sections: [
                section("header", { name: "John Doe", email: "john@example.com" }),
                section("summary", { summary: "Experienced professional with 5 years in software development." }),
                section("experience", { description: "Led a team of 10 engineers. Increased revenue by 25%. Managed $1M budget." }),
                section("education", { degree: "Bachelor of Computer Science from Universitas Indonesia" }),
                section("skills", { skills: "JavaScript, TypeScript, React, Node.js, SQL, Git, Docker, AWS, Agile" }),
                section("certifications", { name: "AWS Certified Solutions Architect" }),
                section("projects", { description: "Built an e-commerce platform that served 50,000+ users" }),
            ],
        };
        const result = computeATSScore(input);
        expect(result.total).toBeGreaterThanOrEqual(0);
        expect(result.total).toBeLessThanOrEqual(100);
        expect(result.computedAt).toBeGreaterThan(0);
    });

    it("completeness: 100% when all 7 required sections present", () => {
        const input: ScoringInput = {
            sections: [
                section("header"), section("summary"), section("experience"),
                section("education"), section("skills"), section("certifications"),
                section("projects"),
            ],
        };
        const result = computeATSScore(input);
        expect(result.dimensions.completeness.score).toBe(100);
    });

    it("completeness: penalized when sections missing", () => {
        const input: ScoringInput = {
            sections: [
                section("header"), section("summary"), section("experience"),
            ],
        };
        const result = computeATSScore(input);
        // 3/7 = ~43%
        expect(result.dimensions.completeness.score).toBe(43);
        expect(result.dimensions.completeness.details.some(
            (d) => d.includes("Missing sections"),
        )).toBe(true);
    });

    it("formatting: 100% for clean HTML without ATS-unfriendly patterns", () => {
        const input: ScoringInput = {
            sections: [
                section("experience", { description: "<p>Led a team of engineers</p>" }),
            ],
        };
        const result = computeATSScore(input);
        expect(result.dimensions.formatting.score).toBe(100);
    });

    it("formatting: penalized for tables", () => {
        const input: ScoringInput = {
            sections: [
                section("experience", { description: "<table><tr><td>Skills</td></tr></table>" }),
            ],
        };
        const result = computeATSScore(input);
        expect(result.dimensions.formatting.score).toBeLessThan(100);
        expect(result.dimensions.formatting.details.some(
            (d) => d.includes("Table detected"),
        )).toBe(true);
    });

    it("metrics: higher score with more numbers/percentages", () => {
        const withMetrics: ScoringInput = {
            sections: [
                section("experience", { description: "Increased revenue by 25%. Managed team of 10. Reduced costs by $50K." }),
            ],
        };
        const withoutMetrics: ScoringInput = {
            sections: [
                section("experience", { description: "Managed a team. Worked on projects. Improved processes." }),
            ],
        };
        const scoreWith = computeATSScore(withMetrics).dimensions.metricsImpact.score;
        const scoreWithout = computeATSScore(withoutMetrics).dimensions.metricsImpact.score;
        expect(scoreWith).toBeGreaterThan(scoreWithout);
    });

    it("ignores __field_updated_at metadata in content", () => {
        const input: ScoringInput = {
            sections: [
                section("experience", {
                    description: "Led a team",
                    __field_updated_at: { description: 1234567890 },
                }),
            ],
        };
        // Should not crash and should not count __field_updated_at as content
        const result = computeATSScore(input);
        expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it("hidden sections are excluded from scoring (except completeness)", () => {
        const input: ScoringInput = {
            sections: [
                section("experience", { description: "Led a team of 10 engineers" }, false),
                section("header", { name: "Test" }),
            ],
        };
        const result = computeATSScore(input);
        // Experience is hidden, so metrics/keywords from it shouldn't count
        expect(result.dimensions.metricsImpact.score).toBe(0);
    });

    it("weighted total is correctly computed", () => {
        // With all 7 sections present and some content, verify the math
        const input: ScoringInput = {
            sections: [
                section("header", { name: "Test" }),
                section("summary", { summary: "Professional experienced skilled" }),
                section("experience", { description: "Managed and developed systems. Increased efficiency by 30%." }),
                section("education", { degree: "Bachelor degree from universitas" }),
                section("skills", { skills: "javascript typescript react node sql git docker aws" }),
                section("certifications", { name: "AWS certified" }),
                section("projects", { description: "Built and deployed a platform" }),
            ],
        };
        const result = computeATSScore(input);

        // Verify total = sum of (score * weight) for each dimension
        const manualTotal = Math.round(
            result.dimensions.keywordMatch.score * 0.30 +
            result.dimensions.formatting.score * 0.20 +
            result.dimensions.completeness.score * 0.15 +
            result.dimensions.readability.score * 0.15 +
            result.dimensions.metricsImpact.score * 0.10 +
            result.dimensions.optimization.score * 0.10,
        );
        expect(result.total).toBe(manualTotal);
    });

    it("handles null/undefined content gracefully", () => {
        const input: ScoringInput = {
            sections: [
                { sectionType: "experience" as any, content: null as any, visible: true },
                { sectionType: "summary" as any, content: undefined as any, visible: true },
            ],
        };
        // Should not throw
        const result = computeATSScore(input);
        expect(result.total).toBeGreaterThanOrEqual(0);
    });
});
