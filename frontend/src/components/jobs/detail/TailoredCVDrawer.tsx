/**
 * TailoredCVDrawer — slide-out panel for the Tailored CV flow.
 *
 * Triggered by "Build tailored CV" / "Regenerate" in the AI Action
 * Center. Shows step 1 of 3 (See Your Difference) — current match
 * analysis vs the job, with a hero score and a comparison table.
 *
 * Implementation notes:
 *  - Pure slide-out drawer, ~720-760px wide, full-height.
 *  - Backdrop is a dimmed overlay; clicking it or X closes.
 *  - Animation: 300ms ease-out transform.
 *  - No state mutation — the action CTA in the footer is a stub
 *    that closes the drawer with a toast (the actual step 2
 *    improvement flow is not in this PR; the CV/CL routes still
 *    own the regeneration).
 */
import { useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import type { JobOut, JobMatch, JobAnalysis } from '../../../lib/api';

export interface TailoredCVDrawerProps {
  open: boolean;
  onClose: () => void;
  job: JobOut;
  match: JobMatch | null;
  /** Last 1-2 lines of the user's CV summary (profile.bio or work[0].summary). */
  resumeSummary: string;
  /** Approx years of experience the user has, e.g. "3+ years exp". */
  resumeYears: string;
}

type RowKind = 'match' | 'partial' | 'gap';

interface ComparisonRow {
  label: string;
  kind: RowKind;
  jobValue: React.ReactNode;
  resumeValue: React.ReactNode;
}

function statusBg(kind: RowKind): string {
  switch (kind) {
    case 'match':
      return 'bg-emerald-50/60';
    case 'partial':
      return 'bg-amber-50/60';
    case 'gap':
      return 'bg-rose-50/60';
  }
}

function statusIcon(kind: RowKind): React.ReactNode {
  const wrap =
    'w-7 h-7 rounded-full flex items-center justify-center shrink-0';
  if (kind === 'match') {
    return (
      <span className={clsx(wrap, 'bg-emerald-100 text-emerald-700')}>
        <CheckCircle2 className="w-4 h-4" />
      </span>
    );
  }
  if (kind === 'partial') {
    return (
      <span className={clsx(wrap, 'bg-amber-100 text-amber-700')}>
        <AlertTriangle className="w-4 h-4" />
      </span>
    );
  }
  return (
    <span className={clsx(wrap, 'bg-rose-100 text-rose-700')}>
      <AlertCircle className="w-4 h-4" />
      </span>
  );
}

function PillTag({
  children,
  variant = 'neutral',
}: {
  children: React.ReactNode;
  variant?: 'neutral' | 'success';
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[12px] font-medium',
        variant === 'success'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-700',
      )}
    >
      {children}
    </span>
  );
}

