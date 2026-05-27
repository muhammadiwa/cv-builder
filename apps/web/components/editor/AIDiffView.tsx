"use client";

interface AIDiffViewProps {
    originalText: string;
    aiText: string;
    isStreaming: boolean;
    onApply: () => void;
    onRetry: () => void;
    onCancel: () => void;
}

/**
 * Inline diff overlay showing original text (struck through) vs AI suggestion
 * (green border). Renders within the section's editing area while active.
 */
export function AIDiffView({
    originalText,
    aiText,
    isStreaming,
    onApply,
    onRetry,
    onCancel,
}: AIDiffViewProps) {
    return (
        <div className="space-y-3 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20">
            {/* Original text */}
            <div className="text-sm">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                    Asli
                </span>
                <p className="line-through text-muted-foreground whitespace-pre-wrap">
                    {originalText}
                </p>
            </div>

            {/* AI suggestion */}
            <div className="text-sm">
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1 block">
                    Saran AI
                </span>
                <p className="border-l-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 pl-3 py-1 whitespace-pre-wrap">
                    {aiText || (isStreaming ? "" : "—")}
                    {isStreaming && (
                        <span className="inline-block w-0.5 h-4 bg-indigo-500 animate-pulse ml-0.5 align-text-bottom" />
                    )}
                </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
                <button
                    type="button"
                    onClick={onApply}
                    disabled={isStreaming || !aiText}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Terapkan
                </button>
                <button
                    type="button"
                    onClick={onRetry}
                    disabled={isStreaming}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Coba Lagi
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    Batal
                </button>
            </div>
        </div>
    );
}
