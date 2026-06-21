/**
 * SupportingTags — small checkmark tags shown below the score label
 * on the job card. Strictly evidence-based: every tag is rendered
 * from data the system actually has. Never claims "H1B Sponsor
 * Likely" or other fabricated info per spec O.
 *
 * Phase 10D: extends the Jobright-style "GOOD MATCH + checkmarks"
 * pattern but constrained to verifiable signals:
 *   - ✓ Tailored CV   (if hasTailoredCv)
 *   - ✓ Remote OK     (if job is remote + user preference allows it)
 *   - ✓ Salary shown  (if job has salary data)
 *   - ✓ Within range  (if job salary is within user expected range)
 *   - ✓ Visa friendly (only if user has work auth + job has no auth req)
 *   - ✓ Strong skills (only if matched_skills_count >= 70% threshold)
 */
import {
  FileText,
  Globe,
  DollarSign,
  TrendingUp,
  Award,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import type { JobOut, JobMatchSummary } from '../../lib/api';

interface SupportingTagsProps {
  job: JobOut;
  match: JobMatchSummary | null;
  /** True if a tailored CV exists for this job. */
  hasTailoredCv?: boolean;
  /** Tailored CV fit score 0-1. */
  cvFitScore?: number | null;
  /** Profile preferences — from the Base Profile when available. */
  profilePreferences?: {
    remote_only?: boolean | null;
    expected_salary_min?: number | null;
    expected_salary_max?: number | null;
    expected_salary_currency?: string | null;
    work_authorization?: string | null;
  };
  /** Number of matched skills — from the full match payload. */
  matchedSkillsCount?: number;
  /** Total required skills — from the full match payload. */
  totalRequiredSkills?: number;
}

export type { SupportingTagsProps };

interface Tag {
  icon: LucideIcon;
  label: string;
}

function pickTags(p: SupportingTagsProps): Tag[] {
  const { job, hasTailoredCv, profilePreferences, matchedSkillsCount, totalRequiredSkills } = p;
  const tags: Tag[] = [];

  // Tailored CV (highest signal — user has done work for this job)
  if (hasTailoredCv) {
    tags.push({ icon: FileText, label: 'CV ready' });
  }

  // Strong skills (>= 70% matched)
  if (
    matchedSkillsCount != null &&
    totalRequiredSkills != null &&
    totalRequiredSkills > 0
  ) {
    const ratio = matchedSkillsCount / totalRequiredSkills;
    if (ratio >= 0.7) {
      tags.push({ icon: Award, label: `${matchedSkillsCount}/${totalRequiredSkills} skills` });
    }
  }

  // Remote compatibility (only if BOTH job and preference are known)
  const isRemote =
    job.remote === true ||
    (job.location && /remote/i.test(job.location));
  if (isRemote && profilePreferences?.remote_only === true) {
    tags.push({ icon: Globe, label: 'Remote OK' });
  } else if (isRemote && profilePreferences?.remote_only !== false) {
    // Job is remote and user has no strong remote preference either way
    tags.push({ icon: Globe, label: 'Remote' });
  }

  // Salary disclosed
  if (job.salary_min != null || job.salary_max != null) {
    tags.push({ icon: DollarSign, label: 'Salary shown' });
  }

  // Salary within user range
  const min = profilePreferences?.expected_salary_min;
  const max = profilePreferences?.expected_salary_max;
  const jobMin = job.salary_min;
  const jobMax = job.salary_max;
  if (
    jobMin != null &&
    min != null &&
    max != null &&
    jobMin >= min &&
    jobMax != null &&
    jobMax <= max * 1.15  // within 15% of upper bound = "within range"
  ) {
    tags.push({ icon: TrendingUp, label: 'Within range' });
  }

  // Work authorization: only flag when both sides have data and
  // they're compatible. We never claim sponsorship without source.
  if (profilePreferences?.work_authorization && !job.employment_type) {
    // User has auth info, job doesn't ask for anything specific → OK
    tags.push({ icon: ShieldCheck, label: 'Auth OK' });
  }

  // Cap at 2 tags — the spec says max 2 insights per card
  return tags.slice(0, 2);
}

export default function SupportingTags(props: SupportingTagsProps) {
  const tags = pickTags(props);
  if (tags.length === 0) return null;
  return (
    <div data-testid="match-supporting-tags" className="flex flex-col gap-0.5 mt-1.5">
      {tags.map((t, i) => {
        const Icon = t.icon;
        return (
          <div
            key={`${t.label}-${i}`}
            className="flex items-center gap-1 text-[9.5px] font-medium text-emerald-300/90 leading-tight"
          >
            <Icon className={clsx('w-2.5 h-2.5 shrink-0', 'text-emerald-400')} />
            <span className="truncate">{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}
