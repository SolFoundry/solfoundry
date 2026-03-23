"""Sign-In With Solana (SIWS) authentication service.

Implements the SIWS standard for wallet-native authentication:
- Challenge generation with standardised message format
- ed25519 signature verification (Phantom, Solflare, Backpack compatible)
- Persistent nonce storage in PostgreSQL (no in-memory replay window)
- DB-backed wallet sessions with access/refresh tokens
- Rate limiting: max 5 sign-in attempts per wallet per minute
- Access tokens: 24-hour lifetime
- Refresh tokens: 7-day lifetime, single-use rotation
"""

import hashlib
import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Tuple
import base64
import logging

from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from solders.signature import Signature
from solders.pubkey import Pubkey

from app.models.wallet_session import SiwsNonce, WalletSession, SiwsAuthResponse
from app.services.auth_service import (
    create_access_token,
    create_refresh_token,
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    WalletVerificationError,
)
from jose import jwt, JWTError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SIWS_DOMAIN = os.getenv("SIWS_DOMAIN", "app.solfoundry.io")
SIWS_URI = os.getenv("SIWS_URI", "https://app.solfoundry.io")
SIWS_STATEMENT = "Sign in to SolFoundry"
SIWS_VERSION = "1"
SIWS_CHAIN_ID = "mainnet"

NONCE_TTL_MINUTES = 5          # Challenge expires after 5 minutes
ACCESS_TOKEN_TTL_HOURS = 24    # 24-hour access tokens
REFRESH_TOKEN_TTL_DAYS = 7     # 7-day refresh tokens

# Rate limit: 5 attempts per wallet per 60 seconds
RATE_LIMIT_MAX = 5
RATE_LIMIT_WINDOW_SECONDS = 60


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------

class SiwsNonceError(Exception):
    """Raised when nonce validation fails."""
    pass


class SiwsRateLimitError(Exception):
    """Raised when a wallet exceeds sign-in rate limit."""
    pass


class SiwsSessionError(Exception):
    """Raised for session-related errors."""
    pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256(value: str) -> str:
    """Return the hex SHA-256 digest of a UTF-8 string."""
    return hashlib.sha256(value.encode()).hexdigest()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _build_siws_message(
    domain: str,
    address: str,
    nonce: str,
    issued_at: datetime,
    expiration_time: datetime,
) -> str:
    """Construct the canonical SIWS message text.

    Format follows the SIWS EIP-4361 style adapted for Solana:

      {domain} wants you to sign in with your Solana account:
      {address}

      {statement}

      URI: {uri}
      Version: {version}
      Chain ID: {chain_id}
      Nonce: {nonce}
      Issued At: {issued_at}
      Expiration Time: {expiration_time}
    """
    uri = SIWS_URI
    return (
        f"{domain} wants you to sign in with your Solana account:\n"
        f"{address}\n"
        f"\n"
        f"{SIWS_STATEMENT}\n"
        f"\n"
        f"URI: {uri}\n"
        f"Version: {SIWS_VERSION}\n"
        f"Chain ID: {SIWS_CHAIN_ID}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at.strftime('%Y-%m-%dT%H:%M:%SZ')}\n"
        f"Expiration Time: {expiration_time.strftime('%Y-%m-%dT%H:%M:%SZ')}"
    )


# ---------------------------------------------------------------------------
# Rate limiting (DB-backed)
# ---------------------------------------------------------------------------

async def _check_rate_limit(db: AsyncSession, wallet_address: str) -> None:
    """Raise SiwsRateLimitError if wallet exceeds RATE_LIMIT_MAX per window.

    Counts non-expired nonces issued to the wallet in the past
    RATE_LIMIT_WINDOW_SECONDS as a proxy for sign-in attempts.
    """
    window_start = _now_utc() - timedelta(seconds=RATE_LIMIT_WINDOW_SECONDS)
    result = await db.execute(
        select(func.count(SiwsNonce.nonce)).where(
            SiwsNonce.wallet_address == wallet_address.lower(),
            SiwsNonce.issued_at >= window_start,
        )
    )
    count = result.scalar_one()
    if count >= RATE_LIMIT_MAX:
        raise SiwsRateLimitError(
            f"Too many sign-in attempts. Retry after {RATE_LIMIT_WINDOW_SECONDS}s."
        )


# ---------------------------------------------------------------------------
# Challenge generation
# ---------------------------------------------------------------------------

