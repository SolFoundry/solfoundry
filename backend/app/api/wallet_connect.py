"""Wallet Connect API endpoints.

This module provides REST API endpoints for the wallet connect backend wiring:
- SIWS (Sign-In With Solana) challenge message generation
- Signature verification and authentication
- Wallet-to-user linking and management
- Session management (list, refresh, revoke)
- Rate limiting on all auth endpoints (5 attempts per minute)

All endpoints use PostgreSQL-backed state — no in-memory fallbacks.
Protected endpoints require JWT authentication via the Authorization header.

Routes:
    GET  /wallet-connect/siws/message    — Generate SIWS challenge
    POST /wallet-connect/siws/verify     — Verify signature and authenticate
    POST /wallet-connect/link            — Link wallet to user account
    DELETE /wallet-connect/link           — Unlink wallet from account
    GET  /wallet-connect/wallets         — List user's linked wallets
    POST /wallet-connect/wallets/primary — Set primary wallet
    GET  /wallet-connect/sessions        — List user's sessions
    POST /wallet-connect/sessions/refresh — Refresh access token
    POST /wallet-connect/sessions/revoke  — Revoke a specific session
    POST /wallet-connect/sessions/revoke-all — Revoke all sessions
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.auth_session import (
    SIWSMessageResponse,
    SIWSVerifyRequest,
    SIWSVerifyResponse,
    SessionListResponse,
    SessionResponse,
    RefreshSessionRequest,
    RefreshSessionResponse,
    RevokeSessionRequest,
    RevokeAllSessionsResponse,
)
from app.models.wallet_link import (
    WalletLinkCreateRequest,
    WalletLinkResponse,
    WalletLinkListResponse,
    WalletUnlinkRequest,
    WalletUnlinkResponse,
    SetPrimaryWalletRequest,
)
from app.services import wallet_connect_service
from app.services.wallet_connect_service import (
    WalletConnectError,
    ChallengeNotFoundError,
    ChallengeExpiredError,
    ChallengeConsumedError,
    SignatureVerificationError,
    WalletAlreadyLinkedError,
    WalletNotLinkedError,
    SessionNotFoundError,
    SessionRevokedError,
    SessionExpiredError,
    TokenVerificationError,
    RateLimitExceededError,
    UserNotFoundError,
    WalletOwnershipError,
)

router = APIRouter(prefix="/wallet-connect", tags=["wallet-connect"])


# ---------------------------------------------------------------------------
# Auth dependency (JWT-based)
# ---------------------------------------------------------------------------


async def get_current_user_id_from_jwt(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> str:
    """Extract and validate the current user ID from JWT token.

    This dependency validates the JWT access token from the Authorization
    header and checks the session status in PostgreSQL. It is fail-closed:
    missing or invalid tokens always result in a 401 error.

    Args:
        request: The incoming HTTP request.
        db: Async database session.

    Returns:
        The authenticated user ID (UUID string).

    Raises:
        HTTPException: 401 if authentication fails.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication scheme. Use: Bearer <token>",
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
        user_id = await wallet_connect_service.validate_session_token(db, token)
        return user_id
    except SessionExpiredError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired. Use refresh token to obtain a new one.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except SessionRevokedError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked. Please re-authenticate.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (TokenVerificationError, SessionNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )


