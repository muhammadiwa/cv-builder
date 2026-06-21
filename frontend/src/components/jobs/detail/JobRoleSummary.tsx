/**
 * JobRoleSummary — Phase 10F "About this role" section.
 *
 * Shows the LLM-generated role summary from job_analysis_json.summary
 * with a copy button. The summary is the model's distilled version
 * of the job description — anti-fabrication is enforced at the
 * analyzer level (the prompt forbids hallucinated details).
 */
import { useState } from 'react';
import { Sparkles, Copy, Check, BookOpen } from 'lucide-react';

export interface JobRoleSummaryProps {
  summary: string | null | undefined;
}

export default function JobRoleSummary({ summary }: JobRoleSummaryProps) {
  const [copied, setCopied] = useState(false);
  if (!summary || summary.trim().length === 0) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <section
      data-testid="role-summary-section"
      className="card card-pad"
      aria-label="About this role"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-brand-600" />
          About this role
        </h2>
        <button
          type="button"
          onClick={handleCopy}
          data-testid="role-summary-copy"
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-[14px] text-slate-700 leading-relaxed">
        {summary}
      </p>
      <p className="text-[11px] text-slate-500 italic mt-3 pt-2 border-t border-slate-100 inline-flex items-center gap-1">
        <Sparkles className="w-3 h-3" />
        AI-generated summary based on the job description.
      </p>
    </section>
  );
}
