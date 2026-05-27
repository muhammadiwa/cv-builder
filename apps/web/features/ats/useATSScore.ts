"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { computeATSScore } from "@/lib/ats-engine/scorer";
import type { ScoringInput, ScoringSection } from "@/lib/ats-engine/types";
import type { EditorSection } from "@/stores/editorStore";
import { FIELD_TS_KEY } from "@/lib/sync/fieldTimestamps";

const DEBOUNCE_MS = 500;

/**
 * Manages the ATS scoring lifecycle:
 * - Subscribes to editorStore.sections
 * - Debounces 500ms idle
 * - Posts to Web Worker (or falls back to main thread)
 * - Stores result in editorStore.atsScore
 *
 * Uses a generation counter to discard stale results when edits arrive
 * faster than scoring completes.
 */
export function useATSScore(): void {
    const sections = useEditorStore((s) => s.sections);
    const setATSScore = useEditorStore((s) => s.setATSScore);
    const setATSComputing = useEditorStore((s) => s.setATSComputing);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const generationRef = useRef(0);
    const workerRef = useRef<Worker | null>(null);
    const comlinkApiRef = useRef<any>(null);

    // Initialize worker once
    useEffect(() => {
        if (typeof window === "undefined") return;

        // Worker fallback: if Worker is unavailable (SSR, very old browser),
        // we'll use main-thread scoring in the debounce callback.
        if (typeof Worker !== "undefined") {
            try {
                const worker = new Worker(
                    new URL("../../lib/ats-engine/worker.ts", import.meta.url),
                    { type: "module" },
                );
                workerRef.current = worker;

                // Dynamically import comlink to avoid SSR issues
                import("comlink").then((Comlink) => {
                    comlinkApiRef.current = Comlink.wrap(worker);
                });
            } catch (err) {
                // Worker instantiation failed — fall back to main thread
                console.warn("[ATS] Worker init failed, using main thread:", err);
            }
        }

        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
            comlinkApiRef.current = null;
        };
    }, []);

    // Debounced scoring on sections change
    useEffect(() => {
        // Guard: empty sections → null score immediately
        if (!sections || sections.length === 0) {
            setATSScore(null);
            setATSComputing(false);
            return;
        }

        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
            const generation = ++generationRef.current;
            setATSComputing(true);

            const input = prepareScoringInput(sections);

            // Use Worker if available, otherwise main thread
            if (comlinkApiRef.current) {
                comlinkApiRef.current
                    .computeScore(input)
                    .then((score: any) => {
                        // Discard stale result if a newer generation started
                        if (generationRef.current !== generation) return;
                        setATSScore(score);
                        setATSComputing(false);
                    })
                    .catch((err: any) => {
                        console.error("[ATS] Worker scoring failed:", err);
                        // Fallback to main thread on worker error
                        if (generationRef.current !== generation) return;
                        try {
                            const score = computeATSScore(input);
                            setATSScore(score);
                        } catch {
                            setATSScore(null);
                        }
                        setATSComputing(false);
                    });
            } else {
                // Main-thread fallback (no Worker available)
                try {
                    const score = computeATSScore(input);
                    if (generationRef.current === generation) {
                        setATSScore(score);
                    }
                } catch (err) {
                    console.error("[ATS] Main-thread scoring failed:", err);
                    if (generationRef.current === generation) {
                        setATSScore(null);
                    }
                }
                if (generationRef.current === generation) {
                    setATSComputing(false);
                }
            }
        }, DEBOUNCE_MS);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [sections, setATSScore, setATSComputing]);
}

/**
 * Strip non-scoring fields from sections before posting to worker.
 * Removes: id, displayOrder, aiGenerated, __field_updated_at
 */
function prepareScoringInput(sections: EditorSection[]): ScoringInput {
    return {
        sections: sections.map((s): ScoringSection => {
            // Strip __field_updated_at from content
            const cleanContent: Record<string, unknown> = {};
            if (s.content && typeof s.content === "object") {
                for (const [key, value] of Object.entries(s.content)) {
                    if (key === FIELD_TS_KEY || key.startsWith("__")) continue;
                    cleanContent[key] = value;
                }
            }
            return {
                sectionType: s.sectionType,
                content: cleanContent,
                visible: s.visible,
            };
        }),
    };
}
