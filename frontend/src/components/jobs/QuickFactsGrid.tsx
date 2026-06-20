/**
 * Reusable hero "quick facts" grid used by JobDetailPage.
 *
 * P2 fix (Phase 5 review): the original inline grid was copy-paste
 * territory waiting to happen — CV drafts need the same salary/type/
 * experience/education strip. This component accepts a `facts` array
 * and renders any subset; callers pass only the rows that apply.
 */
import {
  DollarSign,
  Clock,
  Briefcase,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react';

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
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
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
        <div className="col-span-2 md:col-span-4 text-[12px] text-slate-500 italic">
          {footer}
        </div>
      )}
    </div>
  );
}