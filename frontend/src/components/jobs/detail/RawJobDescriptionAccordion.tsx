/**
 * RawJobDescriptionAccordion — Phase 10F.
 *
 * Collapsible raw JD block. Closed by default — opened only when the
 * user wants to read the exact wording. Helps the AI summary feel
 * like a faithful digest rather than a replacement.
 */
import { useState } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';

export interface RawJobDescriptionAccordionProps {
  rawDescription: string | null | undefined;
  /** Default open (rare — only for debugging). */
  defaultOpen?: boolean;
}

export default function RawJobDescriptionAccordion({
  rawDescription,
  defaultOpen = false,
}: RawJobDescriptionAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  if (!rawDescription || rawDescription.trim().length === 0) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawDescription);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <section
      data-testid="raw-jd-accordion"
      className="card card-pad"
      aria-label="Raw job description"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="raw-jd-toggle"
        aria-expanded={open}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-[14px] font-semibold text-slate-900">
          Raw job description
        </span>
        <span className="text-[11px] text-slate-500 inline-flex items-center gap-1.5">
          {open ? 'click to collapse' : 'click to expand'}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="mt-3 relative">
          <button
            type="button"
            onClick={handleCopy}
            data-testid="raw-jd-copy"
            className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-white text-slate-600 hover:text-slate-900 border border-slate-200 rounded shadow-sm"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre
            data-testid="raw-jd-body"
            className="text-[12px] text-slate-700 font-mono leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-200 max-h-[500px] overflow-auto"
          >
            {rawDescription}
          </pre>
        </div>
      )}
    </section>
  );
}
