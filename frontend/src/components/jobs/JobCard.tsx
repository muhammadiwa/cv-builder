import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Building2, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import type { JobOut, JobStatus } from '../../lib/api';

interface JobCardProps {
  job: JobOut;
  onDelete?: (id: string) => void;
}

const statusStyles: Record<JobStatus, { label: string; cls: string }> = {
  pending:    { label: 'Pending',    cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  scraping:   { label: 'Scraping…',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  parsing:    { label: 'Analyzing…', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  parsed:     { label: 'Analyzed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:     { label: 'Failed',     cls: 'bg-red-50 text-red-700 border-red-200' },
};

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

export default function JobCard({ job, onDelete }: JobCardProps) {
  const isLoading = job.status === 'scraping' || job.status === 'parsing' || job.status === 'pending';
  const st = statusStyles[job.status] || statusStyles.pending;

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Delete this job posting? "${job.title || 'Untitled'}"`)) {
      onDelete?.(job.id);
    }
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
            {!isLoading && <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />}
            <h3 className="text-[15px] font-semibold text-slate-900 truncate">
              {job.title || 'Untitled role'}
            </h3>
          </div>

          {job.company && (
            <div className="flex items-center gap-1.5 text-[13px] text-slate-600 mb-1">
              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{job.company}</span>
            </div>
          )}

          {job.location && (
            <div className="flex items-center gap-1.5 text-[13px] text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{job.location}</span>
            </div>
          )}
        </div>

        <span
          data-testid="job-status-badge"
          className={clsx(
            'px-2 py-0.5 text-[11px] font-medium rounded-full border shrink-0',
            st.cls
          )}
        >
          {st.label}
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <span>{job.source_type === 'url' ? 'From URL' : 'Manual paste'}</span>
          <span>·</span>
          <span>{formatRelative(job.created_at)}</span>
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