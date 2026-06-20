"""Phase 10A — Renderer honors template_config keys.

Validates that the deterministic renderer consumes the new fields
(font_family, accent_color, density, date_format) and that the ATS-safe
color validator + preset registry behave correctly.
"""
import pytest

from app.services.cv_renderer import (
    ATS_SAFE_COLORS,
    BUILTIN_PRESETS,
    FONT_FAMILY_OPTIONS,
    DENSITY_OPTIONS,
    DATE_FORMAT_OPTIONS,
    PAGE_SIZE_OPTIONS,
    ats_compact_config,
    ats_modern_config,
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
    assert cfg["density"] in DENSITY_OPTIONS


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