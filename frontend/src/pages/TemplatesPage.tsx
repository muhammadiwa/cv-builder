/**
 * TemplatesPage — Phase 10A.
 *
 * Replaces the placeholder. Surfaces the full template CRUD surface:
 *   - Card grid: list of templates with **schematic thumbnail** showing
 *     font + accent color + density + section order + page size.
 *   - Create modal: form for new custom template (with live preview iframe)
 *   - Detail/Edit modal: view + edit user-created templates
 *   - Duplicate button on each card
 *   - Delete button on user-created templates
 *
 * Built-in presets (ats_classic, ats_modern, ats_compact) are read-only.
 *
 * Why the thumbnail?  Before this change every card showed a flat
 * name + description and the three built-in presets looked identical.
 * The schematic mini-preview makes font family, accent color, density,
 * page size, AND section order immediately visible — users can pick
 * a template without opening the editor. Visual differentiation IS
 * the product value of templates.
 */
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Copy,
  FileText,
  LayoutTemplate,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import type {
  Template,
  TemplateConfigJson,
  TemplateSummary,
} from '../lib/api';
import { templatesApi } from '../lib/api';
import { toast } from '../lib/toast';
import PageHeader from '../components/PageHeader';
import TemplateThumbnail from '../components/templates/TemplateThumbnail';

// Built-in preset IDs (read-only). Includes all 10 presets shipped by
// cv_renderer.BUILTIN_PRESETS so the FE groups them correctly under
// "Built-in presets" rather than "Your templates".
const PRESET_IDS = new Set([
  'ats_classic',
  'ats_modern',
  'ats_compact',
  'ats_minimal',
  'ats_executive',
  'ats_timeline',
  'ats_academic',
  'ats_tech',
  'ats_european',
  'ats_consulting',
  // Phase 10C decoration presets
  'ats_bold',
  'ats_editorial',
  'ats_sidebar',
  'ats_tech_sidebar',
  'ats_mono',
  'ats_startup',
]);

const COLOR_OPTIONS = [
  { value: '#111111', label: 'Default' },
  { value: '#1f2937', label: 'Slate 800' },
  { value: '#0f172a', label: 'Slate 900' },
  { value: '#111827', label: 'Gray 900' },
  { value: '#334155', label: 'Slate 700' },
  { value: '#475569', label: 'Slate 600' },
  // Phase 10C: subtle accent colors (navy, teal, burgundy, etc.) —
  // all ATS-safe per the BE palette.
  { value: '#1e3a8a', label: 'Navy' },
  { value: '#1e40af', label: 'Royal blue' },
  { value: '#075985', label: 'Sky' },
  { value: '#0f766e', label: 'Teal' },
  { value: '#166534', label: 'Forest' },
  { value: '#7c2d12', label: 'Burnt orange' },
  { value: '#7f1d1d', label: 'Burgundy' },
  { value: '#581c87', label: 'Plum' },
  { value: '#3730a3', label: 'Indigo' },
  { value: '#4b5563', label: 'Charcoal' },
  { value: '#3f3f46', label: 'Warm gray' },
];

const SECTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'summary', label: 'Summary' },
  { value: 'experience', label: 'Experience' },
  { value: 'skills', label: 'Skills' },
  { value: 'projects', label: 'Projects' },
  { value: 'education', label: 'Education' },
];

