"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

/**
 * Minimal inline rich-text editor used for Summary and Experience description
 * fields. Stores its content as TipTap-compatible HTML in the surrounding
 * section's content blob, which keeps the wire format transparent on the API
 * (string values inside `content`) without introducing a second JSON dialect.
 *
 * Keep the format short-list (bold / italic / bullet / ordered list) — enough
 * for resume copy without inviting layout-breaking nesting.
 */
export interface RichTextFieldProps {
  value: string;
  placeholder?: string;
  onChange: (html: string) => void;
}

export function RichTextField({ value, placeholder, onChange }: RichTextFieldProps) {
  // Track the latest onChange so the editor's internal listener never closes
  // over a stale prop.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[80px] px-3 py-2",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      // TipTap reports an empty paragraph as `<p></p>`; normalize to "" so the
      // store's dirty flag doesn't stick when the field is effectively blank.
      const normalized = html === "<p></p>" ? "" : html;
      onChangeRef.current(normalized);
    },
  });

  // Sync external changes (e.g. server hydration) without losing focus.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || "";
    if (current !== incoming && (incoming !== "" || current !== "<p></p>")) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="w-full rounded-md border border-input bg-background min-h-[80px]" />
    );
  }

  const buttonBase =
    "inline-flex items-center justify-center rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors";
  const activeClass = "bg-muted text-foreground";

  return (
    <div className="w-full rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring">
      <div className="flex items-center gap-0.5 border-b px-2 py-1">
        <button
          type="button"
          aria-label="Bold"
          className={`${buttonBase} ${editor.isActive("bold") ? activeClass : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBold().run();
          }}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Italic"
          className={`${buttonBase} ${editor.isActive("italic") ? activeClass : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleItalic().run();
          }}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <button
          type="button"
          aria-label="Bullet list"
          className={`${buttonBase} ${editor.isActive("bulletList") ? activeClass : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBulletList().run();
          }}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          className={`${buttonBase} ${editor.isActive("orderedList") ? activeClass : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleOrderedList().run();
          }}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
