import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ATSPanel } from "../ATSPanel";
import type { ATSScore } from "@/lib/ats-engine/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
    useParams: () => ({ id: "test-resume-123" }),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
    motion: {
        circle: ({ children, ...props }: any) => <circle {...props}>{children}</circle>,
        span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
        div: ({ children, variants, initial, animate, ...props }: any) => (
            <div {...props}>{children}</div>
        ),
        path: ({ children, ...props }: any) => <path {...props}>{children}</path>,
    },
    useMotionValue: (initial: number) => ({ get: () => initial, set: () => { } }),
    useSpring: (mv: any) => mv,
    useTransform: (mv: any, fn: (v: number) => number) => fn(mv.get?.() ?? 0),
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: any) => children,
}));

// Mock sonner
vi.mock("sonner", () => ({
    toast: vi.fn(),
}));

// Mock the editor store
const mockStore: Record<string, any> = {
    atsScore: null,
    atsComputing: false,
    sections: [],
};

vi.mock("@/stores/editorStore", () => ({
    useEditorStore: (selector: (s: any) => any) => selector(mockStore),
}));

vi.mock("@/stores/editorLayoutStore", () => ({
    useEditorLayoutStore: (selector: (s: any) => any) =>
        selector({ setActiveSectionId: vi.fn(), activeSectionId: null }),
}));

const mockScore: ATSScore = {
    total: 72,
    dimensions: {
        keywordMatch: { score: 65, weight: 0.3, details: ["Found 4 of 8 keywords"] },
        formatting: { score: 85, weight: 0.2, details: ["No tables detected"] },
        completeness: { score: 71, weight: 0.15, details: ["Missing: certifications"] },
        readability: { score: 80, weight: 0.15, details: ["Average sentence length OK"] },
        metricsImpact: { score: 50, weight: 0.1, details: ["2 metrics found"] },
        optimization: { score: 70, weight: 0.1, details: ["Action verbs present"] },
    },
    computedAt: Date.now(),
};

describe("ATSPanel", () => {
    beforeEach(() => {
        mockStore.atsScore = null;
        mockStore.atsComputing = false;
        mockStore.sections = [];
        sessionStorage.clear();
    });

    it("renders loading skeleton when computing with no score", () => {
        mockStore.atsComputing = true;
        mockStore.atsScore = null;

        const { container } = render(<ATSPanel />);

        const pulseElements = container.querySelectorAll(".animate-pulse");
        expect(pulseElements.length).toBeGreaterThan(0);
    });

    it("renders empty state when atsScore is null", () => {
        mockStore.atsScore = null;
        mockStore.atsComputing = false;

        render(<ATSPanel />);

        expect(screen.getByText("Skor ATS")).toBeInTheDocument();
        expect(
            screen.getByText(/Mulai isi CV Anda untuk melihat skor ATS/),
        ).toBeInTheDocument();
    });

    it("renders score ring and all 6 category cards when score is present", () => {
        mockStore.atsScore = mockScore;
        mockStore.sections = [
            { id: "s1", sectionType: "skills", content: {}, visible: true },
        ];

        render(<ATSPanel />);

        expect(screen.getByRole("meter")).toBeInTheDocument();
        expect(screen.getByText("Skor ATS CV Anda")).toBeInTheDocument();

        const progressBars = screen.getAllByRole("progressbar");
        expect(progressBars).toHaveLength(6);
    });

    it("renders context text based on score band", () => {
        mockStore.atsScore = mockScore; // total = 72

        render(<ATSPanel />);

        expect(
            screen.getByText("Bagus! CV Anda sudah cukup kompetitif."),
        ).toBeInTheDocument();
    });
});
