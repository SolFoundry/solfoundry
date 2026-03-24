"""Wallet Connect backend wiring service.

This service implements the core wallet authentication and session management
logic for SolFoundry. All state is persisted in PostgreSQL — no in-memory
fallbacks. Security is fail-closed: any verification failure raises an
exception rather than silently degrading.

Key capabilities:
- SIWS (Sign-In With Solana) challenge generation with DB-persisted nonces
- Ed25519 signature verification supporting Phantom, Solflare, and Backpack
- JWT session creation with DB-tracked sessions for revocation
- Wallet-to-user linking with ownership proof
- Session lifecycle: create, refresh, revoke (individual + bulk)
- Rate limiting on auth endpoints (5 attempts per minute per IP/wallet)

PostgreSQL migration path:
    See migrations/002_wallet_connect.sql for the schema.
    Tables: wallet_links, auth_sessions, auth_challenges, auth_rate_limits
"""

import base64
import logging
import secrets
import uuid as uuid_mod
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List

from jose import jwt, JWTError
from solders.pubkey import Pubkey
from solders.signature import Signature
from sqlalchemy import select, update, delete, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth_session import (
    AuthChallenge,
    AuthSession,
    RateLimitRecord,
    SessionStatus,
)
from app.models.user import User, UserResponse
from app.models.wallet_link import WalletLink, WalletProvider
from app.services.auth_service import (
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

CHALLENGE_EXPIRE_MINUTES = 5
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_ATTEMPTS = 5
SIWS_DOMAIN = "solfoundry.org"


def _to_uuid(value: str) -> uuid_mod.UUID:
    """Convert a string to a UUID object for database operations.

    SQLAlchemy's generic Uuid type requires actual UUID objects, not strings.

    Args:
        value: A UUID string to convert.

    Returns:
        A uuid.UUID object.
    """
    if isinstance(value, uuid_mod.UUID):
        return value
    return uuid_mod.UUID(value)


# ---------------------------------------------------------------------------
# Typed exceptions (each maps to a specific HTTP status)
# ---------------------------------------------------------------------------


class WalletConnectError(Exception):
    """Base exception for wallet connect operations.

    All wallet connect errors inherit from this base class.
    Subclasses define the specific HTTP status code mapping.
    """

    pass


class ChallengeNotFoundError(WalletConnectError):
    """Raised when a nonce does not match any active challenge.

    HTTP status: 400 Bad Request.
    """

    pass


class ChallengeExpiredError(WalletConnectError):
    """Raised when a challenge nonce has expired (older than 5 minutes).

    HTTP status: 400 Bad Request.
    """

    pass


class ChallengeConsumedError(WalletConnectError):
    """Raised when a challenge nonce has already been used.

    Prevents replay attacks by ensuring single-use nonces.
    HTTP status: 400 Bad Request.
    """

    pass


class SignatureVerificationError(WalletConnectError):
    """Raised when Ed25519 signature verification fails.

    This covers invalid signatures, wrong wallet addresses,
    malformed signatures, and any cryptographic verification failure.
    HTTP status: 400 Bad Request.
    """

    pass


class WalletAlreadyLinkedError(WalletConnectError):
    """Raised when a wallet address is already linked to another user.

    Each wallet can only be linked to one user account.
    HTTP status: 409 Conflict.
    """

    pass


class WalletNotLinkedError(WalletConnectError):
    """Raised when attempting to unlink a wallet that is not linked.

    HTTP status: 404 Not Found.
    """

    pass


class SessionNotFoundError(WalletConnectError):
    """Raised when a session ID does not match any active session.

    HTTP status: 404 Not Found.
    """

    pass


class SessionRevokedError(WalletConnectError):
    """Raised when a revoked session token is used.

    HTTP status: 401 Unauthorized.
    """

    pass


class SessionExpiredError(WalletConnectError):
    """Raised when an expired session token is used.

    HTTP status: 401 Unauthorized.
    """

    pass


class TokenVerificationError(WalletConnectError):
    """Raised when JWT token verification fails.

    HTTP status: 401 Unauthorized.
    """

    pass


class RateLimitExceededError(WalletConnectError):
    """Raised when rate limit is exceeded (5 attempts per minute).

    HTTP status: 429 Too Many Requests.
    """

    pass


class UserNotFoundError(WalletConnectError):
    """Raised when the authenticated user is not found in the database.

    HTTP status: 404 Not Found.
    """

    pass


class WalletOwnershipError(WalletConnectError):
    """Raised when a user attempts to operate on a wallet they do not own.

    HTTP status: 403 Forbidden.
    """

    pass


# ---------------------------------------------------------------------------
# SIWS Challenge Generation
# ---------------------------------------------------------------------------


async def generate_siws_message(
    db: AsyncSession,
    wallet_address: str,
    provider: Optional[str] = None,
) -> Dict[str, object]:
    """Generate a SIWS (Sign-In With Solana) challenge message.

    Creates a nonce-bound challenge message that the wallet must sign to prove
    ownership. The challenge is persisted in PostgreSQL and expires after 5
    minutes. Each nonce is single-use to prevent replay attacks.

    Args:
        db: Async database session.
        wallet_address: The Solana wallet public key (base58-encoded).
        provider: Optional wallet provider name for logging.

    Returns:
        Dictionary containing:
            - message: The SIWS message to sign.
            - nonce: The challenge nonce (include when verifying).
            - expires_at: ISO timestamp when the challenge expires.

    Raises:
        SignatureVerificationError: If the wallet address format is invalid.
    """
    _validate_wallet_address(wallet_address)

    nonce = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CHALLENGE_EXPIRE_MINUTES)

    message = (
        f"{SIWS_DOMAIN} wants you to sign in with your Solana account:\n"
        f"{wallet_address}\n"
        f"\n"
        f"Sign this message to authenticate with SolFoundry.\n"
        f"\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {datetime.now(timezone.utc).isoformat()}\n"
        f"Expiration Time: {expires_at.isoformat()}"
    )

    challenge = AuthChallenge(
        nonce=nonce,
        wallet_address=wallet_address,
        message=message,
        expires_at=expires_at,
    )
    db.add(challenge)
    await db.commit()

    logger.info(
        "SIWS challenge generated for wallet=%s provider=%s nonce=%s",
        wallet_address[:8],
        provider or "unknown",
        nonce[:8],
    )

    return {
        "message": message,
        "nonce": nonce,
        "expires_at": expires_at,
    }


