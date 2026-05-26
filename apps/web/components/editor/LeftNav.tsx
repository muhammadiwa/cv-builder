"use client";

import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  User,
  AlignLeft,
  Briefcase,
  GraduationCap,
  Wrench,
  Award,
  FolderGit2,
  Languages,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useEditorLayoutStore } from "@/stores/editorLayoutStore";
import type { SectionType } from "@/types/resume";

/**
 * LeftNav
 *
 * Vertical, scroll-spy-driven section navigator for the desktop layout.
 * Each item:
 *   - shows the section type's icon and label
 *   - on click, scrolls the corresponding `[data-section-id="…"]` element
 *     into view
 *   - when collapsed (64px), renders icon-only with hover-accessible labels
 *
 * The active item is highlighted by a 2px left-border driven by Framer
 * Motion's shared layout (`layoutId`) so the indicator springs between items
 * instead of teleporting.
 */
const SECTION_ICONS: Record<SectionType, LucideIcon> = {
  header: User,
  summary: AlignLeft,
  experience: Briefcase,
  education: GraduationCap,
  skills: Wrench,
  certifications: Award,
  projects: FolderGit2,
  languages: Languages,
  achievements: Trophy,
};

const SECTION_LABELS: Record<SectionType, string> = {
  header: "Header",
  summary: "Ringkasan",
  experience: "Pengalaman",
  education: "Pendidikan",
  skills: "Keahlian",
  certifications: "Sertifikasi",
  projects: "Proyek",
  languages: "Bahasa",
  achievements: "Pencapaian",
};

export function LeftNav() {
  const sections = useEditorStore((s) => s.sections);
  const collapsed = useEditorLayoutStore((s) => s.leftNavCollapsed);
  const toggle = useEditorLayoutStore((s) => s.toggleLeftNav);
  const activeSectionId = useEditorLayoutStore((s) => s.activeSectionId);

  const handleNavigate = (sectionId: string) => {
    const el = document.querySelector<HTMLElement>(
      `[data-section-id="${sectionId}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <aside
      className="h-full flex flex-col border-r bg-background"
      aria-label="Section navigation"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        {!collapsed && (
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Bagian
          </span>
        )}
        <button
          type="button"
          onClick={toggle}
          className="ml-auto p-1 rounded hover:bg-muted text-muted-foreground"
          aria-label={collapsed ? "Bentangkan navigasi" : "Ciutkan navigasi"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav
        className="flex-1 overflow-y-auto py-2"
        role="navigation"
        aria-label="Sections"
      >
        <ul className="flex flex-col gap-0.5 px-1">
          {sections.map((s) => {
            const Icon = SECTION_ICONS[s.sectionType] ?? AlignLeft;
            const label = SECTION_LABELS[s.sectionType] ?? s.sectionType;
            const isActive = s.id === activeSectionId;

            return (
              <li key={s.id} className="relative">
                {isActive && (
                  // Shared-layout indicator: animates between active items.
                  <motion.span
                    layoutId="leftnav-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-primary motion-reduce:transition-none"
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 35,
                    }}
                    aria-hidden="true"
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleNavigate(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const list =
                        e.currentTarget.parentElement?.parentElement;
                      if (!list) return;
                      const buttons = Array.from(
                        list.querySelectorAll<HTMLButtonElement>(
                          'button[data-leftnav-item="true"]',
                        ),
                      );
                      const idx = buttons.indexOf(e.currentTarget);
                      const nextIdx =
                        e.key === "ArrowDown"
                          ? Math.min(idx + 1, buttons.length - 1)
                          : Math.max(idx - 1, 0);
                      buttons[nextIdx]?.focus();
                    }
                  }}
                  data-leftnav-item="true"
                  data-active={isActive}
                  className={[
                    "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    "transition-colors hover:bg-muted",
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground",
                    collapsed ? "justify-center" : "",
                    !s.visible ? "opacity-50" : "",
                  ].join(" ")}
                  title={collapsed ? label : undefined}
                  aria-current={isActive ? "true" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