def _get_client_ip(request: Request) -> str:
    """Extract the client IP address from the request.

    Checks X-Forwarded-For header first (for reverse proxy setups),
    then falls back to the direct client IP.

    Args:
        request: The incoming HTTP request.

    Returns:
        The client IP address as a string.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain (the original client)
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# ---------------------------------------------------------------------------
# SIWS Challenge Generation
# ---------------------------------------------------------------------------


@router.get(
    "/siws/message",
    response_model=SIWSMessageResponse,
    summary="Generate SIWS challenge message",
    description=(
        "Generate a Sign-In With Solana (SIWS) challenge message for the given "
        "wallet address. The wallet must sign this message and submit the "
        "signature to /wallet-connect/siws/verify to complete authentication."
    ),
)
async def generate_siws_message(
    wallet_address: str,
    provider: Optional[str] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
) -> SIWSMessageResponse:
    """Generate a SIWS challenge message for wallet authentication.

    This endpoint creates a nonce-bound challenge message that the wallet
    must sign. The challenge expires after 5 minutes and is single-use.

    Rate limited to 5 requests per minute per IP address.

    Args:
        wallet_address: Solana wallet public key (base58-encoded, 32-44 chars).
        provider: Optional wallet provider name (phantom, solflare, backpack).
        request: The incoming HTTP request (for rate limiting).
        db: Async database session.

    Returns:
        SIWSMessageResponse with the challenge message, nonce, and expiration.

    Raises:
        HTTPException: 400 if wallet address is invalid.
        HTTPException: 429 if rate limit is exceeded.
    """
    # Rate limiting
    client_ip = _get_client_ip(request) if request else "unknown"
    try:
        await wallet_connect_service.check_rate_limit(
            db, client_ip, "siws_message"
        )
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        )

    try:
        result = await wallet_connect_service.generate_siws_message(
            db, wallet_address, provider
        )
        return SIWSMessageResponse(
            message=result["message"],
            nonce=result["nonce"],
            expires_at=result["expires_at"],
        )
    except SignatureVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# SIWS Verification + Authentication
# ---------------------------------------------------------------------------


@router.post(
    "/siws/verify",
    response_model=SIWSVerifyResponse,
    summary="Verify SIWS signature and authenticate",
    description=(
        "Verify the wallet's Ed25519 signature of the SIWS challenge message "
        "and create an authenticated session. Returns JWT tokens for subsequent "
        "API access. Supports Phantom, Solflare, and Backpack wallet formats."
    ),
)
async def verify_siws_signature(
    body: SIWSVerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SIWSVerifyResponse:
    """Verify a signed SIWS message and create an authenticated session.

    This endpoint completes the SIWS authentication flow:
    1. Validates the challenge nonce (single-use, DB-backed)
    2. Verifies the Ed25519 signature using solders
    3. Finds or creates the user account
    4. Creates a session with JWT access + refresh tokens

    Rate limited to 5 attempts per minute per IP address.

    Args:
        body: The verification request with wallet, signature, message, nonce.
        request: The incoming HTTP request.
        db: Async database session.

    Returns:
        SIWSVerifyResponse with JWT tokens, session ID, and user profile.

    Raises:
        HTTPException: 400 if challenge or signature verification fails.
        HTTPException: 429 if rate limit is exceeded.
    """
    client_ip = _get_client_ip(request)
    user_agent = request.headers.get("User-Agent", "")

    # Rate limiting
    try:
        await wallet_connect_service.check_rate_limit(
            db, client_ip, "siws_verify"
        )
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        )

    try:
        result = await wallet_connect_service.siws_verify_and_authenticate(
            db,
            wallet_address=body.wallet_address,
            signature=body.signature,
            message=body.message,
            nonce=body.nonce,
            provider=body.provider or "unknown",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        return SIWSVerifyResponse(
            access_token=result["access_token"],
            refresh_token=result["refresh_token"],
            token_type=result["token_type"],
            expires_in=result["expires_in"],
            session_id=result["session_id"],
            user=result["user"],
        )
    except (
        ChallengeNotFoundError,
        ChallengeExpiredError,
        ChallengeConsumedError,
        SignatureVerificationError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except WalletConnectError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# Wallet Linking
# ---------------------------------------------------------------------------


@router.post(
    "/link",
    response_model=WalletLinkResponse,
    status_code=201,
    summary="Link wallet to user account",
    description=(
        "Link a Solana wallet to the authenticated user's account. Requires "
        "a signed SIWS challenge message to prove wallet ownership. Each "
        "wallet can only be linked to one user."
    ),
)
async def link_wallet(
    body: WalletLinkCreateRequest,
    request: Request,
    user_id: str = Depends(get_current_user_id_from_jwt),
    db: AsyncSession = Depends(get_db),
) -> WalletLinkResponse:
    """Link a Solana wallet to the current user's account.

    Requires JWT authentication and a signed SIWS challenge to prove
    wallet ownership. The wallet must not already be linked to another user.

    Rate limited to 5 attempts per minute per IP address.

    Args:
        body: Wallet linking request with wallet, signature, nonce, provider.
        request: The incoming HTTP request.
        user_id: The authenticated user ID from JWT.
        db: Async database session.

    Returns:
        WalletLinkResponse with the created wallet link details.

    Raises:
        HTTPException: 400 if verification fails.
        HTTPException: 401 if not authenticated.
        HTTPException: 409 if wallet is already linked to another user.
        HTTPException: 429 if rate limit is exceeded.
    """
    client_ip = _get_client_ip(request)
    try:
        await wallet_connect_service.check_rate_limit(
            db, client_ip, "link_wallet"
        )
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        )

    try:
        result = await wallet_connect_service.link_wallet(
            db,
            user_id=user_id,
            wallet_address=body.wallet_address,
            signature=body.signature,
            message=body.message,
            nonce=body.nonce,
            provider=body.provider.value if body.provider else "unknown",
            label=body.label,
            is_primary=body.is_primary,
        )
        return WalletLinkResponse(
            id=result["id"],
            user_id=result["user_id"],
            wallet_address=result["wallet_address"],
            provider=result["provider"],
            label=result["label"],
            is_primary=result["is_primary"],
            verified_at=result["verified_at"],
            created_at=result["created_at"],
        )
    except WalletAlreadyLinkedError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except (
        ChallengeNotFoundError,
        ChallengeExpiredError,
        ChallengeConsumedError,
        SignatureVerificationError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except UserNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.delete(
    "/link",
    response_model=WalletUnlinkResponse,
    summary="Unlink wallet from user account",
    description="Remove the association between a wallet and the authenticated user.",
)
async def unlink_wallet(
    body: WalletUnlinkRequest,
    user_id: str = Depends(get_current_user_id_from_jwt),
    db: AsyncSession = Depends(get_db),
) -> WalletUnlinkResponse:
    """Unlink a wallet from the current user's account.

    Only the wallet owner can unlink their wallet. If the unlinked wallet
    was the user's primary wallet, the primary wallet field is cleared.

    Args:
        body: Unlink request with the wallet address.
        user_id: The authenticated user ID from JWT.
        db: Async database session.

    Returns:
        WalletUnlinkResponse confirming the unlink.

    Raises:
        HTTPException: 401 if not authenticated.
        HTTPException: 403 if the user doesn't own the wallet.
        HTTPException: 404 if the wallet is not linked.
    """
    try:
        await wallet_connect_service.unlink_wallet(db, user_id, body.wallet_address)
        return WalletUnlinkResponse(
            success=True,
            wallet_address=body.wallet_address,
            message="Wallet unlinked successfully",
        )
    except WalletNotLinkedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except WalletOwnershipError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


@router.get(
    "/wallets",
    response_model=WalletLinkListResponse,
    summary="List linked wallets",
    description="List all wallets linked to the authenticated user's account.",
)
async def list_wallets(
    user_id: str = Depends(get_current_user_id_from_jwt),
    db: AsyncSession = Depends(get_db),
) -> WalletLinkListResponse:
    """List all wallets linked to the current user.

    Returns all linked wallets with their provider, label, and primary status.

    Args:
        user_id: The authenticated user ID from JWT.
        db: Async database session.

    Returns:
        WalletLinkListResponse with all linked wallets.
    """
    wallets = await wallet_connect_service.list_user_wallets(db, user_id)
    return WalletLinkListResponse(
        items=[
            WalletLinkResponse(
                id=w["id"],
                user_id=w["user_id"],
                wallet_address=w["wallet_address"],
                provider=w["provider"],
                label=w["label"],
                is_primary=w["is_primary"],
                verified_at=w["verified_at"],
                created_at=w["created_at"],
            )
            for w in wallets
        ],
        total=len(wallets),
    )


@router.post(
    "/wallets/primary",
    status_code=204,
    summary="Set primary wallet",
    description="Set a linked wallet as the primary wallet for payouts.",
)
async def set_primary_wallet(
    body: SetPrimaryWalletRequest,
    user_id: str = Depends(get_current_user_id_from_jwt),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Set a linked wallet as the primary wallet for payouts.

    The primary wallet is used for bounty payout disbursements. Only
    wallets already linked to the user can be set as primary.

    Args:
        body: Request with the wallet address to set as primary.
        user_id: The authenticated user ID from JWT.
        db: Async database session.

    Raises:
        HTTPException: 401 if not authenticated.
        HTTPException: 403 if the user doesn't own the wallet.
        HTTPException: 404 if the wallet is not linked.
    """
    try:
        await wallet_connect_service.set_primary_wallet(
            db, user_id, body.wallet_address
        )
    except WalletNotLinkedError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except WalletOwnershipError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# Session Management
