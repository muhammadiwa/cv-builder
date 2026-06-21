/**
 * ATSKeywordsSection — Phase 10F.
 *
 * ATS keywords extracted from the job description. Grouped by readiness
 * (Ready to use / Needs evidence / Missing) so the user knows which
 * ones to highlight and which to leave alone.
 *
 * Anti-fabrication: only marks "Ready to use" when the keyword has
 * real evidence in the profile. Everything else is "Needs evidence"
 * or "Missing". We never claim a keyword is safe to use unless the
 * profile supports it.
 */
import { useState } from 'react';
import { Tag, Copy, Check } from 'lucide-react';
import clsx from 'clsx';

type Readiness = 'ready' | 'needs' | 'missing';

const READINESS_LABEL: Record<Readiness, string> = {
  ready: 'Ready to use',
  needs: 'Needs evidence',
  missing: 'Missing',
};

const READINESS_CLS: Record<Readiness, string> = {
  ready: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  needs: 'bg-amber-50 border-amber-200 text-amber-700',
  missing: 'bg-slate-100 border-slate-200 text-slate-600',
};

function readinessFor(
  kw: string,
  matched: Set<string>,
  missing: Set<string>,
): Readiness {
  const lc = kw.toLowerCase();
  for (const m of matched) {
    if (lc.includes(m.toLowerCase()) || m.toLowerCase().includes(lc)) {
      return 'ready';
    }
  }
  for (const m of missing) {
    if (lc.includes(m.toLowerCase()) || m.toLowerCase().includes(lc)) {
      return 'missing';
    }
  }
  return 'needs';
}

export interface ATSKeywordsSectionProps {
  keywords: string[] | null | undefined;
  matchedKeywords?: string[];
  missingKeywords?: string[];
}

export default function ATSKeywordsSection({
  keywords,
  matchedKeywords = [],
  missingKeywords = [],
}: ATSKeywordsSectionProps) {
  const items = (keywords || []).filter((k) => typeof k === 'string' && k.trim());
  const [copied, setCopied] = useState(false);

  if (items.length === 0) return null;

  const matched = new Set(matchedKeywords);
  const missing = new Set(missingKeywords);

  const buckets: Record<Readiness, string[]> = {
    ready: [],
    needs: [],
    missing: [],
  };
  for (const kw of items) {
    buckets[readinessFor(kw, matched, missing)].push(kw);
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(items.join(', '));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API can fail in non-secure contexts; ignore silently
    }
  };

  return (
    <section
      data-testid="ats-keywords-section"
      className="card card-pad"
      aria-label="ATS keywords"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-amber-600" />
          <h2 className="section-title mb-0">ATS keywords</h2>
          <span className="text-[11px] text-slate-500">
            {items.length} extracted
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          data-testid="ats-copy"
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy all'}
        </button>
      </div>

      {/* Grouped chips by readiness */}
      <div className="space-y-3">
        {(Object.keys(buckets) as Readiness[]).map((rk) => {
          const list = buckets[rk];
          if (list.length === 0) return null;
          return (
            <div key={rk}>
              <div
                className={clsx(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border rounded mb-1.5',
                  READINESS_CLS[rk],
                )}
              >
                {READINESS_LABEL[rk]} · {list.length}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((kw) => (
                  <span
                    key={kw}
                    data-testid={`ats-chip-${rk}`}
                    className={clsx(
                      'px-2 py-1 text-[12px] font-medium border rounded',
                      READINESS_CLS[rk],
                    )}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 italic mt-3 pt-2 border-t border-slate-100">
        Only supported keywords will be added to your tailored CV. Missing
        skills remain recommendations and will never be presented as
        experience.
      </p>
    </section>
  );
}
