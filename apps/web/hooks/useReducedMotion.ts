"use client";

import { useEffect, useState } from "react";

/**
 * Reactively reports whether the user has `prefers-reduced-motion: reduce`
 * set, including runtime toggles in OS-level accessibility settings.
 *
 * SSR-safe: returns `false` on the server (fewer surprises than assuming
 * reduced motion when we can't detect it).
 */
export function useReducedMotion(): boolean {
    // Lazy initial value reads the preference synchronously on the first
    // render so the first paint already honors reduced motion. Without this
    // we'd render one frame at full motion before the useEffect subscribes
    // and re-renders.
    const [reduced, setReduced] = useState<boolean>(() => {
        if (typeof window === "undefined" || !window.matchMedia) return false;
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    });

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(mq.matches);
        update();

        if (typeof mq.addEventListener === "function") {
            mq.addEventListener("change", update);
            return () => mq.removeEventListener("change", update);
        }
        // Older Safari (<14): legacy listener API.
        mq.addListener(update);
        return () => mq.removeListener(update);
    }, []);

    return reduced;
}

/**
 * Imperative variant for non-React contexts (e.g. inside event handlers).
 * Always returns the current preference at call time.
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
