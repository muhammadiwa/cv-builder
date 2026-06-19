import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  MapPin,
  Globe,
  Calendar,
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
} from 'lucide-react';
import clsx from 'clsx';
import { jobsApi, type JobOut, type JobAnalysis, type JobSkillCategory } from '../lib/api';

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

function SkillChip({ name, keywords }: JobSkillCategory) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white">
      <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-2">
        {name}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="px-2 py-0.5 text-[12px] font-medium bg-brand-50 text-brand-700 border border-brand-200 rounded"
          >
            {kw}
          </span>
        ))}
      </div>
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
      <div className="max-w-4xl mx-auto px-6 py-16 text-center text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading job…
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900 mb-4"
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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All jobs
      </Link>

      {/* Status banner (if analyzing/failed) */}
      {banner && job.status !== 'parsed' && (
        <div
          data-testid="status-banner"
          className={clsx(
            'mb-4 px-4 py-2.5 border rounded-lg text-[13px] font-medium flex items-center gap-2',
            banner.cls
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

      {/* Hero card */}
      <div className="card card-pad mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {job.title || 'Untitled role'}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-slate-600">
              {job.company && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {job.company}
                </span>
              )}
              {analysis?.location || job.location ? (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {analysis?.location || job.location}
                </span>
              ) : null}
              {(analysis?.remote_type || job.remote) && (
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Remote
                </span>
              )}
              {(analysis?.seniority || job.seniority) && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  {analysis?.seniority || job.seniority}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Added {new Date(job.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {hasAnalysis && (
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-200 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-brand-700" />
                <span className="text-[11px] font-semibold text-brand-700 uppercase tracking-wide">
                  AI Analyzed
                </span>
              </div>
              {analysis?.confidence_score !== undefined && (
                <span className="text-[11px] text-slate-500">
                  Confidence: {Math.round((analysis.confidence_score || 0) * 100)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick facts row */}
        {(hasSalary || analysis?.employment_type || analysis?.required_experience_years || analysis?.required_education) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            {hasSalary && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
                  <DollarSign className="w-3 h-3" />
                  Salary
                </div>
                <div className="text-[14px] font-semibold text-slate-900">
                  {salaryMin && salaryMax
                    ? `${salaryCurrency} ${salaryMin.toLocaleString()}–${salaryMax.toLocaleString()}`
                    : salaryMin
                    ? `${salaryCurrency} ${salaryMin.toLocaleString()}+`
                    : `${salaryCurrency} ${salaryMax?.toLocaleString()}`}
                </div>
              </div>
            )}
            {!hasSalary && analysis?.employment_type && (
              <div className="col-span-2 text-[12px] text-slate-500 italic">
                Salary not stated in JD
              </div>
            )}
            {analysis?.employment_type && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
                  <Clock className="w-3 h-3" />
                  Type
                </div>
                <div className="text-[14px] font-semibold text-slate-900 capitalize">
                  {analysis.employment_type.replace('-', ' ')}
                </div>
              </div>
            )}
            {analysis?.required_experience_years !== undefined && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
                  <Briefcase className="w-3 h-3" />
                  Experience
                </div>
                <div className="text-[14px] font-semibold text-slate-900">
                  {analysis.required_experience_years}+ years
                </div>
              </div>
            )}
            {analysis?.required_education && (
              <div>
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
                  <GraduationCap className="w-3 h-3" />
                  Education
                </div>
                <div className="text-[14px] font-semibold text-slate-900">
                  {analysis.required_education}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary */}
      {hasAnalysis && analysis?.summary && (
        <div className="card card-pad mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-slate-900">Summary</h2>
            <CopyButton text={analysis.summary} />
          </div>
          <p className="text-[14px] text-slate-700 leading-relaxed">
            {analysis.summary}
          </p>
        </div>
      )}

      {/* Required skills */}
      {hasAnalysis && analysis?.required_skills && analysis.required_skills.length > 0 && (
        <div className="card card-pad mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="w-4 h-4 text-brand-600" />
            <h2 className="text-[15px] font-semibold text-slate-900">Required skills</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.required_skills.map((cat) => (
              <SkillChip key={cat.name} name={cat.name} keywords={cat.keywords} />
            ))}
          </div>
        </div>
      )}

      {/* Preferred skills */}
      {hasAnalysis && analysis?.preferred_skills && analysis.preferred_skills.length > 0 && (
        <div className="card card-pad mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-4 h-4 text-pink-500" />
            <h2 className="text-[15px] font-semibold text-slate-900">Preferred / nice-to-have</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.preferred_skills.map((cat) => (
              <SkillChip key={cat.name} name={cat.name} keywords={cat.keywords} />
            ))}
          </div>
        </div>
      )}

      {/* Responsibilities */}
      {hasAnalysis && analysis?.responsibilities && analysis.responsibilities.length > 0 && (
        <div className="card card-pad mb-6">
          <h2 className="text-[15px] font-semibold text-slate-900 mb-3">
            What you'll do
          </h2>
          <ul className="space-y-2">
            {analysis.responsibilities.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] text-slate-700 leading-relaxed">
                <span className="w-1.5 h-1.5 bg-brand-500 rounded-full mt-2 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ATS keywords */}
      {hasAnalysis && analysis?.ats_keywords && analysis.ats_keywords.length > 0 && (
        <div className="card card-pad mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-amber-600" />
            <h2 className="text-[15px] font-semibold text-slate-900">
              ATS keywords
              <span className="ml-2 text-[12px] font-normal text-slate-500">
                ({analysis.ats_keywords.length} extracted — paste these in your CV)
              </span>
            </h2>
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
        </div>
      )}

      {/* Raw JD (collapsible) */}
      {job.raw_description && (
        <details className="card card-pad mb-6 group">
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

      {/* Actions footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2">
          {job.source_url && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-[13px]"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open source
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          data-testid="delete-job-btn"
          className="btn-ghost text-[13px] text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          {deleting ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          )}
          Delete
        </button>
      </div>
    </div>
  );
}