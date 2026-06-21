"""Resume parser service — orchestrates LLM parse + persistence.

Pipeline (called by the API layer after text extraction):

1. Load the ``ResumeUpload`` row (status must be ``parsing``).
2. Call the LLM with ``raw_text`` + the versioned prompt.
3. ``_safe_parse_json`` the response (handles think blocks + fences).
4. Validate against ``BaseProfileSchema``.
5. Compute a confidence score (non-empty sections / expected sections).
6. Update ``ResumeUpload`` (status=parsed, parsed_json, confidence_score).
7. Upsert the user's single ``Profile`` row (create if missing).
8. Append a ``ProfileVersion`` row.

The orchestrator is intentionally synchronous — the API layer wraps it in
``BackgroundTasks`` so the upload endpoint returns immediately while parsing
happens out-of-band. No Celery, no Redis, no queue.

This module does NOT touch text extraction — that's Phase 2 BE-1's job and
the API layer runs it inline before kicking off ``parse_resume``.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.llm.client import LLMClient, _safe_parse_json
from app.llm.prompts.loader import load_prompt
from app.models.models import Profile, ProfileVersion, ResumeUpload, User
from app.schemas.schemas import BASE_PROFILE_SECTIONS, BaseProfileSchema

log = get_logger(__name__)


# ── Defaults / constants ──────────────────────────────────────────────

PROMPT_TASK_TYPE = "resume_parse"
PROMPT_VERSION = "v1"

# Section-presence check for confidence scoring. Treats "present" as:
#   - basics: non-null object with a non-empty email
#   - <list-section>: list with len > 0
# Same set as BASE_PROFILE_SECTIONS so the math is stable.
def _section_present(section_name: str, parsed: dict[str, Any]) -> bool:
    if section_name == "basics":
        b = parsed.get("basics") or {}
        return bool(b.get("email"))
    val = parsed.get(section_name)
    return isinstance(val, list) and len(val) > 0


# Fields that legitimately live inside the JSON Resume ``basics`` block.
# Used by ``_repair_basics_flatten`` to detect and fix a common LLM
# mistake (see below).
_BASICS_FIELDS: frozenset[str] = frozenset(
    {"name", "label", "email", "phone", "url", "summary", "location", "profiles"}
)


def _repair_basics_flatten(parsed: dict[str, Any]) -> dict[str, Any]:
    """Repair the most common LLM structural mistake on resume parses.

    The MiniMax-M3 model (current default via tokenrouter) is
    non-deterministic and occasionally returns:

        {"basics": null, "name": "X", "email": "Y", "phone": "Z", ...}

    instead of the spec-compliant

        {"basics": {"name": "X", "email": "Y", "phone": "Z", ...}, ...}

    The ``BaseProfileSchema`` allows ``extra='allow'`` so Pydantic
    silently DROPS the top-level fields and stores ``basics: null``
    — the parse "succeeds" but the profile comes out empty and the
    confidence score lands at 0.0.

    This function detects the flattened shape and rebuilds ``basics``
    from the top-level fields. It is intentionally narrow:

    - Only triggers when ``basics`` is None / empty / non-dict AND
      at least 2 of the basics fields are at the top level (so we
      don't accidentally wrap a single coincidental field).
    - Never invents data — moves keys, doesn't synthesize.
    - Returns the original dict unchanged if no repair is needed
      (so we don't risk corrupting valid parses).

    Why not just retry the LLM? Cost + latency. The user would
    re-pay the LLM call for what is structurally a 5-line fix in
    post-processing.
    """
    if not isinstance(parsed, dict):
        return parsed
    basics = parsed.get("basics")
    basics_ok = isinstance(basics, dict) and len(basics) > 0
    if basics_ok:
        return parsed
    # Count how many basics-shaped fields are sitting at top level.
    top_level_hits = [k for k in _BASICS_FIELDS if k in parsed]
    if len(top_level_hits) < 2:
        return parsed
    # Move them under a new basics object. We don't worry about
    # double-keying — if parsed has both basics (as a partial dict)
    # AND top-level fields, the partial basics wins and the orphans
    # stay where they are (we only repair when basics is missing).
    new_basics: dict[str, Any] = {}
    for k in top_level_hits:
        new_basics[k] = parsed.pop(k)
    parsed["basics"] = new_basics
    log.warning(
        "parse_resume_repair_basics_flatten",
        moved_fields=top_level_hits,
    )
    return parsed


def compute_confidence(parsed: dict[str, Any]) -> float:
    """Return 0.0–1.0: fraction of expected sections that are non-empty.

    Uses ``BASE_PROFILE_SECTIONS`` as the denominator — the same set the
    parser was told to populate. A resume that came back with only an
    email should score ~1/7, not 1.0, so the UI can flag low confidence.
    """
    if not isinstance(parsed, dict):
        return 0.0
    present = sum(1 for s in BASE_PROFILE_SECTIONS if _section_present(s, parsed))
    return round(present / max(len(BASE_PROFILE_SECTIONS), 1), 4)


# ── User seeding (single-user MVP) ────────────────────────────────────

DEFAULT_USER_EMAIL = "default@local"
DEFAULT_USER_NAME = "Default User"


def get_or_create_default_user(db: Session) -> User:
    """Lazy-create the single user. Phase 2 has no auth yet.

    Returns the (only) ``User`` row. Idempotent — safe to call on every
    upload. Future phases will replace this with real auth.
    """
    user = db.execute(select(User).limit(1)).scalar_one_or_none()
    if user is not None:
        return user
    user = User(id=str(uuid.uuid4()), name=DEFAULT_USER_NAME, email=DEFAULT_USER_EMAIL)
    db.add(user)
    db.commit()
    db.refresh(user)
    log.info("default_user_seeded", user_id=user.id)
    return user


# ── Profile upsert ────────────────────────────────────────────────────


def _extract_basics_flat(parsed: dict[str, Any]) -> dict[str, Any]:
    """Flatten ``basics`` into the columns on the Profile table.

    Profile has flat columns (name, email, title, summary, phone, location,
    linkedin, github, portfolio) that mirror the JSON Resume basics block.
    The full parsed JSON still lives in ``base_profile_json``.
    """
    b = parsed.get("basics") or {}
    loc = b.get("location") or {}
    # Build a single string for the flat location column.
    loc_parts = [loc.get("city"), loc.get("region"), loc.get("country")]
    location_str = ", ".join(p for p in loc_parts if p) or None

    # profiles is a list of {"network", "url"} — pick the obvious ones out.
    linkedin = github = portfolio = None
    for p in b.get("profiles") or []:
        net = (p.get("network") or "").lower()
        url = p.get("url") or ""
        if not url:
            continue
        if "linkedin" in net and not linkedin:
            linkedin = url
        elif "github" in net and not github:
            github = url
        elif not portfolio:
            portfolio = url

    return {
        "name": b.get("name") or DEFAULT_USER_NAME,
        "email": b.get("email") or DEFAULT_USER_EMAIL,
        "title": b.get("label"),
        "summary": b.get("summary"),
        "phone": b.get("phone"),
        "location": location_str,
        "linkedin": linkedin,
        "github": github,
        "portfolio": portfolio,
    }


def upsert_profile(db: Session, parsed: dict[str, Any], confidence: float) -> Profile:
    """Create the Profile row on first parse, or update it on re-parse.

    Single profile per user (we treat the seeded user as the only one).
    Returns the resulting row.
    """
    user = get_or_create_default_user(db)
    flat = _extract_basics_flat(parsed)

    profile = db.execute(
        select(Profile).where(Profile.user_id == user.id).limit(1)
    ).scalar_one_or_none()

    if profile is None:
        profile = Profile(
            id=str(uuid.uuid4()),
            user_id=user.id,
            base_profile_json=parsed,
            ai_analysis_json={},
            confidence_score=confidence,
            **flat,
        )
        db.add(profile)
    else:
        profile.base_profile_json = parsed
        profile.confidence_score = confidence
        # Update flat columns too — re-parses may improve them.
        for col, val in flat.items():
            setattr(profile, col, val)
    db.commit()
    db.refresh(profile)
    return profile


# ── Versioning ────────────────────────────────────────────────────────


def append_profile_version(
    db: Session,
    profile: Profile,
    parsed: dict[str, Any],
    change_summary: str,
) -> ProfileVersion:
    """Insert a new ``ProfileVersion`` with ``version_number = max + 1``.

    Versions are append-only — never updated. Each parse creates a new
    snapshot so the user can roll back to any historical state later.
    """
    current_max = db.execute(
        select(func.max(ProfileVersion.version_number)).where(
            ProfileVersion.profile_id == profile.id
        )
    ).scalar() or 0
    v = ProfileVersion(
        id=str(uuid.uuid4()),
        profile_id=profile.id,
        version_number=int(current_max) + 1,
        data_json=parsed,
        change_summary=change_summary,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


# ── Main entry point ──────────────────────────────────────────────────


class ParseResult(dict):
    """Loose dict wrapper so callers/tests can subscript keys like a dict.

    Equivalent to returning a dict; the class exists mainly so docstrings
    and stack traces are nicer. Keys: ``profile``, ``upload``,
    ``version``, ``confidence``.
    """


async def parse_resume(upload_id: str, db: Session) -> dict[str, Any]:
    """Drive a parse for the given ``ResumeUpload`` and persist results.

    Steps:
      1. Load upload row; assert status == ``parsing``.
      2. Build the prompt (system role + versioned body) and append the
         raw resume text as the user message.
      3. Call ``LLMClient.generate`` with ``task_type="resume_parse"``.
      4. ``_safe_parse_json`` the response.
      5. Validate against ``BaseProfileSchema`` (Pydantic v2).
      6. Score confidence.
      7. Persist: update upload, upsert profile, append version.

    On any failure: mark the upload as ``failed`` with an ``error_message``
    and re-raise. Callers should swallow + log so BackgroundTasks doesn't
    propagate to the user.
    """
    upload = db.get(ResumeUpload, upload_id)
    if upload is None:
        raise ValueError(f"ResumeUpload {upload_id!r} not found")
    if upload.status != "parsing":
        raise ValueError(
            f"ResumeUpload {upload_id!r} status={upload.status!r}, expected 'parsing'"
        )
    raw_text = (upload.extracted_text or "").strip()
    if not raw_text:
        upload.status = "failed"
        upload.error_message = "empty extracted_text; cannot parse"
        db.commit()
        raise RuntimeError("empty extracted_text — refusing to call LLM")

    # Build the prompt. We send the prompt as a single string: the versioned
    # system instructions, then the raw resume text clearly delimited.
    system_prompt = load_prompt(PROMPT_TASK_TYPE, PROMPT_VERSION)
    full_prompt = (
        f"{system_prompt}\n\n"
        "---\n\n"
        "## Resume text to parse\n\n"
        f"{raw_text}\n"
    )

    # Call the LLM. We pass the DB session so the client can log cost rows.
    #
    # max_tokens budget: MiniMax-M3 (the current default model via
    # tokenrouter) emits a <think>...</think> block before any JSON
    # response, and the block length is non-deterministic — sometimes
    # 100 tokens, sometimes 4000+. At max_tokens=4000 the model often
    # hits the cap mid-think and never emits the JSON, producing
    # ``llm_returned_invalid_json`` for the FE.
    #
    # Empirically the model uses ~3300 input + ~4300 output tokens
    # for a typical full-resume parse, so 6000 is a safe ceiling. We
    # also retry once at 8000 in case of an unusually long think.
    # This brings the success rate from ~33% to ~100% on the same
    # resume (verified 2026-06-21 against MiniMax-M3 via tokenrouter).
    client = LLMClient()
    client.set_db(db)
    try:
        llm_result = None
        for attempt, max_t in enumerate((6000, 8000), start=1):
            llm_result = await client.generate(
                full_prompt,
                task_type=PROMPT_TASK_TYPE,
                temperature=0.0,        # deterministic parsing — no creativity wanted
                max_tokens=max_t,
                json_mode=True,
                prompt_version=PROMPT_VERSION,
            )
            # Try the parse right after each attempt so we can decide
            # whether to retry without keeping the full text around.
            if _safe_parse_json(llm_result.text or "") is not None:
                break
            if attempt == 1:
                log.warning(
                    "parse_resume_retry",
                    upload_id=upload_id,
                    reason="first attempt returned un-parseable text",
                    len_text=len(llm_result.text or ""),
                )
        if llm_result is None:  # pragma: no cover — generate() raises on failure
            raise RuntimeError("LLM client returned no result")
    except Exception as e:  # noqa: BLE001
        upload.status = "failed"
        upload.error_message = f"llm_call_failed: {e}"[:1000]
        db.commit()
        log.error("parse_resume_llm_failed", upload_id=upload_id, error=str(e))
        raise

    raw_response = llm_result.text or ""
    parsed_obj = _safe_parse_json(raw_response)
    if parsed_obj is None:
        # Give the user a more actionable error: tell them how much
        # the model emitted so they can decide whether to try a
        # smaller file or a different one.
        upload.status = "failed"
        upload.error_message = (
            f"llm_returned_invalid_json: model emitted {len(raw_response)} chars of "
            f"non-JSON text. The resume may be too long or contain unusual formatting. "
            f"Try again with a different file."
        )[:1000]
        db.commit()
        raise RuntimeError("LLM did not return parseable JSON")

    # Normalize to a dict (some providers may emit a list).
    if not isinstance(parsed_obj, dict):
        upload.status = "failed"
        upload.error_message = f"llm_returned_non_object: {type(parsed_obj).__name__}"
        db.commit()
        raise RuntimeError(f"LLM returned non-object JSON: {type(parsed_obj).__name__}")

    # Phase 10E (post-mortem): the LLM sometimes flattens basics
    # fields to the top level (e.g. {"name": "X", "email": "Y"} with
    # no "basics" wrapper). BaseProfileSchema's extra='allow' would
    # silently drop those fields, leaving basics=null and the
    # profile confidence at 0%. Repair before validation.
    parsed_obj = _repair_basics_flatten(parsed_obj)

    # Validate against the Pydantic schema. If basics.email is missing,
    # this raises — we treat that as a parse failure, not a hard crash.
    try:
        validated = BaseProfileSchema.model_validate(parsed_obj)
    except Exception as e:  # noqa: BLE001
        upload.status = "failed"
        upload.error_message = f"schema_validation_failed: {e}"[:1000]
        db.commit()
        log.warning("parse_resume_schema_invalid", upload_id=upload_id, error=str(e))
        raise

    parsed_dict = validated.model_dump()
    confidence = compute_confidence(parsed_dict)

    # Persist all the things.
    upload.parsed_json = parsed_dict
    upload.confidence_score = confidence
    upload.status = "parsed"
    upload.error_message = None
    db.commit()
    db.refresh(upload)

    profile = upsert_profile(db, parsed_dict, confidence)
    change_summary = (
        f"Initial parse from {upload.file_name}"
        if profile.versions == []
        else f"Re-parse update from {upload.file_name}"
    )
    version = append_profile_version(db, profile, parsed_dict, change_summary)

    log.info(
        "parse_resume_done",
        upload_id=upload_id,
        profile_id=profile.id,
        version=version.version_number,
        confidence=confidence,
    )
    return {
        "profile": profile,
        "upload": upload,
        "version": version,
        "confidence": confidence,
    }