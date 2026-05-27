"use client";

import { useEffect, useRef, type ReactNode } from "react";
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

  // Ref to the scrollable main element so the IntersectionObserver can use
  // it as `root` on desktop/tablet (where main has `overflow-y-auto`). On
  // mobile the viewport scrolls, so we leave `root` at the default (null).
  const mainRef = useRef<HTMLElement | null>(null);

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
        } else {
          // No section intersects the detection zone. Clear the active
          // indicator so the nav doesn't show a stale highlight (e.g. after
          // the user scrolls past the last section or deletes the active one).
          setActiveSectionId(null);
        }
      },
      {
        // Use the actual scroll container as root on desktop/tablet — the
        // viewport default would never fire because `<main>` owns the scroll.
        root: bp === "mobile" ? null : mainRef.current,
        // Wider detection zone so the topmost visible section reliably
        // triggers the active indicator. When zero sections intersect (e.g.
        // scrolled past all blocks), the else-branch above clears the state.
        rootMargin: "-10% 0% -70% 0%",
        threshold: 0,
      },
    );

    // Scope MutationObserver to the canvas root rather than the whole
    // document — TipTap edits fire mutations on every keystroke and we
    // don't want to re-query the whole document body each time. Debounce
    // attach() so a burst of mutations only triggers one re-query.
    const canvasRoot = mainRef.current ?? document.body;
    const attach = () => {
      canvasRoot
        .querySelectorAll<HTMLElement>("[data-section-id]")
        .forEach((el) => observer.observe(el));
    };
    attach();

    let pending: number | null = null;
    const debouncedAttach = () => {
      if (pending != null) return;
      pending = window.setTimeout(() => {
        pending = null;
        attach();
      }, 100);
    };

    const mo = new MutationObserver(debouncedAttach);
    mo.observe(canvasRoot, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mo.disconnect();
      if (pending != null) window.clearTimeout(pending);
    };
  }, [setActiveSectionId, bp]);

  if (bp === "mobile") {
    return (
      <div className="min-h-screen flex flex-col">
        <main
          ref={mainRef}
          className="flex-1 pb-[120px]"
        >
          {/* Pad bottom so MobileTabBar + StatusBar don't cover content */}
          {children}
        </main>
        <div className="fixed bottom-0 inset-x-0 z-40">
          <StatusBar />
        </div>
        <MobileTabBar />
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
          // Column collapse/expand is animated via width transitions on the
          // panel wrappers (grid-template-columns is non-animatable per CSS
          // spec, so the grid tracks snap instantly while the inner widths
          // animate smoothly).
        }}
      >
        {showLeftNav && (
          <div
            className="transition-[width] duration-200 overflow-hidden"
            style={{ width: leftW, minWidth: 0 }}
          >
            <LeftNav />
          </div>
        )}
        <main ref={mainRef} className="overflow-y-auto" style={{ minWidth: 0 }}>
          {children}
        </main>
        <div
          className="transition-[width] duration-200 overflow-hidden"
          style={{ width: rightW, minWidth: 0 }}
        >
          <RightPanel />
        </div>
      </div>
      <StatusBar />
    </div>
  );
}
