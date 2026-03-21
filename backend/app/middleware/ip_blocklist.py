"""IP Blocklist middleware for FastAPI using Redis (Issue #159).

Checks the request IP against a Redis Set 'ip_blocklist'. If found, returns
403 Forbidden.
"""

import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.redis import get_redis

logger = logging.getLogger(__name__)


class IPBlocklistMiddleware(BaseHTTPMiddleware):
    """Enforce IP blocklist check before all requests."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Ignore health checks
        if request.url.path == "/health":
            return await call_next(request)

        # Get request IP
        ip = request.client.host

        try:
            redis = await get_redis()
            # Redis set contains blocked IPs
            is_blocked = await redis.sismember("ip_blocklist", ip)

            if is_blocked:
                logger.warning(f"Blocked request for blacklisted IP: {ip}")
                return JSONResponse(
                    status_code=403,
                    content={
                        "message": "Access denied for this IP address.",
                        "code": "IP_BLOCKED",
                    },
                )

        except Exception as e:
            # Log error but allow request to proceed (fail open for Redis failure)
            logger.error(f"IP Blocklist Redis error: {e}")

        # Continue with request
        return await call_next(request)
