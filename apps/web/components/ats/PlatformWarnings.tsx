"use client";

import type { PlatformValidationResult } from "@/lib/ats-engine/platform-types";

interface PlatformWarningsProps {
    result: PlatformValidationResult | null;
}

const SEVERITY_ICONS: Record<string, string> = {
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
};

export function PlatformWarnings({ result }: PlatformWarningsProps) {
    if (!result) return null;

    if (result.warnings.length === 0 || result.passed && result.warnings.every(w => w.severity === "info")) {
        return (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                ✅ CV Anda sesuai dengan aturan {result.platformName}.
            </p>
        );
    }

    return (
        <ul className="space-y-1.5">
            {result.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <span className="shrink-0" aria-hidden="true">
                        {SEVERITY_ICONS[w.severity] ?? "•"}
                    </span>
                    <span>{w.message}</span>
                </li>
            ))}
        </ul>
    );
}
