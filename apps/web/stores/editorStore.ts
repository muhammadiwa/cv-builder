import { create } from "zustand";
import type { ResumeSection } from "@/hooks/useResume";
import type { SectionType } from "@/types/resume";

/**
 * Locally-staged section. New (unsaved) sections use a temporary client id
 * with the `local-` prefix so debounced sync knows to omit `id` when calling
 * the API. Once the server responds, the next refetch replaces this row with
 * the canonical UUID-keyed copy.
 */
export const NEW_SECTION_ID_PREFIX = "local-";

export function isNewSectionId(id: string): boolean {
  return id.startsWith(NEW_SECTION_ID_PREFIX);
}

function newSectionId(): string {
  // crypto.randomUUID is widely available in modern browsers; fall back to a
  // simple counter+random combo so identical-millisecond clicks don't collide.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${NEW_SECTION_ID_PREFIX}${crypto.randomUUID()}`;
  }
  return `${NEW_SECTION_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  /** Replace an entire section content blob. */
  updateSectionContent: (id: string, content: Record<string, unknown>) => void;
  /**
   * Atomic single-field merge. Avoids stale-closure clobbering when two fields
   * dispatch back-to-back inside the same render frame.
   */
  updateSectionField: (id: string, field: string, value: unknown) => void;
  toggleSectionVisibility: (id: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  moveSectionUp: (index: number) => void;
  moveSectionDown: (index: number) => void;
  addSection: (sectionType: SectionType) => void;
  removeSection: (id: string) => void;
  markClean: () => void;
}

function reindex(sections: EditorSection[]): EditorSection[] {
  return sections.map((s, i) => ({ ...s, displayOrder: i }));
}

export const useEditorStore = create<EditorState>()((set) => ({
  sections: [],
  dirty: false,

  setSections: (sections) =>
    set({
      sections: sections.map((s) => ({
        id: s.id,
        sectionType: s.sectionType,
        displayOrder: s.displayOrder,
        content: s.content,
        aiGenerated: s.aiGenerated,
        // Preserve server-stored visibility; default to true only if the server
        // omits the field (e.g. older API responses pre-migration).
        visible: typeof s.visible === "boolean" ? s.visible : true,
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

  updateSectionField: (id, field, value) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, content: { ...s.content, [field]: value } } : s,
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
      const len = state.sections.length;
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= len ||
        toIndex >= len ||
        fromIndex === toIndex
      ) {
        return state;
      }
      const next = [...state.sections];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { sections: reindex(next), dirty: true };
    }),

  moveSectionUp: (index) =>
    set((state) => {
      if (index <= 0 || index >= state.sections.length) return state;
      const next = [...state.sections];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return { sections: reindex(next), dirty: true };
    }),

  moveSectionDown: (index) =>
    set((state) => {
      if (index < 0 || index >= state.sections.length - 1) return state;
      const next = [...state.sections];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return { sections: reindex(next), dirty: true };
    }),

  addSection: (sectionType) =>
    set((state) => ({
      sections: [
        ...state.sections,
        {
          id: newSectionId(),
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
      sections: reindex(state.sections.filter((s) => s.id !== id)),
      dirty: true,
    })),

  markClean: () => set({ dirty: false }),
}));
