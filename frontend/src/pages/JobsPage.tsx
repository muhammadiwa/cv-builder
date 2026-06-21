import { useEffect, useState, useCallback, useMemo } from 'react';
import { Briefcase, RefreshCw, AlertCircle, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { jobsApi, matchesApi, profileApi, type JobOut, type JobMatchSummary } from '../lib/api';
import { toast } from '../lib/toast';
import PageHeader from '../components/PageHeader';
import PasteZone from '../components/jobs/PasteZone';
import JobCard from '../components/jobs/JobCard';
import JobMatchScoreDrawer from '../components/jobs/JobMatchScoreDrawer';
import JobPostingSkeleton from '../components/jobs/JobPostingSkeleton';
import JobFilterBar from '../components/jobs/JobFilterBar';
import AdvancedJobFiltersDrawer from '../components/jobs/AdvancedJobFiltersDrawer';
import {
  type FilterState,
  type AdvancedFilterState,
  filterStateFromSearchParams,
  advancedFromSearchParams,
  searchParamsFromFilterState,
  searchParamsFromAdvanced,
  matchesAllFilters,
  matchesAdvanced,
  ALL_FILTER_CATEGORIES,
} from '../components/jobs/jobFilters';

// Phase 10E: sort dropdown was removed per the user's request. The
// page is now: filter bar + paginated grid. Jobs appear in BE's
// natural order (newest first, by created_at DESC). No client-side
// sort override.

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
  // Phase 10F: used by the "Open existing" toast action on duplicate.
  const navigate = useNavigate();
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
  // Phase 10D (restored per user feedback): filter state + advanced
  // state + drawer open. URL-synced so the user can return to the
  // same filtered view.
  const [filterState, setFilterState] = useState<FilterState>(() =>
    filterStateFromSearchParams(searchParams),
  );
  const [advancedState, setAdvancedState] = useState<AdvancedFilterState>(() =>
    advancedFromSearchParams(searchParams),
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Sync page + filter state → URL. Single source of truth is
  // in-memory state; URL is the persistence + shareable link layer.
  // (Sort removed — jobs always render in the BE's natural order,
  // newest first by created_at DESC.)
  useEffect(() => {
    const next = searchParamsFromFilterState(filterState);
    searchParamsFromAdvanced(advancedState, next);
    if (page !== 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [filterState, advancedState]);  // eslint-disable-line react-hooks/exhaustive-deps

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
    toast.success('Job submitted — analyzing + scoring');
    setJobs((prev) => [job, ...prev]);
    setTotal((t) => t + 1);
    // Phase 10E: the BE pipeline now does scrape → analyze → score
    // in one background task. We poll /matches/summaries every 2s
    // for up to ~60s. Once the new job's match lands, fetchMatchSummaries
    // picks it up and the dark score panel renders automatically.
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      await fetchMatchSummaries();
      const hasMatch = (await matchesApi.listSummaries()).some(
        (m) => m.job_id === job.id,
      );
      if (hasMatch) return;  // done — score is visible
      if (attempts >= 30) {
        toast.info('Still scoring — refresh the page in a moment');
        return;
      }
      setTimeout(tick, 2000);
    };
    setTimeout(tick, 1500);
    // Cleanup if user navigates away mid-poll
    return () => { cancelled = true; };
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

  // Map of job_id → match summary for O(1) lookup in the grid.
  const summaryByJobId = useMemo(() => {
    const m = new Map<string, JobMatchSummary>();
    for (const s of matchSummaries) m.set(s.job_id, s);
    return m;
  }, [matchSummaries]);

  // Apply sort (in case BE doesn't honor ?sort=, we resort client-side
  // as a safety net). Pagination is BE-side via skip/limit.
  // Apply quick + advanced filters in a 2-pass over `jobs` (the
  // current page from the BE). Filter is client-side because the
  // BE doesn't yet know about our filter shape — the filter
  // categories live in the FE (jobFilters.ts).
  const filteredJobs = useMemo(() => {
    return jobs
      .filter((j) => matchesAllFilters(j, filterState, ALL_FILTER_CATEGORIES))
      .filter((j) => matchesAdvanced(j, advancedState));
  }, [jobs, filterState, advancedState]);

  // The current page is what the BE returned, and the filter
  // applies client-side. With pagination, the filter may show
  // fewer items than the page size when filters are active. The
  // pagination controls still reflect the BE's `total` + `has_more`.
  // Jobs appear in the BE's natural order (newest first by
  // created_at DESC) — no client-side sort override.
  const visibleJobs = useMemo(() => {
    return filteredJobs;
  }, [filteredJobs]);

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
            onError={(msg, ctx) => {
              // Phase 10F: when the BE rejects with 409 (duplicate),
              // show a clear error + an "Open existing" action that
              // navigates to the existing job's detail. Without this,
              // users thought the submit failed and retried, creating
              // a soft-delete + re-add loop that piled up duplicates.
              if (ctx?.kind === 'duplicate' && ctx.existingJobId) {
                toast.error(msg, {
                  ttl: 7000,
                  action: {
                    label: 'Open existing',
                    onClick: () => navigate(`/jobs/${ctx.existingJobId}`),
                  },
                });
                return;
              }
              toast.error(msg);
            }}
          />
        </div>
      )}

      {/* Count line (sort dropdown removed per user request — jobs
          always render in the BE's natural order, newest first) */}
      <div className="space-y-3">
        <div className="text-[12px] text-slate-600" data-testid="jobs-count">
          {total === 0 && !loading ? 'No jobs' :
           total === 0 ? '' :
           `Showing ${pageStart}–${pageEnd} of ${total} ${total === 1 ? 'job' : 'jobs'}`}
        </div>

        {/* Phase 10D (restored): compact filter bar + All Filters drawer */}
        <JobFilterBar
          filterState={filterState}
          jobs={jobs}
          onChange={(next) => {
            setFilterState(next);
            setPage(1);  // reset to first page on filter change
          }}
          onClearAll={() => {
            setFilterState({});
            setAdvancedState({});
            setPage(1);
          }}
          onOpenAdvanced={() => setAdvancedOpen(true)}
        />
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
      {!loading && total > 0 && visibleJobs.length > 0 && (
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

      {/* Phase 10D (restored): empty-after-filter state. Shown when
          the user has jobs but the active filter excludes all of
          them in the current page. */}
      {!loading && total > 0 && visibleJobs.length === 0 && (
        <div className="card card-pad text-center py-12" data-testid="empty-filter">
          <p className="text-[14px] text-slate-600">
            No jobs match your current filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterState({});
              setAdvancedState({});
              setPage(1);
            }}
            data-testid="empty-clear-filters"
            className="mt-3 text-[13px] text-brand-600 hover:text-brand-700 font-medium"
          >
            Clear all filters
          </button>
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

      {/* Phase 10D (restored): All Filters advanced drawer */}
      <AdvancedJobFiltersDrawer
        open={advancedOpen}
        applied={advancedState}
        quickState={filterState}
        onApply={(next) => {
          setAdvancedState(next);
          setPage(1);
        }}
        onClose={() => setAdvancedOpen(false)}
      />
    </div>
  );
}
