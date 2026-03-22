"""Sign-In With Solana (SIWS) API endpoints.

Provides REST API endpoints for the full SIWS authentication flow:

- ``POST /api/auth/siws/nonce`` — Generate a challenge nonce for a wallet.
- ``POST /api/auth/siws/authenticate`` — Verify a signed challenge and
  create a session with JWT tokens.
- ``POST /api/auth/siws/refresh`` — Exchange a refresh token for a new
  access token without re-signing.
- ``GET  /api/auth/siws/sessions`` — List active sessions for the
  authenticated wallet.
- ``POST /api/auth/siws/revoke`` — Revoke a specific session (logout).
- ``POST /api/auth/siws/revoke-all`` — Revoke all sessions for the
  authenticated wallet (logout from all devices).

All session-management endpoints (sessions, revoke, revoke-all) require
an active SIWS session via the ``require_wallet_auth`` dependency.

Rate limiting is enforced at the service layer: 5 sign-in attempts per
wallet per minute.

References:
    - SIWS Standard: https://github.com/phantom/sign-in-with-solana
    - FastAPI: https://fastapi.tiangolo.com/
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.wallet_auth import require_wallet_auth
from app.models.errors import ErrorResponse
from app.models.siws import (
    SIWSAuthenticateRequest,
    SIWSAuthenticateResponse,
    SIWSNonceResponse,
    SIWSRefreshRequest,
    SIWSRefreshResponse,
    SIWSRevokeRequest,
    SIWSRevokeResponse,
    SIWSSessionInfo,
    SIWSSessionListResponse,
)
from app.services.siws_service import (
    InvalidRefreshTokenError,
    InvalidWalletAddressError,
    MessageMismatchError,
    NonceAlreadyUsedError,
    NonceExpiredError,
    NonceNotFoundError,
    RateLimitExceededError,
    RefreshTokenExpiredError,
    SIWSError,
    SessionRevokedError,
    SignatureVerificationError,
    WalletMismatchError,
    authenticate_wallet,
    generate_nonce,
    get_active_sessions,
    refresh_session,
    revoke_all_wallet_sessions,
    revoke_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/siws", tags=["authentication"])


@router.post(
    "/nonce",
    response_model=SIWSNonceResponse,
    summary="Generate SIWS Challenge Nonce",
    description=(
        "Generates a SIWS-standard challenge message containing domain, "
        "wallet address, nonce, issued-at, and expiration fields. "
        "The wallet must sign this message to prove ownership."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid wallet address"},
    },
)
async def create_nonce(
    wallet_address: str,
    domain: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> SIWSNonceResponse:
    """Generate a SIWS challenge nonce for wallet authentication.

    The returned message follows the SIWS standard format and must be
    signed by the wallet's private key. The nonce is stored in PostgreSQL
    and expires after 5 minutes. Each nonce can only be used once.

    Args:
        wallet_address: The Solana wallet address requesting authentication.
        domain: Optional domain override for the SIWS message.
        db: Async SQLAlchemy database session.

    Returns:
        SIWSNonceResponse with the message, nonce, expiry, and domain.

    Raises:
        HTTPException: 400 if the wallet address is invalid.
    """
    try:
        result = await generate_nonce(db, wallet_address, domain)
        return SIWSNonceResponse(**result)
    except InvalidWalletAddressError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post(
    "/authenticate",
    response_model=SIWSAuthenticateResponse,
    summary="Authenticate with Solana Wallet (SIWS)",
    description=(
        "Completes the SIWS authentication flow by verifying the wallet's "
        "Ed25519 signature, consuming the one-time nonce, and issuing "
        "JWT access (24h) and refresh (7d) tokens. Supports Phantom, "
        "Solflare, and Backpack wallets."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Verification failed"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
)
async def authenticate(
    request_data: SIWSAuthenticateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SIWSAuthenticateResponse:
    """Authenticate a wallet by verifying its signature of the SIWS challenge.

    Flow:
    1. Rate limit check (5 attempts per wallet per minute).
    2. Nonce validation and consumption (one-time use, prevents replay).
    3. Ed25519 signature verification against the wallet public key.
    4. User record creation or update in the database.
    5. JWT token issuance and session persistence in PostgreSQL.

    Args:
        request_data: SIWS authentication request with wallet, signature,
            message, and nonce.
        request: The FastAPI request for IP and User-Agent extraction.
        db: Async SQLAlchemy database session.

    Returns:
        SIWSAuthenticateResponse with access/refresh tokens and user profile.

    Raises:
        HTTPException: 400 for invalid signatures, nonces, or addresses.
        HTTPException: 429 if the wallet has exceeded its rate limit.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        result = await authenticate_wallet(
            db=db,
            wallet_address=request_data.wallet_address,
            signature=request_data.signature,
            message=request_data.message,
            nonce=request_data.nonce,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return SIWSAuthenticateResponse(**result)

    except RateLimitExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
            headers={"Retry-After": str(exc.retry_after)},
        )

    except (
        NonceNotFoundError,
        NonceAlreadyUsedError,
        NonceExpiredError,
        WalletMismatchError,
        MessageMismatchError,
    ) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except (SignatureVerificationError, InvalidWalletAddressError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    except SIWSError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post(
    "/refresh",
    response_model=SIWSRefreshResponse,
    summary="Refresh SIWS Session",
    description=(
        "Exchanges a valid refresh token for a new access token without "
        "requiring the wallet to re-sign a message. Refresh tokens are "
        "valid for 7 days from the original authentication."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Invalid or expired refresh token"},
    },
)
async def refresh(
    request_data: SIWSRefreshRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> SIWSRefreshResponse:
    """Refresh a SIWS session by exchanging a refresh token.

    This endpoint allows maintaining an active session without requiring
    the user to sign a new message with their wallet. The refresh token
    must be valid and the associated session must not be revoked.

    Args:
        request_data: Refresh request containing the refresh token.
        request: The FastAPI request for IP extraction.
        db: Async SQLAlchemy database session.

    Returns:
        SIWSRefreshResponse with a new access token and session info.

    Raises:
        HTTPException: 401 if the refresh token is expired, invalid,
            or the session has been revoked.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        result = await refresh_session(
            db=db,
            refresh_token=request_data.refresh_token,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return SIWSRefreshResponse(**result)

    except (RefreshTokenExpiredError, InvalidRefreshTokenError) as exc:
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


@router.get(
    "/sessions",
    response_model=SIWSSessionListResponse,
    summary="List Active SIWS Sessions",
    description=(
        "Returns all active (non-revoked, non-expired) sessions for the "
        "authenticated wallet. Requires an active SIWS session."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    },
)
async def list_sessions(
    wallet_claims: dict = Depends(require_wallet_auth),
    db: AsyncSession = Depends(get_db),
) -> SIWSSessionListResponse:
    """List all active sessions for the authenticated wallet.

    Returns session metadata (creation time, last activity, IP address,
    wallet type) without exposing sensitive token hashes.

    Args:
        wallet_claims: Validated JWT claims from the SIWS auth dependency.
        db: Async SQLAlchemy database session.

    Returns:
        SIWSSessionListResponse with list of active sessions and total count.
    """
    wallet_address = wallet_claims.get("wallet", "")
    sessions = await get_active_sessions(db, wallet_address)

    return SIWSSessionListResponse(
        sessions=[SIWSSessionInfo(**session) for session in sessions],
        total=len(sessions),
    )


@router.post(
    "/revoke",
    response_model=SIWSRevokeResponse,
    summary="Revoke a SIWS Session",
    description=(
        "Revokes a specific SIWS session, invalidating its access and "
        "refresh tokens. The session must belong to the authenticated user."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
        400: {"model": ErrorResponse, "description": "Session not found"},
    },
)
async def revoke(
    request_data: SIWSRevokeRequest,
    wallet_claims: dict = Depends(require_wallet_auth),
    db: AsyncSession = Depends(get_db),
) -> SIWSRevokeResponse:
    """Revoke a specific SIWS session (single-device logout).

    Marks the specified session as revoked in the database, immediately
    invalidating any tokens associated with it.

    Args:
        request_data: Revoke request containing the session ID.
        wallet_claims: Validated JWT claims from the SIWS auth dependency.
        db: Async SQLAlchemy database session.

    Returns:
        SIWSRevokeResponse confirming the revocation.

    Raises:
        HTTPException: 400 if the session is not found or does not
            belong to the authenticated user.
    """
    user_id = wallet_claims["sub"]

    try:
        result = await revoke_session(db, request_data.session_id, user_id)
        return SIWSRevokeResponse(**result)
    except SessionRevokedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


@router.post(
    "/revoke-all",
    response_model=SIWSRevokeResponse,
    summary="Revoke All SIWS Sessions",
    description=(
        "Revokes all active sessions for the authenticated wallet. "
        "Useful for global logout or when a wallet is compromised."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    },
)
async def revoke_all(
    wallet_claims: dict = Depends(require_wallet_auth),
    db: AsyncSession = Depends(get_db),
) -> SIWSRevokeResponse:
    """Revoke all SIWS sessions for the authenticated wallet (global logout).

    Marks all non-revoked sessions for this wallet as revoked in the
    database. This is a security measure for when a wallet may be
    compromised or the user wants to log out from all devices.

    Args:
        wallet_claims: Validated JWT claims from the SIWS auth dependency.
        db: Async SQLAlchemy database session.

    Returns:
        SIWSRevokeResponse with the count of revoked sessions.
    """
    user_id = wallet_claims["sub"]
    wallet_address = wallet_claims.get("wallet", "")

    result = await revoke_all_wallet_sessions(db, wallet_address, user_id)
    return SIWSRevokeResponse(**result)
