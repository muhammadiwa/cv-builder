/**
 * TemplateThumbnail — schematic mini-preview of a CV template.
 *
 * Renders a tiny stylized CV "page" using pure CSS so users can see at a
 * glance what makes each template different. All visual differences from
 * `TemplateConfigJson` are reflected:
 *
 *   - page_size:      A4 (taller) vs Letter (wider) aspect ratio
 *   - font_family:    serif vs sans vs mono on header + body lines
 *   - accent_color:   applied to the name underline + section underline
 *   - density:        compact (tight) / normal / spacious (airy)
 *   - sections:       shown in the template's actual order
 *   - bullet_style:   tiny indicator glyph on one bullet
 *   - date_format:    not visualised (text-level), reflected via the bullet glyph
 *
 * The thumbnail is intentionally schematic — it shows STRUCTURE and
 * STYLING, not pixel-accurate rendering. Users can click "Preview" on the
 * card to open the actual rendered HTML iframe if they want pixel truth.
 *
 * Why CSS instead of an iframe? Each card would otherwise need its own
 * `<iframe srcDoc>` which means 3-4 separate document contexts, ~30+ KB
 * of inline HTML/CSS each, sandbox-isolated but still costly. A schematic
 * thumbnail is <1 KB and renders instantly.
 */
import type { TemplateConfigJson } from '../../lib/api';

interface TemplateThumbnailProps {
  config: TemplateConfigJson;
  /** Tailwind height class for the thumbnail wrapper. */
  className?: string;
}

const SECTION_LABELS: Record<string, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
};

const FONT_STACK: Record<string, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'Arial, Helvetica, sans-serif',
  mono: '"Courier New", Courier, monospace',
};

const BULLET_GLYPH: Record<string, string> = {
  dash: '–',
  bullet: '•',
  arrow: '›',
};

// A4 ratio = 1 : sqrt(2) ≈ 0.707 (width/height).
// Letter ratio = 8.5 : 11 ≈ 0.773 (slightly wider/shorter than A4).
// Tailwind arbitrary aspect-ratio: `aspect-[w/h]` sets aspect-ratio: w/h.
const PAGE_RATIO: Record<string, string> = {
  A4: 'aspect-[0.707]',
  Letter: 'aspect-[0.773]',
};

const DENSITY_PAD: Record<string, string> = {
  compact: 'space-y-1',
  normal: 'space-y-1.5',
  spacious: 'space-y-2',
};

const DENSITY_NAME: Record<string, string> = {
  compact: 'A',
  normal: 'B',
  spacious: 'C',
};

const DENSITY_BAR_W: Record<string, string> = {
  compact: 'w-3/4',
  normal: 'w-2/3',
  spacious: 'w-1/2',
};

export default function TemplateThumbnail({
  config,
  className = 'h-44',
}: TemplateThumbnailProps) {
  const fontFamily = FONT_STACK[config.font_family] ?? FONT_STACK.sans;
  const accentColor = config.accent_color || '#111111';
  const sections = config.sections?.length
    ? config.sections
    : ['summary', 'experience', 'education', 'skills', 'projects'];
  // Cap to 5 so the thumbnail stays readable on small cards.
  const visibleSections = sections.slice(0, 5);
  const bulletGlyph = BULLET_GLYPH[config.bullet_style] ?? BULLET_GLYPH.dash;

  return (
    <div
      className={`relative w-full ${className} ${PAGE_RATIO[config.page_size] ?? PAGE_RATIO.A4} mx-auto`}
      data-testid={`template-thumbnail-${config.id}`}
      aria-label={`Schematic preview of ${config.name}`}
    >
      {/* Paper */}
      <div
        className="absolute inset-0 rounded-[3px] shadow-sm border border-slate-200/80 overflow-hidden flex flex-col"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Header: 2 lines (name + title) with accent underline */}
        <div
          className="px-2.5 pt-2 pb-1.5"
          style={{
            borderBottom: `1px solid ${accentColor}22`,
          }}
        >
          <div
            className="h-1.5 rounded-sm"
            style={{
              backgroundColor: accentColor,
              width: '55%',
              opacity: 0.92,
            }}
          />
          <div
            className="h-1 mt-1 rounded-sm"
            style={{
              backgroundColor: accentColor,
              width: '35%',
              opacity: 0.55,
            }}
          />
          <div
            className="h-[3px] mt-1.5 rounded-sm"
            style={{ backgroundColor: accentColor, opacity: 0.3 }}
          />
        </div>

        {/* Section rows */}
        <div
          className={`flex-1 px-2.5 py-2 ${DENSITY_PAD[config.density] ?? DENSITY_PAD.normal}`}
        >
          {visibleSections.map((s, idx) => (
            <div key={`${s}-${idx}`} className="leading-none">
              <div className="flex items-baseline gap-1 mb-1">
                <span
                  className="text-[7px] font-semibold uppercase tracking-wider"
                  style={{
                    color: accentColor,
                    fontFamily,
                    opacity: 0.85,
                  }}
                >
                  {SECTION_LABELS[s] ?? s}
                </span>
                <span
                  className="flex-1 h-[1px] mt-[3px]"
                  style={{ backgroundColor: accentColor, opacity: 0.18 }}
                />
              </div>
              {/* 2-3 body lines per section (varies by density) */}
              <div className={`${DENSITY_PAD[config.density] ?? DENSITY_PAD.normal} pl-1`}>
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-baseline gap-1">
                    <span
                      className="text-[7px] flex-shrink-0"
                      style={{
                        color: accentColor,
                        fontFamily,
                        opacity: 0.7,
                      }}
                    >
                      {bulletGlyph}
                    </span>
                    <span
                      className={`h-[3px] rounded-sm ${i === 0 ? DENSITY_BAR_W[config.density] : 'w-2/5'}`}
                      style={{ backgroundColor: accentColor, opacity: 0.22 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Re-export the density helper so other components (e.g. TemplateCard)
// can show a small "A/B/C" pill next to the density name if desired.
export { DENSITY_NAME };