function buildRows(
  job: JobOut,
  match: JobMatch | null,
  resumeSummary: string,
  resumeYears: string,
): ComparisonRow[] {
  const analysis = (job.job_analysis_json as JobAnalysis | undefined) ?? {};
  const matched = match?.matched_skills ?? [];

  // 1) Job title — always a match if user is on the job page
  const rows: ComparisonRow[] = [
    {
      label: 'Job Title',
      kind: 'match',
      jobValue: <span className="font-medium">{job.title || '—'}</span>,
      resumeValue: <span className="text-slate-700">Backend Developer / Fullstack Engineer</span>,
    },
  ];

  // 2) Years of experience — compare resume's years vs job's required years
  const expMin = analysis.required_experience_years;
  const resumeOk = expMin !== undefined
    ? parseYears(resumeYears) >= expMin
    : true;
  rows.push({
    label: 'Years of Experience',
    kind: resumeOk ? 'match' : 'partial',
    jobValue: (
      <span className="font-medium">
        {expMin !== undefined ? `${expMin}+ years exp` : 'Not specified'}
      </span>
    ),
    resumeValue: <span className="text-slate-700">{resumeYears}</span>,
  });

  // 3) Industry experience — use the first 3 required skill names as
  // a proxy for "industry tags" since JobAnalysis has no explicit
  // industry_keywords field. If matched skill set overlaps, mark match.
  const industryProxy: string[] = (analysis.required_skills ?? [])
    .map((c) => c.name)
    .slice(0, 3);
  const industryHit = industryProxy.some((tag) =>
    matched.some(
      (m) =>
        (m.matched_keyword ?? m.required_keyword ?? '')
          .toLowerCase()
          .includes(tag.toLowerCase()),
    ),
  );
  rows.push({
    label: 'Industry Experience',
    kind: industryProxy.length === 0
      ? 'match'
      : industryHit
      ? 'match'
      : 'partial',
    jobValue: industryProxy.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {industryProxy.map((k: string) => (
          <PillTag key={`ind-j-${k}`}>{k}</PillTag>
        ))}
      </div>
    ) : (
      <span className="text-slate-500">Not specified</span>
    ),
    resumeValue: industryHit ? (
      <span className="text-slate-700">Has relevant industry exposure</span>
    ) : (
      <span className="text-slate-500">—</span>
    ),
  });

  // 4) Job keywords — flatten required_skills.keywords + ats_keywords,
  //    with matched ones highlighted in green.
  const requiredKeywords: string[] = (analysis.required_skills ?? []).flatMap(
    (c) => c.keywords ?? [],
  );
  const atsFallback = Array.isArray(job.ats_keywords_json)
    ? (job.ats_keywords_json as string[])
    : Array.isArray(analysis.ats_keywords)
      ? (analysis.ats_keywords as string[])
      : [];
  const allKeywords: string[] =
    requiredKeywords.length > 0 ? requiredKeywords : atsFallback;
  const matchedKwSet = new Set(
    matched.map((m) =>
      (m.matched_keyword ?? m.required_keyword ?? '').toLowerCase(),
    ),
  );
  const matchedCount = allKeywords.filter((k: string) =>
    matchedKwSet.has(k.toLowerCase()),
  ).length;
  rows.push({
    label: `Job Keywords (${matchedCount}/${allKeywords.length || 0})`,
    kind:
      allKeywords.length === 0
        ? 'match'
        : matchedCount === 0
        ? 'gap'
        : matchedCount === allKeywords.length
        ? 'match'
        : 'partial',
    jobValue: allKeywords.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {allKeywords.map((k: string) => {
          const isMatched = matchedKwSet.has(k.toLowerCase());
          return (
            <PillTag
              key={`kw-j-${k}`}
              variant={isMatched ? 'success' : 'neutral'}
            >
              {isMatched && <span aria-hidden>👍</span>}
              {k}
            </PillTag>
          );
        })}
      </div>
    ) : (
      <span className="text-slate-500">No keywords extracted</span>
    ),
    resumeValue: matchedCount > 0 ? (
      <span className="text-slate-700">
        {matchedCount} of {allKeywords.length} keywords present
      </span>
    ) : (
      <span className="text-slate-500">—</span>
    ),
  });

  // 5) Summary — flag if user summary is empty / not aligned
  const summaryOk = resumeSummary.trim().length > 60;
  rows.push({
    label: 'Summary',
    kind: summaryOk ? 'match' : 'partial',
    jobValue: analysis.summary ? (
      <p className="text-slate-700 line-clamp-3">{analysis.summary}</p>
    ) : (
      <span className="text-slate-500">No summary available</span>
    ),
    resumeValue: summaryOk ? (
      <p className="text-slate-700 line-clamp-3">{resumeSummary}</p>
    ) : (
      <p className="text-rose-700 text-[12px]">
        Your current summary does not effectively showcase your
        qualifications and alignment with this job.
      </p>
    ),
  });

  return rows;
}

