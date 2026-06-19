"""JD analyzer service — orchestrates LLM analyze + persistence.

Pipeline (called by the API layer after raw text is available):

1. Load the ``Job`` row (status must be ``parsing``).
2. Build the LLM message: prompt + raw_description.
3. Call ``LLMClient.generate`` with ``task_type="job_analyze"``.
4. ``_safe_parse_json`` the response (handles think blocks + fences).
5. Validate against ``JobAnalysisIn`` (Pydantic v2).
6. Compute a confidence score (non-empty sections / expected sections).
7. Extract ATS keywords (union of required + preferred skill keywords).
8. Update the ``Job`` row: title/company/location/etc., salary,
   ``job_analysis_json``, ``ats_keywords_json``, ``parsed_at``,
   ``status='parsed'``.

The orchestrator is intentionally synchronous — the API layer wraps it
in ``BackgroundTasks`` so the POST endpoint returns immediately while
analyzing happens out-of-band.

This module does NOT touch scraping — that's BE-1's job and the API
layer runs it inline (for URL paths) before kicking off ``analyze_jd``.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.llm.client import LLMClient, _safe_parse_json
from app.llm.prompts.loader import load_prompt
from app.models.models import Job
from app.schemas.schemas import (
    JobAnalysisIn,
    SalaryRange,
    SkillGroup,
)

log = get_logger(__name__)


# ── Defaults / constants ──────────────────────────────────────────

PROMPT_TASK_TYPE = "job_analyze"
PROMPT_VERSION = "v1"

# Section-presence check for confidence scoring. The denominator — the
# same set the analyzer was told to populate — is the source of truth.
EXPECTED_SECTIONS: tuple[str, ...] = (
    "title",          # already required, always present
    "company",
    "location",
    "remote_type",
    "employment_type",
    "seniority",
    "salary",
    "summary",
    "responsibilities",
    "required_skills",
    "preferred_skills",
    "required_experience_years",
    "required_education",
    "ats_keywords",
)


def _section_present(section_name: str, parsed: dict[str, Any]) -> bool:
    """Return True if the analyzer populated ``section_name`` meaningfully."""
    val = parsed.get(section_name)
    if section_name == "title":
        return bool(val)
    if section_name == "salary":
        # SalaryRange sub-object — present if any of min/max/currency set.
        if isinstance(val, dict) and any(val.get(k) is not None for k in ("min", "max", "currency")):
            return True
        return False
    if section_name in ("required_skills", "preferred_skills", "responsibilities", "ats_keywords"):
        return isinstance(val, list) and len(val) > 0
    return val is not None and val != ""


def compute_confidence(parsed: dict[str, Any]) -> float:
    """Return 0.0–1.0: fraction of expected sections that are non-empty.

    Uses ``EXPECTED_SECTIONS`` as the denominator — the same set the
    prompt was told to populate. A JD that came back with only ``title``
    should score ~1/14 so the UI can flag low confidence.
    """
    if not isinstance(parsed, dict):
        return 0.0
    present = sum(1 for s in EXPECTED_SECTIONS if _section_present(s, parsed))
    return round(present / max(len(EXPECTED_SECTIONS), 1), 4)


def extract_ats_keywords(parsed: dict[str, Any]) -> list[str]:
    """Union of required_skills[].keywords + preferred_skills[].keywords.

    Falls back to the LLM's flat ``ats_keywords`` field if no skill
    groups were extracted. Always returns a flat list of strings
    (case-preserving, dedup preserves first-seen order).
    """
    seen: dict[str, None] = {}
    for group_name in ("required_skills", "preferred_skills"):
        for group in parsed.get(group_name) or []:
            if not isinstance(group, dict):
                continue
            for kw in group.get("keywords") or []:
                if isinstance(kw, str) and kw.strip():
                    key = kw.strip()
                    if key not in seen:
                        seen[key] = None
    if not seen:
        # Fallback to the LLM's pre-flattened list.
        for kw in parsed.get("ats_keywords") or []:
            if isinstance(kw, str) and kw.strip():
                key = kw.strip()
                if key not in seen:
                    seen[key] = None
    return list(seen.keys())


# ── DB updates ────────────────────────────────────────────────────


def _apply_to_job(job: Job, validated: JobAnalysisIn, confidence: float) -> None:
    """Flatten validated analysis onto the Job row + JSON columns.

    The Job model has flat columns for the most important fields (so
    the API can serve them without unpacking JSON) AND JSON columns
    for the full structured analysis (so downstream matchers can use
    the rich shape).
    """
    d = validated.model_dump()

    # Flat scalar columns.
    job.title = validated.title
    if validated.company is not None:
        job.company = validated.company
    if validated.location is not None:
        job.location = validated.location
    if validated.remote_type is not None:
        job.remote = validated.remote_type == "remote"
    if validated.employment_type is not None:
        job.employment_type = validated.employment_type
    if validated.seniority is not None:
        job.seniority = validated.seniority

    # Salary sub-object → flat columns.
    if validated.salary is not None:
        job.salary_min = validated.salary.min
        job.salary_max = validated.salary.max
        job.salary_currency = validated.salary.currency

    # Full structured analysis + flat ATS keywords.
    job.job_analysis_json = d
    job.ats_keywords_json = {"keywords": extract_ats_keywords(d)}

    # The analyzer itself doesn't compute confidence (the orchestrator
    # does), but the job row gets it for parity with the analysis JSON.
    # We also stash it inside the analysis JSON so downstream readers
    # don't need to know about the column.
    d["confidence_score"] = confidence
    job.job_analysis_json = d

    job.status = "parsed"
    job.error_message = None
    job.parsed_at = datetime.now(timezone.utc)


# ── Main entry point ──────────────────────────────────────────────


async def analyze_jd(job_id: str, db: Session) -> dict[str, Any]:
    """Drive an analyze for the given ``Job`` and persist results.

    Steps:
      1. Load the job row; assert status == ``parsing``.
      2. Build the prompt (system role + versioned body) and append
         the raw JD text as the user message.
      3. Call ``LLMClient.generate`` with ``task_type="job_analyze"``.
      4. ``_safe_parse_json`` the response.
      5. Validate against ``JobAnalysisIn`` (Pydantic v2).
      6. Score confidence + extract ATS keywords.
      7. Persist: update the Job row.

    On any failure: mark the job as ``failed`` with an ``error_message``
    and re-raise. Callers should swallow + log so BackgroundTasks doesn't
    propagate to the user.
    """
    job = db.get(Job, job_id)
    if job is None:
        raise ValueError(f"Job {job_id!r} not found")
    if job.status != "parsing":
        raise ValueError(
            f"Job {job_id!r} status={job.status!r}, expected 'parsing'"
        )
    raw_text = (job.raw_description or "").strip()
    if not raw_text:
        job.status = "failed"
        job.error_message = "empty raw_description; cannot analyze"
        db.commit()
        raise RuntimeError("empty raw_description — refusing to call LLM")

    # Build the prompt. We send the prompt as a single string: the
    # versioned system instructions, then the JD text clearly delimited.
    system_prompt = load_prompt(PROMPT_TASK_TYPE, PROMPT_VERSION)
    full_prompt = (
        f"{system_prompt}\n\n"
        "---\n\n"
        "## Job description to analyze\n\n"
        f"{raw_text}\n"
    )

    # Call the LLM. We pass the DB session so the client can log cost rows.
    client = LLMClient()
    client.set_db(db)
    try:
        llm_result = await client.generate(
            full_prompt,
            task_type=PROMPT_TASK_TYPE,
            temperature=0.0,        # deterministic extraction — no creativity wanted
            max_tokens=3000,
            json_mode=True,
            prompt_version=PROMPT_VERSION,
        )
    except Exception as e:  # noqa: BLE001
        job.status = "failed"
        job.error_message = f"llm_call_failed: {e}"[:1000]
        db.commit()
        log.error("analyze_jd_llm_failed", job_id=job_id, error=str(e))
        raise

    raw_response = llm_result.text or ""
    parsed_obj = _safe_parse_json(raw_response)
    if parsed_obj is None:
        job.status = "failed"
        job.error_message = "llm_returned_invalid_json"
        db.commit()
        raise RuntimeError("LLM did not return parseable JSON")

    # Normalize to a dict (some providers may emit a list).
    if not isinstance(parsed_obj, dict):
        job.status = "failed"
        job.error_message = f"llm_returned_non_object: {type(parsed_obj).__name__}"
        db.commit()
        raise RuntimeError(f"LLM returned non-object JSON: {type(parsed_obj).__name__}")

    # Validate against the Pydantic schema. Title is the only required
    # field — if the LLM left it out, that's a parse failure.
    try:
        validated = JobAnalysisIn.model_validate(parsed_obj)
    except Exception as e:  # noqa: BLE001
        job.status = "failed"
        job.error_message = f"schema_validation_failed: {e}"[:1000]
        db.commit()
        log.warning("analyze_jd_schema_invalid", job_id=job_id, error=str(e))
        raise

    parsed_dict = validated.model_dump()
    confidence = compute_confidence(parsed_dict)

    # Persist: flatten to the Job row + stash the full analysis + ATS keywords.
    _apply_to_job(job, validated, confidence)
    db.commit()
    db.refresh(job)

    log.info(
        "analyze_jd_done",
        job_id=job_id,
        confidence=confidence,
        ats_kw_count=len(job.ats_keywords_json.get("keywords", [])),
    )
    return {
        "job": job,
        "analysis": parsed_dict,
        "confidence": confidence,
        "ats_keywords": job.ats_keywords_json.get("keywords", []),
    }