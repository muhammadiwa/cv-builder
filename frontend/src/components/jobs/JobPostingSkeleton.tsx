/**
 * JobPostingSkeleton — placeholder for a job card while data is loading.
 *
 * Phase 10D: shows 6 skeleton cards in the same grid layout the real
 * cards use. Skeleton mirrors the real card's structure (title block
 * + score panel + footer) so the layout doesn't shift when data
 * arrives — important for perceived performance.
 */
export default function JobPostingSkeleton() {
  return (
    <div
      data-testid="job-card-skeleton"
      className="card card-pad animate-pulse"
    >
      {/* Header row: title + score panel */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Title */}
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
          <div className="h-3 bg-slate-200 rounded w-2/3" />
          {/* Insight row */}
          <div className="h-3 bg-slate-100 rounded w-1/2 mt-1" />
        </div>
        {/* Score panel */}
        <div className="shrink-0 w-[88px] h-[88px] bg-slate-900/90 rounded-lg" />
      </div>
      {/* Footer row */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="h-3 bg-slate-100 rounded w-1/3" />
        <div className="h-3 bg-slate-100 rounded w-1/6" />
      </div>
    </div>
  );
}
