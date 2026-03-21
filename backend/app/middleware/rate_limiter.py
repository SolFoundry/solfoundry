"""Rate limiter middleware for FastAPI using Redis token bucket (Issue #158).

Provides per-IP and per-user rate limiting with configurable limits per
endpoint group. Rate limits are enforced on all routes and return
X-RateLimit headers.
"""

import time
import logging
from typing import Callable, Optional, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# Token Bucket Lua Script
# ARGV[1]: Now (timestamp)
# ARGV[2]: Rate (tokens per second)
# ARGV[3]: Capacity (burst size)
# ARGV[4]: Requested tokens (usually 1)
# Returns {allowed, remaining, reset_time}
TOKEN_BUCKET_SCRIPT = """
local now = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local last_tokens = tonumber(redis.call("HGET", KEYS[1], "tokens")) or capacity
local last_refreshed = tonumber(redis.call("HGET", KEYS[1], "refreshed")) or now

local delta = math.max(0, now - last_refreshed)
local current_tokens = math.min(capacity, last_tokens + (delta * rate))

local allowed = 0
if current_tokens >= requested then
    current_tokens = current_tokens - requested
    allowed = 1
end

redis.call("HSET", KEYS[1], "tokens", current_tokens, "refreshed", now)
redis.call("EXPIRE", KEYS[1], math.ceil(capacity / rate) + 1)

local reset_time = now + ((capacity - current_tokens) / rate)
return {allowed, math.floor(current_tokens), math.ceil(reset_time)}
"""

# Default limit groups (capacity, rate_per_second)
# Rate is tokens/sec, capacity is max burst.
# auth: 5/min -> rate = 5/60 = 0.0833, capacity = 5
# API: 60/min -> rate = 1.0, capacity = 60
# webhooks: 120/min -> rate = 2.0, capacity = 120
LIMIT_GROUPS = {
    "auth": (5, 5 / 60.0),
    "api": (60, 1.0),
    "webhooks": (120, 2.0),
    "default": (60, 1.0),
}


def _get_group(path: str) -> str:
    """Map request path to a limit group."""
    if path.startswith("/api/auth"):
        return "auth"
    if path.startswith("/api/webhooks"):
        return "webhooks"
    if path.startswith("/api"):
        return "api"
    return "default"


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Redis-backed token bucket rate limiter middleware."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip health check and websockets (handled separately or not limited)
        if request.url.path == "/health" or request.scope.get("type") == "websocket":
            return await call_next(request)

        group_name = _get_group(request.url.path)
        capacity, rate = LIMIT_GROUPS.get(group_name, LIMIT_GROUPS["default"])

        # Determine identifiers (IP and User)
        ip = request.client.host
        user_id = request.headers.get("X-User-ID") or getattr(request.state, "user_id", None)

        # Check IP Limit
        ip_key = f"rl:ip:{ip}:{group_name}"
        ip_allowed, ip_rem, ip_reset = await self._check_limit(ip_key, capacity, rate)

        if not ip_allowed:
            return self._rate_limit_response(ip_rem, ip_reset)

        # Check User Limit (if available)
        user_rem, user_reset = ip_rem, ip_reset
        if user_id:
            user_key = f"rl:usr:{user_id}:{group_name}"
            user_allowed, user_rem, user_reset = await self._check_limit(user_key, capacity, rate)
            if not user_allowed:
                return self._rate_limit_response(user_rem, user_reset)

        # Proceed to next middleware/handler
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(capacity)
        response.headers["X-RateLimit-Remaining"] = str(min(ip_rem, user_rem))
        response.headers["X-RateLimit-Reset"] = str(min(ip_reset, user_reset))

        return response

    async def _check_limit(self, key: str, capacity: int, rate: float) -> Tuple[bool, int, int]:
        """Execute token bucket script in Redis."""
        try:
            redis = await get_redis()
            # Register script only once
            if not hasattr(self, "_lua_script"):
                self._lua_script = redis.register_script(TOKEN_BUCKET_SCRIPT)

            now = time.time()
            # allowed, remaining, reset_time
            res = await self._lua_script(keys=[key], args=[now, rate, capacity, 1])
            return bool(res[0]), int(res[1]), int(res[2])
        except Exception as e:
            logger.error(f"Rate limiter Redis error: {e}")
            # Fail open if Redis is down (to prevent total outage)
            return True, capacity, int(time.time())

    def _rate_limit_response(self, remaining: int, reset: int) -> JSONResponse:
        """Create a 429 Too Many Requests response."""
        return JSONResponse(
            status_code=429,
            content={
                "message": "Too many requests. Please slow down.",
                "code": "RATE_LIMIT_EXCEEDED",
                "retry_after": max(0, reset - int(time.time())),
            },
            headers={
                "X-RateLimit-Remaining": str(remaining),
                "X-RateLimit-Reset": str(reset),
                "Retry-After": str(max(0, reset - int(time.time()))),
            },
        )
