"""Phase 10A — Renderer honors template_config keys.

Validates that the deterministic renderer consumes the new fields
(font_family, accent_color, density, date_format) and that the ATS-safe
color validator + preset registry behave correctly.

Phase 10B — Extends coverage to the four structural axes
(header_style / section_heading_style / experience_layout /
skills_layout) and the six new presets (Minimal / Executive /
Timeline / Academic / Tech / European / Consulting).
"""
import pytest

from app.services.cv_renderer import (
    ATS_SAFE_COLORS,
    BUILTIN_PRESETS,
    FONT_FAMILY_OPTIONS,
    DENSITY_OPTIONS,
    DATE_FORMAT_OPTIONS,
    PAGE_SIZE_OPTIONS,
    HEADER_STYLE_OPTIONS,
    SECTION_HEADING_OPTIONS,
    EXPERIENCE_LAYOUT_OPTIONS,
    SKILLS_LAYOUT_OPTIONS,
    ats_compact_config,
    ats_modern_config,
    ats_minimal_config,
    ats_executive_config,
    ats_timeline_config,
    ats_academic_config,
    ats_tech_config,
    ats_european_config,
    ats_consulting_config,
    default_template_config,
    render_html_document,
    validate_ats_color,
    _format_date_range,
    _base_template_config,
)


SAMPLE_PROFILE = {
    "basics": {
        "name": "Jane Doe",
        "label": "Senior Engineer",
        "email": "jane@example.com",
        "location": "Jakarta, Indonesia",
    },
    "summary": "Backend engineer with 8 years of experience.",
    "work": [
        {
            "name": "Acme Corp",
            "position": "Senior Engineer",
            "startDate": "2021-03",
            "endDate": None,  # current job
            "highlights": ["Built payment service", "Reduced latency 40%"],
        },
        {
            "name": "OldCo",
            "position": "Engineer",
            "startDate": "2018-06",
            "endDate": "2021-02",
            "highlights": ["Maintained legacy API"],
        },
    ],
    "education": [
        {
            "institution": "ITB",
            "studyType": "Bachelor",
            "area": "Computer Science",
            "startDate": "2014-09",
            "endDate": "2018-07",
        }
    ],
    "skills": ["Python", "Go", "Kubernetes"],
    "projects": [],
}


# ── Constants ───────────────────────────────────────────────────────
def test_font_family_options_is_three_safe_values():
    assert FONT_FAMILY_OPTIONS == ("serif", "sans", "mono")
    # No webfonts — ATS extractors may fail to load them.
    assert all(isinstance(v, str) and len(v) < 20 for v in FONT_FAMILY_OPTIONS)


def test_density_options_is_three_safe_values():
    assert DENSITY_OPTIONS == ("compact", "normal", "spacious")


def test_date_format_options_covers_ats_us_eu():
    assert DATE_FORMAT_OPTIONS == ("Mon YYYY", "MM/YYYY", "YYYY")


def test_page_size_options_is_a4_and_letter():
    assert PAGE_SIZE_OPTIONS == ("A4", "Letter")


def test_ats_safe_colors_are_dark_grays_only():
    # Every color must be a 7-char hex AND visually dark (R, G, B all < 128).
    import re
    pattern = re.compile(r"^#[0-9a-f]{6}$")
    for c in ATS_SAFE_COLORS:
        assert pattern.match(c), f"{c} is not a valid hex"
        r, g, b = int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)
        assert max(r, g, b) < 128, f"{c} too bright for ATS"


# ── validate_ats_color ──────────────────────────────────────────────
def test_validate_ats_color_accepts_palette_member():
    assert validate_ats_color("#1f2937") == "#1f2937"


def test_validate_ats_color_rejects_red():
    with pytest.raises(ValueError, match="not in the ATS-safe palette"):
        validate_ats_color("#ff0000")


def test_validate_ats_color_rejects_non_string():
    with pytest.raises(ValueError, match="must be a hex string"):
        validate_ats_color(12345)  # type: ignore[arg-type]


def test_validate_ats_color_error_lists_allowed():
    with pytest.raises(ValueError) as exc_info:
        validate_ats_color("#abcdef")
    msg = str(exc_info.value)
    # All allowed colors should be in the error for the user to pick.
    for c in ATS_SAFE_COLORS:
        assert c in msg, f"allowed color {c} missing from error message"


