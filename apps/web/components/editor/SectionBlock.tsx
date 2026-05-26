"use client";

import { useCallback, useState } from "react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Eye,
  EyeOff,
  ChevronDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import type { SectionType } from "@/types/resume";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = `${inputClass} resize-y min-h-[80px]`;

export function SectionBlock({ node }: ReactNodeViewProps) {
  const attrs = node.attrs as { sectionId: string; sectionType: SectionType; visible: boolean; displayOrder: number };
  const { sectionId, sectionType, visible } = attrs;
  const section = useEditorStore((s) => s.sections.find((sec) => sec.id === sectionId));
  const sections = useEditorStore((s) => s.sections);
  const updateSectionContent = useEditorStore((s) => s.updateSectionContent);
  const toggleSectionVisibility = useEditorStore((s) => s.toggleSectionVisibility);
  const moveSectionUp = useEditorStore((s) => s.moveSectionUp);
  const moveSectionDown = useEditorStore((s) => s.moveSectionDown);
  const removeSection = useEditorStore((s) => s.removeSection);

  const [editing, setEditing] = useState(false);

  const currentIndex = sections.findIndex((s) => s.id === sectionId);
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= sections.length - 1;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 200ms ease",
    opacity: isDragging ? 0.5 : undefined,
  };

  const content = section?.content ?? {};

  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      updateSectionContent(sectionId, { ...content, [field]: value });
    },
    [sectionId, content, updateSectionContent],
  );

  const sectionLabel = sectionTypeLabels[sectionType] ?? sectionType;

  if (!section) return null;

  return (
    <NodeViewWrapper as="div" className="group relative mb-4" data-section-block="">
      <div ref={setNodeRef} style={style}>
        <div
          className={`rounded-lg border bg-card transition-colors ${
            visible ? "" : "opacity-50"
          }`}
        >
          {/* Section header bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            {/* Drag handle — desktop hover, mobile always */}
            <button
              type="button"
              {...listeners}
              {...attributes}
              className="cursor-grab active:cursor-grabbing shrink-0 p-1 rounded hover:bg-muted
                         opacity-0 group-hover:opacity-100 md:block hidden transition-[opacity,transform] duration-200"
              style={{ touchAction: "none", minWidth: 44, minHeight: 44 }}
              aria-label={`Drag ${sectionLabel}`}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>

            <button
              type="button"
              {...listeners}
              {...attributes}
              className="cursor-grab active:cursor-grabbing shrink-0 p-1 rounded hover:bg-muted md:hidden"
              style={{ touchAction: "none", minWidth: 44, minHeight: 44 }}
              aria-label={`Drag ${sectionLabel}`}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>

            <span className="flex-1 text-sm font-medium capitalize">{sectionLabel}</span>

            {/* Mobile: Move Up / Move Down */}
            <div className="md:hidden flex items-center gap-0.5">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => moveSectionUp(currentIndex)}
                className="shrink-0 p-1 rounded hover:bg-muted disabled:opacity-30"
                aria-label="Move up"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={isLast}
                onClick={() => moveSectionDown(currentIndex)}
                className="shrink-0 p-1 rounded hover:bg-muted disabled:opacity-30"
                aria-label="Move down"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            {/* Visibility toggle */}
            <button
              type="button"
              onClick={() => toggleSectionVisibility(sectionId)}
              className="shrink-0 p-1 rounded hover:bg-muted"
              aria-label={visible ? `Hide ${sectionLabel}` : `Show ${sectionLabel}`}
            >
              {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>

            {/* Edit toggle */}
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="shrink-0 p-1 rounded hover:bg-muted"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${editing ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {/* Content area */}
          <div className="px-4 py-3">
            {editing ? (
              <SectionEditor
                sectionType={sectionType}
                content={content}
                onChange={handleFieldChange}
              />
            ) : (
              <SectionPreview sectionType={sectionType} content={content} />
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

const sectionTypeLabels: Record<SectionType, string> = {
  header: "Header",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  certifications: "Certifications",
  projects: "Projects",
  languages: "Languages",
  achievements: "Achievements",
};

// ---------- Preview ----------

function SectionPreview({
  sectionType,
  content,
}: {
  sectionType: SectionType;
  content: Record<string, unknown>;
}) {
  switch (sectionType) {
    case "header":
      return (
        <div>
          <p className="text-xl font-bold">{String(content.name ?? "Your Name")}</p>
          <p className="text-muted-foreground">{String(content.title ?? "Job Title")}</p>
          {content.email ? <p className="text-sm">{String(content.email)}</p> : null}
          {content.phone ? <p className="text-sm">{String(content.phone)}</p> : null}
        </div>
      );
    case "summary":
      return (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {String(content.summary ?? "Click edit to add a professional summary.")}
        </p>
      );
    case "experience":
      return (
        <div>
          <p className="font-medium">{String(content.company ?? "Company")}</p>
          <p className="text-sm">{String(content.role ?? "Role")}</p>
          <p className="text-xs text-muted-foreground">
            {content.startDate ? String(content.startDate) : ""}
            {content.startDate && content.endDate ? " — " : ""}
            {content.endDate ? String(content.endDate) : ""}
          </p>
        </div>
      );
    case "education":
      return (
        <div>
          <p className="font-medium">{String(content.institution ?? "Institution")}</p>
          <p className="text-sm">{String(content.degree ?? "Degree")}</p>
        </div>
      );
    case "skills":
      return (
        <p className="text-sm text-muted-foreground">
          {String(content.skills ?? "Click edit to add skills.")}
        </p>
      );
    case "certifications":
      return (
        <div>
          <p className="font-medium">{String(content.name ?? "Certification")}</p>
          {content.issuer ? (
            <p className="text-sm text-muted-foreground">{String(content.issuer)}</p>
          ) : null}
        </div>
      );
    case "projects":
      return (
        <div>
          <p className="font-medium">{String(content.name ?? "Project")}</p>
          {content.description ? (
            <p className="text-sm text-muted-foreground">{String(content.description)}</p>
          ) : null}
        </div>
      );
    case "languages":
      return (
        <p className="text-sm text-muted-foreground">
          {String(content.languages ?? "Click edit to add languages.")}
        </p>
      );
    case "achievements":
      return (
        <div>
          <p className="font-medium">{String(content.title ?? "Achievement")}</p>
          {content.description ? (
            <p className="text-sm text-muted-foreground">{String(content.description)}</p>
          ) : null}
        </div>
      );
    default:
      return <p className="text-sm text-muted-foreground">Unknown section type</p>;
  }
}

// ---------- Editor ----------

function SectionEditor({
  sectionType,
  content,
  onChange,
}: {
  sectionType: SectionType;
  content: Record<string, unknown>;
  onChange: (field: string, value: string) => void;
}) {
  const val = (key: string) => String(content[key] ?? "");

  switch (sectionType) {
    case "header":
      return (
        <div className="space-y-2">
          <input value={val("name")} onChange={(e) => onChange("name", e.target.value)} placeholder="Full Name" className={inputClass} />
          <input value={val("title")} onChange={(e) => onChange("title", e.target.value)} placeholder="Job Title" className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <input value={val("email")} onChange={(e) => onChange("email", e.target.value)} placeholder="Email" type="email" className={inputClass} />
            <input value={val("phone")} onChange={(e) => onChange("phone", e.target.value)} placeholder="Phone" type="tel" className={inputClass} />
          </div>
          <input value={val("location")} onChange={(e) => onChange("location", e.target.value)} placeholder="Location" className={inputClass} />
          <input value={val("website")} onChange={(e) => onChange("website", e.target.value)} placeholder="LinkedIn / Website" className={inputClass} />
        </div>
      );
    case "summary":
      return (
        <textarea value={val("summary")} onChange={(e) => onChange("summary", e.target.value)} placeholder="Write a professional summary..." className={textareaClass} rows={4} />
      );
    case "experience":
      return (
        <div className="space-y-2">
          <input value={val("company")} onChange={(e) => onChange("company", e.target.value)} placeholder="Company" className={inputClass} />
          <input value={val("role")} onChange={(e) => onChange("role", e.target.value)} placeholder="Role / Position" className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <input value={val("startDate")} onChange={(e) => onChange("startDate", e.target.value)} placeholder="Start Date" type="date" className={inputClass} />
            <input value={val("endDate")} onChange={(e) => onChange("endDate", e.target.value)} placeholder="End Date" type="date" className={inputClass} />
          </div>
          <input value={val("location")} onChange={(e) => onChange("location", e.target.value)} placeholder="Location" className={inputClass} />
          <textarea value={val("description")} onChange={(e) => onChange("description", e.target.value)} placeholder="Responsibilities and achievements..." className={textareaClass} rows={3} />
        </div>
      );
    case "education":
      return (
        <div className="space-y-2">
          <input value={val("institution")} onChange={(e) => onChange("institution", e.target.value)} placeholder="Institution" className={inputClass} />
          <input value={val("degree")} onChange={(e) => onChange("degree", e.target.value)} placeholder="Degree" className={inputClass} />
          <input value={val("field")} onChange={(e) => onChange("field", e.target.value)} placeholder="Field of Study" className={inputClass} />
          <div className="grid grid-cols-2 gap-2">
            <input value={val("startDate")} onChange={(e) => onChange("startDate", e.target.value)} placeholder="Start Date" type="date" className={inputClass} />
            <input value={val("endDate")} onChange={(e) => onChange("endDate", e.target.value)} placeholder="End Date" type="date" className={inputClass} />
          </div>
          <input value={val("gpa")} onChange={(e) => onChange("gpa", e.target.value)} placeholder="GPA" className={inputClass} />
        </div>
      );
    case "skills":
      return (
        <textarea value={val("skills")} onChange={(e) => onChange("skills", e.target.value)} placeholder="Skills separated by commas..." className={textareaClass} rows={3} />
      );
    case "certifications":
      return (
        <div className="space-y-2">
          <input value={val("name")} onChange={(e) => onChange("name", e.target.value)} placeholder="Certification Name" className={inputClass} />
          <input value={val("issuer")} onChange={(e) => onChange("issuer", e.target.value)} placeholder="Issuer" className={inputClass} />
          <input value={val("date")} onChange={(e) => onChange("date", e.target.value)} placeholder="Date" type="date" className={inputClass} />
          <input value={val("url")} onChange={(e) => onChange("url", e.target.value)} placeholder="Credential URL" className={inputClass} />
        </div>
      );
    case "projects":
      return (
        <div className="space-y-2">
          <input value={val("name")} onChange={(e) => onChange("name", e.target.value)} placeholder="Project Name" className={inputClass} />
          <input value={val("url")} onChange={(e) => onChange("url", e.target.value)} placeholder="Project URL" className={inputClass} />
          <input value={val("technologies")} onChange={(e) => onChange("technologies", e.target.value)} placeholder="Technologies" className={inputClass} />
          <textarea value={val("description")} onChange={(e) => onChange("description", e.target.value)} placeholder="Description..." className={textareaClass} rows={3} />
        </div>
      );
    case "languages":
      return (
        <textarea value={val("languages")} onChange={(e) => onChange("languages", e.target.value)} placeholder="e.g., English (Fluent), Indonesian (Native)..." className={textareaClass} rows={3} />
      );
    case "achievements":
      return (
        <div className="space-y-2">
          <input value={val("title")} onChange={(e) => onChange("title", e.target.value)} placeholder="Achievement Title" className={inputClass} />
          <input value={val("date")} onChange={(e) => onChange("date", e.target.value)} placeholder="Date" type="date" className={inputClass} />
          <textarea value={val("description")} onChange={(e) => onChange("description", e.target.value)} placeholder="Description..." className={textareaClass} rows={3} />
        </div>
      );
    default:
      return null;
  }
}
