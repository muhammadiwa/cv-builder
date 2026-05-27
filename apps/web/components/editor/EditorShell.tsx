"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useEditorLayoutStore } from "@/stores/editorLayoutStore";
import { LeftNav } from "./LeftNav";
import { RightPanel } from "./RightPanel";
import { StatusBar } from "./StatusBar";
import { MobileTabBar } from "./MobileTabBar";
import { AISelectionWand } from "./AISelectionWand";
import { useAIRewrite } from "@/hooks/useAIRewrite";
import { getFieldTimestamps } from "@/lib/sync/fieldTimestamps";

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

    // IntersectionObserver only delivers entries for elements whose
    // intersection state CHANGED. To answer "which section is currently
    // topmost?" we maintain a running Set of currently-intersecting
    // elements, update it from each delta, then pick the topmost from the
    // full Set — never from the partial entries argument.
    const intersectingEls = new Set<HTMLElement>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const target = e.target as HTMLElement;
          if (e.isIntersecting) intersectingEls.add(target);
          else intersectingEls.delete(target);
        }

        if (intersectingEls.size === 0) {
          // No section in the detection zone — clear the indicator so the
          // nav doesn't show a stale highlight after the user scrolls past
          // the last section or deletes the active one.
          setActiveSectionId(null);
          return;
        }

        // Pick the element whose top is closest to the root top edge. We
        // recompute getBoundingClientRect for each candidate because the
        // entries we cached may be stale by the next callback.
        let topmostEl: HTMLElement | null = null;
        let topmostDistance = Infinity;
        for (const el of intersectingEls) {
          const dist = Math.abs(el.getBoundingClientRect().top);
          if (dist < topmostDistance) {
            topmostDistance = dist;
            topmostEl = el;
          }
        }
        const id = topmostEl?.dataset.sectionId ?? null;
        if (id) setActiveSectionId(id);
      },
      {
        // Use the actual scroll container as root on desktop/tablet — the
        // viewport default would never fire because `<main>` owns the scroll.
        root: bp === "mobile" ? null : mainRef.current,
        // Wider detection zone so the topmost visible section reliably
        // triggers the active indicator.
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
        className="flex-1 grid transition-[grid-template-columns] duration-200 ease-out"
        style={{
          gridTemplateColumns: showLeftNav
            ? `${leftW}px 1fr ${rightW}px`
            : `1fr ${rightW}px`,
          // `grid-template-columns` IS animatable in modern browsers when
          // the track count stays the same between values (Chrome 80+,
          // Safari 14.1+, Firefox 66+). We keep 3 tracks throughout, so the
          // grid track widths interpolate smoothly without the inner-width
          // / track-width mismatch we'd hit if we animated only the child
          // wrappers.
        }}
      >
        {showLeftNav && (
          <div className="overflow-hidden" style={{ minWidth: 0 }}>
            <LeftNav />
          </div>
        )}
        <main ref={mainRef} className="overflow-y-auto" style={{ minWidth: 0 }}>
          {children}
        </main>
        <div className="overflow-hidden" style={{ minWidth: 0 }}>
          <RightPanel />
        </div>
      </div>
      <StatusBar />
      {/* Floating AI wand for text selection (desktop only) */}
      <AISelectionWand
        onSelect={(instruction, sectionId, field, selectedText) => {
          // The selection wand delegates to the SectionBlock's AI flow.
          // We dispatch a custom event that the SectionBlock can listen to.
          window.dispatchEvent(
            new CustomEvent("ai-selection-rewrite", {
              detail: { instruction, sectionId, field, selectedText },
            }),
          );
        }}
      />
    </div>
  );
}
