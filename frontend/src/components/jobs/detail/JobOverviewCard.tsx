/**
 * JobOverviewCard — compact metadata grid (Phase 10F).
 *
 * Shows location, work mode, employment type, seniority, experience,
 * salary, posted date, source, AI confidence. Empty values are
 * gracefully rendered as "Not specified" / "Not disclosed" rather
 * than "null years" / blank rows.
 *
 * Built on top of the existing QuickFactsGrid so we don't fork the
 * icon set.
 */
import {
  MapPin,
  Wifi,
  Clock,
  GraduationCap,
  Briefcase,
  DollarSign,
  CalendarPlus,
  Link2,
  Copy,
  Gauge,
  Building2,
} from 'lucide-react';
import QuickFactsGrid, {
  type QuickFact,
} from '../QuickFactsGrid';

export interface JobOverviewCardProps {
  job: Partial<{
    title: string | null;
    company: string | null;
    location: string | null;
    remote: boolean;
    seniority: string | null;
    employment_type: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    source_type: 'url' | 'manual';
    source_url: string | null;
    created_at: string;
    posted_at: string | null;
  }>;
  /** Parsed job analysis (may be empty if status != 'parsed'). */
  analysis: Record<string, any> | null;
}

function employmentLabel(t: string | null | undefined): string | null {
  if (!t) return null;
  return t.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSalary(
  currency: string | null,
  min: number | null,
  max: number | null,
): { label: string; estimated?: boolean } | null {
  // Anti-fabrication: don't invent a currency. If we don't know the
  // currency, fall back to "Not disclosed" rather than guessing.
  if (!currency) return null;
  if (!min && !max) return null;
  const fmt = (n: number) => n.toLocaleString();
  let label: string;
  if (min && max) {
    label = `${currency} ${fmt(min)}–${fmt(max)}`;
  } else if (min) {
    label = `${currency} ${fmt(min)}+`;
  } else if (max) {
    label = `${currency} ${fmt(max)}`;
  } else {
    return null;
  }
  return { label, estimated: false };
}

export default function JobOverviewCard({ job, analysis }: JobOverviewCardProps) {
  const a: any = analysis ?? {};
  const j = job; // alias for readability
  const facts: QuickFact[] = [];

  // Location
  const locationText =
    a.location || j.location || (j.remote ? 'Remote' : null);
  if (locationText) {
    facts.push({ icon: MapPin, label: 'Location', value: locationText });
  } else {
    facts.push({ icon: MapPin, label: 'Location', value: 'Not specified' });
  }

  // Work mode — primary source is the analyzer's remote_type
  // (guaranteed "remote" | "hybrid" | "onsite" by BE validation).
  const remoteType = a.remote_type;
  if (remoteType) {
    const display =
      remoteType === 'remote' ? 'Remote' :
      remoteType === 'hybrid' ? 'Hybrid' :
      remoteType === 'onsite' ? 'On-site' :
      remoteType.charAt(0).toUpperCase() + remoteType.slice(1);
    facts.push({ icon: Wifi, label: 'Work Mode', value: display });
  } else if (j.remote) {
    facts.push({ icon: Wifi, label: 'Work Mode', value: 'Remote' });
  } else {
    facts.push({
      icon: Wifi,
      label: 'Work Mode',
      value: 'Not specified',
    });
  }

  // Employment
  const emp = employmentLabel(a.employment_type || job.employment_type);
  facts.push({
    icon: Clock,
    label: 'Employment',
    value: emp || 'Not specified',
  });

  // Seniority
  const sen = a.seniority || job.seniority;
  if (sen) {
    facts.push({
      icon: Briefcase,
      label: 'Seniority',
      value: sen.charAt(0).toUpperCase() + sen.slice(1),
    });
  } else {
    facts.push({
      icon: Briefcase,
      label: 'Seniority',
      value: 'Not specified',
    });
  }

  // Experience
  const yrs = a.required_experience_years;
  if (yrs !== undefined && yrs !== null) {
    facts.push({
      icon: Briefcase,
      label: 'Experience',
      value: `${yrs}+ years`,
    });
  } else {
    facts.push({
      icon: Briefcase,
      label: 'Experience',
      value: 'Not specified',
    });
  }

  // Salary
  const salary = formatSalary(
    a.salary?.currency || job.salary_currency,
    a.salary?.min ?? job.salary_min,
    a.salary?.max ?? job.salary_max,
  );
  if (salary) {
    facts.push({ icon: DollarSign, label: 'Compensation', value: salary.label });
  } else {
    facts.push({ icon: DollarSign, label: 'Compensation', value: 'Not disclosed' });
  }

  // Education
  if (a.required_education) {
    facts.push({
      icon: GraduationCap,
      label: 'Education',
      value: a.required_education,
    });
  }

  // Industry (if known)
  if (a.industry) {
    facts.push({ icon: Building2, label: 'Industry', value: a.industry });
  }

  // Posted date — prefer the source's posted_at, fall back to created_at
  const postedRaw = job.posted_at ?? job.created_at ?? null;
  if (postedRaw) {
    const posted = new Date(postedRaw);
    facts.push({
      icon: CalendarPlus,
      label: 'Posted',
      value: posted.toLocaleDateString(),
    });
  } else {
    facts.push({
      icon: CalendarPlus,
      label: 'Posted',
      value: 'Not available',
    });
  }

  // Source
  const isUrl = (job.source_type ?? 'manual') === 'url';
  facts.push({
    icon: isUrl ? Link2 : Copy,
    label: 'Source',
    value: isUrl ? 'From URL' : 'Manual paste',
  });

  // Confidence — only if we have an analysis
  if (a.confidence_score !== undefined && a.confidence_score !== null) {
    facts.push({
      icon: Gauge,
      label: 'AI confidence',
      value: `${Math.round(a.confidence_score * 100)}%`,
    });
  }

  return (
    <section
      data-testid="job-overview-card"
      className="card card-pad"
      aria-label="Job overview"
    >
      <h2 className="section-title mb-3">Job Overview</h2>
      <QuickFactsGrid facts={facts} />
      {job.title && (
        <p className="text-[11px] text-slate-400 italic mt-3 pt-2 border-t border-slate-100">
          Showing snapshot for "{job.title}".
        </p>
      )}
    </section>
  );
}
