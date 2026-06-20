"""Phase 8 — CV PDF export tests.

Verifies:
- PDF generation produces valid bytes (%PDF magic + reasonable size)
- PDF is ATS-safe (no body images, single-column, semantic markup)
- PDF text is selectable/extractable (not rasterized)
- Service handles malformed HTML gracefully (no crash)
- Multiple pages are produced for long CVs
"""
from __future__ import annotations

import re

import pytest

from app.services.cv_exporter import (
    ATS_PRINT_CSS,
    export_cv_to_pdf,
    pdf_metadata,
)


# ── Minimal realistic CV HTML ───────────────────────────────────────
SHORT_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Test CV</title>
<style>
body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
h1 { font-size: 24px; margin-bottom: 8px; }
h2 { font-size: 16px; margin-top: 16px; border-bottom: 1px solid #ccc; }
ul { padding-left: 20px; }
</style>
</head>
<body>
<h1>Jane Doe</h1>
<p>Backend Engineer · jane@example.com</p>
<h2>Experience</h2>
<ul>
<li>Built Python APIs serving 10k req/sec</li>
<li>Cut latency by 30% via PostgreSQL indexing</li>
</ul>
<h2>Skills</h2>
<ul>
<li>Python, Django, PostgreSQL, Docker, Kubernetes</li>
</ul>
</body>
</html>"""


# A long CV that should overflow to multiple pages
def _long_html() -> str:
    bullets = "".join(
        f"<li>Role {i} bullet — built feature Y, shipped Z, reduced W by 30%</li>"
        for i in range(60)
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Long CV</title></head>
<body>
<h1>Long Name Person</h1>
<p>Many things</p>
<h2>Experience</h2>
<ul>{bullets}</ul>
</body>
</html>"""


# An HTML doc that intentionally has a body <img> to verify our ATS
# CSS strips it (even though the renderer never emits one).
HTML_WITH_IMG = SHORT_HTML.replace(
    "</body>", '<img src="photo.jpg" alt="me">' + "</body>"
)


# ── pdf_metadata ────────────────────────────────────────────────────
class TestPdfMetadata:
    def test_valid_pdf(self):
        pdf = export_cv_to_pdf(SHORT_HTML)
        meta = pdf_metadata(pdf)
        assert meta["is_valid"] is True
        assert meta["magic"].startswith("%PDF-")
        assert meta["size"] == len(pdf)
        assert meta["size"] > 1000  # not empty

    def test_invalid_pdf(self):
        meta = pdf_metadata(b"not a pdf")
        assert meta["is_valid"] is False
        assert meta["magic"] == ""
        assert meta["page_count"] == 0

    def test_empty_pdf(self):
        meta = pdf_metadata(b"")
        assert meta["is_valid"] is False


# ── export_cv_to_pdf basic ──────────────────────────────────────────
class TestExportBasics:
    def test_produces_valid_pdf(self):
        pdf = export_cv_to_pdf(SHORT_HTML)
        assert pdf.startswith(b"%PDF-")
        # PDF trailer must end with %%EOF
        assert pdf.rstrip().endswith(b"%%EOF")

    def test_size_is_reasonable(self):
        pdf = export_cv_to_pdf(SHORT_HTML)
        # A one-page CV is typically 5-30 KB. Loose upper bound to
        # catch "the PDF is empty" bugs (would be < 1KB).
        assert 1_000 < len(pdf) < 200_000

    def test_no_images_in_body(self):
        # The ATS print CSS forces any stray <img> to display:none.
        # We can't trivially assert on the rendered PDF's display
        # state, but we CAN verify the print CSS contains the rule
        # (defense-in-depth — if someone removes it, this test fails).
        assert "img" in ATS_PRINT_CSS
        assert "display: none" in ATS_PRINT_CSS
        assert "background-image: none" in ATS_PRINT_CSS

    def test_long_cv_produces_multiple_pages(self):
        pdf = export_cv_to_pdf(_long_html())
        meta = pdf_metadata(pdf)
        assert meta["page_count"] >= 2, (
            f"long CV should span 2+ pages, got {meta['page_count']}"
        )


# ── ATS-safety structural checks ──────────────────────────────────
class TestAtsSafetyStructure:
    """The PDF must preserve the semantic structure of the input HTML
    so an ATS parser can extract: name, sections, bullets, contact.
    """

    def test_print_css_forces_single_column(self):
        assert "column-count: 1" in ATS_PRINT_CSS
        assert "float: none" in ATS_PRINT_CSS

    def test_print_css_disables_backgrounds(self):
        assert "background-image: none" in ATS_PRINT_CSS

    def test_print_css_has_page_rules(self):
        # The @page rule is what tells WeasyPrint how to paginate.
        # We test the formatted version because the unformatted template
        # uses escaped braces (`{{` / `}}`) which confuse naive regexes.
        formatted = ATS_PRINT_CSS.format(
            page_size="A4",
            margin_top="18mm",
            margin_right="16mm",
            margin_bottom="18mm",
            margin_left="16mm",
        )
        assert re.search(r"@page\s*\{[^}]*size\s*:", formatted)
        assert re.search(r"@page\s*\{[^}]*margin\s*:", formatted)

    def test_print_css_avoids_breaking_bullets(self):
        # `page-break-inside: avoid` for ul/li is the whole point of
        # the ATS-friendly pagination. If someone removes it, big
        # bullets get split across pages which ATS parsers sometimes
        # lose track of.
        assert "page-break-inside: avoid" in ATS_PRINT_CSS
        assert "break-inside: avoid-page" in ATS_PRINT_CSS


# ── Edge cases ─────────────────────────────────────────────────────
class TestExportEdgeCases:
    def test_missing_head_injection_falls_back(self):
        """If the input has no </head>, the service should still produce
        a PDF (synthesizes a head with the print CSS)."""
        no_head = "<body><h1>Hello</h1><p>world</p></body>"
        pdf = export_cv_to_pdf(no_head)
        meta = pdf_metadata(pdf)
        assert meta["is_valid"] is True

    def test_custom_page_size(self):
        pdf_letter = export_cv_to_pdf(SHORT_HTML, page_size="Letter")
        pdf_a4 = export_cv_to_pdf(SHORT_HTML, page_size="A4")
        # Same content but different page size → at least one should
        # differ in bytes (page metadata). Both must still be valid.
        assert pdf_letter.startswith(b"%PDF-")
        assert pdf_a4.startswith(b"%PDF-")
        assert pdf_metadata(pdf_letter)["is_valid"]
        assert pdf_metadata(pdf_a4)["is_valid"]

    def test_image_in_input_html_does_not_break_generation(self):
        """The print CSS strips images but the service should not
        throw if input has stray <img> tags (defense-in-depth)."""
        pdf = export_cv_to_pdf(HTML_WITH_IMG)
        meta = pdf_metadata(pdf)
        assert meta["is_valid"] is True

    def test_minimal_html(self):
        pdf = export_cv_to_pdf("<html><body>x</body></html>")
        assert pdf.startswith(b"%PDF-")


# ── Text extractability (the real ATS test) ───────────────────────
class TestTextExtractability:
    """An ATS-friendly PDF must have its text extractable as actual
    characters — not rasterized into images. If the text comes back
    as glyph names (``TJ`` / ``Tj`` operators with proper unicode),
    an ATS parser can index it. If it's only pixels, the ATS sees
    nothing.
    """

    def test_text_extractable_from_real_cv(self):
        from pypdf import PdfReader
        from io import BytesIO

        pdf = export_cv_to_pdf(SHORT_HTML)
        reader = PdfReader(BytesIO(pdf))
        text = "".join(p.extract_text() for p in reader.pages).lower()

        # Spot-check that the source content survived the PDF trip.
        assert "jane doe" in text, f"name not extracted; got: {text[:200]!r}"
        assert "backend engineer" in text, f"title not extracted; got: {text[:200]!r}"
        assert "python" in text, f"skill not extracted; got: {text[:200]!r}"
        assert "experience" in text, f"section heading not extracted; got: {text[:200]!r}"

    def test_long_cv_text_extracts_across_pages(self):
        from pypdf import PdfReader
        from io import BytesIO

        pdf = export_cv_to_pdf(_long_html())
        reader = PdfReader(BytesIO(pdf))
        text = "".join(p.extract_text() for p in reader.pages)
        # All 60 role bullets should survive the page split.
        for i in [0, 30, 59]:
            assert f"role {i}" in text.lower(), (
                f"role {i} bullet lost across page break; "
                f"text length={len(text)}"
            )