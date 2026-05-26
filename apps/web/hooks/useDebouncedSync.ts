"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { apiFetch } from "@/lib/api-client";

export function useDebouncedSync(resumeId: string) {
  const sections = useEditorStore((s) => s.sections);
  const dirty = useEditorStore((s) => s.dirty);
  const markClean = useEditorStore((s) => s.markClean);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirty) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        await apiFetch(`/resumes/${resumeId}`, {
          method: "PATCH",
          body: JSON.stringify({
            sections: sections.map((s) => ({
              id: s.id.startsWith("new-") ? undefined : s.id,
              sectionType: s.sectionType,
              displayOrder: s.displayOrder,
              content: s.content,
              visible: s.visible,
            })),
          }),
        });
        markClean();
      } catch {
        // Will retry on next dirty change
      }
    }, 2000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dirty, sections, resumeId, markClean]);
}
