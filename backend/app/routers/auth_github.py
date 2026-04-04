"""GitHub OAuth + JWT auth endpoints."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.config import Settings, get_settings
from app.schemas.auth import (
    AuthorizeUrlResponse,
    GitHubCallbackResponse,
    GitHubExchangeRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.services import github_oauth
from app.services.tokens import (
    claims_to_user_response,
    create_access_token,
    create_refresh_token,
    decode_token,
    stable_user_id,
)

router = APIRouter(tags=["auth"])


def _state_signer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.secret_key, salt="sf-github-oauth-state")


def _oauth_not_configured() -> None:
    raise HTTPException(
        status_code=503,
        detail="GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
    )


@router.get("/github/authorize")
async def github_authorize(
    request: Request,
    format: str | None = None,
    settings: Settings = Depends(get_settings),
):
    """
    Start GitHub OAuth.

    - Without ``format=json``: HTTP 302 redirect to GitHub (browser / ``<a href>``).
    - With ``format=json``: JSON ``{ authorize_url }`` for SPA fetch (avoids fetch following redirects).
    """
    if not settings.oauth_configured:
        _oauth_not_configured()

    signer = _state_signer(settings)
    state = signer.dumps({"v": 1})
    url = github_oauth.build_authorize_url(settings, state)

    wants_json = format == "json" or (
        "application/json" in request.headers.get("accept", "")
        and "text/html" not in request.headers.get("accept", "")
    )
    if wants_json:
        return AuthorizeUrlResponse(authorize_url=url)

    return RedirectResponse(url=url, status_code=302)


@router.post("/github")
async def github_exchange(
    body: GitHubExchangeRequest,
    settings: Settings = Depends(get_settings),
) -> GitHubCallbackResponse:
    if not settings.oauth_configured:
        _oauth_not_configured()

    if not body.state:
        raise HTTPException(status_code=400, detail="Missing OAuth state parameter")

    signer = _state_signer(settings)
    try:
        signer.loads(body.state, max_age=settings.oauth_state_max_age_seconds)
    except SignatureExpired:
        raise HTTPException(
            status_code=400,
            detail="OAuth state expired. Please sign in again.",
        )
    except BadSignature:
        raise HTTPException(
            status_code=400,
            detail="Invalid OAuth state. Please sign in again.",
        )

    try:
        token_payload = await github_oauth.exchange_code_for_token(settings, body.code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    access = token_payload.get("access_token")
    if not access:
        raise HTTPException(status_code=502, detail="GitHub did not return an access token")

    try:
        gh_user = await github_oauth.fetch_github_profile(access)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    gh_id = gh_user.get("id")
    if gh_id is None:
        raise HTTPException(status_code=502, detail="GitHub profile response missing id")

    login = gh_user.get("login") or "github-user"
    user_id = stable_user_id(int(gh_id))
    created_at = datetime.now(tz=UTC).isoformat()

    claims = {
        "sub": user_id,
        "username": login,
        "github_id": str(gh_id),
        "avatar_url": gh_user.get("avatar_url"),
        "email": gh_user.get("resolved_email"),
        "created_at": created_at,
    }

    access_token = create_access_token(settings, claims)
    refresh_token = create_refresh_token(settings, claims)

    user = UserResponse(
        id=user_id,
        username=login,
        email=claims["email"],
        avatar_url=claims["avatar_url"],
        github_id=claims["github_id"],
        created_at=created_at,
    )

    return GitHubCallbackResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=user,
    )


@router.post("/refresh")
async def refresh_tokens(
    body: RefreshRequest,
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    try:
        payload = decode_token(settings, body.refresh_token, "refresh")
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e

    claims = {k: v for k, v in payload.items() if k not in ("exp", "iat", "typ")}
    access_token = create_access_token(settings, claims)
    refresh_token = create_refresh_token(settings, claims)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.get("/me")
async def auth_me(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> UserResponse:
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = decode_token(settings, token, "access")
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    return UserResponse(**claims_to_user_response(payload))
