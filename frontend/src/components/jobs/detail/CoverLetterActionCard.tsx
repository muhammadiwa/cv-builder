/**
 * CoverLetterActionCard — second action in the AI Action Center.
 *
 * State-driven. Hooks to /cover-letters pre-filtered by job_id when
 * the BE exposes that query. For now, links to the cover letter page
 * with the job_id so the user lands on a focused creation flow.
 */
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { CVDraft, CoverLetterOut } from '../../../lib/api';

export interface CoverLetterActionCardProps {
  jobId: string;
  cvDraft: CVDraft | null;
  /** Existing cover letter for this job, if any. */
  coverLetter?: CoverLetterOut | null;
}

function statusPill(status: string): { label: string; cls: string } {
  switch (status) {
    case 'exported':
      return { label: 'Exported', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' };
    case 'ready':
      return { label: 'Draft ready', cls: 'bg-amber-50 border-amber-200 text-amber-700' };
    case 'draft':
    default:
      return { label: 'In progress', cls: 'bg-slate-100 border-slate-200 text-slate-700' };
  }
}

export default function CoverLetterActionCard({
  jobId,
  cvDraft,
  coverLetter,
}: CoverLetterActionCardProps) {
  // Existing cover letter — show view/edit instead of generate.
  if (coverLetter) {
    const pill = statusPill(coverLetter.status);
    return (
      <div data-testid="cover-letter-action" className="card card-pad border-brand-200 bg-gradient-to-br from-brand-50/40 to-white">
        <div className="flex items-start gap-2.5">
          <Mail className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-slate-900">
                Cover letter
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 border rounded text-[10px] font-semibold uppercase tracking-wider ${pill.cls}`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {pill.label}
              </span>
            </div>
            <p className="text-[12px] text-slate-600 mt-0.5">
              {coverLetter.subject || 'Personalized cover letter'} · Score {Math.round((coverLetter.score ?? 0) * 100)}%
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Link
                to={`/cover-letters/${coverLetter.id}`}
                data-testid="view-cover-letter"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-medium rounded-md"
              >
                View cover letter <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                to={`/cover-letters?job_id=${jobId}`}
                data-testid="regenerate-cover-letter"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 hover:text-slate-900"
              >
                Regenerate
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If a CV draft exists, base the cover letter on it.
  if (cvDraft) {
    return (
      <div data-testid="cover-letter-action" className="card card-pad">
        <div className="flex items-start gap-2.5">
          <Mail className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-slate-900">
              Build cover letter
            </h3>
            <p className="text-[12px] text-slate-600 mt-0.5">
              Personalized cover letter for this company and role.
            </p>
            <Link
              to={`/cover-letters?job_id=${jobId}&cv_id=${cvDraft.id}`}
              data-testid="generate-cover-letter"
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 border border-brand-200 bg-white hover:bg-brand-50 text-brand-700 text-[12px] font-medium rounded-md"
            >
              Generate cover letter <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="cover-letter-action" className="card card-pad">
      <div className="flex items-start gap-2.5">
        <Mail className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Build cover letter
          </h3>
          <p className="text-[12px] text-slate-600 mt-0.5">
            Personalized cover letter for this company and role.
          </p>
          <p
            data-testid="cover-letter-warning"
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-amber-700"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Build your tailored CV first for the best cover letter output.
          </p>
          <div className="mt-2">
            <Link
              to={`/cover-letters?job_id=${jobId}`}
              data-testid="generate-cover-letter-blank"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-600 hover:text-slate-900"
            >
              Generate anyway <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