# ---------------------------------------------------------------------------
# Signature Verification
# ---------------------------------------------------------------------------


def _validate_wallet_address(wallet_address: str) -> None:
    """Validate that a wallet address is a valid Solana public key.

    Attempts to parse the address using solders to ensure it is a valid
    base58-encoded Ed25519 public key.

    Args:
        wallet_address: The wallet address to validate.

    Raises:
        SignatureVerificationError: If the address is not a valid Solana public key.
    """
    if not wallet_address or len(wallet_address) < 32 or len(wallet_address) > 48:
        raise SignatureVerificationError(
            f"Invalid wallet address length: {len(wallet_address) if wallet_address else 0}"
        )
    try:
        Pubkey.from_string(wallet_address)
    except Exception as exc:
        raise SignatureVerificationError(
            f"Invalid Solana wallet address: {exc}"
        ) from exc


def verify_ed25519_signature(
    wallet_address: str,
    message: str,
    signature_b64: str,
    provider: Optional[str] = None,
) -> bool:
    """Verify an Ed25519 signature from a Solana wallet.

    Supports signature formats from Phantom, Solflare, and Backpack wallets.
    All three use standard Ed25519 signatures, but may encode them differently:
    - Base64 encoding (standard, all wallets)
    - Base58 encoding (Phantom legacy format, auto-detected)

    This function is fail-closed: any verification failure raises an exception.

    Args:
        wallet_address: The Solana wallet public key (base58-encoded).
        message: The message that was signed (UTF-8 string).
        signature_b64: The signature, either base64 or base58 encoded.
        provider: Optional wallet provider for logging/format hints.

    Returns:
        True if the signature is valid.

    Raises:
        SignatureVerificationError: If verification fails for any reason.
    """
    _validate_wallet_address(wallet_address)

    try:
        pubkey = Pubkey.from_string(wallet_address)
    except Exception as exc:
        raise SignatureVerificationError(f"Invalid public key: {exc}") from exc

    sig_bytes = _decode_signature(signature_b64, provider)

    if len(sig_bytes) != 64:
        raise SignatureVerificationError(
            f"Invalid signature length: expected 64 bytes, got {len(sig_bytes)}"
        )

    try:
        sig = Signature(sig_bytes)
        is_valid = sig.verify(pubkey, message.encode("utf-8"))
        if not is_valid:
            raise SignatureVerificationError(
                "Ed25519 signature verification failed: signature does not match"
            )
        return True
    except SignatureVerificationError:
        raise
    except Exception as exc:
        raise SignatureVerificationError(
            f"Ed25519 signature verification failed: {exc}"
        ) from exc


