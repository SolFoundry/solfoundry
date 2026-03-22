"""Tiered rate limiting middleware for DDoS protection and abuse prevention.

This module provides two rate limiter implementations:

1. RateLimitMiddleware (Issue #197 — our security hardening):
   In-memory sliding window counter with three access tiers:
   - Anonymous: 30 requests/minute (unauthenticated users)
   - Authenticated: 120 requests/minute (users with valid JWT)
   - Admin: 300 requests/minute (users with admin role)
   Plus per-endpoint limits for sensitive operations (escrow, auth).

2. RateLimiterMiddleware (upstream Issue #158):
   Redis-backed token bucket rate limiter with per-IP and per-user limits
   using configurable limit groups (auth, api, webhooks).

Both are registered in main.py. The in-memory RateLimitMiddleware provides
immediate protection without Redis dependency; the Redis-backed
RateLimiterMiddleware provides distributed rate limiting for multi-instance
deployments.

References:
    - OWASP Rate Limiting: https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html
    - Token Bucket Algorithm: https://en.wikipedia.org/wiki/Token_bucket
"""

import logging
import os
import threading
import time
from collections import defaultdict
from typing import Callable, NamedTuple, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse, JSONResponse

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════
# In-memory sliding window rate limiter (Issue #197 — our security hardening)
# ═══════════════════════════════════════════════════════════════════════════

# Rate limit configuration (requests per window)
ANONYMOUS_RATE_LIMIT: int = int(os.getenv("RATE_LIMIT_ANONYMOUS", "30"))
AUTHENTICATED_RATE_LIMIT: int = int(os.getenv("RATE_LIMIT_AUTHENTICATED", "120"))
ADMIN_RATE_LIMIT: int = int(os.getenv("RATE_LIMIT_ADMIN", "300"))

# Sliding window size in seconds
WINDOW_SIZE_SECONDS: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))

# Per-endpoint rate limits for sensitive operations
ENDPOINT_RATE_LIMITS: dict[str, int] = {
    "POST:/api/payouts": int(os.getenv("RATE_LIMIT_PAYOUTS", "5")),
    "POST:/api/treasury/buybacks": int(os.getenv("RATE_LIMIT_BUYBACKS", "5")),
    "POST:/auth/github": int(os.getenv("RATE_LIMIT_AUTH_GITHUB", "10")),
    "POST:/auth/wallet": int(os.getenv("RATE_LIMIT_AUTH_WALLET", "10")),
    "POST:/auth/refresh": int(os.getenv("RATE_LIMIT_AUTH_REFRESH", "20")),
}

# Maximum number of tracked client IPs before cleanup
MAX_TRACKED_CLIENTS: int = int(os.getenv("RATE_LIMIT_MAX_CLIENTS", "10000"))

# Paths exempt from rate limiting
EXEMPT_PATHS: tuple[str, ...] = (
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
)

# Connection limit per IP (max concurrent requests)
MAX_CONNECTIONS_PER_IP: int = int(os.getenv("MAX_CONNECTIONS_PER_IP", "50"))


class RateLimitEntry(NamedTuple):
    """A single request timestamp entry for the sliding window counter.

    Attributes:
        timestamp: The Unix timestamp when the request was recorded.
    """
    timestamp: float


class SlidingWindowCounter:
    """Thread-safe sliding window rate limiter.

    Tracks request timestamps per client key within a configurable time window.
    Uses a lock to ensure thread safety in async contexts with multiple workers.

    Attributes:
        window_size: Duration of the sliding window in seconds.
        _entries: Dictionary mapping client keys to lists of request timestamps.
        _lock: Thread lock for concurrent access protection.
    """

    def __init__(self, window_size: int = WINDOW_SIZE_SECONDS) -> None:
        """Initialize the sliding window counter.

        Args:
            window_size: The duration of the rate limit window in seconds.
        """
        self.window_size = window_size
        self._entries: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._last_cleanup: float = time.time()

    def is_rate_limited(self, key: str, limit: int) -> tuple[bool, int, int]:
        """Check if a client has exceeded their rate limit.

        Removes expired entries from the window, counts remaining requests,
        and determines if the limit has been reached.

        Args:
            key: The client identifier (typically IP address or IP:endpoint).
            limit: The maximum number of requests allowed in the window.

        Returns:
            tuple: A 3-tuple of (is_limited, remaining_requests, retry_after_seconds).
                - is_limited: True if the request should be rejected.
                - remaining_requests: Number of requests still available.
                - retry_after_seconds: Seconds until the next available slot (0 if not limited).
        """
        now = time.time()
        cutoff = now - self.window_size

        with self._lock:
            # Purge expired entries for this key
            entries = self._entries[key]
            self._entries[key] = [ts for ts in entries if ts > cutoff]
            entries = self._entries[key]

            current_count = len(entries)

            if current_count >= limit:
                # Calculate retry-after from oldest entry in window
                oldest = entries[0] if entries else now
                retry_after = max(1, int(oldest + self.window_size - now))
                return True, 0, retry_after

            # Record this request
            self._entries[key].append(now)
            remaining = limit - current_count - 1

            # Periodic cleanup of stale clients
            if now - self._last_cleanup > self.window_size * 2:
                self._cleanup(cutoff)
                self._last_cleanup = now

            return False, remaining, 0

    def _cleanup(self, cutoff: float) -> None:
        """Remove entries for clients with no recent requests.

        Called periodically to prevent unbounded memory growth from tracking
        clients that are no longer active.

        Args:
            cutoff: Timestamp before which entries are considered expired.
        """
        stale_keys = [
            key for key, entries in self._entries.items()
            if not entries or entries[-1] <= cutoff
        ]
        for key in stale_keys:
            del self._entries[key]

        if stale_keys:
            logger.debug("Rate limiter cleanup: removed %d stale client entries", len(stale_keys))

    def get_client_count(self) -> int:
        """Return the number of currently tracked client keys.

        Returns:
            int: The number of unique client keys in the tracking store.
        """
        with self._lock:
            return len(self._entries)

    def reset(self) -> None:
        """Clear all rate limit tracking data. Used for testing."""
        with self._lock:
            self._entries.clear()


# Global counter instances
_global_counter = SlidingWindowCounter()
_endpoint_counter = SlidingWindowCounter()
_connection_tracker: dict[str, int] = defaultdict(int)
_connection_lock = threading.Lock()


