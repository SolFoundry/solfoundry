"""Rate-limiting middleware using Redis and a LUA-based token bucket algorithm.

Implements strict IP-based and client-ID-based rate limiting to prevent 
DoS and abuse, with structured logging and standard headers.
"""

import time
import logging
import os
from typing import Optional, Tuple
import redis.asyncio as redis

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

log = logging.getLogger(__name__)

# LUA script for atomic token-bucket rate limiting in Redis
# KEYS[1]: Rate limit bucket key
# ARGV[1]: Current timestamp (seconds)
# ARGV[2]: Rate (tokens per second)
# ARGV[3]: Burst (max tokens)
# ARGV[4]: Cost (tokens for this request)
RATE_LIMIT_LUA = """
local bucket_key = KEYS[1]
local now = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local burst = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local state = redis.call("HMGET", bucket_key, "tokens", "last_refill")
local tokens = tonumber(state[1]) or burst
local last_refill = tonumber(state[2]) or now

-- Refill tokens based on time passed
local elapsed = math.max(0, now - last_refill)
tokens = math.min(burst, tokens + (elapsed * rate))

local allowed = tokens >= cost
if allowed then
    tokens = tokens - cost
end

redis.call("HMSET", bucket_key, "tokens", tokens, "last_refill", now)
redis.call("EXPIRE", bucket_key, 60) -- Auto-cleanup after 1 min of inactivity

return {allowed and 1 or 0, tokens}
"""

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Production-ready rate limiting using Redis."""

    def __init__(self, app, redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")):
        super().__init__(app)
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self._lua_script = None

    async def _get_client_id(self, request: Request) -> str:
        """Identify client by XFF header (trust first hop) or direct remote address."""
        xff = request.headers.get("X-Forwarded-For")
        if xff:
            return xff.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def _check_limit(self, client_id: str, rate: float = 2.0, burst: int = 10) -> Tuple[bool, float]:
        """Perform atomic rate limit check via Redis LUA."""
        try:
            if not self._lua_script:
                self._lua_script = self.redis.register_script(RATE_LIMIT_LUA)
            
            key = f"rate_limit:{client_id}"
            now = time.time()
            allowed, tokens = await self._lua_script(keys=[key], args=[now, rate, burst, 1])
            return bool(allowed), float(tokens)
        except Exception as e:
            log.error("Redis rate limit failure: %s. Falling back to ALLOW.", e)
            return True, 10.0 # Fail-open in production to prevent system lockout

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip rate limit for health check
        if request.url.path == "/api/health":
            return await call_next(request)

        client_id = await self._get_client_id(request)
        allowed, remaining = await self._check_limit(client_id)

        if not allowed:
            log.warning("Rate limit exceeded for %s", client_id)
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."},
                headers={
                    "Retry-After": "5",
                    "X-RateLimit-Limit": "2",
                    "X-RateLimit-Remaining": "0"
                }
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = "2"
        response.headers["X-RateLimit-Remaining"] = str(int(remaining))
        return response