def _decode_signature(signature_encoded: str, provider: Optional[str] = None) -> bytes:
    """Decode a wallet signature from base64 or base58 encoding.

    Tries base64 first (standard), then falls back to base58 for compatibility
    with wallets that use that encoding. Fail-closed: raises an exception if
    neither encoding produces valid bytes.

    Args:
        signature_encoded: The encoded signature string.
        provider: Optional wallet provider hint for format selection.

    Returns:
        The decoded signature bytes (should be 64 bytes for Ed25519).

    Raises:
        SignatureVerificationError: If the signature cannot be decoded.
    """
    # Try base64 first (most common)
    try:
        decoded = base64.b64decode(signature_encoded)
        if len(decoded) == 64:
            return decoded
    except Exception:
        pass

    # Try base58 (Phantom legacy, some wallets)
    try:
        import base58
        decoded = base58.b58decode(signature_encoded)
        if len(decoded) == 64:
            return decoded
    except ImportError:
        # base58 not installed — skip this fallback
        pass
    except Exception:
        pass

    # Last resort: re-try base64 without length check
    try:
        return base64.b64decode(signature_encoded)
    except Exception as exc:
        raise SignatureVerificationError(
            f"Cannot decode signature (tried base64, base58): {exc}"
        ) from exc


# ---------------------------------------------------------------------------
# Challenge Verification (DB-backed, single-use nonces)
# ---------------------------------------------------------------------------


async def verify_challenge(
    db: AsyncSession,
    nonce: str,
    wallet_address: str,
    message: str,
) -> None:
    """Verify and consume a SIWS challenge nonce.

    Checks that the nonce exists, has not expired, has not been consumed,
    and matches the provided wallet address and message. The challenge is
    consumed (marked as used) atomically to prevent replay attacks.

    This function is fail-closed: any verification failure raises an exception.

    Args:
        db: Async database session.
        nonce: The challenge nonce to verify.
        wallet_address: The wallet address that should match the challenge.
        message: The message that should match the challenge.

    Raises:
        ChallengeNotFoundError: If the nonce does not exist.
        ChallengeExpiredError: If the challenge has expired.
        ChallengeConsumedError: If the challenge was already used.
        SignatureVerificationError: If wallet or message does not match.
    """
    if not nonce:
        raise ChallengeNotFoundError("Missing nonce")

    result = await db.execute(
        select(AuthChallenge).where(AuthChallenge.nonce == nonce)
    )
    challenge = result.scalar_one_or_none()

    if not challenge:
        raise ChallengeNotFoundError(f"No challenge found for nonce: {nonce[:8]}...")

    if challenge.consumed:
        raise ChallengeConsumedError("Challenge nonce has already been used")

    now = datetime.now(timezone.utc)
    # Handle both timezone-aware and naive datetimes (SQLite stores naive)
    expires_at = challenge.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        # Mark as consumed to prevent future lookups
        challenge.consumed = True
        await db.commit()
        raise ChallengeExpiredError("Challenge has expired")

    if challenge.wallet_address != wallet_address:
        raise SignatureVerificationError(
            "Wallet address does not match challenge"
        )

    if challenge.message != message:
        raise SignatureVerificationError(
            "Message does not match challenge"
        )

    # Consume the challenge atomically
    challenge.consumed = True
    await db.commit()

    logger.info("Challenge verified and consumed: nonce=%s", nonce[:8])


# ---------------------------------------------------------------------------
# Session Management (create, refresh, revoke)
# ---------------------------------------------------------------------------


def _create_jwt_tokens(
    user_id: str,
) -> Dict[str, str]:
    """Create a paired access + refresh JWT token set.

    Both tokens include a unique jti claim for session tracking and
    revocation. The access token expires after ACCESS_TOKEN_EXPIRE_MINUTES
    and the refresh token after REFRESH_TOKEN_EXPIRE_DAYS.

    Args:
        user_id: The user UUID to encode in the token subject.

    Returns:
        Dictionary containing:
            - access_token: JWT access token string.
            - refresh_token: JWT refresh token string.
            - access_jti: Token ID for the access token.
            - refresh_jti: Token ID for the refresh token.
            - access_expires_at: Access token expiration datetime.
            - refresh_expires_at: Refresh token expiration datetime.
    """
    now = datetime.now(timezone.utc)
    access_jti = secrets.token_urlsafe(16)
    refresh_jti = secrets.token_urlsafe(16)

    access_expires = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_expires = now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    access_payload = {
        "sub": user_id,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(access_expires.timestamp()),
        "jti": access_jti,
    }
    refresh_payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int(refresh_expires.timestamp()),
        "jti": refresh_jti,
    }

    return {
        "access_token": jwt.encode(access_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM),
        "refresh_token": jwt.encode(refresh_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM),
        "access_jti": access_jti,
        "refresh_jti": refresh_jti,
        "access_expires_at": access_expires,
        "refresh_expires_at": refresh_expires,
    }


