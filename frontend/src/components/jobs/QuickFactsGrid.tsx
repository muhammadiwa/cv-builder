/**
 * Reusable hero "quick facts" grid used by JobDetailPage.
 *
 * Phase 10D: count-aware columns — 1 fact = 1 col, 2 = 1+2, 3 = 1+3,
 * 4+ = 2+4. Previously always used grid-cols-4 which left 3 empty
 * cells when only 1-2 facts were present.
 */
import { type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export interface QuickFact {
  icon: LucideIcon;
  label: string;
  value: string;
}

interface QuickFactsGridProps {
  facts: QuickFact[];
  /** Extra row spanning full width (e.g. "Salary not stated in JD"). */
  footer?: string;
}

export default function QuickFactsGrid({ facts, footer }: QuickFactsGridProps) {
  if (facts.length === 0 && !footer) return null;
  // Pick the column count that best matches the fact count so we don't
  // leave gaping empty cells on jobs with sparse data.
  const colsClass =
    facts.length <= 1 ? 'grid-cols-1'
    : facts.length === 2 ? 'grid-cols-1 sm:grid-cols-2'
    : facts.length === 3 ? 'grid-cols-1 sm:grid-cols-3'
    : 'grid-cols-2 md:grid-cols-4';
  return (
    <div className={clsx('grid gap-3 pt-4 border-t border-slate-100', colsClass)}>
      {facts.map((f, i) => (
        <div key={`${f.label}-${i}`}>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
            <f.icon className="w-3 h-3" />
            {f.label}
          </div>
          <div className="text-[14px] font-semibold text-slate-900">
            {f.value}
          </div>
        </div>
      ))}
      {footer && (
        <div className="col-span-full text-[12px] text-slate-500 italic">
          {footer}
        </div>
      )}
    </div>
  );
}
