import type { LucideIcon } from 'lucide-react';

export default function PlaceholderPage({
  title,
  description,
  icon: Icon,
  phase,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  phase: string;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
          <Icon size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>

      <div className="card card-pad text-center py-16">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
          <Icon size={24} />
        </div>
        <div className="font-semibold text-slate-900">Coming soon</div>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          {phase}. Will be built and tested phase-by-phase. The current page is a
          placeholder so the navigation works.
        </p>
      </div>
    </div>
  );
}
