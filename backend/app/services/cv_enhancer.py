"""LLM-driven CV section enhancer.

Like :mod:`app.services.match_narrator`, this is a thin layer over the
shared :class:`app.llm.client.LLMClient`. The enhancer is **fact-preserving**:
the LLM is forbidden from inventing skills, metrics, employers, dates, or
degrees that are not present in the input profile or job description.

Two entry points:

- :func:`enhance_section` — polish one section (summary, one job, etc.).
  Returns the polished text or ``None`` on failure.
- :func:`enhance_cv` — batch-enhance a full CV. Returns ``{section_key: text}``
  with sections the LLM could not improve left as ``None`` (caller falls
  back to the deterministic text).

The prompt enforces a strict JSON schema. Bad output (unparseable JSON,
missing keys, hallucinated facts detected by a simple post-check) is
discarded and the caller falls back to deterministic text.
"""

from __future__ import annotations

import json
import re
from typing import Any

import structlog

from app.llm.client import LLMClient, _safe_parse_json
from app.llm.prompts.loader import load_prompt

log = structlog.get_logger(__name__)

PROMPT_TASK_TYPE = "cv_enhance"
PROMPT_VERSION = "v1"


# ── Section builders ────────────────────────────────────────────────
def _serialize_summary(summary: str | None) -> dict[str, Any]:
    return {"section": "summary", "text": summary or ""}


def _serialize_experience(job: dict[str, Any], idx: int) -> dict[str, Any]:
    return {
        "section": "experience",
        "index": idx,
        "title": job.get("position") or job.get("title") or "",
        "company": job.get("name") or job.get("company") or "",
        "location": job.get("location") or "",
        "start": job.get("startDate") or job.get("start") or "",
        "end": job.get("endDate") if job.get("endDate") is not None else job.get("end"),
        "bullets": [b for b in (job.get("highlights") or job.get("bullets") or []) if b],
    }


def _serialize_bullets_only(bullets: list[str]) -> dict[str, Any]:
    return {"section": "bullets", "bullets": [b for b in bullets if b]}


def _serialize_skills(skills: list[str]) -> dict[str, Any]:
    return {"section": "skills", "skills": [s for s in skills if s]}


