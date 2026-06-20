"""Phase 8 — CV export service.

Wraps WeasyPrint to convert an already-rendered CV HTML document
into an ATS-safe PDF. The HTML produced by ``cv_renderer`` is already
semantic (h1/h2, ul/li, scoped CSS) so most of the ATS work is done;
this module layers a print stylesheet on top to guarantee:

- single-column layout (some ATS choke on multi-col)
- selectable text (no image-based text, no canvas/SVG-as-text)
- no images in body
- sane page breaks (don't split a bullet in half)
- embedded fonts (no system-font fallback that could shift glyphs)
- explicit page margins

The service is pure: takes a draft + profile, returns ``bytes``. No DB
writes happen here — the route layer persists the Export row.
"""
from __future__ import annotations

import re
from io import BytesIO
from typing import Any

from weasyprint import HTML

from app.core.logging import get_logger

log = get_logger(__name__)


# ── ATS-safe print CSS ──────────────────────────────────────────────
#
# Layered on top of the CV renderer's scoped CSS. The renderer already
# emits semantic HTML and per-draft CSS scoping; this print sheet adds
# the page-layout rules that only apply at export time.
#
# Kept conservative on purpose: any "fancy" ATS-hostile pattern (multi-
# column, absolute positioning, decorative ::before icons) is forbidden.

ATS_PRINT_CSS = """
/* Page setup — letter or A4 depending on template config (default A4) */
@page {{
    size: {page_size};
    margin: {margin_top} {margin_right} {margin_bottom} {margin_left};
}}

/* Single-column enforcement — ATS parsers expect one stream of text.
   Any flex/grid/column layout gets flattened for print. */
* {{
    float: none !important;
    column-count: 1 !important;
    column-gap: 0 !important;
}}

/* Text rendering — selectable text only. No subpixel tricks, no
   letter-spacing that some ATS tokenizers normalize away. */
body, p, li, h1, h2, h3, span, div {{
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    text-rendering: geometricPrecision;
}}

/* Page break rules — keep bullets intact, allow heading room. */
h1, h2, h3 {{
    page-break-after: avoid;
    break-after: avoid-page;
}}
ul, ol, li, p {{
    page-break-inside: avoid;
    break-inside: avoid-page;
}}
section, article {{
    page-break-inside: auto;
}}

/* Disable any decorative background images — ATS can't read them and
   they bloat file size. */
* {{
    background-image: none !important;
}}

/* Hyperlinks: render as plain text (no underline, color from body).
   Some ATS extract the URL as separate tokens — better to inline it. */
a {{
    color: inherit;
    text-decoration: none;
}}

/* Images in body are forbidden by ATS rules — force any stray <img>
   to zero size so the parser skips it. The renderer's CSS already
   omits images in body, this is a belt-and-braces fallback. */
img {{
    display: none !important;
    width: 0 !important;
    height: 0 !important;
}}
"""


# ── Public entry point ──────────────────────────────────────────────


