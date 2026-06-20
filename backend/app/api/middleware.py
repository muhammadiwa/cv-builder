"""Phase 9C — In-memory rate limiter middleware.

Simple token-bucket per client IP. Designed for single-process dev
deployment — does NOT share state across workers. For prod with
multiple workers, swap to Redis-backed limiter.

Why in-memory for now:
- Zero infra dependency
- Sufficient for single-user dev mode
- Easy to swap later (interface is `RateLimiter.check()`)

Usage in main.py:
    from app.api.middleware import RateLimitMiddleware
    app.add_middleware(RateLimitMiddleware, ...)

Endpoint exemptions are configured per-route via the ``exempt_paths``
constructor arg (e.g. /health, /profile).
"""
from __future__ import annotations

import time
from collections import defaultdict
from typing import Iterable

import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

log = structlog.get_logger(__name__)


class TokenBucket:
    """Per-key token bucket. Refills `rate` tokens per second up to `burst`."""

    def __init__(self, rate: float, burst: int):
        self.rate = rate  # tokens per second
        self.burst = burst  # max tokens (== bucket capacity)
        self.tokens = float(burst)
        self.last_refill = time.monotonic()

    def take(self, n: int = 1) -> bool:
        """Try to consume `n` tokens. Returns True if allowed."""
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
        self.last_refill = now
        if self.tokens >= n:
            self.tokens -= n
            return True
        return False


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Token-bucket rate limiter keyed by client IP.

    Args:
        requests_per_minute: Sustained rate cap (default 60).
        burst: Bucket capacity — max requests in a tight burst
            (default = 2x requests_per_minute / 10 to allow short
            bursts but cap sustained traffic).
        exempt_paths: Iterable of path prefixes to skip limiting
            (e.g. ['/api/health']).
    """

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        burst: int | None = None,
        exempt_paths: Iterable[str] | None = None,
        enabled: bool = True,
    ):
        super().__init__(app)
        self.enabled = enabled
        self.rate = requests_per_minute / 60.0  # tokens/sec
        self.burst = burst if burst is not None else max(10, requests_per_minute // 2)
        self.exempt_paths = tuple(exempt_paths or [])
        self.buckets: dict[str, TokenBucket] = defaultdict(
            lambda: TokenBucket(self.rate, self.burst)
        )
        # Housekeeping: cap the bucket dict size so a flood of unique
        # IPs can't grow it unboundedly. Trivial LRU: every 1000
        # requests, drop the buckets that are at full capacity (haven't
        # been used recently).
        self._request_count = 0

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)
        path = request.url.path
        if any(path.startswith(p) for p in self.exempt_paths):
            return await call_next(request)

        client_ip = self._client_ip(request)
        bucket = self.buckets[client_ip]
        if not bucket.take(1):
            log.warning(
                "rate_limit_exceeded",
                client_ip=client_ip,
                path=path,
                method=request.method,
            )
            retry_after = int((1.0 / self.rate) * (1 - bucket.tokens) + 1)
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "rate limit exceeded — slow down",
                    "retry_after_seconds": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        # Light housekeeping (in-memory only; safe to skip).
        self._request_count += 1
        if self._request_count >= 1000:
            self._request_count = 0
            self._gc_buckets()

        return await call_next(request)

    def _client_ip(self, request: Request) -> str:
        """Best-effort client IP — trust X-Forwarded-For if behind a proxy."""
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"

    def _gc_buckets(self) -> None:
        """Drop buckets that are at full capacity (idle). Keeps the
        dict bounded under high-cardinality IP floods."""
        idle_keys = [
            k for k, b in self.buckets.items()
            if b.tokens >= b.burst * 0.95
        ]
        for k in idle_keys:
            del self.buckets[k]