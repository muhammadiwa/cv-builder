"use client";

import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { getScoreColor, getScoreLabel } from "./ats-colors";

interface CategoryCardProps {
    name: string;
    score: number;
    details: string[];
    staggerDelay: number;
    onImprove?: () => void;
    onCardClick?: () => void;
}

/**
 * Single ATS dimension card with animated progress bar and hover-reveal
 * "Improve" button. Clicking the card scrolls to the relevant editor section.
 */
export function CategoryCard({
    name,
    score,
    details,
    staggerDelay,
    onImprove,
    onCardClick,
}: CategoryCardProps) {
    const prefersReduced = useReducedMotion();
    const color = getScoreColor(score);
    const label = getScoreLabel(score);

    const handleImprove = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onImprove) {
            onImprove();
        } else {
            toast("Coming soon", {
                description: "Fitur saran perbaikan akan hadir di update berikutnya.",
            });
        }
    };

    return (
        <button
            type="button"
            onClick={onCardClick}
            className="group w-full text-left rounded-lg border border-border p-3 transition-colors hover:border-primary/30 focus-visible:outline-2 focus-visible:outline-ring"
            aria-label={`${name}: ${score} persen. ${onCardClick ? "Ketuk untuk detail." : ""}`}
        >
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[13px] font-medium text-foreground">{name}</span>
                <span
                    className="text-[13px] font-semibold font-mono"
                    style={{ color }}
                >
                    {score}%
                </span>
            </div>

            {/* Progress bar */}
            <div
                className="h-2 rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Skor ${name}: ${score} persen`}
            >
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={
                        prefersReduced
                            ? { duration: 0 }
                            : { duration: 0.8, delay: staggerDelay, ease: [0.16, 1, 0.3, 1] }
                    }
                />
            </div>

            {/* Label + Improve button */}
            <div className="flex justify-between items-center mt-1.5">
                <span className="text-[11px] text-muted-foreground">{label}</span>
                <span
                    role="button"
                    tabIndex={0}
                    onClick={handleImprove}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleImprove(e as unknown as React.MouseEvent);
                        }
                    }}
                    className="text-[11px] font-medium text-primary hover:text-primary/80 hover:underline transition-opacity opacity-0 group-hover:opacity-100 focus-visible:opacity-100 md:opacity-0 max-md:opacity-100"
                    aria-label={`Tingkatkan ${name}`}
                >
                    Improve
                </span>
            </div>

            {/* First detail hint */}
            {details.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                    {details[0]}
                </p>
            )}
        </button>
    );
}
