import { useEffect, useState, useCallback } from 'react';
import { Briefcase, RefreshCw, AlertCircle, Plus, X } from 'lucide-react';
import { jobsApi, type JobOut } from '../lib/api';
import PasteZone from '../components/jobs/PasteZone';
import JobCard from '../components/jobs/JobCard';

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
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

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

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCreated = (job: JobOut) => {
    setShowAdd(false);
    setToast({ type: 'success', msg: `Job submitted — analyzing in background` });
    setJobs((prev) => [job, ...prev]);
  };

  const handleDelete = async (id: string) => {
    try {
      await jobsApi.delete(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setToast({ type: 'success', msg: 'Job deleted' });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to delete job';
      setToast({ type: 'error', msg });
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchJobs();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-brand-600" />
            Job Postings
          </h1>
          <p className="text-[14px] text-slate-600 mt-1">
            Paste a job URL or description. AI analyzes it, extracts skills and keywords, then we match it against your profile.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          data-testid="toast"
          className={`mb-4 px-4 py-2.5 rounded-lg text-[13px] font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Add form (inline, not modal — simpler) */}
      {showAdd && (
        <div className="mb-6">
          <PasteZone
            onCreated={handleCreated}
            onError={(msg) => setToast({ type: 'error', msg })}
          />
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Footer hint */}
      {!loading && jobs.length > 0 && (
        <p className="mt-6 text-center text-[12px] text-slate-500">
          {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} ·{' '}
          {jobs.filter((j) => j.status === 'parsed').length} analyzed
        </p>
      )}
    </div>
  );
}