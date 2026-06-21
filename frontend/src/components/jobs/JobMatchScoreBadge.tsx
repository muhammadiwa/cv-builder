/**
 * JobMatchScoreBadge — circular progress ring + score number + label.
 *
 * Phase 10D: per spec, the badge sits in the top-right of the job card
 * near the status badge. It's the visual anchor users scan to find
 * their best matches. Clicking the badge opens the Match Score
 * Detail Drawer.
 *
 * Spec coverage:
 *   - G.1: circular mini progress ring + score + label
 *   - G.3: max 2 insights on the card (handled by JobMatchInsightRow)
 *   - G.5: click opens drawer (parent wires onClick)
 *   - H: score states (analyzed/profile, analyzed/no-profile, etc.)
 *
 * The badge is intentionally compact — it's a quick-glance signal, not
 * the full breakdown (that's in the drawer).
 */
import clsx from 'clsx';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  AlertCircle,
  Hourglass,
  User,
} from 'lucide-react';
import type { JobStatus } from '../../lib/api';

export type MatchLabel =
  | 'Excellent'
  | 'Strong'
  | 'Good'
  | 'Partial'
  | 'Low'
  | 'Eligibility Review'
  | 'Pending'
  | 'No profile'
  | 'Unavailable';

export type MatchState =
  | 'analyzed-with-profile'   // score available
  | 'analyzed-no-profile'     // need profile
  | 'low-confidence'          // analyzed but data thin
  | 'scraping'                // match pending
  | 'analyzing'               // match pending
  | 'pending'                 // match pending
  | 'failed';                 // analysis failed

interface JobMatchScoreBadgeProps {
  jobStatus: JobStatus;
  /** 0-1, required for analyzed-with-profile. */
  matchScore: number | null;
  /** Optional confidence indicator (0-1). null = unknown. */
  confidenceScore?: number | null;
  // onClick opens the Match Score Drawer (optional — absent = no interaction).
  // Receives the underlying React.MouseEvent so callers inside a <Link>
  // can stopPropagation + preventDefault to avoid the parent link
  // navigating when the badge is clicked.
  onClick?: (e?: React.MouseEvent) => void;
  /** Compact: hide the label text, keep just the ring + number. */
  compact?: boolean;
}

/** Maps raw 0-1 score to the 5-tier label per spec I. */
export function matchLabelFromScore(score: number): MatchLabel {
  if (score >= 0.9) return 'Excellent';
  if (score >= 0.8) return 'Strong';
  if (score >= 0.7) return 'Good';
  if (score >= 0.6) return 'Partial';
  return 'Low';
}

/** Maps a 0-1 score to the ring's stroke color (red→amber→emerald). */
function ringColor(score: number): string {
  if (score >= 0.7) return 'text-emerald-500';
  if (score >= 0.5) return 'text-amber-500';
  return 'text-red-500';
}

/** Maps a recommendation + score to the ring color (overrides ringColor
 *  when recommendation is "skip" to surface red even at higher scores). */
function ringColorForRec(rec: string | undefined, score: number): string {
  if (rec === 'skip') return 'text-red-500';
  return ringColor(score);
}

