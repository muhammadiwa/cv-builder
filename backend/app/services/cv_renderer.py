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


def _format_date_range(start: Any, end: Any) -> str:
    """Format a date range like ``Mar 2021 – Present`` (en dash).

    Accepts JSON Resume style ``YYYY-MM`` or full ISO dates. Returns
    empty string if both are missing. ``endDate == None`` (JSON Resume's
    convention for current job) renders as "Present".
    """
    s = _strip_text(start)
    e_raw = end
    e = _strip_text(e_raw) if e_raw is not None else ""

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
def _render_header(profile: dict[str, Any]) -> tuple[str, str]:
    """Render the header block (name + title + contact line)."""
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

    # HTML
    html_parts = [f'<h1 class="cv-name">{_esc(name)}</h1>']
    if title:
        html_parts.append(f'<p class="cv-title">{_esc(title)}</p>')
    if contact:
        html_parts.append(f'<p class="cv-contact">{_esc(contact)}</p>')
    header_html = "\n".join(html_parts)

    # Markdown
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


def _render_experience(work: list[dict[str, Any]]) -> CVSection:
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
        dates = _format_date_range(job.get("startDate"), job.get("endDate"))
        highlights = [h for h in (job.get("highlights") or []) if _strip_text(h)]

        # Build role line: "Senior Backend Engineer — Bukalapak"
        role_bits: list[str] = []
        if position:
            role_bits.append(_esc(position))
        if company:
            role_bits.append(_esc(company))
        role_line = " — ".join(role_bits)

        meta_line = _contact_line(dates, location)

        # HTML
        item_html_parts: list[str] = []
        if role_line:
            item_html_parts.append(f'<h3 class="cv-role">{role_line}</h3>')
        if meta_line:
            item_html_parts.append(f'<p class="cv-meta">{_esc(meta_line)}</p>')
        if highlights:
            li_html = "\n".join(f"    <li>{_esc(h)}</li>" for h in highlights)
            item_html_parts.append(f"<ul class=\"cv-bullets\">\n{li_html}\n  </ul>")
        items_html.append("  <div class=\"cv-job\">\n" + "\n".join(item_html_parts) + "\n  </div>")

        # Markdown
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


def _render_education(education: list[dict[str, Any]]) -> CVSection:
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
        dates = _format_date_range(ed.get("startDate"), ed.get("endDate"))

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


def _render_skills(skills: list[Any]) -> CVSection:
    # Flatten JSON Resume skills shape: [{"name": "Backend", "keywords": [...]}]
    # Also accept a flat list of strings.
    keywords: list[str] = []
    if not skills:
        return CVSection(kind=SECTION_SKILLS, title="Skills", body_html="", body_md="")
    for entry in skills:
        if isinstance(entry, str):
            kw = _strip_text(entry)
            if kw:
                keywords.append(kw)
        elif isinstance(entry, dict):
            kw_list = entry.get("keywords") or []
            for kw in kw_list:
                s = _strip_text(kw)
                if s:
                    keywords.append(s)
            # Also include the category name itself if no keywords
            name = _strip_text(entry.get("name"))
            if name and not kw_list:
                keywords.append(name)
    # Dedupe while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for k in keywords:
        lk = k.lower()
        if lk not in seen:
            seen.add(lk)
            unique.append(k)
    if not unique:
        return CVSection(kind=SECTION_SKILLS, title="Skills", body_html="", body_md="")
    li_html = "\n".join(f"    <li>{_esc(k)}</li>" for k in unique)
    body_html = f'<ul class="cv-skills">\n{li_html}\n  </ul>'
    body_md = ", ".join(unique)
    return CVSection(kind=SECTION_SKILLS, title="Skills", body_html=body_html, body_md=body_md)


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
            parts.append(f'<p class="cv-meta"><a href="{_esc(url)}">{_esc(url)}</a></p>')
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
    header_html, header_md = _render_header(p)

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

    work = p.get("work") or p.get("experiences") or []
    education = p.get("education") or []
    skills = p.get("skills") or []
    projects = p.get("projects") or []

    section_renderers = {
        SECTION_SUMMARY: lambda: _render_summary(p),
        SECTION_EXPERIENCE: lambda: _render_experience(work),
        SECTION_EDUCATION: lambda: _render_education(education),
        SECTION_SKILLS: lambda: _render_skills(skills),
        SECTION_PROJECTS: lambda: _render_projects(projects),
    }

    rendered: list[CVSection] = []
    for kind in valid_order:
        sec = section_renderers[kind]()
        if sec.body_html:
            # Wrap with an <h2> heading
            sec.body_html = f'<h2 class="cv-section">{_esc(sec.title)}</h2>\n' + sec.body_html
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
    return _wrap_html(body, profile, scope_id)


