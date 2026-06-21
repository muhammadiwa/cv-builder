import { useEffect, useState, useCallback, useMemo } from 'react';
import { Briefcase, RefreshCw, AlertCircle, Plus, X, ArrowUpDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { jobsApi, matchesApi, profileApi, type JobOut, type JobMatchSummary } from '../lib/api';
import { toast } from '../lib/toast';
import PageHeader from '../components/PageHeader';
import PasteZone from '../components/jobs/PasteZone';
import JobCard from '../components/jobs/JobCard';
import JobMatchScoreDrawer from '../components/jobs/JobMatchScoreDrawer';
import JobFilterBar from '../components/jobs/JobFilterBar';
import {
  type FilterState,
  filterStateFromSearchParams,
  searchParamsFromFilterState,
  matchesAllFilters,
  ALL_FILTER_CATEGORIES,
} from '../components/jobs/jobFilters';

type SortBy =
  | 'newest'
  | 'oldest'
  | 'title'
  | 'match_desc'
  | 'match_asc'
  | 'recommended'
  | 'recently_analyzed'
  | 'failed_first'
  | 'lowest_experience'
  | 'highest_salary'
  | 'lowest_salary'
  | 'cv_ready'
  | 'cover_letter_ready'
  | 'critical_gaps';

// Phase 10D: status filter tabs removed — the dark score panel on
// every card already communicates state (PENDING for scraping/parsing,
// score for analyzed, NO PROFILE for missing profile, UNAVAILABLE for
// failed). The tabs were redundant with the panel. Users who want
// to see only failed jobs can use the "Failed Analysis First" sort.

// Phase 10D: sort options per spec E. The "Recommended for You" sort
// uses match_score when present + freshness as a tiebreaker. Falls
// back to "Newest Posted" for jobs with no match yet.
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'recommended',         label: 'Recommended for You' },
  { value: 'match_desc',          label: 'Highest Match Score' },
  { value: 'match_asc',           label: 'Lowest Match Score' },
  { value: 'newest',              label: 'Newest Posted' },
  { value: 'oldest',              label: 'Oldest Posted' },
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('recommended');
  // Phase 10D: bulk match summaries (one fetch for the whole grid)
  const [matchSummaries, setMatchSummaries] = useState<JobMatchSummary[]>([]);
  // Drawer state — which job's full match is open
  const [drawerJobId, setDrawerJobId] = useState<string | null>(null);
  // Phase 10D: profile preferences for supporting tags (read from
  // base_profile_json if structured fields aren't there yet).
  const [profilePreferences, setProfilePreferences] = useState<{
    remote_only?: boolean | null;
    expected_salary_min?: number | null;
    expected_salary_max?: number | null;
    expected_salary_currency?: string | null;
    work_authorization?: string | null;
  } | null>(null);
  // Phase 10D: filter state (URL-synced). Status tabs were removed
  // because the dark score panel already shows state per-card.
  const [filterState, setFilterState] = useState<FilterState>(() =>
    filterStateFromSearchParams(searchParams),
  );

  // Sync filter state → URL whenever it changes. Single source of truth
  // is filterState; URL is the persistence + shareable link layer.
  useEffect(() => {
    const next = searchParamsFromFilterState(filterState);
    if (sortBy !== 'recommended') next.set('sort', sortBy);
    setSearchParams(next, { replace: true });
  }, [filterState]);  // eslint-disable-line react-hooks/exhaustive-deps

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

  // Phase 10D: fetch match summaries in parallel with jobs. Failure is
  // non-fatal — the grid just renders without scores. Silently swallow
  // errors so a missing /api/matches/summaries doesn't break the page.
  const fetchMatchSummaries = useCallback(async () => {
    try {
      const data = await matchesApi.listSummaries();
      setMatchSummaries(data);
    } catch {
      // non-fatal — cards render without scores
      setMatchSummaries([]);
    }
  }, []);

  // Phase 10D: fetch profile preferences (for supporting tags). The
  // profile lives in base_profile_json which is a free-form dict, so we
  // best-effort read the structured fields we care about. Missing
  // fields just mean fewer supporting tags show up — never crash.
  const fetchProfilePreferences = useCallback(async () => {
    try {
      // profileApi.getProfile<{ base_profile_json?: any; remote_only?: boolean; ... }>()
      const profile = await profileApi.getProfile<{
        base_profile_json?: Record<string, unknown>;
        remote_only?: boolean | null;
        expected_salary_min?: number | null;
        expected_salary_max?: number | null;
        expected_salary_currency?: string | null;
        work_authorization?: string | null;
      }>();
      const bpj = profile?.base_profile_json ?? {};
      // Best-effort: prefer top-level structured fields, fall back to
      // the free-form bpj (which is what the ProfileEditForm writes).
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
      // No profile yet or 404 — supporting tags will fall back to no-profile state
      setProfilePreferences(null);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchJobs();
    fetchMatchSummaries();
    fetchProfilePreferences();
  }, [fetchJobs, fetchMatchSummaries, fetchProfilePreferences]);

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

  // Apply multi-category filters + sort in one pass.
  // useMemo so it only re-runs when jobs / sortBy / filterState
  // actually change. The match summary map is also built here so the
  // sort can read match scores without a second pass.
  const summaryByJobId = useMemo(() => {
    const m = new Map<string, JobMatchSummary>();
    for (const s of matchSummaries) m.set(s.job_id, s);
    return m;
  }, [matchSummaries]);

  const visibleJobs = useMemo(() => {
    // Multi-category filters (Phase 10D) — OR within category, AND between.
    // Status filter no longer needed: the dark score panel on every
    // card already shows the state.
    const filtered = jobs.filter((j) => matchesAllFilters(j, filterState, ALL_FILTER_CATEGORIES));

    // 3. Sort
    const sorted = [...filtered];
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
      case 'recommended':
        // Score desc as primary, freshness as tiebreaker, then alpha.
        sorted.sort((a, b) => {
          const sa = scoreOf(a.id);
          const sb = scoreOf(b.id);
          if (sa !== sb) return sb - sa;
          return b.created_at.localeCompare(a.created_at);
        });
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
        // Stub sort modes — full impl requires tracking CV/CL drafts per
        // job. For now, fall back to recommended ordering.
        sorted.sort((a, b) => scoreOf(b.id) - scoreOf(a.id));
        break;
    }
    return sorted;
  }, [jobs, filterState, sortBy, summaryByJobId]);

  // The job whose drawer is open. Null = closed.
  const drawerJob = useMemo(
    () => (drawerJobId ? jobs.find((j) => j.id === drawerJobId) ?? null : null),
    [drawerJobId, jobs],
  );
  const drawerSummary = drawerJobId ? summaryByJobId.get(drawerJobId) ?? null : null;

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

      {/* Sort dropdown + filter bar (only when we have rows). The
          old status tabs (All/Analyzed/Failed/etc) are gone — the
          dark score panel on every card communicates state. */}
      {!loading && jobs.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
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

          {/* Phase 10D: compact filter bar with multi-select popovers
              + active filter chips + All Filters button + Clear All */}
          <JobFilterBar
            filterState={filterState}
            jobs={jobs}
            onChange={setFilterState}
            onClearAll={() => setFilterState({})}
            onOpenAdvanced={() => toast.info('Advanced filters coming in Phase 10E')}
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

      {/* Empty-after-filter state */}
      {!loading && jobs.length > 0 && visibleJobs.length === 0 && (
        <div className="card card-pad text-center py-12">
          <p className="text-[14px] text-slate-600">
            No jobs match your current filters.
          </p>
          <button
            type="button"
            onClick={() => setFilterState({})}
            data-testid="empty-clear-filters"
            className="mt-3 text-[13px] text-brand-600 hover:text-brand-700 font-medium"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Footer hint */}
      {!loading && jobs.length > 0 && (
        <p className="mt-6 text-center text-[12px] text-slate-500">
          {visibleJobs.length === jobs.length
            ? `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}`
            : `Showing ${visibleJobs.length} of ${jobs.length} jobs`}
        </p>
      )}

      {/* Phase 10D: Match Score Detail Drawer (right-side slide-in) */}
      <JobMatchScoreDrawer
        open={drawerJobId !== null}
        job={drawerJob}
        summaryScore={drawerSummary?.match_score ?? null}
        summaryRecommendation={drawerSummary?.recommendation ?? null}
        summaryConfidence={drawerSummary?.confidence_score ?? null}
        onClose={() => setDrawerJobId(null)}
        onMatchUpdated={() => {
          // Refresh the summary so the score reflects the new calculation
          fetchMatchSummaries();
        }}
      />
    </div>
  );
}