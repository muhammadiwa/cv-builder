import "@testing-library/jest-dom/vitest";
// JSDOM doesn't ship an IndexedDB implementation. `fake-indexeddb/auto`
// installs an in-memory IDB on `globalThis` per worker so Dexie + repository
// tests work without spinning up a real browser.
import "fake-indexeddb/auto";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// `@testing-library/react` auto-cleanup is wired to Jest's `afterEach`
// hook automatically, but Vitest needs explicit registration. Without
// this, DOM from one test leaks into the next.
afterEach(() => {
  cleanup();
});

// JSDOM doesn't ship these — components like EditorShell and the section
// blocks rely on them, so polyfill noop versions to keep render() happy.
class MockResizeObserver {
  observe() { }
  unobserve() { }
  disconnect() { }
}
class MockIntersectionObserver {
  root = null;
  rootMargin = "";
  thresholds: ReadonlyArray<number> = [];
  observe() { }
  unobserve() { }
  disconnect() { }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver =
    MockResizeObserver as unknown as typeof ResizeObserver;
}
if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

// matchMedia is also missing in JSDOM. Default to "no match" — components
// that read `prefers-reduced-motion` or breakpoint queries during tests will
// see desktop / motion-allowed values, which mirrors our SSR baseline.
if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => { },
      removeListener: () => { },
      addEventListener: () => { },
      removeEventListener: () => { },
      dispatchEvent: () => false,
    }),
  });
}
