/**
 * JobDetailSkeleton — placeholder for the Job Detail page while data loads.
 *
 * Mirrors the two-column layout (left overview + right AI Action Center)
 * so the layout doesn't shift when real data arrives. Uses animate-pulse
 * with bg-slate-200 bars, same pattern as JobPostingSkeleton.
 */
export default function JobDetailSkeleton() {
  return (
    <div data-testid="job-detail-skeleton" className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-20 bg-slate-200 rounded" />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-7 bg-slate-200 rounded w-1/2" />
            <div className="h-4 bg-slate-100 rounded w-1/3" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 bg-slate-200 rounded-lg" />
            <div className="h-8 w-24 bg-slate-200 rounded-lg" />
            <div className="h-8 w-24 bg-slate-200 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,_28%)] xl:grid-cols-[1fr_minmax(300px,_26%)] gap-6">
        {/* LEFT: Overview skeleton */}
        <div className="space-y-4">
          {/* JobOverviewCard */}
          <div className="card card-pad space-y-3">
            <div className="h-5 bg-slate-200 rounded w-32" />
            <div className="space-y-2">
              <div className="h-4 bg-slate-100 rounded w-2/3" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-4 bg-slate-100 rounded w-1/2" />
            </div>
          </div>

          {/* ProfileMatchCompactCard */}
          <div className="card card-pad space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="h-5 bg-slate-200 rounded w-32" />
              <div className="h-14 w-20 bg-slate-200 rounded-md" />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-3 bg-slate-100 rounded w-28" />
                <div className="flex-1 h-2 bg-slate-100 rounded" />
                <div className="h-3 bg-slate-100 rounded w-8" />
              </div>
            ))}
          </div>

          {/* Role summary */}
          <div className="card card-pad space-y-2">
            <div className="h-5 bg-slate-200 rounded w-32" />
            <div className="h-4 bg-slate-100 rounded w-full" />
            <div className="h-4 bg-slate-100 rounded w-5/6" />
            <div className="h-4 bg-slate-100 rounded w-3/4" />
          </div>

          {/* Responsibilities */}
          <div className="card card-pad space-y-2">
            <div className="h-5 bg-slate-200 rounded w-40" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 bg-slate-100 rounded w-4/5" />
            ))}
          </div>

          {/* Qualifications */}
          <div className="card card-pad space-y-2">
            <div className="h-5 bg-slate-200 rounded w-32" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 bg-slate-100 rounded w-2/3" />
            ))}
          </div>

          {/* Required skills */}
          <div className="card card-pad space-y-3">
            <div className="h-5 bg-slate-200 rounded w-40" />
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-6 w-20 bg-slate-100 rounded" />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: AIActionCenter skeleton */}
        <aside className="space-y-4">
          <div className="flex items-center gap-2 pb-1">
            <div className="h-4 bg-slate-200 rounded w-16" />
            <div className="h-3 bg-slate-100 rounded w-28" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card card-pad space-y-2">
              <div className="h-4 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-full" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
