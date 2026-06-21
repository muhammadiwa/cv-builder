/**
 * JobQualificationsSection — Phase 10F.
 *
 * Required / Preferred / Nice-to-have subsections. Each item shows a
 * tiny match status (Matched / Partial / Missing / Unknown) drawn
 * from the job's matched_skills_json / missing_skills_json.
 *
 * Anti-fabrication: status is "Unknown" unless the match data actually
 * says so. We never claim "Matched" for an item not present in the
 * matched list.
 */
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

type Status = 'Matched' | 'Partial' | 'Missing' | 'Unknown';

const STATUS_ICON: Record<Status, typeof CheckCircle2> = {
  Matched: CheckCircle2,
  Partial: AlertTriangle,
  Missing: XCircle,
  Unknown: HelpCircle,
};

const STATUS_CLS: Record<Status, string> = {
  Matched: 'text-emerald-600',
  Partial: 'text-amber-600',
  Missing: 'text-red-600',
  Unknown: 'text-slate-400',
};

export interface JobQualificationsSectionProps {
  /**
   * Required qualifications. We don't currently parse these separately
   * from required_skills, so this is mostly derived from the same data.
   * Kept as a separate prop so the API can grow into it.
   */
  required: string[];
  preferred: string[];
  niceToHave?: string[];
  /** For status inference — same shape used everywhere. */
  matchedKeywords?: string[];
  /** For status inference — items not found in the profile. */
  missingKeywords?: string[];
}

function statusFor(
  item: string,
  matched: Set<string>,
  missing: Set<string>,
): Status {
  const lc = item.toLowerCase();
  for (const m of matched) {
    if (lc.includes(m.toLowerCase()) || m.toLowerCase().includes(lc)) {
      return 'Matched';
    }
  }
  for (const m of missing) {
    if (lc.includes(m.toLowerCase()) || m.toLowerCase().includes(lc)) {
      return 'Missing';
    }
  }
  return 'Unknown';
}

function List({
  title,
  items,
  matched,
  missing,
  testId,
}: {
  title: string;
  items: string[];
  matched: Set<string>;
  missing: Set<string>;
  testId: string;
}) {
  if (items.length === 0) return null;
  return (
    <div data-testid={testId} className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((it, i) => {
          const status = statusFor(it, matched, missing);
          const Icon = STATUS_ICON[status];
          return (
            <li
              key={i}
              className="flex items-start gap-2 text-[13px] text-slate-700"
            >
              <Icon
                className={clsx('w-3.5 h-3.5 mt-0.5 shrink-0', STATUS_CLS[status])}
              />
              <span className="flex-1">
                {it}
                <span
                  className={clsx(
                    'ml-1.5 text-[10px] font-semibold uppercase tracking-wider',
                    STATUS_CLS[status],
                  )}
                >
                  {status}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function JobQualificationsSection({
  required,
  preferred,
  niceToHave,
  matchedKeywords = [],
  missingKeywords = [],
}: JobQualificationsSectionProps) {
  const matched = new Set(matchedKeywords);
  const missing = new Set(missingKeywords);

  if (
    required.length === 0 &&
    preferred.length === 0 &&
    (!niceToHave || niceToHave.length === 0)
  ) {
    return null;
  }

  return (
    <section
      data-testid="job-qualifications"
      className="card card-pad space-y-4"
      aria-label="Qualifications"
    >
      <h2 className="section-title mb-0">Qualifications</h2>
      <List
        title="Required"
        items={required}
        matched={matched}
        missing={missing}
        testId="qual-required"
      />
      <List
        title="Preferred"
        items={preferred}
        matched={matched}
        missing={missing}
        testId="qual-preferred"
      />
      {niceToHave && niceToHave.length > 0 && (
        <List
          title="Nice to have"
          items={niceToHave}
          matched={matched}
          missing={missing}
          testId="qual-nice"
        />
      )}
      <p className="text-[11px] text-slate-500 italic pt-2 border-t border-slate-100">
        Status reflects Base Profile evidence — not a guarantee of fit.
      </p>
    </section>
  );
}
