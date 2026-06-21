/**
 * JobResponsibilitiesSection — Phase 10F content section.
 *
 * Renders responsibilities from the parsed job analysis as a clean
 * bullet list. Empty / null arrays are gracefully hidden. If the
 * parser only found 1-2 items, no "Show more" affordance is needed.
 */
import { ListChecks } from 'lucide-react';

export interface JobResponsibilitiesSectionProps {
  responsibilities: string[] | null | undefined;
}

export default function JobResponsibilitiesSection({
  responsibilities,
}: JobResponsibilitiesSectionProps) {
  const items = (responsibilities || []).filter(
    (r) => typeof r === 'string' && r.trim().length > 0,
  );
  if (items.length === 0) return null;

  return (
    <section
      data-testid="job-responsibilities"
      className="card card-pad"
      aria-label="Responsibilities"
    >
      <h2 className="section-title mb-3 flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-brand-600" />
        What you'll do
      </h2>
      <ul className="space-y-2">
        {items.map((r, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[13.5px] text-slate-700 leading-relaxed"
          >
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full mt-2 shrink-0" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