async def create_session(
    db: AsyncSession,
    user_id: str,
    wallet_address: Optional[str] = None,
    provider: str = "unknown",
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Dict[str, object]:
    """Create a new authenticated session with JWT tokens.

    Generates access + refresh tokens and persists the session in PostgreSQL
    for tracking and revocation. The session record links the JWT token IDs
    (jti) to the user for lookup during token validation.

    Args:
        db: Async database session.
        user_id: The authenticated user's UUID.
        wallet_address: The wallet used for authentication (null for GitHub).
        provider: The auth provider (wallet name or 'github').
        ip_address: Client IP address for audit logging.
        user_agent: Client User-Agent for audit logging.

    Returns:
        Dictionary containing:
            - access_token: JWT access token.
            - refresh_token: JWT refresh token.
            - token_type: Always 'bearer'.
            - expires_in: Access token lifetime in seconds.
            - session_id: UUID of the created session.
    """
    tokens = _create_jwt_tokens(user_id)

    session = AuthSession(
        user_id=_to_uuid(user_id),
        token_id=tokens["access_jti"],
        refresh_token_id=tokens["refresh_jti"],
        wallet_address=wallet_address,
        provider=provider,
        ip_address=ip_address,
        user_agent=user_agent,
        status=SessionStatus.ACTIVE.value,
        expires_at=tokens["access_expires_at"],
        refresh_expires_at=tokens["refresh_expires_at"],
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    logger.info(
        "Session created: session_id=%s user_id=%s provider=%s",
        str(session.id),
        user_id[:8],
        provider,
    )

    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "session_id": str(session.id),
    }


async def refresh_session(
    db: AsyncSession,
    refresh_token: str,
) -> Dict[str, object]:
    """Refresh a session using a refresh token.

    Validates the refresh token, checks that the associated session is still
    active, generates a new access token, and updates the session record
    with the new token ID.

    Args:
        db: Async database session.
        refresh_token: The JWT refresh token to use.

    Returns:
        Dictionary containing:
            - access_token: New JWT access token.
            - token_type: Always 'bearer'.
            - expires_in: New access token lifetime in seconds.

    Raises:
        TokenVerificationError: If the refresh token is invalid or expired.
        SessionRevokedError: If the session has been revoked.
        SessionNotFoundError: If no session matches the refresh token.
        UserNotFoundError: If the user no longer exists.
    """
    # Decode the refresh token
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise TokenVerificationError("Expected refresh token")
        user_id = payload.get("sub")
        refresh_jti = payload.get("jti")
        if not user_id or not refresh_jti:
            raise TokenVerificationError("Invalid refresh token claims")
    except JWTError as exc:
        if "expired" in str(exc).lower():
            raise SessionExpiredError("Refresh token has expired") from exc
        raise TokenVerificationError(f"Invalid refresh token: {exc}") from exc

    # Look up the session by refresh token ID
    result = await db.execute(
        select(AuthSession).where(AuthSession.refresh_token_id == refresh_jti)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise SessionNotFoundError("No session found for this refresh token")

    if session.status == SessionStatus.REVOKED.value:
        raise SessionRevokedError("Session has been revoked")

    if session.status == SessionStatus.EXPIRED.value:
        raise SessionExpiredError("Session has expired")

    # Verify the user still exists
    user_result = await db.execute(
        select(User).where(User.id == _to_uuid(user_id))
    )
    if not user_result.scalar_one_or_none():
        raise UserNotFoundError("User not found")

    # Generate new access token with new jti
    now = datetime.now(timezone.utc)
    new_access_jti = secrets.token_urlsafe(16)
    access_expires = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    new_access_payload = {
        "sub": user_id,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(access_expires.timestamp()),
        "jti": new_access_jti,
    }
    new_access_token = jwt.encode(
        new_access_payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM
    )

    # Update session with new access token ID
    session.token_id = new_access_jti
    session.expires_at = access_expires
    await db.commit()

    logger.info("Session refreshed: session_id=%s", str(session.id))

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


async def revoke_session(
    db: AsyncSession,
    session_id: str,
    user_id: str,
) -> None:
    """Revoke a specific session.

    Only the session owner can revoke their own sessions. The session status
    is set to REVOKED and a revoked_at timestamp is recorded.

    Args:
        db: Async database session.
        session_id: UUID of the session to revoke.
        user_id: UUID of the requesting user (for ownership check).

    Raises:
        SessionNotFoundError: If no session matches the ID.
        WalletOwnershipError: If the user does not own the session.
    """
    try:
        session_uuid = _to_uuid(session_id)
    except (ValueError, AttributeError):
        raise SessionNotFoundError(f"Invalid session ID format: {session_id}")

    result = await db.execute(
        select(AuthSession).where(AuthSession.id == session_uuid)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise SessionNotFoundError(f"Session not found: {session_id}")

    if str(session.user_id) != user_id:
        raise WalletOwnershipError("Cannot revoke another user's session")

    now = datetime.now(timezone.utc)
    session.status = SessionStatus.REVOKED.value
    session.revoked_at = now
    await db.commit()

    logger.info("Session revoked: session_id=%s user_id=%s", session_id, user_id[:8])


async def revoke_all_sessions(
    db: AsyncSession,
    user_id: str,
) -> int:
    """Revoke all active sessions for a user.

    This is a bulk operation that invalidates every active session the user
    has. Useful for security incidents or password changes.

    Args:
        db: Async database session.
        user_id: UUID of the user whose sessions to revoke.

    Returns:
        The number of sessions that were revoked.
    """
    now = datetime.now(timezone.utc)
    user_uuid = _to_uuid(user_id)
    result = await db.execute(
        update(AuthSession)
        .where(
            and_(
                AuthSession.user_id == user_uuid,
                AuthSession.status == SessionStatus.ACTIVE.value,
            )
        )
        .values(status=SessionStatus.REVOKED.value, revoked_at=now)
    )
    await db.commit()

    revoked_count = result.rowcount
    logger.info(
        "All sessions revoked: user_id=%s count=%d", user_id[:8], revoked_count
    )
    return revoked_count


async def list_sessions(
    db: AsyncSession,
    user_id: str,
) -> List[Dict[str, object]]:
    """List all sessions for a user.

    Returns active and recently revoked sessions for the user, ordered by
    creation time (newest first). Expired sessions older than 7 days are
    excluded.

    Args:
        db: Async database session.
        user_id: UUID of the user whose sessions to list.

    Returns:
        List of session dictionaries with id, status, provider, etc.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    user_uuid = _to_uuid(user_id)
    result = await db.execute(
        select(AuthSession)
        .where(
            and_(
                AuthSession.user_id == user_uuid,
                AuthSession.created_at >= cutoff,
            )
        )
        .order_by(AuthSession.created_at.desc())
    )
    sessions = result.scalars().all()

    return [
        {
            "id": str(s.id),
            "wallet_address": s.wallet_address,
            "provider": s.provider,
            "ip_address": s.ip_address,
            "status": s.status,
            "created_at": s.created_at,
            "expires_at": s.expires_at,
        }
        for s in sessions
    ]


# ---------------------------------------------------------------------------
# Session Validation (middleware support)
# ---------------------------------------------------------------------------


async def validate_session_token(
    db: AsyncSession,
    token: str,
) -> str:
    """Validate a JWT access token and check session status.

    Decodes the JWT, extracts the token ID (jti), looks up the session in
    PostgreSQL, and verifies it is still active. This is the core function
    used by the auth middleware for protected routes.

    Fail-closed: any failure raises an exception.

    Args:
        db: Async database session.
        token: JWT access token string.

    Returns:
        The authenticated user ID (UUID string).

    Raises:
        TokenVerificationError: If the JWT is invalid.
        SessionExpiredError: If the token or session has expired.
        SessionRevokedError: If the session has been revoked.
        SessionNotFoundError: If no session matches the token.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise TokenVerificationError("Expected access token")
        user_id = payload.get("sub")
        token_jti = payload.get("jti")
        if not user_id or not token_jti:
            raise TokenVerificationError("Invalid token claims")
    except JWTError as exc:
        if "expired" in str(exc).lower():
            raise SessionExpiredError("Access token has expired") from exc
        raise TokenVerificationError(f"Invalid access token: {exc}") from exc

    # Check session status in DB
    result = await db.execute(
        select(AuthSession).where(AuthSession.token_id == token_jti)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise SessionNotFoundError("No active session for this token")

    if session.status == SessionStatus.REVOKED.value:
        raise SessionRevokedError("Session has been revoked")

    now = datetime.now(timezone.utc)
    # Handle both timezone-aware and naive datetimes (SQLite stores naive)
    session_expires = session.expires_at
    if session_expires.tzinfo is None:
        session_expires = session_expires.replace(tzinfo=timezone.utc)
    if session.status == SessionStatus.EXPIRED.value or now > session_expires:
        raise SessionExpiredError("Session has expired")

    return user_id


# ---------------------------------------------------------------------------
# SIWS Verification + Authentication (full flow)
# ---------------------------------------------------------------------------


def _user_to_response(user: User) -> UserResponse:
    """Convert a User ORM object to a UserResponse Pydantic model.

    Args:
        user: The SQLAlchemy User instance.

    Returns:
        A UserResponse Pydantic model with serialized fields.
    """
    return UserResponse(
        id=str(user.id),
        github_id=user.github_id,
        username=user.username,
        email=user.email,
        avatar_url=user.avatar_url,
        wallet_address=user.wallet_address,
        wallet_verified=user.wallet_verified,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def siws_verify_and_authenticate(
    db: AsyncSession,
    wallet_address: str,
    signature: str,
    message: str,
    nonce: str,
    provider: str = "unknown",
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Dict[str, object]:
    """Complete SIWS verification and authentication flow.

    This is the main entry point for wallet-based authentication. It:
    1. Verifies the challenge nonce (DB-backed, single-use)
    2. Verifies the Ed25519 signature
    3. Finds or creates the user account
    4. Creates a new session with JWT tokens

    All steps are fail-closed: any failure raises a typed exception.

    Args:
        db: Async database session.
        wallet_address: The Solana wallet that signed the message.
        signature: Base64-encoded Ed25519 signature.
        message: The exact SIWS challenge message that was signed.
        nonce: The challenge nonce for replay protection.
        provider: The wallet provider (phantom, solflare, backpack).
        ip_address: Client IP for session tracking.
        user_agent: Client User-Agent for session tracking.

    Returns:
        Dictionary containing access_token, refresh_token, session_id, user.

    Raises:
        ChallengeNotFoundError: If the nonce is invalid.
        ChallengeExpiredError: If the challenge has expired.
        ChallengeConsumedError: If the nonce was already used.
        SignatureVerificationError: If the signature is invalid.
    """
    # Step 1: Verify the challenge (consumes the nonce)
    await verify_challenge(db, nonce, wallet_address, message)

    # Step 2: Verify the Ed25519 signature
    verify_ed25519_signature(wallet_address, message, signature, provider)

    # Step 3: Find or create user
    result = await db.execute(
        select(User).where(User.wallet_address == wallet_address)
    )
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if user:
        user.last_login_at = now
        user.updated_at = now
        user.wallet_verified = True
    else:
        user = User(
            github_id=f"wallet_{wallet_address[:16]}",
            username=f"wallet_{wallet_address[:8]}",
            wallet_address=wallet_address,
            wallet_verified=True,
            last_login_at=now,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)

    # Step 4: Create session
    session_data = await create_session(
        db,
        user_id=str(user.id),
        wallet_address=wallet_address,
        provider=provider,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    session_data["user"] = _user_to_response(user)

    logger.info(
        "SIWS authentication successful: wallet=%s user_id=%s",
        wallet_address[:8],
        str(user.id)[:8],
    )

    return session_data


# ---------------------------------------------------------------------------
# Wallet Linking
# ---------------------------------------------------------------------------


async def link_wallet(
    db: AsyncSession,
    user_id: str,
    wallet_address: str,
    signature: str,
    message: str,
    nonce: str,
    provider: str = "unknown",
    label: Optional[str] = None,
    is_primary: bool = False,
) -> Dict[str, object]:
    """Link a Solana wallet to an existing user account.

    Verifies the SIWS challenge and Ed25519 signature, then creates a
    WalletLink record. Each wallet can only be linked to one user.
    Also updates the User.wallet_address field for backward compatibility.

    Args:
        db: Async database session.
        user_id: UUID of the authenticated user.
        wallet_address: The wallet to link.
        signature: Base64-encoded Ed25519 signature.
        message: The SIWS challenge message.
        nonce: The challenge nonce.
        provider: Wallet provider name.
        label: Optional friendly label for the wallet.
        is_primary: Whether to set this as the primary wallet.

    Returns:
        Dictionary with the created WalletLink details.

    Raises:
        ChallengeNotFoundError: If the nonce is invalid.
        SignatureVerificationError: If the signature is invalid.
        WalletAlreadyLinkedError: If the wallet is linked to another user.
        UserNotFoundError: If the user does not exist.
    """
    # Verify challenge and signature
    await verify_challenge(db, nonce, wallet_address, message)
    verify_ed25519_signature(wallet_address, message, signature, provider)

    # Check if wallet is already linked to another user
    result = await db.execute(
        select(WalletLink).where(WalletLink.wallet_address == wallet_address)
    )
    existing = result.scalar_one_or_none()
    if existing and str(existing.user_id) != user_id:
        raise WalletAlreadyLinkedError(
            f"Wallet {wallet_address[:8]}... is already linked to another account"
        )
    if existing and str(existing.user_id) == user_id:
        # Already linked to this user — return existing
        return {
            "id": str(existing.id),
            "user_id": str(existing.user_id),
            "wallet_address": existing.wallet_address,
            "provider": existing.provider,
            "label": existing.label,
            "is_primary": existing.is_primary,
            "verified_at": existing.verified_at,
            "created_at": existing.created_at,
        }

    # Verify user exists
    user_uuid = _to_uuid(user_id)
    user_result = await db.execute(select(User).where(User.id == user_uuid))
    user = user_result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError(f"User not found: {user_id[:8]}...")

    # If is_primary, unset any existing primary wallet for this user
    if is_primary:
        await db.execute(
            update(WalletLink)
            .where(
                and_(
                    WalletLink.user_id == user_uuid,
                    WalletLink.is_primary == True,  # noqa: E712
                )
            )
            .values(is_primary=False)
        )

    now = datetime.now(timezone.utc)
    wallet_link = WalletLink(
        user_id=user_uuid,
        wallet_address=wallet_address,
        provider=provider,
        label=label,
        is_primary=is_primary,
        verified_at=now,
    )
    db.add(wallet_link)

    # Also update User.wallet_address for backward compatibility
    user.wallet_address = wallet_address
    user.wallet_verified = True
    user.updated_at = now

    await db.commit()
    await db.refresh(wallet_link)

    logger.info(
        "Wallet linked: user_id=%s wallet=%s provider=%s",
        user_id[:8],
        wallet_address[:8],
        provider,
    )

    return {
        "id": str(wallet_link.id),
        "user_id": str(wallet_link.user_id),
        "wallet_address": wallet_link.wallet_address,
        "provider": wallet_link.provider,
        "label": wallet_link.label,
        "is_primary": wallet_link.is_primary,
        "verified_at": wallet_link.verified_at,
        "created_at": wallet_link.created_at,
    }


async def unlink_wallet(
    db: AsyncSession,
    user_id: str,
    wallet_address: str,
) -> None:
    """Unlink a wallet from a user account.

    Only the wallet owner can unlink their wallet. If the unlinked wallet
    was the user's primary wallet on the User model, that field is cleared.

    Args:
        db: Async database session.
        user_id: UUID of the authenticated user.
        wallet_address: The wallet address to unlink.

    Raises:
        WalletNotLinkedError: If the wallet is not linked.
        WalletOwnershipError: If the user does not own this wallet link.
    """
    result = await db.execute(
        select(WalletLink).where(WalletLink.wallet_address == wallet_address)
    )
    link = result.scalar_one_or_none()

    if not link:
        raise WalletNotLinkedError(f"Wallet {wallet_address[:8]}... is not linked")

    if str(link.user_id) != user_id:
        raise WalletOwnershipError("Cannot unlink another user's wallet")

    await db.execute(
        delete(WalletLink).where(WalletLink.wallet_address == wallet_address)
    )

    # Clear user's wallet_address if it matches
    user_uuid = _to_uuid(user_id)
    user_result = await db.execute(select(User).where(User.id == user_uuid))
    user = user_result.scalar_one_or_none()
    if user and user.wallet_address == wallet_address:
        user.wallet_address = None
        user.wallet_verified = False
        user.updated_at = datetime.now(timezone.utc)

    await db.commit()

    logger.info(
        "Wallet unlinked: user_id=%s wallet=%s", user_id[:8], wallet_address[:8]
    )


async def list_user_wallets(
    db: AsyncSession,
    user_id: str,
) -> List[Dict[str, object]]:
    """List all wallets linked to a user.

    Args:
        db: Async database session.
        user_id: UUID of the user.

    Returns:
        List of wallet link dictionaries.
    """
    user_uuid = _to_uuid(user_id)
    result = await db.execute(
        select(WalletLink)
        .where(WalletLink.user_id == user_uuid)
        .order_by(WalletLink.created_at.desc())
    )
    links = result.scalars().all()

    return [
        {
            "id": str(link.id),
            "user_id": str(link.user_id),
            "wallet_address": link.wallet_address,
            "provider": link.provider,
            "label": link.label,
            "is_primary": link.is_primary,
            "verified_at": link.verified_at,
            "created_at": link.created_at,
        }
        for link in links
    ]


async def set_primary_wallet(
    db: AsyncSession,
    user_id: str,
    wallet_address: str,
) -> None:
    """Set a wallet as the primary wallet for a user.

    The primary wallet is used for payout disbursements. Only wallets
    already linked to the user can be set as primary.

    Args:
        db: Async database session.
        user_id: UUID of the authenticated user.
        wallet_address: The wallet address to set as primary.

    Raises:
        WalletNotLinkedError: If the wallet is not linked to this user.
        WalletOwnershipError: If the user does not own this wallet.
    """
    result = await db.execute(
        select(WalletLink).where(WalletLink.wallet_address == wallet_address)
    )
    link = result.scalar_one_or_none()

    if not link:
        raise WalletNotLinkedError(f"Wallet {wallet_address[:8]}... is not linked")

    if str(link.user_id) != user_id:
        raise WalletOwnershipError("Cannot modify another user's wallet")

    # Unset all primary flags for this user
    user_uuid = _to_uuid(user_id)
    await db.execute(
        update(WalletLink)
        .where(
            and_(
                WalletLink.user_id == user_uuid,
                WalletLink.is_primary == True,  # noqa: E712
            )
        )
        .values(is_primary=False)
    )

    # Set the target wallet as primary
    link.is_primary = True

    # Also update User.wallet_address for backward compatibility
    user_result = await db.execute(select(User).where(User.id == user_uuid))
    user = user_result.scalar_one_or_none()
    if user:
        user.wallet_address = wallet_address
        user.updated_at = datetime.now(timezone.utc)

    await db.commit()

    logger.info(
        "Primary wallet set: user_id=%s wallet=%s", user_id[:8], wallet_address[:8]
    )


# ---------------------------------------------------------------------------
# Rate Limiting (DB-backed, sliding window)
# ---------------------------------------------------------------------------


async def check_rate_limit(
    db: AsyncSession,
    identifier: str,
    endpoint: str,
) -> None:
    """Check and enforce rate limiting for authentication endpoints.

    Uses a sliding window of RATE_LIMIT_WINDOW_SECONDS (60s) with a maximum
    of RATE_LIMIT_MAX_ATTEMPTS (5) attempts. The rate limit is tracked per
    identifier (IP address or wallet address) and endpoint combination.

    This is fail-closed: exceeding the limit raises an exception.

    Args:
        db: Async database session.
        identifier: The entity to rate-limit (IP or wallet address).
        endpoint: The endpoint name being rate-limited.

    Raises:
        RateLimitExceededError: If the rate limit is exceeded.
    """
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW_SECONDS)

    # Count attempts in the current window
    result = await db.execute(
        select(func.count(RateLimitRecord.id)).where(
            and_(
                RateLimitRecord.identifier == identifier,
                RateLimitRecord.endpoint == endpoint,
                RateLimitRecord.attempt_at >= window_start,
            )
        )
    )
    attempt_count = result.scalar() or 0

    if attempt_count >= RATE_LIMIT_MAX_ATTEMPTS:
        raise RateLimitExceededError(
            f"Rate limit exceeded: {RATE_LIMIT_MAX_ATTEMPTS} attempts per "
            f"{RATE_LIMIT_WINDOW_SECONDS} seconds. Try again later."
        )

    # Record this attempt
    record = RateLimitRecord(
        identifier=identifier,
        endpoint=endpoint,
        attempt_at=now,
    )
    db.add(record)
    await db.commit()


async def cleanup_expired_challenges(db: AsyncSession) -> int:
    """Clean up expired authentication challenges.

    Removes challenges that are older than 1 hour. This should be called
    periodically (e.g., every hour) to prevent table bloat.

    Args:
        db: Async database session.

    Returns:
        The number of challenges deleted.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    result = await db.execute(
        delete(AuthChallenge).where(AuthChallenge.expires_at < cutoff)
    )
    await db.commit()
    return result.rowcount


async def cleanup_expired_rate_limits(db: AsyncSession) -> int:
    """Clean up old rate limit records.

    Removes rate limit records older than 5 minutes. This prevents the
    rate limit table from growing unbounded.

    Args:
        db: Async database session.

    Returns:
        The number of records deleted.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    result = await db.execute(
        delete(RateLimitRecord).where(RateLimitRecord.attempt_at < cutoff)
    )
    await db.commit()
    return result.rowcount


# ---------------------------------------------------------------------------
# Wallet ownership verification for middleware
# ---------------------------------------------------------------------------


async def verify_wallet_ownership(
    db: AsyncSession,
    user_id: str,
    wallet_address: str,
) -> bool:
    """Verify that a user owns a specific wallet address.

    Used by the auth middleware to enforce wallet ownership on protected
    routes that require a specific wallet.

    Args:
        db: Async database session.
        user_id: UUID of the authenticated user.
        wallet_address: The wallet address to verify ownership of.

    Returns:
        True if the user owns the wallet.

    Raises:
        WalletOwnershipError: If the user does not own the wallet.
    """
    # Check wallet_links table first
    user_uuid = _to_uuid(user_id)
    result = await db.execute(
        select(WalletLink).where(
            and_(
                WalletLink.user_id == user_uuid,
                WalletLink.wallet_address == wallet_address,
            )
        )
    )
    if result.scalar_one_or_none():
        return True

    # Fallback: check User.wallet_address for backward compatibility
    user_result = await db.execute(
        select(User).where(
            and_(
                User.id == user_uuid,
                User.wallet_address == wallet_address,
            )
        )
    )
    if user_result.scalar_one_or_none():
        return True

    raise WalletOwnershipError(
        f"User {user_id[:8]}... does not own wallet {wallet_address[:8]}..."
    )
