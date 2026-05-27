import { create } from "zustand";
import { temporal } from "zundo";
import type { ResumeSection } from "@/hooks/useResume";
import type { SectionType } from "@/types/resume";
import {
  FIELD_TS_KEY,
  getFieldTimestamps,
  mergeSectionWithLWW,
  stampField,
} from "@/lib/sync/fieldTimestamps";

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
  /** Timestamp (ms epoch) of the last successful PATCH sync. */
  lastSyncedAt: number | null;

  setSections: (sections: ResumeSection[]) => void;
  /** Replace an entire section content blob. */
  updateSectionContent: (id: string, content: Record<string, unknown>) => void;
  /**
   * Atomic single-field merge. Avoids stale-closure clobbering when two fields
   * dispatch back-to-back inside the same render frame. Stamps the per-field
   * timestamp under `__field_updated_at` so the LWW protocol can resolve
   * cross-device conflicts.
   */
  updateSectionField: (id: string, field: string, value: unknown) => void;
  toggleSectionVisibility: (id: string) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;
  moveSectionUp: (index: number) => void;
  moveSectionDown: (index: number) => void;
  addSection: (sectionType: SectionType) => void;
  removeSection: (id: string) => void;
  markClean: () => void;
  /**
   * Merge a fresh server snapshot into the store using per-field LWW. Replaces
   * server-newer fields, keeps client-newer fields. Marks the store synced and
   * stamps `lastSyncedAt`. Returns the per-section list of fields the client
   * lost so callers can surface conflict toasts.
   */
  markSyncedAll: (
    serverSections: ResumeSection[],
    syncedAt?: number,
  ) => Array<{ sectionId: string; field: string }>;
  /**
   * Hydrate from a previously-cached snapshot (typically IndexedDB). Unlike
   * `setSections`, this preserves the cached `dirtySince` semantics: any
   * field with a timestamp newer than `lastSyncedAt` keeps the store dirty.
   */
  hydrateFromCache: (
    sections: EditorSection[],
    lastSyncedAt: number | null,
  ) => void;
  /** Section IDs currently being rewritten by AI — edits are blocked. */
  lockedSections: Set<string>;
  /** Lock a section during AI streaming. */
  lockSection: (id: string) => void;
  /** Unlock a section after AI streaming completes. */
  unlockSection: (id: string) => void;
}

function reindex(sections: EditorSection[]): EditorSection[] {
  return sections.map((s, i) => ({ ...s, displayOrder: i }));
}

