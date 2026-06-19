"""Job description scraper — turns a job posting URL into raw JD text.

Pipeline (for ``scrape_job(url)``):

1. Validate the URL (must be ``http://`` or ``https://``).
2. Strip tracking query params (utm_*, fbclid, gclid, ref, mc_*).
3. ``httpx.GET`` with a polite UA, ``Accept: text/html``, 15s timeout,
   max 5 MB body, follow up to 5 redirects.
4. Extract the main content via a tiered fallback chain:
   a. ``selectolax`` — look for ``<main>``, ``<article>``, ``[role="main"]``,
      then fall back to ``<body>``.
   b. ``trafilatura`` — ML-based extractor (handles messy career pages).
   c. ``beautifulsoup4`` — last-resort "largest text block" heuristic.
5. Truncate the result to 50,000 chars (LLM context safety) and
   collapse excessive whitespace.

This module is deterministic and synchronous on purpose — it never
calls the LLM. The downstream ``jd_analyzer`` service takes the raw
text and feeds it to ``LLMClient.generate`` with the analyze_jd prompt.

Failure modes are explicit (``InvalidURLError``, ``FetchError``,
``ContentTooLargeError``, ``EmptyContentError``) so the API layer can
return clear 4xx errors instead of a generic 500.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup
from selectolax.parser import HTMLParser

from app.core.logging import get_logger

log = get_logger(__name__)


# ── Hard limits (mirror Settings.scraper_* + safe upper bounds) ────

MAX_RESPONSE_BYTES = 5 * 1024 * 1024      # 5 MB
MAX_TEXT_LENGTH = 50_000                  # ~ LLM context safety
REQUEST_TIMEOUT_SECONDS = 15
MAX_REDIRECTS = 5
MIN_EXTRACTED_CHARS = 100                 # below this we call it empty

USER_AGENT = "Mozilla/5.0 (compatible; CVATSBuilder/1.0; +https://github.com/local/cv-ats-builder)"
ACCEPT_HEADER = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"

# Tracking params we strip before fetching. These add no value to the JD
# page and may trigger anti-bot heuristics. Order doesn't matter.
_TRACKING_PREFIXES = ("utm_", "mc_")
_TRACKING_EXACT = {"fbclid", "gclid", "ref", "ref_src", "ref_url", "yclid"}


# ── Custom exceptions ─────────────────────────────────────────────


class InvalidURLError(ValueError):
    """Raised when the URL is missing a scheme or is otherwise unusable."""


class FetchError(RuntimeError):
    """Raised on non-2xx HTTP responses or transport-level failures."""


class ContentTooLargeError(ValueError):
    """Raised when the response body exceeds MAX_RESPONSE_BYTES."""


class EmptyContentError(RuntimeError):
    """Raised when the extraction chain yields less than MIN_EXTRACTED_CHARS."""


# ── Result wrapper ─────────────────────────────────────────────────


@dataclass
class ScrapeResult:
    """Raw text + minimal provenance so the API layer can echo back.

    We keep this small — the heavy lifting (structured fields) happens
    in the analyzer service, not here.
    """

    text: str
    final_url: str
    status_code: int
    extractor_used: str   # "selectolax" | "trafilatura" | "beautifulsoup"


# ── URL cleanup ────────────────────────────────────────────────────


def _strip_tracking_params(url: str) -> str:
    """Remove utm_*, fbclid, gclid, ref, mc_* from the query string.

    Keeps every other param intact (job boards often use ``id=`` or
    ``gh_jid=`` to identify roles).
    """
    parsed = urlparse(url)
    if not parsed.query:
        return url
    kept = []
    for k, v in parse_qsl(parsed.query, keep_blank_values=True):
        kl = k.lower()
        if any(kl.startswith(p) for p in _TRACKING_PREFIXES):
            continue
        if kl in _TRACKING_EXACT:
            continue
        kept.append((k, v))
    new_query = urlencode(kept, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def _normalize_url(url: str) -> str:
    """Validate + strip tracking params. Raises InvalidURLError."""
    if not isinstance(url, str) or not url.strip():
        raise InvalidURLError("url is empty")
    cleaned = url.strip()
    parsed = urlparse(cleaned)
    if parsed.scheme not in ("http", "https"):
        raise InvalidURLError(
            f"url must use http:// or https:// (got scheme={parsed.scheme!r})"
        )
    if not parsed.netloc:
        raise InvalidURLError("url is missing host")
    return _strip_tracking_params(cleaned)


# ── Extraction chain (tiered fallback) ─────────────────────────────


_SELECTORS = (
    "main",
    "article",
    "[role=main]",
    "[role=article]",
    ".job-description",
    "#job-description",
    ".posting",
    ".job",
)


def _extract_selectolax(html: str) -> str:
    """Try semantic containers first; fall back to body text.

    Returns "" if nothing useful is found (so the next extractor can try).
    """
    parser = HTMLParser(html)
    for sel in _SELECTORS:
        try:
            node = parser.css_first(sel)
        except Exception:  # noqa: BLE001 — bad CSS shouldn't crash us
            node = None
        if node is not None:
            text = node.text(separator="\n", strip=True)
            if text and len(text.strip()) >= MIN_EXTRACTED_CHARS:
                return text

    # Fallback: full body, stripped of script/style noise.
    body = parser.body
    if body is None:
        return ""
    for tag in body.css("script, style, noscript, template, iframe"):
        tag.decompose()
    text = body.text(separator="\n", strip=True)
    return text or ""


def _extract_trafilatura(html: str) -> str:
    """ML-based main-content extraction (handles messy career pages)."""
    try:
        extracted = trafilatura.extract(  # type: ignore[name-defined]
            html,
            include_links=False,
            include_images=False,
            include_tables=False,
            favor_precision=True,
            with_metadata=False,
            no_fallback=False,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("trafilatura_failed", error=str(e)[:200])
        return ""
    return (extracted or "").strip()


def _extract_beautifulsoup(html: str) -> str:
    """Last-resort: find the largest <p>-heavy container.

    Not as fast or as smart as the others, but it's installed everywhere
    and survives weird HTML that selectolax/trafilatura can't parse.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "template", "iframe"]):
        tag.decompose()
    # Try semantic containers first.
    for sel in ("main", "article", "[role=main]", "#content", ".content", "body"):
        node = soup.select_one(sel)
        if node is not None:
            text = node.get_text(separator="\n", strip=True)
            if text and len(text) >= MIN_EXTRACTED_CHARS:
                return text
    return soup.get_text(separator="\n", strip=True)


