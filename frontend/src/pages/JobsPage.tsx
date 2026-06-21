import { useEffect, useState, useCallback, useMemo } from 'react';
import { Briefcase, RefreshCw, AlertCircle, Plus, X, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { jobsApi, matchesApi, profileApi, type JobOut, type JobMatchSummary } from '../lib/api';
import { toast } from '../lib/toast';
import PageHeader from '../components/PageHeader';
import PasteZone from '../components/jobs/PasteZone';
import JobCard from '../components/jobs/JobCard';
import JobMatchScoreDrawer from '../components/jobs/JobMatchScoreDrawer';
import JobPostingSkeleton from '../components/jobs/JobPostingSkeleton';

type SortBy =
  | 'newest'
  | 'oldest'
  | 'title'
  | 'match_desc'
  | 'match_asc'
  | 'recently_analyzed'
  | 'failed_first'
  | 'lowest_experience'
  | 'highest_salary'
  | 'lowest_salary'
  | 'cv_ready'
  | 'cover_letter_ready'
  | 'critical_gaps';

// Phase 10E: status filter tabs were removed (the dark score panel
// on every card already communicates state). All filter groups
// (Work Mode, Employment, Seniority, etc.) were removed per the
// user's request — the page is now: sort + paginated grid.
//
// "Recommended for You" was also removed because the implementation
// was just "Highest Match Score + freshness" in disguise. Will be
// re-added once the user-preferences layer is wired.

// Phase 10E: 13 sort options. Sort is in URL (?sort=...) so links
// can share the chosen order. The default (no `sort` param) is
// 'newest' which is the most intuitive order for a brand-new user.
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'newest',              label: 'Newest Posted' },
  { value: 'oldest',              label: 'Oldest Posted' },
  { value: 'match_desc',          label: 'Highest Match Score' },
  { value: 'match_asc',           label: 'Lowest Match Score' },
  { value: 'recently_analyzed',   label: 'Recently Analyzed' },
  { value: 'lowest_experience',   label: 'Lowest Experience Required' },
  { value: 'highest_salary',      label: 'Highest Salary' },
  { value: 'lowest_salary',       label: 'Lowest Salary' },
  { value: 'cv_ready',            label: 'Jobs With CV Ready' },
  { value: 'cover_letter_ready',  label: 'Jobs With Cover Letter Ready' },
  { value: 'critical_gaps',       label: 'Jobs With Critical Gaps' },
  { value: 'failed_first',        label: 'Failed Analysis First' },
  { value: 'title',               label: 'Title A–Z' },
];

