"use client";

import { useEffect, type ReactNode } from "react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useEditorLayoutStore } from "@/stores/editorLayoutStore";
import { LeftNav } from "./LeftNav";
import { RightPanel } from "./RightPanel";
import { StatusBar } from "./StatusBar";
import { MobileTabBar } from "./MobileTabBar";

/**
 * EditorShell
 *
 * Responsive container around the editor toolbar + canvas. Owns the editor
 * chrome (left nav, right panel, status bar, mobile tab bar) and swaps
 * layouts based on the viewport.
 *
 * Layouts:
 *   - desktop ≥1024px: 3-column grid (left nav | canvas | right panel)
 *   - tablet 768–1023: 2-column grid (canvas | right panel)  — left nav
 *     is collapsible content; we hide it entirely to keep the canvas the
 *     dominant element on tablets
 *   - mobile <768px : single column + fixed bottom tab bar
 *
 * Active-section tracking:
 *   A single IntersectionObserver watches every `[data-section-id]`
 *   element. The topmost intersecting block is reported to
 *   `editorLayoutStore.activeSectionId` for the LeftNav indicator and the
 *   mobile sections sheet.
 */
export interface EditorShellProps {
  children: ReactNode;
}

const LEFT_NAV_W_PX = 280;
const LEFT_NAV_W_COLLAPSED_PX = 64;
const RIGHT_PANEL_W_PX = 360;
const RIGHT_PANEL_W_COLLAPSED_PX = 40;

export function EditorShell({ children }: EditorShellProps) {
  const bp = useBreakpoint();
  const leftCollapsed = useEditorLayoutStore((s) => s.leftNavCollapsed);
  const rightCollapsed = useEditorLayoutStore((s) => s.rightPanelCollapsed);
  const setActiveSectionId = useEditorLayoutStore((s) => s.setActiveSectionId);

  // Scroll-spy: report the topmost visible section to the layout store.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry whose top is closest to the viewport top among the
        // currently intersecting ones — this is the "you are here" section.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top),
          );
        if (visible.length > 0) {
          const id = (visible[0].target as HTMLElement).dataset.sectionId;
          if (id) setActiveSectionId(id);
        }
      },
      {
        // 30% top + 50% bottom margin makes the indicator settle on the
        // section the user is reading rather than racing past at the top.
        rootMargin: "-30% 0% -50% 0%",
        threshold: 0,
      },
    );

    // Observe existing and future blocks. The TipTap NodeView portal mounts
    // them lazily, so we re-query a few frames after mount.
    const attach = () => {
      document
        .querySelectorAll<HTMLElement>("[data-section-id]")
        .forEach((el) => observer.observe(el));
    };
    attach();
    const id = window.setTimeout(attach, 200);

    // Re-query on DOM mutations (sections added, reordered).
    const mo = new MutationObserver(attach);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mo.disconnect();
      window.clearTimeout(id);
    };
  }, [setActiveSectionId]);

  if (bp === "mobile") {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 pb-[120px]">
          {/* Pad bottom so MobileTabBar + StatusBar don't cover content */}
          {children}
        </main>
        <div className="fixed bottom-0 inset-x-0 z-20">
          <StatusBar />
          <MobileTabBar />
        </div>
      </div>
    );
  }

  // tablet & desktop share the grid; tablet hides the LeftNav column.
  const showLeftNav = bp === "desktop";

  const leftW = leftCollapsed ? LEFT_NAV_W_COLLAPSED_PX : LEFT_NAV_W_PX;
  const rightW = rightCollapsed ? RIGHT_PANEL_W_COLLAPSED_PX : RIGHT_PANEL_W_PX;

  return (
    <div className="min-h-screen flex flex-col">
      <div
        className="flex-1 grid"
        style={{
          gridTemplateColumns: showLeftNav
            ? `${leftW}px 1fr ${rightW}px`
            : `1fr ${rightW}px`,
          // CSS grid track changes are visually animated by Tailwind's
          // duration utilities on the column children; the grid container
          // itself can't animate `grid-template-columns` cross-browser, so
          // we rely on the column-element widths being fixed (above) and
          // animations happening inside the columns.
          transition:
            "grid-template-columns 200ms cubic-bezier(0.4, 0.0, 0.2, 1)",
        }}
      >
        {showLeftNav && (
          <div style={{ minWidth: 0 }}>
            <LeftNav />
          </div>
        )}
        <main className="overflow-y-auto" style={{ minWidth: 0 }}>
          {children}
        </main>
        <div style={{ minWidth: 0 }}>
          <RightPanel />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
