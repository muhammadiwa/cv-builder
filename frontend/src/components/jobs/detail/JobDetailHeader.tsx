/**
 * JobDetailHeader — page header for the Job Detail page (Phase 10F).
 *
 * Replaces the old inline PageHeader block. Shows:
 *   - Breadcrumb (Jobs / <Job title>)
 *   - Status badges (AI Analyzed, New, Tailored CV Ready, etc.)
 *   - Primary title
 *   - Company line (Company · Location · Work Mode)
 *   - Top-right action group (Back, Open URL, Reanalyze, More menu,
 *     Delete with confirmation dialog)
 *
 * Visual direction: clean header with a single status-pill row, no
 * oversized hero, no stacked full-width action bar. The delete action
 * lives in the overflow menu so it's available but never dominant.
 */
import { useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  ExternalLink,
  RotateCw,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import type { JobOut, JobStatus } from '../../../lib/api';

export interface JobDetailHeaderProps {
  job: JobOut;
  /** True when the job has a populated job_analysis_json. */
  hasAnalysis: boolean;
  /** Tailored CV is present (drives the "CV Ready" pill). */
  hasTailoredCv?: boolean;
  /** Cover letter is present (drives the "Cover Letter Ready" pill). */
  hasCoverLetter?: boolean;
  /** Application status pill (Saved / Applied / etc.) — optional. */
  applicationStatus?: string | null;
  onBack: () => void;
  onReanalyze: () => void;
  onDelete: () => void;
  deleting?: boolean;
  reanalyzing?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  scraping: 'Reading job description',
  parsing: 'Analyzing requirements',
  pending: 'Analyzing',
  parsed: 'AI Analyzed',
  failed: 'Analysis failed',
};

function statusPill(
  status: JobStatus,
  hasAnalysis: boolean,
): { label: string; cls: string } | null {
  if (hasAnalysis) {
    return {
      label: 'AI Analyzed',
      cls: 'bg-gradient-to-br from-brand-50 to-brand-100 border-brand-200 text-brand-700',
    };
  }
  if (status === 'failed') {
    return {
      label: 'Analysis failed',
      cls: 'bg-red-50 border-red-200 text-red-700',
    };
  }
  if (status === 'scraping' || status === 'parsing' || status === 'pending') {
    return {
      label: STATUS_LABEL[status] || 'Analyzing',
      cls: 'bg-amber-50 border-amber-200 text-amber-700',
    };
  }
  return null;
}

export default function JobDetailHeader({
  job,
  hasAnalysis,
  hasTailoredCv,
  hasCoverLetter,
  applicationStatus,
  onBack,
  onReanalyze,
  onDelete,
  deleting,
  reanalyzing,
}: JobDetailHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pill = statusPill(job.status, hasAnalysis);

  // Build company line. Skip empty bits so we don't show 'A · · · B'.
  const lineBits: string[] = [];
  if (job.company) lineBits.push(job.company);
  if (job.location) lineBits.push(job.location);
  if (job.remote) lineBits.push('Remote');

  return (
    <div className="space-y-3">
      {/* Phase 10H: breadcrumb removed entirely. The page title +
          the "Back" button in the action row already cover the
          navigation need; a redundant breadcrumb above the page
          heading was visual noise. */}

      {/* Status pill row — compact, all on one line */}
      <div className="flex flex-wrap items-center gap-1.5">
        {pill && (
          <span
            data-testid="status-pill"
            className={clsx(
              'inline-flex items-center gap-1 px-2 py-0.5 border rounded-md text-[10px] font-semibold uppercase tracking-wider',
              pill.cls,
            )}
          >
            <Sparkles className="w-3 h-3" />
            {pill.label}
          </span>
        )}
        {hasTailoredCv && (
          <span
            data-testid="cv-ready-pill"
            className="inline-flex items-center gap-1 px-2 py-0.5 border rounded-md text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 border-emerald-200 text-emerald-700"
          >
            Tailored CV Ready
          </span>
        )}
        {hasCoverLetter && (
          <span
            data-testid="cover-letter-pill"
            className="inline-flex items-center gap-1 px-2 py-0.5 border rounded-md text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 border-emerald-200 text-emerald-700"
          >
            Cover Letter Ready
          </span>
        )}
        {applicationStatus && (
          <span
            data-testid="application-status-pill"
            className="inline-flex items-center gap-1 px-2 py-0.5 border rounded-md text-[10px] font-semibold uppercase tracking-wider bg-slate-100 border-slate-200 text-slate-700"
          >
            {applicationStatus}
          </span>
        )}
      </div>

      {/* Title + company line + actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1
            data-testid="job-title"
            className="text-[24px] font-bold text-slate-900 leading-tight"
          >
            {job.title || 'Untitled role'}
          </h1>
          {lineBits.length > 0 && (
            <p
              data-testid="job-company-line"
              className="text-[13px] text-slate-600 mt-1 truncate"
            >
              {lineBits.join(' · ')}
            </p>
          )}
        </div>

        {/* Top-right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onBack}
            data-testid="back-to-jobs"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white text-[13px] text-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          {job.source_url && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="open-source-url"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white text-[13px] text-slate-700 rounded-lg transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Original
            </a>
          )}
          <button
            type="button"
            onClick={onReanalyze}
            disabled={reanalyzing}
            data-testid="reanalyze-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white text-[13px] text-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCw className={clsx('w-3.5 h-3.5', reanalyzing && 'animate-spin')} />
            Reanalyze
          </button>

          {/* More menu — Delete lives here so it's available but never dominant */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              data-testid="more-actions-btn"
              className="inline-flex items-center justify-center w-9 h-9 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 rounded-lg transition-colors"
              aria-label="More actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {moreOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMoreOpen(false)}
                  aria-hidden
                />
                <div
                  data-testid="more-actions-menu"
                  className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      onDelete();
                    }}
                    disabled={deleting}
                    data-testid="delete-job-menu-item"
                    className="w-full text-left px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete job…
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