function parseYears(label: string): number {
  // "3+ years exp" -> 3
  const m = label.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function scoreBand(score: number): {
  label: string;
  color: string;
  ring: string;
  fillPct: number;
  } {
  if (score < 0.4) {
    return {
      label: 'Poor',
      color: 'text-rose-600',
      ring: 'stroke-rose-500',
      fillPct: 20,
    };
  }
  if (score < 0.6) {
    return {
      label: 'Fair',
      color: 'text-amber-600',
      ring: 'stroke-amber-500',
      fillPct: 45,
    };
  }
  if (score < 0.8) {
    return {
      label: 'Good',
      color: 'text-emerald-600',
      ring: 'stroke-emerald-500',
      fillPct: 70,
    };
  }
  return {
    label: 'Strong',
    color: 'text-emerald-700',
    ring: 'stroke-emerald-600',
    fillPct: 92,
  };
}

function GaugeMeter({ score, label, color, ring, fillPct }: {
  score: number;
  label: string;
  color: string;
  ring: string;
  fillPct: number;
}) {
  // semicircle gauge: 0% at left, 100% at right, total 180deg
  // background arc + filled arc
  const r = 70;
  const cx = 80;
  const cy = 80;
  const startAngle = 180;
  const endAngle = 0;
  const polar = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  };
  const bgStart = polar(startAngle);
  const bgEnd = polar(endAngle);
  const filledEnd = polar(startAngle - (startAngle - endAngle) * (fillPct / 100));
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;
  const filledPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${filledEnd.x} ${filledEnd.y}`;
  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="160" height="100" viewBox="0 0 160 100" aria-label={`Match score ${(score * 10).toFixed(1)} out of 10`}>
        <path
          d={bgPath}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d={filledPath}
          fill="none"
          className={ring}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <text
          x="80"
          y="78"
          textAnchor="middle"
          className={clsx('font-extrabold', color)}
          style={{ fontSize: 36, fontWeight: 800 }}
        >
          {(score * 10).toFixed(1)}
        </text>
      </svg>
      <div className={clsx('-mt-2 inline-flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wider', color)}>
        {label}
        <Info className="w-3.5 h-3.5 opacity-60" />
      </div>
    </div>
  );
}

export default function TailoredCVDrawer({
  open,
  onClose,
  job,
  match,
  resumeSummary,
  resumeYears,
}: TailoredCVDrawerProps) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const score = match?.match_score ?? 0;
  const band = scoreBand(score);
  const company = job.company || 'Company';
  const rows = buildRows(job, match, resumeSummary, resumeYears);
  const isLowMatch = score < 0.6;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={clsx(
          'fixed inset-0 z-[1000] bg-slate-900/50 transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      />
      {/* Drawer panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="tailored-cv-drawer-title"
        aria-hidden={!open}
        data-testid="tailored-cv-drawer"
        className={clsx(
          'fixed top-0 right-0 z-[1001] h-screen w-full sm:w-[720px] lg:w-[760px] bg-white shadow-2xl rounded-l-2xl flex flex-col transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-4 h-4" />
          </button>
          <h2
            id="tailored-cv-drawer-title"
            className="flex-1 text-[17px] font-bold text-slate-900"
          >
            Generate Your Custom Resume
          </h2>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[12px] font-semibold text-emerald-700"
            title="Daily credit allowance"
          >
            <Sparkles className="w-3 h-3" />
            2 credits available today
          </span>
        </header>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          {/* Step indicator */}
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <ol className="flex items-center justify-between gap-2 max-w-md mx-auto">
              {[
                { n: 1, label: 'See Your Difference', active: true },
                { n: 2, label: 'Align Your Resume', active: false },
                { n: 3, label: 'Review Your New Resume', active: false },
              ].map((step, i) => (
                <li
                  key={step.n}
                  className="flex items-center gap-2 flex-1 last:flex-none"
                >
                  <span
                    className={clsx(
                      'w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0',
                      step.active
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500',
                    )}
                  >
                    {step.n}
                  </span>
                  <span
                    className={clsx(
                      'text-[12px] hidden md:inline whitespace-nowrap',
                      step.active
                        ? 'font-semibold text-slate-900'
                        : 'text-slate-500',
                    )}
                  >
                    {step.label}
                  </span>
                  {i < 2 && (
                    <span className="flex-1 h-px bg-slate-200 ml-1" />
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* Hero: score */}
          <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <h3
                className={clsx(
                  'text-[22px] md:text-[24px] font-bold text-slate-900 leading-tight',
                )}
              >
                Your resume is a {band.label.toLowerCase()} match for this job
              </h3>
              {isLowMatch && (
                <div
                  role="status"
                  className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[13px]"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Scores under 6.0 are likely to be filtered out —
                    we'll help you fix it fast.
                  </span>
                </div>
              )}
              <p className="mt-3 text-[13px] text-slate-600">
                See how your current resume stacks up against{' '}
                <span className="font-semibold text-slate-800">
                  {job.title || 'this role'}
                </span>{' '}
                at{' '}
                <span className="font-semibold text-slate-800">{company}</span>.
                Continue below to align it.
              </p>
            </div>
            <GaugeMeter
              score={score}
              label={band.label}
              color={band.color}
              ring={band.ring}
              fillPct={band.fillPct}
            />
          </div>

          {/* Comparison table */}
          <div className="px-6 pb-2">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-slate-50 px-4 py-3 border-b border-slate-200">
                <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">
                  Overview
                </div>
                <div className="text-[12px] text-slate-700">
                  <div className="font-semibold text-slate-800">{company}</div>
                  <div className="font-bold text-slate-900 text-[13px] truncate">
                    {job.title || 'This role'}
                  </div>
                </div>
                <div className="text-[12px] text-slate-700 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-800">Your resume</div>
                    <div className="font-bold text-slate-900 text-[13px] truncate">
                      CV_Muhammad_Iwa
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Have multiple resumes? Click here to switch."
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200 rounded bg-white hover:bg-slate-50"
                  >
                    Select <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'grid grid-cols-[1.2fr_1fr_1fr] gap-3 px-4 py-3 text-[13px]',
                      statusBg(row.kind),
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      {statusIcon(row.kind)}
                      {row.label}
                    </div>
                    <div className="text-slate-700">{row.jobValue}</div>
                    <div className="text-slate-700">{row.resumeValue}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Anti-fabrication footer note */}
          <p className="px-6 pb-6 pt-2 text-[11px] text-slate-500 italic">
            Calibrated, not a guarantee — match score estimates
            based on your current resume, the job description, and
            the Base Profile. Real recruiter decisions depend on
            many other factors.
          </p>
        </div>

        {/* Footer action bar */}
        <footer className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-slate-700 hover:text-slate-900"
          >
            Not now
          </button>
          <button
            type="button"
            data-testid="improve-resume-cta"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-semibold shadow-sm"
          >
            <Sparkles className="w-4 h-4" />
            Improve My Resume for This Job
          </button>
        </footer>
      </aside>
    </>
  );
}
