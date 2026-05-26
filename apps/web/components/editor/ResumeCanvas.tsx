"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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

const A4_W = Math.round(210 * 3.7795);
const A4_H = Math.round(297 * 3.7795);

export default function ResumeCanvas() {
  const sections = useEditorStore((s) => s.sections);
  const reorderSections = useEditorStore((s) => s.reorderSections);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const contentRef = useRef(sectionsToDoc(sections));

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
    const newDoc = sectionsToDoc(sections);
    const currentJson = JSON.stringify(editor.getJSON());
    const newJson = JSON.stringify(newDoc);
    if (currentJson !== newJson) {
      editor.commands.setContent(newDoc);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.length, sections.map((s) => s.displayOrder).join(",")]);

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

  const visibleSectionIds = sections.filter((s) => s.visible).map((s) => s.id);

  if (!mounted) {
    return (
      <div
        className="mx-auto bg-white shadow-lg rounded-sm"
        style={{ width: A4_W, minHeight: A4_H }}
      />
    );
  }

  if (!editor) return null;

  return (
    <div className="flex justify-center py-8">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleSectionIds}
          strategy={verticalListSortingStrategy}
        >
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
    content: sections
      .filter((s) => s.visible)
      .map((s) => ({
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
