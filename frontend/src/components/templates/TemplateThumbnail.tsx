/**
 * TemplateThumbnail — schematic mini-preview of a CV template.
 *
 * Renders a tiny stylized CV "page" using pure CSS so users can see at a
 * glance what makes each template different. All visual differences from
 * `TemplateConfigJson` are reflected:
 *
 *   - page_size:           A4 (taller) vs Letter (wider) aspect ratio
 *   - font_family:         serif vs sans vs mono on header + body lines
 *   - accent_color:        applied to the name underline + section underline
 *   - density:             compact (tight) / normal / spacious (airy)
 *   - sections:            shown in the template's actual order
 *   - bullet_style:        tiny indicator glyph on one bullet
 *
 * Phase 10B: also reflects the four structural axes so the visual
 *   difference between "ATS Classic" and "ATS Minimal" is obvious:
 *   - header_style:        stacked vs inline vs banner
 *   - section_heading_style: bar / underline / plain / numbered
 *   - experience_layout:   standard / dates_right / inline_dates / compact
 *   - skills_layout:       comma / pipe / categorized / pills
 *
 * Why CSS instead of an iframe? Each card would otherwise need its own
 * `<iframe srcDoc>` which means 10 separate document contexts, ~30+ KB
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
  const headerStyle = config.header_style ?? 'stacked';
  const sectionHeadingStyle = config.section_heading_style ?? 'bar';
  const experienceLayout = config.experience_layout ?? 'standard';
  const skillsLayout = config.skills_layout ?? 'comma';
  // Phase 10C decoration axes — read with safe defaults so legacy
  // configs (predating these keys) still render correctly.
  const headingRule = config.heading_rule ?? 'bar';
  const nameTypography = config.name_typography ?? 'regular';
  const sidebarLayout = config.sidebar_layout ?? false;

  // The skills row visualises skills_layout (pipe | pills | categorized |
  // comma fallback). Renders below the section list as a single row of
  // bars with separators OR bordered pills — the most visible cue that
  // distinguishes, e.g., ATS Minimal from ATS Classic.
  const skillsIdx = sections.indexOf('skills');
  const visibleSkillsIdx = skillsIdx >= 0 && skillsIdx < 5 ? skillsIdx : -1;
  const skillNames = ['Python', 'Go', 'Rust'];

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
        {/* ── Header ─────────────────────────────────────────────── */}
        {headerStyle === 'inline' ? (
          // Inline: name on left, title on right (flex row)
          <div
            className="flex items-baseline justify-between px-2.5 pt-2 pb-1.5"
            style={{ borderBottom: `1px solid ${accentColor}22` }}
          >
            <div
              className="rounded-sm"
              style={{
                backgroundColor: accentColor,
                width: nameTypography === 'display' ? '55%' : nameTypography === 'letter_spaced' ? '60%' : '50%',
                height: nameTypography === 'display' ? '7px' : nameTypography === 'letter_spaced' ? '4px' : '6px',
                opacity: 0.92,
              }}
            />
            <div
              className="h-1 rounded-sm"
              style={{ backgroundColor: accentColor, width: '25%', opacity: 0.55 }}
            />
          </div>
        ) : headerStyle === 'banner' ? (
          // Banner: large name fills width, contact line below
          <div
            className="px-2.5 pt-2 pb-1.5"
            style={{ borderBottom: `1px solid ${accentColor}22` }}
          >
            <div
              className="rounded-sm"
              style={{
                backgroundColor: accentColor,
                width: nameTypography === 'display' ? '80%' : nameTypography === 'letter_spaced' ? '90%' : '70%',
                height: nameTypography === 'display' ? '11px' : nameTypography === 'letter_spaced' ? '5px' : '10px',
                opacity: 0.95,
              }}
            />
            <div
              className="h-1 mt-1 rounded-sm ml-auto"
              style={{ backgroundColor: accentColor, width: '60%', opacity: 0.45 }}
            />
            <div
              className="h-[3px] mt-1.5 rounded-sm"
              style={{ backgroundColor: accentColor, opacity: 0.3, width: '90%' }}
            />
          </div>
        ) : (
          // Stacked (default): name + title + contact
          <div
            className="px-2.5 pt-2 pb-1.5"
            style={{ borderBottom: `1px solid ${accentColor}22` }}
          >
            <div
              className="rounded-sm"
              style={{
                backgroundColor: accentColor,
                width: nameTypography === 'display' ? '65%' : nameTypography === 'letter_spaced' ? '70%' : '55%',
                height: nameTypography === 'display' ? '8px' : nameTypography === 'letter_spaced' ? '5px' : '6px',
                opacity: 0.92,
              }}
            />
            <div
              className="h-1 mt-1 rounded-sm"
              style={{ backgroundColor: accentColor, width: '35%', opacity: 0.55 }}
            />
            <div
              className="h-[3px] mt-1.5 rounded-sm"
              style={{ backgroundColor: accentColor, opacity: 0.3 }}
            />
          </div>
        )}

        {/* ── Section rows ────────────────────────────────────────── */}
        {/* Phase 10C: sidebar layout splits body into 2 columns. Skills/
            Education/Projects go to the left, Summary/Experience to the
            right. Header stays full-width above. */}
        <div
          className={
            sidebarLayout
              ? `flex-1 px-2 py-2 grid grid-cols-[38%_1fr] gap-x-1.5 ${DENSITY_PAD[config.density] ?? DENSITY_PAD.normal}`
              : `flex-1 px-2.5 py-2 ${DENSITY_PAD[config.density] ?? DENSITY_PAD.normal}`
          }
        >
          {visibleSections.map((s, idx) => {
            const isSkills = idx === visibleSkillsIdx;
            // Section heading style — visible difference:
            // - "bar": uppercase + bottom border (default)
            // - "underline": title-case + thicker bottom border
            // - "plain": title-case, no border, bold
            // - "numbered": "01 · Title" with numeric prefix
            // Phase 10C: heading_rule overrides the underline/bar decoration with
            // thicker bar (3px solid) or double-line rule or no rule (plain).
                        const headingBase =
                          'text-[7px] font-semibold uppercase tracking-wider';
                        const headingStyle: React.CSSProperties = {
                          color: accentColor,
                          fontFamily,
                        };
                        let headingEl: React.ReactNode;
                        // heading_rule decoration (Phase 10C) wins when set non-default.
                        if (headingRule === 'thick') {
                          // Heavy solid bar — same as 'bar' but 3px instead of 1px.
                          headingEl = (
                            <span className="flex items-baseline gap-1 mb-1">
                              <span className={`${headingBase}`} style={headingStyle}>
                                {SECTION_LABELS[s] ?? s}
                              </span>
                              <span
                                className="flex-1 h-[3px] mt-[2px]"
                                style={{ backgroundColor: accentColor, opacity: 0.65 }}
                              />
                            </span>
                          );
                        } else if (headingRule === 'double') {
                          // Two parallel lines — typical editorial / magazine style.
                          headingEl = (
                            <span className="flex flex-col gap-[1px] mb-1">
                              <span className={`${headingBase}`} style={headingStyle}>
                                {SECTION_LABELS[s] ?? s}
                              </span>
                              <span
                                className="h-[1px]"
                                style={{ backgroundColor: accentColor, opacity: 0.55 }}
                              />
                              <span
                                className="h-[1px]"
                                style={{ backgroundColor: accentColor, opacity: 0.25 }}
                              />
                            </span>
                          );
                        } else if (headingRule === 'plain') {
                          // No rule at all — just bold uppercase text.
                          headingEl = (
                            <span className="mb-1 block">
                              <span className={`${headingBase}`} style={headingStyle}>
                                {SECTION_LABELS[s] ?? s}
                              </span>
                            </span>
                          );
                        } else if (sectionHeadingStyle === 'numbered') {
                          headingEl = (
                            <span className="flex items-baseline gap-1 mb-1">
                              <span
                                className={`${headingBase}`}
                                style={{ ...headingStyle, opacity: 0.55 }}
                              >
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <span className={`${headingBase}`} style={headingStyle}>
                                {SECTION_LABELS[s] ?? s}
                              </span>
                              <span
                                className="flex-1 h-[1px] mt-[3px]"
                                style={{ backgroundColor: accentColor, opacity: 0.18 }}
                              />
                            </span>
                          );
                        } else if (sectionHeadingStyle === 'plain') {
                          headingEl = (
                            <span className="flex items-baseline gap-1 mb-1">
                              <span
                                className={`${headingBase}`}
                                style={{
                                  ...headingStyle,
                                  opacity: 1,
                                  textTransform: 'none',
                                  letterSpacing: 'normal',
                                  fontSize: '8px',
                                }}
                              >
                                {SECTION_LABELS[s] ?? s}
                              </span>
                            </span>
                          );
                        } else if (sectionHeadingStyle === 'underline') {
                          headingEl = (
                            <span className="mb-1 block">
                              <span
                                className={`${headingBase}`}
                                style={{
                                  ...headingStyle,
                                  textTransform: 'none',
                                  letterSpacing: 'normal',
                                  fontSize: '8px',
                                }}
                              >
                                {SECTION_LABELS[s] ?? s}
                              </span>
                              <span
                                className="block h-[2px] mt-1"
                                style={{ backgroundColor: accentColor, opacity: 0.35 }}
                              />
                            </span>
                          );
                        } else {
                          // bar (default)
                          headingEl = (
                            <span className="flex items-baseline gap-1 mb-1">
                              <span className={`${headingBase}`} style={headingStyle}>
                                {SECTION_LABELS[s] ?? s}
                              </span>
                              <span
                                className="flex-1 h-[1px] mt-[3px]"
                                style={{ backgroundColor: accentColor, opacity: 0.18 }}
                              />
                            </span>
                          );
                        }
            return (
              <div
                key={`${s}-${idx}`}
                className={
                  // Phase 10C: in sidebar layout, push skills/education/
                  // projects to col 1 and summary/experience to col 2.
                  sidebarLayout
                    ? `leading-none ${
                        s === 'skills' || s === 'education' || s === 'projects'
                          ? 'col-start-1'
                          : s === 'summary' || s === 'experience'
                          ? 'col-start-2'
                          : ''
                      }`
                    : 'leading-none'
                }
              >
                {headingEl}
                {isSkills && skillsLayout !== 'comma' ? (
                  // Skills gets its own visualisation, not body bullets
                  <SkillsRow
                    accentColor={accentColor}
                    fontFamily={fontFamily}
                    layout={skillsLayout}
                    names={skillNames}
                  />
                ) : isSkills ? (
                  // Default comma: show 2-3 thin body lines
                  <DefaultSkillsRow
                    accentColor={accentColor}
                  />
                ) : (
                  // Experience / Education / Projects: body lines per layout
                  <ExperienceBody
                    accentColor={accentColor}
                    fontFamily={fontFamily}
                    bulletGlyph={bulletGlyph}
                    density={config.density ?? 'normal'}
                    layout={experienceLayout}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Skills row variants — make skills_layout visible at a glance.
function SkillsRow({
  accentColor,
  fontFamily,
  layout,
  names,
}: {
  accentColor: string;
  fontFamily: string;
  layout: string;
  names: string[];
}) {
  if (layout === 'pills') {
    // Bordered pill per skill — clearly different from any other layout
    return (
      <div className="flex flex-wrap gap-[2px] pl-0.5">
        {names.map((n) => (
          <span
            key={n}
            className="inline-block px-1 py-[1px] rounded-sm border text-[6px]"
            style={{
              borderColor: `${accentColor}55`,
              color: accentColor,
              fontFamily,
            }}
          >
            {n}
          </span>
        ))}
      </div>
    );
  }
  if (layout === 'pipe') {
    // Pipe-separated, inline
    return (
      <div className="flex items-baseline gap-1 pl-0.5 leading-tight">
        <span
          className="text-[6px]"
          style={{ color: accentColor, fontFamily, opacity: 0.7 }}
        >
          {names.join(' | ')}
        </span>
      </div>
    );
  }
  if (layout === 'categorized') {
    // Bold category + comma list — 2 groups
    return (
      <div className="flex flex-col gap-[2px] pl-0.5 leading-tight">
        <div className="flex items-baseline gap-1">
          <span
            className="text-[6px] font-bold"
            style={{ color: accentColor, fontFamily }}
          >
            Backend:
          </span>
          <span
            className="text-[6px]"
            style={{ color: accentColor, fontFamily, opacity: 0.7 }}
          >
            Python, Go
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[6px] font-bold"
            style={{ color: accentColor, fontFamily }}
          >
            Infra:
          </span>
          <span
            className="text-[6px]"
            style={{ color: accentColor, fontFamily, opacity: 0.7 }}
          >
            K8s, AWS
          </span>
        </div>
      </div>
    );
  }
  if (layout === 'proficiency') {
    // Phase 10C: dot-bar visualization. Skill name on left, ●●●●○ on right.
    // Deterministic levels (3-5) for visual stability.
    const levels = [4, 5, 3];
    return (
      <div className="flex flex-col gap-[1px] pl-0.5 leading-tight">
        {names.map((n, i) => {
          const lvl = levels[i % levels.length];
          const filled = '●'.repeat(lvl);
          const empty = '○'.repeat(5 - lvl);
          return (
            <div key={n} className="flex items-baseline justify-between gap-1">
              <span
                className="text-[6px]"
                style={{ color: accentColor, fontFamily, opacity: 0.8 }}
              >
                {n}
              </span>
              <span
                className="text-[6px]"
                style={{
                  color: accentColor,
                  fontFamily,
                  opacity: 0.7,
                  letterSpacing: '0.5px',
                }}
              >
                {filled}
                {empty}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  if (layout === 'chips') {
    // Phase 10C: subtle background-tint pill (no border). Different
    // from 'pills' which has a 1px border — chips feels softer.
    return (
      <div className="flex flex-wrap gap-[2px] pl-0.5">
        {names.map((n) => (
          <span
            key={n}
            className="inline-block px-1 py-[1px] rounded-full text-[6px]"
            style={{
              backgroundColor: `${accentColor}1a`,
              color: accentColor,
              fontFamily,
              fontWeight: 500,
            }}
          >
            {n}
          </span>
        ))}
      </div>
    );
  }
  // comma fallback
  return <DefaultSkillsRow accentColor={accentColor} />;
}

function DefaultSkillsRow({ accentColor }: { accentColor: string }) {
  return (
    <div className="space-y-[2px] pl-1">
      <div className="flex items-baseline gap-1">
        <span
          className="text-[7px] flex-shrink-0"
          style={{ color: accentColor, opacity: 0.7 }}
        >
          •
        </span>
        <span
          className="h-[3px] rounded-sm w-3/4"
          style={{ backgroundColor: accentColor, opacity: 0.22 }}
        />
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-[7px] flex-shrink-0"
          style={{ color: accentColor, opacity: 0.7 }}
        >
          •
        </span>
        <span
          className="h-[3px] rounded-sm w-2/5"
          style={{ backgroundColor: accentColor, opacity: 0.22 }}
        />
      </div>
    </div>
  );
}

// Experience body — visualise experience_layout.
function ExperienceBody({
  accentColor,
  fontFamily,
  bulletGlyph,
  density,
  layout,
}: {
  accentColor: string;
  fontFamily: string;
  bulletGlyph: string;
  density: string;
  layout: string;
}) {
  const rowCls = DENSITY_PAD[density] ?? DENSITY_PAD.normal;

  if (layout === 'dates_right') {
    // Flex row: title on left, dates on right
    return (
      <div className={`${rowCls} pl-1`}>
        <div className="flex items-baseline justify-between gap-1">
          <span
            className="h-[3px] rounded-sm"
            style={{
              backgroundColor: accentColor,
              opacity: 0.55,
              width: '60%',
            }}
          />
          <span
            className="h-[3px] rounded-sm"
            style={{
              backgroundColor: accentColor,
              opacity: 0.35,
              width: '22%',
            }}
          />
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[7px] flex-shrink-0"
            style={{ color: accentColor, fontFamily, opacity: 0.7 }}
          >
            {bulletGlyph}
          </span>
          <span
            className="h-[3px] rounded-sm w-3/4"
            style={{ backgroundColor: accentColor, opacity: 0.22 }}
          />
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[7px] flex-shrink-0"
            style={{ color: accentColor, fontFamily, opacity: 0.7 }}
          >
            {bulletGlyph}
          </span>
          <span
            className="h-[3px] rounded-sm w-2/5"
            style={{ backgroundColor: accentColor, opacity: 0.22 }}
          />
        </div>
      </div>
    );
  }
  if (layout === 'inline_dates') {
    // Title row includes "(dates)" inline
    return (
      <div className={`${rowCls} pl-1`}>
        <div className="flex items-baseline gap-1">
          <span
            className="h-[3px] rounded-sm"
            style={{
              backgroundColor: accentColor,
              opacity: 0.55,
              width: '50%',
            }}
          />
          <span
            className="text-[6px]"
            style={{ color: accentColor, fontFamily, opacity: 0.55 }}
          >
            (2021)
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[7px] flex-shrink-0"
            style={{ color: accentColor, fontFamily, opacity: 0.7 }}
          >
            {bulletGlyph}
          </span>
          <span
            className="h-[3px] rounded-sm w-3/4"
            style={{ backgroundColor: accentColor, opacity: 0.22 }}
          />
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[7px] flex-shrink-0"
            style={{ color: accentColor, fontFamily, opacity: 0.7 }}
          >
            {bulletGlyph}
          </span>
          <span
            className="h-[3px] rounded-sm w-2/5"
            style={{ backgroundColor: accentColor, opacity: 0.22 }}
          />
        </div>
      </div>
    );
  }
  if (layout === 'compact') {
    // Tighter: smaller bars, less spacing
    return (
      <div className="space-y-[1px] pl-1">
        <span
          className="block h-[2px] rounded-sm"
          style={{
            backgroundColor: accentColor,
            opacity: 0.5,
            width: '45%',
          }}
        />
        <div className="flex items-baseline gap-1">
          <span
            className="text-[6px] flex-shrink-0"
            style={{ color: accentColor, fontFamily, opacity: 0.7 }}
          >
            {bulletGlyph}
          </span>
          <span
            className="h-[2px] rounded-sm w-3/4"
            style={{ backgroundColor: accentColor, opacity: 0.22 }}
          />
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-[6px] flex-shrink-0"
            style={{ color: accentColor, fontFamily, opacity: 0.7 }}
          >
            {bulletGlyph}
          </span>
          <span
            className="h-[2px] rounded-sm w-2/5"
            style={{ backgroundColor: accentColor, opacity: 0.22 }}
          />
        </div>
      </div>
    );
  }
  // standard (default)
  return (
    <div className={`${rowCls} pl-1`}>
      <div className="flex items-baseline gap-1">
        <span
          className="text-[7px] flex-shrink-0"
          style={{ color: accentColor, fontFamily, opacity: 0.7 }}
        >
          {bulletGlyph}
        </span>
        <span
          className="h-[3px] rounded-sm w-3/4"
          style={{ backgroundColor: accentColor, opacity: 0.22 }}
        />
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-[7px] flex-shrink-0"
          style={{ color: accentColor, fontFamily, opacity: 0.7 }}
        >
          {bulletGlyph}
        </span>
        <span
          className="h-[3px] rounded-sm w-2/5"
          style={{ backgroundColor: accentColor, opacity: 0.22 }}
        />
      </div>
    </div>
  );
}

// ── Section heading style labels (used by form dropdowns) ──────────
export const SECTION_HEADING_LABELS: Record<string, string> = {
  bar: 'Bar',
  underline: 'Underline',
  plain: 'Plain',
  numbered: 'Numbered',
};

export const HEADER_STYLE_LABELS: Record<string, string> = {
  stacked: 'Stacked',
  inline: 'Inline',
  banner: 'Banner',
};

export const EXPERIENCE_LAYOUT_LABELS: Record<string, string> = {
  standard: 'Standard',
  dates_right: 'Dates right',
  inline_dates: 'Inline dates',
  compact: 'Compact',
};

export const SKILLS_LAYOUT_LABELS: Record<string, string> = {
  comma: 'Comma list',
  pipe: 'Pipe list',
  categorized: 'Categorized',
  pills: 'Pills',
  proficiency: 'Proficiency dots',
  chips: 'Chips',
};

// Phase 10C decoration axis labels (used by form dropdowns).
export const HEADING_RULE_LABELS: Record<string, string> = {
  bar: 'Bar',
  underline: 'Underline',
  double: 'Double rule',
  thick: 'Thick bar',
  plain: 'Plain',
};
export const NAME_TYPOGRAPHY_LABELS: Record<string, string> = {
  regular: 'Regular',
  display: 'Display',
  letter_spaced: 'Letter-spaced',
};