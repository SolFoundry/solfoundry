"""Middleware to block requests from IPs on a Redis-backed blocklist."""

import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from redis.asyncio import from_url

from app.core.logging_config import get_logger

logger = get_logger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
BLACKLIST_KEY = "ip:blocklist"  # Redis set of blocked IPs


class IPBlocklistMiddleware(BaseHTTPMiddleware):
    """Deny access to IPs in the blocklist."""

    def __init__(self, app, redis_url: str = None):
        super().__init__(app)
        self.redis_url = redis_url or REDIS_URL
        self._redis = None

    async def get_redis(self):
        if self._redis is None:
            self._redis = from_url(self.redis_url, decode_responses=True)
        return self._redis

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        redis = await self.get_redis()

        # Check if IP is in blocklist set
        is_blocked = await redis.sismember(BLACKLIST_KEY, ip)
        if is_blocked:
            logger.warning("Blocked request from blacklisted IP: %s", ip)
            return JSONResponse(
                status_code=403,
                content={"error": "blocked", "message": "Your IP address has been blocked."}
            )

        return await call_next(request)
