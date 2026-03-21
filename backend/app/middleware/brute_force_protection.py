"""Brute force protection middleware for authentication endpoints.

Implements progressive delays and account lockouts for failed login attempts.
Uses Redis for distributed tracking across multiple instances.
"""

import time
import logging
from typing import Callable, Optional, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# Configuration
MAX_FAILED_ATTEMPTS = 5  # Max failed attempts before lockout
LOCKOUT_DURATION_SECONDS = 900  # 15 minutes lockout
PROGRESSIVE_DELAYS = [0, 1, 2, 5, 10]  # Delays in seconds before each retry

# Lua script for atomic failed attempt tracking
FAILED_ATTEMPT_SCRIPT = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local lockout_duration = tonumber(ARGV[2])
local max_attempts = tonumber(ARGV[3])

-- Check if currently locked out
local lockout_end = redis.call("GET", key .. ":lockout")
if lockout_end and tonumber(lockout_end) > now then
    return {0, tonumber(lockout_end) - now, 0}
end

-- Get current failed count
local failed = tonumber(redis.call("GET", key .. ":failed") or "0")

-- Increment failed count
failed = failed + 1
redis.call("SET", key .. ":failed", failed, "EX", lockout_duration)

-- Check if should lock out
if failed >= max_attempts then
    local lockout_end_time = now + lockout_duration
    redis.call("SET", key .. ":lockout", lockout_end_time, "EX", lockout_duration)
    redis.call("DEL", key .. ":failed")
    return {0, lockout_duration, failed}
end

