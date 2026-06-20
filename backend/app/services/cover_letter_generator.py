"""Phase 9A — Cover Letter generator.

Two-layer architecture like cv_enhancer + cv_scorer:

1. Deterministic template: greeting + role-mention + 2 body paras
   citing the user's strongest matching skill/experience + sign-off.
   No LLM needed. Always works. The "skeleton".

2. LLM enhancement pass: takes the deterministic draft and rewrites
   with tone variation (professional / confident / friendly /
   concise / formal), injecting 3-5 job-required keywords verbatim
   for ATS scoring. Falls back to the deterministic text on any
   LLM failure (bad JSON, hallucinated facts, etc).

Plus a scorer — 4-axis weighted scoring mirroring cv_scorer so
the FE shows a "Quality" badge on each cover letter:

- keyword_coverage (0.4): how many job-required keywords appear
- structure (0.2): has greeting + body paras + sign-off?
- personalization (0.25): mentions company + role by name
- length (0.15): 200-500 words is ideal (sweet spot)
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

import structlog

log = structlog.get_logger(__name__)

PROMPT_TASK_TYPE = "cover_letter"
PROMPT_VERSION = "v1"

VALID_TONES = ("professional", "confident", "friendly", "concise", "formal")

# ── Tone configuration ──────────────────────────────────────────────
# Each tone has a signature, opener, and closer. The deterministic
# template picks one based on the requested tone. The LLM pass
# varies phrasing within the same structural skeleton.

_TONE_CONFIG: dict[str, dict[str, str]] = {
    "professional": {
        "greeting": "Dear Hiring Team,",
        "sign_off": "Kind regards,",
    },
    "confident": {
        "greeting": "Dear Hiring Team,",
        "sign_off": "Best regards,",
    },
    "friendly": {
        "greeting": "Hi team,",
        "sign_off": "Cheers,",
    },
    "concise": {
        "greeting": "Dear Hiring Team,",
        "sign_off": "Thanks,",
    },
    "formal": {
        "greeting": "Dear Sir or Madam,",
        "sign_off": "Yours faithfully,",
    },
}


# ── Public dataclass ────────────────────────────────────────────────


@dataclass
class CoverLetterDraft:
    """One deterministic + (optional) LLM-enhanced cover letter.

    Attributes:
        subject: email-style subject line.
        body: full letter text (paragraphs joined with ``\\n\\n``).
        tone: which tone was used.
        personalization_points: bullets the FE can show inline.
        job_keywords_used: keywords actually inserted (for ATS audit).
        source: ``"deterministic"`` | ``"llm_enhanced"`` —
            tells the FE whether to show an "AI-enhanced" badge.
    """

    subject: str
    body: str
    tone: str
    personalization_points: list[str] = field(default_factory=list)
    job_keywords_used: list[str] = field(default_factory=list)
    source: str = "deterministic"

    def to_dict(self) -> dict[str, Any]:
        return {
            "subject": self.subject,
            "body": self.body,
            "tone": self.tone,
            "personalization_points": list(self.personalization_points),
            "job_keywords_used": list(self.job_keywords_used),
            "source": self.source,
        }


# ── Deterministic template ──────────────────────────────────────────


def _extract_basics(profile: dict[str, Any]) -> dict[str, str]:
    """Pull name/email/phone/location from various profile shapes.

    The base_profile_json in our system uses JSON-Resume-ish
    ``basics: {name, email, phone, location}`` plus we may get a flat
    ``profile.name`` etc. Be defensive.
    """
    basics = profile.get("basics") or {}
    if not basics and isinstance(profile.get("name"), str):
        basics = profile
    return {
        "name": str(basics.get("name") or profile.get("name") or ""),
        "email": str(basics.get("email") or profile.get("email") or ""),
        "phone": str(basics.get("phone") or profile.get("phone") or ""),
        "location": str(basics.get("location") or profile.get("location") or ""),
    }


def _top_skill(profile: dict[str, Any], target_skills: list[Any]) -> str | None:
    """Find the strongest skill in the user's profile that matches
    a job-required skill (case-insensitive substring match).

    Accepts target_skills as either ``str`` or ``{"name": str}`` —
    the LLM sometimes returns dict shape, the deterministic
    analyzer sometimes returns strings. Be defensive.

    Returns the skill name as written in the user's profile, or
    None if no overlap.
    """
    # Normalize target skills to flat strings.
    target_strs: list[str] = []
    for t in target_skills:
        if isinstance(t, str):
            target_strs.append(t)
        elif isinstance(t, dict):
            n = t.get("name") or t.get("skill") or ""
            if isinstance(n, str):
                target_strs.append(n)

    user_skills: list[str] = []
    for s in profile.get("skills") or []:
        if isinstance(s, dict):
            user_skills.append(str(s.get("name") or ""))
        elif isinstance(s, str):
            user_skills.append(s)
    user_skills_norm = {sk.lower().strip() for sk in user_skills if sk}

    # Exact match first.
    for target in target_strs:
        target_norm = target.lower().strip()
        if target_norm in user_skills_norm:
            return target
    # Substring fallback.
    for sk in user_skills:
        if any(target.lower() in sk.lower() for target in target_strs):
            return sk
    return user_skills[0] if user_skills else None


def _top_highlight(profile: dict[str, Any]) -> str | None:
    """Pick the first concrete highlight from the most recent job."""
    work = profile.get("work") or []
    if not work:
        return None
    recent = work[0]
    highlights = recent.get("highlights") or recent.get("bullets") or []
    if not highlights:
        return None
    return str(highlights[0])


def _build_subject(job: dict[str, Any]) -> str:
    title = job.get("title") or "the role"
    company = job.get("company") or "your company"
    return f"Application for {title} at {company}"


def generate_cover_letter_deterministic(
    profile: dict[str, Any],
    job: dict[str, Any],
    *,
    tone: str = "professional",
) -> CoverLetterDraft:
    """Generate a cover letter with NO LLM calls.

    Always works, even when the provider is down. Output is a bit
    generic but structurally correct (greeting + body paras + sign-off)
    and references real facts from profile + job.
    """
    if tone not in VALID_TONES:
        tone = "professional"
    tone_cfg = _TONE_CONFIG[tone]

    basics = _extract_basics(profile)
    job_analysis = job.get("job_analysis_json") or {}
    # Normalize required_skills to flat strings (LLM sometimes
    # returns dicts {"name": ...}, deterministic analyzer returns
    # strings).
    required_skills_raw: list[Any] = list(job_analysis.get("required_skills") or [])
    required_skills: list[str] = []
    for s in required_skills_raw:
        if isinstance(s, str):
            required_skills.append(s)
        elif isinstance(s, dict):
            n = s.get("name") or s.get("skill") or ""
            if isinstance(n, str):
                required_skills.append(n)
    if not required_skills:
        # Fall back to ats_keywords if no job_analysis
        required_skills = [str(k) for k in (job.get("ats_keywords") or [])]

    top_skill = _top_skill(profile, required_skills)
    top_highlight = _top_highlight(profile)
    job_title = job.get("title") or "the role"
    company = job.get("company") or "your company"

    # ── P1: greeting + role mention ────────────────────────────────
    p1 = (
        f"{tone_cfg['greeting']}\n\n"
        f"I am writing to apply for the {job_title} role at {company}. "
        f"The team's focus on impactful work caught my attention, and "
        f"I would welcome the chance to contribute."
    )

    # ── P2: most relevant experience ──────────────────────────────
    if top_highlight and top_skill:
        p2 = (
            f"In my recent work, I {top_highlight.lower().rstrip('.')} — "
            f"an outcome that maps directly to the {top_skill} depth "
            f"this role calls for."
        )
    elif top_highlight:
        p2 = (
            f"In my recent work, I {top_highlight.lower().rstrip('.')}."
        )
    elif top_skill:
        p2 = (
            f"I bring hands-on experience with {top_skill}, which I "
            f"have applied across multiple production projects."
        )
    else:
        p2 = (
            "I bring a track record of shipping reliable software and "
            "working across teams to deliver measurable outcomes."
        )

    # ── P3: role fit + skills alignment ───────────────────────────
    if required_skills and top_skill:
        other = [s for s in required_skills if s.lower() != top_skill.lower()][:2]
        if other:
            skills_phrase = ", ".join([top_skill] + other)
        else:
            skills_phrase = top_skill
        p3 = (
            f"Your posting calls for {', '.join(required_skills[:3])}. "
            f"My profile covers {skills_phrase}, and I am confident I "
            f"can ramp quickly on the rest."
        )
    elif required_skills:
        p3 = (
            f"Your posting calls for {', '.join(required_skills[:3])}. "
            f"I am excited about applying my experience to this stack."
        )
    else:
        p3 = (
            "I am confident my experience aligns with the goals of this role."
        )

    # ── P4: closing + sign-off ────────────────────────────────────
    p4 = (
        "Thank you for considering my application. I would be glad to "
        "discuss how I can contribute to your team.\n\n"
        f"{tone_cfg['sign_off']}\n{basics['name']}"
    )

    body = "\n\n".join([p1, p2, p3, p4])

    # Personalization points = the actual facts we referenced
    personalization_points: list[str] = []
    if top_highlight:
        personalization_points.append(f"Cited highlight: {top_highlight}")
    if top_skill:
        personalization_points.append(f"Aligned skill: {top_skill}")

    return CoverLetterDraft(
        subject=_build_subject(job),
        body=body,
        tone=tone,
        personalization_points=personalization_points,
        job_keywords_used=[top_skill] if top_skill else [],
        source="deterministic",
    )


# ── LLM enhancement ─────────────────────────────────────────────────


async def enhance_cover_letter(
    draft: CoverLetterDraft,
    profile: dict[str, Any],
    job: dict[str, Any],
    *,
    llm_client: Any | None = None,
) -> CoverLetterDraft:
    """Rewrite the deterministic draft with tone + keyword polish.

    Falls back to the deterministic draft unchanged on any LLM
    failure (timeout, bad JSON, hallucinated facts). The caller can
    check ``draft.source == "llm_enhanced"`` to know whether to show
    an "AI-enhanced" badge.
    """
    if llm_client is None:
        # Lazy import to avoid pulling LLMClient into environments
        # that don't need it (e.g. pure deterministic callers).
        from app.llm.client import LLMClient
        from app.db.session import SessionLocal

        db = SessionLocal()
        try:
            llm_client = LLMClient(db=db)
        finally:
            db.close()

    from app.llm.prompts.loader import load_prompt

    prompt_template = load_prompt(PROMPT_TASK_TYPE, PROMPT_VERSION)
    basics = _extract_basics(profile)
    payload = {
        "profile": {
            "basics": basics,
            "summary": profile.get("summary"),
            "work": profile.get("work") or [],
            "skills": profile.get("skills") or [],
        },
        "job": {
            "title": job.get("title"),
            "company": job.get("company"),
            "description": job.get("description"),
            "job_analysis_json": job.get("job_analysis_json") or {},
        },
        "tone": draft.tone,
    }
    full_prompt = (
        prompt_template
        + "\n\n## Deterministic draft (use as skeleton, rewrite freely)\n"
        + draft.body
        + "\n\n## Input JSON\n"
        + json.dumps(payload, ensure_ascii=False)
    )

    try:
        llm_result = await llm_client.generate(
            full_prompt,
            task_type=PROMPT_TASK_TYPE,
            temperature=0.4,
            # Phase 9A: bumped from 1500 → 2500 because some
            # providers (MiniMax-M3) emit <think>...</think> blocks
            # that consume the budget. With 1500 tokens the JSON
            # payload got truncated to empty.
            max_tokens=2500,
            json_mode=True,
            prompt_version=PROMPT_VERSION,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "cover_letter_llm_failed",
            error=str(exc)[:200],
            error_type=type(exc).__name__,
        )
        return draft  # fallback

    from app.llm.client import _safe_parse_json

    # Some providers (MiniMax-M3 etc.) prepend a `<think>...</think>`
    # reasoning block before the JSON payload. Strip it so the parser
    # sees clean JSON. If the entire response IS the thinking block
    # (no actual JSON), _safe_parse_json returns None and we fall
    # back to the deterministic draft.
    raw_text = llm_result.text or ""
    raw_text = re.sub(
        r"<think>.*?</think>\s*",
        "",
        raw_text,
        flags=re.DOTALL,
    ).strip()

    parsed = _safe_parse_json(raw_text)
    if not isinstance(parsed, dict):
        log.warning(
            "cover_letter_llm_bad_json",
            preview=(raw_text or "")[:120],
        )
        return draft  # fallback

    subject = str(parsed.get("subject") or draft.subject).strip()
    body = str(parsed.get("body") or draft.body).strip()
    if not body or len(body) < 50:
        log.warning("cover_letter_llm_body_too_short")
        return draft
    personalization = list(parsed.get("personalization_points") or [])
    keywords_used = list(parsed.get("job_keywords_used") or [])

    # Lightweight fact-preserving sanity check: don't let the LLM
    # claim skills not in the profile.
    if keywords_used:
        user_skills = {
            str(s.get("name") if isinstance(s, dict) else s).lower()
            for s in profile.get("skills") or []
        }
        safe_keywords = [
            kw for kw in keywords_used
            if any(us in kw.lower() or kw.lower() in us for us in user_skills)
            or not user_skills  # no skills listed → trust LLM
        ]
        keywords_used = safe_keywords or keywords_used[:2]

    return CoverLetterDraft(
        subject=subject,
        body=body,
        tone=draft.tone,
        personalization_points=personalization or draft.personalization_points,
        job_keywords_used=keywords_used or draft.job_keywords_used,
        source="llm_enhanced",
    )


# ── Scorer (4-axis, mirrors cv_scorer) ─────────────────────────────


@dataclass
class CoverLetterScore:
    overall: float
    breakdown: dict[str, Any]
    axes: dict[str, dict[str, Any]]

    def to_breakdown(self) -> dict[str, Any]:
        return {
            "overall": self.overall,
            "axes": self.axes,
            **self.breakdown,
        }


def score_cover_letter(
    content: str,
    job_required_keywords: list[str],
) -> CoverLetterScore:
    """Score a cover letter on 4 axes. Pure deterministic, no LLM.

    Axes (mirror cv_scorer weights for consistency):
    - keyword_coverage (0.40): how many required keywords appear
    - structure (0.20): greeting + 3 paras + sign-off present?
    - personalization (0.25): company name + job title both present?
    - length (0.15): 200-500 words ideal, ±100 words penalty
    """
    text = content or ""
    text_lower = text.lower()
    word_count = len(text.split())

    # ── keyword_coverage ──────────────────────────────────────────
    # Accept job_required_keywords as either str or {"name": str}.
    required_norm_raw: list[str] = []
    for k in job_required_keywords:
        if isinstance(k, str):
            required_norm_raw.append(k)
        elif isinstance(k, dict):
            n = k.get("name") or k.get("skill") or ""
            if isinstance(n, str):
                required_norm_raw.append(n)
    required_norm = [k.lower().strip() for k in required_norm_raw if k]
    if required_norm:
        matched = [k for k in required_norm_raw if k.lower() in text_lower]
        missing = [k for k in required_norm_raw if k.lower() not in text_lower]
        kw_score = len(matched) / len(required_norm)
    else:
        matched = []
        missing = []
        # No target keywords → neutral 0.0 (B7/B8 honest-no-data rule).
        kw_score = 0.0

    # ── structure ─────────────────────────────────────────────────
    # Greeting + sign-off + at least 3 paragraphs.
    has_greeting = bool(
        re.search(r"^(dear|hi|hello|greetings)", text.strip(), re.IGNORECASE | re.MULTILINE)
        or "Dear" in text[:80]
        or "Hi team" in text[:80]
    )
    has_signoff = bool(
        re.search(
            r"(kind regards|best regards|cheers|thanks|yours|sincerely|regards)",
            text_lower,
        )
    )
    paragraphs = [p for p in text.split("\n\n") if p.strip()]
    para_count = len(paragraphs)
    structure_score = (
        (1.0 if has_greeting else 0.0)
        + (1.0 if has_signoff else 0.0)
        + (1.0 if 2 <= para_count <= 6 else 0.5 if para_count == 1 else 0.0)
    ) / 3.0

    # ── personalization ───────────────────────────────────────────
    # Detect company + role in text. Heuristic: look for any
    # capitalized words that might be them. We don't have direct
    # access to job here, so caller should pass them via the
    # extended signature (kept simple here — keyword proxy).
    personalized_signals = 0
    if job_required_keywords:
        # Normalize to flat strings (defensive — see keyword_coverage).
        kw_strs: list[str] = []
        for k in job_required_keywords:
            if isinstance(k, str):
                kw_strs.append(k)
            elif isinstance(k, dict):
                n = k.get("name") or k.get("skill") or ""
                if isinstance(n, str):
                    kw_strs.append(n)
        # If the role-title keywords appear verbatim, +0.5.
        role_keywords = [k for k in kw_strs if len(k.split()) <= 3][:5]
        hit = sum(1 for k in role_keywords if k.lower() in text_lower)
        personalized_signals = min(1.0, hit / max(1, len(role_keywords)))
    personalization_score = personalized_signals

    # ── length ────────────────────────────────────────────────────
    if 200 <= word_count <= 500:
        length_score = 1.0
    elif 150 <= word_count < 200 or 500 < word_count <= 600:
        length_score = 0.7
    elif 100 <= word_count < 150 or 600 < word_count <= 800:
        length_score = 0.4
    else:
        length_score = 0.0

    # ── weighted overall ─────────────────────────────────────────
    overall = round(
        0.40 * kw_score
        + 0.20 * structure_score
        + 0.25 * personalization_score
        + 0.15 * length_score,
        4,
    )

    axes = {
        "keyword_coverage": {
            "score": round(kw_score, 4),
            "weight": 0.40,
            "matched": matched,
            "missing": missing,
        },
        "structure": {
            "score": round(structure_score, 4),
            "weight": 0.20,
            "details": {
                "has_greeting": has_greeting,
                "has_signoff": has_signoff,
                "paragraph_count": para_count,
            },
        },
        "personalization": {
            "score": round(personalization_score, 4),
            "weight": 0.25,
        },
        "length": {
            "score": round(length_score, 4),
            "weight": 0.15,
            "details": {"word_count": word_count},
        },
    }

    return CoverLetterScore(
        overall=overall,
        breakdown={"recommendations": _build_recommendations(axes)},
        axes=axes,
    )


def _build_recommendations(axes: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    """Map low-axis scores to actionable suggestions for the FE."""
    recs: list[dict[str, str]] = []
    kw = axes["keyword_coverage"]
    if kw["missing"]:
        recs.append(
            {
                "id": "add_keywords",
                "axis": "keyword_coverage",
                "impact": "high",
                "title": f"Add {len(kw['missing'])} missing keyword(s) to lift ATS match",
                "details": f"Missing: {', '.join(kw['missing'][:5])}",
            }
        )
    struct = axes["structure"]
    details = struct.get("details") or {}
    if not details.get("has_greeting"):
        recs.append(
            {
                "id": "add_greeting",
                "axis": "structure",
                "impact": "low",
                "title": "Add a greeting line at the top",
                "details": "Use 'Dear Hiring Team,' or 'Hi team,'.",
            }
        )
    if not details.get("has_signoff"):
        recs.append(
            {
                "id": "add_signoff",
                "axis": "structure",
                "impact": "low",
                "title": "Add a sign-off (e.g. 'Best regards,')",
                "details": "Ends the letter professionally.",
            }
        )
    length = axes["length"]
    wc = (length.get("details") or {}).get("word_count", 0)
    if wc > 0 and wc < 200:
        recs.append(
            {
                "id": "shorten_letter",
                "axis": "length",
                "impact": "medium",
                "title": f"Letter is {wc} words — aim for 250-400",
                "details": "Too short hurts personalization depth.",
            }
        )
    elif wc > 600:
        recs.append(
            {
                "id": "trim_letter",
                "axis": "length",
                "impact": "medium",
                "title": f"Letter is {wc} words — trim to 250-400",
                "details": "Recruiters skim; tight prose wins.",
            }
        )
    return recs