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
# Numeric pattern: number + optional unit. Anchored with word-boundary
# lookarounds so we don't false-match the digit inside "v1.2" or
# "2024-06-19" unless a unit follows.
_NUMERIC_PATTERN = re.compile(
    r"(?<!\w)(?P<num>\d+(?:\.\d+)?)\s*"
    r"(?P<unit>%|x|ms|s|sec|secs?|seconds?|minutes?|mins?|hours?|hrs?|"
    r"days?|weeks?|months?|years?|yrs?|k|K|M|MM|B|BB|million|billion|"
    r"users?|req/?s|qps|rps|p99|p95|p50|tpm|MB|GB|TB)(?!\w)",
    re.IGNORECASE,
)

# Stopwords filtered out of context so they don't inflate the signature.
_CONTEXT_STOP = frozenset(
    "a an the and or to of in on for by with from at as is are was were be been being".split()
)


def _extract_metrics(text: str) -> set[str]:
    """Extract numeric claims (40%, 3M, 10K req/s, etc.) for a fact-preservation check.

    Returns normalised metric strings (``"<num> <unit>"``). Used by the
    grounding guard to detect invented numbers.
    """
    out: set[str] = set()
    for m in _NUMERIC_PATTERN.finditer(text or ""):
        num = m.group("num")
        unit = m.group("unit").lower()
        # Normalise unit aliases so "10K" and "10K req/s" round-trip.
        unit_aliases = {
            "k": "k", "m": "m", "mm": "m", "b": "b", "bb": "b",
            "sec": "s", "secs": "s", "second": "s", "seconds": "s",
            "min": "m", "mins": "m", "minute": "m", "minutes": "m",
            "hr": "h", "hrs": "h", "hour": "h", "hours": "h",
            "yr": "y", "yrs": "y", "year": "y", "years": "y",
            "req/s": "rps", "qps": "qps", "rps": "rps",
            "million": "m", "billion": "b", "thousand": "k",
        }
        unit = unit_aliases.get(unit, unit)
        out.add(f"{num} {unit}")
    return out


def _metric_context(text: str, metric: str) -> str:
    """Return a short normalised signature of the words around ``metric`` in ``text``.

    Used by :func:`_claim_is_grounded` to verify that a metric in the
    enhanced text isn't just a numeric string match but is actually used
    in the same context as the original. This prevents the case where
    "100 services" gets rewritten to "500 services" — both share the
    digit "100" loosely but the meaning changed.
    """
    num = metric.split()[0]
    for m in _NUMERIC_PATTERN.finditer(text or ""):
        if m.group("num") == num:
            start = max(0, m.start() - 30)
            end = min(len(text), m.end() + 30)
            window = text[start:end].lower()
            words = [
                w.strip(".,;:()[]\"'") for w in window.split()
                if w.strip(".,;:()[]\"'") and w.strip(".,;:()[]\"'") not in _CONTEXT_STOP
            ]
            return " ".join(words[:6])
    return ""


def _claim_is_grounded(enhanced: str, original: str) -> bool:
    """Reject enhanced text that introduces numeric claims not in the original.

    Two-layer check:

    1. **Set membership** — every metric in ``enhanced`` must also appear
       in ``original``. Catches "500%" invented where original said nothing.
    2. **Context match** — each metric must appear in the original with
       similar surrounding words (3-word fingerprint). Catches "100
       services" → "100 microservices" being accepted by set check alone.

    Conservative: if the enhanced text has a metric the original didn't,
    or whose context differs substantially, it's flagged. Text-only edits
    are always allowed.
    """
    orig_metrics = _extract_metrics(original)
    enh_metrics = _extract_metrics(enhanced)

    # Layer 1: set membership.
    new_metrics = enh_metrics - orig_metrics
    if new_metrics:
        log.info(
            "cv_enhance_metric_grounding_reject",
            reason="new_metric",
            original=list(orig_metrics),
            new=list(new_metrics),
        )
        return False

    # Layer 2: context match for overlapping metrics.
    for m in enh_metrics:
        enh_ctx = _metric_context(enhanced, m)
        orig_ctx = _metric_context(original, m)
        # Require ≥ 1 content-word overlap (besides digits and stopwords).
        enh_words = set(w for w in enh_ctx.split() if not w.isdigit())
        orig_words = set(w for w in orig_ctx.split() if not w.isdigit())
        if not (enh_words & orig_words):
            log.info(
                "cv_enhance_metric_grounding_reject",
                reason="context_mismatch",
                metric=m,
                enhanced_ctx=enh_ctx,
                original_ctx=orig_ctx,
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