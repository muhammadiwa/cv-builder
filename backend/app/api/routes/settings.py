"""Settings routes: LLM + scraper toggle + cost dashboard + live LLM test."""
from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.llm.client import LLMClient
from app.models.models import LLMCallLog
from app.schemas.schemas import (
    CostBucketItem,
    CostDailyItem,
    CostSummaryOut,
    LLMSettingsOut,
    LLMSettingsUpdate,
    RecentCallOut,
)

router = APIRouter(prefix="/settings", tags=["settings"])


# ── LLM providers ──────────────────────────────────────────────────


@router.get("/llm", response_model=LLMSettingsOut)
def get_llm_settings():
    """List all configured LLM providers with status (enabled, has key, models).

    Cheap call — no provider calls, just reads config + env. UI uses this to
    render the LLM panel in Settings and toggle enable/disable.
    """
    client = LLMClient()
    providers = client.list_providers()
    default = next((p["id"] for p in providers if p.get("enabled")), "")
    return LLMSettingsOut(providers=providers, default_provider=default)


@router.patch("/llm")
def patch_llm_settings(payload: LLMSettingsUpdate):
    """Toggle a provider's enabled flag. Persisted back to llm_providers.json.

    Only the ``enabled`` flag is mutable from the UI — model, priority, and
    api_key_env are Lead-only config (edit the on-disk JSON for those).
    """
    from app.core.config import get_settings
    settings = get_settings()
    path = settings.llm_providers_config
    if not path.exists():
        raise HTTPException(404, f"llm_providers.json not found: {path}")
    with path.open() as f:
        cfg = json.load(f)
    for p in cfg.get("providers", []):
        if p["id"] == payload.provider_id:
            if payload.enabled is not None:
                p["enabled"] = payload.enabled
            if payload.priority is not None:
                p["priority"] = payload.priority
            break
    else:
        raise HTTPException(404, "provider not found")
    with path.open("w") as f:
        json.dump(cfg, f, indent=2)
    return {"status": "ok", "providers": cfg["providers"]}


@router.post("/llm/test")
async def test_llm_provider(payload: dict):
    """Send a tiny test prompt to the chosen provider. Returns ok + latency.

    Used by the Settings page "Test connection" button. Cheap (max_tokens=8).
    """
    provider_id = payload.get("provider_id")
    prompt = payload.get("prompt", "Reply with the single word: ok")
    client = LLMClient()
    target = next((p for p in client.providers if p.id == provider_id), None)
    if target is None:
        raise HTTPException(404, f"provider not found or disabled: {provider_id}")
    model = client._model_for_provider(provider_id, "match") or ""
    if not model:
        raise HTTPException(400, f"no model configured for {provider_id}/match")
    try:
        result = await target.generate(prompt, model, temperature=0.0, max_tokens=8, json_mode=False)
        return {
            "ok": True,
            "provider": provider_id,
            "model": model,
            "latency_ms": result.latency_ms,
            "text_preview": result.text[:200],
        }
    except Exception as e:
        return {"ok": False, "provider": provider_id, "model": model, "error": str(e)[:500]}


# ── Scraper sources ────────────────────────────────────────────────


@router.get("/scrapers")
def get_scraper_settings():
    from app.core.config import get_settings
    settings = get_settings()
    with settings.scraper_sources_config.open() as f:
        return json.load(f)


@router.patch("/scrapers/{source_id}")
def patch_scraper_settings(source_id: str, payload: dict):
    """Toggle enabled flag on a scraper source. Persisted to scraper_sources.json.

    Body: ``{"enabled": true|false}``. Only the ``enabled`` flag is mutable from
    the UI — selectors, rate limits, etc. are Lead-only config.
    """
    from app.core.config import get_settings
    settings = get_settings()
    path = settings.scraper_sources_config
    with path.open() as f:
        cfg = json.load(f)
    for s in cfg.get("sources", []):
        if s["id"] == source_id:
            if "enabled" in payload:
                s["enabled"] = bool(payload["enabled"])
            break
    else:
        raise HTTPException(404, f"scraper source not found: {source_id}")
    with path.open("w") as f:
        json.dump(cfg, f, indent=2)
    return {"status": "ok", "source_id": source_id, "enabled": s["enabled"]}


