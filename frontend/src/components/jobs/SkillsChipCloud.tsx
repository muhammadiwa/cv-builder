/**
 * SkillsChipCloud — extracted from the old JobDetailPage (Phase 10F).
 *
 * Renders a list of skill categories as styled chips. "brand" tone
 * for required, "pink" tone for preferred/nice-to-have.
 */
import clsx from 'clsx';

export interface SkillsChipCloudProps {
  categories: { name: string; keywords: string[] }[];
  tone?: 'brand' | 'pink';
}

export default function SkillsChipCloud({
  categories,
  tone = 'brand',
}: SkillsChipCloudProps) {
  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat.name}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
            {cat.name} · {cat.keywords?.length ?? 0}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(cat.keywords || []).map((kw) => (
              <span
                key={kw}
                className={clsx(
                  'px-2 py-1 text-[12px] font-medium border rounded',
                  tone === 'pink'
                    ? 'bg-pink-50 text-pink-800 border-pink-200'
                    : 'bg-brand-50 text-brand-800 border-brand-200',
                )}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