async def create_siws_challenge(
    db: AsyncSession,
    wallet_address: str,
    domain: Optional[str] = None,
) -> Dict:
    """Generate and persist a SIWS challenge for the given wallet.

    Args:
        db: Async SQLAlchemy session.
        wallet_address: Solana public key (base58).
        domain: Override the default domain (for multi-tenant support).

    Returns:
        Dict with ``domain``, ``address``, ``nonce``, ``issued_at``,
        ``expiration_time``, and ``message`` fields.

    Raises:
        SiwsRateLimitError: If the wallet has exceeded the rate limit.
    """
    wallet_address = wallet_address.strip()
    domain = domain or SIWS_DOMAIN

    # Enforce rate limit before issuing new challenge
    await _check_rate_limit(db, wallet_address)

    nonce = secrets.token_urlsafe(32)
    now = _now_utc()
    expiry = now + timedelta(minutes=NONCE_TTL_MINUTES)

    message = _build_siws_message(
        domain=domain,
        address=wallet_address,
        nonce=nonce,
        issued_at=now,
        expiration_time=expiry,
    )

    record = SiwsNonce(
        nonce=nonce,
        wallet_address=wallet_address.lower(),
        domain=domain,
        issued_at=now,
        expiration_time=expiry,
        message_body=message,
        used=False,
    )
    db.add(record)
    await db.commit()

    return {
        "domain": domain,
        "address": wallet_address,
        "statement": SIWS_STATEMENT,
        "uri": SIWS_URI,
        "version": SIWS_VERSION,
        "chain_id": SIWS_CHAIN_ID,
        "nonce": nonce,
        "issued_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "expiration_time": expiry.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "message": message,
    }


# ---------------------------------------------------------------------------
# Nonce verification
# ---------------------------------------------------------------------------

async def _consume_nonce(
    db: AsyncSession,
    nonce: str,
    wallet_address: str,
    message: str,
) -> SiwsNonce:
    """Validate and mark a nonce as used (atomic-style check).

    Raises:
        SiwsNonceError: For any validation failure.
    """
    result = await db.execute(
        select(SiwsNonce).where(SiwsNonce.nonce == nonce)
    )
    record: Optional[SiwsNonce] = result.scalar_one_or_none()

    if record is None:
        raise SiwsNonceError("Invalid or unknown nonce")

    if record.used:
        raise SiwsNonceError("Nonce has already been used")

    if _now_utc() > record.expiration_time.replace(tzinfo=timezone.utc):
        raise SiwsNonceError("Nonce has expired")

    if record.wallet_address != wallet_address.lower():
        raise SiwsNonceError("Wallet address does not match nonce")

    if record.message_body != message:
        raise SiwsNonceError("Message body does not match issued challenge")

    # Mark as used — prevents replay
    record.used = True
    await db.commit()

    return record


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------

def _verify_ed25519_signature(
    wallet_address: str,
    message: str,
    signature_b64: str,
) -> None:
    """Verify an ed25519 wallet signature.

    Supports the encoding conventions used by Phantom, Solflare, and Backpack:
    all three sign the raw UTF-8 message bytes using the account's ed25519 key.

    Raises:
        WalletVerificationError: If the signature is invalid or verification fails.
    """
    try:
        pubkey = Pubkey.from_string(wallet_address)
    except Exception as exc:
        raise WalletVerificationError(f"Invalid wallet address: {exc}") from exc

    try:
        sig_bytes = base64.b64decode(signature_b64)
    except Exception as exc:
        raise WalletVerificationError(f"Cannot decode signature: {exc}") from exc

    if len(sig_bytes) != 64:
        raise WalletVerificationError(
            f"Invalid signature length: expected 64 bytes, got {len(sig_bytes)}"
        )

    try:
        sig = Signature(sig_bytes)
        sig.verify(pubkey, message.encode("utf-8"))
    except Exception as exc:
        raise WalletVerificationError(f"Signature verification failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------

async def _create_wallet_session(
    db: AsyncSession,
    wallet_address: str,
    nonce: str,
) -> Tuple[str, str]:
    """Create a new wallet session, returning (access_token, refresh_token).

    Tokens are 24 h / 7 d respectively.  Only the SHA-256 hashes are stored
    in the DB — raw tokens are never persisted.
    """
    access_ttl = timedelta(hours=ACCESS_TOKEN_TTL_HOURS)
    refresh_ttl = timedelta(days=REFRESH_TOKEN_TTL_DAYS)

    access_token = create_access_token(wallet_address, expires_delta=access_ttl)
    refresh_token = create_refresh_token(wallet_address, expires_delta=refresh_ttl)

    now = _now_utc()
    session = WalletSession(
        wallet_address=wallet_address.lower(),
        access_token_hash=_sha256(access_token),
        refresh_token_hash=_sha256(refresh_token),
        access_expires_at=now + access_ttl,
        refresh_expires_at=now + refresh_ttl,
        created_at=now,
        revoked=False,
        nonce=nonce,
    )
    db.add(session)
    await db.commit()

    return access_token, refresh_token


async def refresh_wallet_session(
    db: AsyncSession,
    refresh_token: str,
) -> Tuple[str, str]:
    """Rotate a refresh token, returning new (access_token, refresh_token).

    Single-use rotation: the old session is revoked and a new one is issued.

    Raises:
        SiwsSessionError: If the refresh token is invalid, expired, or revoked.
    """
    token_hash = _sha256(refresh_token)

    result = await db.execute(
        select(WalletSession).where(WalletSession.refresh_token_hash == token_hash)
    )
    session: Optional[WalletSession] = result.scalar_one_or_none()

    if session is None:
        raise SiwsSessionError("Invalid refresh token")

    if session.revoked:
        raise SiwsSessionError("Refresh token has been revoked")

    refresh_expiry = session.refresh_expires_at
    if refresh_expiry.tzinfo is None:
        refresh_expiry = refresh_expiry.replace(tzinfo=timezone.utc)
    if _now_utc() > refresh_expiry:
        raise SiwsSessionError("Refresh token has expired")

    # Decode to get wallet address
    try:
        from jose import jwt as jose_jwt
        payload = jose_jwt.decode(
            refresh_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
        )
        wallet_address = payload.get("sub", "")
    except JWTError as exc:
        raise SiwsSessionError(f"Cannot decode refresh token: {exc}") from exc

    # Revoke old session
    session.revoked = True
    await db.flush()

    # Issue new session (no new nonce needed for refresh)
    new_access, new_refresh = await _create_wallet_session(
        db, wallet_address, nonce=session.nonce or ""
    )
    return new_access, new_refresh


async def revoke_wallet_session(
    db: AsyncSession,
    access_token: str,
) -> bool:
    """Revoke the session associated with an access token (sign-out).

    Returns True if a session was found and revoked, False otherwise.
    """
    token_hash = _sha256(access_token)
    result = await db.execute(
        select(WalletSession).where(WalletSession.access_token_hash == token_hash)
    )
    session: Optional[WalletSession] = result.scalar_one_or_none()
    if session and not session.revoked:
        session.revoked = True
        await db.commit()
        return True
    return False


# ---------------------------------------------------------------------------
# Main sign-in flow
# ---------------------------------------------------------------------------

async def siws_authenticate(
    db: AsyncSession,
    wallet_address: str,
    signature: str,
    nonce: str,
    message: str,
) -> SiwsAuthResponse:
    """Complete SIWS sign-in flow.

    Steps:
    1. Consume nonce (validates expiry, wallet match, message integrity)
    2. Verify ed25519 signature
    3. Create persistent wallet session
    4. Return access + refresh tokens

    Args:
        db: Async DB session.
        wallet_address: Solana public key.
        signature: Base64-encoded wallet signature.
        nonce: Nonce from the challenge response.
        message: The exact message that was signed.

    Returns:
        SiwsAuthResponse with tokens and metadata.

    Raises:
        SiwsNonceError: Nonce validation failed.
        WalletVerificationError: Signature invalid.
    """
    # 1. Validate nonce (also checks message integrity)
    await _consume_nonce(db, nonce, wallet_address, message)

    # 2. Verify signature
    _verify_ed25519_signature(wallet_address, message, signature)

    # 3. Persist session
    access_token, refresh_token = await _create_wallet_session(
        db, wallet_address, nonce=nonce
    )

    return SiwsAuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_TTL_HOURS * 3600,
        wallet_address=wallet_address,
    )


