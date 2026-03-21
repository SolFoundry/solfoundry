"""Brute force protection middleware for authentication endpoints.

Implements failed login attempt tracking and temporary IP blocking
to prevent credential stuffing and brute force attacks.
"""

import time
import logging
from typing import Callable, Optional
from datetime import datetime, timezone, timedelta

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# Configuration
MAX_FAILED_ATTEMPTS = int(os.getenv("BRUTE_FORCE_MAX_ATTEMPTS", "5"))
LOCKOUT_DURATION_SECONDS = int(os.getenv("BRUTE_FORCE_LOCKOUT_SECONDS", "900"))  # 15 minutes
FAILED_ATTEMPTS_WINDOW_SECONDS = int(os.getenv("BRUTE_FORCE_WINDOW_SECONDS", "300"))  # 5 minutes

# Redis key prefixes
FAILED_ATTEMPTS_PREFIX = "bf:failed:"
LOCKOUT_PREFIX = "bf:locked:"

# Lua script for atomic increment with expiry
INCREMENT_SCRIPT = """
local key = KEYS[1]
local window = tonumber(ARGV[1])
local max_attempts = tonumber(ARGV[2])
local lockout_key = KEYS[2]
local lockout_duration = tonumber(ARGV[3])

local attempts = redis.call("INCR", key)
if attempts == 1 then
    redis.call("EXPIRE", key, window)
end

if attempts >= max_attempts then
    redis.call("SETEX", lockout_key, lockout_duration, "1")
    return {attempts, 1}
end

return {attempts, 0}
"""

import os


class BruteForceMiddleware(BaseHTTPMiddleware):
    """Middleware to protect against brute force login attempts."""
    
    def __init__(self, app, protected_paths: Optional[list] = None):
        """Initialize the middleware.
        
        Args:
            app: The FastAPI application.
            protected_paths: List of paths to protect (default: auth endpoints).
        """
        super().__init__(app)
        self.protected_paths = protected_paths or [
            "/api/auth/github",
            "/api/auth/wallet",
            "/api/auth/wallet/message",
        ]
        self._lua_script = None
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process the request and check for brute force attempts."""
        # Only protect specific auth paths
        if request.url.path not in self.protected_paths:
            return await call_next(request)
        
        # Get client identifier (IP + optional user agent hash for additional fingerprinting)
        client_ip = self._get_client_ip(request)
        
        # Check if currently locked out
        is_locked, remaining_time = await self._is_locked_out(client_ip)
        if is_locked:
            logger.warning(
                f"Brute force lockout: IP {client_ip} blocked for {remaining_time}s"
            )
            return self._locked_response(remaining_time)
        
        # Process request
        response = await call_next(request)
        
        # Track failed attempts (401 responses)
        if response.status_code == 401:
            await self._record_failed_attempt(client_ip)
        
        # Clear attempts on successful auth (200/201)
        elif response.status_code in (200, 201):
            await self._clear_failed_attempts(client_ip)
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request, handling proxies.
        
        Args:
            request: The FastAPI request.
        
        Returns:
            Client IP address.
        """
        # Check X-Forwarded-For header (from trusted proxies)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take the first IP (original client) from the chain
            return forwarded.split(",")[0].strip()
        
        # Fall back to direct client IP
        return request.client.host if request.client else "unknown"
    
    async def _is_locked_out(self, client_ip: str) -> tuple[bool, int]:
        """Check if an IP is currently locked out.
        
        Args:
            client_ip: The client IP address.
        
        Returns:
            Tuple of (is_locked, remaining_seconds).
        """
        try:
            redis = await get_redis()
            lockout_key = f"{LOCKOUT_PREFIX}{client_ip}"
            
            ttl = await redis.ttl(lockout_key)
            if ttl > 0:
                return True, ttl
            
            return False, 0
        except Exception as e:
            logger.error(f"Redis error checking lockout: {e}")
            # Fail open - don't block if Redis is unavailable
            return False, 0
    
    async def _record_failed_attempt(self, client_ip: str) -> int:
        """Record a failed authentication attempt.
        
        Args:
            client_ip: The client IP address.
        
        Returns:
            Current number of failed attempts.
        """
        try:
            redis = await get_redis()
            
            if not self._lua_script:
                self._lua_script = redis.register_script(INCREMENT_SCRIPT)
            
            failed_key = f"{FAILED_ATTEMPTS_PREFIX}{client_ip}"
            lockout_key = f"{LOCKOUT_PREFIX}{client_ip}"
            
            result = await self._lua_script(
                keys=[failed_key, lockout_key],
                args=[
                    FAILED_ATTEMPTS_WINDOW_SECONDS,
                    MAX_FAILED_ATTEMPTS,
                    LOCKOUT_DURATION_SECONDS,
                ]
            )
            
            attempts = int(result[0])
            is_now_locked = bool(result[1])
            
            if is_now_locked:
                logger.warning(
                    f"Brute force detected: IP {client_ip} locked after {attempts} failed attempts"
                )
            
            return attempts
        except Exception as e:
            logger.error(f"Redis error recording failed attempt: {e}")
            return 0
    
    async def _clear_failed_attempts(self, client_ip: str) -> None:
        """Clear failed attempts after successful authentication.
        
        Args:
            client_ip: The client IP address.
        """
        try:
            redis = await get_redis()
            failed_key = f"{FAILED_ATTEMPTS_PREFIX}{client_ip}"
            await redis.delete(failed_key)
        except Exception as e:
            logger.error(f"Redis error clearing failed attempts: {e}")
    
    def _locked_response(self, remaining_seconds: int) -> JSONResponse:
        """Create a lockout response.
        
        Args:
            remaining_seconds: Seconds until lockout expires.
        
        Returns:
            JSON response with lockout information.
        """
        return JSONResponse(
            status_code=429,
            content={
                "message": "Too many failed login attempts. Please try again later.",
                "code": "ACCOUNT_LOCKED",
                "retry_after": remaining_seconds,
            },
            headers={
                "Retry-After": str(remaining_seconds),
                "X-RateLimit-Remaining": "0",
            }
        )


