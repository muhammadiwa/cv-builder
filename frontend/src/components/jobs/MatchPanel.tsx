import { useState } from 'react';
import clsx from 'clsx';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Loader2,
  RefreshCw,
  Briefcase,
  GraduationCap,
  Award,
} from 'lucide-react';
import {
  matchesApi,
  type JobMatch,
  type Recommendation,
  type SkillMatchDetail,
} from '../../lib/api';

interface MatchPanelProps {
  jobId: string;
  jobStatus: string;
  match: JobMatch | null;
  onMatchChange: (match: JobMatch | null) => void;
}

const RECOMMENDATION_STYLES: Record<
  Recommendation,
  { label: string; cls: string; description: string }
> = {
  apply: {
    label: 'Strong fit',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Apply with confidence — your profile matches most requirements.',
  },
  stretch: {
    label: 'Worth applying',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Partial fit — tailor your CV to highlight the matched areas.',
  },
  skip: {
    label: 'Significant gaps',
    cls: 'bg-red-50 text-red-700 border-red-200',
    description: 'Many missing requirements — consider whether the time is worth it.',
  },
};

function ScoreBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const pctVal = Math.round(value * 100);
  // Pick a hue from red→amber→emerald based on score.
  const hue = value >= 0.75 ? 'bg-emerald-500' : value >= 0.5 ? 'bg-amber-500' : 'bg-red-500';
  // Always show a 2px marker on the track so 0% bars don't disappear.
  const barWidth = pctVal > 0 ? `${pctVal}%` : '2px';
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] text-slate-600 mb-1">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        <span className="font-medium tabular-nums">{pctVal}%</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={clsx('h-full transition-all', hue)}
          style={{ width: barWidth }}
        />
      </div>
    </div>
  );
}

function SkillMatchRow({ match }: { match: SkillMatchDetail }) {
  const isPreferred = match.required_skill.endsWith('(preferred)');
  const pctVal = Math.round(match.strength * 100);
  const tone =
    match.strength >= 0.9 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : match.strength >= 0.6 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <div className="flex-1 min-w-0">
        <div className="text-slate-700 truncate">
          <span className="font-medium">{match.required_keyword}</span>
          {isPreferred && (
            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">nice-to-have</span>
          )}
        </div>
        {match.matched_keyword && match.matched_keyword !== match.required_keyword && (
          <div className="text-[11px] text-slate-500 truncate">
            matched via "{match.matched_keyword}"
          </div>
        )}
      </div>
      <span
        className={clsx('px-2 py-0.5 rounded text-[11px] font-medium border shrink-0', tone)}
      >
        {pctVal}%
      </span>
    </div>
  );
}

