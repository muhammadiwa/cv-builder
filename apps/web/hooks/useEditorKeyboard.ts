"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/editorStore";

/**
 * Centralized keyboard shortcut handler for the resume editor.
 *
 * Shortcuts:
 *   - ⌘Z / Ctrl+Z → undo (via zundo temporal store)
 *   - ⌘⇧Z / Ctrl+Shift+Z → redo
 *   - ⌘S / Ctrl+S → intercept browser save, show toast
 *   - ⌘K / Ctrl+K → open global command palette
 *   - Tab → focus next section (when inside editor)
 *   - Shift+Tab → focus previous section
 */
export function useEditorKeyboard(opts: {
    onOpenCommandPalette: () => void;
}) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;

            // ⌘Z — undo
            if (mod && e.key === "z" && !e.shiftKey) {
                e.preventDefault();
                useEditorStore.temporal.getState().undo();
                return;
            }

            // ⌘⇧Z — redo
            if (mod && e.key === "z" && e.shiftKey) {
                e.preventDefault();
                useEditorStore.temporal.getState().redo();
                return;
            }

            // ⌘S — intercept save
            if (mod && e.key === "s") {
                e.preventDefault();
                toast.success("CV tersimpan otomatis ✓", {
                    duration: 2000,
                });
                return;
            }

            // ⌘K — global command palette
            if (mod && e.key === "k") {
                e.preventDefault();
                opts.onOpenCommandPalette();
                return;
            }

            // Tab / Shift+Tab — section navigation
            if (e.key === "Tab" && !mod) {
                const target = e.target as HTMLElement;
                const inEditor = target.closest("[data-section-block]");
                if (!inEditor) return;

                e.preventDefault();
                const sections = Array.from(
                    document.querySelectorAll<HTMLElement>(
                        "[data-section-block] [role='button']",
                    ),
                );
                if (sections.length === 0) return;

                const currentIdx = sections.indexOf(target);
                let nextIdx: number;
                if (e.shiftKey) {
                    nextIdx = currentIdx <= 0 ? sections.length - 1 : currentIdx - 1;
                } else {
                    nextIdx = currentIdx >= sections.length - 1 ? 0 : currentIdx + 1;
                }
                sections[nextIdx]?.focus();
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [opts]);
}