def _get_client_ip(request: Request) -> str:
    """Extract the client IP address from the request.

    Checks the X-Forwarded-For header first (for reverse proxy setups),
    falling back to the direct client address.

    Args:
        request: The incoming HTTP request.

    Returns:
        str: The client's IP address string.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain (client's actual IP)
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _get_rate_limit_tier(request: Request) -> tuple[str, int]:
    """Determine the rate limit tier for the current request.

    Inspects the Authorization header to classify the request as anonymous,
    authenticated, or admin. The tier determines the maximum requests per
    window.

    Args:
        request: The incoming HTTP request.

    Returns:
        tuple: A 2-tuple of (tier_name, max_requests_per_window).
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header:
        return "anonymous", ANONYMOUS_RATE_LIMIT

    # Presence of a valid-looking bearer token = authenticated tier
    # Actual token validation happens in the auth dependency
    if auth_header.startswith("Bearer "):
        # Check for admin role (set by auth middleware or header)
        if request.headers.get("X-Admin-Role") == "true":
            return "admin", ADMIN_RATE_LIMIT
        return "authenticated", AUTHENTICATED_RATE_LIMIT

    return "anonymous", ANONYMOUS_RATE_LIMIT


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware enforcing tiered rate limits and connection limits per client IP.

    Applies both global per-IP rate limits (based on auth tier) and per-endpoint
    limits for sensitive operations like escrow payouts and authentication.

    Rate limit information is included in response headers:
    - X-RateLimit-Limit: Maximum requests allowed in the window
    - X-RateLimit-Remaining: Requests remaining in the current window
    - X-RateLimit-Reset: Seconds until the window resets
    - Retry-After: Seconds to wait before retrying (only on 429 responses)

    Attributes:
        global_counter: Sliding window counter for per-IP global limits.
        endpoint_counter: Sliding window counter for per-endpoint limits.
    """

    def __init__(self, app: Callable) -> None:
        """Initialize the rate limit middleware.

        Args:
            app: The ASGI application to wrap.
        """
        super().__init__(app)
        self.global_counter = _global_counter
        self.endpoint_counter = _endpoint_counter
        logger.info(
            "RateLimitMiddleware initialized (anonymous: %d/min, auth: %d/min, admin: %d/min)",
            ANONYMOUS_RATE_LIMIT,
            AUTHENTICATED_RATE_LIMIT,
            ADMIN_RATE_LIMIT,
        )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Apply rate limiting to the request.

        Checks both global and endpoint-specific limits. If either limit is
        exceeded, returns a 429 Too Many Requests response with appropriate
        Retry-After header.

        Also enforces per-IP connection limits to prevent connection exhaustion
        attacks.

        Args:
            request: The incoming HTTP request.
            call_next: The next middleware or route handler.

        Returns:
            Response: Either the application response with rate limit headers,
                or a 429 error if the client has exceeded their limit.
        """
        # Skip rate limiting for exempt paths
        if any(request.url.path.startswith(p) for p in EXEMPT_PATHS):
            return await call_next(request)

        client_ip = _get_client_ip(request)
        tier_name, tier_limit = _get_rate_limit_tier(request)

        # Connection limiting
        with _connection_lock:
            if _connection_tracker[client_ip] >= MAX_CONNECTIONS_PER_IP:
                logger.warning(
                    "Connection limit exceeded for %s (%d concurrent)",
                    client_ip,
                    _connection_tracker[client_ip],
                )
                return Response(
                    content='{"detail":"Too many concurrent connections"}',
                    status_code=429,
                    media_type="application/json",
                    headers={"Retry-After": "5"},
                )
            _connection_tracker[client_ip] += 1

        try:
            # Global rate limit check
            is_limited, remaining, retry_after = self.global_counter.is_rate_limited(
                f"global:{client_ip}", tier_limit
            )

            if is_limited:
                logger.warning(
                    "Rate limit exceeded for %s (tier: %s, limit: %d/min)",
                    client_ip,
                    tier_name,
                    tier_limit,
                )
                return Response(
                    content='{"detail":"Rate limit exceeded. Please try again later."}',
                    status_code=429,
                    media_type="application/json",
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(tier_limit),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(retry_after),
                    },
                )

            # Per-endpoint rate limit check for sensitive operations
            endpoint_key = f"{request.method}:{request.url.path}"
            endpoint_limit = ENDPOINT_RATE_LIMITS.get(endpoint_key)

            if endpoint_limit is not None:
                ep_limited, ep_remaining, ep_retry = self.endpoint_counter.is_rate_limited(
                    f"endpoint:{client_ip}:{endpoint_key}", endpoint_limit
                )
                if ep_limited:
                    logger.warning(
                        "Endpoint rate limit exceeded for %s on %s (limit: %d/min)",
                        client_ip,
                        endpoint_key,
                        endpoint_limit,
                    )
                    return Response(
                        content='{"detail":"Endpoint rate limit exceeded. Please try again later."}',
                        status_code=429,
                        media_type="application/json",
                        headers={
                            "Retry-After": str(ep_retry),
                            "X-RateLimit-Limit": str(endpoint_limit),
                            "X-RateLimit-Remaining": "0",
                            "X-RateLimit-Reset": str(ep_retry),
                        },
                    )
                remaining = min(remaining, ep_remaining)

            # Process the request
            response = await call_next(request)

            # Add rate limit headers to successful responses
            response.headers["X-RateLimit-Limit"] = str(tier_limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(WINDOW_SIZE_SECONDS)

            return response

        finally:
            # Decrement connection counter
            with _connection_lock:
                _connection_tracker[client_ip] = max(0, _connection_tracker[client_ip] - 1)


# ═══════════════════════════════════════════════════════════════════════════
# Redis-backed token bucket rate limiter (upstream Issue #158)
# ═══════════════════════════════════════════════════════════════════════════

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
        """Apply Redis-backed token bucket rate limiting."""
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
