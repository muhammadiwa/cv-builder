import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ScoreRing } from "../ScoreRing";

// Mock framer-motion to avoid animation complexity in tests
vi.mock("framer-motion", () => {
    let currentValue = 0;
    return {
        motion: {
            circle: ({ children, ...props }: any) => <circle {...props}>{children}</circle>,
            span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
        },
        useMotionValue: (initial: number) => {
            const mv = {
                get: () => currentValue,
                set: (v: number) => { currentValue = v; },
            };
            return mv;
        },
        useSpring: (mv: any) => mv,
        useTransform: (mv: any, fn: (v: number) => number) => fn(mv.get()),
        useReducedMotion: () => false,
    };
});

describe("ScoreRing", () => {
    it("renders with role=meter and correct aria attributes", () => {
        render(<ScoreRing value={78} animated={false} />);

        const meter = screen.getByRole("meter");
        expect(meter).toBeInTheDocument();
        expect(meter).toHaveAttribute("aria-valuenow", "78");
        expect(meter).toHaveAttribute("aria-valuemin", "0");
        expect(meter).toHaveAttribute("aria-valuemax", "100");
        expect(meter).toHaveAttribute("aria-label", "Skor ATS: 78 dari 100");
    });

    it("displays /100 label", () => {
        render(<ScoreRing value={65} animated={false} />);
        expect(screen.getByText("/100")).toBeInTheDocument();
    });

    it("clamps value to 0-100 range", () => {
        render(<ScoreRing value={150} animated={false} />);

        const meter = screen.getByRole("meter");
        expect(meter).toHaveAttribute("aria-valuenow", "100");
    });

    it("clamps negative values to 0", () => {
        render(<ScoreRing value={-10} animated={false} />);

        const meter = screen.getByRole("meter");
        expect(meter).toHaveAttribute("aria-valuenow", "0");
    });

    it("renders SVG with gradient definition", () => {
        const { container } = render(<ScoreRing value={50} animated={false} />);

        const gradient = container.querySelector("linearGradient");
        expect(gradient).toBeInTheDocument();
    });

    it("applies correct size", () => {
        const { container } = render(<ScoreRing value={50} size={160} animated={false} />);

        const svg = container.querySelector("svg");
        expect(svg).toHaveAttribute("width", "160");
        expect(svg).toHaveAttribute("height", "160");
    });
});
