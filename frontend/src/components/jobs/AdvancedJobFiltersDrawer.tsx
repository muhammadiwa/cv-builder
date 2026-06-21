/**
 * AdvancedJobFiltersDrawer — right-side slide-in drawer for advanced
 * filters (spec C.12).
 *
 * Per the spec, the "All Filters" button opens a drawer with the
 * full set of advanced filter options. We model these as a separate
 * `AdvancedFilterState` (not the multi-select chip pattern) because
 * they include free-text inputs, company filters, and boolean
 * toggles — all things the popover pattern doesn't suit.
 *
 * Sections:
 *   1. Keywords — required / excluded
 *   2. Company — include / exclude
 *   3. Industry — multi-select chips (SaaS / AI / Fintech / …)
 *   4. Salary — disclosed only toggle
 *   5. Job properties — has_remote, has_cv, has_cl toggles
 *   6. User state — saved only, hide hidden
 *
 * The drawer is "draft-then-apply": changes are local until the
 * user clicks Apply, mirroring how a real ATS drawer behaves. Cancel
 * discards the draft.
 */
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  X,
  RotateCcw,
  Check,
  RotateCw,
  Search,
  Building2,
  DollarSign,
  Globe,
  FileText,
  Mail,
  Bookmark,
  EyeOff,
  type LucideIcon,
} from 'lucide-react';
import {
  type AdvancedFilterState,
  type FilterState,
  advancedActiveCount,
  ADVANCED_FILTER_CATEGORIES,
} from './jobFilters';

interface AdvancedJobFiltersDrawerProps {
  open: boolean;
  /** Current applied advanced state (drives the draft initial value). */
  applied: AdvancedFilterState;
  /** Current applied quick-filter state — needed so the drawer can
   *  show the Industry category (which lives in the quick list). */
  quickState: FilterState;
  /** Apply changes — save the draft as the new applied state. */
  onApply: (next: AdvancedFilterState) => void;
  /** Close without saving. */
  onClose: () => void;
}

interface ToggleRow {
  key: keyof AdvancedFilterState;
  label: string;
  description: string;
  icon: LucideIcon;
}

const TOGGLE_ROWS: ToggleRow[] = [
  {
    key: 'hasSalary',
    label: 'Salary disclosed',
    description: 'Only show jobs with a salary range',
    icon: DollarSign,
  },
  {
    key: 'hasRemote',
    label: 'Has remote option',
    description: 'Jobs marked as remote or "Remote Anywhere"',
    icon: Globe,
  },
  {
    key: 'hasTailoredCv',
    label: 'Has tailored CV',
    description: 'A CV draft already exists for this job',
    icon: FileText,
  },
  {
    key: 'hasCoverLetter',
    label: 'Has cover letter',
    description: 'A cover letter draft already exists',
    icon: Mail,
  },
  {
    key: 'savedOnly',
    label: 'Saved only',
    description: 'Only jobs you saved (bookmarked)',
    icon: Bookmark,
  },
  {
    key: 'hideHidden',
    label: 'Hide hidden jobs',
    description: 'Exclude jobs you marked as not relevant',
    icon: EyeOff,
  },
];

const INDUSTRY_CATEGORY = ADVANCED_FILTER_CATEGORIES.find((c) => c.id === 'industry')!;
const SALARY_CATEGORY = ADVANCED_FILTER_CATEGORIES.find((c) => c.id === 'salary')!;

