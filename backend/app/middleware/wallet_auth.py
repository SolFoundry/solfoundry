"""Wallet authentication middleware and FastAPI dependencies.

Provides the ``require_wallet_auth`` dependency for protecting endpoints
that require SIWS (Sign-In With Solana) wallet authentication. This is
a drop-in decorator/dependency for FastAPI route handlers.

Usage in route handlers::

    from app.middleware.wallet_auth import require_wallet_auth

    @router.get("/protected")
    async def protected_route(
        wallet_claims: dict = Depends(require_wallet_auth),
    ):
        user_id = wallet_claims["sub"]
        wallet = wallet_claims["wallet"]
        ...

The dependency extracts the Bearer token from the Authorization header,
decodes the JWT, validates it against the PostgreSQL session store, and
returns the full token claims including user ID and wallet address.

If the token is missing, expired, revoked, or invalid, an HTTP 401
response is returned with a descriptive error message.

References:
    - FastAPI Dependencies: https://fastapi.tiangolo.com/tutorial/dependencies/
    - OWASP Session Management Cheat Sheet
"""

import logging
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.siws_service import (
    SIWSError,
    SessionExpiredError,
    SessionRevokedError,
    validate_session_token,
)

logger = logging.getLogger(__name__)

# Security scheme for OpenAPI documentation
_bearer_scheme = HTTPBearer(auto_error=False)


async def require_wallet_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """FastAPI dependency that enforces SIWS wallet authentication.

    Extracts the JWT Bearer token from the Authorization header, validates
    it against the SIWS service (which checks both the JWT signature and
    the PostgreSQL session store), and returns the decoded token claims.

    The returned claims dictionary includes:
    - ``sub``: The authenticated user's UUID.
    - ``wallet``: The authenticated Solana wallet address.
    - ``type``: Token type (always 'access').
    - ``auth_method``: Authentication method (always 'siws').
    - ``jti``: Unique JWT ID for this token.
    - ``iat``: Token issued-at timestamp.
    - ``exp``: Token expiration timestamp.

    Args:
        request: The incoming FastAPI request object.
        credentials: Optional Bearer token from the Authorization header.
        db: Async SQLAlchemy database session.

    Returns:
        Dictionary containing the decoded and validated JWT claims.

    Raises:
        HTTPException: 401 Unauthorized if the token is missing, invalid,
            expired, or the session has been revoked.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing wallet authentication token. "
                   "Sign in with your Solana wallet to access this resource.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        claims = await validate_session_token(db, token)
    except SIWSError as exc:
        logger.warning(
            "Wallet auth validation failed: %s (IP: %s)",
            str(exc),
            request.client.host if request.client else "unknown",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )

    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired wallet session. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify this is a SIWS token (not a GitHub OAuth token)
    if claims.get("auth_method") != "siws":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This endpoint requires wallet-based authentication (SIWS). "
                   "GitHub OAuth tokens are not accepted.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return claims
