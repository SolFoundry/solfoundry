"""Authentication API endpoints for SolFoundry.

This module provides REST API endpoints for the complete authentication flow:
- GitHub OAuth: authorize, callback, revoke, connection status
- Solana wallet authentication: challenge message, signature verification
- Wallet linking: link a verified Solana wallet to an existing account
- Token management: refresh, introspection
- User profile: retrieve current authenticated user

All mutation endpoints require authentication via JWT Bearer token.
GitHub OAuth uses PostgreSQL-backed CSRF state parameters for security.

Routes:
    GET  /auth/github/authorize     - Start GitHub OAuth flow
    POST /auth/github               - Complete GitHub OAuth callback
    POST /auth/github/revoke        - Revoke GitHub access
    GET  /auth/github/status        - Check GitHub connection status
    GET  /auth/wallet/message       - Get wallet auth challenge
    POST /auth/wallet               - Authenticate with wallet signature
    POST /auth/link-wallet          - Link wallet to authenticated account
    POST /auth/refresh              - Refresh an access token
    GET  /auth/me                   - Get current user profile
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.errors import ErrorResponse
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
from app.services import auth_service
from app.services.auth_service import (
    AuthError,
    GitHubOAuthError,
    InvalidStateError,
    WalletVerificationError,
    TokenExpiredError,
    InvalidTokenError,
)
from app.services.github_oauth_service import (
    GitHubAccessDeniedError,
    GitHubRateLimitError,
    GitHubTokenRevokedError,
    TokenEncryptionError,
    complete_github_oauth,
    create_oauth_state,
    build_authorize_url,
    revoke_github_access,
    get_github_connection_status,
)

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(None),
) -> str:
    """Extract and validate the current user ID from a JWT Bearer token.

    Supports two header formats for flexibility with different HTTP clients:
    1. Standard HTTPBearer: ``Authorization: Bearer <token>``
    2. Raw header: ``Authorization: Bearer <token>`` parsed manually

    This dependency is injected into protected route handlers to enforce
    authentication. It decodes the JWT and returns the user ID from the
    ``sub`` claim.

    Args:
        credentials: Bearer token extracted by FastAPI's HTTPBearer scheme.
        authorization: Raw Authorization header as fallback.

    Returns:
        The authenticated user's UUID as a string.

    Raises:
        HTTPException: 401 if the token is missing, expired, or invalid.
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
            detail="Token has expired — use /auth/refresh to obtain a new one",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except InvalidTokenError as token_error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(token_error),
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# GitHub OAuth endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/github/authorize",
    response_model=dict,
    summary="Start GitHub OAuth Flow",
    description=(
        "Generates the GitHub OAuth authorization URL with a CSRF-protected "
        "state parameter stored in PostgreSQL. The frontend should redirect "
        "the user to the returned URL to begin authorization."
    ),
    responses={
        500: {"model": ErrorResponse, "description": "GitHub OAuth not configured"},
    },
)
async def get_github_authorize(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate the GitHub OAuth authorization URL with CSRF protection.

    Creates a cryptographically random state parameter, persists it in
    PostgreSQL with a 10-minute TTL, and builds the GitHub authorization
    URL. The state must be returned unchanged by GitHub on callback.

    Args:
        request: The incoming HTTP request (used to extract client IP).
        db: Async database session for state persistence.

    Returns:
        A dictionary containing:
        - authorize_url: The GitHub URL to redirect the user to
        - state: The CSRF state parameter (also embedded in the URL)
        - instructions: Human-readable next steps
    """
    try:
        client_ip = request.client.host if request.client else None
        state_token = await create_oauth_state(db, ip_address=client_ip)
        authorize_url = build_authorize_url(state_token)
        return {
            "authorize_url": authorize_url,
            "state": state_token,
            "instructions": (
                "Redirect the user to authorize_url. After authorization, "
                "GitHub will redirect back with a code and state parameter. "
                "Submit both to POST /auth/github to complete the flow."
            ),
        }
    except GitHubOAuthError as oauth_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(oauth_error),
        )


@router.post(
    "/github",
    response_model=GitHubOAuthResponse,
    summary="Complete GitHub OAuth Callback",
    description=(
        "Exchanges a GitHub authorization code for SolFoundry JWT tokens. "
        "Verifies the CSRF state parameter, exchanges the code for a GitHub "
        "access token, fetches user info, and creates or updates the user."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid code, denied auth, or expired state"},
        429: {"model": ErrorResponse, "description": "GitHub API rate limit exceeded"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
    },
)
async def github_oauth_callback(
    data: GitHubOAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> GitHubOAuthResponse:
    """Complete the GitHub OAuth flow and return JWT tokens.

    Processes the callback from GitHub after the user authorizes the app.
    The full flow is:
    1. Verify the CSRF state parameter against the database
    2. Exchange the authorization code for a GitHub access token
    3. Fetch the user's GitHub profile (ID, username, avatar)
    4. Create a new user or update an existing one in the database
    5. Encrypt and store the GitHub access token for future API calls
    6. Return SolFoundry JWT access and refresh tokens

    Handles re-authorization gracefully: if the user already has an account
    linked to this GitHub identity, their profile is updated and a new
    session is created.

    Args:
        data: The OAuth callback payload containing the code and state.
        db: Async database session.

    Returns:
        GitHubOAuthResponse with JWT tokens and user profile.

    Raises:
        HTTPException: 400 for invalid/expired codes, denied auth, bad state.
        HTTPException: 429 for GitHub API rate limiting.
        HTTPException: 500 for unexpected errors.
    """
    try:
        result = await complete_github_oauth(db, data.code, data.state)
        return result
    except GitHubAccessDeniedError as denied_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(denied_error),
        )
    except InvalidStateError as state_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(state_error),
        )
    except GitHubRateLimitError as rate_error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(rate_error),
            headers={"Retry-After": str(rate_error.retry_after)},
        )
    except GitHubOAuthError as oauth_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(oauth_error),
        )
    except TokenEncryptionError as encryption_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token storage error: {encryption_error}",
        )
    except AuthError as auth_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(auth_error),
        )


@router.post(
    "/github/revoke",
    summary="Revoke GitHub Access",
    description=(
        "Revokes the user's GitHub OAuth access token and removes the stored "
        "connection. Attempts to revoke the token on GitHub's side as well."
    ),
    responses={
        200: {"description": "GitHub access revoked successfully"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "No active GitHub connection"},
    },
)
async def revoke_github(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Revoke the authenticated user's GitHub OAuth access.

    Performs a two-phase revocation:
    1. Attempts to revoke the token on GitHub's API (best-effort)
    2. Marks the token as revoked in the local database

    The local revocation always succeeds even if the GitHub API call
    fails (e.g., if the user already revoked access through GitHub
    settings).

    Args:
        db: Async database session.
        user_id: The authenticated user's UUID from the JWT token.

    Returns:
        A dictionary with revocation status details.

    Raises:
        HTTPException: 404 if no active GitHub connection exists.
    """
    try:
        result = await revoke_github_access(db, user_id)
        return result
    except AuthError as auth_error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(auth_error),
        )


