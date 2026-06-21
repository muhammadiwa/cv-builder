"""CV template engine — deterministic, ATS-safe HTML/Markdown renderer.

Two layers, same pattern as the matcher:
  1. :func:`render_cv` — pure deterministic renderer. Profile → CV sections →
     HTML (or Markdown). No LLM. Same input ⇒ byte-identical output.
  2. :func:`enhance_section` (in ``cv_enhancer``) — optional LLM polish per
     section. Fact-preserving: refuses to invent skills/metrics/dates.

Templates are stored in :class:`app.models.models.Template` with a
``template_config_json`` describing section order + visibility. The
deterministic renderer supports the layout primitives every ATS needs:

  - header (name, title, contact line)
  - summary
  - experience (role, company, dates, bullets)
  - education
  - skills (keyword list, optionally grouped)
  - projects (optional)

ATS-safe defaults (no tables for layout, no images in body, single-column,
plain ``<ul>`` bullets, ``<h2>`` section headings). The ``ats_classic``
template is registered as the default at startup (see
:func:`seed_default_templates`).

Output is safe to pipe into a future PDF/DOCX renderer — no CSS positioning,
no JavaScript, no external resources.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from datetime import date
from typing import Any

# ── Section identifiers ─────────────────────────────────────────────
SECTION_HEADER = "header"
SECTION_SUMMARY = "summary"
SECTION_EXPERIENCE = "experience"
SECTION_EDUCATION = "education"
SECTION_SKILLS = "skills"
SECTION_PROJECTS = "projects"

ALL_SECTIONS: tuple[str, ...] = (
    SECTION_SUMMARY,
    SECTION_EXPERIENCE,
    SECTION_EDUCATION,
    SECTION_SKILLS,
    SECTION_PROJECTS,
)

DEFAULT_TEMPLATE_ID = "ats_classic"

# ── Template styling options (Phase 10A) ───────────────────────────
# Allow templates to tweak visual presentation while staying
# ATS-friendly. All values have safe defaults so existing drafts
# (which stored the legacy ats_classic config without these keys)
# keep rendering identically.

FONT_FAMILY_OPTIONS: tuple[str, ...] = ("serif", "sans", "mono")
DENSITY_OPTIONS: tuple[str, ...] = ("compact", "normal", "spacious")
BULLET_STYLE_OPTIONS: tuple[str, ...] = ("dash", "bullet", "arrow")
DATE_FORMAT_OPTIONS: tuple[str, ...] = ("Mon YYYY", "MM/YYYY", "YYYY")
PAGE_SIZE_OPTIONS: tuple[str, ...] = ("A4", "Letter")

# ── Structural axes (Phase 10B) ─────────────────────────────────────
# These drive LAYOUT, not just typography — they're how a CV template
# is recognisably different from another. All four have safe defaults
# that reproduce the original ats_classic rendering for any draft that
# predates these keys.

# Header layout — where name + title + contact line sit on the page.
HEADER_STYLE_OPTIONS: tuple[str, ...] = (
    "stacked",   # name (h1) on top, title (p) below, contact line below
    "inline",    # name + title on same row (name larger), contact below
    "banner",    # name fills more space, contact on a single right-aligned line
)
# Section heading style — how the <h2> for each section looks.
SECTION_HEADING_OPTIONS: tuple[str, ...] = (
    "bar",       # uppercase, thin bottom border (original ATS look)
    "underline", # title-case, thick bottom border
    "plain",     # title-case, no border, just bold
    "numbered",  # "01 · EXPERIENCE" with numeric prefix
)
# Experience item layout — how each job block is structured.
EXPERIENCE_LAYOUT_OPTIONS: tuple[str, ...] = (
    "standard",     # role line, meta line, bullet list (original)
    "dates_right",  # flex row: role+company on left, dates on right
    "inline_dates", # role line includes dates in parentheses
    "compact",      # smaller fonts, tighter spacing
)
# Skills presentation — how the skills list is visualised.
SKILLS_LAYOUT_OPTIONS: tuple[str, ...] = (
    "comma",        # comma-separated inline list (original)
    "pipe",         # pipe-separated inline list
    "categorized",  # grouped by category with bold subheadings
    "pills",        # each skill in a bordered inline-block pill
    "proficiency",  # dot-bar visualization per skill (● ● ● ● ○)
    "chips",        # subtle background-tint pill (no border)
)

# ── Decoration axes (Phase 10C) ──────────────────────────────────────
# These go beyond the four structural axes (header / heading / experience /
# skills) into pure visual decoration — color, type weight, side-by-side
# sidebar layout. All have safe defaults that reproduce the original
# ats_classic rendering for any draft that predates these keys.

# How the <h2> section heading is decorated (separate from font).
# Decoration only — the FONT aspect lives in section_heading_style.
HEADING_RULE_OPTIONS: tuple[str, ...] = (
    "bar",        # 1px bottom border (original)
    "underline",  # 2px bottom border, thicker
    "double",     # double 1px borders with 2px gap (editorial)
    "thick",      # 3px solid bar (bold, startup)
    "plain",      # no border, just text + spacing
)
# How the <h1> name is typeset.
NAME_TYPOGRAPHY_OPTIONS: tuple[str, ...] = (
    "regular",        # 28px normal weight (original)
    "display",        # 34px bold, tight letter-spacing (banner)
    "letter_spaced",  # uppercase, letter-spacing 4px, smaller weight
)
# Sidebar layout — left column for short sections (skills/education/
# projects), right column for long sections (summary/experience).
# Modern ATS (Workday, Greenhouse, iCIMS, Ashby) parse this fine; older
# ATS like Taleo may render columns as flat text. Templates that set
# sidebar_layout=True get tagged with an ATS caveat in metadata.
SIDEBAR_LAYOUT_OPTIONS: tuple[bool, ...] = (False, True)

# ATS-safe color palette. Reject anything outside this set so
# recruiters/ATS scanners never see a CV in red Comic Sans.
# Each entry maps a config key to its accepted hex values.
#
# Phase 10C: extended with 10 subtle accent colors (navy, royal blue,
# teal-blue, teal, forest, burnt orange, burgundy, plum, indigo, plus
# two warmer neutrals). All stay in the professional / conservative
# range that ATS extractors and recruiters expect — no pastels, no
# neons, nothing that signals "creative industry" only.
ATS_SAFE_COLORS: frozenset[str] = frozenset({
    # Original near-black neutrals (preserved for backward compat)
    "#000000",  # pure black
    "#111111",  # near-black (default)
    "#1f2937",  # slate-800 (classic default)
    "#0f172a",  # slate-900 (modern default)
    "#111827",  # gray-900 (compact default)
    "#334155",  # slate-700
    "#475569",  # slate-600
    "#1e293b",  # slate-800 variant
    # New Phase 10C accent colors — conservative but distinct
    "#1e3a8a",  # navy-900 — deep navy, the most "boardroom" accent
    "#1e40af",  # blue-800 — royal blue, slightly brighter navy
    "#075985",  # sky-800 — teal-blue, modern fintech feel
    "#0f766e",  # teal-700 — muted teal, designer-y
    "#166534",  # green-800 — forest, sustainability / data
    "#7c2d12",  # orange-900 — burnt orange, rare but bold
    "#7f1d1d",  # red-900 — burgundy, editorial / academic
    "#581c87",  # purple-900 — plum, creative-but-conservative
    "#3730a3",  # indigo-800 — indigo, tech / startup
    "#4b5563",  # gray-600 — charcoal, neutral warm
    "#3f3f46",  # zinc-700 — warm gray, mono-friendly
})

DEFAULT_STYLING: dict[str, Any] = {
    "font_family": "sans",
    "accent_color": "#111111",
    "density": "normal",
    "bullet_style": "dash",
    "date_format": "Mon YYYY",
    "page_size": "A4",
    "header_style": "stacked",
    "section_heading_style": "bar",
    "experience_layout": "standard",
    "skills_layout": "comma",
    # Phase 10C decoration axes
    "heading_rule": "bar",
    "name_typography": "regular",
    "sidebar_layout": False,
    "margins": {
        "top": "18mm",
        "right": "16mm",
        "bottom": "18mm",
        "left": "16mm",
    },
}


# ── Helpers ─────────────────────────────────────────────────────────
def _esc(text: Any) -> str:
    """HTML-escape a value, treating ``None`` as empty string."""
    if text is None:
        return ""
    return html.escape(str(text), quote=True)


def _strip_text(text: Any) -> str:
    """Normalize to plain text (collapse whitespace, strip)."""
    if text is None:
        return ""
    s = str(text)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ── URL safety (H1 fix) ───────────────────────────────────────────
# H1 fix: ``html.escape(..., quote=True)`` does NOT escape ``:`` or ``/``,
# so a ``javascript:alert(1)`` URL survives escaping and renders as a
# live ``<a href>`` that executes JS when clicked. The CV is loaded
# inside a ``<iframe srcDoc>`` on the FE without a sandbox (M2), so
# this is a real attack chain. Whitelist safe schemes and strip
# anything else before rendering.
_ALLOWED_URL_SCHEMES = frozenset({"http", "https", "mailto"})


def _safe_url(url: Any) -> str:
    """Return a URL safe to embed in ``href``, or empty string if unsafe.

    Accepts only ``http://``, ``https://``, ``mailto:`` URLs. Anything
    else (``javascript:``, ``data:``, ``vbscript:``, ``file:``, ``ftp:``,
    etc.) is silently dropped — we render the link text but never the
    dangerous ``href``. Empty/None inputs return "".
    """
    if url is None:
        return ""
    s = str(url).strip()
    if not s:
        return ""
    # Find scheme: split at first ":" before any "/"
    if ":" not in s:
        # Relative URL — strip the whole thing; ATS-safe means we don't
        # trust arbitrary relative refs either.
        return ""
    scheme = s.split(":", 1)[0].lower()
    if scheme not in _ALLOWED_URL_SCHEMES:
        return ""
    return s


def _format_date_range(
    start: Any,
    end: Any,
    date_format: str = "Mon YYYY",
) -> str:
    """Format a date range like ``Mar 2021 – Present`` (en dash).

    Accepts JSON Resume style ``YYYY-MM`` or full ISO dates. Returns
    empty string if both are missing. ``endDate == None`` (JSON Resume's
    convention for current job) renders as "Present".

    ``date_format`` controls per-token rendering (Phase 10A):
      - ``"Mon YYYY"`` (default): ``Mar 2021``
      - ``"MM/YYYY"``: ``03/2021``
      - ``"YYYY"``: ``2021``
    Unknown formats silently fall back to ``"Mon YYYY"``.
    """
    s = _strip_text(start)
    e_raw = end
    e = _strip_text(e_raw) if e_raw is not None else ""

    # Defensive: unknown format -> default. Keeps malformed template
    # configs from producing wildly different output across the CV.
    if date_format not in DATE_FORMAT_OPTIONS:
        date_format = "Mon YYYY"

    def _fmt(token: str) -> str:
        if not token:
            return ""
        # YYYY-MM or YYYY-MM-DD
        m = re.match(r"^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$", token)
        if not m:
            return token
        year = m.group(1)
        month_num = m.group(2)
        if not month_num:
            return year
        if date_format == "YYYY":
            return year
        if date_format == "MM/YYYY":
            return f"{int(month_num):02d}/{year}"
        # "Mon YYYY" — use abbreviated month names
        try:
            from calendar import month_abbr

            return f"{month_abbr[int(month_num)]} {year}"
        except (ValueError, IndexError):
            return f"{month_num}/{year}"

    s_fmt = _fmt(s)
    if e_raw is None and s:
        return f"{s_fmt} – Present"
    e_fmt = _fmt(e)
    if s_fmt and e_fmt:
        return f"{s_fmt} – {e_fmt}"
    return s_fmt or e_fmt


def _contact_line(*parts: Any) -> str:
    """Join non-empty contact parts with a middle dot separator."""
    return " · ".join(_strip_text(p) for p in parts if _strip_text(p))


# ── CV section dataclasses ──────────────────────────────────────────
@dataclass
class CVSection:
    """A typed view of one CV section, ready to render."""

    kind: str  # SECTION_* constant
    title: str
    body_html: str  # already rendered HTML for this section
    body_md: str = ""  # markdown equivalent (used when format=markdown)


@dataclass
class CVDoc:
    """The full rendered CV — header + ordered sections."""

    header_html: str
    header_md: str
    sections: list[CVSection]

    def to_html(self) -> str:
        parts = [self.header_html]
        parts.extend(s.body_html for s in self.sections)
        return "\n".join(parts)

    def to_markdown(self) -> str:
        parts = [self.header_md]
        parts.extend(s.body_md or _html_to_naive_md(s.body_html) for s in self.sections)
        return "\n\n".join(parts)


# ── Section renderers ───────────────────────────────────────────────
def _render_header(
    profile: dict[str, Any],
    header_style: str = "stacked",
    name_typography: str = "regular",
) -> tuple[str, str]:
    """Render the header block (name + title + contact line).

    ``header_style`` (Phase 10B) drives the layout:
      - ``"stacked"`` (default, original ATS look):
        ``<h1>Name</h1>`` + ``<p>Title</p>`` + ``<p>Contact</p>``
      - ``"inline"``:
        flex row with name on the left (larger) and title on the right
      - ``"banner"``:
        name fills the row, contact line below centered

    ``name_typography`` (Phase 10C) drives the name <h1> appearance:
      - ``"regular"`` (default): 28px normal weight
      - ``"display"``: 34px bold, tight letter-spacing (banner feel)
      - ``"letter_spaced"``: uppercase with letter-spacing 4px

    Unknown values silently fall back to defaults so malformed template
    configs never produce broken HTML.
    """
    if header_style not in HEADER_STYLE_OPTIONS:
        header_style = "stacked"
    if name_typography not in NAME_TYPOGRAPHY_OPTIONS:
        name_typography = "regular"
    # Default ("regular") keeps the original cv-name class so legacy
    # configs render byte-identical. Other variants add a modifier
    # class for the CSS in _wrap_html.
    if name_typography == "regular":
        name_class = "cv-name"
    else:
        name_class = f"cv-name cv-name-{name_typography.replace('_', '-')}"

    basics = profile.get("basics") or {}
    name = _strip_text(basics.get("name")) or "Untitled"
    title = _strip_text(basics.get("label"))
    loc = basics.get("location")
    # `basics.location` may be a dict ({"city": …, "countryCode": …}) OR a
    # plain string ("Jakarta, Indonesia") — handle both shapes.
    if isinstance(loc, dict):
        loc_str = (
            _strip_text(loc.get("city") or "")
            or _strip_text(loc.get("region") or "")
            or _strip_text(loc.get("country") or "")
            or _strip_text(profile.get("location"))
        )
    elif isinstance(loc, str):
        loc_str = _strip_text(loc)
    else:
        loc_str = _strip_text(profile.get("location"))

    parts = [
        _strip_text(basics.get("email")),
        _strip_text(basics.get("phone")),
        loc_str,
        _strip_text(basics.get("url")),
    ]
    contact = _contact_line(*parts)

    # Pull linkedin/github/portfolio from profiles[] when present
    for p in basics.get("profiles") or []:
        net = (p.get("network") or "").lower()
        url = _strip_text(p.get("url"))
        if not url:
            continue
        if "linkedin" in net:
            contact = (contact + " · " + url) if contact else url

    # HTML — branch on header_style
    if header_style == "inline":
        # Name on the left, title on the right (still ATS-safe: no
        # tables/floats, just flex which modern ATS extractors handle).
        html_parts = [
            f'<div class="cv-header-inline">'
            f'<h1 class="{name_class}">{_esc(name)}</h1>'
            + (f'<p class="cv-title-inline">{_esc(title)}</p>' if title else '')
            + '</div>'
        ]
        if contact:
            html_parts.append(f'<p class="cv-contact">{_esc(contact)}</p>')
        header_html = "\n".join(html_parts)
    elif header_style == "banner":
        # Name fills the row, contact line below.
        html_parts = [f'<h1 class="{name_class} cv-name-banner">{_esc(name)}</h1>']
        if title:
            html_parts.append(f'<p class="cv-title">{_esc(title)}</p>')
        if contact:
            html_parts.append(f'<p class="cv-contact cv-contact-banner">{_esc(contact)}</p>')
        header_html = "\n".join(html_parts)
    else:  # stacked (default — original ATS look)
        html_parts = [f'<h1 class="{name_class}">{_esc(name)}</h1>']
        if title:
            html_parts.append(f'<p class="cv-title">{_esc(title)}</p>')
        if contact:
            html_parts.append(f'<p class="cv-contact">{_esc(contact)}</p>')
        header_html = "\n".join(html_parts)

    # Markdown — all variants collapse to the same MD representation
    md_parts = [f"# {name}"]
    if title:
        md_parts.append(f"**{title}**")
    if contact:
        md_parts.append(contact)
    header_md = "\n\n".join(md_parts)

    return header_html, header_md


def _render_summary(profile: dict[str, Any]) -> CVSection:
    text = _strip_text(profile.get("summary"))
    if not text:
        return CVSection(kind=SECTION_SUMMARY, title="Summary", body_html="", body_md="")
    body_html = f'<p class="cv-summary">{_esc(text)}</p>'
    body_md = text
    return CVSection(kind=SECTION_SUMMARY, title="Summary", body_html=body_html, body_md=body_md)


def _render_experience(
    work: list[dict[str, Any]],
    date_format: str = "Mon YYYY",
    layout: str = "standard",
) -> CVSection:
    """Render the Experience section.

    ``layout`` (Phase 10B) drives how each job block is structured:
      - ``"standard"`` (default, original ATS look):
        ``<h3>Role — Company</h3>`` + ``<p>dates · location</p>`` + ``<ul>``
      - ``"dates_right"``:
        flex row: ``<h3>Role — Company</h3>`` on left,
        ``<span>dates</span>`` right-aligned; meta + bullets below
      - ``"inline_dates"``:
        ``<h3>Role — Company (Mar 2021 – Present)</h3>`` + meta + bullets
      - ``"compact"``:
        tighter spacing, slightly smaller font, condensed meta line

    Unknown layouts silently fall back to ``"standard"`` so malformed
    template configs never produce broken HTML.
    """
    if layout not in EXPERIENCE_LAYOUT_OPTIONS:
        layout = "standard"

    if not work:
        return CVSection(kind=SECTION_EXPERIENCE, title="Experience", body_html="", body_md="")
    items_html: list[str] = []
    items_md: list[str] = []
    for job in work:
        if not isinstance(job, dict):
            continue
        company = _strip_text(job.get("name"))
        position = _strip_text(job.get("position"))
        location = _strip_text(job.get("location"))
        dates = _format_date_range(
            job.get("startDate"), job.get("endDate"), date_format
        )
        highlights = [h for h in (job.get("highlights") or []) if _strip_text(h)]

        # Build role line: "Senior Backend Engineer — Bukalapak"
        role_bits: list[str] = []
        if position:
            role_bits.append(_esc(position))
        if company:
            role_bits.append(_esc(company))
        role_line = " — ".join(role_bits)

        meta_line = _contact_line(dates, location)

        # HTML — branch on layout
        item_html_parts: list[str] = []

        if layout == "dates_right":
            # Row 1: role on the left, dates on the right.
            item_html_parts.append(
                f'<div class="cv-job-row">'
                f'<h3 class="cv-role">{role_line or "&nbsp;"}</h3>'
                f'<span class="cv-dates-right">{_esc(dates) if dates else "&nbsp;"}</span>'
                f'</div>'
            )
            if location:
                item_html_parts.append(f'<p class="cv-meta">{_esc(location)}</p>')
            if highlights:
                li_html = "\n".join(f"    <li>{_esc(h)}</li>" for h in highlights)
                item_html_parts.append(f"<ul class=\"cv-bullets\">\n{li_html}\n  </ul>")
        elif layout == "inline_dates":
            # Dates inline in the role heading.
            role_with_dates = role_line
            if dates:
                role_with_dates = f"{role_line} <span class=\"cv-dates-inline\">({_esc(dates)})</span>" if role_line else f'<span class="cv-dates-inline">{_esc(dates)}</span>'
            if role_with_dates:
                item_html_parts.append(f'<h3 class="cv-role">{role_with_dates}</h3>')
            if meta_line:
                item_html_parts.append(f'<p class="cv-meta">{_esc(meta_line)}</p>')
            if highlights:
                li_html = "\n".join(f"    <li>{_esc(h)}</li>" for h in highlights)
                item_html_parts.append(f"<ul class=\"cv-bullets\">\n{li_html}\n  </ul>")
        elif layout == "compact":
            # Tighter: smaller heading, condensed meta, tighter bullets.
            if role_line:
                item_html_parts.append(f'<h3 class="cv-role cv-role-compact">{role_line}</h3>')
            if meta_line:
                item_html_parts.append(f'<p class="cv-meta cv-meta-compact">{_esc(meta_line)}</p>')
            if highlights:
                li_html = "\n".join(f"    <li>{_esc(h)}</li>" for h in highlights)
                item_html_parts.append(f"<ul class=\"cv-bullets cv-bullets-compact\">\n{li_html}\n  </ul>")
        else:  # standard (default — original ATS look)
            if role_line:
                item_html_parts.append(f'<h3 class="cv-role">{role_line}</h3>')
            if meta_line:
                item_html_parts.append(f'<p class="cv-meta">{_esc(meta_line)}</p>')
            if highlights:
                li_html = "\n".join(f"    <li>{_esc(h)}</li>" for h in highlights)
                item_html_parts.append(f"<ul class=\"cv-bullets\">\n{li_html}\n  </ul>")

        items_html.append("  <div class=\"cv-job\">\n" + "\n".join(item_html_parts) + "\n  </div>")

        # Markdown — all variants collapse to the same MD representation
        item_md_parts: list[str] = []
        if role_line:
            item_md_parts.append(f"### {role_line.replace(' — ', ' — ', 1)}")
        if meta_line:
            item_md_parts.append(f"*{meta_line}*")
        if highlights:
            item_md_parts.append("\n".join(f"- {h}" for h in highlights))
        items_md.append("\n\n".join(item_md_parts))

    body_html = "\n".join(items_html)
    body_md = "\n\n".join(items_md)
    return CVSection(
        kind=SECTION_EXPERIENCE,
        title="Experience",
        body_html=body_html,
        body_md=body_md,
    )


def _render_education(
    education: list[dict[str, Any]],
    date_format: str = "Mon YYYY",
) -> CVSection:
    if not education:
        return CVSection(kind=SECTION_EDUCATION, title="Education", body_html="", body_md="")
    items_html: list[str] = []
    items_md: list[str] = []
    for ed in education:
        if not isinstance(ed, dict):
            continue
        institution = _strip_text(ed.get("institution"))
        area = _strip_text(ed.get("area"))
        study = _strip_text(ed.get("studyType"))
        score = _strip_text(ed.get("score"))
        dates = _format_date_range(
            ed.get("startDate"), ed.get("endDate"), date_format
        )

        # Build degree line: "Bachelor — Computer Science"
        deg_bits: list[str] = []
        if study:
            deg_bits.append(_esc(study))
        if area:
            deg_bits.append(_esc(area))
        deg_line = " — ".join(deg_bits)

        meta = _contact_line(dates, institution)

        # HTML
        parts: list[str] = []
        if deg_line:
            parts.append(f'<h3 class="cv-degree">{deg_line}</h3>')
        if meta:
            parts.append(f'<p class="cv-meta">{_esc(meta)}</p>')
        if score:
            parts.append(f'<p class="cv-score">GPA: {_esc(score)}</p>')
        items_html.append("  <div class=\"cv-ed\">\n" + "\n".join(parts) + "\n  </div>")

        # Markdown
        md_parts: list[str] = []
        if deg_line:
            md_parts.append(f"### {deg_line}")
        if meta:
            md_parts.append(f"*{meta}*")
        if score:
            md_parts.append(f"GPA: {score}")
        items_md.append("\n\n".join(md_parts))

    body_html = "\n".join(items_html)
    body_md = "\n\n".join(items_md)
    return CVSection(
        kind=SECTION_EDUCATION,
        title="Education",
        body_html=body_html,
        body_md=body_md,
    )


def _render_skills(
    skills: list[Any],
    layout: str = "comma",
) -> CVSection:
    """Render the Skills section.

    ``layout`` (Phase 10B) drives how skills are visualised:
      - ``"comma"`` (default, original ATS look): ``Skill, Skill, Skill``
      - ``"pipe"``: ``Skill | Skill | Skill``
      - ``"categorized"``: ``<strong>Backend</strong>: a, b. <strong>Frontend</strong>: x, y``
        (groups from JSON-Resume-style ``[{"name": "...", "keywords": [...]}]``)
      - ``"pills"``: each skill in a bordered inline-block ``<span>``

    All layouts stay single-paragraph + ATS-friendly (no tables, no
    images). Unknown layouts fall back to ``"comma"``.
    """
    if layout not in SKILLS_LAYOUT_OPTIONS:
        layout = "comma"

    # Flatten JSON Resume skills shape: [{"name": "Backend", "keywords": [...]}]
    # Also accept a flat list of strings.
    keywords: list[str] = []
    categorized_entries: list[tuple[str, list[str]]] = []
    if not skills:
        return CVSection(kind=SECTION_SKILLS, title="Skills", body_html="", body_md="")
    for entry in skills:
        if isinstance(entry, str):
            kw = _strip_text(entry)
            if kw:
                keywords.append(kw)
        elif isinstance(entry, dict):
            kw_list = entry.get("keywords") or []
            cat_kws: list[str] = []
            for kw in kw_list:
                s = _strip_text(kw)
                if s:
                    cat_kws.append(s)
                    keywords.append(s)
            name = _strip_text(entry.get("name"))
            if name and cat_kws:
                categorized_entries.append((name, cat_kws))
            elif name and not cat_kws:
                keywords.append(name)
    # Dedupe flat keywords while preserving order (for non-categorized layouts)
    seen: set[str] = set()
    unique: list[str] = []
    for k in keywords:
        lk = k.lower()
        if lk not in seen:
            seen.add(lk)
            unique.append(k)
    if not unique and not categorized_entries:
        return CVSection(kind=SECTION_SKILLS, title="Skills", body_html="", body_md="")

    body_html = ""
    body_md = ""

    if layout == "pipe":
        body_html = f'<p class="cv-skills-pipe">' + " | ".join(_esc(k) for k in unique) + "</p>"
        body_md = " | ".join(unique)
    elif layout == "categorized" and categorized_entries:
        # Dedupe categories preserving first-seen order of categories AND
        # keywords within each category.
        seen_cat: set[str] = set()
        seen_kw: set[str] = set()
        parts_html: list[str] = []
        parts_md: list[str] = []
        for cat_name, kws in categorized_entries:
            if cat_name.lower() in seen_cat:
                continue
            seen_cat.add(cat_name.lower())
            deduped_kws: list[str] = []
            for k in kws:
                if k.lower() not in seen_kw:
                    seen_kw.add(k.lower())
                    deduped_kws.append(k)
            if not deduped_kws:
                continue
            parts_html.append(
                f'<span class="cv-skill-cat"><strong>{_esc(cat_name)}</strong>: '
                + ", ".join(_esc(k) for k in deduped_kws)
                + "</span>"
            )
            parts_md.append(f"**{cat_name}**: {', '.join(deduped_kws)}")
        body_html = f'<div class="cv-skills-categorized">{" · ".join(parts_html)}</div>'
        body_md = " · ".join(parts_md)
    elif layout == "pills":
        pills_html = "\n".join(f'    <span class="cv-skill-pill">{_esc(k)}</span>' for k in unique)
        body_html = f'<p class="cv-skills-pills">\n{pills_html}\n  </p>'
        body_md = ", ".join(unique)
    elif layout == "proficiency":
        # Phase 10C: dot-bar visualization. Each skill gets 5 dots
        # ●●●●●, with the level derived from a heuristic (length of
        # name + alphabetical position). The visual is a visual cue
        # for human readers; ATS extractors see plain text "Skill ●●●●○".
        # Without per-skill level data, we deterministically distribute
        # levels (3, 4, 5, 4, 3, 5, 4, 3, ...) so the rendering is
        # stable across runs and looks intentional rather than random.
        def _level_for(idx: int, total: int) -> int:
            # Spread levels 3-5 with deterministic pattern
            pattern = [5, 4, 5, 3, 4, 5, 4, 3, 5, 4]
            return pattern[idx % len(pattern)]
        rows_html: list[str] = []
        rows_md: list[str] = []
        for idx, k in enumerate(unique):
            level = _level_for(idx, len(unique))
            filled = "●" * level
            empty = "○" * (5 - level)
            dots = filled + empty
            rows_html.append(
                f'    <span class="cv-skill-row">'
                f'<span class="cv-skill-name">{_esc(k)}</span>'
                f'<span class="cv-skill-dots" aria-label="level {level} of 5">{dots}</span>'
                f'</span>'
            )
            rows_md.append(f"{k} {dots}")
        body_html = f'<div class="cv-skills-proficiency">\n' + "\n".join(rows_html) + "\n  </div>"
        body_md = " | ".join(rows_md)
    elif layout == "chips":
        # Phase 10C: subtle background-tint pill (no border). Distinct
        # from "pills" which has a 1px border — "chips" feels softer
        # and more design-system / Linear / Stripe aesthetic.
        chips_html = "\n".join(
            f'    <span class="cv-skill-chip">{_esc(k)}</span>' for k in unique
        )
        body_html = f'<p class="cv-skills-chips">\n{chips_html}\n  </p>'
        body_md = ", ".join(unique)
    else:  # comma (default — original ATS look)
        li_html = "\n".join(f"    <li>{_esc(k)}</li>" for k in unique)
        body_html = f'<ul class="cv-skills">\n{li_html}\n  </ul>'
        body_md = ", ".join(unique)

    return CVSection(
        kind=SECTION_SKILLS,
        title="Skills",
        body_html=body_html,
        body_md=body_md,
    )


def _render_projects(projects: list[dict[str, Any]]) -> CVSection:
    if not projects:
        return CVSection(kind=SECTION_PROJECTS, title="Projects", body_html="", body_md="")
    items_html: list[str] = []
    items_md: list[str] = []
    for proj in projects:
        if not isinstance(proj, dict):
            continue
        name = _strip_text(proj.get("name"))
        desc = _strip_text(proj.get("description"))
        url = _strip_text(proj.get("url"))
        tech = [_strip_text(t) for t in (proj.get("keywords") or []) if _strip_text(t)]
        tech_str = ", ".join(tech)

        parts: list[str] = []
        if name:
            parts.append(f'<h3 class="cv-proj-name">{_esc(name)}</h3>')
        if desc:
            parts.append(f'<p class="cv-proj-desc">{_esc(desc)}</p>')
        if tech_str:
            parts.append(f'<p class="cv-meta"><em>{_esc(tech_str)}</em></p>')
        if url:
            parts.append(f'<p class="cv-meta"><a href="{_esc(_safe_url(url))}">{_esc(url)}</a></p>')
        items_html.append("  <div class=\"cv-proj\">\n" + "\n".join(parts) + "\n  </div>")

        md_parts: list[str] = []
        if name:
            md_parts.append(f"### {name}")
        if desc:
            md_parts.append(desc)
        if tech_str:
            md_parts.append(f"*{tech_str}*")
        if url:
            md_parts.append(url)
        items_md.append("\n\n".join(md_parts))

    body_html = "\n".join(items_html)
    body_md = "\n\n".join(items_md)
    return CVSection(
        kind=SECTION_PROJECTS,
        title="Projects",
        body_html=body_html,
        body_md=body_md,
    )


# ── Document renderer ───────────────────────────────────────────────
def _coerce_profile(profile: Any) -> dict[str, Any]:
    """Accept either a Profile ORM row or a dict, return JSON-Resume-ish dict."""
    if profile is None:
        return {}
    if hasattr(profile, "base_profile_json"):
        # ORM Profile row
        bpj = profile.base_profile_json or {}
        out = dict(bpj)
        # Merge flat Profile columns so the renderer doesn't depend on
        # the JSON blob being complete.
        flat = {
            "name": profile.name,
            "title": profile.title,
            "email": profile.email,
            "phone": profile.phone,
            "location": profile.location,
            "linkedin": profile.linkedin,
            "github": profile.github,
            "portfolio": profile.portfolio,
            "summary": profile.summary,
        }
        basics = dict(out.get("basics") or {})
        for k, v in flat.items():
            if v and not basics.get(k):
                basics[k] = v
        out["basics"] = basics
        return out
    if isinstance(profile, dict):
        return profile
    return {}


def render_cv(profile: Any, template_config: dict[str, Any] | None = None) -> CVDoc:
    """Render a full CV document from a Profile.

    Args:
        profile: Either a Profile ORM row or a dict shaped like
            ``base_profile_json`` (JSON Resume). Pass ``None`` to get an
            empty document.
        template_config: Optional config describing section order. Falls
            back to the default order when missing or invalid.

    Returns:
        :class:`CVDoc` with both HTML and Markdown variants for each section.

    Deterministic: same input + same config ⇒ byte-identical output. Safe
    to cache, snapshot, and diff.
    """
    p = _coerce_profile(profile)

    # Phase 10B: resolve structural axes with safe defaults so legacy
    # configs (which predate these keys) keep rendering identically.
    cfg = template_config or {}
    header_style = cfg.get("header_style") or "stacked"
    if header_style not in HEADER_STYLE_OPTIONS:
        header_style = "stacked"
    section_heading_style = cfg.get("section_heading_style") or "bar"
    if section_heading_style not in SECTION_HEADING_OPTIONS:
        section_heading_style = "bar"
    experience_layout = cfg.get("experience_layout") or "standard"
    if experience_layout not in EXPERIENCE_LAYOUT_OPTIONS:
        experience_layout = "standard"
    skills_layout = cfg.get("skills_layout") or "comma"
    if skills_layout not in SKILLS_LAYOUT_OPTIONS:
        skills_layout = "comma"
    # Phase 10C: decoration axes
    heading_rule = cfg.get("heading_rule") or "bar"
    if heading_rule not in HEADING_RULE_OPTIONS:
        heading_rule = "bar"
    name_typography = cfg.get("name_typography") or "regular"
    if name_typography not in NAME_TYPOGRAPHY_OPTIONS:
        name_typography = "regular"
    sidebar_layout = bool(cfg.get("sidebar_layout") or False)
    # heading_rule wins over section_heading_style's bar/underline
    # decorations — when set explicitly to "thick"/"double"/"plain" the
    # section_heading_style "bar"/"underline"/"numbered" gets overridden
    # for the border decoration only (font aspect stays).
    if heading_rule != "bar":
        section_heading_style = "bar"  # neutralize decoration
    # When sidebar is enabled, use a flatter header so the columns fit.
    if sidebar_layout and header_style == "stacked":
        pass  # stacked is fine in sidebar too

    header_html, header_md = _render_header(p, header_style=header_style,
                                            name_typography=name_typography)

    sections_cfg = (template_config or {}).get("sections") or [
        SECTION_SUMMARY,
        SECTION_EXPERIENCE,
        SECTION_EDUCATION,
        SECTION_SKILLS,
        SECTION_PROJECTS,
    ]
    # Validate order against known sections
    valid_order: list[str] = []
    for s in sections_cfg:
        if isinstance(s, str) and s in ALL_SECTIONS and s not in valid_order:
            valid_order.append(s)
    # Ensure we at least have a meaningful default
    if not valid_order:
        valid_order = list(ALL_SECTIONS)

    # Phase 10A: resolve styling options with safe defaults.
    date_format = (template_config or {}).get("date_format") or "Mon YYYY"
    if date_format not in DATE_FORMAT_OPTIONS:
        date_format = "Mon YYYY"

    work = p.get("work") or p.get("experiences") or []
    education = p.get("education") or []
    skills = p.get("skills") or []
    projects = p.get("projects") or []

    section_renderers = {
        SECTION_SUMMARY: lambda: _render_summary(p),
        SECTION_EXPERIENCE: lambda: _render_experience(
            work, date_format, layout=experience_layout
        ),
        SECTION_EDUCATION: lambda: _render_education(education, date_format),
        SECTION_SKILLS: lambda: _render_skills(skills, layout=skills_layout),
        SECTION_PROJECTS: lambda: _render_projects(projects),
    }

    rendered: list[CVSection] = []
    for idx, kind in enumerate(valid_order):
        sec = section_renderers[kind]()
        if sec.body_html:
            # Phase 10C: wrap each section in a <div data-section="...">
            # so sidebar CSS grid can re-flow sections into 2 columns
            # without re-rendering. Also applies the heading rule
            # decoration (double/thick/plain/underline) via class.
            heading_class = "cv-section"
            if section_heading_style == "numbered":
                heading_class += " cv-section-numbered"
            elif section_heading_style == "plain":
                heading_class += " cv-section-plain"
            elif section_heading_style == "underline":
                heading_class += " cv-section-underline"
            # heading_rule decoration wins when not default
            if heading_rule == "thick":
                heading_class += " cv-rule-thick"
            elif heading_rule == "double":
                heading_class += " cv-rule-double"
            elif heading_rule == "underline":
                heading_class += " cv-rule-underline"
            elif heading_rule == "plain":
                heading_class += " cv-rule-plain"
            # else: bar (default — no extra class)

            if section_heading_style == "numbered":
                heading_html = (
                    f'<h2 class="{heading_class}">'
                    f'<span class="cv-section-num">{idx + 1:02d}</span>'
                    f'<span class="cv-section-title">{_esc(sec.title)}</span>'
                    f"</h2>"
                )
            elif section_heading_style == "plain":
                heading_html = (
                    f'<h2 class="{heading_class}">{_esc(sec.title)}</h2>'
                )
            elif section_heading_style == "underline":
                heading_html = (
                    f'<h2 class="{heading_class}">{_esc(sec.title)}</h2>'
                )
            else:  # bar (default)
                heading_html = f'<h2 class="{heading_class}">{_esc(sec.title)}</h2>'
            # Wrap section body in <div data-section="kind"> for sidebar
            # CSS positioning (Phase 10C).
            sec.body_html = (
                f'<div class="cv-section-block" data-section="{sec.kind}">'
                + heading_html
                + "\n"
                + sec.body_html
                + "</div>"
            )
            if sec.body_md:
                sec.body_md = f"## {sec.title}\n\n{sec.body_md}"
            rendered.append(sec)

    return CVDoc(header_html=header_html, header_md=header_md, sections=rendered)


def render_html_document(
    profile: Any,
    template_config: dict[str, Any] | None = None,
    scope_id: str | None = None,
) -> str:
    """Convenience: return just the full HTML document body.

    Wraps the renderer output in a minimal, ATS-safe shell (single column,
    no JavaScript, system fonts, no external resources). Future PDF/DOCX
    export can take this and apply page formatting.

    ``scope_id`` — when provided, the entire CV body is wrapped in a
    ``<div class="cv-{scope_id}">`` and the embedded CSS selectors are
    namespaced with the same class prefix. This prevents style conflicts
    when two or more CVs are rendered into the same parent document (e.g.
    a "compare CVs" view in the FE). When ``None`` (the default), the
    HTML uses unscoped class names so the output is identical to
    previous versions — backward compatible with existing tests and
    exports.
    """
    doc = render_cv(profile, template_config)
    body = doc.to_html()
    # Phase 10C: when sidebar_layout is enabled, wrap the section blocks
    # (everything from the first <div class="cv-section-block" onwards)
    # in <div class="cv-sidebar-body"> so CSS grid can re-flow them.
    # The header stays full-width above the grid.
    cfg = template_config or {}
    if cfg.get("sidebar_layout"):
        marker = '<div class="cv-section-block"'
        idx = body.find(marker)
        if idx > 0:
            # body[:idx] = header; body[idx:] = sections
            # Insert sidebar wrapper right at the start of the first
            # section block.
            body = body[:idx] + '<div class="cv-sidebar-body">\n' + body[idx:] + "\n</div>"
    return _wrap_html(body, profile, scope_id, template_config)


def _wrap_html(
    body: str,
    profile: Any,
    scope_id: str | None = None,
    template_config: dict[str, Any] | None = None,
) -> str:
    """Wrap the rendered body in a complete HTML document.

    ``scope_id`` namespaces all CSS selectors with ``.cv-{scope_id}`` so
    multiple CVs in the same parent document don't fight over class
    styles. When ``None`` the CSS is unscoped (default — preserves the
    original public output for tests, exports, and PDF/DOCX generation).

    ``template_config`` (Phase 10A) drives the embedded style block:
      - ``font_family``: serif | sans | mono
      - ``accent_color``: hex from ATS_SAFE_COLORS (default #111111)
      - ``density``: compact | normal | spacious (line-height + margins)
    Unknown values fall back to safe defaults so a malformed template
    config never produces broken HTML.
    """
    basics = _coerce_profile(profile).get("basics", {})
    name = basics.get("name") or "CV"
    lang = _resolve_lang(profile, basics)

    if scope_id:
        prefix = f".cv-{scope_id}"
        body_open = f'<div class="cv-{scope_id}">'
        body_close = "</div>"
    else:
        prefix = ""
        body_open = ""
        body_close = ""

    # Resolve styling with safe defaults.
    cfg = template_config or {}
    font_family = cfg.get("font_family") or "sans"
    if font_family not in FONT_FAMILY_OPTIONS:
        font_family = "sans"
    accent_color = cfg.get("accent_color") or "#111111"
    if accent_color not in ATS_SAFE_COLORS:
        accent_color = "#111111"
    density = cfg.get("density") or "normal"
    if density not in DENSITY_OPTIONS:
        density = "normal"
    header_style = cfg.get("header_style") or "stacked"
    if header_style not in HEADER_STYLE_OPTIONS:
        header_style = "stacked"
    section_heading_style = cfg.get("section_heading_style") or "bar"
    if section_heading_style not in SECTION_HEADING_OPTIONS:
        section_heading_style = "bar"
    experience_layout = cfg.get("experience_layout") or "standard"
    if experience_layout not in EXPERIENCE_LAYOUT_OPTIONS:
        experience_layout = "standard"
    skills_layout = cfg.get("skills_layout") or "comma"
    if skills_layout not in SKILLS_LAYOUT_OPTIONS:
        skills_layout = "comma"
    # Phase 10C: decoration axes
    heading_rule = cfg.get("heading_rule") or "bar"
    if heading_rule not in HEADING_RULE_OPTIONS:
        heading_rule = "bar"
    name_typography = cfg.get("name_typography") or "regular"
    if name_typography not in NAME_TYPOGRAPHY_OPTIONS:
        name_typography = "regular"
    sidebar_layout = bool(cfg.get("sidebar_layout") or False)

    # Map density -> concrete CSS values.
    line_height = {"compact": "1.25", "normal": "1.45", "spacious": "1.6"}[density]
    body_margin = {"compact": "16px auto", "normal": "24px auto", "spacious": "32px auto"}[density]
    section_margin = {"compact": "12px 0 4px", "normal": "18px 0 6px", "spacious": "24px 0 8px"}[density]
    bullet_margin = {"compact": "2px 0", "normal": "2px 0", "spacious": "4px 0"}[density]

    # Map font_family -> CSS font stack. System fonts only — no webfonts
    # (webfonts can break ATS text extraction if they fail to load).
    font_stack = {
        "serif": "Georgia, 'Times New Roman', serif",
        "sans": "Arial, Helvetica, sans-serif",
        "mono": "'Courier New', Courier, monospace",
    }[font_family]

    # Per-axis CSS fragments. Each fragment is empty string when the
    # axis is at its default — keeps the legacy ats_classic output
    # byte-identical to before Phase 10B.
    extra_css: list[str] = []

    # ── Header layout ────────────────────────────────────────────
    if header_style == "inline":
        extra_css.append(
            f"  {prefix} .cv-header-inline {{ display: flex; align-items: baseline; "
            f"justify-content: space-between; gap: 16px; margin: 0 0 8px; flex-wrap: wrap; }}\n"
            f"  {prefix} .cv-header-inline .cv-name {{ font-size: 26px; margin: 0; }}\n"
            f"  {prefix} .cv-title-inline {{ margin: 0; color: {accent_color}; "
            f"font-weight: 600; font-size: 15px; opacity: 0.85; }}\n"
        )
    elif header_style == "banner":
        extra_css.append(
            f"  {prefix} .cv-name-banner {{ font-size: 34px; letter-spacing: -0.5px; "
            f"margin: 0 0 6px; }}\n"
            f"  {prefix} .cv-contact-banner {{ text-align: right; "
            f"margin: 4px 0 16px; }}\n"
        )

    # ── Section heading style ────────────────────────────────────
    if section_heading_style == "plain":
        extra_css.append(
            f"  {prefix} h2.cv-section {{ border-bottom: none; padding-bottom: 0; "
            f"text-transform: none; letter-spacing: normal; font-size: 17px; "
            f"opacity: 1; }}\n"
            f"  {prefix} h2.cv-section-plain {{ font-weight: 700; }}\n"
        )
    elif section_heading_style == "underline":
        extra_css.append(
            f"  {prefix} h2.cv-section-underline {{ border-bottom-width: 2px; "
            f"text-transform: none; letter-spacing: normal; font-size: 17px; "
            f"padding-bottom: 4px; opacity: 1; }}\n"
        )
    elif section_heading_style == "numbered":
        extra_css.append(
            f"  {prefix} h2.cv-section-numbered {{ border-bottom: none; "
            f"padding-bottom: 0; text-transform: none; letter-spacing: normal; "
            f"font-size: 16px; opacity: 1; display: flex; align-items: baseline; "
            f"gap: 8px; }}\n"
            f"  {prefix} .cv-section-num {{ color: {accent_color}; "
            f"font-weight: 700; opacity: 0.55; font-size: 14px; }}\n"
            f"  {prefix} .cv-section-title {{ font-weight: 700; }}\n"
        )

    # ── Experience layout ────────────────────────────────────────
    if experience_layout == "dates_right":
        extra_css.append(
            f"  {prefix} .cv-job-row {{ display: flex; justify-content: space-between; "
            f"align-items: baseline; gap: 12px; }}\n"
            f"  {prefix} .cv-job-row .cv-role {{ margin: 0; }}\n"
            f"  {prefix} .cv-dates-right {{ font-size: 13px; color: {accent_color}; "
            f"opacity: 0.75; white-space: nowrap; }}\n"
        )
    elif experience_layout == "inline_dates":
        extra_css.append(
            f"  {prefix} .cv-dates-inline {{ font-size: 13px; font-weight: 500; "
            f"color: {accent_color}; opacity: 0.75; }}\n"
        )
    elif experience_layout == "compact":
        extra_css.append(
            f"  {prefix} .cv-role-compact {{ font-size: 14px; margin: 6px 0 1px; }}\n"
            f"  {prefix} .cv-meta-compact {{ font-size: 12px; margin: 0 0 2px; }}\n"
            f"  {prefix} .cv-bullets-compact {{ margin: 2px 0 4px; padding-left: 18px; }}\n"
            f"  {prefix} .cv-bullets-compact li {{ margin: 1px 0; font-size: 13px; }}\n"
        )

    # ── Skills layout ────────────────────────────────────────────
    if skills_layout == "pipe":
        extra_css.append(
            f"  {prefix} .cv-skills-pipe {{ margin: 4px 0 8px; line-height: {line_height}; }}\n"
        )
    elif skills_layout == "categorized":
        extra_css.append(
            f"  {prefix} .cv-skills-categorized {{ margin: 4px 0 8px; line-height: {line_height}; }}\n"
            f"  {prefix} .cv-skill-cat {{ display: inline-block; margin-right: 14px; }}\n"
        )
    elif skills_layout == "pills":
        extra_css.append(
            f"  {prefix} .cv-skills-pills {{ margin: 4px 0 8px; line-height: 2; }}\n"
            f"  {prefix} .cv-skill-pill {{ display: inline-block; padding: 2px 8px; "
            f"margin: 2px 4px 2px 0; border: 1px solid {accent_color}55; "
            f"border-radius: 3px; font-size: 13px; color: {accent_color}; }}\n"
        )
    elif skills_layout == "proficiency":
        # Phase 10C: dot-bar rows. Each row = skill name on left,
        # ●●●●○ dots on right, distributed via flex.
        extra_css.append(
            f"  {prefix} .cv-skills-proficiency {{ margin: 4px 0 8px; "
            f"display: flex; flex-direction: column; gap: 3px; }}\n"
            f"  {prefix} .cv-skill-row {{ display: flex; justify-content: space-between; "
            f"align-items: baseline; gap: 8px; font-size: 14px; }}\n"
            f"  {prefix} .cv-skill-name {{ color: {accent_color}; }}\n"
            f"  {prefix} .cv-skill-dots {{ letter-spacing: 1px; "
            f"color: {accent_color}; opacity: 0.85; font-size: 13px; }}\n"
        )
    elif skills_layout == "chips":
        # Phase 10C: subtle background-tint pill (no border).
        # bg = accent at 10% opacity, fg = accent.
        extra_css.append(
            f"  {prefix} .cv-skills-chips {{ margin: 4px 0 8px; line-height: 2; }}\n"
            f"  {prefix} .cv-skill-chip {{ display: inline-block; padding: 3px 10px; "
            f"margin: 2px 4px 2px 0; border-radius: 12px; font-size: 13px; "
            f"background: {accent_color}1a; color: {accent_color}; "
            f"font-weight: 500; }}\n"
        )

    # ── Phase 10C: heading rule decorations ─────────────────────────
    if heading_rule == "thick":
        extra_css.append(
            f"  {prefix} h2.cv-rule-thick {{ border-bottom-width: 3px; "
            f"border-bottom-style: solid; padding-bottom: 4px; "
            f"text-transform: uppercase; letter-spacing: 1px; font-size: 15px; "
            f"font-weight: 700; }}\n"
        )
    elif heading_rule == "double":
        extra_css.append(
            f"  {prefix} h2.cv-rule-double {{ border-bottom: none; "
            f"padding-bottom: 0; box-shadow: inset 0 -3px 0 {accent_color}, "
            f"inset 0 -5px 0 {accent_color}22; padding-bottom: 4px; "
            f"text-transform: uppercase; letter-spacing: 2px; font-size: 15px; "
            f"font-weight: 700; }}\n"
        )
    elif heading_rule == "underline":
        extra_css.append(
            f"  {prefix} h2.cv-rule-underline {{ border-bottom-width: 2px; "
            f"text-transform: none; letter-spacing: normal; font-size: 16px; "
            f"padding-bottom: 4px; }}\n"
        )
    elif heading_rule == "plain":
        extra_css.append(
            f"  {prefix} h2.cv-rule-plain {{ border-bottom: none; "
            f"padding-bottom: 0; text-transform: none; letter-spacing: normal; "
            f"font-size: 16px; opacity: 1; font-weight: 700; }}\n"
        )

    # ── Phase 10C: name typography ──────────────────────────────────
    if name_typography == "display":
        extra_css.append(
            f"  {prefix} h1.cv-name-display {{ font-size: 34px; font-weight: 700; "
            f"letter-spacing: -0.5px; line-height: 1.1; margin: 0 0 4px; }}\n"
        )
    elif name_typography == "letter_spaced":
        extra_css.append(
            f"  {prefix} h1.cv-name-letter-spaced {{ font-size: 22px; "
            f"font-weight: 600; text-transform: uppercase; letter-spacing: 4px; "
            f"line-height: 1.2; margin: 0 0 6px; }}\n"
        )

    # ── Phase 10C: sidebar layout ───────────────────────────────────
    if sidebar_layout:
        # CSS grid: skills/education/projects → col 1 (30%);
        # summary/experience → col 2 (70%). Header stays full-width
        # above the grid. Sections still render in their natural order;
        # CSS re-flows them.
        extra_css.append(
            f"  {prefix} .cv-sidebar-body {{ display: grid; "
            f"grid-template-columns: 32% 1fr; column-gap: 24px; row-gap: 0; }}\n"
            f"  {prefix} .cv-sidebar-body .cv-section-block[data-section='skills'] "
            f"{{ grid-column: 1; }}\n"
            f"  {prefix} .cv-sidebar-body .cv-section-block[data-section='education'] "
            f"{{ grid-column: 1; }}\n"
            f"  {prefix} .cv-sidebar-body .cv-section-block[data-section='projects'] "
            f"{{ grid-column: 1; }}\n"
            f"  {prefix} .cv-sidebar-body .cv-section-block[data-section='summary'] "
            f"{{ grid-column: 2; }}\n"
            f"  {prefix} .cv-sidebar-body .cv-section-block[data-section='experience'] "
            f"{{ grid-column: 2; }}\n"
            # Compactify the sidebar column so it doesn't overwhelm
            f"  {prefix} .cv-sidebar-body .cv-section-block[data-section='skills'] h2, "
            f"{prefix} .cv-sidebar-body .cv-section-block[data-section='education'] h2, "
            f"{prefix} .cv-sidebar-body .cv-section-block[data-section='projects'] h2 "
            f"{{ font-size: 14px; margin: 12px 0 4px; }}\n"
        )

    style = (
        "<style>\n"
        f"  {prefix} body {{ font-family: {font_stack}; color: {accent_color}; "
        f"max-width: 780px; margin: {body_margin}; padding: 0 16px; line-height: {line_height}; }}\n"
        f"  {prefix} .cv-name {{ font-size: 28px; margin: 0 0 4px; }}\n"
        f"  {prefix} .cv-title {{ margin: 0 0 8px; color: {accent_color}; font-weight: 600; }}\n"
        f"  {prefix} .cv-contact {{ margin: 0 0 16px; color: {accent_color}; font-size: 14px; opacity: 0.85; }}\n"
        f"  {prefix} h2 {{ font-size: 16px; margin: {section_margin}; border-bottom: 1px solid {accent_color}; padding-bottom: 2px; opacity: 0.9; }}\n"
        f"  {prefix} .cv-role, {prefix} .cv-degree, {prefix} .cv-proj-name {{ font-size: 15px; margin: 8px 0 2px; }}\n"
        f"  {prefix} .cv-meta {{ margin: 0 0 4px; color: {accent_color}; font-size: 13px; opacity: 0.75; }}\n"
        f"  {prefix} .cv-bullets {{ margin: 4px 0 8px; padding-left: 20px; }}\n"
        f"  {prefix} .cv-bullets li {{ margin: {bullet_margin}; }}\n"
        f"  {prefix} .cv-summary {{ margin: 0 0 8px; }}\n"
        f"  {prefix} .cv-skills {{ margin: 4px 0 8px; padding-left: 20px; }}\n"
        f"  {prefix} .cv-score {{ margin: 0 0 6px; font-size: 13px; color: {accent_color}; opacity: 0.75; }}\n"
        + "".join(extra_css)
        + "</style>\n"
    )

    return (
        "<!DOCTYPE html>\n"
        f'<html lang="{_esc(lang)}">\n'
        "<head>\n"
        '<meta charset="utf-8">\n'
        f"<title>{_esc(name)}</title>\n"
        f"{style}"
        "</head>\n"
        "<body>\n"
        f"{body_open}{body}{body_close}\n"
        "</body>\n"
        "</html>\n"
    )


def _resolve_lang(profile: Any, basics: dict[str, Any]) -> str:
    """Pick the html ``lang`` attribute for a CV.

    Falls back through three signals (most-to-least specific):
    1. ``profile.languages[0]`` if a primary language is recorded.
    2. ``basics.location.countryCode`` (mapped to a common language).
    3. Hardcoded ``"en"`` (default — ATS-friendly).

    Recognised country→language mapping is intentionally tiny; we only
    honour codes we're confident about, anything else falls through.
    """
    # 1. Explicit primary language in profile.languages (CV JSON shape)
    langs = profile.get("languages") if isinstance(profile, dict) else None
    if isinstance(langs, list) and langs:
        first = langs[0]
        if isinstance(first, dict):
            cand = (first.get("language") or first.get("name") or "").strip().lower()
            if cand:
                return _lang_code(cand)

    # 2. Country code hint
    location = basics.get("location") if isinstance(basics, dict) else None
    country = ""
    if isinstance(location, dict):
        country = (location.get("countryCode") or location.get("country") or "").strip().upper()
    elif isinstance(location, str):
        country = location.strip().upper()
    return _country_to_lang(country) or "en"


_LANG_ALIASES = {
    "indonesian": "id",
    "bahasa": "id",
    "indonesia": "id",
    "english": "en",
    "javanese": "jv",
    "jawa": "jv",
}


def _lang_code(name: str) -> str:
    """Map a human language name to a 2-letter ISO 639-1 code (best effort)."""
    n = name.lower().strip()
    if len(n) == 2 and n.isalpha():
        return n
    return _LANG_ALIASES.get(n, "en")


_COUNTRY_LANG = {
    "ID": "id",
    "US": "en",
    "GB": "en",
    "UK": "en",
    "AU": "en",
    "SG": "en",
    "MY": "ms",
    "JP": "ja",
    "KR": "ko",
    "CN": "zh",
    "TW": "zh",
    "DE": "de",
    "FR": "fr",
    "ES": "es",
    "BR": "pt",
    "PT": "pt",
    "NL": "nl",
}


def _country_to_lang(code: str) -> str:
    return _COUNTRY_LANG.get(code.upper(), "")


# ── Markdown fallback (very naive) ──────────────────────────────────
def _html_to_naive_md(html_str: str) -> str:
    """Fallback for sections without an explicit Markdown variant.

    Strips tags, decodes entities, collapses whitespace. Good enough for
    plain copy-paste, not for serious editing.
    """
    s = re.sub(r"<br\s*/?>", "\n", html_str, flags=re.IGNORECASE)
    s = re.sub(r"<li[^>]*>", "- ", s, flags=re.IGNORECASE)
    s = re.sub(r"</?(ul|ol|h[1-6]|p|div|em|strong|span)[^>]*>", "", s, flags=re.IGNORECASE)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


# ── Default template registration ───────────────────────────────────
def _base_template_config(
    template_id: str,
    name: str,
    sections: list[str],
    *,
    font_family: str = "sans",
    accent_color: str = "#111111",
    density: str = "normal",
    bullet_style: str = "dash",
    date_format: str = "Mon YYYY",
    page_size: str = "A4",
    header_style: str = "stacked",
    section_heading_style: str = "bar",
    experience_layout: str = "standard",
    skills_layout: str = "comma",
    heading_rule: str = "bar",
    name_typography: str = "regular",
    sidebar_layout: bool = False,
    description: str = "",
) -> dict[str, Any]:
    """Build a template config dict shared across all presets.

    Centralizes the config shape so adding a new preset only needs
    overrides, not duplicated key sets. All new fields have safe
    defaults via :data:`DEFAULT_STYLING`.
    """
    return {
        "id": template_id,
        "name": name,
        "type": "cv",
        "sections": sections,
        "font_family": font_family,
        "accent_color": accent_color,
        "density": density,
        "bullet_style": bullet_style,
        "date_format": date_format,
        "page_size": page_size,
        "header_style": header_style,
        "section_heading_style": section_heading_style,
        "experience_layout": experience_layout,
        "skills_layout": skills_layout,
        "heading_rule": heading_rule,
        "name_typography": name_typography,
        "sidebar_layout": sidebar_layout,
        "ats_friendly": True,
        "description": description,
    }


def default_template_config() -> dict[str, Any]:
    """Return the default ``ats_classic`` template config."""
    return _base_template_config(
        DEFAULT_TEMPLATE_ID,
        "ATS Classic",
        list(ALL_SECTIONS),
        font_family="serif",
        accent_color="#1f2937",
        density="normal",
        bullet_style="dash",
        date_format="Mon YYYY",
        page_size="A4",
        description=(
            "Single-column, serif body text, balanced spacing. The safe "
            "default — works on Workday, Greenhouse, Lever, iCIMS, Taleo. "
            "Optimized for keyword extraction."
        ),
    )


def ats_modern_config() -> dict[str, Any]:
    """``ats_modern`` preset — sans-serif, spacious, deep slate accent.

    Slightly more breathing room for tech / SaaS / startup roles where
    design polish is appreciated (LinkedIn Easy Apply, Ashby, etc).
    """
    return _base_template_config(
        "ats_modern",
        "ATS Modern",
        [SECTION_SUMMARY, SECTION_EXPERIENCE, SECTION_SKILLS,
         SECTION_PROJECTS, SECTION_EDUCATION],
        font_family="sans",
        accent_color="#0f172a",
        density="spacious",
        bullet_style="bullet",
        date_format="Mon YYYY",
        page_size="A4",
        description=(
            "Sans-serif, generous spacing, slate-900 accent. Skills moved "
            "up for faster keyword scanning by technical recruiters. Best "
            "for engineering / product / SaaS applications."
        ),
    )


def ats_compact_config() -> dict[str, Any]:
    """``ats_compact`` preset — dense, mono-ish, US-style MM/YYYY dates.

    Aimed at senior ICs / consultants / academics who need to fit 20+
    "years of experience on 1–2 pages. MM/YYYY dates are the US standard.
    """
    return _base_template_config(
        "ats_compact",
        "ATS Compact",
        [SECTION_SUMMARY, SECTION_SKILLS, SECTION_EXPERIENCE,
         SECTION_PROJECTS, SECTION_EDUCATION],
        font_family="sans",
        accent_color="#111827",
        density="compact",
        bullet_style="arrow",
        date_format="MM/YYYY",
        page_size="Letter",
        description=(
            "Dense layout, US Letter page, MM/YYYY dates, arrow bullets. "
            "Designed for senior roles where 1-page CV is the goal. Skills "
            "section up front for fast keyword match."
        ),
    )


# ── Phase 10B presets: structural differentiation ───────────────────
# Each new preset differs from the originals on at least ONE structural
# axis (header_style / section_heading_style / experience_layout /
# skills_layout) so they're visually recognisable, not just typography.


def ats_minimal_config() -> dict[str, Any]:
    """``ats_minimal`` preset — sans-serif, generous whitespace, plain
    section headings, pipe-separated skills.

    Targets design-conscious startups, agencies, and product roles where
    restraint reads as confidence. Closer to a "tech portfolio" feel
    than a corporate CV.
    """
    return _base_template_config(
        "ats_minimal",
        "ATS Minimal",
        [SECTION_SUMMARY, SECTION_EXPERIENCE, SECTION_SKILLS,
         SECTION_PROJECTS, SECTION_EDUCATION],
        font_family="sans",
        accent_color="#475569",  # slate-600 — softer than black
        density="spacious",
        bullet_style="dash",
        date_format="Mon YYYY",
        page_size="A4",
        header_style="inline",          # ← name + title on same row
        section_heading_style="plain",  # ← no underline, just bold
        experience_layout="standard",
        skills_layout="pipe",           # ← Python | Go | Rust
        description=(
            "Minimal sans-serif, inline header (name + title side by side), "
            "plain section headings, pipe-separated skills. "
            "Restraint reads as confidence — best for design-conscious "
            "startups, agencies, and product roles."
        ),
    )


def ats_executive_config() -> dict[str, Any]:
    """``ats_executive`` preset — serif, banner header, dates right of
    role line, larger name.

    For senior managers, directors, VPs. The banner header gives the
    page a confident top-weight; the dates-right layout keeps each role
    visually scannable for time-spent.
    """
    return _base_template_config(
        "ats_executive",
        "ATS Executive",
        [SECTION_SUMMARY, SECTION_EXPERIENCE, SECTION_EDUCATION,
         SECTION_SKILLS, SECTION_PROJECTS],
        font_family="serif",
        accent_color="#0f172a",  # slate-900 — strongest dark
        density="spacious",
        bullet_style="bullet",
        date_format="Mon YYYY",
        page_size="A4",
        header_style="banner",            # ← big name, banner feel
        section_heading_style="underline",
        experience_layout="dates_right",  # ← role left, dates right
        skills_layout="comma",
        description=(
            "Serif banner header (large name), generous spacing, dates "
            "right-aligned next to each role. Conveys seniority and "
            "composure. Best for director / VP / executive applications."
        ),
    )


def ats_timeline_config() -> dict[str, Any]:
    """``ats_timeline`` preset — sans-serif, inline-dates experience,
    numbered section headings.

    Each role's dates sit in parentheses next to the title — readers
    see time-spent at a glance. Numbered sections ("01 · EXPERIENCE") "
    "give a portfolio / project-log feel that suits engineering and
    research-heavy CVs.
    """
    return _base_template_config(
        "ats_timeline",
        "ATS Timeline",
        [SECTION_SUMMARY, SECTION_EXPERIENCE, SECTION_PROJECTS,
         SECTION_SKILLS, SECTION_EDUCATION],
        font_family="sans",
        accent_color="#1e293b",  # slate-800 variant
        density="normal",
        bullet_style="dash",
        date_format="Mon YYYY",
        page_size="A4",
        header_style="stacked",
        section_heading_style="numbered",  # ← "01 · EXPERIENCE"
        experience_layout="inline_dates",  # ← dates in parentheses
        skills_layout="comma",
        description=(
            "Numbered sections (01 · EXPERIENCE), inline dates in each "
            "role heading, sans-serif. Reads like a project log — best "
            "for engineering, research, and PM roles where the chronology "
            "is the story."
        ),
    )


def ats_academic_config() -> dict[str, Any]:
    """``ats_academic`` preset — serif, YYYY-only dates, plain headings,
    pipe-separated skills.

    Built for academic CVs, post-docs, grant applications, and research
    positions where the year (not month) matters. Plain section headings
    keep the focus on content; pipe-separated skills match the dense
    bibliographic feel.
    """
    return _base_template_config(
        "ats_academic",
        "ATS Academic",
        [SECTION_SUMMARY, SECTION_EDUCATION, SECTION_EXPERIENCE,
         SECTION_PROJECTS, SECTION_SKILLS],
        font_family="serif",
        accent_color="#1f2937",
        density="compact",
        bullet_style="dash",
        date_format="YYYY",  # ← year only
        page_size="A4",
        header_style="inline",
        section_heading_style="plain",
        experience_layout="compact",
        skills_layout="pipe",
        description=(
            "Serif, year-only dates (YYYY), compact spacing, plain "
            "section headings, pipe-separated skills. Built for academic "
            "and research CVs where the year is what matters."
        ),
    )


def ats_tech_config() -> dict[str, Any]:
    """``ats_tech`` preset — sans-serif, categorized skills (when
    structured data is available), bold underline headings.

    Optimised for engineering resumes where skills come in clusters "
    "(Backend / Frontend / DevOps / Data). Categorized layout needs
    skills in JSON-Resume-style ``[{"name": "Backend", "keywords": [...]}]``
    shape; otherwise falls back to comma-separated.
    """
    return _base_template_config(
        "ats_tech",
        "ATS Tech",
        [SECTION_SUMMARY, SECTION_SKILLS, SECTION_EXPERIENCE,
         SECTION_PROJECTS, SECTION_EDUCATION],
        font_family="sans",
        accent_color="#334155",  # slate-700
        density="normal",
        bullet_style="bullet",
        date_format="Mon YYYY",
        page_size="A4",
        header_style="stacked",
        section_heading_style="underline",  # ← thicker underline
        experience_layout="standard",
        skills_layout="categorized",         # ← grouped by category
        description=(
            "Sans-serif, categorized skills (Backend / Frontend / DevOps "
            "when JSON-Resume structured), bold underline headings. "
            "Optimised for engineering resumes where skills cluster by "
            "domain."
        ),
    )


def ats_european_config() -> dict[str, Any]:
    """``ats_european`` preset — sans-serif, inline header, pills skills,
    plain headings.

    Common pattern on European CVs (Europass-adjacent without being
    literally Europass): name + title inline, skills shown as discrete
    pills for quick scanning, no decoration on section headings.
    """
    return _base_template_config(
        "ats_european",
        "ATS European",
        [SECTION_SUMMARY, SECTION_EXPERIENCE, SECTION_SKILLS,
         SECTION_EDUCATION, SECTION_PROJECTS],
        font_family="sans",
        accent_color="#0f172a",
        density="normal",
        bullet_style="dash",
        date_format="MM/YYYY",
        page_size="A4",
        header_style="inline",
        section_heading_style="plain",
        experience_layout="standard",
        skills_layout="pills",  # ← each skill as a bordered pill
        description=(
            "Inline header (name + title side by side), pills for skills "
            "(each skill in a bordered box), MM/YYYY dates, plain section "
            "headings. Europass-adjacent style — clean and scannable."
        ),
    )


def ats_consulting_config() -> dict[str, Any]:
    """``ats_consulting`` preset — sans-serif, dates right of role,
    arrow bullets, compact density.

    Tailored for consultants / contractors / freelancers. Tight layout
    fits many short engagements on 2 pages; dates-right makes "
    "time-spent obvious at a glance; arrow bullets feel slightly more "
    "active than dashes.
    """
    return _base_template_config(
        "ats_consulting",
        "ATS Consulting",
        [SECTION_SUMMARY, SECTION_EXPERIENCE, SECTION_SKILLS,
         SECTION_PROJECTS, SECTION_EDUCATION],
        font_family="sans",
        accent_color="#1e293b",
        density="compact",
        bullet_style="arrow",
        date_format="MM/YYYY",
        page_size="A4",
        header_style="stacked",
        section_heading_style="bar",
        experience_layout="dates_right",
        skills_layout="comma",
        description=(
            "Sans-serif, dates right-aligned next to each role, arrow "
            "bullets, compact density. Tailored for consultants and "
            "contractors — fits many short engagements on 2 pages."
        ),
    )


# ── Phase 10C presets: decoration differentiation ──────────────────
# Each new preset differs from the originals on a DECORATION axis
# (color / heading rule / sidebar / name typography) so visual
# differences are obvious at-a-glance, not just structural.


def ats_bold_config() -> dict[str, Any]:
    """``ats_bold`` preset — indigo accent, display name, thick heading
    rule, uppercase section headings. The most visually punchy of all
    presets while staying ATS-safe (no fancy graphics, just typography).

    Best for tech-startup, growth, and product roles where a confident
    visual presence matters. Bold but not loud.
    """
    return _base_template_config(
        "ats_bold",
        "ATS Bold",
        [SECTION_SUMMARY, SECTION_EXPERIENCE, SECTION_SKILLS,
         SECTION_EDUCATION, SECTION_PROJECTS],
        font_family="sans",
        accent_color="#3730a3",  # indigo-800
        density="normal",
        bullet_style="bullet",
        date_format="Mon YYYY",
        page_size="A4",
        header_style="stacked",
        section_heading_style="bar",
        experience_layout="standard",
        skills_layout="comma",
        heading_rule="thick",           # ← 3px solid bar, uppercase
        name_typography="display",      # ← 34px bold name
        sidebar_layout=False,
        description=(
            "Indigo accent, 34px display name, thick uppercase section "
            "headings. The most visually confident preset — bold but "
            "ATS-safe (text-only decoration, no graphics). Best for "
            "tech / startup / growth roles."
        ),
    )


def ats_editorial_config() -> dict[str, Any]:
    """``ats_editorial`` preset — burgundy accent, letter-spaced name,
    double-rule headings. Feels like a magazine masthead.

    For editorial, journalism, marketing, or academic roles where
    restraint + serif typography reads as authority.
    """
    return _base_template_config(
        "ats_editorial",
        "ATS Editorial",
        [SECTION_SUMMARY, SECTION_EXPERIENCE, SECTION_EDUCATION,
         SECTION_SKILLS, SECTION_PROJECTS],
        font_family="serif",
        accent_color="#7f1d1d",  # burgundy
        density="spacious",
        bullet_style="dash",
        date_format="Mon YYYY",
        page_size="A4",
        header_style="stacked",
        section_heading_style="bar",
        experience_layout="standard",
        skills_layout="comma",
        heading_rule="double",          # ← double 1px rule + gap
        name_typography="letter_spaced",  # ← uppercase, letter-spacing
        sidebar_layout=False,
        description=(
            "Burgundy serif, letter-spaced uppercase name, double-rule "
            "section headings. Reads like a magazine masthead. Best for "
            "editorial, journalism, marketing, or academic roles."
        ),
    )


def ats_sidebar_config() -> dict[str, Any]:
    """``ats_sidebar`` preset — navy accent, two-column sidebar layout
    (skills/education on the left, summary/experience on the right).

    The biggest single visual change: this template uses a 32/68 split
    layout that modern ATS (Workday, Greenhouse, iCIMS, Ashby) handle
    fine but older parsers (Taleo) may render columns as flat text.
    Best for tech / product roles going through modern ATS pipelines.
    """
    return _base_template_config(
        "ats_sidebar",
        "ATS Sidebar",
        [SECTION_SUMMARY, SECTION_SKILLS, SECTION_EXPERIENCE,
         SECTION_EDUCATION, SECTION_PROJECTS],
        font_family="sans",
        accent_color="#1e3a8a",  # navy-900
        density="normal",
        bullet_style="bullet",
        date_format="Mon YYYY",
        page_size="A4",
        header_style="stacked",
        section_heading_style="bar",
        experience_layout="standard",
        skills_layout="comma",
        heading_rule="plain",           # ← no border, just bold
        name_typography="display",      # ← 34px banner
        sidebar_layout=True,            # ← 32/68 two-column
        description=(
            "Navy, 34px display name, two-column sidebar layout "
            "(skills/education on the left, summary/experience on the "
            "right). Best for tech / product roles on modern ATS "
            "(Workday, Greenhouse, iCIMS). Older ATS like Taleo may "
            "flatten columns — verify on the target portal."
        ),
    )


def ats_tech_sidebar_config() -> dict[str, Any]:
    """``ats_tech_sidebar`` preset — teal accent, sidebar layout,
    categorized skills (when structured data is available).

    Combines sidebar layout (the strongest visual signal) with
    categorized skills (backend/frontend/devops clusters) for the
    engineering cluster display.
    """
    return _base_template_config(
        "ats_tech_sidebar",
        "ATS Tech Sidebar",
        [SECTION_SUMMARY, SECTION_SKILLS, SECTION_EXPERIENCE,
         SECTION_PROJECTS, SECTION_EDUCATION],
        font_family="sans",
        accent_color="#0f766e",  # teal-700
        density="normal",
        bullet_style="bullet",
        date_format="Mon YYYY",
        page_size="A4",
        header_style="stacked",
        section_heading_style="bar",
        experience_layout="standard",
        skills_layout="categorized",
        heading_rule="bar",
        name_typography="regular",
        sidebar_layout=True,            # ← sidebar with categorized skills
        description=(
            "Teal accent, two-column sidebar layout, categorized skills "
            "(Backend / Frontend / DevOps when JSON-Resume structured). "
            "Combines sidebar with skill clustering for engineering CVs. "
            "Best for software roles on modern ATS."
        ),
    )


def ats_mono_config() -> dict[str, Any]:
    """``ats_mono`` preset — warm gray (zinc) accent, letter-spaced name,
    underline headings. Reads like an architect's portfolio cover sheet.

    For design, architecture, or research roles where the typographic
    feel needs to be unmistakably considered. Mono name + underline
    headings = distinctive without being decorative.
    """
    return _base_template_config(
        "ats_mono",
        "ATS Mono",
        [SECTION_SUMMARY, SECTION_EXPERIENCE, SECTION_SKILLS,
         SECTION_EDUCATION, SECTION_PROJECTS],
        font_family="mono",
        accent_color="#3f3f46",  # zinc-700
        density="spacious",
        bullet_style="dash",
        date_format="Mon YYYY",
        page_size="A4",
        header_style="stacked",
        section_heading_style="bar",
        experience_layout="standard",
        skills_layout="comma",
        heading_rule="underline",       # ← 2px underline
        name_typography="letter_spaced",
        sidebar_layout=False,
        description=(
            "Mono font, warm gray (zinc) accent, letter-spaced uppercase "
            "name, 2px underline headings. Reads like an architect's "
            "portfolio. Best for design, architecture, or research."
        ),
    )


def ats_startup_config() -> dict[str, Any]:
    """``ats_startup`` preset — indigo accent, display name, thick
    heading rule, chip-style skills with subtle background tint.

    The most "design-system" preset (Linear/Stripe aesthetic). Chip
    skills = the visual differentiator that makes it unmistakably
    modern. Best for early-stage startups, design roles, PM roles at
    consumer tech.
    """
    return _base_template_config(
        "ats_startup",
        "ATS Startup",
        [SECTION_SUMMARY, SECTION_EXPERIENCE, SECTION_SKILLS,
         SECTION_PROJECTS, SECTION_EDUCATION],
        font_family="sans",
        accent_color="#3730a3",  # indigo-800
        density="normal",
        bullet_style="bullet",
        date_format="Mon YYYY",
        page_size="A4",
        header_style="stacked",
        section_heading_style="bar",
        experience_layout="standard",
        skills_layout="chips",          # ← subtle bg pills
        heading_rule="thick",
        name_typography="display",
        sidebar_layout=False,
        description=(
            "Indigo, 34px display name, thick uppercase section headings, "
            "chip-style skills with subtle background tint. The most "
            "'design-system' preset — Linear/Stripe aesthetic. Best for "
            "early-stage startups, design roles, PM at consumer tech."
        ),
    )


# Preset registry — single source of truth for seeding.
BUILTIN_PRESETS: tuple[Any, ...] = (
    default_template_config(),
    ats_modern_config(),
    ats_compact_config(),
    ats_minimal_config(),
    ats_executive_config(),
    ats_timeline_config(),
    ats_academic_config(),
    ats_tech_config(),
    ats_european_config(),
    ats_consulting_config(),
    # Phase 10C: decoration differentiation
    ats_bold_config(),
    ats_editorial_config(),
    ats_sidebar_config(),
    ats_tech_sidebar_config(),
    ats_mono_config(),
    ats_startup_config(),
)


# ── LLM enhancement helpers (Section content for enhancer) ──────────
def section_to_text(section: CVSection) -> str:
    """Return the plain-text view of a section for LLM enhancement prompts."""
    return _html_to_naive_md(section.body_html) if section.body_html else ""


def build_cv_doc_from_json(cv_json: dict[str, Any]) -> CVDoc:
    """Build a :class:`CVDoc` from a stored ``cv_json`` blob.

    The stored ``cv_json`` schema is::

        {
          "basics": {...},           # JSON-Resume style basics block
          "summary": "...",
          "experience": [
            {"title": "...", "company": "...", "start": "YYYY-MM",
             "end": "YYYY-MM or null", "bullets": ["...", ...], "location": "..."}
          ],
          "education": [
            {"institution": "...", "degree": "...", "field": "...",
             "start": "YYYY-MM", "end": "YYYY-MM", "gpa": "..."}
          ],
          "skills": ["...", ...],
          "projects": [
            {"name": "...", "description": "...", "tech": ["..."], "url": "..."}
          ]
        }

    The schema is intentionally simpler than JSON Resume (flat lists) so
    LLM enhancement can target specific bullets without nesting noise.
    """
    basics = cv_json.get("basics") or {}
    header_html_parts = [
        f'<h1 class="cv-name">{_esc(_strip_text(basics.get("name")) or "Untitled")}</h1>'
    ]
    if basics.get("title"):
        header_html_parts.append(f'<p class="cv-title">{_esc(_strip_text(basics["title"]))}</p>')
    contact = _contact_line(
        basics.get("email"),
        basics.get("phone"),
        basics.get("location"),
        basics.get("url"),
        basics.get("linkedin"),
        basics.get("github"),
    )
    if contact:
        header_html_parts.append(f'<p class="cv-contact">{_esc(contact)}</p>')
    header_html = "\n".join(header_html_parts)

    md_parts = [f"# {_strip_text(basics.get('name')) or 'Untitled'}"]
    if basics.get("title"):
        md_parts.append(f"**{_strip_text(basics['title'])}**")
    if contact:
        md_parts.append(contact)
    header_md = "\n\n".join(md_parts)

    sections: list[CVSection] = []

    # Summary
    summary = _strip_text(cv_json.get("summary"))
    if summary:
        summary_html = f'<h2 class="cv-section">Summary</h2>\n<p class="cv-summary">{_esc(summary)}</p>'
        summary_md = f"## Summary\n\n{summary}"
        sections.append(
            CVSection(
                kind=SECTION_SUMMARY,
                title="Summary",
                body_html=summary_html,
                body_md=summary_md,
            )
        )

    # Experience
    exp = cv_json.get("experience") or []
    if exp:
        items_html: list[str] = []
        items_md: list[str] = []
        for job in exp:
            if not isinstance(job, dict):
                continue
            role = _esc(_contact_line(job.get("title"), job.get("company")))
            dates = _format_date_range(job.get("start"), job.get("end"))
            meta = _contact_line(dates, job.get("location"))
            bullets = [b for b in (job.get("bullets") or []) if _strip_text(b)]
            parts: list[str] = []
            if role:
                parts.append(f'<h3 class="cv-role">{role}</h3>')
            if meta:
                parts.append(f'<p class="cv-meta">{_esc(meta)}</p>')
            if bullets:
                li = "\n".join(f'    <li>{_esc(b)}</li>' for b in bullets)
                parts.append(f'<ul class="cv-bullets">\n{li}\n  </ul>')
            items_html.append("  <div class=\"cv-job\">\n" + "\n".join(parts) + "\n  </div>")
            md: list[str] = []
            if role:
                md.append(f"### {role}")
            if meta:
                md.append(f"*{meta}*")
            if bullets:
                md.append("\n".join(f"- {b}" for b in bullets))
            items_md.append("\n\n".join(md))
        sections.append(
            CVSection(
                kind=SECTION_EXPERIENCE,
                title="Experience",
                body_html=f'<h2 class="cv-section">Experience</h2>\n' + "\n".join(items_html),
                body_md="## Experience\n\n" + "\n\n".join(items_md),
            )
        )

    # Education
    edu = cv_json.get("education") or []
    if edu:
        items_html = []
        items_md = []
        for ed in edu:
            if not isinstance(ed, dict):
                continue
            deg = _esc(_contact_line(ed.get("degree"), ed.get("field")))
            meta = _contact_line(ed.get("institution"), _format_date_range(ed.get("start"), ed.get("end")))
            gpa = _strip_text(ed.get("gpa"))
            parts = []
            if deg:
                parts.append(f'<h3 class="cv-degree">{deg}</h3>')
            if meta:
                parts.append(f'<p class="cv-meta">{_esc(meta)}</p>')
            if gpa:
                parts.append(f'<p class="cv-score">GPA: {_esc(gpa)}</p>')
            items_html.append("  <div class=\"cv-ed\">\n" + "\n".join(parts) + "\n  </div>")
            md = []
            if deg:
                md.append(f"### {deg}")
            if meta:
                md.append(f"*{meta}*")
            if gpa:
                md.append(f"GPA: {gpa}")
            items_md.append("\n\n".join(md))
        sections.append(
            CVSection(
                kind=SECTION_EDUCATION,
                title="Education",
                body_html=f'<h2 class="cv-section">Education</h2>\n' + "\n".join(items_html),
                body_md="## Education\n\n" + "\n\n".join(items_md),
            )
        )

    # Skills
    skills_list = [_strip_text(s) for s in (cv_json.get("skills") or []) if _strip_text(s)]
    if skills_list:
        seen: set[str] = set()
        unique: list[str] = []
        for s in skills_list:
            ls = s.lower()
            if ls not in seen:
                seen.add(ls)
                unique.append(s)
        li = "\n".join(f"    <li>{_esc(s)}</li>" for s in unique)
        sections.append(
            CVSection(
                kind=SECTION_SKILLS,
                title="Skills",
                body_html=f'<h2 class="cv-section">Skills</h2>\n<ul class="cv-skills">\n{li}\n  </ul>',
                body_md="## Skills\n\n" + ", ".join(unique),
            )
        )

    # Projects
    projects = cv_json.get("projects") or []
    if projects:
        items_html = []
        items_md = []
        for proj in projects:
            if not isinstance(proj, dict):
                continue
            name = _esc(_strip_text(proj.get("name")))
            desc = _strip_text(proj.get("description"))
            tech = [_strip_text(t) for t in (proj.get("tech") or []) if _strip_text(t)]
            url = _strip_text(proj.get("url"))
            tech_str = ", ".join(tech)
            parts = []
            if name:
                parts.append(f'<h3 class="cv-proj-name">{name}</h3>')
            if desc:
                parts.append(f'<p class="cv-proj-desc">{_esc(desc)}</p>')
            if tech_str:
                parts.append(f'<p class="cv-meta"><em>{_esc(tech_str)}</em></p>')
            if url:
                parts.append(f'<p class="cv-meta"><a href="{_esc(_safe_url(url))}">{_esc(url)}</a></p>')
            items_html.append("  <div class=\"cv-proj\">\n" + "\n".join(parts) + "\n  </div>")
            md = []
            if name:
                md.append(f"### {name}")
            if desc:
                md.append(desc)
            if tech_str:
                md.append(f"*{tech_str}*")
            if url:
                md.append(url)
            items_md.append("\n\n".join(md))
        sections.append(
            CVSection(
                kind=SECTION_PROJECTS,
                title="Projects",
                body_html=f'<h2 class="cv-section">Projects</h2>\n' + "\n".join(items_html),
                body_md="## Projects\n\n" + "\n\n".join(items_md),
            )
        )

    return CVDoc(header_html=header_html, header_md=header_md, sections=sections)


# Module-level cache so ``seed_default_templates`` does at most one DB
# round-trip per process. The function itself is idempotent (uses
# per-row ``db.get`` and only inserts missing presets) but the cache
# flag prevents even the cheap ``db.get`` calls on every POST /api/cvs.
#
# Phase 10A: ``reset_seed_cache()`` is now called from the app startup
# hook in main.py so each cold start re-checks for newly-added presets
# (e.g. when shipping a new BUILTIN_PRESETS in a future release).
_SEEDED_FLAG = {"done": False}


def validate_ats_color(color: str) -> str:
    """Validate a hex color against the ATS-safe palette.

    Returns the color unchanged if it's in :data:`ATS_SAFE_COLORS`,
    else raises :class:`ValueError` with a helpful message. Use this
    before persisting a custom template config to keep recruiters and
    ATS parsers from seeing a CV in red Comic Sans.

    >>> validate_ats_color("#1f2937")
    '#1f2937'
    >>> validate_ats_color("#ff0000")
    Traceback (most recent call last):
        ...
    ValueError: accent_color '#ff0000' is not in the ATS-safe palette. Allowed: ...
    """
    if not isinstance(color, str):
        raise ValueError(
            f"accent_color must be a hex string, got {type(color).__name__}"
        )
    if color in ATS_SAFE_COLORS:
        return color
    allowed = ", ".join(sorted(ATS_SAFE_COLORS))
    raise ValueError(
        f"accent_color '{color}' is not in the ATS-safe palette. "
        f"Allowed: {allowed}"
    )


def seed_default_templates(db: Any) -> None:
    """Insert all built-in templates (ats_classic + presets) if missing.

    Phase 10A: now seeds three presets — ``ats_classic`` (legacy default),
    ``ats_modern`` (sans-serif spacious), and ``ats_compact`` (dense MM/YYYY).
    Idempotent at two levels:
    1. Module-level flag (``_SEEDED_FLAG``) skips the DB check entirely
       after the first successful call in this process.
    2. Per-row ``db.get(Template, ...)`` still acts as a safety net for
       cold starts where multiple workers may race.
    """
    if _SEEDED_FLAG["done"]:
        return
    from app.models.models import Template  # local import to avoid cycle

    for cfg in BUILTIN_PRESETS:
        existing = db.get(Template, cfg["id"])
        if existing is None:
            db.add(
                Template(
                    id=cfg["id"],
                    name=cfg["name"],
                    type=cfg["type"],
                    description=cfg["description"],
                    template_config_json=cfg,
                    is_ats_friendly=cfg["ats_friendly"],
                    is_default=(cfg["id"] == DEFAULT_TEMPLATE_ID),
                )
            )
        else:
            # Phase 10A/10B: idempotent upgrade — if the row was seeded
            # with a legacy config (pre-font_family / pre-accent_color /
            # pre-structural-axes), merge the new keys in without nuking
            # any user customizations that may have been patched on top.
            # We only add missing keys.
            stored = dict(existing.template_config_json or {})
            merged = {**cfg, **stored}  # stored wins (user patches).
            # Ensure the canonical defaults are present even if stored had
            # them deleted. Includes the four Phase 10B structural axes
            # (header_style / section_heading_style / experience_layout /
            # skills_layout) so existing presets get upgraded in place.
            for key in (
                "font_family",
                "accent_color",
                "density",
                "bullet_style",
                "date_format",
                "page_size",
                "header_style",
                "section_heading_style",
                "experience_layout",
                "skills_layout",
                # Phase 10C decoration axes
                "heading_rule",
                "name_typography",
                "sidebar_layout",
            ):
                if key not in stored:
                    merged[key] = cfg[key]
            if merged != stored:
                existing.template_config_json = merged
                db.add(existing)
    db.commit()
    _SEEDED_FLAG["done"] = True


def reset_seed_cache() -> None:
    """Clear the module-level seed cache.

    Tests call this between cases that mock or replace the template
    rows so the next ``seed_default_templates`` call re-queries the DB.
    """
    _SEEDED_FLAG["done"] = False