export default function TemplatesPage() {
  const qc = useQueryClient();
  const {
    data: templates,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.list('cv'),
  });

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted');
    },
    onError: (e: unknown) => {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message ||
        'Failed to delete template';
      toast.error(detail);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ src, dst }: { src: string; dst: string }) =>
      templatesApi.duplicate(src, dst),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success(`Duplicated as "${t.name}"`);
    },
    onError: (e: unknown) => {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message ||
        'Failed to duplicate template';
      toast.error(detail);
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading templates…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-rose-700">
        Failed to load templates: {(error as Error).message}
      </div>
    );
  }

  const builtins = templates?.filter((t) => PRESET_IDS.has(t.id)) ?? [];
  const userTemplates = templates?.filter((t) => !PRESET_IDS.has(t.id)) ?? [];

  return (
    <div className="space-y-6 lg:space-y-8" data-testid="templates-page">
      <PageHeader
        icon={LayoutTemplate}
        title="Templates"
        subtitle="ATS-safe CV and cover letter templates. All single-column, no graphics, selectable text."
        actions={
          <button
            onClick={() => setCreating(true)}
            className="btn-primary text-[13px]"
            data-testid="new-template-btn"
          >
            <Plus className="w-4 h-4 mr-1.5" /> New template
          </button>
        }
      />

      {/* ── Built-in presets ────────────────────────────────────── */}
      <Section title="Built-in presets" count={builtins.length}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-6">
          {builtins.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onPreview={() => setPreviewingId(t.id)}
              onDuplicate={() =>
                duplicateMutation.mutate({
                  src: t.id,
                  dst: `${t.id}_copy_${Date.now().toString(36)}`,
                })
              }
              duplicating={duplicateMutation.isPending}
            />
          ))}
        </div>
      </Section>

      {/* ── User-created templates ──────────────────────────────── */}
      <Section title="Your templates" count={userTemplates.length}>
        {userTemplates.length === 0 ? (
          <div className="text-sm text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded p-6 text-center">
            No custom templates yet. Click "New template" above, or
            duplicate a built-in preset to start customizing.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-6">
            {userTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onPreview={() => setPreviewingId(t.id)}
                onEdit={() => setEditingId(t.id)}
                onDuplicate={() =>
                  duplicateMutation.mutate({
                    src: t.id,
                    dst: `${t.id}_copy_${Date.now().toString(36)}`,
                  })
                }
                onDelete={() => {
                  if (confirm(`Delete template "${t.name}"?`)) {
                    deleteMutation.mutate(t.id);
                  }
                }}
                deleting={deleteMutation.isPending}
                duplicating={duplicateMutation.isPending}
              />
            ))}
          </div>
        )}
      </Section>

      {creating && (
        <TemplateFormModal
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['templates'] });
            toast.success('Template created');
          }}
        />
      )}
      {editingId && (
        <TemplateFormModal
          mode="edit"
          templateId={editingId}
          onClose={() => setEditingId(null)}
          onSaved={() => {
            setEditingId(null);
            qc.invalidateQueries({ queryKey: ['templates'] });
            toast.success('Template updated');
          }}
        />
      )}
      {previewingId && (
        <TemplatePreviewModal
          templateId={previewingId}
          onClose={() => setPreviewingId(null)}
        />
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────
function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-[13px] font-semibold text-slate-700 uppercase tracking-wide">
          {title}
        </h2>
        <span className="text-xs text-slate-500 tabular-nums">({count})</span>
      </div>
      {children}
    </section>
  );
}

// Pill component for visual metadata (font / density / page size).
function MetaPill({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600 tabular-nums',
        className
      )}
    >
      {label}
    </span>
  );
}

// Map config values to short human labels used in card metadata pills.
const FONT_LABEL: Record<string, string> = {
  serif: 'Serif',
  sans: 'Sans',
  mono: 'Mono',
};
const DENSITY_LABEL: Record<string, string> = {
  compact: 'Compact',
  normal: 'Normal',
  spacious: 'Spacious',
};
const SECTION_LABELS: Record<string, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
};