export const useEditorStore = create<EditorState>()(temporal((set, get) => ({
  sections: [],
  dirty: false,
  lastSyncedAt: null,
  lockedSections: new Set<string>(),

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
      // Hydrating from server is, by definition, the most recent known sync
      // point. Stamp it so the status bar shows a sensible "last saved" right
      // after page load.
      lastSyncedAt: Date.now(),
    }),

  updateSectionContent: (id, content) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, content } : s,
      ),
      dirty: true,
    })),

  updateSectionField: (id, field, value) =>
    set((state) => {
      // Write-lock: if the section is being rewritten by AI, block edits.
      if (state.lockedSections.has(id)) return state;
      const now = Date.now();
      return {
        sections: state.sections.map((s) =>
          s.id === id ? { ...s, content: stampField(s.content, field, value, now) } : s,
        ),
        dirty: true,
      };
    }),

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

  markClean: () => set({ dirty: false, lastSyncedAt: Date.now() }),

  lockSection: (id) =>
    set((state) => {
      const next = new Set(state.lockedSections);
      next.add(id);
      return { lockedSections: next };
    }),

  unlockSection: (id) =>
    set((state) => {
      const next = new Set(state.lockedSections);
      next.delete(id);
      return { lockedSections: next };
    }),

  markSyncedAll: (serverSections, syncedAt) => {
    const now = syncedAt ?? Date.now();
    const conflicts: Array<{ sectionId: string; field: string }> = [];
    set((state) => {
      const clientById = new Map(state.sections.map((s) => [s.id, s]));
      const merged: EditorSection[] = serverSections.map((srv) => {
        const serverSection: EditorSection = {
          id: srv.id,
          sectionType: srv.sectionType,
          displayOrder: srv.displayOrder,
          content: srv.content,
          aiGenerated: srv.aiGenerated,
          visible: typeof srv.visible === "boolean" ? srv.visible : true,
        };
        const client = clientById.get(srv.id);
        if (!client) return serverSection;
        const result = mergeSectionWithLWW(client, serverSection);
        for (const field of result.discardedClientFields) {
          conflicts.push({ sectionId: srv.id, field });
        }
        return result.merged;
      });

      // Preserve locally-added sections (local- prefix) that the server
      // hasn't seen yet — they'll be persisted on the next sync round.
      const serverIds = new Set(serverSections.map((s) => s.id));
      for (const s of state.sections) {
        if (isNewSectionId(s.id) && !serverIds.has(s.id)) {
          merged.push(s);
        }
      }

      // Compute the highest field timestamp from the SERVER's response
      // (before merge). This represents the server's clock at PATCH time.
      // If the server's clock is ahead of the client's, we need
      // lastSyncedAt to be at least this high so server-stamped fields
      // don't appear "dirty" to selectDirtySince and trigger an infinite
      // sync loop. We intentionally exclude client-preserved fields from
      // this calculation — those ARE still dirty and should trigger a sync.
      let maxServerTs = now;
      for (const srv of serverSections) {
        const ts = getFieldTimestamps(srv.content);
        for (const t of Object.values(ts)) {
          if (t > maxServerTs) maxServerTs = t;
        }
      }
      const effectiveSyncedAt = maxServerTs;

      // Determine if the merged store still has any pending field newer than
      // the effective sync point. Only locally-stamped edits that happened
      // AFTER this merge should keep the store dirty.
      const stillDirty = merged.some((s) => {
        const ts = getFieldTimestamps(s.content);
        return Object.values(ts).some((t) => t > effectiveSyncedAt);
      });

      return {
        sections: merged,
        dirty: stillDirty,
        lastSyncedAt: effectiveSyncedAt,
      };
    });
    return conflicts;
  },

  hydrateFromCache: (sections, lastSyncedAt) =>
    set((state) => {
      // If the server has already merged a fresher snapshot (e.g. useResume
      // resolved before useResumeRestore), skip the IDB hydration — the
      // store already has newer data and overwriting would regress it.
      if (
        state.lastSyncedAt !== null &&
        lastSyncedAt !== null &&
        state.lastSyncedAt > lastSyncedAt
      ) {
        return state;
      }

      const cleanThreshold = lastSyncedAt ?? 0;
      // Restore dirty when any field has a timestamp newer than the cached
      // sync point — that's exactly what `dirtySince` was tracking in IDB.
      const stillDirty = sections.some((s) => {
        const ts = getFieldTimestamps(s.content);
        return Object.values(ts).some((t) => t > cleanThreshold);
      });
      return {
        sections: sections.map((s) => ({
          ...s,
          visible: typeof s.visible === "boolean" ? s.visible : true,
        })),
        dirty: stillDirty,
        lastSyncedAt,
      };
    }),
}), { limit: 50, partialize: (state) => ({ sections: state.sections }) }));

/**
 * Selector helper: the smallest field-update timestamp newer than
 * `lastSyncedAt`, or `null` if the store has no unsynced edits. Designed for
 * use by `useSyncStatus` so the StatusBar reflects IDB-backed truth.
 */
export function selectDirtySince(state: EditorState): number | null {
  const since = state.lastSyncedAt ?? 0;
  let earliest: number | null = null;
  for (const s of state.sections) {
    const ts = getFieldTimestamps(s.content);
    for (const t of Object.values(ts)) {
      if (t > since) earliest = earliest === null ? t : Math.min(earliest, t);
    }
  }
  return earliest;
}

// Re-export for consumers that want the magic key without importing from `lib/sync`.
export { FIELD_TS_KEY };