return {1, 0, failed}
"""

# Lua script for resetting failed attempts on successful login
RESET_ATTEMPTS_SCRIPT = """
local key = KEYS[1]
redis.call("DEL", key .. ":failed")
redis.call("DEL", key .. ":lockout")
return 1
"""


class BruteForceProtectionMiddleware(BaseHTTPMiddleware):
    """Protect authentication endpoints from brute force attacks."""
    
    def __init__(self, app, protected_paths: Optional[list] = None):
        """Initialize middleware.
        
        Args:
            app: FastAPI application
            protected_paths: List of paths to protect (default: auth endpoints)
        """
        super().__init__(app)
        self.protected_paths = protected_paths or [
            "/api/auth/github",
            "/api/auth/wallet",
            "/api/auth/wallet/message",
        ]
        self._failed_script = None
        self._reset_script = None
    
    def _is_protected_path(self, path: str) -> bool:
        """Check if path requires brute force protection."""
        return any(path.startswith(p) for p in self.protected_paths)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Check and enforce brute force protection."""
        
        if not self._is_protected_path(request.url.path):
            return await call_next(request)
        
        # Only protect POST requests (login attempts)
        if request.method != "POST":
            return await call_next(request)
        
        # Get identifier (IP or username if available)
        identifier = self._get_identifier(request)
        key = f"bfp:{identifier}"
        
        # Check if locked out
        allowed, remaining_time, failed_attempts = await self._check_failed_attempts(key)
        
        if not allowed:
            logger.warning(
                f"Brute force lockout for {identifier}: {remaining_time}s remaining"
            )
            return self._lockout_response(remaining_time)
        
        # Apply progressive delay based on failed attempts
        if failed_attempts > 0:
            delay = self._get_progressive_delay(failed_attempts)
            if delay > 0:
                logger.info(
                    f"Progressive delay for {identifier}: {delay}s (attempt {failed_attempts + 1})"
                )
                time.sleep(delay)
        
        # Process request
        response = await call_next(request)
        
        # Track result
        if response.status_code == 401:
            # Failed login - increment counter
            await self._increment_failed_attempts(key)
        elif response.status_code in (200, 201):
            # Successful login - reset counter
            await self._reset_failed_attempts(key)
        
        return response
    
    def _get_identifier(self, request: Request) -> str:
        """Get unique identifier for the request source.
        
        Uses X-Forwarded-For header if available, otherwise client IP.
        """
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take first IP in chain (original client)
            return forwarded.split(",")[0].strip()
        
        if request.client:
            return request.client.host
        
        return "unknown"
    
    def _get_progressive_delay(self, failed_attempts: int) -> int:
        """Get delay in seconds based on failed attempt count."""
        if failed_attempts <= 0:
            return 0
        if failed_attempts > len(PROGRESSIVE_DELAYS):
            return PROGRESSIVE_DELAYS[-1]
        return PROGRESSIVE_DELAYS[failed_attempts - 1]
    
    async def _check_failed_attempts(self, key: str) -> Tuple[bool, int, int]:
        """Check if account is locked out.
        
        Returns:
            Tuple of (allowed, remaining_time, failed_attempts)
        """
        try:
            redis = await get_redis()
            
            if not self._failed_script:
                self._failed_script = redis.register_script(FAILED_ATTEMPT_SCRIPT)
            
            now = time.time()
            result = await self._failed_script(
                keys=[key],
                args=[now, LOCKOUT_DURATION_SECONDS, MAX_FAILED_ATTEMPTS]
            )
            
            allowed = bool(result[0])
            remaining_time = int(result[1])
            failed_attempts = int(result[2])
            
            return allowed, remaining_time, failed_attempts
            
        except Exception as e:
            logger.error(f"Brute force protection Redis error: {e}")
            # Fail open - allow request if Redis is down
            return True, 0, 0
    
    async def _increment_failed_attempts(self, key: str) -> None:
        """Increment failed attempt counter."""
        # Already incremented in check, just log
        logger.info(f"Failed login attempt recorded for {key}")
    
    async def _reset_failed_attempts(self, key: str) -> None:
        """Reset failed attempt counter on successful login."""
        try:
            redis = await get_redis()
            
            if not self._reset_script:
                self._reset_script = redis.register_script(RESET_ATTEMPTS_SCRIPT)
            
            await self._reset_script(keys=[key])
            logger.info(f"Failed attempts reset for {key}")
            
        except Exception as e:
            logger.error(f"Failed to reset brute force counter: {e}")
    
    def _lockout_response(self, remaining_seconds: int) -> JSONResponse:
        """Create lockout response."""
        return JSONResponse(
            status_code=429,
            content={
                "message": "Too many failed login attempts. Please try again later.",
                "code": "ACCOUNT_LOCKED",
                "retry_after": remaining_seconds,
            },
            headers={
                "Retry-After": str(remaining_seconds),
            },
        )


async def check_account_lockout(identifier: str) -> Tuple[bool, int]:
    """Check if an account is locked out.
    
    Can be called directly from auth endpoints for additional protection.
    
    Args:
        identifier: User identifier (IP, email, or username)
    
    Returns:
        Tuple of (is_locked, remaining_seconds)
    """
    try:
        redis = await get_redis()
        key = f"bfp:{identifier}"
        lockout_end = await redis.get(f"{key}:lockout")
        
        if lockout_end:
            remaining = int(float(lockout_end)) - int(time.time())
            if remaining > 0:
                return True, remaining
        
        return False, 0
    except Exception:
        return False, 0


async def record_failed_login(identifier: str) -> int:
    """Record a failed login attempt.
    
    Args:
        identifier: User identifier
    
    Returns:
        Number of failed attempts
    """
    try:
        redis = await get_redis()
        key = f"bfp:{identifier}:failed"
        count = await redis.incr(key)
        await redis.expire(key, LOCKOUT_DURATION_SECONDS)
        return count
    except Exception:
        return 0


async def clear_failed_logins(identifier: str) -> None:
    """Clear failed login attempts for an identifier."""
    try:
        redis = await get_redis()
        await redis.delete(f"bfp:{identifier}:failed")
        await redis.delete(f"bfp:{identifier}:lockout")
    except Exception:
        pass