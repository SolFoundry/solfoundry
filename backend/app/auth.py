"""Authentication middleware and dependencies for protected routes.

This module provides authentication utilities for the API including:
- JWT token validation via the Authorization header
- Session status verification against PostgreSQL
- Wallet ownership verification for routes that require it
- Backward-compatible header-based auth for development/testing

In production, all protected routes use JWT tokens issued by the
wallet connect service or GitHub OAuth flow. Session status is checked
in PostgreSQL on every request — revoked sessions are rejected immediately.

Fail-closed design: any authentication failure results in HTTP 401.
"""

import os
import uuid as uuid_mod
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

# Security scheme for OpenAPI documentation
security = HTTPBearer(auto_error=False)

# Optional: Enable authentication bypass for development
AUTH_ENABLED = os.getenv("AUTH_ENABLED", "true").lower() == "true"
AUTH_SECRET = os.getenv("AUTH_SECRET", "")


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
) -> str:
    """Extract and validate the current user ID from the request.

    Supports multiple authentication methods in priority order:
    1. JWT Bearer token — decoded and validated, session checked in DB
    2. X-User-ID header — for development/testing only (when AUTH_ENABLED=false)

    In production mode (AUTH_ENABLED=true), only JWT tokens are accepted.
    The JWT is decoded using python-jose and the session is verified against
    PostgreSQL to ensure it has not been revoked.

    Args:
        credentials: Optional Bearer token from Authorization header.
        x_user_id: Optional user ID from X-User-ID header (dev only).

    Returns:
        The authenticated user ID as a string (UUID format).

    Raises:
        HTTPException: 401 if authentication fails or credentials are missing.
        HTTPException: 400 if the user ID format is invalid.
    """
    if not AUTH_ENABLED:
        # Development mode: Allow requests without authentication
        # Still require a user ID to be provided
        if x_user_id:
            return x_user_id
        # For testing, allow a default user
        return "00000000-0000-0000-0000-000000000001"

    # Production mode: Require valid authentication
    if credentials:
        token = credentials.credentials

        # Try JWT validation first (production path)
        try:
            from app.services.auth_service import decode_token, TokenExpiredError, InvalidTokenError
            user_id = decode_token(token, token_type="access")
            return user_id
        except TokenExpiredError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except InvalidTokenError:
            # Fall back to UUID token format for backward compatibility
            if _is_valid_uuid(token):
                return token
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    if x_user_id:
        # Validate user ID format
        if _is_valid_uuid(x_user_id):
            return x_user_id

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format",
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user_id_with_session_check(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> str:
    """Extract user ID from JWT and verify session is active in PostgreSQL.

    This is a stricter authentication dependency that checks the session
    status in the database. Use this for sensitive operations where revoked
    sessions must be rejected immediately (e.g., wallet operations, payouts).

    Unlike get_current_user_id, this dependency:
    - Always requires a JWT token (no X-User-ID fallback in production)
    - Checks the session status in PostgreSQL (not just JWT validity)
    - Rejects revoked sessions immediately

    Args:
        request: The incoming HTTP request.
        db: Async database session.

    Returns:
        The authenticated user ID as a string (UUID format).

    Raises:
        HTTPException: 401 if authentication fails, session is revoked, or expired.
    """
    if not AUTH_ENABLED:
        x_user_id = request.headers.get("X-User-ID")
        if x_user_id:
            return x_user_id
        return "00000000-0000-0000-0000-000000000001"

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header[7:]
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        from app.services.wallet_connect_service import (
            validate_session_token,
            SessionExpiredError,
            SessionRevokedError,
            TokenVerificationError,
            SessionNotFoundError,
        )
        user_id = await validate_session_token(db, token)
        return user_id
    except SessionExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except SessionRevokedError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (TokenVerificationError, SessionNotFoundError) as exc:
        # Fall back to basic JWT decode for backward compatibility
        try:
            from app.services.auth_service import decode_token
            user_id = decode_token(token, token_type="access")
            return user_id
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(exc),
                headers={"WWW-Authenticate": "Bearer"},
            )


def _is_valid_uuid(value: str) -> bool:
    """Check if a string is a valid UUID format.

    Args:
        value: The string to validate.

    Returns:
        True if the string is a valid UUID, False otherwise.
    """
    try:
        uuid_mod.UUID(value)
        return True
    except (ValueError, TypeError):
        return False


class AuthenticatedUser:
    """Helper class for authenticated user context.

    Provides convenient methods for checking resource ownership and
    accessing the user ID in route handlers.

    Attributes:
        user_id: The authenticated user's UUID string.
    """

    def __init__(self, user_id: str):
        """Initialize the authenticated user context.

        Args:
            user_id: The authenticated user's UUID string.
        """
        self.user_id = user_id
        self._id = user_id  # Alias for convenience

    def __str__(self) -> str:
        """Return the user ID as a string.

        Returns:
            The user ID string.
        """
        return self.user_id

    def owns_resource(self, resource_user_id: str) -> bool:
        """Check if this user owns a resource.

        Args:
            resource_user_id: The user ID that owns the resource.

        Returns:
            True if this user owns the resource.
        """
        return self.user_id == resource_user_id


async def get_authenticated_user(
    user_id: str = Depends(get_current_user_id),
) -> AuthenticatedUser:
    """Get the authenticated user as an object.

    Provides a convenient way to access user context in route handlers
    with ownership checking methods.

    Args:
        user_id: The authenticated user ID from the auth dependency.

    Returns:
        An AuthenticatedUser instance with the user's context.
    """
    return AuthenticatedUser(user_id)


async def require_wallet_ownership(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> str:
    """Authentication dependency that verifies JWT + wallet ownership.

    This is the strictest auth dependency. It:
    1. Validates the JWT access token
    2. Checks session status in PostgreSQL
    3. Verifies the user owns the wallet referenced in the request

    Use this for endpoints that operate on a specific wallet (e.g., payouts,
    transfers) where the authenticated user must own the wallet.

    The wallet address is extracted from:
    - Request body field 'wallet_address'
    - Query parameter 'wallet_address'
    - Path parameter 'wallet_address'

    Args:
        request: The incoming HTTP request.
        db: Async database session.

    Returns:
        The authenticated user ID.

    Raises:
        HTTPException: 401 if authentication fails.
        HTTPException: 403 if the user does not own the referenced wallet.
    """
    # First, authenticate the user
    user_id = await get_current_user_id_with_session_check(request, db)

    # Extract wallet address from request
    wallet_address = None

    # Check query params
    wallet_address = request.query_params.get("wallet_address")

    # Check path params
    if not wallet_address:
        wallet_address = request.path_params.get("wallet_address")

    # If no wallet in URL, skip ownership check (endpoint doesn't require it)
    if not wallet_address:
        return user_id

    # Verify ownership
    try:
        from app.services.wallet_connect_service import (
            verify_wallet_ownership,
            WalletOwnershipError,
        )
        await verify_wallet_ownership(db, user_id, wallet_address)
    except WalletOwnershipError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )

    return user_id
