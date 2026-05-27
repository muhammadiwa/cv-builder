"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useEditorStore } from "@/stores/editorStore";

export interface UseAIRewriteParams {
    sectionId: string;
    field: string;
    instruction: string;
    selectedText?: string;
}

export interface UseAIRewriteReturn {
    result: string;
    isStreaming: boolean;
    error: string | null;
    start: (params: UseAIRewriteParams) => void;
    abort: () => void;
    retry: () => void;
}

const NO_TOKEN_TIMEOUT_MS = 10_000;
const TOTAL_TIMEOUT_MS = 30_000;

/**
 * Manages the AI rewrite streaming lifecycle. Calls the backend SSE endpoint,
 * accumulates tokens, handles timeouts and errors.
 *
 * The hook does NOT apply the result — that's the caller's responsibility
 * (via `applyAIResult` in the diff view). This keeps the hook reusable for
 * both "Terapkan" and "Coba Lagi" flows.
 */
export function useAIRewrite(): UseAIRewriteReturn {
    const [result, setResult] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastParamsRef = useRef<UseAIRewriteParams | null>(null);
    const lockSection = useEditorStore((s) => s.lockSection);
    const unlockSection = useEditorStore((s) => s.unlockSection);

    const start = useCallback(
        (params: UseAIRewriteParams) => {
            // Abort any in-flight stream
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            lastParamsRef.current = params;

            setResult("");
            setError(null);
            setIsStreaming(true);
            lockSection(params.sectionId);

            const state = useEditorStore.getState();
            const section = state.sections.find((s) => s.id === params.sectionId);
            if (!section) {
                setError("Section not found");
                setIsStreaming(false);
                unlockSection(params.sectionId);
                return;
            }

            const body = JSON.stringify({
                sectionId: params.sectionId,
                sectionType: section.sectionType,
                content: section.content,
                field: params.field,
                instruction: params.instruction,
                selectedText: params.selectedText,
            });

            // Timeouts
            let lastTokenAt = Date.now();
            const noTokenTimer = setInterval(() => {
                if (Date.now() - lastTokenAt > NO_TOKEN_TIMEOUT_MS) {
                    controller.abort();
                    setError("AI tidak merespons. Coba lagi nanti.");
                    setIsStreaming(false);
                    unlockSection(params.sectionId);
                    clearInterval(noTokenTimer);
                }
            }, 2000);

            const totalTimer = setTimeout(() => {
                controller.abort();
                setError("Waktu habis. Coba lagi.");
                setIsStreaming(false);
                unlockSection(params.sectionId);
            }, TOTAL_TIMEOUT_MS);

            // Fetch SSE
            const API_BASE =
                process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
            fetch(`${API_BASE}/ai/rewrite`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
                signal: controller.signal,
                credentials: "include",
            })
                .then(async (res) => {
                    if (!res.ok) {
                        const errBody = await res.json().catch(() => ({}));
                        if (res.status === 429) {
                            throw new ApiError(
                                429,
                                "Batas AI harian tercapai. Coba lagi besok.",
                                errBody,
                            );
                        }
                        throw new ApiError(
                            res.status,
                            (errBody as { message?: string }).message ?? "AI error",
                            errBody,
                        );
                    }

                    const reader = res.body?.getReader();
                    if (!reader) throw new Error("No response body");

                    const decoder = new TextDecoder();
                    let accumulated = "";
                    let lineBuf = ""; // Buffer for incomplete lines across chunks

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        if (controller.signal.aborted) break;

                        const chunk = decoder.decode(value, { stream: true });
                        // Parse Vercel AI SDK data stream format: lines starting with "0:"
                        // contain the text tokens as JSON strings. A chunk boundary can
                        // split a line, so we buffer incomplete lines between reads.
                        const lines = (lineBuf + chunk).split("\n");
                        // The last element may be incomplete (no trailing \n) — keep it
                        // in the buffer for the next chunk.
                        lineBuf = lines.pop() ?? "";

                        for (const line of lines) {
                            if (line.startsWith("0:")) {
                                try {
                                    const token = JSON.parse(line.slice(2)) as string;
                                    accumulated += token;
                                    setResult(accumulated);
                                    lastTokenAt = Date.now();
                                } catch {
                                    // Non-JSON line — skip (could be metadata)
                                }
                            }
                        }
                    }

                    // Process any remaining buffered content after stream ends
                    if (lineBuf.startsWith("0:")) {
                        try {
                            const token = JSON.parse(lineBuf.slice(2)) as string;
                            accumulated += token;
                            setResult(accumulated);
                        } catch {
                            // Incomplete final token — best-effort
                        }
                    }

                    setIsStreaming(false);
                    unlockSection(params.sectionId);
                })
                .catch((err) => {
                    if (controller.signal.aborted) return;
                    const message =
                        err instanceof ApiError
                            ? err.message
                            : (err as Error).message ?? "Gagal menghubungi AI";
                    setError(message);
                    setIsStreaming(false);
                    unlockSection(params.sectionId);
                    if (err instanceof ApiError && err.status === 429) {
                        toast.error("Batas AI harian tercapai", {
                            description: "Coba lagi besok.",
                        });
                    } else {
                        toast.error("AI Rewrite gagal", { description: message });
                    }
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
        if (lastParamsRef.current) {
            unlockSection(lastParamsRef.current.sectionId);
        }
        setIsStreaming(false);
    }, [unlockSection]);

    const retry = useCallback(() => {
        if (lastParamsRef.current) {
            start(lastParamsRef.current);
        }
    }, [start]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    return { result, isStreaming, error, start, abort, retry };
}
