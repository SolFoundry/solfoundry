"""Authentication service — JWT issuance, GitHub OAuth, in-memory user store."""

import os
import time
import uuid
import secrets
import logging
from datetime import datetime, timezone
from typing import Optional

import jwt
import httpx

from models.user import User

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRY_SECONDS = int(os.getenv("JWT_ACCESS_EXPIRY", "3600"))       # 1 h
REFRESH_TOKEN_EXPIRY_SECONDS = int(os.getenv("JWT_REFRESH_EXPIRY", "604800"))   # 7 d

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
# Where GitHub redirects back to (frontend route)
GITHUB_OAUTH_REDIRECT_URI = os.getenv(
    "GITHUB_OAUTH_REDIRECT_URI",
    "http://localhost:5173/auth/github/callback",
)

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_USER = "https://api.github.com/user"

# ── In-memory user store (swap for DB later) ─────────────────────────────────

_users_by_id: dict[str, User] = {}
_users_by_github_id: dict[int, User] = {}

# OAuth state → creation timestamp  (for CSRF protection)
_oauth_states: dict[str, float] = {}
STATE_TTL_SECONDS = 600  # 10 min

# ── Public helpers ───────────────────────────────────────────────────────────


def generate_authorize_url() -> str:
    """Build GitHub authorize URL with a random ``state`` parameter."""
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = time.time()

    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_OAUTH_REDIRECT_URI,
        "scope": "read:user user:email",
        "state": state,
    }
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{GITHUB_AUTHORIZE_URL}?{qs}"


def validate_state(state: Optional[str]) -> None:
    """Raise ValueError if state is missing, unknown, or expired."""
    if not state:
        raise ValueError("Missing state parameter")
    created = _oauth_states.pop(state, None)
    if created is None:
        raise ValueError("Invalid or reused state parameter")
    if time.time() - created > STATE_TTL_SECONDS:
        raise ValueError("OAuth state expired — please try again")


async def exchange_code_and_upsert_user(code: str, state: Optional[str]) -> dict:
    """
    Full OAuth code-exchange flow:
    1. Validate state (CSRF).
    2. Exchange code for GitHub access token.
    3. Fetch GitHub user profile (+ primary email).
    4. Create or update local User.
    5. Issue JWT access + refresh tokens.
    """
    # 1. State validation
    validate_state(state)

    # 2. Exchange code → GitHub access token
    github_token = await _exchange_code_for_token(code)

    # 3. Fetch profile + email
    profile, email = await _fetch_github_profile(github_token)

    github_id = profile["id"]
    username = profile.get("login", "")
    avatar_url = profile.get("avatar_url", "")
    name = profile.get("name") or username

    # 4. Upsert user
    user = _users_by_github_id.get(github_id)
    if user:
        user.username = username
        user.email = email
        user.avatar_url = avatar_url
    else:
        user = User(
            id=str(uuid.uuid4()),
            github_id=github_id,
            username=username,
            email=email,
            avatar_url=avatar_url,
            wallet_verified=False,
            created_at=datetime.now(timezone.utc),
        )
        _users_by_id[user.id] = user
        _users_by_github_id[github_id] = user

    # 5. Issue JWTs
    access_token = _create_jwt(user.id, "access", ACCESS_TOKEN_EXPIRY_SECONDS)
    refresh_token = _create_jwt(user.id, "refresh", REFRESH_TOKEN_EXPIRY_SECONDS)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user,
    }


def refresh_access_token(refresh_token: str) -> dict:
    """Validate a refresh token and return a new access/refresh pair."""
    payload = _decode_jwt(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise ValueError("Invalid refresh token")

    user_id: Optional[str] = payload.get("sub")
    user = _users_by_id.get(user_id) if user_id else None
    if not user:
        raise ValueError("User not found")

    new_access = _create_jwt(user.id, "access", ACCESS_TOKEN_EXPIRY_SECONDS)
    new_refresh = _create_jwt(user.id, "refresh", REFRESH_TOKEN_EXPIRY_SECONDS)
    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


def get_user_by_access_token(token: str) -> Optional[User]:
    """Return the User for a valid access JWT, or None."""
    payload = _decode_jwt(token)
    if not payload or payload.get("type") != "access":
        return None
    user_id: Optional[str] = payload.get("sub")
    return _users_by_id.get(user_id) if user_id else None


# ── Internal helpers ─────────────────────────────────────────────────────────


def _create_jwt(subject: str, token_type: str, expires_in: int) -> str:
    now = time.time()
    payload = {
        "sub": subject,
        "type": token_type,
        "iat": int(now),
        "exp": int(now) + expires_in,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def _decode_jwt(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


async def _exchange_code_for_token(code: str) -> str:
    """Call GitHub token endpoint to exchange an OAuth code for an access token."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            GITHUB_TOKEN_URL,
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_OAUTH_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
    if resp.status_code != 200:
        logger.error("GitHub token exchange failed: %s %s", resp.status_code, resp.text)
        raise ValueError(f"GitHub token exchange failed (HTTP {resp.status_code})")

    data = resp.json()
    if "error" in data:
        logger.error("GitHub token error: %s", data)
        raise ValueError(data.get("error_description", data["error"]))

    token = data.get("access_token")
    if not token:
        raise ValueError("No access_token in GitHub response")
    return token


async def _fetch_github_profile(token: str) -> tuple[dict, Optional[str]]:
    """Fetch the GitHub user profile and primary email."""
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    async with httpx.AsyncClient(timeout=15) as client:
        profile_resp = await client.get(GITHUB_API_USER, headers=headers)
        if profile_resp.status_code != 200:
            raise ValueError(f"Failed to fetch GitHub profile (HTTP {profile_resp.status_code})")
        profile = profile_resp.json()

        email: Optional[str] = profile.get("email")

        # If the primary email is private, fetch from /user/emails
        if not email:
            try:
                emails_resp = await client.get(
                    "https://api.github.com/user/emails", headers=headers
                )
                if emails_resp.status_code == 200:
                    for e in emails_resp.json():
                        if e.get("primary"):
                            email = e.get("email")
                            break
            except Exception:
                pass  # non-critical

    return profile, email
