"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useEditorStore } from "@/stores/editorStore";
import { ScoreRing } from "./ScoreRing";
import { ScoreContextText } from "./ScoreContextText";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { ScoreHistorySparkline } from "./ScoreHistorySparkline";
import { ATSImproveSheet } from "./ATSImproveSheet";
import { ApplyAllButton } from "./ApplyAllButton";
import { useATSImprove, isImprovableDimension } from "@/features/ats/useATSImprove";
import type { DimensionKey } from "@/lib/ats-engine/types";

interface HistoryEntry {
    total: number;
    computedAt: number;
}

const MAX_HISTORY = 5;
const MIN_SCORE_DIFF = 2;

/**
 * Main ATS panel replacing ATSPanelPlaceholder in the right panel.
 * Reads score from editorStore, manages score history in sessionStorage.
 */
export function ATSPanel() {
    const atsScore = useEditorStore((s) => s.atsScore);
    const atsComputing = useEditorStore((s) => s.atsComputing);
    const params = useParams<{ id: string }>();
    const resumeId = params?.id ?? "unknown";

    const isFirstRenderRef = useRef(true);
    const lastAppendedScoreRef = useRef<number | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>(() =>
        loadHistory(resumeId),
    );
    const [improveActive, setImproveActive] = useState(false);

    const improve = useATSImprove();

    const handleImprove = (dimensionKey: DimensionKey) => {
        improve.start(dimensionKey);
        if (isImprovableDimension(dimensionKey)) {
            setImproveActive(true);
        }
    };

    const handleApply = () => {
        improve.apply();
        setImproveActive(false);
    };

    const handleCancel = () => {
        improve.abort();
        setImproveActive(false);
    };

    // Track score changes → append to history
    useEffect(() => {
        if (!atsScore) return;

        const lastScore = lastAppendedScoreRef.current;
        if (lastScore !== null && Math.abs(atsScore.total - lastScore) < MIN_SCORE_DIFF) return;

        lastAppendedScoreRef.current = atsScore.total;
        const entry: HistoryEntry = {
            total: atsScore.total,
            computedAt: atsScore.computedAt,
        };
        setHistory((prev) => {
            const next = [...prev, entry].slice(-MAX_HISTORY);
            saveHistory(resumeId, next);
            return next;
        });
    }, [atsScore?.total, atsScore?.computedAt, resumeId]);

    // After first score renders, mark subsequent renders as updates (faster animation)
    useEffect(() => {
        if (atsScore && isFirstRenderRef.current) {
            const t = setTimeout(() => {
                isFirstRenderRef.current = false;
            }, 1600);
            return () => clearTimeout(t);
        }
    }, [atsScore]);

    // Loading state: computing with no score yet
    if (atsComputing && !atsScore) {
        return <LoadingSkeleton />;
    }

    // Empty state: no sections yet
    if (!atsScore) {
        return <EmptyState />;
    }

    return (
        <div className="h-full overflow-y-auto p-4 space-y-6">
            <div className="flex justify-center pt-2">
                <ScoreRing
                    value={atsScore.total}
                    animated
                    isFirstRender={isFirstRenderRef.current}
                />
            </div>

            <ScoreContextText score={atsScore.total} />

            <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Rincian Skor
                </h3>
                <CategoryBreakdown onImprove={handleImprove} />
                <div className="mt-3">
                    <ApplyAllButton onImproveStart={handleImprove} />
                </div>
            </div>

            {history.length >= 2 && (
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Riwayat Skor
                    </h3>
                    <ScoreHistorySparkline history={history} />
                </div>
            )}

            {improveActive && (
                <ATSImproveSheet
                    originalText={improve.originalText}
                    suggestion={improve.suggestion}
                    isStreaming={improve.isStreaming}
                    onApply={handleApply}
                    onRetry={improve.retry}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
}

function LoadingSkeleton() {
    return (
        <div className="h-full p-4 space-y-6">
            <div className="flex justify-center pt-2">
                <div className="w-[120px] h-[120px] rounded-full bg-muted animate-pulse" />
            </div>
            <div className="space-y-2">
                <div className="h-4 w-32 mx-auto bg-muted animate-pulse rounded" />
                <div className="h-3 w-48 mx-auto bg-muted animate-pulse rounded" />
            </div>
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-lg" />
                ))}
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center px-6 py-8 gap-4">
            <div className="rounded-full bg-muted p-4 text-muted-foreground">
                <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                </svg>
            </div>
            <h3 className="text-base font-semibold">Skor ATS</h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                Mulai isi CV Anda untuk melihat skor ATS. Skor akan dihitung otomatis
                begitu ada konten di bagian-bagian CV.
            </p>
        </div>
    );
}

function storageKey(resumeId: string): string {
    return `ats-score-history-${resumeId}`;
}

function loadHistory(resumeId: string): HistoryEntry[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = sessionStorage.getItem(storageKey(resumeId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.slice(-MAX_HISTORY);
    } catch {
        return [];
    }
}

function saveHistory(resumeId: string, history: HistoryEntry[]): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(storageKey(resumeId), JSON.stringify(history));
    } catch {
        // sessionStorage full or unavailable — silently ignore
    }
}
