"""Sign-In With Solana (SIWS) service.

Implements the SIWS authentication flow:
  1. Client requests a nonce-bound SIWS message (GET /auth/siws/message)
  2. Client signs it with their Solana wallet
  3. Server verifies the signature, consumes the nonce, upserts a User row,
     writes a WalletSessionTable row, and returns JWTs

Security properties:
  - Nonces are stored in PostgreSQL with 10-minute expiry (replay prevention)
  - Sessions are tracked in DB; individual sessions can be revoked
  - Rate limiting: 5 sign-in attempts per wallet per minute (in-memory window)
  - JWTs carry a session_id claim; require_wallet_auth validates the session
    is still alive before accepting the token
"""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.siws import SiwsNonceTable, WalletSessionTable
from app.models.user import User
from app.services.auth_service import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
    WalletVerificationError,
    InvalidTokenError,
    _user_to_response,
    create_access_token,
    create_refresh_token,
    decode_token,
)

logger = logging.getLogger(__name__)

SIWS_DOMAIN = "solfoundry.io"
SIWS_URI = "https://solfoundry.io"
SIWS_VERSION = "1"
SIWS_CHAIN_ID = "mainnet"
SIWS_NONCE_TTL_MINUTES = 10
SIWS_STATEMENT = "Welcome to SolFoundry. By signing, you confirm you own this wallet."

# ---------------------------------------------------------------------------
# In-memory rate-limit window: 5 sign-in attempts per wallet per 60 seconds
# ---------------------------------------------------------------------------

_RATE_LIMIT_MAX = 5
_RATE_LIMIT_WINDOW_SECS = 60
_rate_windows: dict[str, deque[datetime]] = defaultdict(deque)


class SiwsRateLimitError(Exception):
    """Raised when a wallet exceeds the sign-in rate limit."""


class SiwsNonceError(Exception):
    """Raised on nonce validation failures."""


def _check_rate_limit(wallet: str) -> None:
    """Raise SiwsRateLimitError if wallet has exceeded 5 attempts / 60s."""
    now = datetime.now(timezone.utc)
    window = _rate_windows[wallet.lower()]
    cutoff = now - timedelta(seconds=_RATE_LIMIT_WINDOW_SECS)

    # Evict timestamps outside the window
    while window and window[0] <= cutoff:
        window.popleft()

    if len(window) >= _RATE_LIMIT_MAX:
        raise SiwsRateLimitError(
            f"Too many sign-in attempts. Try again in {_RATE_LIMIT_WINDOW_SECS}s."
        )

    window.append(now)


def _reset_rate_limit(wallet: str) -> None:
    """Clear the rate-limit window for a wallet (test helper)."""
    _rate_windows.pop(wallet.lower(), None)


# ---------------------------------------------------------------------------
# SIWS message builder
# ---------------------------------------------------------------------------


def build_siws_message(wallet: str, nonce: str, issued_at: datetime) -> str:
    """Return the canonical SIWS message string."""
    expiration = issued_at + timedelta(minutes=SIWS_NONCE_TTL_MINUTES)
    return (
        f"{SIWS_DOMAIN} wants you to sign in with your Solana account:\n"
        f"{wallet}\n"
        f"\n"
        f"{SIWS_STATEMENT}\n"
        f"\n"
        f"URI: {SIWS_URI}\n"
        f"Version: {SIWS_VERSION}\n"
        f"Chain ID: {SIWS_CHAIN_ID}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at.isoformat()}\n"
        f"Expiration Time: {expiration.isoformat()}"
    )


def _parse_siws_nonce(message: str) -> Optional[str]:
    """Extract the Nonce field from a SIWS message."""
    for line in message.splitlines():
        if line.startswith("Nonce: "):
            return line[7:].strip()
    return None


# ---------------------------------------------------------------------------
# Signature verification (Ed25519 — Phantom / Solflare / Backpack compatible)
# ---------------------------------------------------------------------------


