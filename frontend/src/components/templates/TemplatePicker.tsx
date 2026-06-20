/**
 * TemplatePicker — reusable template selector (Phase 10A).
 *
 * Used in:
 *   - CreateCVModal (CvDraftsPage) — choose template when generating CV
 *   - CVEditor header — change template for an existing draft
 *
 * Fetches the list via templatesApi on mount. Shows a card-style
 * preview thumbnail (accent color swatch + density + font) so users
 * can tell presets apart at a glance.
 */
import { useEffect, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import type {
  TemplateSummary,
  FontFamily,
  Density,
} from '../../lib/api';
import { templatesApi } from '../../lib/api';

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
      className={`text-left p-3 rounded border-2 transition-colors ${
        selected
          ? 'border-indigo-500 bg-indigo-50'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      } disabled:opacity-50`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm text-slate-900 truncate">
          {template.name}
        </span>
        {template.is_default && (
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
            default
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 line-clamp-2 mb-2">
        {template.description}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        {template.is_ats_friendly && (
          <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded">
            ATS-safe
          </span>
        )}
      </div>
    </button>
  );
}

// Re-export so consumers don't have to import from api.ts.
export { FONT_LABEL, DENSITY_LABEL };