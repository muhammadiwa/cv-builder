/**
 * MatchAnalysisTab — full match breakdown (Phase 10F).
 *
 * Replaces the big MatchPanel that used to sit at the top of the page.
 * Now lives in its own tab so the Overview tab stays scannable.
 *
 * Sections:
 *   A. Match overview (score + label + confidence + recalculate)
 *   B. Strengths (confirmed matches)
 *   C. Gaps (missing skills, grouped by category)
 *   D. Skill-by-skill match table
 *   E. CV strategy recommendations
 *
 * Anti-fabrication: every claim is tied to a real item in
 * ``match.matched_skills_json`` / ``match.missing_skills_json``. The
 * LLM's narrative (if any) is shown as supplementary context, not
 * as a basis for new claims.
 */
import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Sparkles,
  Target,
  ShieldAlert,
} from 'lucide-react';
import clsx from 'clsx';
import type { JobMatch } from '../../../lib/api';
import { matchLabelFromScore } from '../JobMatchScoreBadge';

export interface MatchAnalysisTabProps {
  match: JobMatch | null;
  /** When true, render the loading state for "Recalculate" button. */
  recalculating?: boolean;
  onRecalculate?: () => void;
}

interface MatchedRow {
  required: string;
  matched: string;
  strength: number;
  method: string;
}
interface MissingRow {
  required: string;
  category?: string;
}

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, t) => {
    const k = key(t) || 'Other';
    (acc[k] ??= []).push(t);
    return acc;
  }, {});
}