def verify_siws_signature(wallet: str, message: str, signature_b64: str) -> None:
    """
    Verify a base64-encoded Ed25519 signature over *message* bytes.

    All major Solana wallets (Phantom, Solflare, Backpack) sign the raw
    UTF-8 message bytes using Ed25519 and return a 64-byte signature.
    Raises WalletVerificationError on any failure.
    """
    from solders.pubkey import Pubkey
    from solders.signature import Signature

    try:
        pubkey = Pubkey.from_string(wallet)
    except Exception:
        raise WalletVerificationError(f"Invalid wallet address: {wallet!r}")

    try:
        sig_bytes = base64.b64decode(signature_b64)
    except Exception:
        raise WalletVerificationError("Signature is not valid base64")

    if len(sig_bytes) != 64:
        raise WalletVerificationError(
            f"Signature must be 64 bytes, got {len(sig_bytes)}"
        )

    try:
        sig = Signature(sig_bytes)
        result = sig.verify(pubkey, message.encode("utf-8"))
        if not result:
            raise WalletVerificationError("Signature verification failed")
    except WalletVerificationError:
        raise
    except Exception as exc:
        raise WalletVerificationError(f"Signature verification error: {exc}") from exc


# ---------------------------------------------------------------------------
# Nonce lifecycle (PostgreSQL-backed)
# ---------------------------------------------------------------------------


async def create_nonce(wallet: str) -> tuple[str, datetime]:
    """
    Generate a nonce, persist it to DB, and return (nonce, issued_at).
    Old expired nonces for this wallet are pruned at the same time.
    """
    nonce = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=SIWS_NONCE_TTL_MINUTES)

    async with get_db_session() as session:
        # Prune old nonces for this wallet
        from sqlalchemy import delete as sa_delete

        await session.execute(
            sa_delete(SiwsNonceTable).where(
                SiwsNonceTable.wallet_address == wallet.lower(),
                SiwsNonceTable.expires_at < now,
            )
        )
        row = SiwsNonceTable(
            nonce=nonce,
            wallet_address=wallet.lower(),
            issued_at=now,
            expires_at=expires_at,
            used=False,
        )
        session.add(row)
        await session.commit()

    return nonce, now


async def consume_nonce(nonce: str, wallet: str) -> None:
    """
    Validate and atomically consume a nonce.
    Raises SiwsNonceError if the nonce is unknown, expired, used, or
    belongs to a different wallet.
    """
    now = datetime.now(timezone.utc)

    async with get_db_session() as session:
        row = await session.get(SiwsNonceTable, nonce)
        if row is None:
            raise SiwsNonceError("Invalid or unknown nonce")
        if row.wallet_address != wallet.lower():
            raise SiwsNonceError("Nonce wallet mismatch")
        if row.used:
            raise SiwsNonceError("Nonce already used")
        if row.expires_at.replace(tzinfo=timezone.utc) < now:
            raise SiwsNonceError("Nonce expired")

        row.used = True
        await session.commit()


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session(
    wallet: str, user_id: str, access_token: str, refresh_token: str
) -> None:
    """Persist both access and refresh token hashes to wallet_sessions."""
    now = datetime.now(timezone.utc)
    async with get_db_session() as session:
        for token, token_type, expires_delta in [
            (
                access_token,
                "access",
                timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            ),
            (
                refresh_token,
                "refresh",
                timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            ),
        ]:
            row = WalletSessionTable(
                id=uuid4(),
                wallet_address=wallet.lower(),
                user_id=UUID(user_id),
                token_hash=_hash_token(token),
                token_type=token_type,
                created_at=now,
                expires_at=now + expires_delta,
                revoked=False,
            )
            session.add(row)
        await session.commit()