# ── Preset registry ────────────────────────────────────────────────
def test_default_template_has_all_required_keys():
    cfg = default_template_config()
    for key in ("id", "name", "type", "sections", "font_family",
                "accent_color", "density", "bullet_style",
                "date_format", "page_size", "ats_friendly", "description"):
        assert key in cfg, f"missing key: {key}"
    assert cfg["id"] == "ats_classic"
    assert cfg["type"] == "cv"
    assert cfg["ats_friendly"] is True


def test_ats_modern_is_spacious_and_sans():
    cfg = ats_modern_config()
    assert cfg["id"] == "ats_modern"
    assert cfg["density"] == "spacious"
    assert cfg["font_family"] == "sans"
    assert cfg["accent_color"] in ATS_SAFE_COLORS
    # Skills before projects — modern puts keyword-rich block up front
    assert cfg["sections"].index("skills") < cfg["sections"].index("projects")


def test_ats_compact_is_dense_with_us_date_format():
    cfg = ats_compact_config()
    assert cfg["id"] == "ats_compact"
    assert cfg["density"] == "compact"
    assert cfg["date_format"] == "MM/YYYY"
    assert cfg["page_size"] == "Letter"


def test_builtin_presets_all_have_safe_colors():
    """Defense in depth: presets themselves can't ship a banned color."""
    for cfg in BUILTIN_PRESETS:
        assert cfg["accent_color"] in ATS_SAFE_COLORS, (
            f"preset {cfg['id']} uses unsafe color {cfg['accent_color']}"
        )


def test_builtin_presets_have_distinct_ids():
    ids = [p["id"] for p in BUILTIN_PRESETS]
    assert len(ids) == len(set(ids)), "duplicate preset id"


def test_base_template_helper_defaults_match_at_safety():
    """``_base_template_config`` defaults should be ATS-safe by default."""
    cfg = _base_template_config("custom_test", "Custom", ["summary"])
    assert cfg["accent_color"] in ATS_SAFE_COLORS
    assert cfg["font_family"] in FONT_FAMILY_OPTIONS


# ── Phase 10B: structural axes tests ────────────────────────────────


def test_all_presets_have_structural_axes():
    """Every built-in preset must include the 4 Phase 10B structural axes
    so the FE can render thumbnails and live previews without fallbacks.
    """
    for cfg in BUILTIN_PRESETS:
        for key in (
            "header_style",
            "section_heading_style",
            "experience_layout",
            "skills_layout",
        ):
            assert key in cfg, f"{cfg['id']} missing {key}"
            assert cfg[key] in {
                "header_style": HEADER_STYLE_OPTIONS,
                "section_heading_style": SECTION_HEADING_OPTIONS,
                "experience_layout": EXPERIENCE_LAYOUT_OPTIONS,
                "skills_layout": SKILLS_LAYOUT_OPTIONS,
            }[key], f"{cfg['id']}.{key}={cfg[key]!r} not in valid options"


def test_base_template_helper_includes_structural_defaults():
    """Legacy ``_base_template_config`` (no structural args) must default
    to the original ats_classic-style layout so old callers keep getting
    identical output.
    """
    cfg = _base_template_config("custom_test", "Custom", ["summary"])
    assert cfg["header_style"] == "stacked"
    assert cfg["section_heading_style"] == "bar"
    assert cfg["experience_layout"] == "standard"
    assert cfg["skills_layout"] == "comma"


def test_ats_minimal_uses_inline_header_plain_headings_pipe_skills():
    """The Minimal preset's whole identity is structural differentiation
    on the four axes — make sure it actually uses them.
    """
    cfg = ats_minimal_config()
    assert cfg["id"] == "ats_minimal"
    assert cfg["header_style"] == "inline"
    assert cfg["section_heading_style"] == "plain"
    assert cfg["skills_layout"] == "pipe"


def test_ats_executive_uses_banner_header_dates_right():
    cfg = ats_executive_config()
    assert cfg["id"] == "ats_executive"
    assert cfg["header_style"] == "banner"
    assert cfg["experience_layout"] == "dates_right"


def test_ats_timeline_uses_numbered_sections_inline_dates():
    cfg = ats_timeline_config()
    assert cfg["id"] == "ats_timeline"
    assert cfg["section_heading_style"] == "numbered"
    assert cfg["experience_layout"] == "inline_dates"


