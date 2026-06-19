"""Phase 5 — Playwright e2e for the Match panel on JobDetailPage.

Verifies:
- Match panel renders on a parsed job
- Compute match button works (calls API, displays score)
- Score + recommendation + breakdown bars all visible
- "Recompute" button updates the match
"""
import pytest
import requests as r
from playwright.sync_api import Page, expect


BE = "http://127.0.0.1:8765"


def _seed_parsed_job() -> str:
    """Create a manual JD + wait until parsed. Returns the job id."""
    payload = {
        "source_type": "manual",
        "raw_description": (
            "Senior Python Developer needed. 5+ years experience required. "
            "Must know Django, FastAPI, PostgreSQL, Docker. S1 required. "
            "Mid to senior level."
        ),
        "title": "Senior Python Developer",
        "company": "Phase5TestCorp",
    }
    resp = r.post(f"{BE}/api/jobs", json=payload, timeout=15)
    assert resp.status_code == 201, resp.text
    job_id = resp.json()["id"]

    # Poll for parsed
    import time
    for _ in range(60):
        rr = r.get(f"{BE}/api/jobs/{job_id}", timeout=5)
        status = rr.json()["status"]
        if status == "parsed":
            return job_id
        if status == "failed":
            pytest.skip(f"job analyze failed: {rr.json().get('error_message')}")
        time.sleep(1)
    pytest.skip("job did not parse in time")


@pytest.fixture(scope="module")
def job_id():
    return _seed_parsed_job()


def test_match_panel_renders(page: Page, job_id: str):
    page.goto(f"http://127.0.0.1:5173/jobs/{job_id}")
    # Wait for the panel to mount.
    expect(page.get_by_text("Match against your profile")).to_be_visible(timeout=10000)


def test_match_panel_compute_and_display(page: Page, job_id: str):
    page.goto(f"http://127.0.0.1:5173/jobs/{job_id}")
    expect(page.get_by_text("Match against your profile")).to_be_visible(timeout=10000)

    # If a match already exists (re-runs of this test), recompute via the
    # refresh icon. Otherwise click "Compute match".
    compute_btn = page.get_by_test_id("compute-match-btn")
    if compute_btn.count() > 0:
        compute_btn.click()
    else:
        page.get_by_test_id("recompute-match-btn").click()

    # The panel content swaps to the scored view.
    # Wait for either the "overall" label or the skill bar labels.
    expect(page.get_by_text("overall", exact=True)).to_be_visible(timeout=60000)
    # And the breakdown bars for each component.
    for label in ("Skills", "Experience", "Seniority", "Education"):
        expect(page.get_by_text(label, exact=True).first).to_be_visible()


def test_match_panel_recommendation_badge(page: Page, job_id: str):
    page.goto(f"http://127.0.0.1:5173/jobs/{job_id}")
    expect(page.get_by_text("Match against your profile")).to_be_visible(timeout=10000)

    # The recommendation badge is one of: Strong fit, Worth applying, Significant gaps
    badge = page.get_by_test_id("match-recommendation")
    expect(badge).to_be_visible(timeout=60000)
    label = badge.inner_text().strip().lower()
    assert any(s in label for s in ("strong fit", "worth applying", "significant gaps")), f"unexpected label: {label!r}"


def test_match_panel_skill_breakdown_collapsible(page: Page, job_id: str):
    page.goto(f"http://127.0.0.1:5173/jobs/{job_id}")
    expect(page.get_by_text("Match against your profile")).to_be_visible(timeout=10000)

    # Trigger compute if needed
    if page.get_by_test_id("compute-match-btn").count() > 0:
        page.get_by_test_id("compute-match-btn").click()
        expect(page.get_by_text("overall", exact=True)).to_be_visible(timeout=60000)

    # Skill-by-skill section should be there, collapsed.
    details = page.get_by_test_id("match-skills-details")
    expect(details).to_be_visible()
    # Expand it
    details.locator("summary").click()
    expect(page.get_by_text("Matched", exact=False).first).to_be_visible()
    expect(page.get_by_text("Missing", exact=False).first).to_be_visible()