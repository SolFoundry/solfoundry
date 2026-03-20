"""FastAPI dependency for JWT-authenticated routes.

Provides ``get_current_user`` which extracts and validates the Bearer
token from the Authorization header, decodes the JWT, and returns the
corresponding User object.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.models.auth import User
from app.services import auth_service

_bearer = HTTPBearer(auto_error=False)

async def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> User:
    """Extract, validate, and resolve the current user from the JWT."""
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")
    uid = auth_service.decode_access_token(creds.credentials)
    if uid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = auth_service.get_user(uid)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
