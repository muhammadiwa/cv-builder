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
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
} from 'lucide-react';

import {
  jobsApi,
  matchesApi,
  cvsApi,
  profileApi,
  coverLettersApi,
  type JobOut,
  type JobAnalysis,
  type JobMatch,
  type CVDraft,
  type CoverLetterOut,
} from '../lib/api';
import { toast } from '../lib/toast';

import JobDetailHeader from '../components/jobs/detail/JobDetailHeader';
import JobDetailSkeleton from '../components/jobs/detail/JobDetailSkeleton';
import JobOverviewCard from '../components/jobs/detail/JobOverviewCard';
import TailoredCVDrawer from '../components/jobs/detail/TailoredCVDrawer';
import ProfileMatchCompactCard from '../components/jobs/detail/ProfileMatchCompactCard';
import JobRoleSummary from '../components/jobs/detail/JobRoleSummary';
import JobResponsibilitiesSection from '../components/jobs/detail/JobResponsibilitiesSection';
import RequiredSkillsSection from '../components/jobs/detail/RequiredSkillsSection';
import ATSKeywordsSection from '../components/jobs/detail/ATSKeywordsSection';
import RawJobDescriptionAccordion from '../components/jobs/detail/RawJobDescriptionAccordion';
import AIActionCenter from '../components/jobs/detail/AIActionCenter';

// We import the full ProfileData shape (the same one ProfilePage
// and ProfileEditForm use) so the TailoredCVDrawer can derive
// resume years / title / summary from real fields without stubs.
import type { ProfileData } from '../components/ProfileEditForm';

export default function JobDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<JobOut | null>(null);
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [cvDraft, setCvDraft] = useState<CVDraft | null>(null);
  const [coverLetter, setCoverLetter] = useState<CoverLetterOut | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Phase 10K: slide-out drawer for the tailored CV flow.
  const [tailoredCvOpen, setTailoredCvOpen] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [isBuildingCv, setIsBuildingCv] = useState(false);

  // Phase 10H: tab system removed — only "Overview" remains. The
  // Match Analysis content is folded in below as a single collapsible
  // section. No more ?tab= URL state.

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

  const fetchCoverLetter = useCallback(async () => {
    try {
      const data = await coverLettersApi.list({ jobId: id, limit: 1 });
      setCoverLetter(data[0] || null);
    } catch {
      setCoverLetter(null);
    }
  }, [id]);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await profileApi.getProfile<ProfileData>();
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
    fetchCoverLetter();
    fetchProfile();
  }, [fetchMatch, fetchCvDraft, fetchCoverLetter, fetchProfile]);

  // ── Re-fetch match when job transitions to 'parsed' ──
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (job?.status === 'parsed' && prevStatusRef.current !== 'parsed') {
      fetchMatch();
      fetchCvDraft();
      fetchCoverLetter();
    }
    prevStatusRef.current = job?.status ?? null;
  }, [job?.status, fetchMatch, fetchCvDraft, fetchCoverLetter]);

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
      await fetchCoverLetter();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Reanalysis failed';
      toast.error(msg);
    } finally {
      setReanalyzing(false);
    }
  }, [job, reanalyzing, fetchJob, fetchMatch, fetchCvDraft, fetchCoverLetter]);

  const handleBuildCv = useCallback(async () => {
    if (!job || !profile || isBuildingCv) return;
    setIsBuildingCv(true);
    try {
      const title = `Tailored CV for ${job.title || 'role'}${job.company ? ` at ${job.company}` : ''}`;
      const draft = await cvsApi.create({
        job_id: job.id,
        profile_id: profile.id,
        title,
      });
      toast.success('CV created! Opening your draft…');
      navigate(`/cvs/${draft.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to create CV';
      toast.error(msg);
      setIsBuildingCv(false);
    }
  }, [job, profile, isBuildingCv, navigate]);

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

  // ── Loading / error / empty states ──
  if (loading) {
    return <JobDetailSkeleton />;
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
        hasCoverLetter={!!coverLetter}
        onBack={handleBack}
        onReanalyze={handleReanalyze}
        onDelete={handleDelete}
        deleting={deleting}
        reanalyzing={reanalyzing}
      />

      {/* Phase 10H: tabs removed. Only Overview content renders.
          Detailed match analysis (skill table, gaps filter, CV
          strategy) is folded in as a collapsible section at the
          bottom — accessible without a tab switch. */}

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,_28%)] xl:grid-cols-[1fr_minmax(300px,_26%)] gap-6">
        {/* LEFT: single Overview column */}
        <main className="min-w-0 space-y-6">
          <JobOverviewCard job={job} analysis={analysis} />

          <ProfileMatchCompactCard
            jobStatus={job.status}
            match={match}
            baseProfileConfidence={profile?.confidence_score ?? null}
          />

          <JobRoleSummary summary={analysis.summary} />

          <JobResponsibilitiesSection
            responsibilities={analysis.responsibilities}
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
        </main>

        {/* RIGHT: sticky AI Action Center */}
        <AIActionCenter
          jobId={job.id}
          jobStatus={job.status}
          match={match}
          cvDraft={cvDraft}
          coverLetter={coverLetter}
          hasBaseProfile={!!profile}
          onOpenTailoredCV={() => setTailoredCvOpen(true)}
        />
      </div>

      {/* Phase 10N: drawer receives the real Base Profile. The drawer
          derives resumeYears / resumeTitle / resumeSummary from
          profile.work[] + profile.summary, with no hard-coded
          stubs. While the profile is still loading, the affected
          rows show '—' via the drawer's graceful-empty handling. */}
      {job && (
        <TailoredCVDrawer
          open={tailoredCvOpen}
          onClose={() => setTailoredCvOpen(false)}
          job={job}
          match={match}
          profile={profile}
          onBuildCv={handleBuildCv}
          isBuilding={isBuildingCv}
        />
      )}
    </div>
  );
}
