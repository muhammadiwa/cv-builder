"""Tests for the text extractor service.

We generate small fixture files (PDF + DOCX) on the fly using reportlab
and python-docx so the repo doesn't need to ship binary blobs. Fixtures
are session-scoped — generated once, reused by every test.
"""
from __future__ import annotations

from pathlib import Path

import docx
import pytest
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from app.services.text_extractor import (
    MAX_FILE_SIZE,
    MAX_TEXT_LENGTH,
    SUPPORTED_TYPES,
    extract_text,
)

# ── Fixture content ────────────────────────────────────────────────
# A short, plausible resume so we can assert on exact substrings.
RESUME_TEXT = (
    "Mohammad Pratama\n"
    "Senior Backend Engineer\n"
    "mohammad@example.com\n"
    "+62-812-1234-5678\n"
    "\n"
    "Summary\n"
    "Six years building distributed systems in Python and Go.\n"
    "\n"
    "Experience\n"
    "Bukalapak - Senior Backend Engineer (2021-03 - present)\n"
    "- Migrated monolith to microservices, reducing p95 latency by 40%\n"
    "- Led team of 4 engineers to ship payments service\n"
)


# ── Fixtures ───────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def fixtures_dir(tmp_path_factory) -> Path:
    """One temp dir for the whole test session, holds sample PDF + DOCX."""
    return tmp_path_factory.mktemp("text_extractor_fixtures")


@pytest.fixture(scope="session")
def sample_pdf(fixtures_dir: Path) -> Path:
    """Generate a small, text-based PDF using reportlab."""
    path = fixtures_dir / "sample_resume.pdf"
    c = canvas.Canvas(str(path), pagesize=letter)
    # Simple line-by-line layout — pdfplumber handles this trivially.
    for i, line in enumerate(RESUME_TEXT.splitlines()):
        c.drawString(72, 760 - i * 14, line)
    c.showPage()
    c.save()
    assert path.exists() and path.stat().st_size > 0
    return path


@pytest.fixture(scope="session")
def sample_docx(fixtures_dir: Path) -> Path:
    """Generate a small DOCX with the same content using python-docx."""
    path = fixtures_dir / "sample_resume.docx"
    doc = docx.Document()
    for line in RESUME_TEXT.splitlines():
        if line.strip():
            doc.add_paragraph(line)
    doc.save(str(path))
    assert path.exists() and path.stat().st_size > 0
    return path


@pytest.fixture
def empty_pdf(fixtures_dir: Path) -> Path:
    """A PDF with a single blank page (no extractable text)."""
    path = fixtures_dir / "empty.pdf"
    c = canvas.Canvas(str(path), pagesize=letter)
    c.showPage()  # blank page, no drawString calls
    c.save()
    return path


@pytest.fixture
def oversized_file(fixtures_dir: Path) -> Path:
    """A file larger than MAX_FILE_SIZE (sparse — just to trigger size guard)."""
    path = fixtures_dir / "huge.pdf"
    # Sparse write: seek past MAX_FILE_SIZE + 1 byte, then write one byte.
    # The file is "real" but the PDF magic header isn't there — extractor
    # should reject it on size BEFORE trying to parse.
    with path.open("wb") as f:
        f.seek(MAX_FILE_SIZE + 1)
        f.write(b"x")
    return path


# ── Tests ─────────────────────────────────────────────────────────


def test_extract_pdf_sample(sample_pdf: Path):
    """A normal text-based PDF yields the expected substrings."""
    text = extract_text(sample_pdf, "pdf")
    assert isinstance(text, str)
    assert "Mohammad Pratama" in text
    assert "Senior Backend Engineer" in text
    assert "mohammad@example.com" in text
    assert "Bukalapak" in text
    # Length sanity (not asserting exact chars — pdfplumber may tweak spacing).
    assert len(text) > 100


def test_extract_docx_sample(sample_docx: Path):
    """A normal DOCX yields the expected substrings."""
    text = extract_text(sample_docx, "docx")
    assert isinstance(text, str)
    assert "Mohammad Pratama" in text
    assert "Senior Backend Engineer" in text
    assert "mohammad@example.com" in text
    assert "Bukalapak" in text
    assert len(text) > 100


def test_rejects_unknown_extension(fixtures_dir: Path):
    """An unsupported file_type raises ValueError, never a silent fallthrough."""
    bogus = fixtures_dir / "fake.exe"
    bogus.write_bytes(b"MZ" + b"\x00" * 100)
    with pytest.raises(ValueError, match="unsupported file_type"):
        extract_text(bogus, "exe")
    with pytest.raises(ValueError, match="unsupported file_type"):
        extract_text(bogus, "txt")
    with pytest.raises(ValueError, match="unsupported file_type"):
        extract_text(bogus, "")


def test_rejects_empty_pdf(empty_pdf: Path):
    """A PDF with no extractable text raises RuntimeError (likely scanned)."""
    with pytest.raises(RuntimeError, match="empty"):
        extract_text(empty_pdf, "pdf")


def test_rejects_oversized_file(oversized_file: Path):
    """A file larger than MAX_FILE_SIZE raises ValueError before opening."""
    with pytest.raises(ValueError, match="too large"):
        extract_text(oversized_file, "pdf")


def test_module_constants_sane():
    """Sanity: the exported constants are what the docstring says they are.

    This catches accidental edits that silently shrink the safety net.
    """
    assert MAX_FILE_SIZE == 10 * 1024 * 1024
    assert MAX_TEXT_LENGTH == 100_000
    assert SUPPORTED_TYPES == ("pdf", "docx")


def test_file_type_case_insensitive(sample_pdf: Path):
    """file_type matching is case-insensitive (PDF == pdf == Pdf)."""
    text_lower = extract_text(sample_pdf, "pdf")
    text_upper = extract_text(sample_pdf, "PDF")
    text_mixed = extract_text(sample_pdf, "Pdf")
    assert text_lower == text_upper == text_mixed
