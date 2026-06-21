/**
 * JobFilterBar — compact horizontal filter row for the Job Postings
 * page. Phase 10D.
 *
 * Per spec section C, the bar shows quick filter triggers (one per
 * category), an "All Filters" link to the advanced drawer, and the
 * active filter chips with × to remove individual selections.
 *
 * Spec coverage:
 *   - C.1–C.10: 6 quick filters (Work Mode, Employment, Seniority,
 *     Experience, Date Posted, Source)
 *   - C.11: All Filters button (advanced drawer — stub for now)
 *   - D.4: active filters as removable chips
 *   - D.5: Clear Filters / Reset All
 *   - D.6: URL query param sync (via parent — useSearchParams)
 *
 * The bar does NOT own filter state — it receives it from the parent
 * (JobsPage) and dispatches updates. URL sync is the parent's
 * responsibility (single source of truth for filter state).
 */
import { useState } from 'react';
import { Filter as FilterIcon, X, SlidersHorizontal, RotateCcw } from 'lucide-react';
import {
  type FilterState,
  type FilterValue,
  QUICK_FILTER_CATEGORIES,
  totalActiveFilters,
} from './jobFilters';
import JobFilterPopover, { JobFilterTrigger } from './JobFilterPopover';
import type { JobOut } from '../../lib/api';

interface JobFilterBarProps {
  filterState: FilterState;
  jobs: JobOut[];
  onChange: (next: FilterState) => void;
  onClearAll: () => void;
  /** Open the All Filters advanced drawer (stub). */
  onOpenAdvanced?: () => void;
}

export default function JobFilterBar({
  filterState,
  jobs,
  onChange,
  onClearAll,
  onOpenAdvanced,
}: JobFilterBarProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const activeCount = totalActiveFilters(filterState);

  const setCategoryValues = (catId: string, values: FilterValue[]) => {
    onChange({ ...filterState, [catId]: values });
  };
  const clearCategory = (catId: string) => {
    const next = { ...filterState };
    delete next[catId];
    onChange(next);
  };

  return (
    <div className="space-y-2" data-testid="job-filter-bar">
      {/* Quick filter trigger row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider pr-1">
          <FilterIcon className="w-3 h-3" />
          Filter
        </span>
        {QUICK_FILTER_CATEGORIES.map((cat) => {
          const selected = filterState[cat.id] ?? [];
          return (
            <div key={cat.id} className="relative">
              <JobFilterTrigger
                category={cat}
                selected={selected}
                onClick={() => setOpenId(openId === cat.id ? null : cat.id)}
              />
              {openId === cat.id && (
                <JobFilterPopover
                  category={cat}
                  selected={selected}
                  jobs={jobs}
                  onChange={(vs) => setCategoryValues(cat.id, vs)}
                  onClear={() => clearCategory(cat.id)}
                  onClose={() => setOpenId(null)}
                />
              )}
            </div>
          );
        })}
        {onOpenAdvanced && (
          <button
            type="button"
            onClick={onOpenAdvanced}
            data-testid="all-filters-btn"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium rounded-md border border-dashed border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 transition-colors"
          >
            <SlidersHorizontal className="w-3 h-3" />
            All Filters
          </button>
        )}
        {activeCount > 0 && (
          <span
            data-testid="active-filter-count"
            className="ml-1 text-[10px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded-full"
          >
            {activeCount} active
          </span>
        )}
      </div>

      {/* Active filter chips (spec D.4) */}
      {activeCount > 0 && (
        <div
          data-testid="active-filter-chips"
          className="flex flex-wrap items-center gap-1.5"
        >
          {Object.entries(filterState).flatMap(([catId, values]) => {
            if (values.length === 0) return [];
            const cat = QUICK_FILTER_CATEGORIES.find((c) => c.id === catId);
            if (!cat) return [];
            return values.map((v) => {
              const opt = cat.options.find((o) => o.value === v);
              return (
                <button
                  key={`${catId}-${v}`}
                  type="button"
                  onClick={() =>
                    setCategoryValues(
                      catId,
                      values.filter((x) => x !== v),
                    )
                  }
                  data-testid={`active-chip-${catId}-${v}`}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-[11px] font-medium rounded-full border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
                  title={`Remove ${opt?.label} filter`}
                >
                  <span className="text-brand-600 font-semibold">{cat.label}:</span>
                  <span>{opt?.label}</span>
                  <X className="w-3 h-3 opacity-60" />
                </button>
              );
            });
          })}
          <button
            type="button"
            onClick={onClearAll}
            data-testid="clear-all-filters-btn"
            className="inline-flex items-center gap-1 ml-1 text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
