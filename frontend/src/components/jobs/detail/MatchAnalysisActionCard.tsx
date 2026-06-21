/**
 * MatchAnalysisActionCard — third action. Opens the Match Analysis tab.
 *
 * Shows the latest score as a compact pill so the user sees the
 * verdict at a glance without scrolling.
 */
import { Link } from 'react-router-dom';
import { BarChart3, ArrowRight, Loader2 } from 'lucide-react';

export interface MatchAnalysisActionCardProps {
  jobId: string;
  matchScore: number | null;
  hasMatch: boolean;
}

export default function MatchAnalysisActionCard({
  jobId,
  hasMatch,
}: MatchAnalysisActionCardProps) {
  if (!hasMatch) {
    return (
      <div data-testid="match-analysis-action" className="card card-pad">
        <div className="flex items-start gap-2.5">
          <BarChart3 className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-slate-900">
              Analyze how well you fit
            </h3>
            <p className="text-[12px] text-slate-600 mt-0.5">
              Strengths, missing requirements, and how to position your experience.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-amber-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Match score will appear after analysis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // (label + pct removed — see comment in JSX: the compact Profile
  //  Match card on the left is the single source of truth.)

  return (
    <div data-testid="match-analysis-action" className="card card-pad">
      <div className="flex items-start gap-2.5">
        <BarChart3 className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Analyze how well you fit
          </h3>
          <p className="text-[12px] text-slate-600 mt-0.5">
            Strengths, missing requirements, and how to position your experience.
          </p>
          {/* Phase 10G: score removed here — the compact Profile Match
              card on the left is the single source of truth. This
              action card is just a "View full analysis" shortcut. */}
          <Link
            to={`/jobs/${jobId}?tab=match`}
            data-testid="view-match-analysis-action"
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 hover:text-slate-900"
          >
            View full analysis <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