def test_ats_academic_uses_yyyy_dates_pipe_skills():
    cfg = ats_academic_config()
    assert cfg["id"] == "ats_academic"
    assert cfg["date_format"] == "YYYY"
    assert cfg["skills_layout"] == "pipe"


def test_ats_tech_uses_categorized_skills():
    cfg = ats_tech_config()
    assert cfg["id"] == "ats_tech"
    assert cfg["skills_layout"] == "categorized"


def test_ats_european_uses_pills_skills_inline_header():
    cfg = ats_european_config()
    assert cfg["id"] == "ats_european"
    assert cfg["skills_layout"] == "pills"
    assert cfg["header_style"] == "inline"


def test_ats_consulting_uses_dates_right_compact():
    cfg = ats_consulting_config()
    assert cfg["id"] == "ats_consulting"
    assert cfg["experience_layout"] == "dates_right"
    assert cfg["density"] == "compact"


def test_builtin_presets_count():
    """We ship exactly 10 built-in presets (3 legacy + 7 new). Adding
    more is fine but the count must be deliberate so the FE picker
    layout knows what to expect.
    """
    assert len(BUILTIN_PRESETS) == 10
    ids = [p["id"] for p in BUILTIN_PRESETS]
    assert "ats_classic" in ids
    assert "ats_modern" in ids
    assert "ats_compact" in ids
    assert "ats_minimal" in ids
    assert "ats_executive" in ids
    assert "ats_timeline" in ids
    assert "ats_academic" in ids
    assert "ats_tech" in ids
    assert "ats_european" in ids
    assert "ats_consulting" in ids


def test_render_inline_header_emits_flex_row():
    """``header_style=inline`` should put name + title on the same flex
    row (vs. stacked which is separate lines).
    """
    profile = {
        "basics": {"name": "Test User", "label": "Engineer", "email": "t@x.com"},
        "work": [], "education": [], "skills": [], "projects": [],
    }
    cfg = {"header_style": "inline"}
    html = render_html_document(profile, template_config=cfg)
    assert 'class="cv-header-inline"' in html
    assert 'class="cv-title-inline"' in html


def test_render_numbered_sections_use_two_digit_prefix():
    """``section_heading_style=numbered`` should emit ``01 · Title``."""
    profile = {
        "basics": {"name": "Test User", "email": "t@x.com"},
        "summary": "summary text",
        "work": [], "education": [], "skills": [], "projects": [],
    }
    cfg = {"section_heading_style": "numbered"}
    html = render_html_document(profile, template_config=cfg)
    assert "01" in html
    assert "cv-section-num" in html


def test_render_dates_right_experience_has_flex_row():
    """``experience_layout=dates_right`` should emit a ``.cv-job-row``
    container per job so CSS can flex-align role + dates.
    """
    profile = {
        "basics": {"name": "Test User"},
        "work": [
            {
                "name": "Acme",
                "position": "Engineer",
                "startDate": "2021-01",
                "endDate": None,
                "highlights": ["did things"],
            }
        ],
        "education": [], "skills": [], "projects": [],
    }
    cfg = {"experience_layout": "dates_right"}
    html = render_html_document(profile, template_config=cfg)
    assert "cv-job-row" in html
    assert "cv-dates-right" in html


def test_render_pipe_skills_emits_pipe_separator():
    """``skills_layout=pipe`` should emit ``Skill | Skill | Skill``."""
    profile = {
        "basics": {"name": "Test User"},
        "work": [], "education": [],
        "skills": ["Python", "Go", "Rust"], "projects": [],
    }
    cfg = {"skills_layout": "pipe"}
    html = render_html_document(profile, template_config=cfg)
    assert "cv-skills-pipe" in html
    assert "Python | Go | Rust" in html


def test_render_unknown_axis_values_fall_back_safely():
    """Malformed config (unknown axis values) must fall back to defaults
    rather than crash or emit broken HTML.
    """
    profile = {
        "basics": {"name": "Test User", "email": "t@x.com"},
        "work": [], "education": [], "skills": ["Python"], "projects": [],
    }
    cfg = {
        "header_style": "rocket",
        "section_heading_style": "neon",
        "experience_layout": "zigzag",
        "skills_layout": "sparkles",
    }
    html = render_html_document(profile, template_config=cfg)
    # Should render cleanly without the unknown value being honoured.
    assert "cv-name" in html
    assert "cv-skills" in html  # default comma layout