// Phase 10E: pagination. 24 jobs per page = 6 rows in the 4-col
// grid (collapses to 2-3-1 cols on tablet/mobile). Page index is
// 1-based in the UI (Page 1, Page 2, ...) but skip is 0-based
// when sent to the BE.
const PAGE_SIZE = 24;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<JobOut[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState<number>(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return p >= 1 ? p : 1;
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>(() => {
    const s = searchParams.get('sort') as SortBy | null;
    return s && SORT_OPTIONS.some((o) => o.value === s) ? s : 'newest';
  });
  // Phase 10D: bulk match summaries (one fetch for the whole grid)
  const [matchSummaries, setMatchSummaries] = useState<JobMatchSummary[]>([]);
  // Drawer state — which job's full match is open
  const [drawerJobId, setDrawerJobId] = useState<string | null>(null);
  // Phase 10D: profile preferences for supporting tags
  const [profilePreferences, setProfilePreferences] = useState<{
    remote_only?: boolean | null;
    expected_salary_min?: number | null;
    expected_salary_max?: number | null;
    expected_salary_currency?: string | null;
    work_authorization?: string | null;
  } | null>(null);

  // Sync sort + page → URL. We don't sync jobs data itself —
  // the URL just remembers the user's chosen sort and page so they
  // can come back to the same view.
  useEffect(() => {
    const next = new URLSearchParams();
    if (sortBy !== 'newest') next.set('sort', sortBy);
    if (page !== 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [sortBy, page, setSearchParams]);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Phase 10E: paginated fetch. skip = (page-1) * PAGE_SIZE.
      const data = await jobsApi.list((page - 1) * PAGE_SIZE, PAGE_SIZE);
      setJobs(data.items);
      setTotal(data.total);
      setHasMore(data.has_more);
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
  }, [page]);

  // Initial load + whenever page changes
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Poll if any job is still analyzing.
  // Pattern: clear + only re-arm when transitioning into "has pending".
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

  const fetchMatchSummaries = useCallback(async () => {
    try {
      const data = await matchesApi.listSummaries();
      setMatchSummaries(data);
    } catch {
      // non-fatal — cards render without scores
      setMatchSummaries([]);
    }
  }, []);

  // Phase 10D: fetch profile preferences for supporting tags
  const fetchProfilePreferences = useCallback(async () => {
    try {
      const profile = await profileApi.getProfile<{
        base_profile_json?: Record<string, unknown>;
        remote_only?: boolean | null;
        expected_salary_min?: number | null;
        expected_salary_max?: number | null;
        expected_salary_currency?: string | null;
        work_authorization?: string | null;
      }>();
      const bpj = profile?.base_profile_json ?? {};
      const remoteOnly =
        (profile?.remote_only as boolean | null | undefined) ??
        (bpj?.remote_only as boolean | null | undefined) ??
        (typeof bpj?.work_mode === 'string' && /remote/i.test(bpj.work_mode as string)
          ? true
          : null);
      const expMin =
        (profile?.expected_salary_min as number | null | undefined) ??
        (bpj?.expected_salary_min as number | null | undefined) ??
        null;
      const expMax =
        (profile?.expected_salary_max as number | null | undefined) ??
        (bpj?.expected_salary_max as number | null | undefined) ??
        null;
      const expCur =
        (profile?.expected_salary_currency as string | null | undefined) ??
        (bpj?.expected_salary_currency as string | null | undefined) ??
        null;
      const workAuth =
        (profile?.work_authorization as string | null | undefined) ??
        (bpj?.work_authorization as string | null | undefined) ??
        null;
      setProfilePreferences({
        remote_only: remoteOnly ?? null,
        expected_salary_min: expMin ?? null,
        expected_salary_max: expMax ?? null,
        expected_salary_currency: expCur ?? null,
        work_authorization: workAuth ?? null,
      });
    } catch {
      setProfilePreferences(null);
    }
  }, []);

  useEffect(() => {
    fetchMatchSummaries();
    fetchProfilePreferences();
  }, [fetchMatchSummaries, fetchProfilePreferences]);

  const handleCreated = (job: JobOut) => {
    setShowAdd(false);
    toast.success('Job submitted — analyzing in background');
    setJobs((prev) => [job, ...prev]);
    setTotal((t) => t + 1);
  };

  const handleDelete = async (id: string) => {
    try {
      await jobsApi.delete(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      setTotal((t) => Math.max(0, t - 1));
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

  const handleSortChange = (newSort: SortBy) => {
    setSortBy(newSort);
    setPage(1);  // reset to first page on sort change
  };

  // Map of job_id → match summary for O(1) lookup in the grid.
  const summaryByJobId = useMemo(() => {
    const m = new Map<string, JobMatchSummary>();
    for (const s of matchSummaries) m.set(s.job_id, s);
    return m;
  }, [matchSummaries]);

  // Apply sort (in case BE doesn't honor ?sort=, we resort client-side
  // as a safety net). Pagination is BE-side via skip/limit.
  const visibleJobs = useMemo(() => {
    const sorted = [...jobs];
    const scoreOf = (id: string) => summaryByJobId.get(id)?.match_score ?? -1;
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case 'oldest':
        sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case 'title':
        sorted.sort((a, b) =>
          (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }),
        );
        break;
      case 'match_desc':
        sorted.sort((a, b) => scoreOf(b.id) - scoreOf(a.id));
        break;
      case 'match_asc':
        sorted.sort((a, b) => scoreOf(a.id) - scoreOf(b.id));
        break;
      case 'recently_analyzed':
        sorted.sort((a, b) => {
          const ma = summaryByJobId.get(a.id)?.created_at ?? '';
          const mb = summaryByJobId.get(b.id)?.created_at ?? '';
          return mb.localeCompare(ma);
        });
        break;
      case 'failed_first':
        sorted.sort((a, b) =>
          a.status === 'failed' && b.status !== 'failed' ? -1 : a.status !== 'failed' && b.status === 'failed' ? 1 : 0,
        );
        break;
      case 'lowest_experience':
        sorted.sort((a, b) => {
          const ay = (a as any).job_analysis_json?.required_experience_years;
          const by = (b as any).job_analysis_json?.required_experience_years;
          if (ay == null && by == null) return 0;
          if (ay == null) return 1;
          if (by == null) return -1;
          return ay - by;
        });
        break;
      case 'highest_salary':
        sorted.sort((a, b) => (b.salary_max ?? 0) - (a.salary_max ?? 0));
        break;
      case 'lowest_salary':
        sorted.sort((a, b) => {
          const av = a.salary_min ?? Number.POSITIVE_INFINITY;
          const bv = b.salary_min ?? Number.POSITIVE_INFINITY;
          return av - bv;
        });
        break;
      case 'cv_ready':
      case 'cover_letter_ready':
      case 'critical_gaps':
        // Stub sort modes — full impl requires tracking CV/CL drafts.
        sorted.sort((a, b) => scoreOf(b.id) - scoreOf(a.id));
        break;
    }
    return sorted;
  }, [jobs, sortBy, summaryByJobId]);

  // The job whose drawer is open. Null = closed.
  const drawerJob = useMemo(
    () => (drawerJobId ? jobs.find((j) => j.id === drawerJobId) ?? null : null),
    [drawerJobId, jobs],
  );
  const drawerSummary = drawerJobId ? summaryByJobId.get(drawerJobId) ?? null : null;

  // Pagination math
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(total, page * PAGE_SIZE);

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

      {/* Sort dropdown (always visible) + total count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-slate-600" data-testid="jobs-count">
          {total === 0 && !loading ? 'No jobs' :
           total === 0 ? '' :
           `Showing ${pageStart}–${pageEnd} of ${total} ${total === 1 ? 'job' : 'jobs'}`}
        </div>
        <label className="flex items-center gap-1.5 text-[12px] text-slate-500">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as SortBy)}
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

      {/* Loading state — skeleton cards */}
      {loading && (
        <div
          data-testid="jobs-skeleton"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-6"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <JobPostingSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state — no jobs at all */}
      {!loading && total === 0 && !error && (
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
      {!loading && total > 0 && (
        <div
          data-testid="jobs-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-6"
        >
          {visibleJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              match={summaryByJobId.get(job.id) ?? null}
              onScoreClick={(id) => setDrawerJobId(id)}
              onDelete={handleDelete}
              onRetry={handleRetry}
              profilePreferences={profilePreferences ?? undefined}
            />
          ))}
        </div>
      )}

      {/* Pagination — phase 10E */}
      {!loading && total > 0 && (
        <div
          data-testid="jobs-pagination"
          className="flex items-center justify-between gap-3 pt-2"
        >
          <div className="text-[12px] text-slate-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              data-testid="pagination-prev"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium border border-slate-200 bg-white text-slate-700 rounded hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <span
              data-testid="pagination-current"
              className="px-3 py-1.5 text-[12px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 rounded tabular-nums"
            >
              {page}
            </span>
            <span className="text-[12px] text-slate-400 tabular-nums">/ {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!hasMore}
              data-testid="pagination-next"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium border border-slate-200 bg-white text-slate-700 rounded hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Phase 10D: Match Score Detail Drawer */}
      <JobMatchScoreDrawer
        open={drawerJobId !== null}
        job={drawerJob}
        summaryScore={drawerSummary?.match_score ?? null}
        summaryRecommendation={drawerSummary?.recommendation ?? null}
        summaryConfidence={drawerSummary?.confidence_score ?? null}
        onClose={() => setDrawerJobId(null)}
        onMatchUpdated={() => {
          fetchMatchSummaries();
        }}
      />
    </div>
  );
}
