/**
 * Phase 7 — CV scoring panel.
 *
 * Shows the headline score, per-axis breakdown, and prioritized
 * improvement recommendations. The CV editor calls `onScoreUpdate`
 * after every save so the score refreshes without a manual click.
 *
 * Score is also embedded in `CVDraft.score` + `score_breakdown_json`
 * on every mutating endpoint, so this component degrades gracefully
 * if the explicit score endpoint isn't reachable.
 */
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  TrendingUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  Target,
  Award,
  FileCheck2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  cvsApi,
  type CVDraft,
  type CVScore,
  type CVScoreAxis,
  type CVScoreAxisData,
  type CVRecommendationImpact,
  breakdownToScore,
} from '../../lib/api';

interface CVScorePanelProps {
  cv: CVDraft;
}

const AXIS_LABELS: Record<CVScoreAxis, { label: string; icon: React.ReactNode }> = {
  ats_coverage: { label: 'ATS keywords', icon: <Target className="w-3.5 h-3.5" /> },
  skill_gap: { label: 'Skill match', icon: <Award className="w-3.5 h-3.5" /> },
  bullet_strength: { label: 'Bullet strength', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  format_safety: { label: 'Format safety', icon: <FileCheck2 className="w-3.5 h-3.5" /> },
};

const IMPACT_STYLES: Record<CVRecommendationImpact, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  med: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-700 border-slate-200',
};

function axisHue(score: number): string {
  if (score >= 0.75) return 'bg-emerald-500';
  if (score >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}

function AxisBar({
  axisKey,
  data,
}: {
  axisKey: CVScoreAxis;
  data: CVScoreAxisData;
}) {
  const meta = AXIS_LABELS[axisKey];
  const pct = Math.round(data.score * 100);
  const widthPx = pct > 0 ? `${pct}%` : '2px';
  const matched = data.matched ?? [];
  const missing = data.missing ?? [];
  return (
    <div data-testid={`score-axis-${axisKey}`}>
      <div className="flex items-center justify-between text-[12px] text-slate-600 mb-1">
        <span className="inline-flex items-center gap-1.5">
          {meta.icon}
          {meta.label}
        </span>
        <span className="font-medium tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={clsx('h-full transition-all', axisHue(data.score))}
          style={{ width: widthPx }}
        />
      </div>
      {(matched.length > 0 || missing.length > 0) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
          {matched.length > 0 && (
            <span className="text-emerald-700">
              ✓ {matched.length} matched
            </span>
          )}
          {missing.length > 0 && (
            <span className="text-red-700">
              ✗ {missing.length} missing
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const MAX_INLINE_RECS = 3;

export default function CVScorePanel({ cv }: CVScorePanelProps) {
  const [score, setScore] = useState<CVScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllRecs, setShowAllRecs] = useState(false);

  // F1 fix: track the breakdown reference, not just truthiness of
  // `score`. Previously the hydration effect was gated on `!score`
  // which meant the very first hydration ran and then the panel
  // ignored subsequent updates from the parent's `cv.score_breakdown_json`
  // until the user clicked "Re-score". Now we always hydrate when
  // the breakdown identity changes (after a save / enhance / patch).
  const lastBreakdownRef = useRef<unknown>(null);

  // F2 fix: drop `score` from the deps array. It was previously
  // self-referential (set by the effect itself), causing the effect
  // to fire on every render of the local `score` state — race-prone
  // with the user-triggered ``refresh()`` call.
  useEffect(() => {
    const breakdown = cv.score_breakdown_json as Record<string, unknown> | null;
    if (!breakdown || Object.keys(breakdown).length === 0) return;
    if (breakdown === lastBreakdownRef.current) return;
    lastBreakdownRef.current = breakdown;
    // F6 fix: reuse the helper so the shape stays in sync with the
    // API response. If the API adds a field, the helper is the one
    // place that needs to grow.
    setScore(breakdownToScore(breakdown, cv));
  }, [cv.id, cv.score_breakdown_json, cv.updated_at]);

  // Triggered manually via "Re-score" button.
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await cvsApi.score(cv.id);
      setScore(fresh);
      lastBreakdownRef.current = cv.score_breakdown_json; // keep ref coherent
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        'Failed to compute score';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const headlinePct = Math.round((score?.overall ?? cv.score ?? 0) * 100);
  const recs = score?.recommendations ?? [];
  // F8 fix: when there are more than MAX_INLINE_RECS recommendations,
  // collapse the rest behind a "See all" toggle. Heading shows the
  // total count so the user knows there's more.
  const visibleRecs = showAllRecs ? recs : recs.slice(0, MAX_INLINE_RECS);
  const hiddenCount = Math.max(0, recs.length - MAX_INLINE_RECS);

  return (
    <div className="card card-pad" data-testid="cv-score-panel">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-brand-600" />
            <h2 className="text-[15px] font-semibold text-slate-900">CV score</h2>
          </div>
          <p className="text-[12px] text-slate-500">
            Live scoring — updates after every save.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          // F7 fix: explicit screen-reader label (title alone is ignored
          // by some assistive tech when paired with icon-only buttons).
          aria-label="Re-score this CV"
          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
          title="Re-score"
          data-testid="cv-score-refresh-btn"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <TrendingUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Headline */}
      <div className="flex items-baseline gap-1 mb-4">
        <span
          className="text-3xl font-bold text-slate-900 tabular-nums leading-none"
          data-testid="cv-score-overall"
        >
          {headlinePct}
        </span>
        <span className="text-base text-slate-500 font-medium">%</span>
        <span className="ml-2 text-[11px] text-slate-400">overall</span>
      </div>

      {/* Axis breakdown */}
      {score && (
        <div className="space-y-3 mb-4">
          {(Object.keys(AXIS_LABELS) as CVScoreAxis[]).map((key) => (
            <AxisBar key={key} axisKey={key} data={score.axes[key]} />
          ))}
        </div>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-2">
            <Lightbulb className="w-3 h-3 text-amber-500" />
            Top recommendations ({recs.length})
          </div>
          <div className="space-y-2">
            {visibleRecs.map((rec) => (
              <div
                key={rec.id}
                className={clsx(
                  'p-2.5 rounded-lg border text-[12px]',
                  IMPACT_STYLES[rec.impact],
                )}
                data-testid={`cv-score-rec-${rec.axis}`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="font-medium">{rec.title}</span>
                  <span className="text-[10px] uppercase tracking-wide shrink-0 opacity-70">
                    {rec.impact}
                  </span>
                </div>
                <div className="text-[11px] opacity-80 leading-relaxed">
                  {rec.details}
                </div>
              </div>
            ))}
          </div>
          {/* F8 fix: collapse the long tail of recommendations behind a toggle. */}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllRecs((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900"
              data-testid="cv-score-rec-toggle"
            >
              {showAllRecs ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Show fewer
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Show all {recs.length} ({hiddenCount} more)
                </>
              )}
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[12px] text-red-700 flex items-start gap-1.5"
          data-testid="cv-score-error"
        >
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!score && !loading && (
        <div className="text-[12px] text-slate-500 italic">
          Click the refresh icon to compute the score.
        </div>
      )}

      {score && recs.length === 0 && (
        <div
          className="text-[12px] text-emerald-700 flex items-center gap-1.5"
          data-testid="cv-score-all-good"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          No gaps detected — your CV is well-aligned with this job.
        </div>
      )}
    </div>
  );
}