def _extract_main_content(html: str) -> tuple[str, str]:
    """Run the tiered extraction chain. Returns (text, extractor_name)."""
    for name, fn in (
        ("selectolax", _extract_selectolax),
        ("trafilatura", _extract_trafilatura),
        ("beautifulsoup", _extract_beautifulsoup),
    ):
        text = fn(html)
        text = _collapse_whitespace(text)
        if text and len(text) >= MIN_EXTRACTED_CHARS:
            return text, name
    # Final attempt: if trafilatura/BS returned SOMETHING short, surface it
    # so the caller can decide. The caller (scrape_job) raises EmptyContentError.
    last = _extract_selectolax(html) or _extract_beautifulsoup(html)
    return _collapse_whitespace(last), "none"


_WS_RUNS = re.compile(r"[ \t]+")
_WS_BLANK_LINES = re.compile(r"\n{3,}")


def _collapse_whitespace(text: str) -> str:
    """Normalize whitespace without nuking paragraph breaks."""
    if not text:
        return ""
    # Replace runs of spaces/tabs inside a line.
    text = _WS_RUNS.sub(" ", text)
    # Collapse 3+ blank lines into 2.
    text = _WS_BLANK_LINES.sub("\n\n", text)
    return text.strip()


# ── Public entry point ────────────────────────────────────────────


def scrape_job(url: str, *, client: httpx.Client | None = None) -> ScrapeResult:
    """Fetch ``url`` and return the extracted JD text.

    Args:
        url: A job-posting URL (``http://`` or ``https://``).
        client: Optional ``httpx.Client`` for testing — lets the test
            suite inject a mock transport. Production callers omit this.

    Returns:
        ``ScrapeResult`` with the extracted text, the final URL (after
        redirects), HTTP status, and which extractor produced the text.

    Raises:
        InvalidURLError: URL missing scheme/host.
        FetchError: Non-2xx response or transport error.
        ContentTooLargeError: Response body > MAX_RESPONSE_BYTES.
        EmptyContentError: All extractors yielded < MIN_EXTRACTED_CHARS.
    """
    clean_url = _normalize_url(url)

    def _do_fetch(c: httpx.Client) -> httpx.Response:
        # Stream so we can enforce the size limit BEFORE loading the body.
        with c.stream(
            "GET",
            clean_url,
            headers={"User-Agent": USER_AGENT, "Accept": ACCEPT_HEADER},
            follow_redirects=True,
            timeout=REQUEST_TIMEOUT_SECONDS,
        ) as resp:
            if resp.status_code >= 400:
                # Drain so the connection can be reused, then raise.
                try:
                    resp.read()
                except Exception:  # noqa: BLE001
                    pass
                raise FetchError(
                    f"fetch failed: HTTP {resp.status_code} for {clean_url}"
                )
            # Accumulate bytes while enforcing the cap.
            buf = bytearray()
            for chunk in resp.iter_bytes():
                buf.extend(chunk)
                if len(buf) > MAX_RESPONSE_BYTES:
                    raise ContentTooLargeError(
                        f"response exceeded {MAX_RESPONSE_BYTES} bytes"
                    )
            # Re-wrap the buffered bytes so the caller's downstream code
            # can still call .text / .headers normally.
            return httpx.Response(
                status_code=resp.status_code,
                headers=resp.headers,
                content=bytes(buf),
                request=resp.request,
            )

    if client is not None:
        response = _do_fetch(client)
    else:
        with httpx.Client(
            headers={"User-Agent": USER_AGENT, "Accept": ACCEPT_HEADER},
            follow_redirects=True,
            timeout=REQUEST_TIMEOUT_SECONDS,
            max_redirects=MAX_REDIRECTS,
        ) as real_client:
            response = _do_fetch(real_client)

    html = response.text or ""
    final_url = str(response.request.url) if response.request else clean_url
    text, extractor = _extract_main_content(html)

    if not text or len(text) < MIN_EXTRACTED_CHARS:
        raise EmptyContentError(
            f"could not extract main content from {final_url} "
            f"(got {len(text)} chars, need >= {MIN_EXTRACTED_CHARS})"
        )

    if len(text) > MAX_TEXT_LENGTH:
        log.warning(
            "jd_text_truncated",
            url=final_url,
            original_len=len(text),
            cap=MAX_TEXT_LENGTH,
        )
        text = text[:MAX_TEXT_LENGTH]

    log.info(
        "scrape_job_ok",
        url=final_url,
        status=response.status_code,
        extractor=extractor,
        chars=len(text),
    )
    return ScrapeResult(
        text=text,
        final_url=final_url,
        status_code=response.status_code,
        extractor_used=extractor,
    )