/** Label chip background. Per spec I: keep neutral when state is non-applicable. */
function labelCls(label: MatchLabel, rec?: string): string {
  // Eligibility Review always amber, regardless of underlying score
  if (label === 'Eligibility Review') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (rec === 'skip' || label === 'Low') {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  if (label === 'Partial') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (label === 'Good' || label === 'Strong' || label === 'Excellent') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function LabelIcon({ label, rec }: { label: MatchLabel; rec?: string }) {
  const cls = 'w-2.5 h-2.5';
  if (rec === 'skip' || label === 'Low') return <XCircle className={cls} />;
  if (label === 'Partial' || label === 'Eligibility Review') {
    return <AlertTriangle className={cls} />;
  }
  if (label === 'Good' || label === 'Strong' || label === 'Excellent') {
    return <CheckCircle2 className={cls} />;
  }
  return null;
}

/** Resolve (jobStatus, matchScore, confidence) → state + label + display. */
function resolveState(
  jobStatus: JobStatus,
  matchScore: number | null,
  confidenceScore: number | null | undefined,
): { state: MatchState; label: MatchLabel; showRing: boolean; showNumber: boolean; ringScore: number } {
  if (jobStatus === 'parsed' && matchScore != null) {
    // Analyzed + score present
    if (confidenceScore != null && confidenceScore < 0.4) {
      return { state: 'low-confidence', label: 'Low', showRing: true, showNumber: true, ringScore: matchScore };
    }
    return { state: 'analyzed-with-profile', label: matchLabelFromScore(matchScore), showRing: true, showNumber: true, ringScore: matchScore };
  }
  if (jobStatus === 'parsed' && matchScore == null) {
    return { state: 'analyzed-no-profile', label: 'No profile', showRing: false, showNumber: false, ringScore: 0 };
  }
  if (jobStatus === 'scraping') {
    return { state: 'scraping', label: 'Pending', showRing: false, showNumber: false, ringScore: 0 };
  }
  if (jobStatus === 'parsing') {
    return { state: 'analyzing', label: 'Pending', showRing: false, showNumber: false, ringScore: 0 };
  }
  if (jobStatus === 'pending') {
    return { state: 'pending', label: 'Pending', showRing: false, showNumber: false, ringScore: 0 };
  }
  if (jobStatus === 'failed') {
    return { state: 'failed', label: 'Unavailable', showRing: false, showNumber: false, ringScore: 0 };
  }
  return { state: 'pending', label: 'Pending', showRing: false, showNumber: false, ringScore: 0 };
}

export default function JobMatchScoreBadge({
  jobStatus,
  matchScore,
  confidenceScore,
  onClick,
  compact = false,
}: JobMatchScoreBadgeProps) {
  const { state, label, showRing, showNumber, ringScore } = resolveState(
    jobStatus,
    matchScore,
    confidenceScore,
  );

  // Ring is 28px (40px with stroke) — compact enough to fit top-right
  // of card without crowding the title.
  const RING_SIZE = 40;
  const RING_STROKE = 3;
  const RADIUS = (RING_SIZE - RING_STROKE) / 2;
  const CIRC = 2 * Math.PI * RADIUS;
  const dash = showRing ? Math.max(0, Math.min(1, ringScore)) * CIRC : 0;

  const interactive = !!onClick && state === 'analyzed-with-profile';

  // Non-analyzed states: render a compact pill instead of a ring
  if (!showRing) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!interactive}
        data-testid="match-score-badge"
        data-state={state}
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold',
          'uppercase tracking-wide transition-colors',
          state === 'analyzed-no-profile' && 'bg-slate-50 text-slate-600 border-slate-200',
          state === 'scraping' && 'bg-blue-50 text-blue-700 border-blue-200',
          state === 'analyzing' && 'bg-amber-50 text-amber-700 border-amber-200',
          state === 'pending' && 'bg-slate-50 text-slate-600 border-slate-200',
          state === 'failed' && 'bg-red-50 text-red-700 border-red-200',
          interactive && 'hover:opacity-80 cursor-pointer',
        )}
        title={badgeTitle(state)}
      >
        {state === 'scraping' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
        {state === 'analyzing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
        {state === 'pending' && <Hourglass className="w-2.5 h-2.5" />}
        {state === 'failed' && <AlertCircle className="w-2.5 h-2.5" />}
        {state === 'analyzed-no-profile' && <User className="w-2.5 h-2.5" />}
        <span>{label}</span>
      </button>
    );
  }

  // Analyzed with profile: circular ring + score
  const rec = undefined; // recommendation is passed in via context (parent decides Eligibility Review)
  const colorCls = ringColorForRec(rec, ringScore);
  const lblCls = labelCls(label, rec);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      data-testid="match-score-badge"
      data-state={state}
      data-score={Math.round(ringScore * 100)}
      className={clsx(
        'inline-flex items-center gap-1.5 group transition-opacity',
        interactive && 'hover:opacity-80 cursor-pointer',
      )}
      title={badgeTitle(state, ringScore)}
    >
      <span className="relative inline-flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
          {/* Track */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={RING_STROKE}
            className="text-slate-200"
          />
          {/* Progress */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC}`}
            className={colorCls}
          />
        </svg>
        {showNumber && (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold tabular-nums text-slate-900">
            {Math.round(ringScore * 100)}
          </span>
        )}
      </span>
      {!compact && (
        <span
          className={clsx(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border',
            lblCls,
          )}
        >
          <LabelIcon label={label} rec={rec} />
          {label}
        </span>
      )}
    </button>
  );
}

function badgeTitle(state: MatchState, score?: number): string {
  switch (state) {
    case 'analyzed-with-profile':
      return `Profile Match: ${Math.round((score ?? 0) * 100)}% — click for breakdown`;
    case 'low-confidence':
      return `Low confidence match: ${Math.round((score ?? 0) * 100)}% — data may be thin`;
    case 'analyzed-no-profile':
      return 'Complete your Base Profile to calculate match';
    case 'scraping':
      return 'Match pending — scraping job posting';
    case 'analyzing':
      return 'Match pending — AI is analyzing this job';
    case 'pending':
      return 'Not analyzed yet — submit to score';
    case 'failed':
      return 'Analysis failed — retry to score';
  }
}
