/**
 * SkillsAndRequirementsSection — Phase 10G.
 *
 * Replaces the old pair of separate sections:
 *   - RequiredSkillsSection (chip cloud of required keywords)
 *   - JobQualificationsSection (Required/Preferred checklist with
 *     Matched/Missing/Partial status)
 *
 * Why merge: they render the same underlying data
 * (``analysis.required_skills`` + ``analysis.preferred_skills``).
 * Showing it twice — once as chips, once as a checklist — was pure
 * duplication and a real eye-strain in the world-class brief.
 *
 * This single section renders the keywords in three compact
 * "tracks" (Required / Preferred / Nice-to-have) with one
 * Matched/Missing/Partial status badge per keyword, grouped by
 * category. Single source of truth, single place to read.
 */
import { useState, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Search } from 'lucide-react';
import clsx from 'clsx';

type Status = 'matched' | 'partial' | 'missing' | 'unknown';

const STATUS_ICON: Record<Status, typeof CheckCircle2> = {
  matched: CheckCircle2,
  partial: AlertTriangle,
  missing: XCircle,
  unknown: HelpCircle,
};

const STATUS_CLS: Record<Status, string> = {
  matched: 'text-emerald-600',
  partial: 'text-amber-600',
  missing: 'text-red-600',
  unknown: 'text-slate-400',
};

const STATUS_LABEL: Record<Status, string> = {
  matched: 'Matched',
  partial: 'Partial',
  missing: 'Missing',
  unknown: 'Unknown',
};

export interface SkillsAndRequirementsSectionProps {
  /**
   * Same shape as the analyzer output: list of categories with
   * keywords. ``kind`` picks which track the keyword goes into.
   * If ``kind`` is missing, defaults to "required".
   */
  requiredSkills?: { name: string; keywords: string[]; kind?: string }[];
  preferredSkills?: { name: string; keywords: string[]; kind?: string }[];

  /** For status inference — same shape used everywhere. */
  matchedKeywords?: string[];
  /** For status inference — items not found in the profile. */
  missingKeywords?: string[];
}

interface GroupedKw {
  category: string;
  keyword: string;
  track: 'Required' | 'Preferred' | 'Nice-to-have';
}

function statusFor(
  item: string,
  matched: Set<string>,
  missing: Set<string>,
): Status {
  const lc = item.toLowerCase();
  for (const m of matched) {
    if (lc.includes(m.toLowerCase()) || m.toLowerCase().includes(lc)) {
      return 'matched';
    }
  }
  for (const m of missing) {
    if (lc.includes(m.toLowerCase()) || m.toLowerCase().includes(lc)) {
      return 'missing';
    }
  }
  return 'unknown';
}

export default function SkillsAndRequirementsSection({
  requiredSkills = [],
  preferredSkills = [],
  matchedKeywords = [],
  missingKeywords = [],
}: SkillsAndRequirementsSectionProps) {
  const [filter, setFilter] = useState('');

  // Flatten the analyzer output into a single (track → category → kws)
  // shape. We infer "Nice-to-have" from ``kind`` if the analyzer
  // already supports it; otherwise everything in preferredSkills is
  // grouped as "Preferred".
  const allItems = useMemo<GroupedKw[]>(() => {
    const items: GroupedKw[] = [];
    for (const cat of requiredSkills) {
      for (const kw of cat.keywords || []) {
        const kind = (cat as { kind?: string }).kind?.toLowerCase();
        const track: GroupedKw['track'] =
          kind === 'nice' || kind === 'nice-to-have'
            ? 'Nice-to-have'
            : 'Required';
        items.push({ category: cat.name, keyword: kw, track });
      }
    }
    for (const cat of preferredSkills) {
      for (const kw of cat.keywords || []) {
        items.push({
          category: cat.name,
          keyword: kw,
          track: 'Preferred',
        });
      }
    }
    return items;
  }, [requiredSkills, preferredSkills]);

  // Apply search filter (case-insensitive).
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (it) =>
        it.keyword.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q),
    );
  }, [allItems, filter]);

  // Group by track for the heading hierarchy.
  const byTrack = useMemo(() => {
    const out: Record<GroupedKw['track'], GroupedKw[]> = {
      Required: [],
      Preferred: [],
      'Nice-to-have': [],
    };
    for (const it of filtered) out[it.track].push(it);
    return out;
  }, [filtered]);

  const matched = new Set(matchedKeywords);
  const missing = new Set(missingKeywords);

  const totalKw = allItems.length;
  const matchedCount = allItems.filter(
    (it) => statusFor(it.keyword, matched, missing) === 'matched',
  ).length;

  if (totalKw === 0) {
    return null;
  }

  return (
    <section
      data-testid="skills-requirements-section"
      className="card card-pad"
      aria-label="Skills and requirements"
    >
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>
          <h2 className="section-title mb-0">Skills &amp; Requirements</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {matchedCount} of {totalKw} keywords matched your Base Profile
          </p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter skills…"
            data-testid="skills-filter"
            className="pl-7 pr-2 py-1 text-[12px] border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 w-44"
          />
        </div>
      </div>

      <div className="space-y-4">
        {(Object.keys(byTrack) as GroupedKw['track'][]).map((track) => {
          const items = byTrack[track];
          if (items.length === 0) return null;
          return (
            <div key={track} data-testid={`skills-track-${track}`}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {track} · {items.length}
              </h3>
              <ul className="space-y-1">
                {items.map((it, i) => {
                  const status = statusFor(it.keyword, matched, missing);
                  const Icon = STATUS_ICON[status];
                  return (
                    <li
                      key={`${track}-${i}-${it.keyword}`}
                      className="flex items-start gap-2 text-[12.5px] text-slate-700"
                    >
                      <Icon
                        className={clsx(
                          'w-3.5 h-3.5 mt-0.5 shrink-0',
                          STATUS_CLS[status],
                        )}
                      />
                      <span className="flex-1">
                        <span>{it.keyword}</span>
                        {it.category && (
                          <span className="ml-1.5 text-[10px] text-slate-400">
                            {it.category}
                          </span>
                        )}
                        <span
                          className={clsx(
                            'ml-1.5 text-[10px] font-semibold uppercase tracking-wider',
                            STATUS_CLS[status],
                          )}
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500 italic pt-3 mt-3 border-t border-slate-100">
        Status reflects Base Profile evidence — not a guarantee of fit.
      </p>
    </section>
  );
}
