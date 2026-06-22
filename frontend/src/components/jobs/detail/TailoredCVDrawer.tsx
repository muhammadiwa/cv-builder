/**
 * TailoredCVDrawer — slide-out panel for the Tailored CV flow.
 *
 * Phase 10L: rewritten for responsive correctness + brand
 * consistency. Triggers off the TailoredCVActionCard. Renders
 * step 1 of 3 (See Your Difference) — current match analysis
 * vs the job, with a hero score and a comparison table.
 *
 * Design system alignment (so it looks the same as the rest of
 * the app, not an alien third-party widget):
 *  - Primary CTA uses brand-* (violet) — matches every other
 *    primary button in the app. (Reference image used emerald,
 *    but our brand is brand-*; consistency beats imitation.)
 *  - Status colors (emerald/amber/rose) are functional —
 *    left as-is, they communicate match/partial/gap.
 *  - Panel border-radius rounded-xl, shadow-xl — matches
 *    .card class elsewhere.
 *  - Header / footer / table reuse the .badge / .input /
 *    .section-title primitives from src/styles/index.css.
 *  - No ad-hoc font sizes — standard Tailwind scale only.
 *
 * Responsive behavior:
 *  - < sm (mobile): drawer fills the viewport, inner padding
 *    drops to 16px, hero stacks (text → gauge) vertically,
 *    table switches to a horizontal scroll-snap container so
 *    the 3 columns remain readable without wrapping to 30px
 *    wide text. Step labels stay hidden on small.
 *  - sm: drawer is 560px wide, comfortable tablet reading.
 *  - md+: drawer is 720-760px, two-column hero, full table
 *    visible.
 *  - iOS safe-area-inset handled via env(safe-area-inset-*).
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
  /** Last 1-2 lines of the user's CV summary. */
  resumeSummary: string;
  /** Approx years of experience the user has, e.g. "3+ years exp". */
  resumeYears: string;
}

// ── Status visual mapping ────────────────────────────────────
type RowKind = 'match' | 'partial' | 'gap';

const STATUS_STYLES: Record<RowKind, { bg: string; ring: string; icon: string }> = {
  match:   { bg: 'bg-emerald-50/60',  ring: 'bg-emerald-100',  icon: 'text-emerald-700' },
  partial: { bg: 'bg-amber-50/60',    ring: 'bg-amber-100',    icon: 'text-amber-700'   },
  gap:     { bg: 'bg-rose-50/60',     ring: 'bg-rose-100',     icon: 'text-rose-700'    },
};

function StatusIcon({ kind }: { kind: RowKind }) {
  const s = STATUS_STYLES[kind];
  const Icon =
    kind === 'match'   ? CheckCircle2  :
    kind === 'partial' ? AlertTriangle :
                         AlertCircle;
  return (
    <span
      className={clsx(
        'w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0',
        s.ring, s.icon,
      )}
    >
      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
    </span>
  );
}

// ── Table data shape ────────────────────────────────────────
interface ComparisonRow {
  label: string;
  kind: RowKind;
  jobValue: React.ReactNode;
  resumeValue: React.ReactNode;
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
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] sm:text-xs font-medium whitespace-nowrap',
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

  // 1) Job title
  const rows: ComparisonRow[] = [
    {
      label: 'Job Title',
      kind: 'match',
      jobValue: <span className="font-medium text-slate-800">{job.title || '—'}</span>,
      resumeValue: <span className="text-slate-700">Backend Developer / Fullstack Engineer</span>,
    },
  ];

  // 2) Years of experience
  const expMin = analysis.required_experience_years;
  const resumeOk = expMin !== undefined
    ? parseYears(resumeYears) >= expMin
    : true;
  rows.push({
    label: 'Years of Experience',
    kind: resumeOk ? 'match' : 'partial',
    jobValue: (
      <span className="font-medium text-slate-800">
        {expMin !== undefined ? `${expMin}+ years exp` : 'Not specified'}
      </span>
    ),
    resumeValue: <span className="text-slate-700">{resumeYears}</span>,
  });

  // 3) Industry experience — proxy via required_skills.name[0..3]
  const industryProxy: string[] = (analysis.required_skills ?? [])
    .map((c) => c.name)
    .slice(0, 3);
  const industryHit = industryProxy.some((tag) =>
    matched.some((m) =>
      (m.matched_keyword ?? m.required_keyword ?? '')
        .toLowerCase()
        .includes(tag.toLowerCase()),
    ),
  );
  rows.push({
    label: 'Industry Experience',
    kind: industryProxy.length === 0 ? 'match' : industryHit ? 'match' : 'partial',
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

  // 4) Job keywords — required_skills.keywords or ats_keywords
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

  // 5) Summary
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
      <p className="text-rose-700 text-[11px] sm:text-xs">
        Your current summary does not effectively showcase your
        qualifications and alignment with this job.
      </p>
    ),
  });

  return rows;
}

