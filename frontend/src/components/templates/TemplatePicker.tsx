/**
 * TemplatePicker — reusable template selector (Phase 10A).
 *
 * Used in:
 *   - CreateCVModal (CvDraftsPage) — choose template when generating CV
 *   - CVEditor header — change template for an existing draft
 *
 * Two variants:
 *   - "compact" — single dropdown button with searchable list
 *   - "card" — grid of cards each showing a schematic thumbnail so the
 *     visual differences between templates are obvious at a glance
 *
 * The card variant reuses :component:`TemplateThumbnail` so the picker
 * cards are visually identical to the TemplatesPage cards — picking a
 * template in either surface shows the same miniature preview.
 */
import { useEffect, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import type {
  TemplateSummary,
  FontFamily,
  Density,
} from '../../lib/api';
import { templatesApi } from '../../lib/api';
import TemplateThumbnail from './TemplateThumbnail';

interface TemplatePickerProps {
  value: string;
  onChange: (id: string) => void;
  /** Disable interaction (e.g. while saving). */
  disabled?: boolean;
  /** "compact" = inline select; "card" = card-grid picker. Default "compact". */
  variant?: 'compact' | 'card';
  /** Optional testid hook for Playwright. */
  testId?: string;
}

const FONT_LABEL: Record<FontFamily, string> = {
  serif: 'Serif',
  sans: 'Sans',
  mono: 'Mono',
};

const DENSITY_LABEL: Record<Density, string> = {
  compact: 'Compact',
  normal: 'Normal',
  spacious: 'Spacious',
};

export default function TemplatePicker({
  value,
  onChange,
  disabled,
  variant = 'compact',
  testId = 'template-picker',
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    templatesApi
      .list('cv')
      .then((data) => {
        if (!alive) return;
        setTemplates(data);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError((e as Error).message || 'Failed to load templates');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
        {error}
      </div>
    );
  }

  if (!templates) {
    return (
      <div className="text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading templates…
      </div>
    );
  }

  const current = templates.find((t) => t.id === value);

  // ── compact variant: native select ─────────────────────────────
  if (variant === 'compact') {
    return (
      <div className="relative" data-testid={testId}>
        <button
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="w-full flex items-center justify-between gap-2 border border-slate-300 rounded px-2 py-1.5 text-sm bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          <span className="truncate text-left">
            {current ? current.name : 'Select template…'}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
        {open && (
          <div
            className="absolute z-20 mt-1 w-full max-h-72 overflow-auto bg-white border border-slate-200 rounded shadow-lg"
            data-testid={`${testId}-dropdown`}
            role="listbox"
            // Close dropdown on Escape — screen reader + keyboard friendly.
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
          >
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onChange(t.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-start gap-2 ${
                  t.id === value ? 'bg-indigo-50' : ''
                }`}
                data-testid={`${testId}-option-${t.id}`}
              >
                <Check
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    t.id === value ? 'text-indigo-600' : 'text-transparent'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-900 truncate">
                      {t.name}
                    </span>
                    {t.is_default && (
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        default
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                    {t.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── card variant: grid of cards ────────────────────────────────
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid={testId}>
      {templates.map((t) => (
        <TemplateCard
          key={t.id}
          template={t}
          selected={t.id === value}
          onSelect={() => onChange(t.id)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

// ── Card variant sub-component ──────────────────────────────────────
function TemplateCard({
  template,
  selected,
  onSelect,
  disabled,
}: {
  template: TemplateSummary;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`text-left p-2.5 rounded-lg border-2 transition-colors disabled:opacity-50 ${
        selected
          ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      }`}
    >
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-md p-3 mb-2">
        <TemplateThumbnail config={template.template_config_json} className="h-28" />
      </div>
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <span className="font-medium text-sm text-slate-900 truncate">
          {template.name}
        </span>
        {template.is_default && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded font-semibold flex-shrink-0">
            default
          </span>
        )}
      </div>
      <div className="text-[11px] text-slate-500 line-clamp-2 leading-snug mb-1.5">
        {template.description}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {template.is_ats_friendly && (
          <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-medium">
            ATS-safe
          </span>
        )}
        <span
          className="text-[9px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600"
          title={`Accent ${template.template_config_json.accent_color}`}
        >
          <span
            className="inline-block w-2 h-2 rounded-sm border border-slate-300 mr-1 align-middle"
            style={{
              backgroundColor: template.template_config_json.accent_color,
            }}
          />
          {template.template_config_json.font_family} ·{' '}
          {template.template_config_json.density}
        </span>
      </div>
    </button>
  );
}

// Re-export so consumers don't have to import from api.ts.
export { FONT_LABEL, DENSITY_LABEL };