"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface ScoreHistoryEntry {
    total: number;
    computedAt: number;
}

interface ScoreHistorySparklineProps {
    history: ScoreHistoryEntry[];
}

const WIDTH = 200;
const HEIGHT = 60;
const PADDING = 8;

/**
 * SVG sparkline showing last N score values with pathLength animation.
 * Decorative — hidden from screen readers with text fallback.
 */
export function ScoreHistorySparkline({ history }: ScoreHistorySparklineProps) {
    const prefersReduced = useReducedMotion();
    const fillId = useId();

    if (history.length === 0) return null;

    const scores = history.map((h) => h.total);

    // Normalize points into SVG coordinate space
    const points = scores.map((score, i) => ({
        x: PADDING + (i / Math.max(scores.length - 1, 1)) * (WIDTH - PADDING * 2),
        y: PADDING + ((100 - score) / 100) * (HEIGHT - PADDING * 2),
    }));

    // Build line path
    const linePath =
        points.length === 1
            ? ""
            : points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    // Build area path (line + close to bottom)
    const areaPath =
        points.length < 2
            ? ""
            : `${linePath} L ${points[points.length - 1].x} ${HEIGHT - PADDING} L ${points[0].x} ${HEIGHT - PADDING} Z`;

    return (
        <div className="relative">
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full h-[60px]"
                aria-hidden="true"
            >
                <defs>
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                </defs>

                {/* Area fill */}
                {areaPath && (
                    <motion.path
                        d={areaPath}
                        fill={`url(#${fillId})`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={prefersReduced ? { duration: 0 } : { duration: 0.5 }}
                    />
                )}

                {/* Line */}
                {linePath && (
                    <motion.path
                        d={linePath}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={prefersReduced ? undefined : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={
                            prefersReduced
                                ? { duration: 0 }
                                : { duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }
                        }
                    />
                )}

                {/* Data points */}
                {points.map((p, i) => (
                    <motion.circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="3"
                        fill="hsl(var(--background))"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        initial={prefersReduced ? undefined : { opacity: 0, r: 0 }}
                        animate={{ opacity: 1, r: 3 }}
                        transition={
                            prefersReduced
                                ? { duration: 0 }
                                : { delay: 1 + i * 0.15 }
                        }
                    />
                ))}
            </svg>

            {/* Screen reader text */}
            <span className="sr-only">
                Riwayat skor: {scores.join(", ")}
            </span>
        </div>
    );
}
