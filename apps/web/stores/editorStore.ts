import { create } from "zustand";
import type { ResumeSection } from "@/hooks/useResume";
import type { SectionType } from "@/types/resume";

export interface EditorSection {
  id: string;
  sectionType: SectionType;
  displayOrder: number;
  content: Record<string, unknown>;
  aiGenerated: boolean;
  visible: boolean;
}

interface EditorState {
  sections: EditorSection[];
  dirty: boolean;

  setSections: (sections: ResumeSection[]) => void;
  updateSectionContent: (id: string, content: Record<string, unknown>) => void;
  toggleSectionVisibility: (id: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  moveSectionUp: (index: number) => void;
  moveSectionDown: (index: number) => void;
  addSection: (sectionType: SectionType) => void;
  removeSection: (id: string) => void;
  markClean: () => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  sections: [],
  dirty: false,

  setSections: (sections) =>
    set({
      sections: sections.map((s) => ({
        ...s,
        visible: true,
      })),
      dirty: false,
    }),

  updateSectionContent: (id, content) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, content } : s,
      ),
      dirty: true,
    })),

  toggleSectionVisibility: (id) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, visible: !s.visible } : s,
      ),
      dirty: true,
    })),

  reorderSections: (fromIndex, toIndex) =>
    set((state) => {
      const next = [...state.sections];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return {
        sections: next.map((s, i) => ({ ...s, displayOrder: i })),
        dirty: true,
      };
    }),

  moveSectionUp: (index) =>
    set((state) => {
      if (index <= 0) return state;
      const next = [...state.sections];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return {
        sections: next.map((s, i) => ({ ...s, displayOrder: i })),
        dirty: true,
      };
    }),

  moveSectionDown: (index) =>
    set((state) => {
      if (index >= state.sections.length - 1) return state;
      const next = [...state.sections];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return {
        sections: next.map((s, i) => ({ ...s, displayOrder: i })),
        dirty: true,
      };
    }),

  addSection: (sectionType) =>
    set((state) => ({
      sections: [
        ...state.sections,
        {
          id: `new-${Date.now()}`,
          sectionType,
          displayOrder: state.sections.length,
          content: {},
          aiGenerated: false,
          visible: true,
        },
      ],
      dirty: true,
    })),

  removeSection: (id) =>
    set((state) => ({
      sections: state.sections
        .filter((s) => s.id !== id)
        .map((s, i) => ({ ...s, displayOrder: i })),
      dirty: true,
    })),

  markClean: () => set({ dirty: false }),
}));
