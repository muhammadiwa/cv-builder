"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

const PLATFORMS = [
    { id: "general", name: "Umum (General)" },
    { id: "talenta", name: "Talenta (Mekari)" },
    { id: "linovhr", name: "LinovHR" },
    { id: "greatday", name: "GreatDay HR" },
] as const;

interface PlatformSelectorProps {
    onChange: (platformId: string) => void;
}

export function PlatformSelector({ onChange }: PlatformSelectorProps) {
    const params = useParams<{ id: string }>();
    const resumeId = params?.id ?? "unknown";
    const [selected, setSelected] = useState<string>(() => loadPlatform(resumeId));

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setSelected(value);
        savePlatform(resumeId, value);
        onChange(value);
    };

    return (
        <div className="flex items-center gap-2">
            <label
                htmlFor="platform-select"
                className="text-[11px] text-muted-foreground whitespace-nowrap"
            >
                Target ATS:
            </label>
            <select
                id="platform-select"
                value={selected}
                onChange={handleChange}
                className="text-xs bg-transparent border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
                {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.name}
                    </option>
                ))}
            </select>
        </div>
    );
}

function loadPlatform(resumeId: string): string {
    if (typeof window === "undefined") return "general";
    try {
        return sessionStorage.getItem(`ats-platform-${resumeId}`) ?? "general";
    } catch {
        return "general";
    }
}

function savePlatform(resumeId: string, platformId: string): void {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(`ats-platform-${resumeId}`, platformId);
    } catch { }
}
