/**
 * TemplatesPage — Phase 10A.
 *
 * Replaces the placeholder. Surfaces the full template CRUD surface:
 *   - Card grid: list of templates with name + description + styling badges
 *   - Create modal: form for new custom template (with live preview)
 *   - Detail/Edit modal: view + edit user-created templates
 *   - Duplicate button on each card
 *   - Delete button on user-created templates
 *
 * Built-in presets (ats_classic, ats_modern, ats_compact) are read-only.
 */
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Template,
  TemplateConfigJson,
  TemplateSummary,
} from '../lib/api';
import { templatesApi } from '../lib/api';
import { showToast } from '../lib/toast';

const PRESET_IDS = new Set(['ats_classic', 'ats_modern', 'ats_compact']);

const COLOR_OPTIONS = [
  { value: '#111111', label: 'Default' },
  { value: '#1f2937', label: 'Slate 800' },
  { value: '#0f172a', label: 'Slate 900' },
  { value: '#111827', label: 'Gray 900' },
  { value: '#334155', label: 'Slate 700' },
  { value: '#475569', label: 'Slate 600' },
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
      showToast('success', 'Template deleted');
    },
    onError: (e: unknown) => {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message ||
        'Failed to delete template';
      showToast('error', detail);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ src, dst }: { src: string; dst: string }) =>
      templatesApi.duplicate(src, dst),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      showToast('success', `Duplicated as "${t.name}"`);
    },
    onError: (e: unknown) => {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message ||
        'Failed to duplicate template';
      showToast('error', detail);
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
    <div className="p-6 max-w-6xl mx-auto" data-testid="templates-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          <p className="text-sm text-slate-600 mt-1">
            ATS-safe CV and cover letter templates. All single-column, no
            graphics, selectable text.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          data-testid="new-template-btn"
        >
          <Plus className="w-4 h-4" /> New template
        </button>
      </div>

      {/* ── Built-in presets ────────────────────────────────────── */}
      <Section title="Built-in presets" count={builtins.length}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            showToast('success', 'Template created');
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
            showToast('success', 'Template updated');
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
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          {title}
        </h2>
        <span className="text-xs text-slate-500">({count})</span>
      </div>
      {children}
    </div>
  );
}

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
  return (
    <div
      className="border border-slate-200 rounded-lg bg-white p-4 flex flex-col"
      data-testid={`template-card-${template.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-slate-900 truncate">
          {template.name}
        </h3>
        {template.is_default && (
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded flex-shrink-0">
            default
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 line-clamp-3 mb-3 min-h-[3rem]">
        {template.description}
      </p>
      <div className="flex items-center gap-1.5 mb-3">
        {template.is_ats_friendly && (
          <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded">
            ATS-safe
          </span>
        )}
        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">
          {template.type}
        </span>
      </div>
      <div className="flex items-center gap-1 mt-auto pt-2 border-t border-slate-100">
        <button
          onClick={onPreview}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded"
          data-testid={`preview-${template.id}`}
        >
          <FileText className="w-3 h-3" /> Preview
        </button>
        {onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded"
            data-testid={`edit-${template.id}`}
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
        <button
          onClick={onDuplicate}
          disabled={duplicating}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded disabled:opacity-50"
          data-testid={`duplicate-${template.id}`}
        >
          <Copy className="w-3 h-3" /> Duplicate
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={deleting}
            className="flex items-center gap-1 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 rounded disabled:opacity-50 ml-auto"
            data-testid={`delete-${template.id}`}
          >
            <Trash2 className="w-3 h-3" />
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
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        showToast('error', (e as Error).message);
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
        });
      }
      onSaved();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (e as Error).message ||
        'Failed to save template';
      showToast('error', detail);
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
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sections (click to toggle, drag order via config later)
                </label>
                <div className="flex flex-wrap gap-1">
                  {SECTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleSection(opt.value)}
                      className={`text-xs px-2 py-1 rounded border ${
                        sections.includes(opt.value)
                          ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                          : 'bg-white border-slate-300 text-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Order: {sections.join(' › ')}
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
        showToast('error', (e as Error).message);
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
            />
          ) : (
            <div className="p-12 text-rose-700 text-sm">Preview failed</div>
          )}
        </div>
      </div>
    </div>
  );
}