def _wrap_html(
    body: str,
    profile: Any,
    scope_id: str | None = None,
) -> str:
    """Wrap the rendered body in a complete HTML document.

    ``scope_id`` namespaces all CSS selectors with ``.cv-{scope_id}`` so
    multiple CVs in the same parent document don't fight over class
    styles. When ``None`` the CSS is unscoped (default — preserves the
    original public output for tests, exports, and PDF/DOCX generation).
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

    style = (
        "<style>\n"
        f"  {prefix} body {{ font-family: Arial, Helvetica, sans-serif; color: #111; "
        "max-width: 780px; margin: 24px auto; padding: 0 16px; line-height: 1.45; }\n"
        f"  {prefix} .cv-name {{ font-size: 28px; margin: 0 0 4px; }}\n"
        f"  {prefix} .cv-title {{ margin: 0 0 8px; color: #333; font-weight: 600; }}\n"
        f"  {prefix} .cv-contact {{ margin: 0 0 16px; color: #444; font-size: 14px; }}\n"
        f"  {prefix} h2 {{ font-size: 16px; margin: 18px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 2px; }}\n"
        f"  {prefix} .cv-role, {prefix} .cv-degree, {prefix} .cv-proj-name {{ font-size: 15px; margin: 8px 0 2px; }}\n"
        f"  {prefix} .cv-meta {{ margin: 0 0 4px; color: #555; font-size: 13px; }}\n"
        f"  {prefix} .cv-bullets {{ margin: 4px 0 8px; padding-left: 20px; }}\n"
        f"  {prefix} .cv-bullets li {{ margin: 2px 0; }}\n"
        f"  {prefix} .cv-summary {{ margin: 0 0 8px; }}\n"
        f"  {prefix} .cv-skills {{ margin: 4px 0 8px; padding-left: 20px; }}\n"
        f"  {prefix} .cv-score {{ margin: 0 0 6px; font-size: 13px; color: #555; }}\n"
        "</style>\n"
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
def default_template_config() -> dict[str, Any]:
    """Return the default ``ats_classic`` template config."""
    return {
        "id": DEFAULT_TEMPLATE_ID,
        "name": "ATS Classic",
        "type": "cv",
        "sections": list(ALL_SECTIONS),
        "ats_friendly": True,
        "description": (
            "Single-column, semantic HTML with plain bullets. No tables for "
            "layout, no images in body, system fonts only. Optimized for "
            "ATS keyword extraction (Workday, Greenhouse, Lever, iCIMS)."
        ),
    }


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
                parts.append(f'<p class="cv-meta"><a href="{_esc(url)}">{_esc(url)}</a></p>')
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
# ``db.get`` and only inserts when missing) but doing the check on every
# POST /api/cvs is wasteful when nothing has changed.
_SEEDED_FLAG = {"done": False}


def seed_default_templates(db: Any) -> None:
    """Insert the ats_classic template if missing.

    Idempotent at two levels:
    1. Module-level flag (``_SEEDED_FLAG``) skips the DB check entirely
       after the first successful call in this process.
    2. ``db.get(Template, ...)`` still acts as a safety net for cold
       starts where multiple workers may race.
    """
    if _SEEDED_FLAG["done"]:
        return
    from app.models.models import Template  # local import to avoid cycle

    existing = db.get(Template, DEFAULT_TEMPLATE_ID)
    cfg = default_template_config()
    if existing is None:
        db.add(
            Template(
                id=cfg["id"],
                name=cfg["name"],
                type=cfg["type"],
                description=cfg["description"],
                template_config_json=cfg,
                is_ats_friendly=cfg["ats_friendly"],
                is_default=True,
            )
        )
        db.commit()
    _SEEDED_FLAG["done"] = True


def reset_seed_cache() -> None:
    """Clear the module-level seed cache.

    Tests call this between cases that mock or replace the template
    rows so the next ``seed_default_templates`` call re-queries the DB.
    """
    _SEEDED_FLAG["done"] = False