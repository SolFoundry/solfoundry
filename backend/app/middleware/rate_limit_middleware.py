"""Rate limiting middleware using Redis.

Enforces configurable limits per endpoint group (auth, API, webhooks).
Supports both IP-based and user-based (X-User-ID header) rate limiting.
"""

import os
import time
from typing import Callable, Dict, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from redis.asyncio import from_url

from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Configuration via environment with defaults
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
# Limits: (ip_limit, user_limit, period_seconds)
# period is typically 60 seconds (1 minute)
LIMITS = {
    # Auth endpoints: stricter
    "/api/auth": (5, 5, 60),
    "/api/webhooks": (120, 120, 60),
    "/api/websocket": (30, 30, 60),
    # Default for other /api
    "/api": (60, 60, 60),
    # Default for everything else
    "default": (30, 30, 60),
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware with Redis backing."""

    def __init__(self, app, redis_url: str = None, limits: Dict = None):
        super().__init__(app)
        self.redis_url = redis_url or REDIS_URL
        self.limits = limits or LIMITS
        # We'll lazily create Redis connection on first request
        self._redis = None

    async def get_redis(self):
        if self._redis is None:
            self._redis = from_url(self.redis_url, decode_responses=True)
        return self._redis

    def _get_limits_for_path(self, path: str) -> Tuple[int, int, int]:
        """Get (ip_limit, user_limit, period) for given path."""
        # Find longest matching prefix
        for prefix in sorted(self.limits.keys(), key=lambda p: -len(p)):
            if path.startswith(prefix):
                return self.limits[prefix]
        return self.limits["default"]

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health check maybe?
        # We'll apply to all.
        ip = request.client.host if request.client else "unknown"
        user_id = request.headers.get("X-User-ID", None)

        # Get limits for this path
        ip_limit, user_limit, period = self._get_limits_for_path(request.url.path)

        redis = await self.get_redis()

        # Check IP limit
        ip_key = f"rate:ip:{ip}"
        ip_count = await redis.incr(ip_key)
        if ip_count == 1:
            await redis.expire(ip_key, period)
        ip_remaining = max(0, ip_limit - ip_count)
        ip_reset = await redis.ttl(ip_key)

        # If user_id present, check user limit
        if user_id:
            user_key = f"rate:user:{user_id}"
            user_count = await redis.incr(user_key)
            if user_count == 1:
                await redis.expire(user_key, period)
            user_remaining = max(0, user_limit - user_count)
            user_reset = await redis.ttl(user_key)
        else:
            user_limit = ip_limit  # for header
            user_remaining = ip_remaining
            user_reset = ip_reset

        # If either limit exceeded, return 429
        if ip_count > ip_limit or (user_id and user_count > user_limit):
            # Determine reset time for Retry-After header (use max of both ttl maybe)
            reset_after = max(ip_reset, user_reset) if user_id else ip_reset
            reset_after = reset_after if reset_after > 0 else period
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limit_exceeded",
                    "message": "Rate limit exceeded. Please try again later.",
                    "retry_after_seconds": reset_after,
                },
                headers={
                    "X-RateLimit-Limit": str(ip_limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time() + reset_after)),
                    "Retry-After": str(reset_after),
                },
            )

        # Proceed with request
        response = await call_next(request)

        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(ip_limit)
        response.headers["X-RateLimit-Remaining"] = str(ip_remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time() + ip_reset))

        return response
