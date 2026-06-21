import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  DollarSign,
  GraduationCap,
  Clock,
  AlertCircle,
  Loader2,
  Sparkles,
  Tag,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  ListChecks,
  Heart,
  Link2,
  CalendarPlus,
  Gauge,
} from 'lucide-react';
import clsx from 'clsx';
import { jobsApi, matchesApi, type JobOut, type JobAnalysis, type JobSkillCategory, type JobMatch } from '../lib/api';
import PageHeader from '../components/PageHeader';
import MatchPanel from '../components/jobs/MatchPanel';
import QuickFactsGrid, { type QuickFact } from '../components/jobs/QuickFactsGrid';

// Module-level so HMR + Strict Mode double-invoke can't double-schedule.
// Mirrors the Phase 2 ProfilePage pattern.
let pollTimer: ReturnType<typeof setInterval> | null = null;
function clearPollTimer() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// Phase 10D fix: Required Skills section used to render a 2-col grid
// where each category got its own card. When a category had only 1
// keyword (common case — "LANGUAGES: Python"), each card was a giant
// 1-word tile wasting vertical space. Now we render a single chip cloud
// grouped by category in compact rows.
function SkillsChipCloud({
  categories,
  tone = 'brand',
}: {
  categories: JobSkillCategory[];
  tone?: 'brand' | 'pink';
}) {
  const cls =
    tone === 'pink'
      ? 'bg-pink-50 text-pink-700 border-pink-200'
      : 'bg-brand-50 text-brand-700 border-brand-200';
  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat.name} className="flex items-start gap-3">
          <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 w-24 lg:w-32 shrink-0 pt-1">
            {cat.name}
            <span className="text-slate-400 ml-1">({cat.keywords.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {cat.keywords.map((kw) => (
              <span
                key={kw}
                className={clsx(
                  'px-2 py-0.5 text-[12px] font-medium border rounded',
                  cls,
                )}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const statusBanner: Record<string, { label: string; cls: string }> = {
  scraping:   { label: 'Fetching job posting…',     cls: 'bg-blue-50 border-blue-200 text-blue-800' },
  parsing:    { label: 'AI is analyzing this job…',  cls: 'bg-amber-50 border-amber-200 text-amber-800' },
  pending:    { label: 'Queued for analysis…',       cls: 'bg-slate-50 border-slate-200 text-slate-700' },
  failed:     { label: 'Analysis failed',            cls: 'bg-red-50 border-red-200 text-red-800' },
  parsed:     { label: 'Analysis complete',          cls: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
};

export default function JobDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobOut | null>(null);
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchJob = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await jobsApi.get(id);
      setJob(data);
      setError(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        'Failed to load job';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Fetch existing match (silently fails if none — that's fine).
  const fetchMatch = useCallback(async () => {
    try {
      const data = await matchesApi.get(id);
      setMatch(data);
    } catch {
      // 404 = no match yet. Other errors we surface on the panel itself.
      setMatch(null);
    }
  }, [id]);

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  // Re-fetch match when job transitions to 'parsed'. Without this the
  // user would still see "Compute match" CTA on a freshly parsed job
  // that already has a match from a previous session.
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (job?.status === "parsed" && prevStatusRef.current !== "parsed") {
      fetchMatch();
    }
    prevStatusRef.current = job?.status ?? null;
  }, [job?.status, fetchMatch]);

  // Poll while still analyzing.
  // Pattern: only re-arm when transitioning into "is analyzing" state.
  // Avoids clearInterval/setInterval churn on every job state update.
  useEffect(() => {
    if (!job) {
      clearPollTimer();
      return clearPollTimer;
    }
    const isAnalyzing =
      job.status === 'scraping' || job.status === 'parsing' || job.status === 'pending';
    if (!isAnalyzing) {
      clearPollTimer();
      return clearPollTimer;
    }

    if (pollTimer === null) {
      pollTimer = setInterval(() => fetchJob(true), 3000);
    }
    return clearPollTimer;
  }, [job, fetchJob]);

  const handleDelete = async () => {
    if (!job) return;
    if (!confirm(`Delete "${job.title || 'this job'}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await jobsApi.delete(job.id);
      navigate('/jobs');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to delete';
      alert(msg);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading job…
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to jobs
        </Link>
        <div className="card card-pad text-center py-12">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-slate-900 mb-1">
            {error || 'Job not found'}
          </h3>
          <p className="text-[13px] text-slate-600">
            The job may have been deleted or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  const analysis = job.job_analysis_json as JobAnalysis | Record<string, never>;
  const hasAnalysis =
    analysis && Object.keys(analysis).length > 0 && job.status === 'parsed';

  const banner = statusBanner[job.status];

  // Safe salary display
  const salaryMin = analysis?.salary?.min ?? job.salary_min;
  const salaryMax = analysis?.salary?.max ?? job.salary_max;
  // Only show salary if we have a currency — never fake "USD" defaults.
  // Without this, IDR jobs would render as "USD 25,000,000+" which is
  // wrong and confusing. Show "Not stated" if the JD didn't say.
  const salaryCurrency = analysis?.salary?.currency ?? job.salary_currency;
  const hasSalary = Boolean(salaryCurrency && (salaryMin || salaryMax));

  // Build subtitle for PageHeader — meta line below job title
  const metaBits: string[] = [];
  if (analysis?.company || job.company) metaBits.push(analysis?.company || job.company || '');
  if (analysis?.location || job.location) metaBits.push(analysis?.location || job.location || '');
  if (analysis?.remote_type || job.remote) metaBits.push('Remote');
  if (analysis?.seniority || job.seniority) metaBits.push(analysis?.seniority || job.seniority || '');
  const metaLine = metaBits.filter(Boolean).join(' · ');

  // Compose Quick Facts. Phase 10D: include fallback facts (Source, Posted,
  // Confidence) so the row never shows a single lonely fact with empty
  // cells across 3 columns. Always-available fields guarantee at least 3.
  const facts: QuickFact[] = [
    // Hard-required / optional from analysis
    hasSalary && {
      icon: DollarSign,
      label: 'Salary',
      value:
        salaryMin && salaryMax
          ? `${salaryCurrency} ${salaryMin.toLocaleString()}–${salaryMax.toLocaleString()}`
          : salaryMin
          ? `${salaryCurrency} ${salaryMin.toLocaleString()}+`
          : `${salaryCurrency} ${salaryMax?.toLocaleString()}`,
    },
    analysis?.employment_type && {
      icon: Clock,
      label: 'Type',
      value: analysis.employment_type.replace('-', ' '),
    },
    analysis?.required_experience_years !== undefined && {
      icon: Briefcase,
      label: 'Experience',
      value: `${analysis.required_experience_years}+ years`,
    },
    analysis?.required_education && {
      icon: GraduationCap,
      label: 'Education',
      value: analysis.required_education,
    },
    // Always-available fallbacks (Source + Posted + Confidence) so the
    // 4-col grid never leaves empty cells when JD is sparse.
    {
      icon: job.source_type === 'url' ? Link2 : Copy,
      label: 'Source',
      value: job.source_type === 'url' ? 'From URL' : 'Manual paste',
    },
    {
      icon: CalendarPlus,
      label: 'Posted',
      value: new Date(job.created_at).toLocaleDateString(),
    },
    hasAnalysis && analysis?.confidence_score !== undefined && {
      icon: Gauge,
      label: 'AI confidence',
      value: `${Math.round((analysis.confidence_score || 0) * 100)}%`,
    },
  ].filter(Boolean) as QuickFact[];

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* ── PageHeader — uniform with other pages (Phase 10D) ────── */}
      <PageHeader
        icon={Briefcase}
        title={job.title || 'Untitled role'}
        subtitle={metaLine || 'Job from your list'}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {hasAnalysis && (
              <span
                data-testid="ai-analyzed-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 rounded-lg text-[11px] font-semibold text-brand-700 uppercase tracking-wide"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Analyzed
              </span>
            )}
            <Link
              to="/jobs"
              data-testid="back-to-jobs"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white text-[13px] text-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All jobs
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              data-testid="delete-job-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-red-600 hover:bg-red-50 hover:text-red-700 border border-transparent rounded-lg transition-colors disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete
            </button>
          </div>
        }
      />

      {/* Status banner (if analyzing/failed) */}
      {banner && job.status !== 'parsed' && (
        <div
          data-testid="status-banner"
          className={clsx(
            'px-4 py-2.5 border rounded-lg text-[13px] font-medium flex items-center gap-2',
            banner.cls,
          )}
        >
          {job.status === 'parsing' || job.status === 'scraping' ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {banner.label}
          {job.error_message && (
            <span className="text-[12px] font-normal ml-2 opacity-80">
              — {job.error_message}
            </span>
          )}
        </div>
      )}

      {/* ── Quick facts card — Phase 10D: own card (was inside hero) ── */}
      {facts.length > 0 && (
        <div className="card card-pad">
          <QuickFactsGrid
            facts={facts}
            footer={
              !hasSalary && analysis?.employment_type
                ? 'Salary not stated in JD'
                : undefined
            }
          />
        </div>
      )}

      {/* ── Match panel — Phase 5 ──────────────────────────────── */}
      <MatchPanel
        jobId={id}
        jobStatus={job.status}
        match={match}
        onMatchChange={setMatch}
      />

      {/* ── Summary (full width when no other section to pair with) ── */}
      {hasAnalysis && analysis?.summary && (
        <div className="card card-pad">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900">Summary</h2>
            <CopyButton text={analysis.summary} />
          </div>
          <p className="text-[14px] text-slate-700 leading-relaxed">
            {analysis.summary}
          </p>
        </div>
      )}

      {/* ── Required + Preferred skills (chip cloud) ────────────── */}
      {hasAnalysis && analysis?.required_skills && analysis.required_skills.length > 0 && (
        <div className="card card-pad">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="w-4 h-4 text-brand-600" />
            <h2 className="text-[15px] font-semibold text-slate-900">Required skills</h2>
            <span className="text-[11px] text-slate-500 ml-auto">
              {analysis.required_skills.reduce((n, c) => n + c.keywords.length, 0)} keywords
            </span>
          </div>
          <SkillsChipCloud categories={analysis.required_skills} tone="brand" />
        </div>
      )}

      {hasAnalysis && analysis?.preferred_skills && analysis.preferred_skills.length > 0 && (
        <div className="card card-pad">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-4 h-4 text-pink-500" />
            <h2 className="text-[15px] font-semibold text-slate-900">Preferred / nice-to-have</h2>
            <span className="text-[11px] text-slate-500 ml-auto">
              {analysis.preferred_skills.reduce((n, c) => n + c.keywords.length, 0)} keywords
            </span>
          </div>
          <SkillsChipCloud categories={analysis.preferred_skills} tone="pink" />
        </div>
      )}

      {/* ── 2-col: Responsibilities (left) + ATS keywords (right) ──
          Phase 10D fix: previously these were stacked full-width, both
          feeling like afterthoughts. Side-by-side at lg+ gives the page
          a balanced "kiri kanan" rhythm that matches Dashboard cards. */}
      {hasAnalysis && ((analysis?.responsibilities?.length ?? 0) > 0 || (analysis?.ats_keywords?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
          {hasAnalysis && analysis?.responsibilities && analysis.responsibilities.length > 0 && (
            <div className="card card-pad">
              <h2 className="text-[15px] font-semibold text-slate-900 mb-3">
                What you'll do
              </h2>
              <ul className="space-y-2">
                {analysis.responsibilities.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-slate-700 leading-relaxed">
                    <span className="w-1.5 h-1.5 bg-brand-500 rounded-full mt-2 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasAnalysis && analysis?.ats_keywords && analysis.ats_keywords.length > 0 && (
            <div className="card card-pad">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-600" />
                  <h2 className="text-[15px] font-semibold text-slate-900">
                    ATS keywords
                    <span className="ml-2 text-[12px] font-normal text-slate-500">
                      {analysis.ats_keywords.length} extracted
                    </span>
                  </h2>
                </div>
                <CopyButton text={analysis.ats_keywords.join(', ')} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.ats_keywords.map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-1 text-[12px] font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded"
                  >
                    {kw}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-3 italic">
                Paste these in your CV's skills section for better ATS matching.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Raw JD (collapsible) ────────────────────────────────── */}
      {job.raw_description && (
        <details className="card card-pad group">
          <summary className="cursor-pointer text-[13px] font-medium text-slate-700 hover:text-slate-900 flex items-center justify-between">
            <span>Raw job description</span>
            <span className="text-[11px] text-slate-500 group-open:hidden">
              click to expand
            </span>
          </summary>
          <pre className="mt-3 text-[12px] text-slate-700 font-mono leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-200">
            {job.raw_description}
          </pre>
        </details>
      )}

      {/* ── Source URL footer (only if not already in actions) ───── */}
      {job.source_url && (
        <div className="flex items-center justify-end pt-2">
          <a
            href={job.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-700"
          >
            <ExternalLink className="w-3 h-3" />
            Open source URL
          </a>
        </div>
      )}
    </div>
  );
}
