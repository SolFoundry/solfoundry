"""Authentication middleware and dependencies.

Provides three levels of authentication for the API:

1. ``get_current_user_id`` -- Standard JWT auth for user-facing endpoints.
2. ``get_admin_user_id`` -- JWT auth with admin role verification.
3. ``get_internal_or_user`` -- Accepts either JWT or internal API key
   (for bot/pipeline endpoints like payouts, escrow, review scores).

Security fixes (2026-03-24):
- Removed AUTH_ENABLED bypass (was allowing unauthenticated access)
- Removed X-User-ID header trust (was a spoofing vector)
- All auth now validates JWT via auth_service.decode_token
- Added admin role checking via ADMIN_USER_IDS env var
- Added internal API key support for machine-to-machine auth
"""

import logging
import os
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.constants import INTERNAL_SYSTEM_USER_ID

logger = logging.getLogger(__name__)

# Security scheme for OpenAPI documentation
security = HTTPBearer(auto_error=False)

# Internal API key for machine-to-machine auth (bounty bot, GitHub Actions pipeline)
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

# Comma-separated list of admin user UUIDs
_admin_ids_raw = os.getenv("ADMIN_USER_IDS", "")
ADMIN_USER_IDS: set[str] = {
    uid.strip() for uid in _admin_ids_raw.split(",") if uid.strip()
}

if not INTERNAL_API_KEY:
    logger.warning(
        "INTERNAL_API_KEY not set -- internal/bot endpoints will reject "
        "machine-to-machine requests. Set this env var in production."
    )

if not ADMIN_USER_IDS:
    logger.warning(
        "ADMIN_USER_IDS not set -- admin-only endpoints will reject all "
        "requests. Set this env var with comma-separated admin UUIDs."
    )


def _decode_jwt(token: str) -> str:
    """Decode a JWT token and return the user_id from claims.

    Uses auth_service.decode_token for proper HS256 JWT validation.
    Import is deferred to avoid circular imports.
    """
    from app.services.auth_service import (
        decode_token,
        TokenExpiredError,
        InvalidTokenError,
    )

    try:
        user_id = decode_token(token, token_type="access")
        return user_id
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# Dependency 1: Standard user auth (JWT only)
# ---------------------------------------------------------------------------


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """Extract and validate the current user ID from a JWT Bearer token.

    This is the standard auth dependency for user-facing endpoints.
    It does NOT accept X-User-ID headers or any other bypass.

    Returns:
        The authenticated user's UUID from the JWT ``sub`` claim.

    Raises:
        HTTPException 401: If the token is missing, expired, or invalid.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _decode_jwt(credentials.credentials)


# ---------------------------------------------------------------------------
# Dependency 2: Admin auth (JWT + admin role check)
# ---------------------------------------------------------------------------


async def get_admin_user_id(
    user_id: str = Depends(get_current_user_id),
) -> str:
    """Verify the authenticated user is an admin.

    Checks the decoded user_id against the ADMIN_USER_IDS env var.

    Returns:
        The admin user's UUID.

    Raises:
        HTTPException 403: If the user is not in the admin list.
    """
    if user_id not in ADMIN_USER_IDS:
        logger.warning("Non-admin user %s attempted admin action", user_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return user_id


# ---------------------------------------------------------------------------
# Dependency 3: Internal API key OR JWT (for bot/pipeline endpoints)
# ---------------------------------------------------------------------------


async def get_internal_or_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_internal_key: Optional[str] = Header(None, alias="X-Internal-Key"),
) -> str:
    """Accept either a valid JWT Bearer token or an internal API key.

    Used by endpoints called by both human users (JWT) and automated
    systems like the bounty bot or GitHub Actions pipeline (API key).

    Returns:
        The user_id from JWT, or INTERNAL_SYSTEM_USER_ID for API key auth.

    Raises:
        HTTPException 401: If neither valid JWT nor valid API key is provided.
    """
    # Check internal API key first (machine-to-machine)
    if x_internal_key:
        if INTERNAL_API_KEY and x_internal_key == INTERNAL_API_KEY:
            return INTERNAL_SYSTEM_USER_ID
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )

    # Fall back to JWT auth
    if credentials:
        return _decode_jwt(credentials.credentials)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication credentials. "
        "Provide a Bearer JWT token or X-Internal-Key header.",
        headers={"WWW-Authenticate": "Bearer"},
    )


# ---------------------------------------------------------------------------
# Helper class (unchanged -- used by notifications, etc.)
# ---------------------------------------------------------------------------


class AuthenticatedUser:
    """Helper class for authenticated user context."""

    def __init__(self, user_id: str):
        """Initialize the instance."""
        self.user_id = user_id
        self._id = user_id  # Alias for convenience

    def __str__(self) -> str:
        """Str."""
        return self.user_id

    def owns_resource(self, resource_user_id: str) -> bool:
        """Check if this user owns a resource."""
        return self.user_id == resource_user_id


async def get_authenticated_user(
    user_id: str = Depends(get_current_user_id),
) -> AuthenticatedUser:
    """Get the authenticated user as an object.

    Provides a convenient way to access user context in route handlers.
    """
    return AuthenticatedUser(user_id)
