"""Tests for the job scraper service.

These tests exercise the URL normalization, exception types, and the
extraction chain end-to-end. We mock the HTTP transport so no real
network calls happen — the live-fire smoke test is in BE-7.
"""
from __future__ import annotations

import httpx
import pytest

from app.services.job_scraper import (
    ContentTooLargeError,
    EmptyContentError,
    FetchError,
    InvalidURLError,
    _collapse_whitespace,
    _extract_main_content,
    _strip_tracking_params,
    scrape_job,
)


# ── Static HTML fixtures ──────────────────────────────────────────

HTML_WITH_MAIN = """
<!DOCTYPE html>
<html>
<head><title>Senior Backend Engineer</title></head>
<body>
  <nav>Home | Jobs | About</nav>
  <main>
    <h1>Senior Backend Engineer</h1>
    <p>Bukalapak is hiring a Senior Backend Engineer in Jakarta. You will
       build distributed payment systems serving 10M+ users. We use Python,
       FastAPI, PostgreSQL, Redis, Kafka, Kubernetes, and Terraform.</p>
    <h2>Responsibilities</h2>
    <ul>
      <li>Design and implement microservices.</li>
      <li>Lead technical architecture decisions.</li>
      <li>Mentor junior engineers.</li>
    </ul>
    <h2>Required Skills</h2>
    <ul>
      <li>5+ years backend experience with Python.</li>
      <li>Strong knowledge of PostgreSQL and Redis.</li>
      <li>Experience with Kubernetes and Docker.</li>
    </ul>
    <h2>Nice to Have</h2>
    <ul>
      <li>Experience with Kafka.</li>
      <li>Open source contributions.</li>
    </ul>
    <h2>Salary</h2>
    <p>Rp 25,000,000 - Rp 40,000,000 per month.</p>
    <h2>How to Apply</h2>
    <p>Send your CV and portfolio to careers@bukalapak.com.</p>
  </main>
  <footer>Copyright 2026</footer>
</body>
</html>
"""

HTML_BARE_BODY = """
<!DOCTYPE html>
<html>
<body>
  <p>Job: Data Engineer at Tokopedia.</p>
  <p>Requirements: Python, SQL, Airflow, Spark.</p>
  <p>Nice to have: dbt, BigQuery.</p>
  <p>Salary: Rp 18,000,000 - Rp 28,000,000.</p>
  <p>Location: Jakarta, hybrid.</p>
  <p>Apply at jobs@tokopedia.com.</p>
</body>
</html>
"""

HTML_EMPTY = """
<!DOCTYPE html>
<html>
<body>
  <nav>Just nav stuff, no real content here</nav>
  <footer>Just footer</footer>
</body>
</html>
"""

HTML_HUGE = "<html><body>" + ("x" * (10 * 1024 * 1024)) + "</body></html>"


# ── Transport mock helpers ────────────────────────────────────────


class _MockTransport(httpx.BaseTransport):
    """httpx transport that returns canned responses by URL.

    Tests register a response per URL. Unregistered URLs raise so a
    test failure is loud instead of silent.
    """

    def __init__(self):
        self._responses: dict[str, httpx.Response] = {}
        self._errors: dict[str, Exception] = {}

    def register(self, url: str, response: httpx.Response) -> None:
        self._responses[url] = response

    def register_error(self, url: str, exc: Exception) -> None:
        self._errors[url] = exc

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url in self._errors:
            raise self._errors[url]
        if url in self._responses:
            return self._responses[url]
        raise AssertionError(f"unexpected URL in test: {url}")


def _client(transport: _MockTransport) -> httpx.Client:
    return httpx.Client(transport=transport, timeout=15.0)


# ── Pure-function tests ──────────────────────────────────────────


def test_rejects_invalid_url():
    """URL without http(s):// scheme must raise InvalidURLError."""
    with pytest.raises(InvalidURLError):
        scrape_job("example.com/jobs/123")
    with pytest.raises(InvalidURLError):
        scrape_job("ftp://example.com/jobs/123")
    with pytest.raises(InvalidURLError):
        scrape_job("")
    with pytest.raises(InvalidURLError):
        scrape_job("   ")


