"""SIWS (Sign-In With Solana) API endpoints.

Provides a wallet-native authentication flow as an alternative (or complement)
to the existing GitHub OAuth flow.

Endpoints:
  GET  /auth/siws/message     — Request a SIWS challenge message to sign
  POST /auth/siws              — Submit signed message, receive JWT tokens
  POST /auth/siws/refresh      — Rotate refresh token, get new access token
  POST /auth/siws/revoke       — Sign out (revoke current session)
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.wallet_session import (
    SiwsMessageResponse,
    SiwsAuthRequest,
    SiwsAuthResponse,
)
from app.models.errors import ErrorResponse
from app.services.siws_service import (
    create_siws_challenge,
    siws_authenticate,
    refresh_wallet_session,
    revoke_wallet_session,
    require_wallet_auth,
    SiwsNonceError,
    SiwsRateLimitError,
    SiwsSessionError,
    SiwsValidationError,
)
from app.services.auth_service import WalletVerificationError
from app.models.user import RefreshTokenRequest

router = APIRouter(prefix="/auth/siws", tags=["siws"])
security = HTTPBearer(auto_error=False)


def _extract_bearer(
    credentials: Optional[HTTPAuthorizationCredentials],
    authorization: Optional[str],
) -> Optional[str]:
    """Extract bearer token from either HTTPBearer or raw Authorization header."""
    if credentials:
        return credentials.credentials
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return None


# ---------------------------------------------------------------------------
# GET /auth/siws/message
# ---------------------------------------------------------------------------


@router.get(
    "/message",
    response_model=SiwsMessageResponse,
    summary="Get SIWS Challenge",
    description=(
        "Generate a Sign-In With Solana challenge message for a given wallet. "
        "The client must sign the returned ``message`` field with the wallet "
        "private key and submit it to POST /auth/siws."
    ),
    responses={
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
)
async def get_siws_message(
    wallet_address: str,
    domain: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> SiwsMessageResponse:
    """Request a SIWS challenge.

    The ``nonce`` field in the response is single-use and expires in 5 minutes.
    Include the full ``message`` field when submitting to ``POST /auth/siws``.

    Args:
        wallet_address: Solana public key in base58 format.
        domain: Optional override for the origin domain (defaults to
                ``SIWS_DOMAIN`` environment variable).

    Returns:
        SiwsMessageResponse with the canonical SIWS message to sign.
    """
    try:
        data = await create_siws_challenge(db, wallet_address, domain=domain)
    except SiwsValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except SiwsRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    return SiwsMessageResponse(**data)


# ---------------------------------------------------------------------------
# POST /auth/siws
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=SiwsAuthResponse,
    summary="SIWS Sign-In",
    description=(
        "Complete the SIWS flow by submitting the wallet signature. "
        "Returns JWT access and refresh tokens on success."
    ),
    responses={
        400: {"model": ErrorResponse, "description": "Invalid signature or nonce"},
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
    },
)
async def siws_sign_in(
    request: SiwsAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> SiwsAuthResponse:
    """Complete SIWS wallet sign-in.

    Flow:
    1. ``GET /auth/siws/message?wallet_address=<addr>`` to obtain a challenge.
    2. Sign the ``message`` field with your wallet.
    3. Submit ``wallet_address``, ``signature`` (base64), ``nonce``, and
       ``message`` here to receive JWT tokens.

    Token lifetimes:
    - Access token: 24 hours
    - Refresh token: 7 days
    """
    try:
        return await siws_authenticate(
            db,
            wallet_address=request.wallet_address,
            signature=request.signature,
            nonce=request.nonce,
            message=request.message,
        )
    except SiwsNonceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except WalletVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except SiwsRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        )


# ---------------------------------------------------------------------------
# POST /auth/siws/refresh
# ---------------------------------------------------------------------------


@router.post(
    "/refresh",
    response_model=SiwsAuthResponse,
    summary="Refresh SIWS Tokens",
    description=(
        "Exchange a refresh token for a new access/refresh token pair. "
        "Each refresh token is single-use — the old pair is revoked on use."
    ),
    responses={
        401: {"model": ErrorResponse, "description": "Invalid or expired refresh token"},
    },
)
async def siws_refresh(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> SiwsAuthResponse:
    """Rotate SIWS tokens without re-signing.

    Send the ``refresh_token`` from the sign-in response to receive a new
    access/refresh token pair.  The old refresh token is immediately invalidated.
    """
    try:
        access_token, refresh_token = await refresh_wallet_session(
            db, request.refresh_token
        )
        # Decode wallet address from new token for response
        from jose import jwt as jose_jwt
        from app.services.auth_service import JWT_SECRET_KEY, JWT_ALGORITHM
        payload = jose_jwt.decode(
            access_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
        )
        wallet_address = payload.get("sub", "")
        from app.services.siws_service import ACCESS_TOKEN_TTL_HOURS
        return SiwsAuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_TTL_HOURS * 3600,
            wallet_address=wallet_address,
        )
    except SiwsSessionError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# POST /auth/siws/revoke
# ---------------------------------------------------------------------------


@router.post(
    "/revoke",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke SIWS Session",
    description="Sign out by revoking the current wallet session.",
    responses={
        401: {"model": ErrorResponse, "description": "Not authenticated"},
    },
)
async def siws_revoke(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Revoke the current wallet session (sign-out).

    Pass the access token via ``Authorization: Bearer <token>``.
    """
    token = _extract_bearer(credentials, authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    await revoke_wallet_session(db, token)


# ---------------------------------------------------------------------------
# Reusable FastAPI dependency for wallet-auth-protected routes
# ---------------------------------------------------------------------------


async def require_siws_session(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> str:
    """FastAPI dependency that enforces an active SIWS wallet session.

    Usage::

        @router.get("/protected")
        async def protected(wallet: str = Depends(require_siws_session)):
            return {"wallet": wallet}

    Returns the ``wallet_address`` of the authenticated session.

    Raises:
        HTTPException 401: If token is missing, invalid, expired, or revoked.
    """
    token = _extract_bearer(credentials, authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        wallet_address = await require_wallet_auth(db, token)
        return wallet_address
    except SiwsSessionError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )
