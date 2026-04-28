"""GitHub OAuth authentication routes."""

import logging
from fastapi import APIRouter, HTTPException, Request
from typing import Optional

from models.user import GitHubTokenRequest, GitHubCallbackResponse, AuthorizeResponse, AuthTokens, User
from services import auth as auth_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/github/authorize", response_model=AuthorizeResponse)
async def github_authorize():
    """Return a GitHub OAuth authorize URL with a random state parameter."""
    url = auth_service.generate_authorize_url()
    return AuthorizeResponse(authorize_url=url)


@router.post("/github", response_model=GitHubCallbackResponse)
async def github_callback(body: GitHubTokenRequest):
    """
    Exchange a GitHub OAuth code for JWT tokens + user profile.

    Steps:
    1. Validate state (CSRF protection).
    2. Exchange code for GitHub access token.
    3. Fetch GitHub profile and upsert local user.
    4. Issue JWT access + refresh tokens.
    """
    try:
        result = await auth_service.exchange_code_and_upsert_user(body.code, body.state)
    except ValueError as exc:
        # Map known error cases to appropriate HTTP status codes
        msg = str(exc)
        if "state" in msg.lower():
            raise HTTPException(status_code=400, detail=msg)
        if "expired" in msg.lower():
            raise HTTPException(status_code=400, detail=msg)
        if "token exchange" in msg.lower():
            raise HTTPException(status_code=502, detail=msg)
        if "rate limit" in msg.lower():
            raise HTTPException(status_code=429, detail="GitHub API rate limit hit — please try again later")
        raise HTTPException(status_code=400, detail=msg)
    except Exception as exc:
        logger.exception("Unexpected error during GitHub OAuth")
        raise HTTPException(status_code=500, detail="Authentication failed — please try again")

    return GitHubCallbackResponse(
        access_token=result["access_token"],
        refresh_token=result["refresh_token"],
        token_type=result["token_type"],
        user=result["user"],
    )


@router.get("/me", response_model=User)
async def get_current_user(request: Request):
    """Return the authenticated user profile based on the JWT Bearer token."""
    user = _extract_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


@router.post("/refresh", response_model=AuthTokens)
async def refresh_token(body: dict):
    """Exchange a valid refresh token for a new access/refresh pair."""
    refresh = body.get("refresh_token")
    if not refresh:
        raise HTTPException(status_code=400, detail="Missing refresh_token")
    try:
        result = auth_service.refresh_access_token(refresh)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    return AuthTokens(**result)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _extract_user(request: Request) -> Optional[User]:
    """Extract Bearer token from the Authorization header and resolve the user."""
    auth_header: Optional[str] = request.headers.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return None
    token = auth_header[7:].strip()
    return auth_service.get_user_by_access_token(token)
