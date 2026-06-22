/**
 * ApplicationPackageStatusCard — bottom card in the AI Action Center.
 *
 * Tracks the 4 parts of an "application package":
 *   - Profile Match (analyzed + has match)
 *   - Tailored CV (has CV draft for this job)
 *   - Cover Letter (placeholder for now — BE doesn't filter by job yet)
 *   - Export (CV status === 'exported')
 *
 * Visual: stacked progress bars + a single CTA that opens the most
 * logical next step. Anti-fabrication: nothing here is marked "ready"
 * unless the underlying BE state is actually ready.
 */
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ArrowRight, Package } from 'lucide-react';
import clsx from 'clsx';
import type { JobStatus, JobMatch, CVDraft } from '../../../lib/api';

export interface ApplicationPackageStatusCardProps {
  jobId: string;
  jobStatus: JobStatus;
  match: JobMatch | null;
  cvDraft: CVDraft | null;
  hasBaseProfile: boolean;
}

interface PackageItem {
  label: string;
  done: boolean;
}

function buildItems(
  jobStatus: JobStatus,
  match: JobMatch | null,
  cvDraft: CVDraft | null,
): PackageItem[] {
  return [
    {
      label: 'Profile Match',
      done: jobStatus === 'parsed' && !!match,
    },
    {
      label: 'Tailored CV',
      done: !!cvDraft && cvDraft.status !== 'draft',
    },
    {
      // Cover letter existence not yet queryable per-job. We only
      // mark "ready" if the user has at least reached the CV step,
      // which makes a cover-letter workflow reachable.
      label: 'Cover Letter',
      done: false,
    },
    {
      label: 'Exported',
      done: cvDraft?.status === 'exported',
    },
  ];
}

export default function ApplicationPackageStatusCard({
  jobId,
  jobStatus,
  match,
  cvDraft,
  hasBaseProfile,
}: ApplicationPackageStatusCardProps) {
  const items = buildItems(jobStatus, match, cvDraft);
  const doneCount = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = Math.round((doneCount / total) * 100);

  // Decide the CTA: prioritize next incomplete step.
  const next =
    items.find((i) => !i.done) ?? items[items.length - 1];

  const ctaByLabel: Record<string, { to: string; label: string }> = {
    'Profile Match': {
      to: `/jobs/${jobId}?tab=match`,
      label: 'View match analysis',
    },
    'Tailored CV': {
      to: cvDraft ? `/cvs/${cvDraft.id}` : `/cvs?job_id=${jobId}`,
      label: cvDraft ? 'Open CV draft' : 'Build tailored CV',
    },
    'Cover Letter': {
      to: `/cover-letters?job_id=${jobId}`,
      label: 'Write cover letter',
    },
    Exported: {
      to: cvDraft ? `/cvs/${cvDraft.id}?action=export` : `/cvs?job_id=${jobId}`,
      label: 'Export application',
    },
  };
  const cta = ctaByLabel[next.label] ?? ctaByLabel['Tailored CV'];

  // If we have nothing at all yet (no profile), nudge that first.
  if (!hasBaseProfile) {
    return (
      <div
        data-testid="application-package-card"
        className="card card-pad"
      >
        <div className="flex items-start gap-2.5">
          <Package className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-slate-900">
              Application package
            </h3>
            <p className="text-[12px] text-slate-600 mt-0.5">
              Complete your Base Profile first to start your application package.
            </p>
            <Link
              to="/profile"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-800"
            >
              Open Base Profile <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="application-package-card"
      className="card card-pad"
    >
      <div className="flex items-start gap-2.5">
        <Package className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-slate-900">
              Application package
            </h3>
            <span
              data-testid="application-package-progress"
              className="text-[11px] font-semibold text-slate-600 tabular-nums"
            >
              {doneCount} / {total}
            </span>
          </div>
          {/* Mini progress bar */}
          <div className="h-1.5 bg-slate-100 rounded overflow-hidden mt-1">
            <div
              data-testid="application-package-bar"
              className={clsx(
                'h-full rounded transition-all',
                pct === 100
                  ? 'bg-emerald-500'
                  : pct >= 50
                  ? 'bg-amber-500'
                  : 'bg-brand-500',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          <ul className="mt-2 space-y-1">
            {items.map((it) => (
              <li
                key={it.label}
                className="flex items-center gap-2 text-[12px] text-slate-700"
              >
                {it.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                )}
                <span
                  className={clsx(
                    it.done ? 'text-slate-700' : 'text-slate-500',
                  )}
                >
                  {it.label}
                </span>
              </li>
            ))}
          </ul>

          {doneCount < total && (
            <Link
              to={cta.to}
              data-testid="application-package-cta"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 hover:text-slate-900"
            >
              {cta.label} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
          {doneCount === total && (
            <p
              data-testid="application-package-ready"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ready to apply
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
