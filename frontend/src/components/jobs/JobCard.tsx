import { Link } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  Building2,
  ExternalLink,
  Trash2,
  Loader2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import type { JobOut, JobMatchSummary } from '../../lib/api';
import JobMatchScorePanel from './JobMatchScorePanel';
import JobMatchInsightRow from './JobMatchInsightRow';

interface JobCardProps {
  job: JobOut;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
  /** Match summary for the Profile Match score panel (Phase 10D). */
  match?: JobMatchSummary | null;
  /** Click on the score panel — opens the Match Score Drawer. */
  onScoreClick?: (jobId: string) => void;
  /** True if a tailored CV exists for this job. */
  hasTailoredCv?: boolean;
  /** Optional count of matched skills (for the insight row). */
  matchedSkillsCount?: number;
  /** Optional count of total required skills. */
  totalRequiredSkills?: number;
  /** Profile preferences for supporting tags (Phase 10D). */
  profilePreferences?: {
    remote_only?: boolean | null;
    expected_salary_min?: number | null;
    expected_salary_max?: number | null;
    expected_salary_currency?: string | null;
    work_authorization?: string | null;
  };
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

export default function JobCard({
  job,
  onDelete,
  onRetry,
  match = null,
  onScoreClick,
  hasTailoredCv = false,
  matchedSkillsCount,
  totalRequiredSkills,
}: JobCardProps) {
  const isLoading = job.status === 'scraping' || job.status === 'parsing' || job.status === 'pending';
  const isFailed = job.status === 'failed';
  // Phase 10D: status badge removed — the dark score panel already
  // communicates state (score ring for analyzed, NO PROFILE pill for
  // missing profile, PENDING for scraping/parsing, UNAVAILABLE for
  // failed). Two badges was redundant noise.

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete this job posting? "${job.title || 'Untitled'}"`)) {
      onDelete?.(job.id);
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRetry?.(job.id);
  };

  // Score click handler — must stopPropagation AND preventDefault so
  // the parent <Link> (which navigates to /jobs/:id) doesn't fire.
  // The badge is a <button type="button">, but the browser's default
  // <a> navigation is independent of React's event propagation, so
  // both are needed.
  const handleScoreClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    onScoreClick?.(job.id);
  };

  return (
    <Link
      to={`/jobs/${job.id}`}
      data-testid={`job-card-${job.id}`}
      className="card card-pad hover:border-brand-300 hover:shadow-md transition-all group block"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isLoading && <Loader2 className="w-4 h-4 text-brand-600 animate-spin shrink-0" />}
            {!isLoading && isFailed && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
            {!isLoading && !isFailed && <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />}
            <h3
              className="text-[15px] font-semibold text-slate-900 line-clamp-2"
              title={job.title || 'Untitled role'}
            >
              {job.title || 'Untitled role'}
            </h3>
          </div>

          {isFailed && job.error_message && (
            <p
              className="text-[11px] text-red-600 mb-1.5 line-clamp-1"
              title={job.error_message}
            >
              {job.error_message.replace(/^[a-z_]+:\s*/, '')}
            </p>
          )}

          {job.company && (
            <div className="flex items-center gap-1.5 text-[13px] text-slate-600 mb-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate" title={job.company}>{job.company}</span>
            </div>
          )}

          {job.location && (
            <div className="flex items-center gap-1.5 text-[13px] text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate" title={job.location}>{job.location}</span>
            </div>
          )}

          {/* Phase 10D: 1-line insight under card body */}
          <JobMatchInsightRow
            jobStatus={job.status}
            match={match}
            hasTailoredCv={hasTailoredCv}
            matchedSkillsCount={matchedSkillsCount}
            totalRequiredSkills={totalRequiredSkills}
          />
        </div>

        {/* Phase 10E: clean colored badge (no dark bg, no supporting
            tags) on the right of the card. Click → opens Match Score
            Drawer for the full breakdown. */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <JobMatchScorePanel
            jobStatus={job.status}
            matchScore={match?.match_score ?? null}
            confidenceScore={match?.confidence_score ?? null}
            onClick={handleScoreClick}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span>{job.source_type === 'url' ? 'From URL' : 'Manual paste'}</span>
          <span>·</span>
          {/* Phase 10E: show the SOURCE posting time when we have it
              (extracted from JSON-LD datePosted / Jobstreet listedAt
              during scrape). Falls back to "Added Xh ago" using our
              own created_at when the source didn't expose a date. The
              label changes so the user knows which clock they're
              looking at — these can differ by days. */}
          <span
            title={
              job.posted_at
                ? `Posted on source: ${new Date(job.posted_at).toLocaleString()}`
                : `Added to JobFind: ${new Date(job.created_at).toLocaleString()}`
            }
          >
            {job.posted_at
              ? `Posted ${formatRelative(job.posted_at)}`
              : `Added ${formatRelative(job.created_at)}`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {job.source_url && (
            <a
              href={job.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded transition-colors"
              title="Open source URL"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {isFailed && onRetry && (
            <button
              type="button"
              onClick={handleRetry}
              data-testid={`job-retry-${job.id}`}
              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
              title="Retry analysis"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete job"
              data-testid={`job-delete-${job.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