export default function MatchAnalysisTab({
  match,
  recalculating,
  onRecalculate,
}: MatchAnalysisTabProps) {
  const [gapFilter, setGapFilter] = useState('');
  const [showAllGaps, setShowAllGaps] = useState(false);

  const matched = (match?.matched_skills as unknown as MatchedRow[]) || [];
  const missing = (match?.missing_skills as unknown as MissingRow[]) || [];

  const filteredGaps = useMemo(() => {
    const q = gapFilter.trim().toLowerCase();
    if (!q) return missing;
    return missing.filter((m) =>
      (m.required || '').toLowerCase().includes(q),
    );
  }, [missing, gapFilter]);

  const groupedGaps = useMemo(
    () => groupBy(filteredGaps, (m) => m.category || 'Other'),
    [filteredGaps],
  );

  if (!match) {
    return (
      <div
        data-testid="match-analysis-empty"
        className="card card-pad text-center py-10"
      >
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-[15px] font-semibold text-slate-900 mb-1">
          No match score yet
        </h3>
        <p className="text-[13px] text-slate-600">
          Run the job analysis to see how your Base Profile fits this role.
        </p>
      </div>
    );
  }

  const score = match.match_score ?? 0;
  const label = matchLabelFromScore(score);
  const pct = Math.round(score * 100);
  const bandCls =
    score >= 0.7
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : score >= 0.5
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-red-700 bg-red-50 border-red-200';

  return (
    <div data-testid="match-analysis-tab" className="space-y-6">
      {/* A. Match overview */}
      <section
        data-testid="match-analysis-overview"
        className="card card-pad"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="section-title mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600" />
              Match Overview
            </h2>
            <p className="text-[12px] text-slate-500">
              Calibrated score — not a guarantee of interview or hire.
            </p>
          </div>
          <div
            className={clsx(
              'inline-flex flex-col items-end px-4 py-2 border rounded-md',
              bandCls,
            )}
          >
            <span
              data-testid="match-analysis-score"
              className="text-[28px] font-bold tabular-nums leading-none"
            >
              {pct}%
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">
              {label}
            </span>
          </div>
        </div>

        {/* Score breakdown bars */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {(
            [
              { label: 'Required Skills', value: match.score_breakdown?.skill ?? 0 },
              { label: 'Relevant Experience', value: match.score_breakdown?.experience ?? 0 },
              { label: 'Role & Seniority', value: match.score_breakdown?.seniority ?? 0 },
              { label: 'Education', value: match.score_breakdown?.education ?? 0 },
            ] as { label: string; value: number }[]
          ).map((b) => (
            <div key={b.label} className="flex items-center gap-3">
              <span className="text-[12px] text-slate-600 w-44">
                {b.label}
              </span>
              <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
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
              <span className="text-[12px] tabular-nums text-slate-500 w-12 text-right">
                {Math.round(b.value * 100)}%
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {onRecalculate && (
            <button
              type="button"
              onClick={onRecalculate}
              disabled={recalculating}
              data-testid="recalculate-match"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white text-[12px] text-slate-700 rounded-md disabled:opacity-50"
            >
              {recalculating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Recalculate
            </button>
          )}
        </div>
      </section>

      {/* B. Strengths */}
      <section data-testid="match-analysis-strengths" className="card card-pad">
        <h3 className="section-title mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Strong Matches
        </h3>
        {matched.length === 0 ? (
          <p className="text-[13px] text-slate-600">
            No confirmed matches yet. The match engine couldn't pair any of
            the job's required keywords with your Base Profile.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {matched.slice(0, 20).map((m, i) => (
              <li
                key={`${m.required}-${i}`}
                className="flex items-start gap-2 text-[13px] text-slate-700"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span className="flex-1">
                  <span className="font-medium text-slate-900">{m.matched || m.required}</span>
                  {m.matched && m.required && m.matched !== m.required && (
                    <span className="text-slate-500">
                      {' '}
                      ↔ required: <em>{m.required}</em>
                    </span>
                  )}
                  <span className="ml-2 text-[11px] text-slate-400">
                    (strength {Math.round((m.strength || 0) * 100)}%)
                  </span>
                </span>
              </li>
            ))}
            {matched.length > 20 && (
              <li className="text-[12px] text-slate-500 italic">
                + {matched.length - 20} more matches…
              </li>
            )}
          </ul>
        )}
      </section>

      {/* C. Gaps */}
      <section data-testid="match-analysis-gaps" className="card card-pad">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <h3 className="section-title mb-0 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Missing / Critical Gaps
          </h3>
          <input
            type="search"
            value={gapFilter}
            onChange={(e) => setGapFilter(e.target.value)}
            placeholder="Filter gaps…"
            data-testid="match-gaps-filter"
            className="px-2 py-1 text-[12px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {missing.length === 0 ? (
          <p
            data-testid="match-gaps-empty"
            className="text-[13px] text-slate-600"
          >
            No major gaps detected.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedGaps).map(([cat, items]) => (
              <div key={cat}>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  {cat} · {items.length}
                </h4>
                <ul className="space-y-1">
                  {(showAllGaps ? items : items.slice(0, 8)).map((m, i) => (
                    <li
                      key={`${m.required}-${i}`}
                      className="flex items-start gap-2 text-[12.5px] text-slate-700"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <span>{m.required}</span>
                    </li>
                  ))}
                </ul>
                {items.length > 8 && !showAllGaps && (
                  <button
                    type="button"
                    onClick={() => setShowAllGaps(true)}
                    data-testid="show-all-gaps"
                    className="text-[12px] font-medium text-brand-700 hover:text-brand-800 mt-1"
                  >
                    Show {items.length - 8} more in {cat}…
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* D. Skill-by-skill match table */}
      <section data-testid="match-analysis-table" className="card card-pad overflow-hidden">
        <h3 className="section-title mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-brand-600" />
          Skill-by-skill Match
        </h3>
        <div className="overflow-x-auto -mx-4">
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="font-medium px-4 py-2">Required</th>
                <th className="font-medium px-4 py-2">Match</th>
                <th className="font-medium px-4 py-2">Status</th>
                <th className="font-medium px-4 py-2 text-right">Strength</th>
              </tr>
            </thead>
            <tbody>
              {matched.map((m, i) => (
                <tr
                  key={`row-m-${i}`}
                  className="border-b border-slate-100"
                >
                  <td className="px-4 py-2 text-slate-700">{m.required}</td>
                  <td className="px-4 py-2 text-slate-900 font-medium">
                    {m.matched || '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-700 rounded">
                      Confirmed
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {Math.round((m.strength || 0) * 100)}%
                  </td>
                </tr>
              ))}
              {missing.map((m, i) => (
                <tr
                  key={`row-g-${i}`}
                  className="border-b border-slate-100"
                >
                  <td className="px-4 py-2 text-slate-700">{m.required}</td>
                  <td className="px-4 py-2 text-slate-400">—</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-700 rounded">
                      Missing
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-400">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* E. CV strategy — generated from the matched/missing lists so the
            advice is grounded in the actual data, not hallucinated. */}
      <section data-testid="match-analysis-strategy" className="card card-pad">
        <h3 className="section-title mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-600" />
          Recommended CV Strategy
        </h3>
        <ul className="space-y-2 text-[13px] text-slate-700">
          {matched.slice(0, 3).map((m, i) => (
            <li
              key={`s-${i}`}
              className="flex items-start gap-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span>
                Prioritize <strong>{m.matched || m.required}</strong> in your CV —
                this is a confirmed match.
              </span>
            </li>
          ))}
          {missing.slice(0, 3).map((m, i) => (
            <li
              key={`g-${i}`}
              className="flex items-start gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <span>
                Do <em>not</em> claim <strong>{m.required}</strong> as experience
                unless you have evidence in your Base Profile.
              </span>
            </li>
          ))}
          <li className="flex items-start gap-2 text-slate-600 italic">
            <span className="w-3.5 h-3.5 shrink-0" />
            <span>
              Use missing skills only as learning recommendations, never as
              facts in the tailored CV.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
