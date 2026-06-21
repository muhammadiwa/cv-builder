/**
 * RequiredSkillsSection — Phase 10F.
 *
 * Reuses the existing SkillsChipCloud for the visual style (chips
 * grouped by category) so the page keeps a consistent vocabulary.
 */
import SkillsChipCloud from '../SkillsChipCloud';

export interface RequiredSkillsSectionProps {
  /** Same shape as the existing JobSkillCategory[] used by SkillsChipCloud. */
  requiredSkills: { name: string; keywords: string[] }[] | null | undefined;
  /** "brand" or "pink" — defaults to brand. */
  tone?: 'brand' | 'pink';
  /** Heading label override. */
  title?: string;
}

export default function RequiredSkillsSection({
  requiredSkills,
  tone = 'brand',
  title = 'Required skills',
}: RequiredSkillsSectionProps) {
  const categories = requiredSkills || [];
  if (categories.length === 0) return null;
  const kwCount = categories.reduce((n, c) => n + (c.keywords?.length ?? 0), 0);
  return (
    <section
      data-testid="required-skills-section"
      className="card card-pad"
      aria-label="Required skills"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title mb-0">{title}</h2>
        <span className="text-[11px] text-slate-500">
          {categories.length} {categories.length === 1 ? 'category' : 'categories'} · {kwCount} keywords
        </span>
      </div>
      <SkillsChipCloud categories={categories} tone={tone} />
    </section>
  );
}