def test_render_legacy_config_still_produces_original_output():
    """A config dict with only the original Phase 10A keys should render
    byte-equivalent to a config with no structural keys at all
    (backward compatibility gate).
    """
    profile = {
        "basics": {"name": "Legacy User", "email": "l@x.com"},
        "summary": "Senior engineer.",
        "work": [
            {
                "name": "OldCo",
                "position": "Engineer",
                "startDate": "2018-01",
                "endDate": "2021-01",
                "highlights": ["legacy bullet"],
            }
        ],
        "education": [], "skills": ["Python"], "projects": [],
    }
    cfg_old = {"font_family": "serif", "accent_color": "#1f2937", "density": "normal"}
    html_old = render_html_document(profile, template_config=cfg_old)
    # All four structural axes should default to their ats_classic
    # values when absent.
    assert 'class="cv-section"' in html_old  # bar default
    assert 'class="cv-name"' in html_old    # stacked default
    assert 'class="cv-role"' in html_old    # standard default
    assert 'class="cv-skills"' in html_old  # comma default


# ── _format_date_range ─────────────────────────────────────────────
def test_format_date_range_default_is_mon_yyyy():
    assert _format_date_range("2021-03", None) == "Mar 2021 – Present"
    assert _format_date_range("2021-03", "2021-08") == "Mar 2021 – Aug 2021"


def test_format_date_range_mm_yyyy():
    assert _format_date_range("2021-03", None, "MM/YYYY") == "03/2021 – Present"
    assert _format_date_range("2018-06", "2021-02", "MM/YYYY") == "06/2018 – 02/2021"


def test_format_date_range_yyyy_only():
    assert _format_date_range("2021-03", None, "YYYY") == "2021 – Present"


def test_format_date_range_unknown_format_falls_back():
    """Malformed config silently falls back to default — never crashes."""
    assert _format_date_range("2021-03", None, "garbage") == "Mar 2021 – Present"


def test_format_date_range_empty_returns_empty():
    assert _format_date_range("", "") == ""


# ── render_html_document consumes config ────────────────────────────
def test_renderer_includes_font_family_in_style():
    html = render_html_document(SAMPLE_PROFILE, {"font_family": "serif"})
    assert "Georgia" in html, "serif font stack should include Georgia"


def test_renderer_includes_accent_color_in_style():
    html = render_html_document(
        SAMPLE_PROFILE, {"accent_color": "#0f172a"}
    )
    assert "#0f172a" in html, "accent color must appear in <style>"


def test_renderer_includes_density_line_height():
    html_compact = render_html_document(SAMPLE_PROFILE, {"density": "compact"})
    html_spacious = render_html_document(SAMPLE_PROFILE, {"density": "spacious"})
    assert "1.25" in html_compact, "compact density should have line-height 1.25"
    assert "1.6" in html_spacious, "spacious density should have line-height 1.6"


def test_renderer_rejects_unsafe_color_silently_falls_back():
    """Unknown accent_color must NOT crash — it should fall back to default."""
    html = render_html_document(
        SAMPLE_PROFILE, {"accent_color": "#ff0000"}
    )
    assert "#ff0000" not in html, "unsafe color must not appear in output"
    assert "#111111" in html, "should fall back to safe default"


def test_renderer_honors_date_format_in_experience():
    cfg = {
        "sections": ["summary", "experience"],
        "date_format": "MM/YYYY",
    }
    html = render_html_document(SAMPLE_PROFILE, cfg)
    assert "03/2021" in html, "MM/YYYY format should appear in experience"
    assert "Mar 2021" not in html, "Mon YYYY should NOT also appear"


def test_renderer_honors_date_format_in_education():
    cfg = {
        "sections": ["education"],
        "date_format": "YYYY",
    }
    html = render_html_document(SAMPLE_PROFILE, cfg)
    assert "2014" in html
    assert "Sep 2014" not in html, "Mon YYYY should not leak through"


