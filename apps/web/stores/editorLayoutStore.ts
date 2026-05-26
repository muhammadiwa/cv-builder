import { create } from "zustand";

/**
 * Zustand slice for editor chrome state. Intentionally separate from
 * `useEditorStore` (the section data store) to avoid invalidating every
 * section block whenever the user opens a panel or scrolls past a section.
 *
 * Persistence policy:
 *   - `rightPanelTab` persists to `sessionStorage` so a reload of the same
 *     tab keeps the user's last panel choice. We do NOT use `localStorage`
 *     because we don't want a Chat panel to follow the user across tabs and
 *     resumes — that's surprising.
 *   - All other state (collapse flags, active section) is ephemeral.
 */

export type RightPanelTab = "ai" | "ats" | "template";

const SESSION_KEY = "editor:rightPanelTab";

function loadInitialTab(): RightPanelTab {
  if (typeof window === "undefined") return "ai";
  try {
    const v = window.sessionStorage.getItem(SESSION_KEY);
    if (v === "ai" || v === "ats" || v === "template") return v;
  } catch {
    // sessionStorage may throw in strict privacy modes — ignore and default.
  }
  return "ai";
}

interface EditorLayoutState {
  leftNavCollapsed: boolean;
  rightPanelCollapsed: boolean;
  rightPanelTab: RightPanelTab;
  activeSectionId: string | null;

  toggleLeftNav: () => void;
  setLeftNavCollapsed: (v: boolean) => void;
  toggleRightPanel: () => void;
  setRightPanelCollapsed: (v: boolean) => void;
  setRightPanelTab: (tab: RightPanelTab) => void;
  setActiveSectionId: (id: string | null) => void;
}

export const useEditorLayoutStore = create<EditorLayoutState>()((set) => ({
  leftNavCollapsed: false,
  rightPanelCollapsed: false,
  rightPanelTab: loadInitialTab(),
  activeSectionId: null,

  toggleLeftNav: () =>
    set((s) => ({ leftNavCollapsed: !s.leftNavCollapsed })),
  setLeftNavCollapsed: (v) => set({ leftNavCollapsed: v }),

  toggleRightPanel: () =>
    set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
  setRightPanelCollapsed: (v) => set({ rightPanelCollapsed: v }),

  setRightPanelTab: (tab) => {
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(SESSION_KEY, tab);
      } catch {
        // ignore storage errors
      }
    }
    set({ rightPanelTab: tab });
  },

  setActiveSectionId: (id) => set({ activeSectionId: id }),
}));
