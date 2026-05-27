"use client";

import { Sparkles } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useBreakpoint } from "@/hooks/useBreakpoint";

export type AIInstruction =
    | "perbaiki_wording"
    | "ats_friendly"
    | "singkat"
    | "tambah_metrik";

const MENU_ITEMS: { value: AIInstruction; label: string }[] = [
    { value: "perbaiki_wording", label: "Perbaiki wording" },
    { value: "ats_friendly", label: "Buat lebih ATS-friendly" },
    { value: "singkat", label: "Singkat jadi 1 baris" },
    { value: "tambah_metrik", label: "Tambah metrik" },
];

interface AIWandButtonProps {
    onSelect: (instruction: AIInstruction) => void;
    disabled?: boolean;
}

/**
 * AI wand button with dropdown menu for selecting rewrite instructions.
 * Renders as a Radix DropdownMenu on desktop, same on mobile (BottomSheet
 * integration deferred — Radix dropdown works well enough on touch).
 */
export function AIWandButton({ onSelect, disabled }: AIWandButtonProps) {
    const bp = useBreakpoint();

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="AI rewrite"
                    title="AI rewrite"
                >
                    <Sparkles className="h-4 w-4" />
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    className="z-50 min-w-[200px] rounded-lg border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
                    sideOffset={4}
                    align={bp === "mobile" ? "center" : "start"}
                >
                    {MENU_ITEMS.map(({ value, label }) => (
                        <DropdownMenu.Item
                            key={value}
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer outline-none hover:bg-muted focus:bg-muted transition-colors"
                            onSelect={() => onSelect(value)}
                        >
                            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                            {label}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
