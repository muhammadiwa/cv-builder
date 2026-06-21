/**
 * <PageHeader /> — unified page-level header.
 *
 * Standardizes the (icon + title + subtitle) ↔ (actions) row that
 * every page needs. Two slots:
 *
 *   - left (default): icon + title + subtitle
 *   - actions:        buttons / links aligned to the right
 *
 * Behavior:
 *   - Stacks vertically on mobile (actions below title), horizontal on sm+
 *   - Title scales text-xl → lg:text-2xl for better hierarchy at desktop
 *   - All slots min-w-0 to allow text truncation instead of overflow
 *
 * Usage:
 *   <PageHeader
 *     icon={Briefcase}
 *     title="Job Postings"
 *     subtitle="Paste a job URL or description…"
 *     actions={<><RefreshBtn/><AddBtn/></>}
 *   />
 */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Tighten top padding when used below the sidebar (default true). */
  withTopPadding?: boolean;
  className?: string;
}

export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  withTopPadding = true,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={clsx(
        'flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row',
        withTopPadding && 'pt-1 lg:pt-2',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <Icon size={18} className="lg:w-5 lg:h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] lg:text-sm text-slate-500 mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
}