"""Authentication middleware and dependencies.

This module provides authentication utilities for the API.
Currently uses a simple header-based authentication that can be
replaced with JWT or OAuth2 in production.
"""

import os
from typing import Optional
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.constants import INTERNAL_SYSTEM_USER_ID

# Security scheme for OpenAPI documentation
security = HTTPBearer(auto_error=False)

# Optional: Enable authentication bypass for development
AUTH_ENABLED = os.getenv("AUTH_ENABLED", "true").lower() == "true"
AUTH_SECRET = os.getenv("AUTH_SECRET", "")


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
) -> str:
    """
    Extract and validate the current user ID from the request.

    Supports two authentication methods:
    1. Bearer token (for production use)
    2. X-User-ID header (for development/testing)

    In production, this should be replaced with proper JWT validation.

    Args:
        credentials: Optional Bearer token from Authorization header
        x_user_id: Optional user ID from X-User-ID header

    Returns:
        str: The authenticated user ID

    Raises:
        HTTPException: If authentication fails or user ID is missing
    """
    if not AUTH_ENABLED:
        # Development mode: Allow requests without authentication
        # Still require a user ID to be provided
        if x_user_id:
            return x_user_id
        # For testing, allow a default user
        return INTERNAL_SYSTEM_USER_ID

    # Production mode: Require valid authentication
    if credentials:
        # TODO: Implement JWT token validation
        # For now, treat the token as the user ID (development only)
        # In production, decode JWT and extract user_id from claims
        token = credentials.credentials

        # Validate token format (UUID)
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


def _is_valid_uuid(value: str) -> bool:
    """Check if a string is a valid UUID format."""
    import uuid

    try:
        uuid.UUID(value)
        return True
    except (ValueError, TypeError):
        return False


class AuthenticatedUser:
    """Helper class for authenticated user context."""

    def __init__(self, user_id: str):
        """The __init__ function."""
        self.user_id = user_id
        self._id = user_id  # Alias for convenience

    def __str__(self) -> str:
        """The __str__ function."""
        return self.user_id

    def owns_resource(self, resource_user_id: str) -> bool:
        """Check if this user owns a resource."""
        return self.user_id == resource_user_id


async def get_authenticated_user(
    user_id: str = Depends(get_current_user_id),
) -> AuthenticatedUser:
    """
    Get the authenticated user as an object.

    Provides a convenient way to access user context in route handlers.

    Args:
        user_id: The authenticated user ID from the auth dependency

    Returns:
        AuthenticatedUser: The authenticated user context
    """
    return AuthenticatedUser(user_id)
