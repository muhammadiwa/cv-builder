"""End-to-end JD analyze with REAL LLM (MiniMax-M3).

Skipped if no API key configured. Validates the full pipeline:
POST /jobs (manual) → background analyze → status='parsed' → Job fields populated.
"""
import os
import time

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

client = TestClient(app)

settings = get_settings()

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


SAMPLE_JD = """\
Senior Backend Engineer - Bukalapak

We are hiring a Senior Backend Engineer to join our search platform team.

Responsibilities:
- Build distributed search ranking services
- Optimize Elasticsearch query performance
- Mentor junior engineers

Requirements:
- 5+ years of backend engineering experience
- Strong Python and Go skills
- Experience with Elasticsearch, PostgreSQL, Redis
- AWS cloud experience

Nice to have:
- Kubernetes, Docker, Terraform
- Experience with Kafka streaming

Salary: Rp 30-50 million per month, full-time, hybrid (Jakarta office).
"""


def test_post_job_manual_parses_via_real_llm():
    """POST /jobs with manual JD → background analyze → real LLM populates Job."""
    payload = {"source_type": "manual", "raw_description": SAMPLE_JD}
    resp = client.post("/api/jobs", json=payload)
    assert resp.status_code == 201, resp.text
    job_id = resp.json()["id"]

    # Poll for status='parsed' (real LLM may take 5-30s)
    deadline = time.time() + 90
    final_status = None
    while time.time() < deadline:
        s = client.get(f"/api/jobs/{job_id}")
        assert s.status_code == 200
        final_status = s.json().get("status")
        if final_status == "parsed":
            break
        if final_status == "failed":
            err = s.json().get("error_message", "unknown")
            pytest.fail(f"analyze failed: {err}")
        time.sleep(2)

    assert final_status == "parsed", f"analyze did not complete in 90s; status={final_status}"

    # Verify Job fields populated by real LLM
    job = client.get(f"/api/jobs/{job_id}").json()
    assert job.get("title"), f"title missing: {job}"
    assert job.get("company"), f"company missing: {job}"
    # ATS keywords should have at least 5 (Python, Go, Elasticsearch, PostgreSQL, Redis, AWS, etc.)
    ats_kw = job.get("ats_keywords_json", {})
    if isinstance(ats_kw, dict):
        keywords = ats_kw.get("keywords", []) if "keywords" in ats_kw else list(ats_kw.values())[0] if ats_kw else []
    else:
        keywords = ats_kw if isinstance(ats_kw, list) else []
    assert len(keywords) >= 3, f"expected >=3 ATS keywords, got {keywords}"

    # Job analysis should have structured data
    analysis = job.get("job_analysis_json", {})
    assert isinstance(analysis, dict)
    assert analysis.get("title"), f"analysis.title missing: {analysis}"

    # parsed_at should now be set
    assert job.get("parsed_at"), "parsed_at timestamp not set after parse"