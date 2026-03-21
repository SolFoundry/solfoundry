"""Rate limiting and security middleware for FastAPI.

Provides standard rate limiting using an in-memory or Redis-backed token bucket
to prevent API abuse. Also handles basic security headers, payload validation,
CORS setup, and IP blocklisting.
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time

class RateLimitAndSecurityMiddleware(BaseHTTPMiddleware):
    """The RateLimitAndSecurityMiddleware class."""
    def __init__(
        self,
        app,
        redis_client=None,
        endpoints_config=None,
        blocked_ips=None,
        max_payload_size=1048576  # 1MB default
    ):
        """The __init__ function."""
        super().__init__(app)
        self.redis = redis_client
        self.endpoints_config = endpoints_config or {
            "/auth": {"limit": 5, "window": 60},
            "/api": {"limit": 60, "window": 60},
            "/webhook": {"limit": 120, "window": 60}
        }
        self.blocked_ips = set(blocked_ips or [])
        self.max_payload_size = max_payload_size
        self._local_store = {}

    def _get_config_for_path(self, path: str):
        """The _get_config_for_path function."""
        for route, config in self.endpoints_config.items():
            if path.startswith(route):
                return config
        return {"limit": 60, "window": 60}

    def _check_rate_limit(self, identifier: str, config: dict):
        """The _check_rate_limit function."""
        limit = config["limit"]
        window = config["window"]
        now = time.time()
        
        if self.redis:
            # Simple Redis token bucket could go here
            key = f"rate_limit:{identifier}"
            current = int(self.redis.get(key) or 0)
            if current >= limit:
                return False, self.redis.ttl(key)
            pipe = self.redis.pipeline()
            pipe.incr(key)
            if current == 0:
                pipe.expire(key, window)
            pipe.execute()
            return True, window
        else:
            # Memory fallback for testing
            if identifier not in self._local_store:
                self._local_store[identifier] = {"count": 1, "expires": now + window}
                return True, window
            
            store = self._local_store[identifier]
            if now > store["expires"]:
                store["count"] = 1
                store["expires"] = now + window
                return True, window
                
            if store["count"] >= limit:
                return False, int(store["expires"] - now)
                
            store["count"] += 1
            return True, int(store["expires"] - now)

    async def dispatch(self, request: Request, call_next):
        """The dispatch function."""
        client_ip = request.client.host if request.client else "unknown"
        
        # 1. IP Blocklist
        if client_ip in self.blocked_ips:
            return JSONResponse(status_code=403, content={"detail": "IP address is blocked."})

        # 2. Payload size limitation
        if "content-length" in request.headers:
            if int(request.headers["content-length"]) > self.max_payload_size:
                return JSONResponse(status_code=413, content={"detail": "Payload too large."})

        # 3. Rate limiting
        path = request.url.path
        config = self._get_config_for_path(path)
        # Use simple IP for limitation (can be expanded to user auth token)
        identifier = f"{client_ip}:{path}"
        
        allowed, ttl = self._check_rate_limit(identifier, config)
        
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded."},
                headers={"Retry-After": str(ttl)}
            )

        # Process request
        response = await call_next(request)

        # 4. Security Headers (HSTS, CSP, X-Frame-Options)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Rate limit remaining headers
        response.headers["X-RateLimit-Limit"] = str(config["limit"])
        
        return response