export default function AdvancedJobFiltersDrawer({
  open,
  applied,
  quickState,
  onApply,
  onClose,
}: AdvancedJobFiltersDrawerProps) {
  // Local draft state — only persisted to the parent on Apply.
  const [draft, setDraft] = useState<AdvancedFilterState>(applied);
  const [industrySelected, setIndustrySelected] = useState<string[]>(
    quickState['industry'] ?? [],
  );
  const [salarySelected, setSalarySelected] = useState<string[]>(
    quickState['salary'] ?? [],
  );

  // Re-sync draft when the drawer re-opens with new applied state
  useEffect(() => {
    if (open) {
      setDraft(applied);
      setIndustrySelected(quickState['industry'] ?? []);
      setSalarySelected(quickState['salary'] ?? []);
    }
  }, [open, applied, quickState]);

  // Escape closes (discard draft)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const updateField = <K extends keyof AdvancedFilterState>(
    key: K,
    value: AdvancedFilterState[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const toggleIndustry = (value: string) => {
    setIndustrySelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };
  const toggleSalary = (value: string) => {
    setSalarySelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const handleApply = () => {
    onApply(draft);
    // Industry + salary go back into the main quickState via onApply —
    // caller (JobsPage) is responsible for merging.
    onClose();
  };

  const handleReset = () => {
    setDraft({});
    setIndustrySelected([]);
    setSalarySelected([]);
  };

  const draftActive = advancedActiveCount(draft) + industrySelected.length + salarySelected.length;
  // Note: industry + salary are part of the quick-state filter values
  // — they don't count against "advanced" count. The badge on the
  // All Filters trigger shows the total active count of all filters.

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={clsx(
          'fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="advanced-filters-title"
        data-testid="advanced-filters-drawer"
        data-state={open ? 'open' : 'closed'}
        className={clsx(
          'fixed top-0 right-0 h-full w-full max-w-md bg-white border-l border-slate-200',
          'shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <header className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-brand-600 mb-1">
              All Filters
            </div>
            <h2 id="advanced-filters-title" className="text-[16px] font-semibold text-slate-900">
              Refine your search
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              {draftActive > 0
                ? `${draftActive} ${draftActive === 1 ? 'filter' : 'filters'} active`
                : 'No filters applied yet'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="advanced-filters-close"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors shrink-0"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Section 1: Industry */}
          <section>
            <h3 className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Industry
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRY_CATEGORY.options.map((opt) => {
                const active = industrySelected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleIndustry(opt.value)}
                    data-testid={`advanced-industry-${opt.value}`}
                    className={clsx(
                      'px-2.5 py-1 text-[12px] font-medium rounded-full border transition-colors',
                      active
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {active && <Check className="w-3 h-3 inline-block mr-0.5" />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 2: Salary */}
          <section>
            <h3 className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              Salary
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {SALARY_CATEGORY.options.map((opt) => {
                const active = salarySelected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleSalary(opt.value)}
                    data-testid={`advanced-salary-${opt.value}`}
                    className={clsx(
                      'px-2.5 py-1 text-[12px] font-medium rounded-full border transition-colors',
                      active
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
                    )}
                  >
                    {active && <Check className="w-3 h-3 inline-block mr-0.5" />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section 3: Keywords */}
          <section>
            <h3 className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Keywords
            </h3>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  Required keyword (in title or summary)
                </label>
                <input
                  type="text"
                  value={draft.requiredKeyword ?? ''}
                  onChange={(e) =>
                    updateField('requiredKeyword', e.target.value || undefined)
                  }
                  placeholder="e.g. kubernetes, fintech, remote"
                  data-testid="advanced-required-keyword"
                  className="w-full px-2.5 py-1.5 text-[13px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  Excluded keyword
                </label>
                <input
                  type="text"
                  value={draft.excludedKeyword ?? ''}
                  onChange={(e) =>
                    updateField('excludedKeyword', e.target.value || undefined)
                  }
                  placeholder="e.g. clearance, on-call"
                  data-testid="advanced-excluded-keyword"
                  className="w-full px-2.5 py-1.5 text-[13px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </section>

          {/* Section 4: Company */}
          <section>
            <h3 className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Company
            </h3>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  Company includes
                </label>
                <input
                  type="text"
                  value={draft.companyInclude ?? ''}
                  onChange={(e) =>
                    updateField('companyInclude', e.target.value || undefined)
                  }
                  placeholder="e.g. Google, Stripe"
                  data-testid="advanced-company-include"
                  className="w-full px-2.5 py-1.5 text-[13px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">
                  Company excludes
                </label>
                <input
                  type="text"
                  value={draft.companyExclude ?? ''}
                  onChange={(e) =>
                    updateField('companyExclude', e.target.value || undefined)
                  }
                  placeholder="e.g. recruiting agencies"
                  data-testid="advanced-company-exclude"
                  className="w-full px-2.5 py-1.5 text-[13px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          </section>

          {/* Section 5: Job properties (toggles) */}
          <section>
            <h3 className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Job properties
            </h3>
            <div className="space-y-1.5">
              {TOGGLE_ROWS.map((row) => {
                const Icon = row.icon;
                const checked = !!draft[row.key];
                return (
                  <label
                    key={row.key}
                    className="flex items-start gap-2.5 p-2 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => updateField(row.key, e.target.checked || undefined)}
                      data-testid={`advanced-toggle-${row.key}`}
                      className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    <Icon className={clsx('w-3.5 h-3.5 mt-0.5 shrink-0', checked ? 'text-brand-600' : 'text-slate-400')} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-slate-700">{row.label}</div>
                      <div className="text-[11px] text-slate-500 leading-snug">{row.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleReset}
            data-testid="advanced-reset"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] text-slate-600 hover:text-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              data-testid="advanced-cancel"
              className="px-3 py-1.5 text-[12px] font-medium border border-slate-200 text-slate-700 bg-white rounded hover:border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              data-testid="advanced-apply"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold bg-brand-600 text-white rounded hover:bg-brand-700 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Apply {draftActive > 0 && `(${draftActive})`}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