@router.get(
    "/github/status",
    summary="GitHub Connection Status",
    description="Check whether the authenticated user has an active GitHub connection.",
    responses={
        200: {"description": "Connection status returned"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    },
)
async def github_connection_status(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Check the GitHub connection status for the authenticated user.

    Returns whether the user has a linked and active GitHub OAuth token,
    along with the associated GitHub username and connection timestamp.

    Args:
        db: Async database session.
        user_id: The authenticated user's UUID from the JWT token.

    Returns:
        A dictionary with connection status and details.
    """
    return await get_github_connection_status(db, user_id)


# ---------------------------------------------------------------------------
# Wallet authentication endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/wallet/message",
    response_model=AuthMessageResponse,
    summary="Get Wallet Auth Message",
    description=(
        "Generates a unique challenge message for a Solana wallet to sign. "
        "The nonce prevents replay attacks and expires after 5 minutes."
    ),
)
async def get_wallet_auth_message(wallet_address: str) -> AuthMessageResponse:
    """Generate a challenge message for Solana wallet authentication.

    Creates a time-limited challenge with a random nonce that the user
    must sign with their wallet private key to prove ownership. The
    nonce is stored server-side and validated on submission.

    Args:
        wallet_address: The Solana wallet address requesting authentication.

    Returns:
        AuthMessageResponse with the message to sign, nonce, and expiry.
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
    request: WalletAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> WalletAuthResponse:
    """Authenticate a user via Solana wallet signature verification.

    Verifies that the submitted signature was produced by the private key
    corresponding to the given wallet address. On success, creates or
    retrieves the user and returns JWT tokens.

    Flow:
    1. Retrieve challenge from /auth/wallet/message
    2. Sign the message with the Solana wallet
    3. Submit the signed message, signature, and wallet address here

    Args:
        request: The wallet auth payload with address, signature, and message.
        db: Async database session.

    Returns:
        WalletAuthResponse with JWT tokens and user profile.

    Raises:
        HTTPException: 400 if signature verification fails.
    """
    try:
        result = await auth_service.wallet_authenticate(
            db,
            request.wallet_address,
            request.signature,
            request.message,
        )
        return result
    except WalletVerificationError as verification_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(verification_error),
        )
    except AuthError as auth_error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(auth_error),
        )


