/**
 * ProfileImprovementActionCard — fourth action. Surfaces only when
 * the match score is below 0.75 AND there are missing skills. Shows
 * the count of gaps and a quick link to the Profile editor with the
 * `focus=evidence` query param so the FE can highlight the relevant
 * fields.
 */
import { Link } from 'react-router-dom';
import { UserCog, ArrowRight } from 'lucide-react';
import type { JobMatch } from '../../../lib/api';

export interface ProfileImprovementActionCardProps {
  jobId: string;
  match: JobMatch;
}

export default function ProfileImprovementActionCard({
  jobId,
  match,
}: ProfileImprovementActionCardProps) {
  const missing = (match.missing_skills as { required_keyword?: string }[]) || [];
  const count = missing.length;
  if (count === 0) return null;

  return (
    <div data-testid="profile-improvement-action" className="card card-pad">
      <div className="flex items-start gap-2.5">
        <UserCog className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Strengthen your profile
          </h3>
          <p className="text-[12px] text-slate-600 mt-0.5">
            {count} {count === 1 ? 'requirement is' : 'requirements are'} missing evidence.
            Add projects, achievements, or keywords to improve your match.
          </p>
          <Link
            to={`/profile?focus=evidence&job_id=${jobId}`}
            data-testid="improve-profile-action"
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 hover:text-slate-900"
          >
            Review missing evidence <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
