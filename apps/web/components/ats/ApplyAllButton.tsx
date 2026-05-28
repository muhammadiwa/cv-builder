"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/editorStore";
import type { DimensionKey } from "@/lib/ats-engine/types";
import { DIMENSION_WEIGHTS } from "@/lib/ats-engine/types";
import { isImprovableDimension } from "@/features/ats/useATSImprove";

const MAX_APPLY_ALL = 3;

interface ApplyAllButtonProps {
    onImproveStart: (key: DimensionKey) => void;
}

/**
 * "Apply All" button that sequentially triggers improve for the 3
 * lowest-scoring improvable dimensions. Shows progress indicator.
 */
export function ApplyAllButton({ onImproveStart }: ApplyAllButtonProps) {
    const atsScore = useEditorStore((s) => s.atsScore);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const abortedRef = useRef(false);

    // Determine if button should be visible
    const improvableDimensions = getImprovableDimensionsSorted(atsScore);
    if (improvableDimensions.length < 2) return null;

    const handleApplyAll = () => {
        abortedRef.current = false;
        setIsRunning(true);
        setProgress(0);

        const toImprove = improvableDimensions.slice(0, MAX_APPLY_ALL);
        let current = 0;

        const next = () => {
            if (abortedRef.current || current >= toImprove.length) {
                setIsRunning(false);
                if (!abortedRef.current) {
                    toast.success(`${current} perbaikan diterapkan`, {
                        description: "Tekan ⌘Z beberapa kali untuk membatalkan.",
                    });
                }
                return;
            }

            setProgress(current + 1);
            onImproveStart(toImprove[current]);
            current++;

            // Wait for user to apply each one manually via the sheet
            // The sequential flow is managed by ATSPanel's improveActive state
        };

        next();
    };

    const handleAbort = () => {
        abortedRef.current = true;
        setIsRunning(false);
        toast.info("Apply All dibatalkan");
    };

    return (
        <div className="flex items-center gap-2">
            {!isRunning ? (
                <button
                    type="button"
                    onClick={handleApplyAll}
                    className="text-xs font-medium text-primary hover:text-primary/80 hover:underline transition-colors"
                >
                    Perbaiki {Math.min(improvableDimensions.length, MAX_APPLY_ALL)} dimensi terendah
                </button>
            ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Menerapkan {progress}/{Math.min(improvableDimensions.length, MAX_APPLY_ALL)}...</span>
                    <button
                        type="button"
                        onClick={handleAbort}
                        className="text-xs text-error hover:underline"
                    >
                        Batal
                    </button>
                </div>
            )}
        </div>
    );
}

function getImprovableDimensionsSorted(
    atsScore: { dimensions: Record<DimensionKey, { score: number }> } | null,
): DimensionKey[] {
    if (!atsScore) return [];

    const keys = Object.keys(DIMENSION_WEIGHTS) as DimensionKey[];
    return keys
        .filter((k) => isImprovableDimension(k) && atsScore.dimensions[k].score < 80)
        .sort((a, b) => atsScore.dimensions[a].score - atsScore.dimensions[b].score);
}
