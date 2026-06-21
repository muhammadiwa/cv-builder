import { FileText } from 'lucide-react';

/**
 * Generic "coming soon" placeholder for routes that exist but have no
 * feature implementation yet. Currently unused (PromptsPage / ApplicationsPage
 * were the originals); kept around in case future routes need it.
 *
 * Uses .page-narrow shell + PageHeader-like header to match other pages.
 */
export default function PlaceholderPage() {
  return (
    <div className="page-narrow">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
          <FileText size={20} />
        </div>
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold tracking-tight">
            Coming soon
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            This page is reserved for future work.
          </p>
        </div>
      </div>
      <div className="card card-pad text-center py-16">
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          We're not there yet. Check back later or pick a feature from the
          sidebar.
        </p>
      </div>
    </div>
  );
}