# ── Cost dashboard (operates on llm_call_log) ───────────────────────


def _bucket(items: list[tuple[str, float, bool, int | None]]) -> list[CostBucketItem]:
    """Aggregate (key, cost, success, latency) tuples into buckets."""
    agg: dict[str, dict[str, float]] = defaultdict(
        lambda: {"cost": 0.0, "calls": 0, "ok": 0, "lat_sum": 0.0, "lat_n": 0}
    )
    for key, cost, success, latency in items:
        a = agg[key]
        a["cost"] += cost or 0.0
        a["calls"] += 1
        if success:
            a["ok"] += 1
        if latency is not None:
            a["lat_sum"] += latency
            a["lat_n"] += 1
    out: list[CostBucketItem] = []
    for key, a in agg.items():
        out.append(
            CostBucketItem(
                key=key,
                cost_usd=round(a["cost"], 6),
                calls=int(a["calls"]),
                successes=int(a["ok"]),
                avg_latency_ms=round(a["lat_sum"] / a["lat_n"], 1) if a["lat_n"] else None,
            )
        )
    out.sort(key=lambda b: b.cost_usd, reverse=True)
    return out


@router.get("/costs/summary", response_model=CostSummaryOut)
def get_cost_summary(
    days: int = Query(30, ge=1, le=365, description="Window in days (default 30)"),
    db: Session = Depends(get_db),
):
    """Aggregate cost + usage over the last ``days`` days from ``llm_call_log``.

    Returns:
      - top-line totals (cost, calls, success rate, avg cost/call)
      - buckets by provider, model, and task_type (sorted by cost desc)
      - daily trend for charting
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(LLMCallLog)
        .filter(LLMCallLog.created_at >= cutoff)
        .all()
    )

    total_cost = 0.0
    total_calls = 0
    success_calls = 0
    lat_sum = 0.0
    lat_n = 0
    by_provider_raw: list[tuple] = []
    by_model_raw: list[tuple] = []
    by_task_raw: list[tuple] = []
    daily_agg: dict[str, dict[str, float]] = defaultdict(lambda: {"cost": 0.0, "calls": 0})

    for r in rows:
        cost = r.cost_usd or 0.0
        total_cost += cost
        total_calls += 1
        if r.success:
            success_calls += 1
        if r.latency_ms is not None:
            lat_sum += r.latency_ms
            lat_n += 1
        by_provider_raw.append((r.provider, cost, r.success, r.latency_ms))
        by_model_raw.append((r.model, cost, r.success, r.latency_ms))
        by_task_raw.append((r.task_type, cost, r.success, r.latency_ms))
        day = r.created_at.astimezone(timezone.utc).strftime("%Y-%m-%d")
        daily_agg[day]["cost"] += cost
        daily_agg[day]["calls"] += 1

    # Fill daily series with zeros for missing days so the chart has a continuous line
    daily: list[CostDailyItem] = []
    today = datetime.now(timezone.utc).date()
    for offset in range(days - 1, -1, -1):
        d = (today - timedelta(days=offset)).isoformat()
        a = daily_agg.get(d, {"cost": 0.0, "calls": 0})
        daily.append(CostDailyItem(date=d, cost_usd=round(a["cost"], 6), calls=int(a["calls"])))

    success_rate = (success_calls / total_calls) if total_calls else 0.0
    avg_cost = (total_cost / total_calls) if total_calls else 0.0
    avg_latency = (lat_sum / lat_n) if lat_n else None

    return CostSummaryOut(
        window_days=days,
        total_cost_usd=round(total_cost, 6),
        total_calls=total_calls,
        success_calls=success_calls,
        success_rate=round(success_rate, 4),
        avg_cost_per_call_usd=round(avg_cost, 6),
        avg_latency_ms=round(avg_latency, 1) if avg_latency is not None else None,
        by_provider=_bucket(by_provider_raw),
        by_model=_bucket(by_model_raw),
        by_task_type=_bucket(by_task_raw),
        daily=daily,
    )


@router.get("/costs/recent", response_model=list[RecentCallOut])
def get_recent_calls(
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Last ``limit`` LLM calls (newest first) for the recent-calls table."""
    rows = (
        db.query(LLMCallLog)
        .order_by(LLMCallLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return rows
