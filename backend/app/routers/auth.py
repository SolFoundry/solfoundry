"""GitHub OAuth authentication routes."""
import secrets
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Response, Request, Depends
from pydantic import BaseModel
from jose import jwt, JWTError

from app.config import settings
from app.database import get_db
from app.models import User
from app.auth_utils import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    verify_state,
)

router = APIRouter()

# In-memory state store (use Redis in production)
_state_store: dict[str, float] = {}


# --- Models ---

class GitHubAuthorizeResponse(BaseModel):
    authorize_url: str


class GitHubCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthCallbackResponse(TokenResponse):
    user: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    id: int
    github_id: int
    username: str
    avatar_url: Optional[str] = None
    wallet_address: Optional[str] = None
    reputation: int = 0


# --- Routes ---

@router.get("/github/authorize", response_model=GitHubAuthorizeResponse)
async def github_authorize():
    """Generate GitHub OAuth authorization URL with CSRF state."""
    state = secrets.token_urlsafe(32)
    _state_store[state] = datetime.now(timezone.utc).timestamp()

    # Clean up old states (> 10 minutes)
    now = datetime.now(timezone.utc).timestamp()
    expired = [k for k, v in _state_store.items() if now - v > 600]
    for k in expired:
        del _state_store[k]

    authorize_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.GITHUB_CLIENT_ID}"
        f"&redirect_uri={settings.GITHUB_REDIRECT_URI}"
        f"&scope=read:user,user:email"
        f"&state={state}"
    )

    return GitHubAuthorizeResponse(authorize_url=authorize_url)


@router.post("/github", response_model=AuthCallbackResponse)
async def github_callback(request: Request, body: GitHubCallbackRequest):
    """Exchange GitHub OAuth code for tokens + create/login user."""

    # Verify state to prevent CSRF
    if body.state and body.state not in _state_store:
        raise HTTPException(status_code=400, detail="Invalid or expired state parameter")
    if body.state:
        del _state_store[body.state]

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": body.code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )

    if token_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to exchange code with GitHub")

    token_data = token_resp.json()
    if "error" in token_data:
        raise HTTPException(
            status_code=400,
            detail=f"GitHub OAuth error: {token_data.get('error_description', token_data['error'])}"
        )

    github_access_token = token_data["access_token"]

    # Fetch GitHub user profile
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            f"{settings.GITHUB_API_URL}/user",
            headers={
                "Authorization": f"Bearer {github_access_token}",
                "Accept": "application/json",
            },
        )

    if user_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch GitHub user profile")

    gh_user = user_resp.json()

    # Fetch email if not public
    email = gh_user.get("email")
    if not email:
        async with httpx.AsyncClient() as client:
            email_resp = await client.get(
                f"{settings.GITHUB_API_URL}/user/emails",
                headers={
                    "Authorization": f"Bearer {github_access_token}",
                    "Accept": "application/json",
                },
            )
            if email_resp.status_code == 200:
                emails = email_resp.json()
                primary = next((e for e in emails if e.get("primary")), None)
                if primary:
                    email = primary.get("email")

    # Create or update user in database
    db = request.app.state.db  # simplified; use Depends(get_db) in production

    # For now, create a simple user dict (replace with actual DB operations)
    user_data = {
        "id": gh_user["id"],
        "github_id": gh_user["id"],
        "username": gh_user["login"],
        "avatar_url": gh_user.get("avatar_url"),
        "email": email,
    }

    # Generate JWT tokens
    access_token = create_access_token(
        data={"sub": str(gh_user["id"]), "username": gh_user["login"]}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(gh_user["id"])}
    )

    return AuthCallbackResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": gh_user["id"],
            "github_id": gh_user["id"],
            "username": gh_user["login"],
            "avatar_url": gh_user.get("avatar_url"),
            "reputation": 0,
        }
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest):
    """Refresh an expired access token."""
    try:
        payload = jwt.decode(
            body.refresh_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        new_access = create_access_token(data={"sub": user_id})
        new_refresh = create_refresh_token(data={"sub": user_id})

        return TokenResponse(
            access_token=new_access,
            refresh_token=new_refresh,
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")


@router.get("/me", response_model=MeResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return MeResponse(**current_user)
