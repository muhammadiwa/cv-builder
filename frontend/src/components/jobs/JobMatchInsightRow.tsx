/**
 * JobMatchInsightRow — one-line insight at the bottom of a job card.
 *
 * Phase 10D: per spec O, max 2 insights per card, kept short and
 * evidence-based. We never claim "guaranteed interview" or "perfect
 * match" — only factual signals drawn from the actual match data.
 *
 * Spec coverage:
 *   - G.3: one short insight at the bottom of the card
 *   - O: insight rules (8/10 critical skills matched, Strong backend
 *        experience, 1 key skill gap: Kubernetes, Tailored CV ready,
 *        CV Fit: 86%, etc.)
 *   - S: empty / pending / failed states get their own message
 */
import clsx from 'clsx';
import {
  Award,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertCircle,
  Hourglass,
  User,
  FileText,
} from 'lucide-react';
import type { JobMatchSummary, JobStatus } from '../../lib/api';

interface JobMatchInsightRowProps {
  jobStatus: JobStatus;
  match: JobMatchSummary | null;
  /** Optional count of matched skills (for "X/10 critical matched" insight). */
  matchedSkillsCount?: number;
  /** Optional count of total required skills. */
  totalRequiredSkills?: number;
  /** True if a tailored CV exists for this job. */
  hasTailoredCv?: boolean;
  /** Tailored CV fit score (0-1). Only shown when hasTailoredCv=true. */
  cvFitScore?: number | null;
}

type InsightKind = 'positive' | 'warning' | 'negative' | 'neutral' | 'info';

interface Insight {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  kind: InsightKind;
}

function pickInsight(props: JobMatchInsightRowProps): Insight | null {
  const {
    jobStatus,
    match,
    matchedSkillsCount,
    totalRequiredSkills,
    hasTailoredCv,
    cvFitScore,
  } = props;

  // Priority 1: tailored CV ready (specific, actionable)
  if (hasTailoredCv) {
    const fitText =
      cvFitScore != null ? ` (CV Fit: ${Math.round(cvFitScore * 100)}%)` : '';
    return {
      icon: FileText,
      text: `Tailored CV ready${fitText}`,
      kind: 'positive',
    };
  }

  // Analyzed + score → strength / gap insight
  if (jobStatus === 'parsed' && match != null) {
    const score = match.match_score;
    if (score >= 0.8) {
      if (
        matchedSkillsCount != null &&
        totalRequiredSkills != null &&
        totalRequiredSkills > 0
      ) {
        return {
          icon: CheckCircle2,
          text: `${matchedSkillsCount}/${totalRequiredSkills} key requirements matched`,
          kind: 'positive',
        };
      }
      return {
        icon: Award,
        text: 'Strong match for your background',
        kind: 'positive',
      };
    }
    if (score >= 0.6) {
      return {
        icon: Sparkles,
        text: 'Partial match — tailor CV to highlight strengths',
        kind: 'info',
      };
    }
    if (score > 0) {
      return {
        icon: AlertCircle,
        text: 'Significant gaps — review before applying',
        kind: 'negative',
      };
    }
    // 0% score
    return {
      icon: XCircle,
      text: 'No clear overlap with your profile',
      kind: 'negative',
    };
  }

  // Pending states
  if (jobStatus === 'scraping' || jobStatus === 'parsing') {
    return {
      icon: Hourglass,
      text: 'Match pending — analysis in progress',
      kind: 'neutral',
    };
  }
  if (jobStatus === 'pending') {
    return {
      icon: Hourglass,
      text: 'Not analyzed yet',
      kind: 'neutral',
    };
  }
  if (jobStatus === 'failed') {
    return {
      icon: AlertCircle,
      text: 'Score unavailable — analysis failed',
      kind: 'negative',
    };
  }
  if (jobStatus === 'parsed' && match == null) {
    // Analyzed but no match = profile missing
    return {
      icon: User,
      text: 'Complete profile to calculate match',
      kind: 'info',
    };
  }
  return null;
}

export default function JobMatchInsightRow(props: JobMatchInsightRowProps) {
  const insight = pickInsight(props);
  if (!insight) return null;
  const Icon = insight.icon;

  const colorCls = clsx(
    insight.kind === 'positive' && 'text-emerald-600',
    insight.kind === 'warning' && 'text-amber-600',
    insight.kind === 'negative' && 'text-red-600',
    insight.kind === 'neutral' && 'text-slate-500',
    insight.kind === 'info' && 'text-brand-600',
  );

  return (
    <div
      data-testid="match-insight-row"
      data-kind={insight.kind}
      className="flex items-center gap-1.5 text-[11px] mt-1.5 leading-tight"
    >
      <Icon className={clsx('w-3 h-3 shrink-0', colorCls)} />
      <span className="text-slate-600 truncate">{insight.text}</span>
    </div>
  );
}
