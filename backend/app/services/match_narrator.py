"""Phase 5 — LLM narrator for match results.

Takes the deterministic breakdown from ``matcher.compute_match`` and turns
it into a short human-readable narrative: summary + strengths + gaps.

Uses the same ``LLMClient`` and prompt loader as the rest of the app. If
the LLM call fails, returns None — the deterministic score is still
authoritative, the narrative is optional polish.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.llm.client import LLMClient, _safe_parse_json
from app.llm.prompts.loader import load_prompt
from app.services.matcher import MatchResult


log = get_logger("match_narrator")

PROMPT_TASK_TYPE = "match_narrate"
PROMPT_VERSION = "v1"


def _build_breakdown_payload(result: MatchResult) -> dict[str, Any]:
    """Serialize the deterministic result into a compact prompt payload.

    Kept terse on purpose — the LLM only needs the facts, not the math.
    """
    return {
        "overall_score": round(result.score, 3),
        "component_scores": {
            "skill": round(result.skill_score, 3),
            "experience": round(result.experience_score, 3),
            "seniority": round(result.seniority_score, 3),
            "education": round(result.education_score, 3),
        },
        "recommendation": result.recommendation,
        "matched_skills": [
            {
                "category": m.required_skill,
                "required": m.required_keyword,
                "matched": m.matched_keyword,
                "strength": m.strength,
            }
            for m in result.matched[:8]  # cap so prompt stays small
        ],
        "missing_skills": [
            {"category": m.required_skill, "required": m.required_keyword}
            for m in result.missing[:8]
        ],
        "experience": (
            {
                "required_years": result.experience.required_years,
                "profile_years": result.experience.profile_years,
                "status": result.experience.status,
            }
            if result.experience else None
        ),
        "seniority": (
            {
                "job": result.seniority.job_seniority,
                "profile": result.seniority.profile_seniority,
                "status": result.seniority.status,
            }
            if result.seniority else None
        ),
        "education": (
            {
                "required": result.education.required,
                "profile": result.education.profile,
                "status": result.education.status,
            }
            if result.education else None
        ),
    }


async def narrate_match(
    result: MatchResult,
    db: Session,
) -> dict[str, Any] | None:
    """Run the LLM narrator on a deterministic match result.

    Returns the parsed narrative dict ``{summary, strengths, gaps}`` or
    None if the call failed. The deterministic score is unaffected.
    """
    payload = _build_breakdown_payload(result)
    system_prompt = load_prompt(PROMPT_TASK_TYPE, PROMPT_VERSION)

    full_prompt = (
        f"{system_prompt}\n\n"
        "---\n\n"
        "## Match breakdown\n\n"
        f"```json\n{json.dumps(payload, indent=2)}\n```\n"
    )

    client = LLMClient()
    client.set_db(db)
    try:
        llm_result = await client.generate(
            full_prompt,
            task_type=PROMPT_TASK_TYPE,
            temperature=0.2,    # low — want consistent, factual prose
            max_tokens=800,
            json_mode=True,
            prompt_version=PROMPT_VERSION,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("narrate_match_llm_failed", error=str(e)[:200])
        return None

    parsed = _safe_parse_json(llm_result.text or "")
    if not isinstance(parsed, dict):
        log.warning("narrate_match_bad_json", preview=(llm_result.text or "")[:120])
        return None

    # Defensive: clamp to expected shape, drop unknown keys.
    return {
        "summary": (parsed.get("summary") or "").strip() or None,
        "strengths": [str(s).strip() for s in (parsed.get("strengths") or []) if str(s).strip()][:4],
        "gaps": [str(s).strip() for s in (parsed.get("gaps") or []) if str(s).strip()][:4],
    }