/**
 * AIActionCenter — right-column sticky workspace (Phase 10F).
 *
 * Contains:
 *   - Tailored CV action card (primary)
 *   - Cover Letter action card
 *   - Match Analysis action card
 *   - Profile Improvement action card
 *   - Application Package Status card
 *
 * Layout: single-column, compact cards with a clear hierarchy. The
 * first card has a prominent CTA (Build Tailored CV). Subsequent cards
 * are progressively quieter.
 *
 * State rules: each card reflects the real BE state (CV draft exists,
 * cover letter exists, base profile present, etc.). No fake "ready"
 * states.
 */
import type { JobMatch, CVDraft, JobStatus } from '../../../lib/api';
import TailoredCVActionCard from './TailoredCVActionCard';
import CoverLetterActionCard from './CoverLetterActionCard';
import MatchAnalysisActionCard from './MatchAnalysisActionCard';
import ProfileImprovementActionCard from './ProfileImprovementActionCard';
import ApplicationPackageStatusCard from './ApplicationPackageStatusCard';

export interface AIActionCenterProps {
  jobId: string;
  jobStatus: JobStatus;
  /** Existing match (or null if not analyzed yet). */
  match: JobMatch | null;
  /** Existing CV draft tied to this job, if any. */
  cvDraft?: CVDraft | null;
  /** True when the user has at least one Base Profile on file. */
  hasBaseProfile: boolean;
}

export default function AIActionCenter({
  jobId,
  jobStatus,
  match,
  cvDraft,
  hasBaseProfile,
}: AIActionCenterProps) {
  // Safe-cast: the caller (JobDetailPage) passes the parsed status
  // string from JobOut, which is typed JobStatus. We re-cast here so
  // that callers passing loosely-typed `string` from query params
  // don't break the children.
  const safeStatus = jobStatus as JobStatus;
  const safeCvDraft = cvDraft ?? null;

  return (
    <aside
      data-testid="ai-action-center"
      aria-label="AI action center"
      className="space-y-4 lg:sticky lg:top-4"
    >
      <header className="flex items-center gap-2 pb-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">
          AI Tools
        </h2>
        <span className="text-[11px] text-slate-400">· Your workspace</span>
      </header>

      {/* 1. Primary CTA — Tailored CV */}
      <TailoredCVActionCard
        jobId={jobId}
        jobStatus={safeStatus}
        cvDraft={safeCvDraft}
        hasBaseProfile={hasBaseProfile}
      />

      {/* 2. Cover Letter */}
      <CoverLetterActionCard jobId={jobId} cvDraft={safeCvDraft} />

      {/* 3. Match Analysis */}
      <MatchAnalysisActionCard
        jobId={jobId}
        matchScore={match?.match_score ?? null}
        hasMatch={!!match}
      />

      {/* 4. Improve Profile — only show if there's a meaningful gap */}
      {match &&
        (match.match_score ?? 0) < 0.75 &&
        ((match.missing_skills as unknown[]) || []).length > 0 && (
          <ProfileImprovementActionCard jobId={jobId} match={match} />
        )}

      {/* 5. Application Package Status — progress tracker */}
      <ApplicationPackageStatusCard
        jobId={jobId}
        cvDraft={safeCvDraft}
        hasBaseProfile={hasBaseProfile}
      />
    </aside>
  );
}
