"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { AIWandButton, type AIInstruction } from "./AIWandButton";

interface SelectionState {
    text: string;
    sectionId: string;
    field: string;
    rect: DOMRect;
}

interface AISelectionWandProps {
    onSelect: (instruction: AIInstruction, sectionId: string, field: string, selectedText: string) => void;
}

/**
 * Floating AI wand that appears when the user selects text inside a section's
 * content area (desktop only, per spec). Positioned near the selection via
 * getBoundingClientRect.
 *
 * AC-6: "highlighting text within a section also shows the AI wand with
 * context-specific options"
 */
export function AISelectionWand({ onSelect }: AISelectionWandProps) {
    const bp = useBreakpoint();
    const [selection, setSelection] = useState<SelectionState | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Desktop only
        if (bp !== "desktop") return;

        const onSelectionChange = () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.toString().trim()) {
                setSelection(null);
                return;
            }

            // Check if the selection is inside a section block
            const range = sel.getRangeAt(0);
            const container = range.commonAncestorContainer as HTMLElement;
            const sectionEl =
                container.closest?.("[data-section-id]") ??
                (container.parentElement?.closest?.("[data-section-id]") ?? null);

            if (!sectionEl) {
                setSelection(null);
                return;
            }

            const sectionId = (sectionEl as HTMLElement).dataset.sectionId;
            if (!sectionId) {
                setSelection(null);
                return;
            }

            // Determine which field the selection is in (best-effort: look for
            // data-field attribute on parent, or default to the section's primary field)
            const fieldEl = (container as HTMLElement).closest?.("[data-field]");
            const field = (fieldEl as HTMLElement)?.dataset?.field ?? "description";

            const rect = range.getBoundingClientRect();
            setSelection({ text: sel.toString(), sectionId, field, rect });
        };

        document.addEventListener("selectionchange", onSelectionChange);
        return () => document.removeEventListener("selectionchange", onSelectionChange);
    }, [bp]);

    // Hide on scroll (position would be stale)
    useEffect(() => {
        if (!selection) return;
        const onScroll = () => setSelection(null);
        window.addEventListener("scroll", onScroll, { capture: true });
        return () => window.removeEventListener("scroll", onScroll, { capture: true });
    }, [selection]);

    if (!selection || bp !== "desktop") return null;

    const top = selection.rect.top - 40;
    const left = selection.rect.left + selection.rect.width / 2 - 16;

    return (
        <div
            ref={wrapperRef}
            className="fixed z-50 animate-in fade-in-0 zoom-in-95"
            style={{ top: `${top}px`, left: `${left}px` }}
        >
            <div className="bg-background border rounded-lg shadow-lg p-0.5">
                <AIWandButton
                    onSelect={(instruction) =>
                        onSelect(instruction, selection.sectionId, selection.field, selection.text)
                    }
                />
            </div>
        </div>
    );
}
