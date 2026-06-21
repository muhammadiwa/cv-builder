/**
 * JobMatchScorePanel — dark "score panel" inspired by Jobright AI's
 * right-side score block (85% / GOOD MATCH / checkmark tags).
 *
 * Phase 10D: gives the match score dedicated visual real estate so
 * users can scan match quality at a glance. The dark background
 * contrasts with the white card body, making the score the page's
 * primary signal.
 *
 * Visual stack (top → bottom):
 *   1. Circular progress ring with score number inside
 *   2. Match label (Strong / Good / Partial / Low / etc)
 *   3. Supporting checkmark tags (CV ready, Remote, Within range, etc)
 *
 * Spec coverage:
 *   - G.1: circular ring + score + label, compact
 *   - G.2: status "Analyzed" still visible — parent renders it
 *          adjacent to this panel
 *   - H.6: low confidence state shows confidence indicator
 *   - O: supporting tags are evidence-based only, never fabricated
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
import SupportingTags, { type SupportingTagsProps } from './SupportingTags';

interface JobMatchScorePanelProps {
  jobStatus: JobStatus;
  /** 0-1, required for analyzed states. */
  matchScore: number | null;
  /** Optional confidence indicator (0-1). */
  confidenceScore?: number | null;
  /** Click opens the Match Score Detail Drawer. */
  onClick?: (e?: React.MouseEvent) => void;
  /** Supporting tags props (evidence-based only). */
  supportingTagsProps?: Omit<SupportingTagsProps, 'job' | 'match'>;
  job: SupportingTagsProps['job'];
  match: SupportingTagsProps['match'];
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
  job,
  match,
  supportingTagsProps,
}: JobMatchScorePanelProps) {
  const { state, label, ringScore } = resolvePanelState(
    jobStatus,
    matchScore,
    confidenceScore,
  );

  const RING_SIZE = 44;
  const RING_STROKE = 3.5;
  const RADIUS = (RING_SIZE - RING_STROKE) / 2;
  const CIRC = 2 * Math.PI * RADIUS;
  const dash = ringScore != null ? Math.max(0, Math.min(1, ringScore)) * CIRC : 0;

  // Color: emerald/amber/red on the ring
  const colorCls =
    state === 'analyzed' || state === 'low-confidence'
      ? ringScore != null && ringScore >= 0.7
        ? 'text-emerald-400'
        : ringScore != null && ringScore >= 0.5
        ? 'text-amber-400'
        : 'text-red-400'
      : 'text-slate-500';

  // Label color (light teal on dark for readability)
  const labelCls =
    state === 'analyzed' && label
      ? label === 'Excellent' || label === 'Strong' || label === 'Good'
        ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10'
        : label === 'Partial'
        ? 'text-amber-300 border-amber-400/30 bg-amber-500/10'
        : 'text-red-300 border-red-400/30 bg-red-500/10'
      : 'text-slate-400 border-slate-600 bg-slate-700/40';

  const interactive = !!onClick && state === 'analyzed';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      data-testid="match-score-panel"
      data-state={state}
      data-score={ringScore != null ? Math.round(ringScore * 100) : null}
      className={clsx(
        'inline-flex flex-col items-center justify-center gap-1 px-2.5 py-2.5 rounded-lg shrink-0',
        'bg-slate-900 border border-slate-700 shadow-sm transition-shadow',
        interactive && 'hover:shadow-md cursor-pointer group',
      )}
      title={titleFor(state, ringScore)}
    >
      {/* Ring + number */}
      {state === 'analyzed' || state === 'low-confidence' ? (
        <span
          className="relative inline-flex items-center justify-center"
          style={{ width: RING_SIZE, height: RING_SIZE }}
        >
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={RING_STROKE}
              className="text-slate-700"
            />
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
          <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold tabular-nums text-white">
            {Math.round((ringScore ?? 0) * 100)}
          </span>
        </span>
      ) : state === 'no-profile' ? (
        <span
          data-testid="match-panel-no-profile"
          className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center leading-tight"
        >
          No profile
        </span>
      ) : state === 'failed' ? (
        <span
          data-testid="match-panel-failed"
          className="text-[10px] font-semibold text-red-400 uppercase tracking-wider text-center leading-tight"
        >
          Unavailable
        </span>
      ) : (
        <span
          data-testid="match-panel-pending"
          className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center leading-tight animate-pulse"
        >
          Pending
        </span>
      )}

      {/* Match label */}
      {label && (
        <span
          className={clsx(
            'inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[9px] font-semibold uppercase tracking-wider border',
            labelCls,
          )}
        >
          {label === 'Low' || (state === 'low-confidence') ? (
            <XCircle className="w-2.5 h-2.5" />
          ) : label === 'Partial' ? (
            <AlertTriangle className="w-2.5 h-2.5" />
          ) : (
            <CheckCircle2 className="w-2.5 h-2.5" />
          )}
          {state === 'low-confidence' ? 'Low conf.' : label}
        </span>
      )}

      {/* Low-confidence hint (spec M) */}
      {state === 'low-confidence' && (
        <span
          className="inline-flex items-center gap-0.5 text-[9px] text-amber-300/80"
          title="Match score may be inaccurate due to limited data"
        >
          <Info className="w-2.5 h-2.5" />
          Low data
        </span>
      )}

      {/* Supporting tags — evidence-based only */}
      {state === 'analyzed' && supportingTagsProps && (
        <SupportingTags
          job={job}
          match={match}
          hasTailoredCv={supportingTagsProps.hasTailoredCv}
          cvFitScore={supportingTagsProps.cvFitScore}
          profilePreferences={supportingTagsProps.profilePreferences}
          matchedSkillsCount={supportingTagsProps.matchedSkillsCount}
          totalRequiredSkills={supportingTagsProps.totalRequiredSkills}
        />
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