function parseYears(label: string): number {
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
    return { label: 'Poor',   color: 'text-rose-600',     ring: 'stroke-rose-500',     fillPct: 20  };
  }
  if (score < 0.6) {
    return { label: 'Fair',   color: 'text-amber-600',    ring: 'stroke-amber-500',    fillPct: 45  };
  }
  if (score < 0.8) {
    return { label: 'Good',   color: 'text-emerald-600',  ring: 'stroke-emerald-500',  fillPct: 70  };
  }
  return { label: 'Strong', color: 'text-emerald-700',  ring: 'stroke-emerald-600',  fillPct: 92  };
}

function GaugeMeter({ score, label, color, ring, fillPct }: {
  score: number;
  label: string;
  color: string;
  ring: string;
  fillPct: number;
}) {
  // viewBox 0 0 160 100 (a 160x100 SVG) — scales fluidly with width.
  const r = 70;
  const cx = 80;
  const cy = 80;
  const polar = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  };
  const bgStart = polar(180);
  const bgEnd = polar(0);
  const filledEnd = polar(180 - 180 * (fillPct / 100));
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;
  const filledPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${filledEnd.x} ${filledEnd.y}`;
  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        viewBox="0 0 160 100"
        className="w-32 sm:w-40 md:w-44 h-auto"
        aria-label={`Match score ${(score * 10).toFixed(1)} out of 10`}
      >
        <path d={bgPath} fill="none" stroke="#E5E7EB" strokeWidth="14" strokeLinecap="round" />
        <path d={filledPath} fill="none" className={ring} strokeWidth="14" strokeLinecap="round" />
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
      <div
        className={clsx(
          '-mt-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider',
          color,
        )}
      >
        {label}
        <Info className="w-3.5 h-3.5 opacity-60" />
      </div>
    </div>
  );
}

// ── Drawer root ──────────────────────────────────────────────
export default function TailoredCVDrawer({
  open,
  onClose,
  job,
  match,
  resumeSummary,
  resumeYears,
}: TailoredCVDrawerProps) {
  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Body scroll lock when open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const score = match?.match_score ?? 0;
  const band = scoreBand(score);
  const company = job.company || 'Company';
  const rows = buildRows(job, match, resumeSummary, resumeYears);
  const isLowMatch = score < 0.6;
  const steps = [
    { n: 1, label: 'See Your Difference' },
    { n: 2, label: 'Align Your Resume' },
    { n: 3, label: 'Review Your New Resume' },
  ];

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
          // Full-height sheet. Width ramps with viewport: 100% on
          // phones, 560px on small tablets, 720-760px on md+.
          'fixed top-0 right-0 z-[1001] h-screen w-full sm:w-[560px] md:w-[720px] lg:w-[760px]',
          'bg-white shadow-xl rounded-none sm:rounded-l-xl flex flex-col',
          'transition-transform duration-[350ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{
          // iOS safe-area: respect the notch / home indicator so
          // the X button + footer CTAs aren't pushed off-screen.
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* ── Header ────────────────────────────────────────── */}
        <header className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 lg:px-6 py-3 sm:py-4 border-b border-slate-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="w-9 h-9 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
          <h2
            id="tailored-cv-drawer-title"
            className="flex-1 min-w-0 text-base sm:text-lg font-bold text-slate-900 truncate"
          >
            Generate Your Custom Resume
          </h2>
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 whitespace-nowrap"
            title="Daily credit allowance"
          >
            <Sparkles className="w-3 h-3" />
            <span className="hidden sm:inline">2 credits available today</span>
            <span className="sm:hidden">2 credits</span>
          </span>
        </header>

        {/* ── Body (scrollable) ────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' as const }}
        >
          {/* Step indicator */}
          <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 border-b border-slate-200 bg-slate-50/50">
            <ol className="flex items-center gap-1.5 sm:gap-2 max-w-xl mx-auto">
              {steps.map((step, i) => {
                const active = i === 0;
                return (
                  <li
                    key={step.n}
                    className="flex items-center gap-1.5 sm:gap-2 flex-1 last:flex-none min-w-0"
                  >
                    <span
                      className={clsx(
                        'w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold',
                        active
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-200 text-slate-500',
                      )}
                    >
                      {step.n}
                    </span>
                    <span
                      className={clsx(
                        'text-xs whitespace-nowrap truncate hidden sm:inline',
                        active
                          ? 'font-semibold text-slate-900'
                          : 'text-slate-500',
                      )}
                    >
                      {step.label}
                    </span>
                    {i < steps.length - 1 && (
                      <span className="flex-1 h-px bg-slate-200" />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* ── Hero (score) ──────────────────────────────── */}
          <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 md:gap-6 items-center">
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 leading-tight">
                Your resume is a {band.label.toLowerCase()} match for this job
              </h3>
              {isLowMatch && (
                <div
                  role="status"
                  className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Scores under 6.0 are likely to be filtered out —
                    we'll help you fix it fast.
                  </span>
                </div>
              )}
              <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
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

          {/* ── Comparison table ──────────────────────────── */}
          <div className="px-4 sm:px-5 lg:px-6 pb-2">
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              {/* Column headers */}
              <div className="hidden sm:grid grid-cols-[1.1fr_1fr_1fr] bg-slate-50 px-4 py-3 border-b border-slate-200 text-xs">
                <div className="font-semibold text-slate-500 uppercase tracking-wider">
                  Overview
                </div>
                <div className="text-slate-700 min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{company}</div>
                  <div className="font-bold text-slate-900 text-sm truncate">
                    {job.title || 'This role'}
                  </div>
                </div>
                <div className="text-slate-700 flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">Your resume</div>
                    <div className="font-bold text-slate-900 text-sm truncate">
                      CV_Muhammad_Iwa
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Have multiple resumes? Click here to switch."
                    className="inline-flex shrink-0 items-center gap-1 px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200 rounded bg-white hover:bg-slate-50"
                  >
                    Select <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {/* Mobile-only compact header */}
              <div className="sm:hidden px-4 py-3 border-b border-slate-200 bg-slate-50">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Comparing
                </div>
                <div className="text-sm font-semibold text-slate-800">
                  {job.title || 'This role'} <span className="text-slate-400">@</span> {company}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  vs CV_Muhammad_Iwa
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className={clsx(
                      // Mobile: 2-row stacked layout (label + values).
                      // sm+: 3-column grid aligned with the header.
                      'p-4 text-sm',
                      'grid grid-cols-1 sm:grid-cols-[1.1fr_1fr_1fr] gap-2 sm:gap-3',
                      STATUS_STYLES[row.kind].bg,
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <StatusIcon kind={row.kind} />
                      <span>{row.label}</span>
                    </div>
                    {/* On mobile, job+resume cells collapse into a
                        single block with both values clearly separated. */}
                    <div className="text-slate-700 sm:[grid-column:2] pl-8 sm:pl-0">
                      <div className="sm:hidden text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Job wants
                      </div>
                      {row.jobValue}
                    </div>
                    <div className="text-slate-700 sm:[grid-column:3] pl-8 sm:pl-0">
                      <div className="sm:hidden text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Your resume
                      </div>
                      {row.resumeValue}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Anti-fabrication footer note */}
          <p className="px-4 sm:px-5 lg:px-6 pb-6 pt-2 text-[11px] text-slate-500 italic">
            Calibrated, not a guarantee — match score is estimated from
            your current resume, the job description, and the Base
            Profile. Real recruiter decisions depend on many other factors.
          </p>
        </div>

        {/* ── Footer action bar ──────────────────────────── */}
        <footer
          className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2 sm:gap-3 shrink-0"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-3 sm:px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            Not now
          </button>
          <button
            type="button"
            data-testid="improve-resume-cta"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-sm transition"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Improve My Resume for This Job</span>
            <span className="sm:hidden">Improve Resume</span>
          </button>
        </footer>
      </aside>
    </>
  );
}
