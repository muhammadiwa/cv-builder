import { useEffect, useState, useCallback, useMemo } from 'react';
import { Briefcase, RefreshCw, AlertCircle, Plus, X, ArrowUpDown } from 'lucide-react';
import clsx from 'clsx';
import { jobsApi, type JobOut, type JobStatus } from '../lib/api';
import { toast } from '../lib/toast';
import PageHeader from '../components/PageHeader';
import PasteZone from '../components/jobs/PasteZone';
import JobCard from '../components/jobs/JobCard';

type StatusFilter = 'all' | JobStatus;
type SortBy = 'newest' | 'oldest' | 'title';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'parsed', label: 'Analyzed' },
  { value: 'failed', label: 'Failed' },
  { value: 'scraping', label: 'Scraping' },
  { value: 'parsing', label: 'Analyzing' },
  { value: 'pending', label: 'Pending' },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
];

// Module-level so HMR + Strict Mode double-invoke can't double-schedule.
// Mirrors the Phase 2 ProfilePage pattern.
let pollTimer: ReturnType<typeof setInterval> | null = null;
function clearPollTimer() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await jobsApi.list();
      setJobs(data);
      setError(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        'Failed to load jobs';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Poll if any job is still analyzing.
  // Pattern: clear + only re-arm when transitioning into "has pending".
  // Avoids the clearInterval/setInterval churn from depending on `jobs`.
  useEffect(() => {
    const hasPending = jobs.some(
      (j) => j.status === 'scraping' || j.status === 'parsing' || j.status === 'pending'
    );

    if (!hasPending) {
      clearPollTimer();
      return clearPollTimer;
    }

    // Only arm if not already running
    if (pollTimer === null) {
      pollTimer = setInterval(() => {
        fetchJobs(true);
      }, 3000);
    }

    return clearPollTimer;
  }, [jobs, fetchJobs]);

  const handleCreated = (job: JobOut) => {
    setShowAdd(false);
    toast.success('Job submitted — analyzing in background');
    setJobs((prev) => [job, ...prev]);
  };

  const handleDelete = async (id: string) => {
    try {
      await jobsApi.delete(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.success('Job deleted');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to delete job';
      toast.error(msg);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      const updated = await jobsApi.reanalyze(id);
      // Replace the row in-place so the card flips to "scraping/parsing" instantly.
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
      toast.success('Retrying analysis…');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to retry';
      toast.error(msg);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  // Derive filter + sort in one pass. useMemo so it only re-runs when
  // jobs / statusFilter / sortBy actually change.
  const visibleJobs = useMemo(() => {
    const filtered =
      statusFilter === 'all'
        ? jobs
        : jobs.filter((j) => j.status === statusFilter);
    const sorted = [...filtered];
    if (sortBy === 'newest') {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else if (sortBy === 'oldest') {
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    } else if (sortBy === 'title') {
      sorted.sort((a, b) =>
        (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
      );
    }
    return sorted;
  }, [jobs, statusFilter, sortBy]);

  // Count per status for the filter chips' badges.
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobs.length };
    for (const j of jobs) counts[j.status] = (counts[j.status] ?? 0) + 1;
    return counts;
  }, [jobs]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        icon={Briefcase}
        title="Job Postings"
        subtitle="Paste a job URL or description. AI analyzes it, extracts skills and keywords, then we match it against your profile."
        actions={
          <>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              data-testid="refresh-btn"
              className="btn-secondary text-[13px]"
              title="Refresh job list"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(!showAdd)}
              data-testid="add-job-btn"
              className="btn-primary text-[13px]"
            >
              {showAdd ? (
                <>
                  <X className="w-3.5 h-3.5 mr-1.5" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Job
                </>
              )}
            </button>
          </>
        }
      />

      {/* Add form (inline, not modal — simpler) */}
      {showAdd && (
        <div>
          <PasteZone
            onCreated={handleCreated}
            onError={(msg) => toast.error(msg)}
          />
        </div>
      )}

      {/* Filter chips + sort dropdown (only when we have rows) */}
      {!loading && jobs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5" data-testid="status-filters">
            {STATUS_FILTERS.map((f) => {
              const count = statusCounts[f.value] ?? 0;
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  data-testid={`filter-${f.value}`}
                  className={clsx(
                    'px-3 py-1.5 text-[12px] font-medium rounded-full border transition-colors',
                    active
                      ? 'bg-brand-50 border-brand-300 text-brand-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  {f.label}
                  {count > 0 && (
                    <span
                      className={clsx(
                        'ml-1.5 text-[11px]',
                        active ? 'text-brand-600' : 'text-slate-400'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-1.5 text-[12px] text-slate-500">
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              data-testid="sort-select"
              className="bg-white border border-slate-200 rounded-md px-2 py-1 text-[12px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Error banner */}
      {error && !loading && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-red-800">Failed to load jobs</p>
            <p className="text-[12px] text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-16 text-slate-500 text-[13px]">
          Loading jobs…
        </div>
      )}

      {/* Empty state */}
      {!loading && jobs.length === 0 && !error && (
        <div className="card card-pad text-center py-16">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-[15px] font-semibold text-slate-900 mb-1">
            No jobs yet
          </h3>
          <p className="text-[13px] text-slate-600 mb-4 max-w-sm mx-auto">
            Add your first job posting to get AI-powered analysis and match scoring against your profile.
          </p>
          {!showAdd && (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="btn-primary text-[13px]"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add your first job
            </button>
          )}
        </div>
      )}

      {/* Job grid */}
      {!loading && jobs.length > 0 && (
        <div
          data-testid="jobs-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-6"
        >
          {visibleJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onDelete={handleDelete}
              onRetry={handleRetry}
            />
          ))}
        </div>
      )}

      {/* Empty-after-filter state */}
      {!loading && jobs.length > 0 && visibleJobs.length === 0 && (
        <div className="card card-pad text-center py-12">
          <p className="text-[14px] text-slate-600">
            No jobs match the <span className="font-semibold">{statusFilter}</span> filter.
          </p>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className="mt-3 text-[13px] text-brand-600 hover:text-brand-700 font-medium"
          >
            Show all jobs
          </button>
        </div>
      )}

      {/* Footer hint */}
      {!loading && jobs.length > 0 && (
        <p className="mt-6 text-center text-[12px] text-slate-500">
          {visibleJobs.length === jobs.length
            ? `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} · ${jobs.filter((j) => j.status === 'parsed').length} analyzed`
            : `Showing ${visibleJobs.length} of ${jobs.length} jobs`}
        </p>
      )}
    </div>
  );
}