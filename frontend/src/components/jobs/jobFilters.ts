/**
 * Job filter definitions + matching logic.
 *
 * Phase 10D: per the PRD spec section C, the Job Postings page
 * gains a compact filter bar with 12 filter categories. Each
 * category has a list of options; a job matches the filter if at
 * least one of its option values is selected (OR within category).
 * Between categories the logic is AND.
 *
 * "Unknown" options are first-class: a job with a missing
 * `seniority` matches the "Unknown" seniority option. Default
 * behavior is to INCLUDE unknown — we never silently drop a job
 * just because the JD didn't say. This matches spec D.8.
 *
 * "Multi-select": within a category multiple options are OR'd.
 * e.g. selecting Remote + Hybrid means "remote OR hybrid jobs".
 */
import type { JobOut } from '../../lib/api';

export type FilterValue = string;

export interface FilterOption {
  value: FilterValue;
  label: string;
}

export interface FilterCategory {
  /** Stable id used in URL params. */
  id: string;
  /** Display label (e.g. "Work Mode"). */
  label: string;
  /** Quick icon hint — lucide icon name. */
  icon?: string;
  /** Options shown in the popover. */
  options: FilterOption[];
  /**
   * Get the values from a job that this category cares about.
   * Returns string[] because a job might match multiple values
   * (e.g. employment_type = "full-time" AND work_mode = "remote").
   * Always include the literal "Unknown" string if the data is
   * missing — the "Unknown" option in `options` will match.
   */
  getJobValues: (job: JobOut) => string[];
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Normalize a string for comparison (lowercase, trim). */
function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

// ── Categories ───────────────────────────────────────────────────────

/** 1. Work Mode — Remote / Hybrid / On-site / Remote Anywhere / Unknown */
const workMode: FilterCategory = {
  id: 'workMode',
  label: 'Work Mode',
  icon: 'globe',
  options: [
    { value: 'remote',         label: 'Remote' },
    { value: 'remote-anywhere',label: 'Remote Anywhere' },
    { value: 'hybrid',         label: 'Hybrid' },
    { value: 'onsite',         label: 'On-site' },
    { value: 'unknown',        label: 'Unknown' },
  ],
  getJobValues: (job) => {
    const remoteFlag = job.remote === true;
    const loc = norm(job.location);
    if (remoteFlag) return ['remote', 'remote-anywhere'];
    if (loc.includes('remote anywhere') || loc.includes('anywhere')) return ['remote-anywhere'];
    if (loc.includes('remote')) return ['remote'];
    if (loc.includes('hybrid')) return ['hybrid'];
    if (loc === '') return ['unknown'];
    // Has a location but no remote/hybrid marker → assume onsite
    return ['onsite'];
  },
};

/** 2. Employment Type */
const employmentType: FilterCategory = {
  id: 'employmentType',
  label: 'Employment',
  icon: 'briefcase',
  options: [
    { value: 'full-time',  label: 'Full-time' },
    { value: 'contract',   label: 'Contract' },
    { value: 'freelance',  label: 'Freelance' },
    { value: 'part-time',  label: 'Part-time' },
    { value: 'internship', label: 'Internship' },
    { value: 'temporary',  label: 'Temporary' },
    { value: 'unknown',    label: 'Unknown' },
  ],
  getJobValues: (job) => {
    const et = norm(job.employment_type).replace(/[_\s]/g, '-');
    if (!et) return ['unknown'];
    // Normalize: "fulltime" → "full-time", etc.
    const norm2 = et.replace(/(?<=-)time$/, '-time').replace(/^part-?time$/, 'part-time');
    return [norm2];
  },
};

/** 3. Seniority Level */
const seniority: FilterCategory = {
  id: 'seniority',
  label: 'Seniority',
  icon: 'trending-up',
  options: [
    { value: 'internship', label: 'Internship' },
    { value: 'entry',      label: 'Entry Level' },
    { value: 'junior',     label: 'Junior' },
    { value: 'mid',        label: 'Mid Level' },
    { value: 'senior',     label: 'Senior' },
    { value: 'lead',       label: 'Lead' },
    { value: 'manager',    label: 'Manager' },
    { value: 'director',   label: 'Director' },
    { value: 'unknown',    label: 'Unknown' },
  ],
  getJobValues: (job) => {
    const s = norm(job.seniority).replace(/[_\s-]/g, '');
    if (!s) return ['unknown'];
    // Common aliases
    if (s.includes('entry')) return ['entry'];
    if (s.includes('mid')) return ['mid'];
    if (s.includes('senior')) return ['senior'];
    if (s.includes('lead') || s.includes('staff') || s.includes('principal')) return ['lead'];
    if (s.includes('manager')) return ['manager'];
    if (s.includes('director') || s.includes('vp') || s.includes('head')) return ['director'];
    if (s.includes('junior') || s.includes('jr')) return ['junior'];
    if (s.includes('intern')) return ['internship'];
    return ['unknown'];
  },
};

/** 4. Years of Experience Required */
const experience: FilterCategory = {
  id: 'experience',
  label: 'Experience',
  icon: 'clock',
  options: [
    { value: 'no-exp',    label: 'No experience' },
    { value: '0-1',       label: '0–1 years' },
    { value: '1-3',       label: '1–3 years' },
    { value: '3-5',       label: '3–5 years' },
    { value: '5+',        label: '5+ years' },
    { value: 'unknown',   label: 'Unknown' },
  ],
  // Years-experience filter reads from the job_analysis_json which is
  // already on the JobOut (analysis.required_experience_years). We
  // best-effort by string-matching the title if it's missing.
  getJobValues: (job) => {
    const analysis = (job as any).job_analysis_json;
    const yrs =
      typeof analysis?.required_experience_years === 'number'
        ? analysis.required_experience_years
        : null;
    if (yrs == null) {
      // Try inferring from title (e.g. "Senior" → 5+, "Junior" → 0-1)
      const t = norm(job.title);
      if (t.includes('senior') || t.includes('lead') || t.includes('principal')) return ['5+'];
      if (t.includes('junior') || t.includes('entry') || t.includes('intern')) return ['0-1'];
      return ['unknown'];
    }
    if (yrs === 0) return ['no-exp', '0-1'];
    if (yrs <= 1) return ['0-1'];
    if (yrs <= 3) return ['1-3'];
    if (yrs <= 5) return ['3-5'];
    return ['5+'];
  },
};

/** 5. Date Posted / Added */
const datePosted: FilterCategory = {
  id: 'datePosted',
  label: 'Date Posted',
  icon: 'calendar',
  options: [
    { value: '24h',    label: 'Last 24 hours' },
    { value: '3d',     label: 'Last 3 days' },
    { value: '7d',     label: 'Last 7 days' },
    { value: '30d',    label: 'Last 30 days' },
    { value: 'all',    label: 'All time' },
  ],
  getJobValues: (job) => {
    // The bucket the job falls into based on its created_at.
    const days = (Date.now() - new Date(job.created_at).getTime()) / 86_400_000;
    const buckets: string[] = [];
    if (days <= 1) buckets.push('24h');
    if (days <= 3) buckets.push('3d');
    if (days <= 7) buckets.push('7d');
    if (days <= 30) buckets.push('30d');
    buckets.push('all');
    return buckets;
  },
};

/** 6. Source Type */
const sourceType: FilterCategory = {
  id: 'sourceType',
  label: 'Source',
  icon: 'link',
  options: [
    { value: 'url',    label: 'From URL' },
    { value: 'paste',  label: 'Manual Paste' },
    { value: 'unknown',label: 'Unknown' },
  ],
  getJobValues: (job) => {
    if (job.source_type === 'url') return ['url'];
    if (job.source_type === 'manual') return ['paste'];
    return ['unknown'];
  },
};

// ── Master list (all categories, in spec order) ────────────────────

/** Categories exposed in the compact filter bar (Phase 10D scope). */
export const QUICK_FILTER_CATEGORIES: FilterCategory[] = [
  workMode,
  employmentType,
  seniority,
  experience,
  datePosted,
  sourceType,
];

/** Categories behind the "All Filters" advanced drawer (stub for now). */
export const ADVANCED_FILTER_CATEGORIES: FilterCategory[] = [
  // 7. Industry — needs job_analysis_json.industry. Out of scope until
  //    the matcher exposes it. Stub category for now.
  {
    id: 'industry',
    label: 'Industry',
    icon: 'building',
    options: [
      { value: 'saas',          label: 'SaaS' },
      { value: 'ai',            label: 'AI' },
      { value: 'fintech',        label: 'Fintech' },
      { value: 'ecommerce',     label: 'E-commerce' },
      { value: 'healthcare',     label: 'Healthcare' },
      { value: 'cybersecurity',  label: 'Cybersecurity' },
      { value: 'enterprise',     label: 'Enterprise' },
      { value: 'unknown',        label: 'Unknown' },
    ],
    getJobValues: () => ['unknown'],  // stub until matcher exposes it
  },
  // 8. Salary — needs user.expected_salary for "within range". The
  //    JobOut has salary_min/salary_max. Filter is "Salary disclosed"
  //    vs "Not disclosed" for now.
  {
    id: 'salary',
    label: 'Salary',
    icon: 'dollar-sign',
    options: [
      { value: 'disclosed', label: 'Salary disclosed' },
      { value: 'undisclosed', label: 'Not disclosed' },
    ],
    getJobValues: (job) => {
      if (job.salary_min != null || job.salary_max != null) return ['disclosed'];
      return ['undisclosed'];
    },
  },
];

export const ALL_FILTER_CATEGORIES: FilterCategory[] = [
  ...QUICK_FILTER_CATEGORIES,
  ...ADVANCED_FILTER_CATEGORIES,
];

// ── Filter state + matching ────────────────────────────────────────

export type FilterState = Record<string, FilterValue[]>;

/** True if job matches all active filters. OR within category, AND between. */
export function matchesAllFilters(
  job: JobOut,
  filterState: FilterState,
  categories: FilterCategory[] = ALL_FILTER_CATEGORIES,
): boolean {
  for (const cat of categories) {
    const selected = filterState[cat.id];
    if (!selected || selected.length === 0) continue;  // no filter set
    const jobValues = cat.getJobValues(job);
    // OR within category: at least one selected value must match.
    if (!selected.some((v) => jobValues.includes(v))) return false;
  }
  return true;
}

/** Build the FilterState from a URLSearchParams object. */
export function filterStateFromSearchParams(
  params: URLSearchParams,
  categories: FilterCategory[] = ALL_FILTER_CATEGORIES,
): FilterState {
  const out: FilterState = {};
  for (const cat of categories) {
    const raw = params.get(cat.id);
    if (!raw) continue;
    // Comma-separated values
    out[cat.id] = raw.split(',').filter(Boolean);
  }
  return out;
}

/** Serialize FilterState back to URLSearchParams. */
export function searchParamsFromFilterState(
  state: FilterState,
  params: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  for (const [k, vs] of Object.entries(state)) {
    if (vs.length === 0) {
      params.delete(k);
    } else {
      params.set(k, vs.join(','));
    }
  }
  return params;
}

/** Total active filter count (for badges). */
export function totalActiveFilters(state: FilterState): number {
  return Object.values(state).reduce((sum, vs) => sum + vs.length, 0);
}

/** Count jobs per option in a category — used for chip badges. */
export function countByOption(
  jobs: JobOut[],
  cat: FilterCategory,
): Record<FilterValue, number> {
  const counts: Record<string, number> = {};
  for (const job of jobs) {
    for (const v of cat.getJobValues(job)) {
      counts[v] = (counts[v] ?? 0) + 1;
    }
  }
  return counts;
}
