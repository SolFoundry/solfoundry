"""Authentication API endpoints.

This module provides REST API endpoints for:
- GitHub OAuth flow
- Solana wallet authentication
- Wallet linking
- Token refresh
- Current user info
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Header
from app.models.errors import ErrorResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db

from app.models.user import (
    GitHubOAuthRequest,
    GitHubOAuthResponse,
    WalletAuthRequest,
    WalletAuthResponse,
    LinkWalletRequest,
    LinkWalletResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    UserResponse,
    AuthMessageResponse,
)
from pydantic import BaseModel as _BaseModel
from app.services import auth_service, siws_service
from app.services.auth_service import (
    AuthError,
    GitHubOAuthError,
    WalletVerificationError,
    TokenExpiredError,
    InvalidTokenError,
)
from app.services.siws_service import SiwsRateLimitError, SiwsNonceError

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(None),
) -> str:
    """
    Extract and validate the current user ID from JWT token.

    This dependency is used to protect routes that require authentication.
    """
    token = None

    if credentials:
        token = credentials.credentials
    elif authorization:
        if authorization.startswith("Bearer "):
            token = authorization[7:]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = auth_service.decode_token(token, token_type="access")
        return user_id
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get(
    "/github/authorize",
    response_model=dict,
    summary="Get GitHub Auth URL",
    description="Generates the GitHub OAuth authorization URL and a temporary state for CSRF protection.",
)
async def get_github_authorize(state: Optional[str] = None):
    """
    Get GitHub OAuth authorization URL.

    Redirect the user to this URL to start the GitHub OAuth flow.
    After authorization, GitHub will redirect back with a code.
    """
    try:
        url, new_state = auth_service.get_github_authorize_url(state)
        return {
            "authorize_url": url,
            "state": new_state,
            "instructions": "Redirect user to authorize_url, then handle callback at /auth/github",
        }
    except GitHubOAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post(
    "/github",
    response_model=GitHubOAuthResponse,
    summary="GitHub OAuth Callback",
    description="Exchanges a GitHub authorization code for SolFoundry JWT tokens.",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid or expired code"},
        500: {"model": ErrorResponse, "description": "GitHub API error"},
    },
)
async def github_oauth_callback(
    data: GitHubOAuthRequest, db: AsyncSession = Depends(get_db)
) -> GitHubOAuthResponse:
    """
    Complete GitHub OAuth flow.

    Exchange the authorization code for JWT tokens.

    Flow:
    1. User is redirected from GitHub with a code
    2. Exchange code for GitHub access token
    3. Get user info from GitHub
    4. Create/update user in database
    5. Return JWT tokens
    """
    try:
        result = await auth_service.github_oauth_login(db, data.code, data.state)
        return result
    except GitHubOAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get(
    "/wallet/message",
    response_model=AuthMessageResponse,
    summary="Get Wallet Auth Message",
    description="Generates a unique message for a Solana wallet to sign. Prevents replay attacks.",
)
async def get_wallet_auth_message(wallet_address: str):
    """
    Get a message for wallet authentication.

    The user must sign this message with their wallet to prove ownership.
    Then submit the signature to /auth/wallet.
    """
    return auth_service.generate_auth_message(wallet_address)


@router.post(
    "/wallet",
    response_model=WalletAuthResponse,
    summary="Wallet Authenticate",
    description="Verifies a Solana wallet signature and returns JWT tokens.",
    responses={
        400: {"model": ErrorResponse, "description": "Signature verification failed"},
    },
)
async def wallet_authenticate(
    request: WalletAuthRequest, db: AsyncSession = Depends(get_db)
):
    """
    Authenticate with Solana wallet signature.

    Flow:
    1. Get a message from /auth/wallet/message
    2. Sign the message with your wallet
    3. Submit the signature, message, and wallet address

    The signature proves you own the wallet address.
    """
    try:
        result = await auth_service.wallet_authenticate(
            db,
            request.wallet_address,
            request.signature,
            request.message,
        )
        return result
    except WalletVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/link-wallet", response_model=LinkWalletResponse)
async def link_wallet(
    request: LinkWalletRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """
    Link a Solana wallet to the current user account.

    The user must sign a message to prove wallet ownership.
    Each user can only have one wallet linked (one-to-one mapping).

    Requires authentication (GitHub OAuth or existing wallet auth).
    """
    try:
        result = await auth_service.link_wallet_to_user(
            db,
            user_id,
            request.wallet_address,
            request.signature,
            request.message,
        )
        return result
    except WalletVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_token(
    request: RefreshTokenRequest, db: AsyncSession = Depends(get_db)
) -> RefreshTokenResponse:
    """
    Refresh an access token.

    Use the refresh token received during login to get a new access token.
    Refresh tokens are valid for 7 days.
    """
    try:
        result = await auth_service.refresh_access_token(db, request.refresh_token)
        return result
    except (InvalidTokenError, TokenExpiredError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    db: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user_id)
) -> UserResponse:
    """Dependency to get the full current user object."""
    try:
        return await auth_service.get_current_user(db, user_id)
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# ---------------------------------------------------------------------------
# Sign-In With Solana (SIWS) endpoints
# ---------------------------------------------------------------------------


class SiwsMessageResponse(_BaseModel):
    message: str
    nonce: str
    issued_at: str
    expires_at: str


class SiwsLoginRequest(_BaseModel):
    wallet_address: str
    signature: str
    message: str


class SiwsRefreshRequest(_BaseModel):
    refresh_token: str


class SiwsRefreshResponse(_BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


@router.get(
    "/siws/message",
    response_model=SiwsMessageResponse,
    summary="Get SIWS challenge message",
    description=(
        "Generate a nonce-bound Sign-In With Solana message. "
        "The client must sign this with their wallet and POST to /auth/siws."
    ),
)
async def get_siws_message(wallet_address: str) -> SiwsMessageResponse:
    """Return a SIWS-formatted challenge message with a DB-persisted nonce."""
    result = await siws_service.get_siws_message(wallet_address)
    return SiwsMessageResponse(**result)


@router.post(
    "/siws",
    summary="Sign-In With Solana",
    description=(
        "Verify a signed SIWS message and return JWT access + refresh tokens. "
        "Rate limited to 5 attempts per wallet per minute."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid signature or nonce"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
)
async def siws_login(
    request: SiwsLoginRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    """Complete SIWS authentication flow."""
    try:
        return await siws_service.siws_login(
            db, request.wallet_address, request.signature, request.message
        )
    except SiwsRateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
            headers={"Retry-After": "60"},
        )
    except (SiwsNonceError, WalletVerificationError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


@router.post(
    "/siws/refresh",
    response_model=SiwsRefreshResponse,
    summary="Refresh SIWS session",
    description=(
        "Exchange a valid, non-revoked SIWS refresh token for a new access + refresh "
        "token pair. The old refresh token is revoked immediately."
    ),
)
async def siws_refresh(
    request: SiwsRefreshRequest, db: AsyncSession = Depends(get_db)
) -> SiwsRefreshResponse:
    """Refresh a SIWS session without re-signing."""
    try:
        result = await siws_service.siws_refresh(db, request.refresh_token)
        return SiwsRefreshResponse(**result)
    except (InvalidTokenError, TokenExpiredError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/siws/logout", summary="Revoke SIWS session")
async def siws_logout(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """Revoke the current access token session."""
    if credentials:
        await siws_service.revoke_session(credentials.credentials)
    return {"ok": True}


# ---------------------------------------------------------------------------
# require_wallet_auth — dependency for endpoints that need verified wallet
# ---------------------------------------------------------------------------


async def require_wallet_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(None),
) -> str:
    """
    Stricter auth dependency: validates JWT **and** checks the DB session
    is still alive (not revoked, not expired).

    Use this on endpoints that handle financial operations or sensitive
    wallet-specific actions. Regular `get_current_user_id` skips the DB
    session check and is fine for read-only endpoints.
    """
    token = None
    if credentials:
        token = credentials.credentials
    elif authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Validate JWT signature + expiry
    try:
        user_id = auth_service.decode_token(token, token_type="access")
    except TokenExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2. Validate DB session is still alive
    if not await siws_service.is_session_valid(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id


# Export the dependency for use in other modules
__all__ = [
    "router",
    "get_current_user_id",
    "get_current_user",
    "require_wallet_auth",
]
