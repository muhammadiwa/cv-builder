/**
 * ProfileMatchCompactCard — compact profile-match card (Phase 10F).
 *
 * Replaces the old full-width "Match Against Your Profile" section.
 * Shows:
 *   - Score number + label (Good Match / Stretch / Skip)
 *   - Match confidence + 1-line summary
 *   - Up to 5 mini-bars (skill / experience / seniority / work mode / ATS)
 *   - Up to 3 key highlights (positive or warning)
 *   - Action row: View Full Analysis / Build CV / Improve Profile
 *
 * Compact on purpose: the full breakdown lives in the Match Analysis
 * tab. This card answers "should I keep reading?" without dominating
 * the page.
 */
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Gauge,
} from 'lucide-react';
import clsx from 'clsx';
import type { JobMatch } from '../../../lib/api';
import { matchLabelFromScore } from '../JobMatchScoreBadge';

interface SkillLite {
  required_keyword?: string;
  matched_keyword?: string | null;
  strength?: number;
}
interface MissingLite {
  required_keyword?: string;
}

export interface ProfileMatchCompactCardProps {
  jobStatus: string;
  match: JobMatch | null;
  /** Optional base profile confidence for the header subtitle. */
  baseProfileConfidence?: number | null;
}

interface MiniBar {
  label: string;
  /** 0..1 */
  value: number;
}

function buildMiniBars(match: JobMatch | null): MiniBar[] {
  if (!match) return [];
  const bd = match.score_breakdown;
  return [
    { label: 'Required Skills', value: bd?.skill ?? 0 },
    { label: 'Relevant Experience', value: bd?.experience ?? 0 },
    { label: 'Role & Seniority', value: bd?.seniority ?? 0 },
    { label: 'Education', value: bd?.education ?? 0 },
  ];
}

function buildHighlights(match: JobMatch | null): {
  positive: string[];
  warning: string[];
} {
  if (!match) return { positive: [], warning: [] };
  const positive: string[] = [];
  const warning: string[] = [];

  const matched = (match.matched_skills as unknown as SkillLite[]) || [];
  const missing = (match.missing_skills as unknown as MissingLite[]) || [];

  // Positive: surface top 2 matched keywords as quick wins.
  for (const m of matched.slice(0, 2)) {
    const kw = m.matched_keyword || m.required_keyword;
    if (kw) positive.push(`${kw} match confirmed.`);
  }

  // Warning: surface top missing critical gap.
  if (missing.length > 0) {
    warning.push(
      `${missing.length} required ${missing.length === 1 ? 'skill' : 'skills'} not yet evidenced in your Base Profile.`,
    );
  }
  const bd = match.score_breakdown;
  if ((bd?.experience ?? 0) < 0.5) {
    warning.push('Relevant experience evidence is thin.');
  }
  if ((bd?.skill ?? 0) >= 0.7) {
    positive.push('Core skill alignment is strong.');
  }

  return {
    positive: positive.slice(0, 2),
    warning: warning.slice(0, 2),
  };
}

export default function ProfileMatchCompactCard({
  jobStatus,
  match,
  baseProfileConfidence,
}: ProfileMatchCompactCardProps) {
  // If job hasn't been analyzed yet, show a clean "Analysis required" state.
  if (jobStatus !== 'parsed' || !match) {
    return (
      <section
        data-testid="profile-match-compact"
        className="card card-pad"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="section-title mb-0 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-slate-500" />
            Profile Match
          </h2>
        </div>
        <p className="text-[13px] text-slate-600">
          Run the analyzer to see how well your Base Profile fits this role.
        </p>
      </section>
    );
  }

  const score = match.match_score ?? 0;
  const label = matchLabelFromScore(score);
  const conf = baseProfileConfidence ?? match.confidence_score ?? null;

  const bars = buildMiniBars(match);
  const { positive, warning } = buildHighlights(match);

  // Score color band (mirrors the recommendation thresholds).
  const bandCls =
    score >= 0.7
      ? 'text-emerald-700'
      : score >= 0.5
      ? 'text-amber-700'
      : 'text-red-700';

  const bandBg =
    score >= 0.7
      ? 'bg-emerald-50 border-emerald-200'
      : score >= 0.5
      ? 'bg-amber-50 border-amber-200'
      : 'bg-red-50 border-red-200';

  return (
    <section
      data-testid="profile-match-compact"
      className="card card-pad space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title mb-0 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-slate-500" />
            Profile Match
          </h2>
          {conf != null && (
            <p
              data-testid="match-confidence"
              className="text-[11px] text-slate-500 mt-1"
            >
              {Math.round(conf * 100)}% confidence · based on your current Base Profile and this job's extracted requirements.
            </p>
          )}
        </div>
        <div
          className={clsx(
            'flex flex-col items-end px-3 py-1.5 border rounded-md',
            bandBg,
          )}
        >
          <span
            data-testid="match-score-number"
            className={clsx('text-[24px] font-bold tabular-nums leading-none', bandCls)}
          >
            {Math.round(score * 100)}%
          </span>
          <span
            data-testid="match-score-label"
            className={clsx('mt-0.5 text-[10px] font-semibold uppercase tracking-wider', bandCls)}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Score breakdown mini bars */}
      <div className="space-y-1.5" data-testid="match-mini-bars">
        {bars.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="text-[11px] text-slate-600 w-36 shrink-0">
              {b.label}
            </span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded transition-all',
                  b.value >= 0.7
                    ? 'bg-emerald-500'
                    : b.value >= 0.5
                    ? 'bg-amber-500'
                    : 'bg-red-400',
                )}
                style={{ width: `${Math.round(b.value * 100)}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-slate-500 w-9 text-right">
              {Math.round(b.value * 100)}%
            </span>
          </div>
        ))}
      </div>

      {/* Highlights */}
      {(positive.length > 0 || warning.length > 0) && (
        <ul className="space-y-1.5" data-testid="match-highlights">
          {positive.map((p) => (
            <li
              key={p}
              className="flex items-start gap-2 text-[12px] text-slate-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{p}</span>
            </li>
          ))}
          {warning.map((w) => (
            <li
              key={w}
              className="flex items-start gap-2 text-[12px] text-slate-700"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Anti-fabrication hint (Phase 10J). The 3 prior action links
          ('View full analysis', 'Build tailored CV', 'Improve
          profile') were exact duplicates of cards in the right
          column's AI Action Center — killed for the same reason. */}
      <div className="pt-1 border-t border-slate-100 flex justify-end">
        <span
          className="inline-flex items-center gap-1 text-[11px] text-slate-500"
          title="Match analysis is calibrated but never a guarantee of interview"
        >
          <TrendingUp className="w-3 h-3" />
          Calibrated · not a guarantee
          <TrendingDown className="w-3 h-3" />
        </span>
      </div>
    </section>
  );
}