function TemplateCard({
  template,
  onPreview,
  onEdit,
  onDuplicate,
  onDelete,
  deleting,
  duplicating,
}: {
  template: TemplateSummary;
  onPreview: () => void;
  onEdit?: () => void;
  onDuplicate: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  duplicating?: boolean;
}) {
  // Defensive: if the BE ever sends a template without config (legacy
  // rows), fall back to safe defaults so the card still renders.
  const cfg: TemplateConfigJson = template.template_config_json ?? {
    id: template.id,
    name: template.name,
    type: template.type,
    sections: ['summary', 'experience', 'education', 'skills', 'projects'],
    font_family: 'sans',
    accent_color: '#111111',
    density: 'normal',
    bullet_style: 'dash',
    date_format: 'Mon YYYY',
    page_size: 'A4',
    ats_friendly: template.is_ats_friendly,
    description: template.description,
  };
  const sections = cfg.sections?.length ? cfg.sections : [];
  return (
    <div
      className="group flex flex-col border border-slate-200 rounded-xl bg-white overflow-hidden hover:border-slate-300 hover:shadow-md transition-[box-shadow,border-color] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100"
      data-testid={`template-card-${template.id}`}
    >
      {/* ── Thumbnail ───────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 px-5 py-5 border-b border-slate-200">
        {/* Page-size badge overlay — sits above the gradient wrapper so it
            stays readable regardless of the thumbnail's aspect ratio. */}
        <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-semibold uppercase tracking-wider text-slate-700 bg-white/90 border border-slate-300 rounded px-2 py-0.5 tabular-nums shadow-sm">
          {cfg.page_size}
        </span>
        <TemplateThumbnail config={cfg} className="h-40" />
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900 text-[15px] leading-tight truncate">
            {template.name}
          </h3>
          {template.is_default && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded font-semibold flex-shrink-0">
              default
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[2.25rem]">
          {template.description}
        </p>

        {/* Visual metadata pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <MetaPill label={FONT_LABEL[cfg.font_family] ?? 'Sans'} />
          <MetaPill label={DENSITY_LABEL[cfg.density] ?? 'Normal'} />
          <MetaPill label={cfg.date_format} />
          {template.is_ats_friendly && (
            <MetaPill
              label="ATS-safe"
              className="bg-green-50 border-green-200 text-green-700"
            />
          )}
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600"
            title={`Accent color ${cfg.accent_color}`}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm border border-slate-300"
              style={{ backgroundColor: cfg.accent_color }}
            />
            Accent
          </span>
          {/* Phase 10C: visual flavor pills — sidebar, name typo, heading rule */}
          {cfg.sidebar_layout && (
            <MetaPill
              label="Sidebar"
              className="bg-violet-50 border-violet-200 text-violet-700"
            />
          )}
          {cfg.name_typography && cfg.name_typography !== 'regular' && (
            <MetaPill
              label={
                cfg.name_typography === 'display'
                  ? 'Display'
                  : 'Letter-spaced'
              }
              className="bg-blue-50 border-blue-200 text-blue-700"
            />
          )}
          {cfg.heading_rule && cfg.heading_rule !== 'bar' && (
            <MetaPill
              label={
                cfg.heading_rule === 'thick'
                  ? 'Thick bar'
                  : cfg.heading_rule === 'double'
                  ? 'Double rule'
                  : cfg.heading_rule === 'underline'
                  ? 'Underline'
                  : 'Plain'
              }
              className="bg-amber-50 border-amber-200 text-amber-700"
            />
          )}
        </div>

        {/* Section order flow — the actual structural differentiator */}
        <div className="flex items-center gap-1 text-[10px] text-slate-500 flex-wrap min-h-[1.25rem]">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            Order:
          </span>
          {sections.map((s, i) => (
            <span key={`${s}-${i}`} className="inline-flex items-center gap-1">
              <span className="text-slate-700 font-medium">
                {SECTION_LABELS[s] ?? s}
              </span>
              {i < sections.length - 1 && (
                <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
              )}
            </span>
          ))}
        </div>
      </div>

      {/* ── Action footer ──────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2.5 border-t border-slate-100 bg-slate-50/60">
        <button
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white hover:border-slate-200 rounded border border-transparent transition-colors"
          data-testid={`preview-${template.id}`}
        >
          <FileText className="w-3.5 h-3.5" /> Preview
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white hover:border-slate-200 rounded border border-transparent transition-colors"
            data-testid={`edit-${template.id}`}
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        )}
        <button
          onClick={onDuplicate}
          disabled={duplicating}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-white hover:border-slate-200 rounded border border-transparent transition-colors disabled:opacity-50 disabled:pointer-events-none"
          data-testid={`duplicate-${template.id}`}
        >
          <Copy className="w-3.5 h-3.5" /> Duplicate
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded border border-transparent transition-colors disabled:opacity-50 disabled:pointer-events-none ml-auto"
            data-testid={`delete-${template.id}`}
            aria-label="Delete template"
            title="Delete template"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Form modal (create + edit) ─────────────────────────────────────
function TemplateFormModal({
  mode,
  templateId,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  templateId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<string[]>([
    'summary',
    'experience',
    'education',
    'skills',
    'projects',
  ]);
  const [fontFamily, setFontFamily] = useState<
    'serif' | 'sans' | 'mono'
  >('sans');
  const [accentColor, setAccentColor] = useState('#111111');
  const [density, setDensity] = useState<'compact' | 'normal' | 'spacious'>(
    'normal'
  );
  const [bulletStyle, setBulletStyle] = useState<'dash' | 'bullet' | 'arrow'>(
    'dash'
  );
  const [dateFormat, setDateFormat] = useState<'Mon YYYY' | 'MM/YYYY' | 'YYYY'>(
    'Mon YYYY'
  );
  const [pageSize, setPageSize] = useState<'A4' | 'Letter'>('A4');
  // Phase 10B: four structural axes that drive layout (not just typography).
  const [headerStyle, setHeaderStyle] = useState<'stacked' | 'inline' | 'banner'>(
    'stacked'
  );
  const [sectionHeadingStyle, setSectionHeadingStyle] = useState<
    'bar' | 'underline' | 'plain' | 'numbered'
  >('bar');
  const [experienceLayout, setExperienceLayout] = useState<
    'standard' | 'dates_right' | 'inline_dates' | 'compact'
  >('standard');
  const [skillsLayout, setSkillsLayout] = useState<
    'comma' | 'pipe' | 'categorized' | 'pills' | 'proficiency' | 'chips'
  >('comma');
  // Phase 10C: three decoration axes — heading rule decoration, name
  // typography, and sidebar layout. All default to safe legacy values
  // so existing templates keep rendering identically.
  const [headingRule, setHeadingRule] = useState<
    'bar' | 'underline' | 'double' | 'thick' | 'plain'
  >('bar');
  const [nameTypography, setNameTypography] = useState<
    'regular' | 'display' | 'letter_spaced'
  >('regular');
  const [sidebarLayout, setSidebarLayout] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Edit mode: load template config
  useEffect(() => {
    if (mode !== 'edit' || !templateId) return;
    let alive = true;
    templatesApi
      .get(templateId)
      .then((t) => {
        if (!alive) return;
        setName(t.name);
        setId(t.id);
        setDescription(t.description);
        const cfg = t.template_config_json;
        setSections(cfg.sections);
        setFontFamily(cfg.font_family);
        setAccentColor(cfg.accent_color);
        setDensity(cfg.density);
        setBulletStyle(cfg.bullet_style);
        setDateFormat(cfg.date_format);
        setPageSize(cfg.page_size);
        // Phase 10B: load structural axes with safe defaults if missing
        // (legacy presets saved before Phase 10B don't have these keys).
        setHeaderStyle(cfg.header_style ?? 'stacked');
        setSectionHeadingStyle(cfg.section_heading_style ?? 'bar');
        setExperienceLayout(cfg.experience_layout ?? 'standard');
        setSkillsLayout(cfg.skills_layout ?? 'comma');
        // Phase 10C: decoration axes — safe defaults if missing (legacy
        // presets saved before Phase 10C don't have these keys).
        setHeadingRule(cfg.heading_rule ?? 'bar');
        setNameTypography(cfg.name_typography ?? 'regular');
        setSidebarLayout(cfg.sidebar_layout ?? false);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        toast.error((e as Error).message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [mode, templateId]);

  // Live preview via /templates/preview (debounced)
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(async () => {
      setPreviewError(null);
      try {
        const cfg: Partial<TemplateConfigJson> = {
          font_family: fontFamily,
          accent_color: accentColor,
          density,
          bullet_style: bulletStyle,
          date_format: dateFormat,
          page_size: pageSize,
          sections,
          // Phase 10B: structural axes drive the rendered layout.
          header_style: headerStyle,
          section_heading_style: sectionHeadingStyle,
          experience_layout: experienceLayout,
          skills_layout: skillsLayout,
          // Phase 10C decoration axes
          heading_rule: headingRule,
          name_typography: nameTypography,
          sidebar_layout: sidebarLayout,
        };
        const out = await templatesApi.preview({
          cv_json: {
            basics: {
              name: 'Preview User',
              label: 'Senior Engineer',
              email: 'preview@example.com',
              location: 'Jakarta, Indonesia',
            },
            summary:
              'Senior backend engineer with 8 years building distributed systems.',
            work: [
              {
                name: 'Acme Corp',
                position: 'Senior Engineer',
                startDate: '2021-03',
                endDate: null,
                location: 'Remote',
                highlights: [
                  'Built payment service handling 50K req/sec',
                  'Reduced p99 latency from 200ms to 80ms',
                ],
              },
              {
                name: 'OldCo',
                position: 'Engineer',
                startDate: '2018-06',
                endDate: '2021-02',
                highlights: ['Maintained legacy API'],
              },
            ],
            education: [
              {
                institution: 'ITB',
                studyType: 'Bachelor',
                area: 'Computer Science',
                startDate: '2014-09',
                endDate: '2018-07',
              },
            ],
            skills: ['Python', 'Go', 'Kubernetes', 'PostgreSQL'],
            projects: [],
          } as unknown as Parameters<typeof templatesApi.preview>[0]['cv_json'],
          template_config_json: cfg,
        });
        setPreviewHtml(out.rendered_html);
      } catch (e: unknown) {
        setPreviewError((e as Error).message);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [
    loading,
    fontFamily,
    accentColor,
    density,
    bulletStyle,
    dateFormat,
    pageSize,
    sections,
    // Phase 10B: structural axes must retrigger live preview too.
    headerStyle,
    sectionHeadingStyle,
    experienceLayout,
    skillsLayout,
    // Phase 10C: decoration axes must retrigger too.
    headingRule,
    nameTypography,
    sidebarLayout,
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'create') {
        if (!id.trim() || !name.trim()) {
          throw new Error('ID and name are required');
        }
        await templatesApi.create({
          id: id.trim(),
          name: name.trim(),
          description,
          sections,
          font_family: fontFamily,
          accent_color: accentColor,
          density,
          bullet_style: bulletStyle,
          date_format: dateFormat,
          page_size: pageSize,
          header_style: headerStyle,
          section_heading_style: sectionHeadingStyle,
          experience_layout: experienceLayout,
          skills_layout: skillsLayout,
          // Phase 10C decoration axes
          heading_rule: headingRule,
          name_typography: nameTypography,
          sidebar_layout: sidebarLayout,
        });
      } else {
        await templatesApi.patch(templateId!, {
          name: name.trim(),
          description,
          sections,
          font_family: fontFamily,
          accent_color: accentColor,
          density,
          bullet_style: bulletStyle,
          date_format: dateFormat,
          page_size: pageSize,
          header_style: headerStyle,
          section_heading_style: sectionHeadingStyle,
          experience_layout: experienceLayout,
          skills_layout: skillsLayout,
          // Phase 10C decoration axes
          heading_rule: headingRule,
          name_typography: nameTypography,
          sidebar_layout: sidebarLayout,
        });
      }
      onSaved();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message ||
        'Failed to save template';
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (s: string) => {
    setSections((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === 'create' ? 'New template' : `Edit "${name}"`}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {loading ? (
          <div className="p-12 flex items-center justify-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading template…
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
            {/* ── Left: form ─────────────────────────────────────── */}
            <div className="p-6 overflow-auto space-y-4 border-r border-slate-200">
              {mode === 'create' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ID (slug, lowercase + dash/underscore)
                  </label>
                  <input
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="user_my_template"
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    data-testid="template-id-input"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Custom Style"
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  data-testid="template-name-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              {/* ── Sections ─────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Sections
                  </label>
                  <span className="text-[10px] text-slate-500">
                    {sections.length} of {SECTION_OPTIONS.length} enabled
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {SECTION_OPTIONS.map((opt) => {
                    const enabled = sections.includes(opt.value);
                    const idx = sections.indexOf(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleSection(opt.value)}
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          enabled
                            ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-medium'
                            : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {enabled && idx >= 0 && (
                          <span className="inline-block w-3.5 text-[10px] tabular-nums text-indigo-500">
                            {idx + 1}
                          </span>
                        )}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {/* Visual section order — the actual structural differentiator.
                    Shows live render of how the CV sections will appear, with
                    up/down controls to reorder without leaving the page. */}
                <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    <span>Section order</span>
                    <span className="text-slate-400 normal-case font-normal">
                      (click to remove)
                    </span>
                  </div>
                  {sections.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2 text-center">
                      No sections selected
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {sections.map((s, i) => (
                        <span
                          key={`order-${s}-${i}`}
                          className="inline-flex items-center gap-1 group"
                        >
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-medium text-slate-700">
                            <span className="text-[9px] tabular-nums text-slate-400">
                              {i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleSection(s)}
                              className="hover:text-rose-600 transition-colors"
                              aria-label={`Remove ${SECTION_LABELS[s] ?? s}`}
                              title="Remove section"
                            >
                              {SECTION_LABELS[s] ?? s}
                            </button>
                          </span>
                          {i < sections.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Style ────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Font
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) =>
                      setFontFamily(e.target.value as typeof fontFamily)
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="sans">Sans-serif (Arial)</option>
                    <option value="serif">Serif (Georgia)</option>
                    <option value="mono">Monospace (Courier)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Density
                  </label>
                  <select
                    value={density}
                    onChange={(e) =>
                      setDensity(e.target.value as typeof density)
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="compact">Compact</option>
                    <option value="normal">Normal</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bullet style
                  </label>
                  <select
                    value={bulletStyle}
                    onChange={(e) =>
                      setBulletStyle(e.target.value as typeof bulletStyle)
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="dash">Dash</option>
                    <option value="bullet">Bullet</option>
                    <option value="arrow">Arrow</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date format
                  </label>
                  <select
                    value={dateFormat}
                    onChange={(e) =>
                      setDateFormat(e.target.value as typeof dateFormat)
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="Mon YYYY">Mon YYYY (Mar 2021)</option>
                    <option value="MM/YYYY">MM/YYYY (03/2021)</option>
                    <option value="YYYY">YYYY (2021)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Page size
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) =>
                      setPageSize(e.target.value as typeof pageSize)
                    }
                    className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="A4">A4</option>
                    <option value="Letter">Letter (US)</option>
                  </select>
                </div>
              </div>

              {/* ── Color picker (ATS-safe only) ─────────────────── */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Accent color (ATS-safe palette only)
                </label>
                <div className="flex flex-wrap gap-1">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setAccentColor(c.value)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${
                        accentColor === c.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-300 bg-white'
                      }`}
                      data-testid={`color-${c.value}`}
                    >
                      <span
                        className="w-3 h-3 rounded border border-slate-300"
                        style={{ backgroundColor: c.value }}
                      />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Structural layout (Phase 10B) ────────────────────── */}
              <div className="border-t border-slate-200 pt-3 mt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Layout
                  </span>
                  <span className="text-[10px] text-slate-500">
                    structural axes
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Header layout
                    </label>
                    <select
                      value={headerStyle}
                      onChange={(e) =>
                        setHeaderStyle(e.target.value as typeof headerStyle)
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                      data-testid="header-style-select"
                    >
                      <option value="stacked">Stacked (name on top)</option>
                      <option value="inline">Inline (name + title)</option>
                      <option value="banner">Banner (large name)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Section headings
                    </label>
                    <select
                      value={sectionHeadingStyle}
                      onChange={(e) =>
                        setSectionHeadingStyle(
                          e.target.value as typeof sectionHeadingStyle
                        )
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                      data-testid="section-heading-select"
                    >
                      <option value="bar">Bar (uppercase)</option>
                      <option value="underline">Underline</option>
                      <option value="plain">Plain</option>
                      <option value="numbered">Numbered (01 · Title)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Experience layout
                    </label>
                    <select
                      value={experienceLayout}
                      onChange={(e) =>
                        setExperienceLayout(
                          e.target.value as typeof experienceLayout
                        )
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                      data-testid="experience-layout-select"
                    >
                      <option value="standard">Standard</option>
                      <option value="dates_right">Dates right</option>
                      <option value="inline_dates">Inline dates</option>
                      <option value="compact">Compact</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Skills layout
                    </label>
                    <select
                      value={skillsLayout}
                      onChange={(e) =>
                        setSkillsLayout(e.target.value as typeof skillsLayout)
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                      data-testid="skills-layout-select"
                    >
                      <option value="comma">Comma list</option>
                      <option value="pipe">Pipe list (A | B | C)</option>
                      <option value="categorized">Categorized</option>
                      <option value="pills">Pills (bordered)</option>
                      <option value="proficiency">Proficiency dots ●●●●○</option>
                      <option value="chips">Chips (tinted)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Decoration (Phase 10C) ───────────────────────────── */}
              <div className="border-t border-slate-200 pt-3 mt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Decoration
                  </span>
                  <span className="text-[10px] text-slate-500">
                    visual flavor
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Heading rule
                    </label>
                    <select
                      value={headingRule}
                      onChange={(e) =>
                        setHeadingRule(e.target.value as typeof headingRule)
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                      data-testid="heading-rule-select"
                    >
                      <option value="bar">Bar (1px)</option>
                      <option value="underline">Underline (2px)</option>
                      <option value="double">Double rule</option>
                      <option value="thick">Thick bar (3px)</option>
                      <option value="plain">Plain (no rule)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Name typography
                    </label>
                    <select
                      value={nameTypography}
                      onChange={(e) =>
                        setNameTypography(
                          e.target.value as typeof nameTypography
                        )
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                      data-testid="name-typography-select"
                    >
                      <option value="regular">Regular (28px)</option>
                      <option value="display">Display (34px bold)</option>
                      <option value="letter_spaced">
                        Letter-spaced uppercase
                      </option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sidebarLayout}
                        onChange={(e) => setSidebarLayout(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                        data-testid="sidebar-layout-checkbox"
                      />
                      <span className="text-xs font-medium text-slate-700">
                        Sidebar layout (32/68 split)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        — best for modern ATS
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: live preview ────────────────────────────── */}
            <div className="bg-slate-50 overflow-auto">
              <div className="px-4 py-2 text-xs font-medium text-slate-600 border-b border-slate-200 bg-white">
                Live preview
              </div>
              {previewError ? (
                <div className="p-4 text-sm text-rose-700">{previewError}</div>
              ) : previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full bg-white"
                  style={{ height: 'calc(90vh - 110px)', border: 'none' }}
                  title="Template preview"
                  data-testid="live-preview-iframe"
                  // Sandbox isolates the previewed HTML — it can't access
                  // cookies, run scripts beyond what the renderer emits,
                  // or escape into the parent app's origin.
                  sandbox=""
                />
              ) : (
                <div className="p-4 text-sm text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Rendering…
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            data-testid="template-save-btn"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {mode === 'create' ? 'Create template' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preview modal (read-only) ──────────────────────────────────────
function TemplatePreviewModal({
  templateId,
  onClose,
}: {
  templateId: string;
  onClose: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<Template | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await templatesApi.get(templateId);
        if (!alive) return;
        setTemplate(t);
        const out = await templatesApi.preview({
          cv_json: {
            basics: {
              name: 'Preview User',
              label: 'Senior Engineer',
              email: 'preview@example.com',
              location: 'Jakarta, Indonesia',
            },
            summary:
              'Senior backend engineer with 8 years building distributed systems.',
            work: [
              {
                name: 'Acme Corp',
                position: 'Senior Engineer',
                startDate: '2021-03',
                endDate: null,
                location: 'Remote',
                highlights: [
                  'Built payment service handling 50K req/sec',
                  'Reduced p99 latency from 200ms to 80ms',
                ],
              },
            ],
            education: [
              {
                institution: 'ITB',
                studyType: 'Bachelor',
                area: 'Computer Science',
                startDate: '2014-09',
                endDate: '2018-07',
              },
            ],
            skills: ['Python', 'Go', 'Kubernetes'],
            projects: [],
          } as unknown as Parameters<typeof templatesApi.preview>[0]['cv_json'],
          template_config_json: t.template_config_json,
        });
        if (!alive) return;
        setHtml(out.rendered_html);
        setLoading(false);
      } catch (e: unknown) {
        if (!alive) return;
        toast.error((e as Error).message);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [templateId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {template?.name || 'Template'}
            </h2>
            <p className="text-xs text-slate-500">{template?.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 bg-slate-50 overflow-hidden">
          {loading ? (
            <div className="p-12 flex items-center justify-center text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Rendering…
            </div>
          ) : html ? (
            <iframe
              srcDoc={html}
              className="w-full bg-white"
              style={{ height: 'calc(90vh - 110px)', border: 'none' }}
              title="Template preview"
              sandbox=""
            />
          ) : (
            <div className="p-12 text-rose-700 text-sm">Preview failed</div>
          )}
        </div>
      </div>
    </div>
  );
}