"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { ReactNodeViewRenderer } from "@tiptap/react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SectionBlockExtension } from "./extensions/SectionBlock";
import { SectionBlock } from "./SectionBlock";
import { useEditorStore } from "@/stores/editorStore";
import type { SectionType } from "@/types/resume";

// CSS reference px conversion at 96 dpi (1 mm == 96 / 25.4 px ≈ 3.7795).
const PX_PER_MM = 96 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_W = Math.round(A4_WIDTH_MM * PX_PER_MM);
const A4_H = Math.round(A4_HEIGHT_MM * PX_PER_MM);

export default function ResumeCanvas() {
  const sections = useEditorStore((s) => s.sections);
  const reorderSections = useEditorStore((s) => s.reorderSections);

  // Memoize the doc so we recompute only when ordering or visibility changes —
  // not on every keystroke (content edits are owned by NodeViews directly).
  const visibilityKey = sections.map((s) => `${s.id}:${s.visible ? 1 : 0}`).join(",");
  const orderKey = sections.map((s) => `${s.id}:${s.displayOrder}`).join(",");

  const docContent = useMemo(
    () => sectionsToDoc(sections),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderKey, visibilityKey],
  );

  const contentRef = useRef(docContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      Placeholder.configure({ placeholder: "Start building your resume…" }),
      SectionBlockExtension.extend({
        addNodeView() {
          return ReactNodeViewRenderer(SectionBlock);
        },
      }),
    ],
    content: contentRef.current,
    editable: false,
  });

  useEffect(() => {
    if (!editor) return;
    const currentJson = JSON.stringify(editor.getJSON());
    const newJson = JSON.stringify(docContent);
    if (currentJson !== newJson) {
      // emitUpdate:false avoids triggering listeners that might thrash state
      // back into the store on each setContent.
      editor.commands.setContent(docContent, { emitUpdate: false });
    }
  }, [editor, docContent]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSections(oldIndex, newIndex);
      }
    },
    [sections, reorderSections],
  );

  // dnd-kit must see the same id list as the rendered NodeViews. We render
  // every section (visible or not) so toggling visibility doesn't unmount the
  // section's edit state — visibility is reflected via opacity on the block.
  const sectionIds = sections.map((s) => s.id);

  if (!editor) return null;

  return (
    <div className="flex justify-center py-8">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          <div
            className="bg-white text-black shadow-lg rounded-sm overflow-hidden"
            style={{ width: A4_W, minHeight: A4_H }}
          >
            <EditorContent
              editor={editor}
              className="p-8"
              style={{ minHeight: A4_H - 64 }}
            />
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function sectionsToDoc(
  sections: { id: string; sectionType: SectionType; visible: boolean; displayOrder: number }[],
) {
  return {
    type: "doc",
    content: sections.map((s) => ({
      type: "sectionBlock",
      attrs: {
        sectionId: s.id,
        sectionType: s.sectionType,
        visible: s.visible,
        displayOrder: s.displayOrder,
      },
    })),
  };
}
