"use client";

import { useEffect, useState } from "react";

/**
 * Single source of truth for the editor's responsive breakpoints. Keeps
 * media-query logic out of components.
 *
 * Tailwind breakpoints in use:
 *   - md  = 768px  (mobile boundary)
 *   - lg  = 1024px (tablet/desktop boundary)
 *
 * Mapping:
 *   - mobile  : viewport <  768px
 *   - tablet  : 768px <= viewport < 1024px
 *   - desktop : viewport >= 1024px
 *
 * SSR safety: the hook returns `desktop` on the server (so the Next.js
 * static shell renders the desktop chrome), then re-evaluates on mount.
 * This prevents hydration mismatches because the desktop layout is the
 * superset; mobile-only components mount only when the breakpoint flips.
 */
export type Breakpoint = "mobile" | "tablet" | "desktop";

const MOBILE_MAX_PX = 767; // <768
const TABLET_MAX_PX = 1023; // <1024

function detectBreakpoint(): Breakpoint {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w <= MOBILE_MAX_PX) return "mobile";
  if (w <= TABLET_MAX_PX) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  // Always start as `desktop` on the server; then snap to the real value
  // on first client render. The mismatch window is one render frame.
  const [bp, setBp] = useState<Breakpoint>("desktop");

  useEffect(() => {
    const update = () => setBp(detectBreakpoint());
    update();

    // Listen via matchMedia for crisp boundary events (no debounce needed).
    const mqMobile = window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`);
    const mqTablet = window.matchMedia(`(max-width: ${TABLET_MAX_PX}px)`);
    const onChange = () => update();

    // Older Safari (<14) only supports the legacy `addListener` API. Probe
    // for the modern API first; fall back to the legacy one so the editor
    // doesn't crash on iOS 13.
    const supportsModern = typeof mqMobile.addEventListener === "function";
    if (supportsModern) {
      mqMobile.addEventListener("change", onChange);
      mqTablet.addEventListener("change", onChange);
    } else {
      mqMobile.addListener(onChange);
      mqTablet.addListener(onChange);
    }

    return () => {
      if (supportsModern) {
        mqMobile.removeEventListener("change", onChange);
        mqTablet.removeEventListener("change", onChange);
      } else {
        mqMobile.removeListener(onChange);
        mqTablet.removeListener(onChange);
      }
    };
  }, []);

  return bp;
}

/** Convenience predicate for components that only care about mobile-or-not. */
export function useIsMobile(): boolean {
  return useBreakpoint() === "mobile";
}

/** Convenience predicate for desktop-grid mounting. */
export function useIsDesktop(): boolean {
  return useBreakpoint() === "desktop";
}
