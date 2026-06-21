/**
 * JobFilterPopover — multi-select dropdown for one filter category.
 *
 * Phase 10D: per spec C, each quick filter opens a popover with
 * checkboxes for its options. Multi-select within a category means
 * OR semantics (e.g. selecting Remote + Hybrid = "remote or hybrid
 * jobs"). Count badges next to each option show how many of the
 * current jobs would match if that option were selected.
 *
 * Implementation: a popover (not native <select multiple>), so we
 * can show count badges, a search input, and Apply/Clear buttons
 * without browser-default UI noise.
 */
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Check,
  ChevronDown,
  X,
  Search,
  RotateCcw,
} from 'lucide-react';
import {
  type FilterCategory,
  type FilterValue,
  countByOption,
} from './jobFilters';
import type { JobOut } from '../../lib/api';

interface JobFilterPopoverProps {
  category: FilterCategory;
  /** Currently selected values for this category. */
  selected: FilterValue[];
  /** All jobs — for the per-option count badge. */
  jobs: JobOut[];
  /** Update selected values. */
  onChange: (next: FilterValue[]) => void;
  /** Clear all selections for this category. */
  onClear: () => void;
  /** Close the popover. */
  onClose: () => void;
}

export default function JobFilterPopover({
  category,
  selected,
  jobs,
  onChange,
  onClear,
  onClose,
}: JobFilterPopoverProps) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [onClose]);

  // Counts per option (across all jobs, not just filtered)
  const counts = countByOption(jobs, category);

  // Filter options by search query
  const filteredOptions = category.options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  const toggle = (value: FilterValue) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div
      ref={ref}
      data-testid={`filter-popover-${category.id}`}
      className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-30"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider">
          {category.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${category.label.toLowerCase()}…`}
            className="w-full pl-8 pr-2 py-1.5 text-[12.5px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
            autoFocus
          />
        </div>
      </div>

      {/* Options list */}
      <div className="max-h-64 overflow-y-auto py-1">
        {filteredOptions.length === 0 && (
          <div className="px-3 py-3 text-[12px] text-slate-400 italic text-center">
            No matching options
          </div>
        )}
        {filteredOptions.map((opt) => {
          const isSelected = selected.includes(opt.value);
          const count = counts[opt.value] ?? 0;
          return (
            <label
              key={opt.value}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-1.5 cursor-pointer transition-colors',
                'hover:bg-slate-50',
                isSelected && 'bg-brand-50/40',
              )}
            >
              <span
                className={clsx(
                  'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                  isSelected
                    ? 'bg-brand-600 border-brand-600'
                    : 'border-slate-300 bg-white',
                )}
              >
                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(opt.value)}
                className="sr-only"
                aria-label={opt.label}
              />
              <span className="flex-1 text-[13px] text-slate-700">{opt.label}</span>
              <span
                className={clsx(
                  'text-[10px] tabular-nums px-1.5 py-0.5 rounded-full',
                  count > 0
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-slate-50 text-slate-400',
                )}
              >
                {count}
              </span>
            </label>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
        <button
          type="button"
          onClick={onClear}
          disabled={selected.length === 0}
          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3 h-3" />
          Clear
        </button>
        <span className="text-[10px] text-slate-400">
          {selected.length} selected
        </span>
      </div>
    </div>
  );
}

/** The trigger button that opens the popover. */
export function JobFilterTrigger({
  category,
  selected,
  onClick,
}: {
  category: FilterCategory;
  selected: FilterValue[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`filter-trigger-${category.id}`}
      data-active={selected.length > 0}
      className={clsx(
        'inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium rounded-md border transition-colors',
        selected.length > 0
          ? 'bg-brand-50 border-brand-300 text-brand-700'
          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300',
      )}
    >
      <span>{category.label}</span>
      {selected.length > 0 && (
        <span className="px-1 text-[10px] font-semibold bg-brand-100 text-brand-800 rounded">
          {selected.length}
        </span>
      )}
      <ChevronDown className="w-3 h-3 opacity-60" />
    </button>
  );
}