# ── Single-section enhancer ────────────────────────────────────────
async def enhance_section(
    *,
    section_kind: str,
    payload: dict[str, Any],
    target_keywords: list[str] | None = None,
    db: Any | None = None,
) -> dict[str, Any] | None:
    """Polish one CV section with the LLM.

    Args:
        section_kind: One of ``summary``, ``bullets``, ``experience``, ``skills``.
        payload: Section content as a JSON-serializable dict (see serializers).
        target_keywords: Optional ATS keywords to weave in (from job analysis).
        db: Optional SQLAlchemy session for call logging.

    Returns:
        Parsed JSON dict with the enhanced section, or ``None`` on failure
        (caller falls back to deterministic text). For ``bullets`` and
        ``experience`` kinds, the dict has a ``bullets`` array. For
        ``summary`` it has a ``text`` field. For ``skills`` it has a
        ``skills`` array.
    """
    system_prompt = load_prompt(PROMPT_TASK_TYPE, PROMPT_VERSION)
    payload_json = json.dumps(payload, indent=2, ensure_ascii=False)
    keywords_line = ""
    if target_keywords:
        kw = ", ".join(target_keywords[:25])
        keywords_line = f"\n\nTarget ATS keywords (weave in ONLY if already true): {kw}"

    full_prompt = (
        f"{system_prompt}\n\n---\n\n"
        f"## Section to enhance\n\n```json\n{payload_json}\n```{keywords_line}\n\n"
        "Return ONLY the JSON object for the enhanced section."
    )

    client = LLMClient()
    if db is not None:
        client.set_db(db)
    try:
        llm_result = await client.generate(
            full_prompt,
            task_type=PROMPT_TASK_TYPE,
            temperature=0.3,
            max_tokens=2000,  # headroom: MiniMax-M3 emits lengthy <think> block + JSON
            json_mode=True,
            prompt_version=PROMPT_VERSION,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("cv_enhance_llm_failed", section=section_kind, error=str(e)[:200])
        return None

    parsed = _safe_parse_json(llm_result.text or "")
    if not isinstance(parsed, dict):
        log.warning("cv_enhance_bad_json", section=section_kind, preview=(llm_result.text or "")[:300])
        return None

    # Normalize per section kind
    if section_kind == "summary":
        text = (parsed.get("text") or "").strip()
        if not text:
            return None
        return {"text": text}
    if section_kind in ("bullets", "experience"):
        bullets = parsed.get("bullets")
        if not isinstance(bullets, list) or not bullets:
            return None
        cleaned = [str(b).strip() for b in bullets if str(b).strip()][:8]
        if not cleaned:
            return None
        return {"bullets": cleaned}
    if section_kind == "skills":
        skills = parsed.get("skills")
        if not isinstance(skills, list) or not skills:
            return None
        cleaned = [str(s).strip() for s in skills if str(s).strip()][:30]
        if not cleaned:
            return None
        return {"skills": cleaned}
    # Unknown kind → return parsed as-is
    return parsed


# ── Fact-preservation guard ────────────────────────────────────────
_NUMERIC_PATTERN = re.compile(
    r"(?<!\w)(?P<num>\d+(?:\.\d+)?)\s*"
    r"(?P<unit>%|x|ms|s|sec|secs?|seconds?|minutes?|mins?|hours?|hrs?|"
    r"days?|weeks?|months?|years?|yrs?|k|K|M|MM|B|BB|million|billion|"
    r"users?|req/?s|qps|rps|p99|p95|p50|tpm|MB|GB|TB)(?!\w)",
    re.IGNORECASE,
)


def _extract_metrics(text: str) -> set[str]:
    """Extract numeric claims (40%, 3M, 10K req/s, etc.) for a fact-preservation check."""
    return {m.group(0).lower() for m in _NUMERIC_PATTERN.finditer(text or "")}


def _claim_is_grounded(enhanced: str, original: str) -> bool:
    """Reject enhanced text that introduces numeric claims not in the original.

    Conservative: if the enhanced text has a metric the original didn't,
    it's flagged. Text-only edits are always allowed.
    """
    orig_metrics = _extract_metrics(original)
    enh_metrics = _extract_metrics(enhanced)
    new_metrics = enh_metrics - orig_metrics
    if new_metrics:
        log.info(
            "cv_enhance_metric_grounding_reject",
            original=list(orig_metrics),
            new=list(new_metrics),
        )
        return False
    return True


# ── JSON parse helper (uses centralized _safe_parse_json from client) ──
# No local parser — the centralized one in app.llm.client handles think
# blocks + fences + brace-matching fallbacks.


# ── Convenience: enhance whole CV ──────────────────────────────────
async def enhance_cv_summary(
    *,
    profile: dict[str, Any],
    target_keywords: list[str] | None = None,
    db: Any | None = None,
) -> str | None:
    """Enhance the professional summary for a CV."""
    basics = profile.get("basics") or {}
    summary = basics.get("summary") or profile.get("summary") or ""
    payload = _serialize_summary(summary)
    result = await enhance_section(
        section_kind="summary",
        payload=payload,
        target_keywords=target_keywords,
        db=db,
    )
    if result is None:
        return None
    text = result.get("text", "")
    if not text or not _claim_is_grounded(text, summary):
        return None
    return text


async def enhance_job_bullets(
    *,
    bullets: list[str],
    title: str = "",
    company: str = "",
    target_keywords: list[str] | None = None,
    db: Any | None = None,
) -> list[str] | None:
    """Enhance the bullet points for one job entry.

    Fact-preserving: every numeric claim in the output must trace back to
    the original bullets. Output bullets are rejected (returns ``None``)
    if grounding fails.
    """
    payload = _serialize_bullets_only(bullets)
    if title or company:
        payload["title"] = title
        payload["company"] = company
    result = await enhance_section(
        section_kind="bullets",
        payload=payload,
        target_keywords=target_keywords,
        db=db,
    )
    if result is None:
        return None
    out_bullets = result.get("bullets") or []
    original_blob = "\n".join(bullets)
    for b in out_bullets:
        if not _claim_is_grounded(b, original_blob):
            # Whole enhancement rejected — keep deterministic
            return None
    return out_bullets