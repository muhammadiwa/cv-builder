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
import { RichTextField } from "./RichTextField";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass = `${inputClass} resize-y min-h-[80px]`;

// Approximation of a soft spring with CSS easing (Material's "standard" curve).
// Keeps the AC-4 200ms duration but feels less linear than `ease`.
const REORDER_TRANSITION = "transform 200ms cubic-bezier(0.4, 0.0, 0.2, 1)";

export function SectionBlock({ node }: ReactNodeViewProps) {
  const attrs = node.attrs as {
    sectionId: string;
    sectionType: SectionType;
    visible: boolean;
    displayOrder: number;
  };
  const { sectionId, sectionType } = attrs;

  const section = useEditorStore((s) =>
    s.sections.find((sec) => sec.id === sectionId),
  );
  const sectionsLength = useEditorStore((s) => s.sections.length);
  const updateSectionField = useEditorStore((s) => s.updateSectionField);
  const toggleSectionVisibility = useEditorStore(
    (s) => s.toggleSectionVisibility,
  );
  const moveSectionUp = useEditorStore((s) => s.moveSectionUp);
  const moveSectionDown = useEditorStore((s) => s.moveSectionDown);

  const [editing, setEditing] = useState(false);

  const currentIndex = useEditorStore((s) =>
    s.sections.findIndex((sec) => sec.id === sectionId),
  );
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex < 0 || currentIndex >= sectionsLength - 1;

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
    transition: transition ?? REORDER_TRANSITION,
    opacity: isDragging ? 0.5 : undefined,
  };

  // The store update is the source of truth, but we always read it through
  // `updateSectionField` (which merges atomically) — so two rapid edits to
  // different fields can't clobber each other through stale closure.
  const handleFieldChange = useCallback(
    (field: string, value: unknown) => {
      updateSectionField(sectionId, field, value);
    },
    [sectionId, updateSectionField],
  );

  const sectionLabel = sectionTypeLabels[sectionType] ?? sectionType;

  if (!section) {
    // Section row was removed locally but the ProseMirror doc hasn't caught
    // up yet. Render an inert wrapper to keep the dnd-kit/Tiptap contracts
    // happy until the next setContent reconciles.
    return (
      <NodeViewWrapper as="div" className="hidden" data-section-block="" />
    );
  }

  const { content, visible } = section;

  // The whole section header opens/closes the editor. The drag handle and the
  // icon buttons stop propagation so they keep their own behaviour.
  const handleHeaderClick = () => setEditing((e) => !e);

  return (
    <NodeViewWrapper
      as="div"
      className="group relative mb-4"
      data-section-block=""
    >
      <div ref={setNodeRef} style={style}>
        <div
          className={`rounded-lg border bg-card transition-colors ${
            visible ? "" : "opacity-50"
          }`}
        >
          {/* Section header bar — clickable surface to toggle edit mode */}
          <div
            className="flex items-center gap-2 px-3 py-2 border-b cursor-pointer select-none"
            onClick={handleHeaderClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleHeaderClick();
              }
            }}
            aria-expanded={editing}
            aria-label={`${editing ? "Close" : "Open"} ${sectionLabel} editor`}
          >
            {/* Drag handle — desktop only. Mobile uses Move Up/Down arrows. */}
            <button
              type="button"
              {...listeners}
              {...attributes}
              onClick={(e) => e.stopPropagation()}
              className="cursor-grab active:cursor-grabbing shrink-0 p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 hidden md:inline-flex transition-opacity duration-200"
              style={{ touchAction: "none", minWidth: 44, minHeight: 44 }}
              aria-label={`Drag ${sectionLabel}`}
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>

            <span className="flex-1 text-sm font-medium capitalize">
              {sectionLabel}
            </span>

            {/* Mobile: Move Up / Move Down (replaces drag-and-drop on small screens) */}
            <div className="md:hidden flex items-center gap-0.5">
              <button
                type="button"
                disabled={isFirst}
                onClick={(e) => {
                  e.stopPropagation();
                  moveSectionUp(currentIndex);
                }}
                className="shrink-0 p-1 rounded hover:bg-muted disabled:opacity-30"
                aria-label="Move up"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={isLast}
                onClick={(e) => {
                  e.stopPropagation();
                  moveSectionDown(currentIndex);
                }}
                className="shrink-0 p-1 rounded hover:bg-muted disabled:opacity-30"
                aria-label="Move down"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            {/* Visibility toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleSectionVisibility(sectionId);
              }}
              className="shrink-0 p-1 rounded hover:bg-muted"
              aria-label={visible ? `Hide ${sectionLabel}` : `Show ${sectionLabel}`}
            >
              {visible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>

            {/* Edit chevron — visual affordance, not the only way to toggle */}
            <span className="shrink-0 p-1 rounded">
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${editing ? "rotate-180" : ""}`}
              />
            </span>
          </div>

          {/* Content area — also clickable to enter edit mode when collapsed */}
          <div
            className={`px-4 py-3 ${editing ? "" : "cursor-pointer"}`}
            onClick={editing ? undefined : handleHeaderClick}
          >
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

function asString(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // Anything else (object/array) is unexpected — render as fallback rather
  // than `[object Object]` to keep the preview readable.
  return fallback;
}

function HtmlPreview({ html, fallback }: { html: string; fallback: string }) {
  const safe = (html ?? "").trim();
  if (!safe) {
    return <p className="text-sm text-muted-foreground">{fallback}</p>;
  }
  // Content originates from the user's own RichTextField (TipTap-emitted
  // HTML). Sanitization layer is owned by the export pipeline; in the editor
  // surface we render the user's own input back to them.
  return (
    <div
      className="prose prose-sm max-w-none text-sm"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

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
          <p className="text-xl font-bold">{asString(content.name, "Your Name")}</p>
          <p className="text-muted-foreground">
            {asString(content.title, "Job Title")}
          </p>
          {asString(content.email) ? (
            <p className="text-sm">{asString(content.email)}</p>
          ) : null}
          {asString(content.phone) ? (
            <p className="text-sm">{asString(content.phone)}</p>
          ) : null}
        </div>
      );
    case "summary":
      return (
        <HtmlPreview
          html={asString(content.summary)}
          fallback="Click to add a professional summary."
        />
      );
    case "experience":
      return (
        <div>
          <p className="font-medium">{asString(content.company, "Company")}</p>
          <p className="text-sm">{asString(content.role, "Role")}</p>
          <p className="text-xs text-muted-foreground">
            {asString(content.startDate)}
            {asString(content.startDate) && asString(content.endDate) ? " — " : ""}
            {asString(content.endDate)}
          </p>
          {asString(content.description) ? (
            <div className="mt-1">
              <HtmlPreview html={asString(content.description)} fallback="" />
            </div>
          ) : null}
        </div>
      );
    case "education":
      return (
        <div>
          <p className="font-medium">
            {asString(content.institution, "Institution")}
          </p>
          <p className="text-sm">{asString(content.degree, "Degree")}</p>
        </div>
      );
    case "skills":
      return (
        <p className="text-sm text-muted-foreground">
          {asString(content.skills, "Click to add skills.")}
        </p>
      );
    case "certifications":
      return (
        <div>
          <p className="font-medium">{asString(content.name, "Certification")}</p>
          {asString(content.issuer) ? (
            <p className="text-sm text-muted-foreground">
              {asString(content.issuer)}
            </p>
          ) : null}
        </div>
      );
    case "projects":
      return (
        <div>
          <p className="font-medium">{asString(content.name, "Project")}</p>
          {asString(content.description) ? (
            <p className="text-sm text-muted-foreground">
              {asString(content.description)}
            </p>
          ) : null}
        </div>
      );
    case "languages":
      return (
        <p className="text-sm text-muted-foreground">
          {asString(content.languages, "Click to add languages.")}
        </p>
      );
    case "achievements":
      return (
        <div>
          <p className="font-medium">{asString(content.title, "Achievement")}</p>
          {asString(content.description) ? (
            <p className="text-sm text-muted-foreground">
              {asString(content.description)}
            </p>
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
  onChange: (field: string, value: unknown) => void;
}) {
  const val = (key: string) => asString(content[key]);

  switch (sectionType) {
    case "header":
      return (
        <div className="space-y-2">
          <input
            value={val("name")}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Full Name"
            className={inputClass}
          />
          <input
            value={val("title")}
            onChange={(e) => onChange("title", e.target.value)}
            placeholder="Job Title"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={val("email")}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="Email"
              type="email"
              className={inputClass}
            />
            <input
              value={val("phone")}
              onChange={(e) => onChange("phone", e.target.value)}
              placeholder="Phone"
              type="tel"
              className={inputClass}
            />
          </div>
          <input
            value={val("location")}
            onChange={(e) => onChange("location", e.target.value)}
            placeholder="Location"
            className={inputClass}
          />
          <input
            value={val("website")}
            onChange={(e) => onChange("website", e.target.value)}
            placeholder="LinkedIn / Website"
            className={inputClass}
          />
        </div>
      );
    case "summary":
      return (
        <RichTextField
          value={val("summary")}
          placeholder="Write a professional summary…"
          onChange={(html) => onChange("summary", html)}
        />
      );
    case "experience":
      return (
        <div className="space-y-2">
          <input
            value={val("company")}
            onChange={(e) => onChange("company", e.target.value)}
            placeholder="Company"
            className={inputClass}
          />
          <input
            value={val("role")}
            onChange={(e) => onChange("role", e.target.value)}
            placeholder="Role / Position"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={val("startDate")}
              onChange={(e) => onChange("startDate", e.target.value)}
              placeholder="Start Date"
              type="date"
              className={inputClass}
            />
            <input
              value={val("endDate")}
              onChange={(e) => onChange("endDate", e.target.value)}
              placeholder="End Date"
              type="date"
              className={inputClass}
            />
          </div>
          <input
            value={val("location")}
            onChange={(e) => onChange("location", e.target.value)}
            placeholder="Location"
            className={inputClass}
          />
          <RichTextField
            value={val("description")}
            placeholder="Responsibilities and achievements…"
            onChange={(html) => onChange("description", html)}
          />
        </div>
      );
    case "education":
      return (
        <div className="space-y-2">
          <input
            value={val("institution")}
            onChange={(e) => onChange("institution", e.target.value)}
            placeholder="Institution"
            className={inputClass}
          />
          <input
            value={val("degree")}
            onChange={(e) => onChange("degree", e.target.value)}
            placeholder="Degree"
            className={inputClass}
          />
          <input
            value={val("field")}
            onChange={(e) => onChange("field", e.target.value)}
            placeholder="Field of Study"
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={val("startDate")}
              onChange={(e) => onChange("startDate", e.target.value)}
              placeholder="Start Date"
              type="date"
              className={inputClass}
            />
            <input
              value={val("endDate")}
              onChange={(e) => onChange("endDate", e.target.value)}
              placeholder="End Date"
              type="date"
              className={inputClass}
            />
          </div>
          <input
            value={val("gpa")}
            onChange={(e) => onChange("gpa", e.target.value)}
            placeholder="GPA"
            className={inputClass}
          />
        </div>
      );
    case "skills":
      return (
        <textarea
          value={val("skills")}
          onChange={(e) => onChange("skills", e.target.value)}
          placeholder="Skills separated by commas..."
          className={textareaClass}
          rows={3}
        />
      );
    case "certifications":
      return (
        <div className="space-y-2">
          <input
            value={val("name")}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Certification Name"
            className={inputClass}
          />
          <input
            value={val("issuer")}
            onChange={(e) => onChange("issuer", e.target.value)}
            placeholder="Issuer"
            className={inputClass}
          />
          <input
            value={val("date")}
            onChange={(e) => onChange("date", e.target.value)}
            placeholder="Date"
            type="date"
            className={inputClass}
          />
          <input
            value={val("url")}
            onChange={(e) => onChange("url", e.target.value)}
            placeholder="Credential URL"
            className={inputClass}
          />
        </div>
      );
    case "projects":
      return (
        <div className="space-y-2">
          <input
            value={val("name")}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Project Name"
            className={inputClass}
          />
          <input
            value={val("url")}
            onChange={(e) => onChange("url", e.target.value)}
            placeholder="Project URL"
            className={inputClass}
          />
          <input
            value={val("technologies")}
            onChange={(e) => onChange("technologies", e.target.value)}
            placeholder="Technologies"
            className={inputClass}
          />
          <textarea
            value={val("description")}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="Description..."
            className={textareaClass}
            rows={3}
          />
        </div>
      );
    case "languages":
      return (
        <textarea
          value={val("languages")}
          onChange={(e) => onChange("languages", e.target.value)}
          placeholder="e.g., English (Fluent), Indonesian (Native)..."
          className={textareaClass}
          rows={3}
        />
      );
    case "achievements":
      return (
        <div className="space-y-2">
          <input
            value={val("title")}
            onChange={(e) => onChange("title", e.target.value)}
            placeholder="Achievement Title"
            className={inputClass}
          />
          <input
            value={val("date")}
            onChange={(e) => onChange("date", e.target.value)}
            placeholder="Date"
            type="date"
            className={inputClass}
          />
          <textarea
            value={val("description")}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="Description..."
            className={textareaClass}
            rows={3}
          />
        </div>
      );
    default:
      return null;
  }
}