def test_strips_tracking_params():
    """utm_*, fbclid, gclid, ref, mc_* must be removed; other params kept."""
    cleaned = _strip_tracking_params(
        "https://boards.example.com/jobs/123?"
        "utm_source=newsletter&utm_medium=email&id=abc&fbclid=xyz"
        "&gclid=qq&ref=foo&mc_eid=bar&gh_jid=keep"
    )
    assert "utm_source" not in cleaned
    assert "utm_medium" not in cleaned
    assert "fbclid" not in cleaned
    assert "gclid" not in cleaned
    assert "ref=foo" not in cleaned
    assert "mc_eid" not in cleaned
    assert "id=abc" in cleaned
    assert "gh_jid=keep" in cleaned


def test_handles_404():
    """Non-2xx response must raise FetchError."""
    transport = _MockTransport()
    transport.register(
        "https://example.com/gone",
        httpx.Response(404, text="not found"),
    )
    with _client(transport) as c:
        with pytest.raises(FetchError, match="404"):
            scrape_job("https://example.com/gone", client=c)


def test_handles_oversized_response():
    """Response body > 5MB must raise ContentTooLargeError."""
    transport = _MockTransport()
    # Provide a real-looking response with a >5MB body.
    big = b"<html><body>" + (b"x" * (6 * 1024 * 1024)) + b"</body></html>"
    transport.register(
        "https://example.com/huge",
        httpx.Response(200, headers={"content-length": str(len(big))}, content=big),
    )
    with _client(transport) as c:
        with pytest.raises(ContentTooLargeError):
            scrape_job("https://example.com/huge", client=c)


def test_extracts_main_content():
    """Happy path: selectolax grabs <main>, text is non-empty."""
    transport = _MockTransport()
    transport.register(
        "https://example.com/job",
        httpx.Response(
            200,
            headers={"content-type": "text/html; charset=utf-8"},
            text=HTML_WITH_MAIN,
        ),
    )
    with _client(transport) as c:
        result = scrape_job("https://example.com/job", client=c)

    assert isinstance(result.text, str)
    assert len(result.text) > 200
    assert "Senior Backend Engineer" in result.text
    assert "Bukalapak" in result.text
    assert "Python" in result.text
    # The nav/footer should not have leaked in as the dominant content.
    assert result.extractor_used in ("selectolax", "trafilatura")
    assert result.status_code == 200


def test_empty_content_raises():
    """An HTML page with no real content must raise EmptyContentError."""
    transport = _MockTransport()
    transport.register(
        "https://example.com/empty",
        httpx.Response(200, text=HTML_EMPTY),
    )
    with _client(transport) as c:
        with pytest.raises(EmptyContentError):
            scrape_job("https://example.com/empty", client=c)


# ── Whitespace + extraction-chain unit tests (bonus coverage) ─────


def test_collapse_whitespace_normalizes_blanks():
    """Tabs + 3+ newlines collapse; paragraphs preserved."""
    raw = "line 1   with   tabs\n\n\n\n\nline 2"
    out = _collapse_whitespace(raw)
    assert "   " not in out
    assert "\n\n\n" not in out
    assert "line 1" in out
    assert "line 2" in out


def test_extract_main_content_picks_first_successful():
    """Direct call: selectolax wins when its output is >= MIN_EXTRACTED_CHARS."""
    text, name = _extract_main_content(HTML_WITH_MAIN)
    assert name == "selectolax"
    assert "Senior Backend Engineer" in text


def test_extract_main_content_falls_back_for_bare_body():
    """A body-only page (no <main>) still produces useful text."""
    text, name = _extract_main_content(HTML_BARE_BODY)
    assert name in ("selectolax", "beautifulsoup")
    assert "Data Engineer" in text
    assert "Python" in text


def test_extract_main_content_returns_short_for_truly_empty():
    """An empty-page HTML yields < MIN_EXTRACTED_CHARS or extractor='none'."""
    text, name = _extract_main_content(HTML_EMPTY)
    assert len(text) < 100 or name == "none"