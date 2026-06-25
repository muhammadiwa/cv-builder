/**
 * TailoredCVActionCard — primary CTA in the AI Action Center.
 *
 * Behavior rules:
 *   - Job not analyzed yet → show "Run analysis first" (no Build CTA)
 *   - Base Profile missing → show "Complete Base Profile first"
 *   - CV draft exists → show "View CV draft" / "Continue editing"
 *   - Otherwise → "Build Tailored CV"
 *
 * No fake "ATS score: 92%" promises. Real status from BE.
 */
import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import type { JobStatus, CVDraft } from '../../../lib/api';

export interface TailoredCVActionCardProps {
  jobStatus: JobStatus;
  cvDraft: CVDraft | null;
  hasBaseProfile: boolean;
  /** Phase 10K: trigger the slide-out drawer instead of a route
   *  jump when the user clicks "Build tailored CV" or "Regenerate". */
  onOpen: () => void;
}

function statusPill(status: CVDraft['status']): { label: string; cls: string } {
  switch (status) {
    case 'exported':
      return {
        label: 'Exported',
        cls: 'bg-emerald-50 border-emerald-200 text-emerald-700',
      };
    case 'ready':
      return {
        label: 'Draft ready',
        cls: 'bg-amber-50 border-amber-200 text-amber-700',
      };
    case 'draft':
    default:
      return {
        label: 'In progress',
        cls: 'bg-slate-100 border-slate-200 text-slate-700',
      };
  }
}

export default function TailoredCVActionCard({
  jobStatus,
  cvDraft,
  hasBaseProfile,
  onOpen,
}: TailoredCVActionCardProps) {
  // Block: analyze first
  if (jobStatus !== 'parsed') {
    return (
      <div
        data-testid="tailored-cv-action"
        className="card card-pad border-brand-200"
      >
        <div className="flex items-start gap-2.5">
          <FileText className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-slate-900">
              Customize your resume
            </h3>
            <p className="text-[12px] text-slate-600 mt-0.5">
              Run the analysis first to see if this role is a fit.
            </p>
            <Link
              to="/jobs"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-800"
            >
              Back to jobs <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Block: profile missing
  if (!hasBaseProfile) {
    return (
      <div
        data-testid="tailored-cv-action"
        className="card card-pad border-brand-200"
      >
        <div className="flex items-start gap-2.5">
          <FileText className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-slate-900">
              Customize your resume
            </h3>
            <p className="text-[12px] text-slate-600 mt-0.5">
              Complete your Base Profile first to enable tailored CVs.
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

  // Primary CTA: CV draft exists → link to CV draft
  if (cvDraft) {
    const pill = statusPill(cvDraft.status);
    return (
      <div
        data-testid="tailored-cv-action"
        className="card card-pad border-brand-200 bg-gradient-to-br from-brand-50/40 to-white"
      >
        <div className="flex items-start gap-2.5">
          <FileText className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-slate-900">
                Customize your resume
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 border rounded text-[10px] font-semibold uppercase tracking-wider ${pill.cls}`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {pill.label}
              </span>
            </div>
            <p className="text-[12px] text-slate-600 mt-0.5 truncate">
              {cvDraft.title || 'Tailored CV'}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={onOpen}
                data-testid="view-cv-draft"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-medium rounded-md"
              >
                View CV draft <ArrowRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={onOpen}
                data-testid="regenerate-cv"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 hover:text-slate-900"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Primary CTA: no draft yet → start one
  return (
    <div
      data-testid="tailored-cv-action"
      className="card card-pad border-brand-200 bg-gradient-to-br from-brand-50/40 to-white"
    >
      <div className="flex items-start gap-2.5">
        <FileText className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Customize your resume
          </h3>
          <p className="text-[12px] text-slate-600 mt-0.5">
            Create an ATS-optimized CV tailored to this role.
          </p>
          <button
            type="button"
            onClick={onOpen}
            data-testid="build-cv-cta"
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-[12px] font-medium rounded-md"
          >
            Build tailored CV <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
