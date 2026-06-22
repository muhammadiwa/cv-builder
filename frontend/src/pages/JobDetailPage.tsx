/**
 * JobDetailPage — Phase 10F redesigned.
 *
 * Layout: two columns on desktop.
 *   - Left (≈72%): JobDetailHeader, JobDetailTabs, and the active tab
 *     content (Overview or Match Analysis). The Overview column shows
 *     JobOverviewCard → ProfileMatchCompactCard → JobRoleSummary →
 *     Responsibilities → Qualifications → RequiredSkills → ATSKeywords
 *     → Raw JD.
 *   - Right (≈28%): sticky AIActionCenter.
 *
 * State ownership:
 *   - Job is fetched once on mount; polling for analyzing state.
 *   - Match is fetched after analysis; the user can re-trigger via
 *     POST /api/jobs/{id}/reanalyze (already wired by the existing
 *     reanalyze endpoint, see api.reanalyzeJob).
 *   - Tab state lives in the URL (`?tab=overview|match`) so it's
 *     shareable + survives reload.
 *
 * Anti-fabrication: every claim the page makes is tied to real BE
 * data. The CV / cover letter CTAs link to the existing /cvs and
 * /cover-letters pages pre-filtered by job_id.
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
} from 'lucide-react';

import {
  jobsApi,
  matchesApi,
  cvsApi,
  profileApi,
  type JobOut,
  type JobAnalysis,
  type JobMatch,
  type CVDraft,
} from '../lib/api';
import { toast } from '../lib/toast';

import JobDetailHeader from '../components/jobs/detail/JobDetailHeader';
import JobDetailTabs, {
  type JobDetailTab,
} from '../components/jobs/detail/JobDetailTabs';
import JobOverviewCard from '../components/jobs/detail/JobOverviewCard';
import ProfileMatchCompactCard from '../components/jobs/detail/ProfileMatchCompactCard';
import JobRoleSummary from '../components/jobs/detail/JobRoleSummary';
import JobResponsibilitiesSection from '../components/jobs/detail/JobResponsibilitiesSection';
import JobQualificationsSection from '../components/jobs/detail/JobQualificationsSection';
import RequiredSkillsSection from '../components/jobs/detail/RequiredSkillsSection';
import ATSKeywordsSection from '../components/jobs/detail/ATSKeywordsSection';
import RawJobDescriptionAccordion from '../components/jobs/detail/RawJobDescriptionAccordion';
import AIActionCenter from '../components/jobs/detail/AIActionCenter';
import MatchAnalysisTab from '../components/jobs/detail/MatchAnalysisTab';

// Minimal shape we care about from /profile. We don't import a full
// Profile type because the FE side doesn't ship one — define the few
// fields we read so we don't widen the API surface for this page.
interface ProfileLite {
  confidence_score: number | null;
}

export default function JobDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [job, setJob] = useState<JobOut | null>(null);
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [cvDraft, setCvDraft] = useState<CVDraft | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  // ── Tab state (URL-driven) ──
  const tabParam = (searchParams.get('tab') || 'overview').toLowerCase();
  const activeTab: JobDetailTab =
    tabParam === 'match' ? 'match' : 'overview';

  // ── Polling timer (module-level so it's a single shared ref) ──
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const fetchJob = useCallback(
    async (silent = false) => {
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
    },
    [id],
  );

  const fetchMatch = useCallback(async () => {
    try {
      const data = await matchesApi.get(id);
      setMatch(data);
    } catch {
      setMatch(null);
    }
  }, [id]);

  const fetchCvDraft = useCallback(async () => {
    try {
      const all = await cvsApi.list();
      const found = all.find((c) => c.job_id === id) || null;
      setCvDraft(found);
    } catch {
      setCvDraft(null);
    }
  }, [id]);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await profileApi.getProfile<ProfileLite>();
      setProfile(data);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  useEffect(() => {
    fetchMatch();
    fetchCvDraft();
    fetchProfile();
  }, [fetchMatch, fetchCvDraft, fetchProfile]);

  // ── Re-fetch match when job transitions to 'parsed' ──
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (job?.status === 'parsed' && prevStatusRef.current !== 'parsed') {
      fetchMatch();
      fetchCvDraft();
    }
    prevStatusRef.current = job?.status ?? null;
  }, [job?.status, fetchMatch, fetchCvDraft]);

  // ── Polling while analyzing ──
  useEffect(() => {
    clearPollTimer();
    if (!job) return clearPollTimer;
    const isAnalyzing =
      job.status === 'scraping' ||
      job.status === 'parsing' ||
      job.status === 'pending';
    if (!isAnalyzing) return clearPollTimer;
    pollTimerRef.current = setInterval(() => fetchJob(true), 3000);
    return clearPollTimer;
  }, [job, fetchJob, clearPollTimer]);

  // ── Actions ──
  const handleReanalyze = useCallback(async () => {
    if (!job || reanalyzing) return;
    setReanalyzing(true);
    try {
      await jobsApi.reanalyze(job.id);
      toast.success('Reanalysis started — results in a few seconds.');
      // Start polling for the new match state
      await fetchJob(true);
      await fetchMatch();
      await fetchCvDraft();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Reanalysis failed';
      toast.error(msg);
    } finally {
      setReanalyzing(false);
    }
  }, [job, reanalyzing, fetchJob, fetchMatch, fetchCvDraft]);

  const handleDelete = useCallback(async () => {
    if (!job) return;
    const ok = window.confirm(
      `Delete "${job.title || 'this job'}"? This cannot be undone.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await jobsApi.delete(job.id);
      toast.success('Job deleted');
      navigate('/jobs');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to delete';
      toast.error(msg);
      setDeleting(false);
    }
  }, [job, navigate]);

  const handleBack = useCallback(() => navigate('/jobs'), [navigate]);

  // ── Computed values (must come BEFORE any conditional return so the
  //     hook order stays stable across renders). React's "rules of
  //     hooks" require this — early-returns below would otherwise
  //     change the hook count on re-renders. ──
  const matchedKeywords = useMemo(
    () =>
      ((match?.matched_skills as { matched_keyword?: string }[]) || [])
        .map((m) => m.matched_keyword || '')
        .filter(Boolean),
    [match],
  );
  const missingKeywords = useMemo(
    () =>
      ((match?.missing_skills as { required_keyword?: string }[]) || [])
        .map((m) => m.required_keyword || '')
        .filter(Boolean),
    [match],
  );
  const analysis = useMemo(
    () => (job?.job_analysis_json || {}) as JobAnalysis,
    [job],
  );
  const hasAnalysis = !!job && Object.keys(analysis).length > 0 && job.status === 'parsed';
  const qualificationsRequired = useMemo<string[]>(() => {
    if (Array.isArray((analysis as any).qualifications_required)) {
      return (analysis as any).qualifications_required;
    }
    return (analysis.required_skills || []).flatMap((c) => c.keywords || []);
  }, [analysis]);
  const qualificationsPreferred = useMemo<string[]>(() => {
    if (Array.isArray((analysis as any).qualifications_preferred)) {
      return (analysis as any).qualifications_preferred;
    }
    return (analysis.preferred_skills || []).flatMap((c) => c.keywords || []);
  }, [analysis]);

  // ── Loading / error / empty states ──
  if (loading) {
    return (
      <div
        data-testid="job-detail-loading"
        className="py-16 text-center text-slate-500"
      >
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading job…
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-[13px] text-slate-600 hover:text-slate-900"
        >
          ← Back to jobs
        </button>
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

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <JobDetailHeader
        job={job}
        hasAnalysis={hasAnalysis}
        hasTailoredCv={!!cvDraft}
        hasCoverLetter={false /* BE doesn't expose per-job CLs yet */}
        onBack={handleBack}
        onReanalyze={handleReanalyze}
        onDelete={handleDelete}
        deleting={deleting}
        reanalyzing={reanalyzing}
      />

      {/* ── Tabs ── */}
      <JobDetailTabs
        active={activeTab}
        showMatchTab={hasAnalysis || !!match}
      />

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,_28%)] xl:grid-cols-[1fr_minmax(300px,_26%)] gap-6">
        {/* LEFT: tab content */}
        <main className="min-w-0">
          {activeTab === 'overview' ? (
            <div className="space-y-6">
              <JobOverviewCard job={job} analysis={analysis} />

              <ProfileMatchCompactCard
                jobId={job.id}
                jobStatus={job.status}
                match={match}
                baseProfileConfidence={profile?.confidence_score ?? null}
              />

              <JobRoleSummary summary={analysis.summary} />

              <JobResponsibilitiesSection
                responsibilities={analysis.responsibilities}
              />

              <JobQualificationsSection
                required={qualificationsRequired}
                preferred={qualificationsPreferred}
                matchedKeywords={matchedKeywords}
                missingKeywords={missingKeywords}
              />

              <RequiredSkillsSection
                requiredSkills={analysis.required_skills}
              />

              <ATSKeywordsSection
                keywords={analysis.ats_keywords}
                matchedKeywords={matchedKeywords}
                missingKeywords={missingKeywords}
              />

              <RawJobDescriptionAccordion
                rawDescription={job.raw_description}
              />
            </div>
          ) : (
            <MatchAnalysisTab
              match={match}
              recalculating={reanalyzing}
              onRecalculate={handleReanalyze}
            />
          )}
        </main>

        {/* RIGHT: sticky AI Action Center */}
        <AIActionCenter
          jobId={job.id}
          jobStatus={job.status}
          match={match}
          cvDraft={cvDraft}
          hasBaseProfile={!!profile}
        />
      </div>
    </div>
  );
}