export default function MatchPanel({
  jobId,
  jobStatus,
  match,
  onMatchChange,
}: MatchPanelProps) {
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canMatch = jobStatus === 'parsed';

  const handleCompute = async () => {
    setComputing(true);
    setError(null);
    try {
      const result = await matchesApi.compute(jobId);
      onMatchChange(result);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        'Failed to compute match';
      setError(msg);
    } finally {
      setComputing(false);
    }
  };

  if (!match) {
    return (
      <div className="card card-pad">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-600" />
            <h2 className="text-[15px] font-semibold text-slate-900">Match against your profile</h2>
          </div>
        </div>
        <p className="text-[13px] text-slate-600 mb-3">
          {canMatch
            ? 'Run the matcher to see how well this job fits your profile — skill match, experience, seniority, and education.'
            : 'The job must be parsed first (waiting for AI analysis to finish).'}
        </p>
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[12px] text-red-700">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handleCompute}
          disabled={!canMatch || computing}
          data-testid="compute-match-btn"
          className="btn-primary text-[13px]"
        >
          {computing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Computing…
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Compute match
            </>
          )}
        </button>
      </div>
    );
  }

  const rec = RECOMMENDATION_STYLES[match.recommendation];
  const scorePct = Math.round(match.match_score * 100);

  return (
    <div className="card card-pad" data-testid="match-panel">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-brand-600" />
            <h2 className="text-[15px] font-semibold text-slate-900">Match against your profile</h2>
          </div>
          <p className="text-[12px] text-slate-500">
            Last computed {new Date(match.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCompute}
            disabled={computing}
            data-testid="recompute-match-btn"
            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
            title="Recompute match"
          >
            {computing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Headline score + recommendation */}
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
        <div className="shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-slate-900 tabular-nums leading-none">
              {scorePct}
            </span>
            <span className="text-base text-slate-500 font-medium">%</span>
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">overall</div>
        </div>
        <div className="flex-1">
          <span
            data-testid="match-recommendation"
            className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold border',
              rec.cls,
            )}
          >
            {match.recommendation === 'apply' && <CheckCircle2 className="w-3.5 h-3.5" />}
            {match.recommendation === 'stretch' && <AlertTriangle className="w-3.5 h-3.5" />}
            {match.recommendation === 'skip' && <XCircle className="w-3.5 h-3.5" />}
            {rec.label}
          </span>
          <p className="text-[12px] text-slate-600 mt-1.5 leading-relaxed">{rec.description}</p>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="space-y-3 mb-4">
        <ScoreBar label="Skills" value={match.score_breakdown.skill} icon={<Award className="w-3 h-3" />} />
        <ScoreBar label="Experience" value={match.score_breakdown.experience} icon={<Briefcase className="w-3 h-3" />} />
        <ScoreBar label="Seniority" value={match.score_breakdown.seniority} icon={<TrendingUp className="w-3 h-3" />} />
        <ScoreBar label="Education" value={match.score_breakdown.education} icon={<GraduationCap className="w-3 h-3" />} />
      </div>

      {/* LLM narrative */}
      {match.llm && (match.llm.summary || match.llm.strengths.length || match.llm.gaps.length) && (
        <div className="mb-4 p-3 bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 rounded-lg">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 uppercase tracking-wide mb-1.5">
            <Sparkles className="w-3 h-3" />
            AI insight
          </div>
          {match.llm.summary && (
            <p className="text-[13px] text-slate-700 leading-relaxed mb-2">
              {match.llm.summary}
            </p>
          )}
          {(match.llm.strengths.length > 0 || match.llm.gaps.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              {match.llm.strengths.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-1">
                    Strengths
                  </div>
                  <ul className="space-y-0.5">
                    {match.llm.strengths.map((s, i) => (
                      <li key={i} className="text-[12px] text-slate-700 flex items-start gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {match.llm.gaps.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-red-700 font-semibold mb-1">
                    Gaps
                  </div>
                  <ul className="space-y-0.5">
                    {match.llm.gaps.map((g, i) => (
                      <li key={i} className="text-[12px] text-slate-700 flex items-start gap-1">
                        <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Skills detail (collapsible) */}
      <details className="group" data-testid="match-skills-details">
        <summary className="cursor-pointer text-[13px] font-medium text-slate-700 hover:text-slate-900 flex items-center justify-between mb-2">
          <span>Skill-by-skill breakdown</span>
          <span className="text-[11px] text-slate-500 group-open:hidden">
            {match.matched_skills.length + match.missing_skills.length} keywords · click to expand
          </span>
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 mt-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Matched ({match.matched_skills.length})
            </div>
            <div className="divide-y divide-slate-100">
              {match.matched_skills.map((m, i) => (
                <SkillMatchRow key={`m-${i}`} match={m} />
              ))}
              {match.matched_skills.length === 0 && (
                <p className="text-[12px] text-slate-500 italic py-2">No direct matches</p>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-red-700 font-semibold mb-1.5 flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              Missing ({match.missing_skills.length})
            </div>
            <div className="divide-y divide-slate-100">
              {match.missing_skills.map((m, i) => (
                <SkillMatchRow key={`x-${i}`} match={m} />
              ))}
              {match.missing_skills.length === 0 && (
                <p className="text-[12px] text-slate-500 italic py-2">Nothing missing 🎉</p>
              )}
            </div>
          </div>
        </div>
      </details>

      {error && (
        <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[12px] text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}