# ---------------------------------------------------------------------------
# Middleware dependency
# ---------------------------------------------------------------------------

async def require_wallet_auth(
    db: AsyncSession,
    access_token: str,
) -> str:
    """Dependency / middleware helper that enforces wallet session validity.

    Validates:
    - JWT signature + expiry
    - Session exists in DB and is not revoked

    Returns the wallet_address (JWT subject) if valid.

    Raises:
        SiwsSessionError: If the session is invalid or revoked.
    """
    try:
        payload = jwt.decode(
            access_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
        )
        token_type = payload.get("type")
        if token_type != "access":
            raise SiwsSessionError("Not an access token")
        wallet_address = payload.get("sub", "")
        if not wallet_address:
            raise SiwsSessionError("Missing subject in token")
    except JWTError as exc:
        raise SiwsSessionError(f"Invalid token: {exc}") from exc

    # Check DB session is active
    token_hash = _sha256(access_token)
    result = await db.execute(
        select(WalletSession).where(WalletSession.access_token_hash == token_hash)
    )
    session: Optional[WalletSession] = result.scalar_one_or_none()

    if session is None:
        raise SiwsSessionError("Session not found")
    if session.revoked:
        raise SiwsSessionError("Session has been revoked")

    access_expiry = session.access_expires_at
    if access_expiry.tzinfo is None:
        access_expiry = access_expiry.replace(tzinfo=timezone.utc)
    if _now_utc() > access_expiry:
        raise SiwsSessionError("Session has expired")

    return wallet_address


# ---------------------------------------------------------------------------
# Cleanup utility (for cron / background tasks)
# ---------------------------------------------------------------------------

async def purge_expired_nonces(db: AsyncSession) -> int:
    """Delete expired or used nonces from the DB.

    Returns the number of rows deleted.
    """
    result = await db.execute(
        delete(SiwsNonce).where(
            (SiwsNonce.expiration_time < _now_utc())
            | (SiwsNonce.used == True)  # noqa: E712
        )
    )
    await db.commit()
    return result.rowcount


async def purge_expired_sessions(db: AsyncSession) -> int:
    """Delete expired wallet sessions from the DB.

    Returns the number of rows deleted.
    """
    result = await db.execute(
        delete(WalletSession).where(
            WalletSession.refresh_expires_at < _now_utc()
        )
    )
    await db.commit()
    return result.rowcount
