"""Integration tests for profile API routes."""
import io
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.models import ResumeUpload, Profile, ProfileVersion

client = TestClient(app)


# ── Fixtures ────────────────────────────────────────────────────

SAMPLE_PDF_BYTES = b"%PDF-1.4\n%mock pdf for testing\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 1\n0000000000 65535 f\ntrailer<</Size 1>>startxref\n0\n%%EOF"

SAMPLE_PARSED = {
    "basics": {
        "name": "Test User",
        "email": "test@example.com",
        "summary": "Test summary"
    },
    "work": [
        {"name": "TestCo", "position": "Engineer", "startDate": "2020-01", "highlights": ["Did stuff"]}
    ],
    "education": [],
    "skills": [{"name": "Backend", "keywords": ["Python"]}],
    "projects": [],
    "certificates": [],
    "languages": [],
}


def _make_pdf(file_obj: io.BytesIO) -> None:
    """Write a minimal valid PDF structure for pdfplumber to parse."""
    file_obj.write(SAMPLE_PDF_BYTES)
    file_obj.seek(0)


@pytest.fixture(autouse=True)
def _mock_llm_parse():
    """Mock LLMClient globally so any instantiation returns canned JSON."""
    mock_result = MagicMock()
    mock_result.text = '{"basics":{"name":"Test User","email":"test@example.com","summary":"Test summary"},"work":[{"name":"TestCo","position":"Engineer","startDate":"2020-01","highlights":["Did stuff"]}],"education":[],"skills":[{"name":"Backend","keywords":["Python"]}],"projects":[],"certificates":[],"languages":[]}'
    mock_result.content = mock_result.text  # both attrs in case parser uses either
    mock_result.usage = None
    mock_result.provider = "mock"
    mock_result.model = "mock-model"

    mock_instance = MagicMock()
    mock_instance.set_db.return_value = None

    async def _fake_generate(*args, **kwargs):
        return mock_result

    mock_instance.generate = _fake_generate

    with patch("app.services.resume_parser.LLMClient", return_value=mock_instance):
        yield mock_instance


# ── Tests ───────────────────────────────────────────────────────

def test_upload_pdf_returns_upload_id(_mock_llm_parse):
    """POST /profile/resume/upload accepts PDF, returns upload_id + status=parsing."""
    pdf_bytes = (
        b"BT /F1 12 Tf 100 700 Td (Mohammad Pratama) Tj ET\n"
        b"BT /F1 12 Tf 100 680 Td (Senior Backend Engineer) Tj ET\n"
        b"BT /F1 12 Tf 100 660 Td (mohammad@example.com) Tj ET\n"
    )
    files = {"file": ("resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")}

    with patch("app.services.text_extractor._extract_pdf", return_value="Mohammad Pratama\nSenior Backend Engineer\nmohammad@example.com"):
        resp = client.post("/api/profile/resume/upload", files=files)

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "upload_id" in body
    assert body["status"] in ("parsing", "parsed")


def test_upload_rejects_non_resume_file(_mock_llm_parse):
    """POST /profile/resume/upload rejects unsupported file types."""
    files = {"file": ("evil.exe", io.BytesIO(b"binary"), "application/octet-stream")}
    resp = client.post("/api/profile/resume/upload", files=files)
    # FastAPI returns 415 (Unsupported Media Type) when content-type doesn't match
    assert resp.status_code in (400, 415)


def test_get_profile_after_parse(_mock_llm_parse):
    """GET /profile returns parsed profile data after upload + parse."""
    # 1) Upload
    pdf_bytes = b"BT /F1 12 Tf 100 700 Td (Mohammad) Tj ET\n" * 5
    files = {"file": ("resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    with patch("app.services.text_extractor._extract_pdf", return_value="Mohammad content"):
        up = client.post("/api/profile/resume/upload", files=files)
    assert up.status_code == 200
    upload_id = up.json()["upload_id"]

    # 2) Poll until parsed (parse runs in background task)
    import time
    for _ in range(20):
        s = client.get(f"/api/profile/resume/upload/{upload_id}")
        if s.json().get("status") == "parsed":
            break
        time.sleep(0.5)

    # 3) Get profile
    resp = client.get("/api/profile")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == "test@example.com"  # mocked LLM output
    assert "base_profile_json" in body


def test_patch_profile_increments_version(_mock_llm_parse):
    """PATCH /profile updates fields and creates a new ProfileVersion."""
    # Need a profile first — upload + wait for parse
    pdf_bytes = b"BT /F1 12 Tf 100 700 Td (Test) Tj ET\n" * 3
    files = {"file": ("resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    with patch("app.services.text_extractor._extract_pdf", return_value="Test content"):
        up = client.post("/api/profile/resume/upload", files=files)
    upload_id = up.json()["upload_id"]

    import time
    for _ in range(20):
        s = client.get(f"/api/profile/resume/upload/{upload_id}")
        if s.json().get("status") == "parsed":
            break
        time.sleep(0.5)

    # Now patch
    patch_data = {"summary": "Updated summary from test"}
    resp = client.patch("/api/profile", json=patch_data)
    assert resp.status_code == 200, resp.text
    assert resp.json()["summary"] == "Updated summary from test"


def test_list_versions_returns_history(_mock_llm_parse):
    """GET /profile/versions returns version history."""
    # Upload + wait to create v1
    pdf_bytes = b"BT /F1 12 Tf 100 700 Td (Hist) Tj ET\n" * 3
    files = {"file": ("resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    with patch("app.services.text_extractor._extract_pdf", return_value="Hist content"):
        up = client.post("/api/profile/resume/upload", files=files)
    upload_id = up.json()["upload_id"]

    import time
    for _ in range(20):
        s = client.get(f"/api/profile/resume/upload/{upload_id}")
        if s.json().get("status") == "parsed":
            break
        time.sleep(0.5)

    resp = client.get("/api/profile/versions")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert "version_number" in body[0]
    assert "change_summary" in body[0]
    assert "created_at" in body[0]

# ── Schema validation edge cases ─────────────────────────────────

def test_profile_in_accepts_empty_url_strings():
    """Empty string for URL fields must coerce to None (handles both input + output)."""
    from app.schemas.schemas import ProfileIn

    p = ProfileIn(
        name="Test User",
        email="test@example.com",
        linkedin="",
        github="   ",
        portfolio=None,
    )
    assert p.linkedin is None
    assert p.github is None
    assert p.portfolio is None

    # Also: ProfileOut (which extends ProfileIn) must accept empty strings
    # when reading from ORM (defense against bad DB data).
    from app.schemas.schemas import ProfileOut

    class FakeORM:
        id = "test-id"
        name = "Test"
        email = "test@example.com"
        linkedin = ""  # bad data already in DB
        github = ""
        portfolio = None
        summary = None
        title = None
        phone = None
        location = None
        confidence_score = 0.0
        ai_analysis_json = {}
        created_at = "2026-01-01T00:00:00"
        updated_at = "2026-01-01T00:00:00"
        base_profile_json = {}
        skills = []
        experiences = []
        education = []
        projects = []
        certifications = []
        languages = []
        preferences = {}

    out = ProfileOut.model_validate(FakeORM())
    assert out.linkedin is None
    assert out.github is None


def test_profile_in_accepts_valid_urls():
    """Real URLs still validate normally."""
    from app.schemas.schemas import ProfileIn

    p = ProfileIn(
        name="Test User",
        email="test@example.com",
        linkedin="https://linkedin.com/in/test",
        github="https://github.com/test",
    )
    assert str(p.linkedin) == "https://linkedin.com/in/test"
    assert str(p.github) == "https://github.com/test"