async def record_failed_login(client_ip: str) -> int:
    """Standalone function to record a failed login from outside middleware.
    
    Use this in auth services to record failures for non-401 responses
    (e.g., invalid credentials that still return 200 but with error message).
    
    Args:
        client_ip: The client IP address.
    
    Returns:
        Current number of failed attempts.
    """
    try:
        redis = await get_redis()
        failed_key = f"{FAILED_ATTEMPTS_PREFIX}{client_ip}"
        lockout_key = f"{LOCKOUT_PREFIX}{client_ip}"
        
        # Atomic increment with Lua script
        script = redis.register_script(INCREMENT_SCRIPT)
        result = await script(
            keys=[failed_key, lockout_key],
            args=[
                FAILED_ATTEMPTS_WINDOW_SECONDS,
                MAX_FAILED_ATTEMPTS,
                LOCKOUT_DURATION_SECONDS,
            ]
        )
        
        return int(result[0])
    except Exception as e:
        logger.error(f"Redis error recording failed login: {e}")
        return 0


async def clear_failed_attempts(client_ip: str) -> None:
    """Standalone function to clear failed attempts after successful login.
    
    Args:
        client_ip: The client IP address.
    """
    try:
        redis = await get_redis()
        failed_key = f"{FAILED_ATTEMPTS_PREFIX}{client_ip}"
        await redis.delete(failed_key)
    except Exception as e:
        logger.error(f"Redis error clearing failed attempts: {e}")


async def is_locked_out(client_ip: str) -> tuple[bool, int]:
    """Standalone function to check if an IP is locked out.
    
    Args:
        client_ip: The client IP address.
    
    Returns:
        Tuple of (is_locked, remaining_seconds).
    """
    try:
        redis = await get_redis()
        lockout_key = f"{LOCKOUT_PREFIX}{client_ip}"
        
        ttl = await redis.ttl(lockout_key)
        if ttl > 0:
            return True, ttl
        
        return False, 0
    except Exception as e:
        logger.error(f"Redis error checking lockout: {e}")
        return False, 0