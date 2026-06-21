/**
 * JobDetailTabs — Phase 10F tab system.
 *
 * Two tabs:
 *   - Overview (default): all the job content + compact match card
 *   - Match Analysis: full breakdown (skill-by-skill table, strengths,
 *     gaps, CV strategy)
 *
 * Tabs are URL-driven via `?tab=overview|match`. Refresh-safe and
 * shareable.
 */
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';

export type JobDetailTab = 'overview' | 'match';

export interface JobDetailTabsProps {
  /** Currently active tab — controlled via URL search params. */
  active: JobDetailTab;
  /** Optional: hide the Match tab when no analysis is available. */
  showMatchTab?: boolean;
}

const TAB_LABELS: Record<JobDetailTab, string> = {
  overview: 'Overview',
  match: 'Match Analysis',
};

export default function JobDetailTabs({
  active,
  showMatchTab = true,
}: JobDetailTabsProps) {
  const [, setSearchParams] = useSearchParams();

  const setTab = (tab: JobDetailTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  };

  const tabs: JobDetailTab[] = ['overview'];
  if (showMatchTab) tabs.push('match');

  return (
    <div
      role="tablist"
      aria-label="Job detail sections"
      className="flex items-center gap-1 border-b border-slate-200"
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          type="button"
          aria-selected={active === tab}
          data-testid={`tab-${tab}`}
          onClick={() => setTab(tab)}
          className={clsx(
            'px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors',
            active === tab
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-600 hover:text-slate-900',
          )}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
