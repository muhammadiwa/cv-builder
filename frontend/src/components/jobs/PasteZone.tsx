import { useState } from 'react';
import { Link2, FileText, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { jobsApi, type JobOut, type JobSourceType } from '../../lib/api';

interface PasteZoneProps {
  onCreated: (job: JobOut) => void;
  onError: (msg: string) => void;
}

type Tab = 'url' | 'manual';

export default function PasteZone({ onCreated, onError }: PasteZoneProps) {
  const [tab, setTab] = useState<Tab>('manual');
  const [url, setUrl] = useState('');
  const [rawDescription, setRawDescription] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setUrl('');
    setRawDescription('');
    setTitle('');
    setCompany('');
  };

  const isValid =
    (tab === 'url' && url.trim().length > 0) ||
    (tab === 'manual' && rawDescription.trim().length > 20);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    onError('');

    try {
      const payload =
        tab === 'url'
          ? {
              source_type: 'url' as JobSourceType,
              source_url: url.trim(),
            }
          : {
              source_type: 'manual' as JobSourceType,
              raw_description: rawDescription.trim(),
              title: title.trim() || undefined,
              company: company.trim() || undefined,
            };

      const job = await jobsApi.create(payload);
      onCreated(job);
      reset();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        (err as { message?: string })?.message ||
        'Failed to submit job';
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card card-pad">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg mb-4 w-fit">
        <button
          type="button"
          onClick={() => setTab('manual')}
          data-testid="tab-manual"
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors',
            tab === 'manual'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          Manual paste
        </button>
        <button
          type="button"
          onClick={() => setTab('url')}
          data-testid="tab-url"
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors',
            tab === 'url'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Link2 className="w-3.5 h-3.5" />
          From URL
        </button>
      </div>

      {tab === 'url' ? (
        <div>
          <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
            Job posting URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://linkedin.com/jobs/... or https://boards.greenhouse.io/..."
            data-testid="paste-url-input"
            className="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            disabled={submitting}
          />
          <p className="mt-1.5 text-[12px] text-slate-500">
            We'll fetch + extract the job description, then analyze with AI.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                Job title <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Backend Engineer"
                data-testid="paste-title-input"
                className="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                Company <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
                data-testid="paste-company-input"
                className="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
              Job description
            </label>
            <textarea
              value={rawDescription}
              onChange={(e) => setRawDescription(e.target.value)}
              placeholder="Paste the full job description here — responsibilities, requirements, qualifications, nice-to-haves..."
              rows={8}
              data-testid="paste-jd-input"
              className="w-full px-3 py-2 text-[14px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-mono leading-relaxed resize-y"
              disabled={submitting}
            />
            <div className="mt-1 flex items-center justify-between">
              <p className="text-[12px] text-slate-500">
                Min. 20 characters. The more detail, the better the AI analysis.
              </p>
              <p className="text-[12px] text-slate-400">
                {rawDescription.length} chars
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={reset}
          disabled={submitting}
          className="btn-ghost text-[13px]"
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Clear
        </button>
        <button
          type="submit"
          disabled={!isValid || submitting}
          data-testid="paste-submit-btn"
          className="btn-primary text-[13px]"
        >
          {submitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Submitting…
            </>
          ) : tab === 'url' ? (
            'Scrape & analyze'
          ) : (
            'Analyze job'
          )}
        </button>
      </div>
    </form>
  );
}