# ---------------------------------------------------------------------------


@router.get(
    "/sessions",
    response_model=SessionListResponse,
    summary="List user sessions",
    description="List all authentication sessions for the current user.",
)
async def list_sessions(
    user_id: str = Depends(get_current_user_id_from_jwt),
    db: AsyncSession = Depends(get_db),
) -> SessionListResponse:
    """List all sessions for the current user.

    Returns active and recently revoked sessions, ordered by creation
    time (newest first).

    Args:
        user_id: The authenticated user ID from JWT.
        db: Async database session.

    Returns:
        SessionListResponse with all sessions.
    """
    sessions = await wallet_connect_service.list_sessions(db, user_id)
    return SessionListResponse(
        items=[
            SessionResponse(
                id=s["id"],
                wallet_address=s["wallet_address"],
                provider=s["provider"],
                ip_address=s["ip_address"],
                status=s["status"],
                created_at=s["created_at"],
                expires_at=s["expires_at"],
            )
            for s in sessions
        ],
        total=len(sessions),
    )


@router.post(
    "/sessions/refresh",
    response_model=RefreshSessionResponse,
    summary="Refresh access token",
    description=(
        "Exchange a refresh token for a new access token. The refresh token "
        "must belong to an active session."
    ),
)
async def refresh_session(
    body: RefreshSessionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> RefreshSessionResponse:
    """Refresh an access token using a refresh token.

    Does not require the current access token — only the refresh token.
    Rate limited to 5 attempts per minute per IP address.

    Args:
        body: Refresh request with the refresh token.
        request: The incoming HTTP request.
        db: Async database session.

    Returns:
        RefreshSessionResponse with the new access token.

    Raises:
        HTTPException: 401 if the refresh token is invalid or session is revoked.
        HTTPException: 429 if rate limit is exceeded.
    """
    client_ip = _get_client_ip(request)
    try:
        await wallet_connect_service.check_rate_limit(
            db, client_ip, "session_refresh"
        )
    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        )

    try:
        result = await wallet_connect_service.refresh_session(db, body.refresh_token)
        return RefreshSessionResponse(
            access_token=result["access_token"],
            token_type=result["token_type"],
            expires_in=result["expires_in"],
        )
    except (SessionExpiredError, TokenVerificationError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except SessionRevokedError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (SessionNotFoundError, UserNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post(
    "/sessions/revoke",
    status_code=204,
    summary="Revoke a session",
    description="Revoke a specific authentication session by its ID.",
)
async def revoke_session(
    body: RevokeSessionRequest,
    user_id: str = Depends(get_current_user_id_from_jwt),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Revoke a specific session.

    Only the session owner can revoke their sessions. Once revoked, any
    tokens associated with the session are immediately invalidated.

    Args:
        body: Revoke request with the session ID.
        user_id: The authenticated user ID from JWT.
        db: Async database session.

    Raises:
        HTTPException: 401 if not authenticated.
        HTTPException: 403 if the user doesn't own the session.
        HTTPException: 404 if the session is not found.
    """
    try:
        await wallet_connect_service.revoke_session(db, body.session_id, user_id)
    except SessionNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except WalletOwnershipError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        )


@router.post(
    "/sessions/revoke-all",
    response_model=RevokeAllSessionsResponse,
    summary="Revoke all sessions",
    description="Revoke all active sessions for the current user.",
)
async def revoke_all_sessions(
    user_id: str = Depends(get_current_user_id_from_jwt),
    db: AsyncSession = Depends(get_db),
) -> RevokeAllSessionsResponse:
    """Revoke all active sessions for the current user.

    This is a bulk operation that invalidates every active session.
    Useful for security incidents or when the user suspects unauthorized access.

    Args:
        user_id: The authenticated user ID from JWT.
        db: Async database session.

    Returns:
        RevokeAllSessionsResponse with the count of revoked sessions.
    """
    revoked_count = await wallet_connect_service.revoke_all_sessions(db, user_id)
    return RevokeAllSessionsResponse(
        revoked_count=revoked_count,
        message=f"Successfully revoked {revoked_count} active session(s)",
    )
