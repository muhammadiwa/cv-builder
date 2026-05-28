"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/editorStore";
import type { DimensionKey } from "@/lib/ats-engine/types";

const IMPROVABLE_DIMENSIONS: DimensionKey[] = [
    "keywordMatch",
    "readability",
    "metricsImpact",
    "optimization",
];

const NO_TOKEN_TIMEOUT_MS = 10_000;
const TOTAL_TIMEOUT_MS = 30_000;

export interface UseATSImproveReturn {
    suggestion: string;
    targetSectionId: string | null;
    targetField: string | null;
    originalText: string;
    isStreaming: boolean;
    error: string | null;
    start: (dimensionKey: DimensionKey) => void;
    abort: () => void;
    retry: () => void;
    apply: () => void;
}

/**
 * Manages the ATS improvement lifecycle for a single dimension.
 * Auto-selects the weakest section/field, streams AI suggestion,
 * and provides apply() to commit the change as a single undo step.
 */
export function useATSImprove(): UseATSImproveReturn {
    const [suggestion, setSuggestion] = useState("");
    const [originalText, setOriginalText] = useState("");
    const [targetSectionId, setTargetSectionId] = useState<string | null>(null);
    const [targetField, setTargetField] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);
    const lastDimensionRef = useRef<DimensionKey | null>(null);
    const targetSectionIdRef = useRef<string | null>(null);

    const lockSection = useEditorStore((s) => s.lockSection);
    const unlockSection = useEditorStore((s) => s.unlockSection);
    const updateSectionField = useEditorStore((s) => s.updateSectionField);

    const start = useCallback(
        (dimensionKey: DimensionKey) => {
            if (!IMPROVABLE_DIMENSIONS.includes(dimensionKey)) {
                toast.info("Dimensi ini tidak bisa diperbaiki via AI", {
                    description:
                        dimensionKey === "completeness"
                            ? "Tambah section yang hilang secara manual."
                            : "Perbaiki format secara manual.",
                });
                return;
            }

            // Find the target section/field
            const state = useEditorStore.getState();
            const target = findTargetForDimension(dimensionKey, state.sections);
            if (!target) {
                toast.error("Tidak ada konten untuk diperbaiki", {
                    description: "Tambahkan konten ke CV terlebih dahulu.",
                });
                return;
            }

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            lastDimensionRef.current = dimensionKey;

            setTargetSectionId(target.sectionId);
            setTargetField(target.field);
            setOriginalText(target.fieldContent);
            targetSectionIdRef.current = target.sectionId;
            setSuggestion("");
            setError(null);
            setIsStreaming(true);
            lockSection(target.sectionId);

            // Timeouts
            let lastTokenAt = Date.now();
            const noTokenTimer = setInterval(() => {
                if (Date.now() - lastTokenAt > NO_TOKEN_TIMEOUT_MS) {
                    controller.abort();
                    setError("AI tidak merespons. Coba lagi nanti.");
                    setIsStreaming(false);
                    unlockSection(target.sectionId);
                    clearInterval(noTokenTimer);
                }
            }, 2000);

            const totalTimer = setTimeout(() => {
                controller.abort();
                setError("Waktu habis. Coba lagi.");
                setIsStreaming(false);
                unlockSection(target.sectionId);
            }, TOTAL_TIMEOUT_MS);

            const API_BASE =
                process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

            fetch(`${API_BASE}/ai/ats-improve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dimensionKey,
                    sectionId: target.sectionId,
                    sectionType: target.sectionType,
                    content: target.content,
                    field: target.field,
                }),
                signal: controller.signal,
                credentials: "include",
            })
                .then(async (res) => {
                    if (!res.ok) {
                        const errBody = await res.json().catch(() => ({}));
                        throw new Error(
                            (errBody as { message?: string }).message ?? "AI error",
                        );
                    }

                    const reader = res.body?.getReader();
                    if (!reader) throw new Error("No response body");

                    const decoder = new TextDecoder();
                    let accumulated = "";
                    let lineBuf = "";

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (controller.signal.aborted) break;

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = (lineBuf + chunk).split("\n");
                        lineBuf = lines.pop() ?? "";

                        for (const line of lines) {
                            if (line.startsWith("0:")) {
                                try {
                                    const token = JSON.parse(line.slice(2)) as string;
                                    accumulated += token;
                                    setSuggestion(accumulated);
                                    lastTokenAt = Date.now();
                                } catch {
                                    // skip non-JSON
                                }
                            }
                        }
                    }

                    if (lineBuf.startsWith("0:")) {
                        try {
                            const token = JSON.parse(lineBuf.slice(2)) as string;
                            accumulated += token;
                            setSuggestion(accumulated);
                        } catch { }
                    }

                    setIsStreaming(false);
                    unlockSection(target.sectionId);
                })
                .catch((err) => {
                    if (controller.signal.aborted) return;
                    const message = (err as Error).message ?? "Gagal menghubungi AI";
                    setError(message);
                    setIsStreaming(false);
                    unlockSection(target.sectionId);
                    toast.error("ATS Improve gagal", { description: message });
                })
                .finally(() => {
                    clearInterval(noTokenTimer);
                    clearTimeout(totalTimer);
                });
        },
        [lockSection, unlockSection],
    );

    const abort = useCallback(() => {
        abortRef.current?.abort();
        const sid = targetSectionIdRef.current;
        if (sid) unlockSection(sid);
        setIsStreaming(false);
    }, [unlockSection]);

    const retry = useCallback(() => {
        if (lastDimensionRef.current) {
            start(lastDimensionRef.current);
        }
    }, [start]);

    const apply = useCallback(() => {
        if (!targetSectionId || !targetField || !suggestion) return;
        updateSectionField(targetSectionId, targetField, suggestion);
        toast.success("Perbaikan diterapkan", {
            description: "Tekan ⌘Z untuk membatalkan.",
        });
    }, [targetSectionId, targetField, suggestion, updateSectionField]);

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    return {
        suggestion,
        targetSectionId,
        targetField,
        originalText,
        isStreaming,
        error,
        start,
        abort,
        retry,
        apply,
    };
}

// --- Helpers ---

interface TargetInfo {
    sectionId: string;
    sectionType: string;
    field: string;
    fieldContent: string;
    content: Record<string, unknown>;
}

/**
 * Find the best section/field to improve for a given dimension.
 * Strategy: pick the first section with text content that matches
 * the dimension's target section type.
 */
function findTargetForDimension(
    dimensionKey: DimensionKey,
    sections: Array<{
        id: string;
        sectionType: string;
        content: Record<string, unknown>;
        visible: boolean;
    }>,
): TargetInfo | null {
    // Map dimension to preferred section types
    const preferredTypes: Record<string, string[]> = {
        keywordMatch: ["skills", "experience", "summary"],
        readability: ["summary", "experience"],
        metricsImpact: ["experience", "projects"],
        optimization: ["experience", "projects"],
    };

    const types = preferredTypes[dimensionKey] ?? ["experience"];

    for (const type of types) {
        const section = sections.find(
            (s) => s.sectionType === type && s.visible,
        );
        if (!section) continue;

        // Find the first string field with content
        for (const [key, value] of Object.entries(section.content)) {
            if (key.startsWith("__")) continue;
            if (typeof value === "string" && value.trim().length > 10) {
                return {
                    sectionId: section.id,
                    sectionType: section.sectionType,
                    field: key,
                    fieldContent: value,
                    content: section.content,
                };
            }
        }
    }

    return null;
}

export function isImprovableDimension(key: DimensionKey): boolean {
    return IMPROVABLE_DIMENSIONS.includes(key);
}
