"use client";

import { useState } from "react";
import { LayoutList, Sparkles, Target, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useEditorStore } from "@/stores/editorStore";
import { useEditorLayoutStore } from "@/stores/editorLayoutStore";
import { prefersReducedMotion } from "@/hooks/useReducedMotion";
import {
  AIPanelPlaceholder,
  ATSPanelPlaceholder,
  SettingsPanelPlaceholder,
} from "./RightPanelPlaceholders";

/**
 * MobileTabBar
 *
 * Fixed bottom navigation. Each tab opens a `BottomSheet` with the matching
 * content. The "Bagian" tab lists the resume's sections so users can jump
 * around without visible drag handles (we removed the mobile drag handle in
 * Story 2.2 cleanup — Move Up/Down arrows live on each section).
 *
 * Touch targets are 44px minimum (Apple HIG) so the bar feels tappable on
 * mid-range Android, which is our baseline.
 */
type MobileTab = "sections" | "ai" | "ats" | "settings";

const TABS: { value: MobileTab; label: string; Icon: LucideIcon }[] = [
  { value: "sections", label: "Bagian", Icon: LayoutList },
  { value: "ai", label: "AI", Icon: Sparkles },
  { value: "ats", label: "ATS", Icon: Target },
  { value: "settings", label: "Pengaturan", Icon: Settings },
];

export function MobileTabBar() {
  const [openTab, setOpenTab] = useState<MobileTab | null>(null);

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-30 grid grid-cols-4 border-t bg-background"
        aria-label="Bottom navigation"
      >
        {TABS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setOpenTab(value)}
            className="flex flex-col items-center justify-center gap-0.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[56px]"
            aria-label={label}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <BottomSheet
        open={openTab !== null}
        onOpenChange={(o) => !o && setOpenTab(null)}
        title={TABS.find((t) => t.value === openTab)?.label ?? ""}
      >
        {openTab === "sections" ? (
          <SectionsList onNavigate={() => setOpenTab(null)} />
        ) : openTab === "ai" ? (
          <AIPanelPlaceholder />
        ) : openTab === "ats" ? (
          <ATSPanelPlaceholder />
        ) : openTab === "settings" ? (
          <SettingsPanelPlaceholder />
        ) : null}
      </BottomSheet>
    </>
  );
}

/**
 * Section list inside the "Bagian" sheet. Tapping a section closes the sheet
 * and scrolls the canvas to that block.
 */
function SectionsList({ onNavigate }: { onNavigate: () => void }) {
  const sections = useEditorStore((s) => s.sections);
  const activeSectionId = useEditorLayoutStore((s) => s.activeSectionId);

  if (sections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-6 text-center">
        Belum ada bagian. Tambahkan bagian dari toolbar di atas kanvas.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {sections.map((s) => {
        const isActive = s.id === activeSectionId;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                // CSS.escape so a section id with a quote/backslash/bracket
                // doesn't blow up querySelector. Falls back to the raw id in
                // pre-2018 browsers without CSS.escape.
                const sel =
                  typeof CSS !== "undefined" && typeof CSS.escape === "function"
                    ? CSS.escape(s.id)
                    : s.id;
                const el = document.querySelector<HTMLElement>(
                  `[data-section-id="${sel}"]`,
                );
                if (el) {
                  el.scrollIntoView({
                    behavior: prefersReducedMotion() ? "auto" : "smooth",
                    block: "start",
                  });
                }
                onNavigate();
              }}
              className={[
                "w-full text-left px-4 py-3 flex items-center justify-between min-h-[44px]",
                "hover:bg-muted transition-colors",
                isActive ? "font-medium text-foreground" : "text-muted-foreground",
              ].join(" ")}
            >
              <span className="capitalize">{s.sectionType}</span>
              {!s.visible && (
                <span className="text-xs uppercase tracking-wider opacity-60">
                  hidden
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