@router.post(
    "/link-wallet",
    response_model=LinkWalletResponse,
    summary="Link Wallet to Account",
    description=(
        "Links a Solana wallet to the authenticated user's account. "
        "Requires a valid signature to prove wallet ownership."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid signature or wallet already linked"},
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    },
)
async def link_wallet(
    request: LinkWalletRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> LinkWalletResponse:
    """Link a Solana wallet to the current authenticated user.

    The user must sign a challenge message with the wallet private key to
    prove ownership. Each wallet can only be linked to one user (unique
    constraint), and each user can only have one linked wallet.

    Args:
        request: The wallet linking payload with address, signature, and message.
        db: Async database session.
        user_id: The authenticated user's UUID from the JWT token.

    Returns:
        LinkWalletResponse confirming the wallet was linked.

    Raises:
        HTTPException: 400 if signature is invalid or wallet already linked.
    """
    try:
        result = await auth_service.link_wallet_to_user(
            db,
            user_id,
            request.wallet_address,
            request.signature,
            request.message,
        )
        return LinkWalletResponse(
            success=result.get("success", True),
            wallet_address=result["user"].wallet_address or request.wallet_address,
            message=result.get("message", "Wallet linked successfully"),
        )
    except WalletVerificationError as verification_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(verification_error),
        )
    except AuthError as auth_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(auth_error),
        )


# ---------------------------------------------------------------------------
# Token management endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/refresh",
    response_model=RefreshTokenResponse,
    summary="Refresh Access Token",
    description="Exchange a valid refresh token for a new access token.",
    responses={
        401: {"model": ErrorResponse, "description": "Invalid or expired refresh token"},
    },
)
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> RefreshTokenResponse:
    """Exchange a refresh token for a new access token.

    Refresh tokens are valid for 7 days. After expiration, the user must
    re-authenticate via GitHub OAuth or wallet signature.

    Args:
        request: The refresh token payload.
        db: Async database session.

    Returns:
        RefreshTokenResponse with a new access token.

    Raises:
        HTTPException: 401 if the refresh token is invalid or expired.
    """
    try:
        result = await auth_service.refresh_access_token(db, request.refresh_token)
        return result
    except (InvalidTokenError, TokenExpiredError) as token_error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Refresh token is invalid or expired: {token_error}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# User profile endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get Current User",
    description="Returns the full profile of the currently authenticated user.",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        404: {"model": ErrorResponse, "description": "User not found"},
    },
)
async def get_current_user(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> UserResponse:
    """Retrieve the full profile of the currently authenticated user.

    Uses the user ID from the JWT token to look up the user record in
    the database and return their complete profile.

    Args:
        db: Async database session.
        user_id: The authenticated user's UUID from the JWT token.

    Returns:
        UserResponse with the user's complete profile.

    Raises:
        HTTPException: 404 if the user record does not exist.
    """
    try:
        return await auth_service.get_current_user(db, user_id)
    except AuthError as auth_error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(auth_error),
        )


# Export the dependency for use in other modules
__all__ = ["router", "get_current_user_id", "get_current_user"]
