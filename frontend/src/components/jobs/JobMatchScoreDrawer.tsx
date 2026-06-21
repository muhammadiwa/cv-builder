/**
 * JobMatchScoreDrawer — right-side slide-in drawer for full match breakdown.
 *
 * Phase 10D: per spec N, clicking the Match Score Badge on a card
 * opens this drawer. It carries the full JobMatch payload
 * (breakdown, matched/missing skills, LLM narrative) so the user
 * can see exactly which skills matched, which didn't, what their
 * eligibility status is, and what the recommended CV strategy is.
 *
 * Sections:
 *   1. Header: title, company, overall score, label, confidence, timestamp
 *   2. Score breakdown (4-component view + N/A notes for the 4 components
 *      not yet computed by the matcher)
 *   3. Strong matches
 *   4. Partial matches
 *   5. Critical gaps
 *   6. Eligibility checks
 *   7. Recommended CV strategy
 *   8. Actions (Build CV, Generate Cover Letter, Recalculate, etc.)
 */
import { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Mail,
  RefreshCw,
  EyeOff,
  Bookmark,
  TrendingUp,
  Loader2,
  Info,
  Briefcase,
} from 'lucide-react';
import clsx from 'clsx';
import {
  matchesApi,
  type JobMatch,
  type JobOut,
  type ScoreBreakdown,
} from '../../lib/api';
import { matchLabelFromScore } from './JobMatchScoreBadge';
import { useNavigate } from 'react-router-dom';

interface JobMatchScoreDrawerProps {
  open: boolean;
  job: JobOut | null;
  onClose: () => void;
  /** Pre-fetched summary (for the header score + label), or null. */
  summaryScore: number | null;
  summaryRecommendation: 'apply' | 'stretch' | 'skip' | null;
  /** Confidence 0-1, from summary if available. */
  summaryConfidence: number | null;
  /** Notify parent of UI actions (e.g. delete the job) so it can refresh. */
  onMatchUpdated?: (m: JobMatch | null) => void;
}

// Phase 10D: 8-component breakdown per spec J. The current matcher
// only computes 4 (skill, experience, seniority, education). The
// other 4 (responsibility evidence, work mode, industry, ATS keyword)
// are marked N/A with a note in the drawer — per spec K "Missing
// Data Normalization" we don't fake them.
const BREAKDOWN_SPEC: Array<{
  key: keyof ScoreBreakdown | 'responsibility' | 'work_mode' | 'industry' | 'ats_keyword';
  label: string;
  max: number;
  available: boolean;
  sourceKey?: keyof ScoreBreakdown;
}> = [
  { key: 'skill',                label: 'Required Technical Skills', max: 28, available: true,  sourceKey: 'skill' },
  { key: 'experience',           label: 'Relevant Experience',       max: 22, available: true,  sourceKey: 'experience' },
  { key: 'seniority',            label: 'Role & Seniority',          max: 14, available: true,  sourceKey: 'seniority' },
  { key: 'responsibility',       label: 'Responsibility Evidence',   max: 12, available: false },
  { key: 'education',            label: 'Education',                  max: 3,  available: true,  sourceKey: 'education' },
  { key: 'work_mode',            label: 'Work Mode & Location',      max: 8,  available: false },
  { key: 'industry',             label: 'Industry Fit',               max: 5,  available: false },
  { key: 'ats_keyword',          label: 'ATS Keyword Readiness',     max: 3,  available: false },
];

function fmtPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function confidenceLabel(c: number | null): { label: string; cls: string } {
  if (c == null) return { label: 'Confidence unknown', cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  if (c >= 0.7) return { label: 'High confidence', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (c >= 0.4) return { label: 'Medium confidence', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Low confidence', cls: 'bg-red-50 text-red-700 border-red-200' };
}

export default function JobMatchScoreDrawer({
  open,
  job,
  onClose,
  summaryScore,
  summaryRecommendation,
  summaryConfidence,
  onMatchUpdated,
}: JobMatchScoreDrawerProps) {
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const navigate = useNavigate();

  // Fetch full match when drawer opens
  useEffect(() => {
    if (!open || !job) {
      setMatch(null);
      return;
    }
    let alive = true;
    setLoading(true);
    matchesApi
      .get(job.id)
      .then((data) => {
        if (alive) setMatch(data);
      })
      .catch(() => {
        if (alive) setMatch(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, job]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!job) return null;

  // Determine the score to display (prefer the loaded full match, fall
  // back to the summary)
  const score = match?.match_score ?? summaryScore ?? 0;
  const rec = match?.recommendation ?? summaryRecommendation ?? 'skip';
  const label = matchLabelFromScore(score);
  const conf = match?.confidence_score ?? summaryConfidence ?? null;
  const confBadge = confidenceLabel(conf);

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      const updated = await matchesApi.compute(job.id);
      setMatch(updated);
      onMatchUpdated?.(updated);
    } catch {
      // surface via toast in parent; ignore here
    } finally {
      setRecomputing(false);
    }
  };

  const matchedSkills = match?.matched_skills ?? [];
  const missingSkills = match?.missing_skills ?? [];
  const experience = match?.experience;
  const seniority = match?.seniority;
  const education = match?.education;
  const llm = match?.llm;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={clsx(
          'fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-drawer-title"
        data-testid="match-drawer"
        data-state={open ? 'open' : 'closed'}
        className={clsx(
          'fixed top-0 right-0 h-full w-full max-w-xl bg-white border-l border-slate-200',
          'shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* ── Header ── */}
        <header className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-brand-600 mb-1">
              <TrendingUp className="w-3 h-3" />
              Profile Match
            </div>
            <h2 id="match-drawer-title" className="text-[16px] font-semibold text-slate-900 leading-tight">
              {job.title || 'Untitled role'}
            </h2>
            <div className="text-[12px] text-slate-500 mt-0.5 truncate">
              {job.company || 'Unknown company'}{job.location ? ` · ${job.location}` : ''}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span
                data-testid="match-drawer-overall"
                className="text-2xl font-bold text-slate-900 tabular-nums"
              >
                {Math.round(score * 100)}%
              </span>
              <span
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border',
                  rec === 'apply' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  rec === 'stretch' && 'bg-amber-50 text-amber-700 border-amber-200',
                  rec === 'skip' && 'bg-red-50 text-red-700 border-red-200',
                )}
              >
                {label}
              </span>
              <span
                data-testid="match-drawer-confidence"
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                  confBadge.cls,
                )}
              >
                <Info className="w-2.5 h-2.5" />
                {confBadge.label}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">
              {match
                ? `Last calculated ${relTime(match.created_at)}`
                : summaryScore != null
                ? `Last calculated (summary)`
                : 'Not yet calculated — recompute to score'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="match-drawer-close"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors shrink-0"
            title="Close drawer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-slate-500 text-[13px]">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Loading match…
            </div>
          )}

          {!loading && (
            <div className="p-5 space-y-6">
              {/* No-match state */}
              {!match && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold mb-1">No match computed yet</p>
                      <p className="text-amber-700">
                        The match needs to be calculated. Recompute to see the breakdown.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Score breakdown */}
              {match && (
                <section data-testid="match-breakdown">
                  <h3 className="text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-3">
                    Score breakdown (8 components, 100 points)
                  </h3>
                  <div className="space-y-2">
                    {BREAKDOWN_SPEC.map((spec) => {
                      if (spec.available && spec.sourceKey) {
                        const value = match.score_breakdown[spec.sourceKey] ?? 0;
                        const earned = Math.round(value * spec.max);
                        return (
                          <BreakdownRow
                            key={spec.key}
                            label={spec.label}
                            earned={earned}
                            max={spec.max}
                            tone={earned / spec.max >= 0.7 ? 'good' : earned / spec.max >= 0.4 ? 'mid' : 'low'}
                          />
                        );
                      }
                      return (
                        <BreakdownRow
                          key={spec.key}
                          label={spec.label}
                          earned={null}
                          max={spec.max}
                          tone="na"
                        />
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Strong matches */}
              {matchedSkills.length > 0 && (
                <section data-testid="match-strong">
                  <h3 className="text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Strong matches
                    <span className="text-slate-400 normal-case tracking-normal font-normal ml-1">
                      ({matchedSkills.length})
                    </span>
                  </h3>
                  <ul className="space-y-1.5">
                    {matchedSkills.map((m, i) => (
                      <li
                        key={`matched-${i}`}
                        className="flex items-start gap-2 text-[13px] text-slate-700"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{m.required_keyword}</span>
                          {m.matched_keyword && m.matched_keyword !== m.required_keyword && (
                            <span className="text-slate-500"> (via {m.matched_keyword})</span>
                          )}
                          <span
                            className={clsx(
                              'ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium border tabular-nums',
                              m.strength >= 0.9
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : m.strength >= 0.6
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200',
                            )}
                          >
                            {fmtPct(m.strength)}
                          </span>
                          {m.match_method && m.match_method !== 'exact' && (
                            <span className="ml-1 text-[10px] text-amber-600">
                              ≈ {m.match_method}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Critical gaps */}
              {missingSkills.length > 0 && (
                <section data-testid="match-gaps">
                  <h3 className="text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                    Critical gaps
                    <span className="text-slate-400 normal-case tracking-normal font-normal ml-1">
                      ({missingSkills.length})
                    </span>
                  </h3>
                  <ul className="space-y-1.5">
                    {missingSkills.slice(0, 8).map((m, i) => (
                      <li
                        key={`missing-${i}`}
                        className="flex items-start gap-2 text-[13px] text-slate-700"
                      >
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                        <span className="font-medium">{m.required_keyword}</span>
                        <span className="text-slate-400">— {m.required_skill}</span>
                      </li>
                    ))}
                    {missingSkills.length > 8 && (
                      <li className="text-[12px] text-slate-500 italic">
                        + {missingSkills.length - 8} more
                      </li>
                    )}
                  </ul>
                </section>
              )}

              {/* Eligibility checks */}
              {match && (
                <section data-testid="match-eligibility">
                  <h3 className="text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                    Eligibility checks
                  </h3>
                  <ul className="space-y-1.5 text-[13px]">
                    <EligibilityRow
                      label="Experience"
                      value={experience?.status}
                      detail={
                        experience?.required_years != null && experience?.profile_years != null
                          ? `${experience.profile_years}y vs ${experience.required_years}y required`
                          : undefined
                      }
                    />
                    <EligibilityRow
                      label="Seniority"
                      value={seniority?.status}
                      detail={
                        seniority?.job_seniority && seniority?.profile_seniority
                          ? `${seniority.profile_seniority} vs ${seniority.job_seniority}`
                          : undefined
                      }
                    />
                    <EligibilityRow
                      label="Education"
                      value={education?.status}
                      detail={
                        education?.required && education?.profile
                          ? `${education.profile} vs ${education.required}`
                          : undefined
                      }
                    />
                    <EligibilityRow
                      label="Work authorization"
                      value={null}
                      detail="Not stated in profile"
                    />
                    <EligibilityRow
                      label="Visa sponsorship"
                      value={null}
                      detail="Not stated in job description"
                    />
                  </ul>
                </section>
              )}

              {/* Recommended CV strategy (LLM narrative fallback) */}
              {llm && (llm.summary || llm.strengths.length > 0 || llm.gaps.length > 0) && (
                <section data-testid="match-strategy">
                  <h3 className="text-[13px] font-semibold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                    Recommended CV strategy
                  </h3>
                  {llm.summary && (
                    <p className="text-[13px] text-slate-700 leading-relaxed mb-3">
                      {llm.summary}
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-2">
                    {llm.strengths.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-emerald-700 mb-1">
                          Lead with
                        </div>
                        <ul className="space-y-1">
                          {llm.strengths.slice(0, 3).map((s, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[12.5px] text-slate-700">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {llm.gaps.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-red-700 mb-1">
                          Don't claim (gaps)
                        </div>
                        <ul className="space-y-1">
                          {llm.gaps.slice(0, 3).map((g, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[12.5px] text-slate-700">
                              <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                              <span>{g}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* ── Actions footer ── */}
        <footer className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/cv-drafts?job_id=${job.id}`)}
            data-testid="drawer-build-cv"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-brand-600 text-white rounded-md hover:bg-brand-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Build Tailored CV
          </button>
          <button
            type="button"
            onClick={() => navigate(`/cover-letters?job_id=${job.id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:border-slate-300 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Cover Letter
          </button>
          <button
            type="button"
            onClick={handleRecompute}
            disabled={recomputing}
            data-testid="drawer-recompute"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:border-slate-300 transition-colors disabled:opacity-50"
          >
            {recomputing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Recalculate
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:border-slate-300 transition-colors"
            title="Save for later"
          >
            <Bookmark className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-white border border-slate-200 text-slate-700 rounded-md hover:border-slate-300 transition-colors ml-auto"
            title="Hide from recommendations"
          >
            <EyeOff className="w-3.5 h-3.5" />
            Hide
          </button>
        </footer>
      </aside>
    </>
  );
}

function BreakdownRow({
  label,
  earned,
  max,
  tone,
}: {
  label: string;
  earned: number | null;
  max: number;
  tone: 'good' | 'mid' | 'low' | 'na';
}) {
  const isNA = tone === 'na' || earned === null;
  const pct = earned == null ? 0 : earned / max;
  return (
    <div className="flex items-center gap-3 text-[12.5px]">
      <div className="w-44 text-slate-700 shrink-0">{label}</div>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        {!isNA && (
          <div
            className={clsx(
              'h-full transition-all',
              tone === 'good' && 'bg-emerald-500',
              tone === 'mid' && 'bg-amber-500',
              tone === 'low' && 'bg-red-500',
            )}
            style={{ width: `${Math.max(2, pct * 100)}%` }}
          />
        )}
      </div>
      <div
        className={clsx(
          'tabular-nums font-medium w-20 text-right shrink-0',
          isNA ? 'text-slate-400 italic' : 'text-slate-700',
        )}
      >
        {isNA ? 'N/A' : `${earned}/${max}`}
      </div>
    </div>
  );
}

function EligibilityRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | null | undefined;
  detail?: string;
}) {
  // Status normalization per spec H.6 + J.6
  const isMatch = value === 'meets' || value === 'exceeds' || value === 'match';
  const isClose = value === 'close';
  const isMismatch = value === 'below' || value === 'mismatch';
  const isUnknown = value == null || value === 'unknown';

  let iconCls = 'text-slate-400';
  let Icon = Info;
  if (isMatch) {
    iconCls = 'text-emerald-500';
    Icon = CheckCircle2;
  } else if (isClose) {
    iconCls = 'text-amber-500';
    Icon = AlertTriangle;
  } else if (isMismatch) {
    iconCls = 'text-red-500';
    Icon = XCircle;
  }

  return (
    <li className="flex items-center gap-2">
      <Icon className={clsx('w-3.5 h-3.5 shrink-0', iconCls)} />
      <span className="w-32 text-slate-600">{label}</span>
      <span
        className={clsx(
          'font-medium',
          isMatch && 'text-emerald-700',
          isClose && 'text-amber-700',
          isMismatch && 'text-red-700',
          isUnknown && 'text-slate-500',
        )}
      >
        {isUnknown ? 'Unknown' : isMatch ? 'Match' : isClose ? 'Close' : 'Mismatch'}
      </span>
      {detail && <span className="text-slate-400 text-[12px]">— {detail}</span>}
    </li>
  );
}
