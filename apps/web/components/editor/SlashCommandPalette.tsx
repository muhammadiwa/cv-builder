"use client";

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { useEditorStore } from "@/stores/editorStore";
import type { SectionType } from "@/types/resume";

const SLASH_ITEMS: { value: SectionType; label: string }[] = [
    { value: "experience", label: "Pengalaman" },
    { value: "education", label: "Pendidikan" },
    { value: "skills", label: "Keahlian" },
    { value: "certifications", label: "Sertifikasi" },
    { value: "projects", label: "Proyek" },
    { value: "languages", label: "Bahasa" },
];

/**
 * Inline slash command palette. Opens when user types `/` inside the editor
 * area. Allows quick section addition without leaving the keyboard.
 */
export function SlashCommandPalette() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const addSection = useEditorStore((s) => s.addSection);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== "/") return;
            const target = e.target as HTMLElement;
            // Only trigger inside the editor area, not in inputs/textareas
            if (
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.isContentEditable
            ) {
                return;
            }
            const inEditor = target.closest("[data-section-block]") ||
                target.closest("[data-editor-shell]");
            if (!inEditor) return;

            e.preventDefault();
            setOpen(true);
            setSearch("");
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    if (!open) return null;

    const handleSelect = (type: SectionType) => {
        addSection(type);
        setOpen(false);
    };

    return (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
            <div
                className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72"
                onClick={(e) => e.stopPropagation()}
            >
                <Command
                    className="rounded-lg border shadow-lg bg-popover overflow-hidden"
                    shouldFilter={true}
                >
                    <Command.Input
                        ref={inputRef}
                        value={search}
                        onValueChange={setSearch}
                        placeholder="Tambah bagian…"
                        className="w-full px-3 py-2.5 text-sm border-b outline-none bg-transparent placeholder:text-muted-foreground"
                        onKeyDown={(e) => {
                            if (e.key === "Escape") setOpen(false);
                        }}
                    />
                    <Command.List className="max-h-48 overflow-y-auto p-1">
                        <Command.Empty className="px-3 py-2 text-sm text-muted-foreground">
                            Tidak ditemukan
                        </Command.Empty>
                        {SLASH_ITEMS.map(({ value, label }) => (
                            <Command.Item
                                key={value}
                                value={label}
                                onSelect={() => handleSelect(value)}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer aria-selected:bg-muted"
                            >
                                <span className="text-muted-foreground font-mono text-xs">/</span>
                                {label}
                            </Command.Item>
                        ))}
                    </Command.List>
                </Command>
            </div>
        </div>
    );
}
