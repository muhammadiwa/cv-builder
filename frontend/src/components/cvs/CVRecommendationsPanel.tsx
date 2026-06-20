/**
 * Phase 7 — Recommendation engine panel.
 *
 * B6 fix: ``cvsApi.recommendations()`` was dead code in the FE before
 * this component existed. It calls ``GET /api/cvs/recommendations`` and
 * surfaces the best CV×job pairs sorted by composite score. Each card
 * shows the job, the CV title, and which missing skills to address
 * before applying.
 *
 * Cards link into the relevant CV editor (via the parent callback) so
 * the user can immediately polish the CV to lift its score.
 */
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Briefcase, ArrowRight, Loader2, AlertCircle, Target } from 'lucide-react';
import { cvsApi, scoreBucket, type CVRecommendationItem } from '../../lib/api';

interface CVRecommendationsPanelProps {
  /** Called when the user clicks a recommendation card to open the CV. */
  onOpenCV?: (cvId: string, jobId: string) => void;
}

const REC_LABELS: Record<CVRecommendationItem['recommendation'], string> = {
  apply: 'Apply',
  stretch: 'Stretch',
  skip: 'Skip',
};

const REC_PILL: Record<CVRecommendationItem['recommendation'], string> = {
  apply: 'bg-emerald-100 text-emerald-700',
  stretch: 'bg-amber-100 text-amber-700',
  skip: 'bg-slate-100 text-slate-600',
};

export default function CVRecommendationsPanel({ onOpenCV }: CVRecommendationsPanelProps) {
  const [recs, setRecs] = useState<CVRecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    cvsApi
      .recommendations(10)
      .then((data) => {
        if (cancelled) return;
        setRecs(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
          (err as { message?: string })?.message ||
          'Failed to load recommendations';
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center gap-2 text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading best CV×job pairs…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 shadow-sm p-4 flex items-start gap-2 text-sm text-red-700">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center text-slate-500 text-sm">
        <Target className="w-6 h-6 mx-auto mb-2 opacity-50" />
        No CV×job pairs yet. Create a CV targeted to a parsed job to
        unlock recommendations.
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
      data-testid="cv-recommendations-panel"
    >
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Best CV × job pairs
          </h2>
        </div>
        <span className="text-[11px] text-slate-500">
          {recs.length} ranked by composite score
        </span>
      </div>
      <ul className="divide-y divide-slate-100">
        {recs.map((rec) => {
          const bucket = scoreBucket(rec.composite);
          const compositePct = Math.round(rec.composite * 100);
          return (
            <li
              key={`${rec.cv_id}-${rec.job_id}`}
              data-testid={`cv-rec-${rec.cv_id}-${rec.job_id}`}
              className={clsx(
                'px-5 py-3 border-l-4 hover:bg-slate-50/50 transition-colors',
                bucket === 'good' && 'border-l-emerald-400',
                bucket === 'ok' && 'border-l-amber-400',
                bucket === 'low' && 'border-l-slate-300'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-sm text-slate-900 truncate">
                      {rec.job_title}
                      {rec.company ? (
                        <span className="text-slate-500 font-normal"> · {rec.company}</span>
                      ) : null}
                    </span>
                    <span
                      className={clsx(
                        'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full',
                        REC_PILL[rec.recommendation]
                      )}
                      data-testid={`cv-rec-pill-${rec.cv_id}-${rec.job_id}`}
                    >
                      {REC_LABELS[rec.recommendation]}
                    </span>
                  </div>
                  <div className="text-[12px] text-slate-500 truncate">
                    via <span className="text-slate-700">{rec.cv_title}</span>
                  </div>
                  {rec.missing_skills.length > 0 && (
                    <div className="mt-1 text-[11px] text-slate-500">
                      Missing:{' '}
                      <span className="text-slate-700">
                        {rec.missing_skills.slice(0, 3).join(', ')}
                        {rec.missing_skills.length > 3
                          ? ` +${rec.missing_skills.length - 3} more`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-lg font-bold text-slate-900 tabular-nums leading-none">
                    {compositePct}
                  </span>
                  <span className="text-[10px] text-slate-400 leading-none">
                    composite
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                    <span title="Match score (job fit)">
                      M {Math.round(rec.match_score * 100)}
                    </span>
                    <span title="CV score (how good this CV is for the job)">
                      C {Math.round(rec.cv_score * 100)}
                    </span>
                  </div>
                </div>
              </div>
              {onOpenCV && (
                <button
                  type="button"
                  onClick={() => onOpenCV(rec.cv_id, rec.job_id)}
                  className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:text-brand-900"
                  data-testid={`cv-rec-open-${rec.cv_id}-${rec.job_id}`}
                >
                  Open this CV <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}