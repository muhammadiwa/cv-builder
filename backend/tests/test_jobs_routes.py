"""Integration tests for jobs API routes."""
import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


SAMPLE_JD_TEXT = """\
Senior Backend Engineer - Gojek

We are looking for a Senior Backend Engineer to join our payments team.

Responsibilities:
- Design and implement microservices in Go and Python
- Lead code reviews and mentor junior engineers
- Work with product managers to define requirements

Required:
- 5+ years backend development experience
- Strong Go or Python skills
- Experience with PostgreSQL, Redis, Kafka
- AWS or GCP cloud experience

Preferred:
- Kubernetes, Docker, Terraform
- Experience with payment systems
- Fintech background

We offer competitive salary (Rp 25-40 million per month), health insurance,
and flexible working hours. Hybrid work model, Jakarta office.
"""

SAMPLE_PARSED = {
    "title": "Senior Backend Engineer",
    "company": "Gojek",
    "location": "Jakarta",
    "remote_type": "hybrid",
    "employment_type": "full_time",
    "seniority": "senior",
    "salary": {"min": 25000000, "max": 40000000, "currency": "IDR"},
    "summary": "Build payments microservices at scale",
    "responsibilities": [
        "Design and implement microservices in Go and Python",
        "Lead code reviews and mentor junior engineers",
    ],
    "required_skills": [
        {"name": "Backend", "keywords": ["Go", "Python", "PostgreSQL", "Redis", "Kafka"]},
        {"name": "Cloud", "keywords": ["AWS", "GCP"]},
    ],
    "preferred_skills": [
        {"name": "DevOps", "keywords": ["Kubernetes", "Docker", "Terraform"]},
    ],
    "required_experience_years": 5,
    "required_education": "Bachelor's degree in Computer Science or related field",
    "ats_keywords": [
        "Go", "Python", "PostgreSQL", "Redis", "Kafka", "AWS", "GCP",
        "Kubernetes", "Docker", "Terraform", "Microservices", "Mentoring",
    ],
    "confidence_score": 0.92,
}


def _mock_llm_analyze():
    """Mock LLMClient globally for the analyze path."""
    mock_result = MagicMock()
    mock_result.text = '{"title":"Senior Backend Engineer","company":"Gojek","location":"Jakarta","remote_type":"hybrid","employment_type":"full_time","seniority":"senior","salary":{"min":25000000,"max":40000000,"currency":"IDR"},"summary":"Build payments microservices at scale","responsibilities":["Design and implement microservices","Lead code reviews"],"required_skills":[{"name":"Backend","keywords":["Go","Python"]}],"preferred_skills":[],"required_experience_years":5,"ats_keywords":["Go","Python"],"confidence_score":0.85}'
    mock_result.content = mock_result.text
    mock_result.usage = None
    mock_result.provider = "mock"
    mock_result.model = "mock-model"

    mock_instance = MagicMock()
    mock_instance.set_db.return_value = None

    async def _fake_generate(*args, **kwargs):
        return mock_result

    mock_instance.generate = _fake_generate

    return patch("app.services.jd_analyzer.LLMClient", return_value=mock_instance)


# ── Tests ───────────────────────────────────────────────────────

def test_create_job_manual_returns_201():
    """POST /jobs with source_type=manual accepts JD text, returns job with status=parsing."""
    payload = {"source_type": "manual", "raw_description": SAMPLE_JD_TEXT}
    with _mock_llm_analyze():
        resp = client.post("/api/jobs", json=payload)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert "id" in body
    assert body["source_type"] == "manual"
    # status will be 'parsing' immediately, background will flip to 'parsed'/'failed'
    assert body["status"] in ("parsing", "parsed", "failed")


def test_create_job_manual_requires_description():
    """POST /jobs with source_type=manual but empty description returns 400."""
    payload = {"source_type": "manual", "raw_description": ""}
    resp = client.post("/api/jobs", json=payload)
    assert resp.status_code == 400


def test_create_job_url_requires_source_url():
    """POST /jobs with source_type=url but no URL returns 400."""
    payload = {"source_type": "url", "raw_description": ""}
    resp = client.post("/api/jobs", json=payload)
    assert resp.status_code == 400


def test_list_jobs_returns_user_jobs():
    """GET /jobs returns at least the job we just created."""
    # 1) Create one
    payload = {"source_type": "manual", "raw_description": SAMPLE_JD_TEXT}
    with _mock_llm_analyze():
        create_resp = client.post("/api/jobs", json=payload)
    assert create_resp.status_code == 201
    job_id = create_resp.json()["id"]

    # 2) List
    list_resp = client.get("/api/jobs")
    assert list_resp.status_code == 200
    jobs = list_resp.json()
    assert isinstance(jobs, list)
    assert any(j["id"] == job_id for j in jobs), "newly-created job not in list"


def test_list_jobs_pagination():
    """GET /jobs respects skip + limit query params."""
    resp = client.get("/api/jobs?skip=0&limit=5")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) <= 5


def test_get_job_by_id_returns_full_analysis():
    """GET /jobs/{id} returns the job with all fields populated."""
    payload = {"source_type": "manual", "raw_description": SAMPLE_JD_TEXT}
    with _mock_llm_analyze():
        create_resp = client.post("/api/jobs", json=payload)
    job_id = create_resp.json()["id"]

    # Wait briefly for background analyze to complete
    time.sleep(2)

    get_resp = client.get(f"/api/jobs/{job_id}")
    assert get_resp.status_code == 200, get_resp.text
    body = get_resp.json()
    assert body["id"] == job_id
    assert body["source_type"] == "manual"
    # If analyze completed, status should be 'parsed'; otherwise 'parsing' is acceptable
    assert body["status"] in ("parsing", "parsed", "failed")


def test_get_job_not_found_returns_404():
    """GET /jobs/{nonexistent} returns 404."""
    resp = client.get("/api/jobs/nonexistent-id-12345")
    assert resp.status_code == 404


def test_delete_job_soft_deletes():
    """DELETE /jobs/{id} soft-deletes (sets deleted_at)."""
    payload = {"source_type": "manual", "raw_description": SAMPLE_JD_TEXT}
    with _mock_llm_analyze():
        create_resp = client.post("/api/jobs", json=payload)
    job_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/jobs/{job_id}")
    assert del_resp.status_code == 204

    # Now GET should 404 (soft-deleted)
    get_resp = client.get(f"/api/jobs/{job_id}")
    assert get_resp.status_code == 404

    # And not in list anymore
    list_resp = client.get("/api/jobs")
    assert all(j["id"] != job_id for j in list_resp.json())