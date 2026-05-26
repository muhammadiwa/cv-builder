"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import type { SectionType } from "@/types/resume";

const addableSections: { type: SectionType; label: string }[] = [
  { type: "header", label: "Header" },
  { type: "summary", label: "Summary" },
  { type: "experience", label: "Experience" },
  { type: "education", label: "Education" },
  { type: "skills", label: "Skills" },
  { type: "certifications", label: "Certifications" },
  { type: "projects", label: "Projects" },
  { type: "languages", label: "Languages" },
  { type: "achievements", label: "Achievements" },
];

// NOTE: Undo / Redo controls intentionally omitted until a history stack is
// wired into the editor store (zundo or equivalent). Showing inert buttons is
// worse than not showing them — the AC-aligned shortcut here is the toolbar's
// "Add Section" affordance plus per-section move arrows.
export default function EditorToolbar() {
  const addSection = useEditorStore((s) => s.addSection);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border bg-background hover:bg-muted transition-colors"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <PlusCircle className="h-4 w-4" />
        Add Section
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute top-full left-0 z-20 mt-1 w-48 rounded-md border bg-popover shadow-md py-1"
            role="menu"
          >
            {addableSections.map((s) => (
              <button
                key={s.type}
                type="button"
                role="menuitem"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                onClick={() => {
                  addSection(s.type);
                  setOpen(false);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