async def revoke_session(token: str) -> None:
    """Revoke a single token by hash."""
    token_hash = _hash_token(token)
    async with get_db_session() as session:
        result = await session.execute(
            select(WalletSessionTable).where(
                WalletSessionTable.token_hash == token_hash
            )
        )
        row = result.scalar_one_or_none()
        if row:
            row.revoked = True
            await session.commit()


async def revoke_all_sessions(wallet: str) -> None:
    """Revoke every active session for a wallet (e.g. on security incident)."""
    async with get_db_session() as session:
        from sqlalchemy import update as sa_update

        await session.execute(
            sa_update(WalletSessionTable)
            .where(
                WalletSessionTable.wallet_address == wallet.lower(),
                WalletSessionTable.revoked.is_(False),
            )
            .values(revoked=True)
        )
        await session.commit()


async def is_session_valid(token: str) -> bool:
    """Return True if the token has an active, non-revoked DB session."""
    token_hash = _hash_token(token)
    now = datetime.now(timezone.utc)
    async with get_db_session() as session:
        result = await session.execute(
            select(WalletSessionTable).where(
                WalletSessionTable.token_hash == token_hash,
                WalletSessionTable.revoked.is_(False),
                WalletSessionTable.expires_at > now,
            )
        )
        return result.scalar_one_or_none() is not None


# ---------------------------------------------------------------------------
# Main SIWS sign-in flow
# ---------------------------------------------------------------------------


async def get_siws_message(wallet: str) -> dict:
    """
    Step 1 — Generate a nonce-bound SIWS challenge message.
    Returns {message, nonce, issued_at, expires_at}.
    """
    nonce, issued_at = await create_nonce(wallet)
    message = build_siws_message(wallet, nonce, issued_at)
    return {
        "message": message,
        "nonce": nonce,
        "issued_at": issued_at.isoformat(),
        "expires_at": (
            issued_at + timedelta(minutes=SIWS_NONCE_TTL_MINUTES)
        ).isoformat(),
    }


async def siws_login(
    db: AsyncSession, wallet: str, signature: str, message: str
) -> dict:
    """
    Step 2 — Verify a signed SIWS message and return JWTs + user.

    1. Rate-limit check
    2. Signature verification
    3. Nonce extraction + consumption
    4. Upsert User row
    5. Persist session
    6. Return tokens
    """
    _check_rate_limit(wallet)

    # Verify signature first (cheap, no DB)
    verify_siws_signature(wallet, message, signature)

    # Extract and consume nonce
    nonce = _parse_siws_nonce(message)
    if not nonce:
        raise SiwsNonceError("SIWS message missing Nonce field")
    await consume_nonce(nonce, wallet)

    # Upsert user
    now = datetime.now(timezone.utc)
    result = await db.execute(select(User).where(User.wallet_address == wallet.lower()))
    user = result.scalar_one_or_none()

    if user:
        user.last_login_at = now
        user.updated_at = now
        user.wallet_verified = True
    else:
        user = User(
            github_id=f"siws_{wallet.lower()}",
            username=f"wallet_{wallet[:8].lower()}",
            wallet_address=wallet.lower(),
            wallet_verified=True,
            last_login_at=now,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    # Persist sessions
    await create_session(wallet, str(user.id), access_token, refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": _user_to_response(user),
    }


async def siws_refresh(db: AsyncSession, refresh_token: str) -> dict:
    """
    Exchange a valid, non-revoked refresh token for a new access token.
    The old refresh token session is revoked and a fresh one is written.
    """
    # Validate JWT
    user_id = decode_token(refresh_token, token_type="refresh")

    # Validate DB session
    if not await is_session_valid(refresh_token):
        raise InvalidTokenError("Refresh token has been revoked or expired")

    # Look up user + wallet
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise InvalidTokenError("User not found")

    # Revoke old refresh token
    await revoke_session(refresh_token)

    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)

    wallet = user.wallet_address or ""
    await create_session(wallet, user_id, new_access, new_refresh)

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