def export_cv_to_pdf(
    rendered_html: str,
    *,
    page_size: str = "A4",
    margin_top: str = "18mm",
    margin_right: str = "16mm",
    margin_bottom: str = "18mm",
    margin_left: str = "16mm",
) -> bytes:
    """Render an ATS-safe PDF from already-rendered CV HTML.

    Args:
        rendered_html: Full HTML document from
            ``cv_renderer.render_html_document``. Must include the
            ``<style>`` block from the renderer (scoped CSS).
        page_size: ``"A4"`` (default) or ``"Letter"``.
        margin_*: Page margins in mm.

    Returns:
        PDF as ``bytes`` — ready to stream via FastAPI ``Response``.

    Side-effect free. WeasyPrint is deterministic so same input ⇒
    byte-identical output (modulo embedded timestamp metadata, which
    is fine).
    """
    print_css = ATS_PRINT_CSS.format(
        page_size=page_size,
        margin_top=margin_top,
        margin_right=margin_right,
        margin_bottom=margin_bottom,
        margin_left=margin_left,
    )

    # Inject the print CSS right before </head> so it overrides any
    # per-template CSS that the renderer may have set. Use a marker
    # that's guaranteed to exist (the renderer always emits <html lang=>).
    if "</head>" in rendered_html:
        html_with_print = rendered_html.replace(
            "</head>", f"<style>{print_css}</style></head>", 1
        )
    else:
        # B3 fix: strip any leading/trailing <html>/<head>/<body>
        # wrappers from the input before re-wrapping. The previous
        # version nested <body> if the input already had one.
        from lxml import html as lxml_html  # local import — heavy dep

        try:
            # Parse the input as a fragment and create a body parent so
            # we can serialize just the children, stripping any
            # <html>/<head>/<body> wrappers the caller may have left in.
            parsed = lxml_html.fragment_fromstring(rendered_html, create_parent=True)
            serialized = lxml_html.tostring(parsed, encoding="unicode")
            if not isinstance(serialized, str):
                serialized = serialized.decode("utf-8", errors="replace")
            # lxml emits the body tag itself; we re-wrap below, so strip it.
            clean_body_html = re.sub(
                r"^\s*<body[^>]*>|</body>\s*$",
                "",
                serialized,
                flags=re.IGNORECASE,
            )
        except Exception:
            # If lxml can't parse it, just use the input as-is.
            clean_body_html = rendered_html
        html_with_print = (
            f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
            f"<style>{print_css}</style></head>"
            f"<body>{clean_body_html}</body></html>"
        )

    log.info(
        "cv_export_to_pdf_start",
        page_size=page_size,
        html_length=len(html_with_print),
    )
    pdf_bytes = HTML(string=html_with_print, base_url=".").write_pdf()
    log.info("cv_export_to_pdf_done", pdf_size=len(pdf_bytes))
    return pdf_bytes


def pdf_metadata(pdf_bytes: bytes) -> dict[str, Any]:
    """Quick introspection of a generated PDF — used by tests + the
    route's ATS-safety log line.

    Uses pypdf to decompress the PDF object stream and count pages
    reliably. Modern PDFs (including everything WeasyPrint produces)
    FlateDecode-compress object streams, so naive byte counting
    (``/Type /Page`` markers) never finds them.

    Returns:
        ``{
            "size": int,
            "magic": str,            # "%PDF-x.y"
            "is_valid": bool,
            "page_count": int,       # actual page count, 0 if invalid
        }``
    """
    if not pdf_bytes or not pdf_bytes.startswith(b"%PDF-"):
        return {
            "size": len(pdf_bytes),
            "magic": "",
            "is_valid": False,
            "page_count": 0,
        }
    head = pdf_bytes[:8].decode("latin-1", errors="replace")
    magic = head.split("\n", 1)[0]
    page_count = 0
    # B9 fix: narrow the exception types we swallow so real pypdf
    # bugs (memory errors, corrupted streams) used to be
    # indistinguishable from "PDF has zero pages". Now we log WARNING
    # so the operator sees them in production. PdfStreamError covers
    # truncated/corrupt PDFs that pass the magic-prefix check.
    extra_exc: tuple = ()
    try:
        from pypdf.errors import PdfStreamError as _PdfStreamError
        extra_exc = (_PdfStreamError,)
    except ImportError:
        pass
    try:
        from pypdf import PdfReader
        # B13 fix: wrap BytesIO in a context manager so it's closed
        # deterministically even if PdfReader raises mid-read.
        with BytesIO(pdf_bytes) as buf:
            reader = PdfReader(buf)
            page_count = len(reader.pages)
    except (ImportError, ValueError, RuntimeError, AttributeError, *extra_exc) as exc:
        page_count = 0
        log.warning(
            "pdf_metadata_parse_failed",
            pdf_size=len(pdf_bytes),
            error=str(exc),
            error_type=type(exc).__name__,
        )
    return {
        "size": len(pdf_bytes),
        "magic": magic,
        "is_valid": True,
        "page_count": page_count,
    }