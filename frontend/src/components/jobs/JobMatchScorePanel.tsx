/**
 * JobMatchScorePanel — clean colored badge with score + level label.
 *
 * Phase 10E redesign: dropped the dark slate-900 background and the
 * stacked SupportingTags row. The card now reads as:
 *
 *   ┌─────────┐
 *   │   49    │   ← big score number, colored by band
 *   │  Low    │   ← small label below
 *   └─────────┘
 *
 * Click → opens the Match Score Detail Drawer (existing behavior).
 * Supporting tags (CV ready, Remote, Salary shown, etc.) are no
 * longer rendered here — they're available in the drawer.
 */
import clsx from 'clsx';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from 'lucide-react';
import type { JobStatus } from '../../lib/api';
import type { MatchLabel } from './JobMatchScoreBadge';
import { matchLabelFromScore } from './JobMatchScoreBadge';

interface JobMatchScorePanelProps {
  jobStatus: JobStatus;
  /** 0-1, required for analyzed states. */
  matchScore: number | null;
  /** Optional confidence indicator (0-1). */
  confidenceScore?: number | null;
  /** Click opens the Match Score Detail Drawer. */
  onClick?: (e?: React.MouseEvent) => void;
  // Note: supportingTagsProps was dropped (Phase 10E). The signature
  // intentionally still accepts unknown extras so callers don't break —
  // they're just ignored.
  supportingTagsProps?: unknown;
  job?: unknown;
  match?: unknown;
}

type PanelState = 'analyzed' | 'no-profile' | 'low-confidence' | 'pending' | 'failed';

function resolvePanelState(
  jobStatus: JobStatus,
  matchScore: number | null,
  confidenceScore: number | null | undefined,
): { state: PanelState; label: MatchLabel | null; ringScore: number | null } {
  if (jobStatus === 'parsed' && matchScore != null) {
    if (confidenceScore != null && confidenceScore < 0.4) {
      return { state: 'low-confidence', label: 'Low', ringScore: matchScore };
    }
    return { state: 'analyzed', label: matchLabelFromScore(matchScore), ringScore: matchScore };
  }
  if (jobStatus === 'parsed' && matchScore == null) {
    return { state: 'no-profile', label: null, ringScore: null };
  }
  if (jobStatus === 'failed') {
    return { state: 'failed', label: null, ringScore: null };
  }
  // scraping, parsing, pending
  return { state: 'pending', label: null, ringScore: null };
}

export default function JobMatchScorePanel({
  jobStatus,
  matchScore,
  confidenceScore,
  onClick,
}: JobMatchScorePanelProps) {
  const { state, label, ringScore } = resolvePanelState(
    jobStatus,
    matchScore,
    confidenceScore,
  );

  // Color band (used for the score number AND the label pill so they
  // read as one unit). Bands mirror the deterministic matcher's
  // recommendation thresholds:
  //   >= 0.70  → green (apply)
  //   >= 0.40  → amber (stretch)
  //   <  0.40  → red   (skip)
  //   null     → slate (no profile / pending / failed)
  const bandColor = (() => {
    if (state === 'analyzed' || state === 'low-confidence') {
      if (ringScore == null) return 'slate';
      if (ringScore >= 0.70) return 'emerald';
      if (ringScore >= 0.40) return 'amber';
      return 'red';
    }
    return 'slate';
  })();

  const palette: Record<string, { bg: string; text: string; ring: string; label: string }> = {
    emerald: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      ring: '',
      label: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    },
    amber: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-700',
      ring: '',
      label: 'bg-amber-100 text-amber-700 border-amber-200',
    },
    red: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      ring: '',
      label: 'bg-red-100 text-red-700 border-red-200',
    },
    slate: {
      bg: 'bg-slate-50 border-slate-200',
      text: 'text-slate-500',
      ring: '',
      label: 'bg-slate-100 text-slate-500 border-slate-200',
    },
  };
  const colors = palette[bandColor];

  const interactive = !!onClick && state === 'analyzed';
  const displayLabel =
    state === 'low-confidence' ? 'Low conf.' : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      data-testid="match-score-panel"
      data-state={state}
      data-score={ringScore != null ? Math.round(ringScore * 100) : null}
      className={clsx(
        'inline-flex flex-col items-center justify-center min-w-[58px] px-2 py-1.5 rounded-md border',
        colors.bg,
        interactive && 'hover:shadow-sm cursor-pointer transition-shadow',
      )}
      title={titleFor(state, ringScore)}
    >
      {state === 'analyzed' || state === 'low-confidence' ? (
        <>
          <span
            className={clsx(
              'text-[20px] font-bold tabular-nums leading-none',
              colors.text,
            )}
          >
            {Math.round((ringScore ?? 0) * 100)}
          </span>
          {displayLabel && (
            <span
              className={clsx(
                'mt-1 inline-flex items-center gap-0.5 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider border rounded',
                colors.label,
              )}
            >
              {state === 'low-confidence' || displayLabel === 'Low' ? (
                <XCircle className="w-2.5 h-2.5" />
              ) : displayLabel === 'Partial' ? (
                <AlertTriangle className="w-2.5 h-2.5" />
              ) : (
                <CheckCircle2 className="w-2.5 h-2.5" />
              )}
              {displayLabel}
            </span>
          )}
        </>
      ) : state === 'no-profile' ? (
        <span
          data-testid="match-panel-no-profile"
          className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center leading-tight"
        >
          No profile
        </span>
      ) : state === 'failed' ? (
        <span
          data-testid="match-panel-failed"
          className="text-[10px] font-semibold text-red-600 uppercase tracking-wider text-center leading-tight"
        >
          Unavailable
        </span>
      ) : (
        <span
          data-testid="match-panel-pending"
          className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center leading-tight animate-pulse"
        >
          Pending
        </span>
      )}

      {/* Low-confidence hint (spec M) — kept as a tiny icon
          underneath the badge so the user knows the score may be
          unreliable. Stays outside the badge bg so it doesn't add
          visual weight. */}
      {state === 'low-confidence' && (
        <span
          className="inline-flex items-center gap-0.5 text-[9px] text-amber-700/80 mt-0.5"
          title="Match score may be inaccurate due to limited data"
        >
          <Info className="w-2.5 h-2.5" />
          Low data
        </span>
      )}
    </button>
  );
}

function titleFor(state: PanelState, score: number | null): string {
  switch (state) {
    case 'analyzed':
      return `Profile Match: ${Math.round((score ?? 0) * 100)}% — click for breakdown`;
    case 'low-confidence':
      return `Low confidence: ${Math.round((score ?? 0) * 100)}% — data may be thin`;
    case 'no-profile':
      return 'Complete your Base Profile to calculate match';
    case 'pending':
      return 'Match pending — analysis in progress';
    case 'failed':
      return 'Analysis failed — retry to score';
  }
}
