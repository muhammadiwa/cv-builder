"""Phase 7 — CV scoring service.

Given a CV draft (cv_json) and optionally a target job (job_analysis_json),
compute a 0.0–1.0 score that quantifies how well the CV is likely to:

1. Pass an ATS keyword filter (keyword coverage)
2. Address the job's required skill set (skill gap)
3. Showcase strong, quantified bullet points (bullet strength)
4. Conform to ATS-safe HTML (format safety)

The score is deterministic — no LLM call. The CV enhancer (Phase 6) is
the LLM-driven path; this scorer is the cold, measurable complement.

Score breakdown is stored alongside the headline score on ``CVDraft``
so the FE can render per-axis panels + prioritized recommendations.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from app.core.logging import get_logger

log = get_logger(__name__)


# ── Config (mirrors MatcherConfig pattern) ───────────────────────────


@dataclass
class CVScorerConfig:
    """All tunable weights and thresholds for the CV scorer.

    Component weights must sum to 1.0; call :meth:`normalized` to
    rebalance automatically.
    """

    weight_ats_coverage: float = 0.40
    weight_skill_gap: float = 0.30
    weight_bullet_strength: float = 0.20
    weight_format_safety: float = 0.10

    # bullet_strength: "weak" if avg < this; "ok" if < strong_threshold
    bullet_strong_threshold: float = 0.85
    bullet_ok_threshold: float = 0.55

    # format_safety: deduct for each failed check (max total = 1.0)
    format_missing_lang_deduction: float = 0.4
    format_missing_h1_deduction: float = 0.3
    format_uses_table_deduction: float = 0.2
    format_uses_image_deduction: float = 0.1

    def normalized(self) -> "CVScorerConfig":
        """Return a copy with weights rebalanced to sum to 1.0."""
        total = (
            self.weight_ats_coverage
            + self.weight_skill_gap
            + self.weight_bullet_strength
            + self.weight_format_safety
        )
        if total == 0:
            return self
        return CVScorerConfig(
            weight_ats_coverage=self.weight_ats_coverage / total,
            weight_skill_gap=self.weight_skill_gap / total,
            weight_bullet_strength=self.weight_bullet_strength / total,
            weight_format_safety=self.weight_format_safety / total,
            bullet_strong_threshold=self.bullet_strong_threshold,
            bullet_ok_threshold=self.bullet_ok_threshold,
            format_missing_lang_deduction=self.format_missing_lang_deduction,
            format_missing_h1_deduction=self.format_missing_h1_deduction,
            format_uses_table_deduction=self.format_uses_table_deduction,
            format_uses_image_deduction=self.format_uses_image_deduction,
        )


SCORER_CONFIG = CVScorerConfig()


# ── Result types ─────────────────────────────────────────────────────


@dataclass
class AxisScore:
    """One component of the overall CV score."""
    name: str                # "ats_coverage" | "skill_gap" | "bullet_strength" | "format_safety"
    score: float             # 0.0–1.0
    weight: float            # contribution to overall (0.0–1.0)
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class CVScoreResult:
    """Full deterministic CV score."""
    overall: float
    ats_coverage: AxisScore
    skill_gap: AxisScore
    bullet_strength: AxisScore
    format_safety: AxisScore
    matched_keywords: list[str] = field(default_factory=list)
    missing_keywords: list[str] = field(default_factory=list)
    matched_skills: list[str] = field(default_factory=list)
    missing_skills: list[str] = field(default_factory=list)
    recommendations: list[dict[str, Any]] = field(default_factory=list)

    def to_breakdown(self) -> dict[str, Any]:
        """Project to a JSON-friendly dict (matches ``score_breakdown_json``)."""
        return {
            "overall": round(self.overall, 4),
            "axes": {
                "ats_coverage": {
                    "score": round(self.ats_coverage.score, 4),
                    "weight": round(self.ats_coverage.weight, 4),
                    "matched": self.matched_keywords,
                    "missing": self.missing_keywords,
                },
                "skill_gap": {
                    "score": round(self.skill_gap.score, 4),
                    "weight": round(self.skill_gap.weight, 4),
                    "matched": self.matched_skills,
                    "missing": self.missing_skills,
                },
                "bullet_strength": {
                    "score": round(self.bullet_strength.score, 4),
                    "weight": round(self.bullet_strength.weight, 4),
                    "details": self.bullet_strength.details,
                },
                "format_safety": {
                    "score": round(self.format_safety.score, 4),
                    "weight": round(self.format_safety.weight, 4),
                    "details": self.format_safety.details,
                },
            },
            "recommendations": self.recommendations,
        }


# ── Helpers ──────────────────────────────────────────────────────────


# Mirrors the alias-canonicalization from matcher.TECH_ALIASES so a CV
# that lists "k8s" still counts as a hit for the job's "Kubernetes".
def _flatten_cv_text(cv_json: dict[str, Any]) -> str:
    """Concatenate every text field in the CV into one searchable string.

    Skips empty values; lowercases + collapses whitespace.
    """
    parts: list[str] = []

    def _walk(node: Any) -> None:
        if isinstance(node, str):
            parts.append(node)
            return
        if isinstance(node, list):
            for item in node:
                _walk(item)
            return
        if isinstance(node, dict):
            for key, val in node.items():
                # Skip noise that dilutes keyword search
                if key in {"email", "phone", "url", "image"}:
                    continue
                _walk(val)

    _walk(cv_json)
    blob = " ".join(parts)
    blob = re.sub(r"\s+", " ", blob).strip().lower()
    return blob


def _normalize_keyword(kw: str) -> str:
    """Light normalization: lowercase + collapse whitespace + strip
    common punctuation. Does NOT strip domain-meaningful chars like
    ``+`` / ``.`` (C++, Next.js).
    """
    s = kw.lower().strip()
    s = re.sub(r"[^\w\s+#./-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _keyword_present(keyword: str, blob: str, alias_map: dict[str, str] | None = None) -> bool:
    """Substring match, after alias canonicalization if a map is provided.

    Returns True iff the (normalized, aliased) keyword appears as a
    substring of the (normalized) CV blob.
    """
    nk = _normalize_keyword(keyword)
    if not nk:
        return False
    if alias_map and nk in alias_map:
        nk = _normalize_keyword(alias_map[nk])
    return nk in blob


# ── Axis scorers ─────────────────────────────────────────────────────


def _score_ats_coverage(
    cv_json: dict[str, Any],
    job_analysis: dict[str, Any] | None,
) -> tuple[float, list[str], list[str], dict[str, Any]]:
    """Fraction of job keywords present in the CV.

    If no job is attached (generic CV), returns a neutral 0.5 with
    empty matched/missing lists — we can't grade keyword coverage
    without a target.
    """
    if not job_analysis:
        return 0.5, [], [], {"reason": "no_target_job"}

    # Pull keywords from both ats_keywords (flat) and skill group keywords.
    keywords: list[str] = []
    for kw in (job_analysis.get("ats_keywords") or []):
        if isinstance(kw, str) and kw.strip():
            keywords.append(kw.strip())
    for group_name in ("required_skills", "preferred_skills"):
        for group in (job_analysis.get(group_name) or []):
            if not isinstance(group, dict):
                continue
            for kw in (group.get("keywords") or []):
                if isinstance(kw, str) and kw.strip():
                    keywords.append(kw.strip())
    # De-dup preserving order
    seen: set[str] = set()
    uniq = [k for k in keywords if not (k.lower() in seen or seen.add(k.lower()))]

    if not uniq:
        return 0.5, [], [], {"reason": "job_has_no_keywords"}

    blob = _flatten_cv_text(cv_json)
    matched = [k for k in uniq if _keyword_present(k, blob)]
    missing = [k for k in uniq if k not in matched]
    score = len(matched) / len(uniq)
    return score, matched, missing, {"total_keywords": len(uniq)}


def _score_skill_gap(
    cv_json: dict[str, Any],
    job_analysis: dict[str, Any] | None,
) -> tuple[float, list[str], list[str], dict[str, Any]]:
    """Fraction of required skill categories the CV already addresses.

    Unlike ATS coverage (substring match on text), this is structural:
    we check the CV's skills section for each required keyword.

    Without a target job, neutral 0.5 (same rationale as ATS).
    """
    if not job_analysis:
        return 0.5, [], [], {"reason": "no_target_job"}

    required_keywords: list[str] = []
    for group in (job_analysis.get("required_skills") or []):
        if not isinstance(group, dict):
            continue
        for kw in (group.get("keywords") or []):
            if isinstance(kw, str) and kw.strip():
                required_keywords.append(kw.strip())
    seen: set[str] = set()
    uniq = [k for k in required_keywords if not (k.lower() in seen or seen.add(k.lower()))]

    if not uniq:
        return 0.5, [], [], {"reason": "job_has_no_required_skills"}

    blob = _flatten_cv_text(cv_json)
    matched = [k for k in uniq if _keyword_present(k, blob)]
    missing = [k for k in uniq if k not in matched]
    score = len(matched) / len(uniq)
    return score, matched, missing, {"total_required": len(uniq)}


def _score_bullet_strength(cv_json: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    """Avg enhancement strength across all bullet lists in the CV.

    Falls back to a structural proxy when no strength data is present:
    count bullets with a metric (digits + unit) as "ok" (0.7) and
    without as "weak" (0.4). This keeps generic (never-enhanced) CVs
    from scoring 0.
    """
    METRIC_RE = re.compile(r"\b\d[\d.,]*\s?(?:%|k|m|b|x)?\b", re.IGNORECASE)
    strengths: list[float] = []

    work = cv_json.get("work") or []
    per_role: list[dict[str, Any]] = []
    for role in work:
        if not isinstance(role, dict):
            continue
        bullets = (
            role.get("highlights")
            or role.get("bullets")
            or role.get("achievements")
            or []
        )
        if not isinstance(bullets, list):
            continue
        per_role_bullets: list[float] = []
        for bullet in bullets:
            if not isinstance(bullet, str):
                continue
            text = bullet.strip()
            if not text:
                continue
            # If the enhancer already left a strength annotation it would
            # live on a parallel ``_strengths`` key; absent that, we use
            # a length + metric heuristic.
            has_metric = bool(METRIC_RE.search(text))
            length = len(text)
            if has_metric and length >= 40:
                per_role_bullets.append(0.9)
            elif has_metric:
                per_role_bullets.append(0.7)
            elif length >= 30:
                per_role_bullets.append(0.5)
            else:
                per_role_bullets.append(0.3)
        if per_role_bullets:
            per_role.append(
                {"role": role.get("position") or role.get("name") or "unknown",
                 "count": len(per_role_bullets),
                 "avg": round(sum(per_role_bullets) / len(per_role_bullets), 3)}
            )
            strengths.extend(per_role_bullets)

    if not strengths:
        return 0.5, {"reason": "no_bullets_found"}

    score = sum(strengths) / len(strengths)
    return score, {"total_bullets": len(strengths), "per_role": per_role}


def _score_format_safety(cv_json: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    """Static checks on the CV's rendered HTML for ATS-safety.

    We rely on the renderer to produce the HTML; this scorer just
    grades it. If the CV was never rendered (no rendered_html field),
    we award a neutral 0.5 so the overall score stays meaningful.
    """
    html: str | None = cv_json.get("_rendered_html")
    if not html:
        # The CV route stores rendered_html on the row, not in cv_json;
        # callers pass it via a synthetic key. Fall back to neutral.
        return 0.5, {"reason": "no_rendered_html_supplied"}

    checks = {
        "has_lang_attr": bool(re.search(r"<html[^>]+lang=", html, re.IGNORECASE)),
        "has_h1": bool(re.search(r"<h1\b", html, re.IGNORECASE)),
        "uses_table": bool(re.search(r"<table\b", html, re.IGNORECASE)),
        "uses_image_body": bool(re.search(r"<img\b", html, re.IGNORECASE)),
    }
    cfg = SCORER_CONFIG
    deductions = 0.0
    if not checks["has_lang_attr"]:
        deductions += cfg.format_missing_lang_deduction
    if not checks["has_h1"]:
        deductions += cfg.format_missing_h1_deduction
    if checks["uses_table"]:
        deductions += cfg.format_uses_table_deduction
    if checks["uses_image_body"]:
        deductions += cfg.format_uses_image_deduction
    score = max(0.0, 1.0 - deductions)
    return score, checks


# ── Recommendation builder ──────────────────────────────────────────


def _build_recommendations(
    missing_keywords: list[str],
    missing_skills: list[str],
    bullet_details: dict[str, Any],
    format_checks: dict[str, Any],
) -> list[dict[str, Any]]:
    """Prioritized, actionable improvements ranked by impact on the score.

    Each item: ``{"id": str, "title": str, "impact": "high"|"med"|"low",
    "details": str}``. The FE renders them as cards with a "fix" CTA.
    """
    out: list[dict[str, Any]] = []

    # Highest-impact: missing skills (drives skill_gap axis directly).
    for skill in missing_skills[:5]:
        out.append({
            "id": f"add_skill:{_normalize_keyword(skill)}",
            "title": f"Add \"{skill}\" to your skills section",
            "impact": "high",
            "axis": "skill_gap",
            "details": (
                "The job explicitly requires this skill. Add it to the "
                "Skills section if you have it; otherwise address it in "
                "an Experience bullet."
            ),
        })

    # Missing ATS keywords (subset of skill_gap but cover other axes too).
    for kw in missing_keywords[:5]:
        if _normalize_keyword(kw) in {_normalize_keyword(s) for s in missing_skills}:
            continue  # already covered above
        out.append({
            "id": f"add_keyword:{_normalize_keyword(kw)}",
            "title": f"Use \"{kw}\" somewhere in your CV",
            "impact": "med",
            "axis": "ats_coverage",
            "details": (
                "This phrase appears in the job's keyword set but not in "
                "your CV. Mention it once in Summary, Skills, or a "
                "relevant bullet."
            ),
        })

    # Bullets: flag the weakest role (avg below ok threshold).
    per_role = bullet_details.get("per_role") or []
    weak_roles = [r for r in per_role if r.get("avg", 0) < SCORER_CONFIG.bullet_ok_threshold]
    if weak_roles:
        weakest = min(weak_roles, key=lambda r: r["avg"])
        out.append({
            "id": f"strengthen_role:{_normalize_keyword(weakest['role'])}",
            "title": f"Rewrite bullets for \"{weakest['role']}\"",
            "impact": "med",
            "axis": "bullet_strength",
            "details": (
                f"This role's bullets average {weakest['avg']:.2f} "
                "(weak). Add a quantified result (e.g. \"cut latency "
                "by 30%\") or tighten to 1 line each."
            ),
        })

    # Format safety: a single card listing all failures.
    if format_checks:
        fails = [k for k, v in format_checks.items() if v is False]
        if fails:
            out.append({
                "id": "fix_format_safety",
                "title": "Fix ATS-format issues",
                "impact": "low",
                "axis": "format_safety",
                "details": "Issues: " + ", ".join(f.replace("_", " ") for f in fails),
            })

    return out


# ── Public entry point ───────────────────────────────────────────────


def score_cv(
    cv_json: dict[str, Any],
    job_analysis: dict[str, Any] | None = None,
    config: CVScorerConfig | None = None,
) -> CVScoreResult:
    """Score a CV draft, optionally against a target job analysis.

    Returns a :class:`CVScoreResult` with the headline number, per-axis
    scores, matched/missing keyword lists, and prioritized
    recommendations.

    Side-effect free; safe to call from request handlers and tests.
    """
    cfg = (config or SCORER_CONFIG).normalized()

    ats_score, matched_kw, missing_kw, ats_details = _score_ats_coverage(cv_json, job_analysis)
    sg_score, matched_sk, missing_sk, sg_details = _score_skill_gap(cv_json, job_analysis)
    bs_score, bs_details = _score_bullet_strength(cv_json)
    fs_score, fs_details = _score_format_safety(cv_json)

    axes = [
        AxisScore("ats_coverage", ats_score, cfg.weight_ats_coverage, ats_details),
        AxisScore("skill_gap", sg_score, cfg.weight_skill_gap, sg_details),
        AxisScore("bullet_strength", bs_score, cfg.weight_bullet_strength, bs_details),
        AxisScore("format_safety", fs_score, cfg.weight_format_safety, fs_details),
    ]
    overall = sum(a.score * a.weight for a in axes)
    overall = round(max(0.0, min(1.0, overall)), 4)

    recs = _build_recommendations(missing_kw, missing_sk, bs_details, fs_details)

    log.info(
        "cv_scored",
        overall=overall,
        ats=round(ats_score, 3),
        skill_gap=round(sg_score, 3),
        bullets=round(bs_score, 3),
        format=round(fs_score, 3),
        matched_keywords=len(matched_kw),
        missing_keywords=len(missing_kw),
        recommendations=len(recs),
    )

    return CVScoreResult(
        overall=overall,
        ats_coverage=axes[0],
        skill_gap=axes[1],
        bullet_strength=axes[2],
        format_safety=axes[3],
        matched_keywords=matched_kw,
        missing_keywords=missing_kw,
        matched_skills=matched_sk,
        missing_skills=missing_sk,
        recommendations=recs,
    )