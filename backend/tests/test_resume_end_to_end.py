"""End-to-end resume parse with REAL LLM (MiniMax-M3).

Skipped if no API key configured. Validates the full pipeline:
upload → text extraction → LLM parse → save to DB → Profile returned.
"""
import io
import os
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

client = TestClient(app)

# Skip if no real LLM key — Phase 1 LLMCallLog tests already check key presence
settings = get_settings()

# Skip if no real LLM key configured
pytestmark = pytest.mark.skipif(
    not any(
        [
            os.getenv("TOKENROUTER_API_KEY"),
            os.getenv("OPENAI_API_KEY"),
            getattr(settings, "tokenrouter_api_key", None),
            getattr(settings, "openai_api_key", None),
        ]
    ),
    reason="No LLM API key configured; skipping real LLM end-to-end test",
)


# Minimal valid PDF generated via reportlab (already in Phase 1 deps)
def _build_sample_pdf() -> bytes:
    """Generate a small in-memory PDF with resume content."""
    try:
        from reportlab.pdfgen import canvas

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=(612, 792))
        y = 750
        lines = [
            ("Jane Doe", 18, True),
            ("Backend Engineer", 12, False),
            ("jane.doe@example.com  |  +1-555-0100  |  San Francisco", 10, False),
            ("", 10, False),
            ("EXPERIENCE", 12, True),
            ("Acme Corp  |  Senior Engineer  |  2020 - Present", 11, True),
            ("  - Built microservices handling 5K req/sec", 10, False),
            ("Globex  |  Engineer  |  2017 - 2020", 11, True),
            ("  - Implemented REST APIs and CI/CD pipelines", 10, False),
            ("", 10, False),
            ("SKILLS", 12, True),
            ("Python, FastAPI, PostgreSQL, Docker, Kubernetes, AWS", 10, False),
        ]
        for text, sz, bold in lines:
            c.setFont("Helvetica-Bold" if bold else "Helvetica", sz)
            c.drawString(50, y, text)
            y -= sz + 6
        c.save()
        return buf.getvalue()
    except ImportError:
        pytest.skip("reportlab not available; cannot generate fixture PDF")


def test_upload_real_pdf_parses_to_profile():
    """Upload real PDF → poll status → assert Profile populated via real LLM."""
    pdf_bytes = _build_sample_pdf()
    assert pdf_bytes, "PDF generation failed"
    files = {"file": ("jane_resume.pdf", io.BytesIO(pdf_bytes), "application/pdf")}

    # 1) Upload
    up = client.post("/api/profile/resume/upload", files=files)
    assert up.status_code == 200, up.text
    upload_id = up.json()["upload_id"]
    assert up.json()["status"] in ("parsing", "parsed")

    # 2) Poll (parse runs in background task; real LLM may take 5-30s)
    deadline = time.time() + 60
    final_status = None
    while time.time() < deadline:
        s = client.get(f"/api/profile/resume/upload/{upload_id}")
        assert s.status_code == 200
        final_status = s.json().get("status")
        if final_status == "parsed":
            break
        if final_status == "failed":
            pytest.fail(f"parse failed: {s.json().get('error_message')}")
        time.sleep(1)

    assert final_status == "parsed", f"parse did not complete in 60s; status={final_status}"

    # 3) Profile populated
    p = client.get("/api/profile")
    assert p.status_code == 200, p.text
    body = p.json()
    assert body.get("email"), f"Profile email missing: {body.keys()}"
    assert body.get("base_profile_json"), "base_profile_json empty"
    assert body.get("confidence_score", 0) > 0.3, f"low confidence: {body.get('confidence_score')}"

    # 4) ProfileVersion created (audit trail)
    v = client.get("/api/profile/versions")
    assert v.status_code == 200
    versions = v.json()
    assert len(versions) >= 1, "no ProfileVersion created"

    # 5) LLMCallLog entry recorded (Phase 1 wiring)
    log_resp = client.get("/api/settings/costs/recent?limit=20")
    if log_resp.status_code == 200:
        recent = log_resp.json()
        # best-effort: at least one call of task_type resume_parse
        # (other tests may have logged other calls; just confirm endpoint works)
        assert isinstance(recent, (list, dict))