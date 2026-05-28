"use client";

import { AIDiffView } from "@/components/editor/AIDiffView";

interface ATSImproveSheetProps {
    originalText: string;
    suggestion: string;
    isStreaming: boolean;
    onApply: () => void;
    onRetry: () => void;
    onCancel: () => void;
}

/**
 * Shows the AI improvement suggestion as a diff view.
 * Reuses AIDiffView from Story 2.5.
 */
export function ATSImproveSheet({
    originalText,
    suggestion,
    isStreaming,
    onApply,
    onRetry,
    onCancel,
}: ATSImproveSheetProps) {
    return (
        <div className="p-4 border-t border-border bg-background">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Saran Perbaikan AI
            </h4>
            <AIDiffView
                originalText={originalText}
                aiText={suggestion}
                isStreaming={isStreaming}
                onApply={onApply}
                onRetry={onRetry}
                onCancel={onCancel}
            />
        </div>
    );
}
