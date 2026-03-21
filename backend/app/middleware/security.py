"""Security Middleware for SolFoundry - Sovereign 14.0 Hardened Version.

Implements standard headers, IP blocklisting via Redis, and strict 
Payload/Content-Length limits to prevent OOM and DoS attacks.
"""

import logging
from typing import Set, Optional
import redis.asyncio as redis
import os

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

log = logging.getLogger(__name__)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds production-grade security headers to all responses."""
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: https://solfoundry.org;"
        return response

class IPBlocklistMiddleware(BaseHTTPMiddleware):
    """Blocks requests from blacklisted IPs using Redis."""
    def __init__(self, app, redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")):
        super().__init__(app)
        self.redis = redis.from_url(redis_url, decode_responses=True)

    async def dispatch(self, request: Request, call_next):
        client_ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or (request.client.host if request.client else "unknown")
        
        try:
            if await self.redis.sismember("ip_blocklist", client_ip):
                log.warning("Blocked IP access attempt: %s", client_ip)
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Access forbidden: IP blacklisted", "code": "IP_BLOCKED"}
                )
        except Exception as e:
            log.error("IP Blocklist Redis failure: %s", e)
            # Fail-open in production for IP blocklist
            pass
            
        return await call_next(request)

class ContentLimitMiddleware(BaseHTTPMiddleware):
    """Enforces strict Payload Size and Rejects Streaming/Chunked (DoS prevention)."""
    def __init__(self, app, max_content_length: int = 1014 * 1024): # 1MB limit
        super().__init__(app)
        self.max_content_length = max_content_length

    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            content_length = request.headers.get("Content-Length")
            
            # 1. Reject missing Content-Length (prevents slowloris/unbound streams)
            if content_length is None:
                return JSONResponse(status_code=411, content={"detail": "Length Required"})
            
            # 2. Reject Chunked/Streaming if unexpected
            if "chunked" in request.headers.get("Transfer-Encoding", "").lower():
                return JSONResponse(status_code=403, content={"detail": "Streaming not allowed"})
            
            # 3. Enforce 1MB limit
            try:
                if int(content_length) > self.max_content_length:
                    return JSONResponse(
                        status_code=413, 
                        content={"detail": "Payload too large", "code": "PAYLOAD_TOO_LARGE"}
                    )
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length"})
                
        return await call_next(request)