def test_renderer_honors_section_order():
    cfg = {
        "sections": ["skills", "experience", "summary"],
    }
    html = render_html_document(SAMPLE_PROFILE, cfg)
    # Use the section <h2> headings, not class names — class names appear
    # in the <style> block too which would skew positions.
    skills_pos = html.find("<h2 class=\"cv-section\">Skills</h2>")
    experience_pos = html.find("<h2 class=\"cv-section\">Experience</h2>")
    summary_pos = html.find("<h2 class=\"cv-section\">Summary</h2>")
    assert skills_pos > 0 and experience_pos > 0 and summary_pos > 0, (
        "all three sections should render with <h2> headings"
    )
    assert skills_pos < experience_pos < summary_pos, (
        f"section order from config should be respected: "
        f"skills={skills_pos} experience={experience_pos} summary={summary_pos}"
    )


def test_renderer_omits_invalid_section():
    """Unknown sections are silently dropped (Phase 6 behavior, unchanged)."""
    cfg = {"sections": ["summary", "INVALID_FAKE_SECTION", "experience"]}
    html = render_html_document(SAMPLE_PROFILE, cfg)
    assert "INVALID_FAKE_SECTION" not in html


def test_renderer_omits_duplicate_sections():
    cfg = {"sections": ["summary", "summary", "experience"]}
    html = render_html_document(SAMPLE_PROFILE, cfg)
    # "Summary" appears once for the section heading.
    assert html.count("<h2 class=\"cv-section\">Summary</h2>") == 1


def test_renderer_is_deterministic_with_same_config():
    """Same input + same config => byte-identical output."""
    cfg = {"font_family": "sans", "accent_color": "#1f2937", "density": "normal"}
    html1 = render_html_document(SAMPLE_PROFILE, cfg)
    html2 = render_html_document(SAMPLE_PROFILE, cfg)
    assert html1 == html2


def test_renderer_full_at_s_modern_preset_renders():
    """End-to-end smoke: a preset config produces valid HTML."""
    cfg = ats_modern_config()
    html = render_html_document(SAMPLE_PROFILE, cfg)
    assert "<!DOCTYPE html>" in html
    assert "Jane Doe" in html
    assert "Acme Corp" in html
    # ATS-modern accent should appear
    assert cfg["accent_color"] in html


# ── _safe_url (H1 fix) ────────────────────────────────────────────
def test_safe_url_accepts_http_https_mailto():
    from app.services.cv_renderer import _safe_url
    assert _safe_url("https://example.com") == "https://example.com"
    assert _safe_url("http://example.com") == "http://example.com"
    assert _safe_url("mailto:a@b.com") == "mailto:a@b.com"


def test_safe_url_rejects_javascript_scheme():
    """H1 fix: javascript: URLs must be stripped before rendering."""
    from app.services.cv_renderer import _safe_url
    assert _safe_url("javascript:alert(1)") == ""
    assert _safe_url("JavaScript:alert(1)") == ""
    assert _safe_url("JAVASCRIPT:alert(1)") == ""


def test_safe_url_rejects_other_dangerous_schemes():
    from app.services.cv_renderer import _safe_url
    for bad in [
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
        "file:///etc/passwd",
        "ftp://evil.example.com",
        "blob:http://x/123",
    ]:
        assert _safe_url(bad) == "", f"should reject {bad!r}"


def test_safe_url_rejects_empty_and_none():
    from app.services.cv_renderer import _safe_url
    assert _safe_url("") == ""
    assert _safe_url(None) == ""
    assert _safe_url("   ") == ""


def test_safe_url_rejects_relative_urls():
    from app.services.cv_renderer import _safe_url
    assert _safe_url("/path/to/page") == ""
    assert _safe_url("just-a-string") == ""


def test_safe_url_preserves_query_and_fragment():
    from app.services.cv_renderer import _safe_url
    assert (
        _safe_url("https://example.com/page?q=1&r=2#anchor")
        == "https://example.com/page?q=1&r=2#anchor"
    )


def test_renderer_strips_javascript_href():
    """H1 fix: end-to-end — render profile with malicious URL, verify
    the href is empty (link text remains visible but harmless)."""
    profile = {
        "basics": {"name": "Mallory", "email": "m@x.com"},
        "projects": [
            {
                "name": "Pwn",
                "description": "Project",
                "keywords": [],
                "url": "javascript:alert(1)",
            }
        ],
        "work": [],
        "education": [],
        "skills": [],
    }
    html = render_html_document(profile)
    # No href="javascript:..." should survive rendering.
    assert 'href="javascript:' not in html.lower()
    # The link text is still rendered (so user sees the project),
    # but with empty href — safe.
    assert 'href=""' in html
    # Sanity: project name still visible.
    assert "Pwn" in html