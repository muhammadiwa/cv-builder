"use client";

import { Command } from "cmdk";
import { Target, Palette, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";

const COMMANDS = [
    { id: "ats", label: "Analisis ATS", icon: Target },
    { id: "template", label: "Ganti Template", icon: Palette },
    { id: "export", label: "Export PDF", icon: Download },
    { id: "kak", label: "Tanya Kak", icon: Sparkles },
] as const;

interface GlobalCommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Global command palette (⌘K). Centered modal overlay with search.
 * All actions are stubs for now — they show a "Coming soon" toast.
 */
export function GlobalCommandPalette({ open, onOpenChange }: GlobalCommandPaletteProps) {
    if (!open) return null;

    const handleSelect = (id: string) => {
        toast.info("Coming soon", {
            description: "Fitur ini akan hadir di update berikutnya.",
            duration: 3000,
        });
        onOpenChange(false);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
            onClick={() => onOpenChange(false)}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Palette */}
            <div
                className="relative w-full max-w-lg mx-4 animate-in fade-in-0 zoom-in-95"
                onClick={(e) => e.stopPropagation()}
            >
                <Command
                    className="rounded-xl border shadow-2xl bg-popover overflow-hidden"
                    shouldFilter={true}
                >
                    <Command.Input
                        placeholder="Ketik perintah…"
                        className="w-full px-4 py-3 text-sm border-b outline-none bg-transparent placeholder:text-muted-foreground"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === "Escape") onOpenChange(false);
                        }}
                    />
                    <Command.List className="max-h-64 overflow-y-auto p-1">
                        <Command.Empty className="px-4 py-3 text-sm text-muted-foreground">
                            Tidak ditemukan
                        </Command.Empty>
                        {COMMANDS.map(({ id, label, icon: Icon }) => (
                            <Command.Item
                                key={id}
                                value={label}
                                onSelect={() => handleSelect(id)}
                                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-muted"
                            >
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                {label}
                            </Command.Item>
                        ))}
                    </Command.List>
                    <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                        <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⌘K</kbd> untuk membuka
                    </div>
                </Command>
            </div>
        </div>
    );
}
