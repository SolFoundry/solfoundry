"""Sign-In With Solana (SIWS) session management service.

Implements the full SIWS authentication flow with PostgreSQL-backed
nonce and session persistence:

1. **Challenge**: Generate a SIWS-standard message with domain, address,
   nonce, issued-at, and expiration fields. Store the nonce in PostgreSQL
   to prevent replay attacks.
2. **Verify**: Validate the signed message against the wallet's public key,
   consume the nonce (mark as used), and check for expiration.
3. **Session**: Issue JWT access (24h) and refresh (7d) tokens, persist
   the session with token hashes in the ``wallet_sessions`` table.
4. **Refresh**: Exchange a valid refresh token for a new access token
   without requiring a new wallet signature.
5. **Revoke**: Invalidate sessions on logout or security events.

Supports Phantom, Solflare, and Backpack wallet signature formats
(all use Ed25519 over the raw message bytes).

Rate limiting (5 attempts per wallet per minute) is enforced at the
service layer using a sliding-window counter backed by an in-memory
dict with PostgreSQL audit logging.

References:
    - SIWS Standard: https://github.com/phantom/sign-in-with-solana
    - CAIP-122: https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-122.md
    - OWASP Session Management Cheat Sheet
"""

import base64
import hashlib
import logging
import os
import secrets
import time
import threading
import uuid as uuid_module
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from jose import jwt, JWTError
from solders.pubkey import Pubkey
from solders.signature import Signature
from sqlalchemy import select, update, delete, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_event
from app.models.user import User
from app.models.wallet_session import WalletNonceDB, WalletSessionDB

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SIWS_DOMAIN = os.getenv("SIWS_DOMAIN", "solfoundry.org")
SIWS_NONCE_EXPIRY_MINUTES = int(os.getenv("SIWS_NONCE_EXPIRY_MINUTES", "5"))
SIWS_SESSION_EXPIRY_HOURS = int(os.getenv("SIWS_SESSION_EXPIRY_HOURS", "24"))
SIWS_REFRESH_EXPIRY_DAYS = int(os.getenv("SIWS_REFRESH_EXPIRY_DAYS", "7"))

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or secrets.token_urlsafe(32)
JWT_ALGORITHM = "HS256"

# Rate limiting: 5 sign-in attempts per wallet per minute
SIWS_RATE_LIMIT_MAX_ATTEMPTS = int(os.getenv("SIWS_RATE_LIMIT_MAX", "5"))
SIWS_RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("SIWS_RATE_LIMIT_WINDOW", "60"))


# ---------------------------------------------------------------------------
# Typed Exceptions
# ---------------------------------------------------------------------------


class SIWSError(Exception):
    """Base exception for all SIWS authentication errors.

    All SIWS-specific exceptions inherit from this class so callers can
    catch the entire family with ``except SIWSError``.
    """

    pass


class NonceExpiredError(SIWSError):
    """Raised when the SIWS nonce has passed its expiration time.

    This indicates the user took too long to sign the challenge message
    and must request a new one.
    """

    pass


class NonceAlreadyUsedError(SIWSError):
    """Raised when an already-consumed nonce is presented again.

    This is a replay attack indicator. The nonce was valid once but has
    already been used to complete an authentication.
    """

    pass


class NonceNotFoundError(SIWSError):
    """Raised when the presented nonce does not exist in the database.

    The nonce may have been fabricated or may have been cleaned up
    after expiration.
    """

    pass


class WalletMismatchError(SIWSError):
    """Raised when the wallet address in the signed message does not
    match the wallet address that requested the nonce.
    """

    pass


class MessageMismatchError(SIWSError):
    """Raised when the message presented for verification does not
    match the message stored with the nonce.
    """

    pass


class SignatureVerificationError(SIWSError):
    """Raised when the Ed25519 signature fails cryptographic verification.

    This means the message was not signed by the private key corresponding
    to the claimed wallet public key.
    """

    pass


class InvalidWalletAddressError(SIWSError):
    """Raised when the wallet address is not a valid Solana public key.

    Valid Solana addresses are base58-encoded Ed25519 public keys,
    typically 32-44 characters long.
    """

    pass


class SessionExpiredError(SIWSError):
    """Raised when the JWT session token has expired beyond its 24-hour window."""

    pass


class SessionRevokedError(SIWSError):
    """Raised when a session has been explicitly revoked (e.g., on logout)."""

    pass


class RefreshTokenExpiredError(SIWSError):
    """Raised when the refresh token has expired beyond its 7-day window."""

    pass


class InvalidRefreshTokenError(SIWSError):
    """Raised when the refresh token is malformed or not found in the database."""

    pass


class RateLimitExceededError(SIWSError):
    """Raised when a wallet exceeds the sign-in attempt rate limit.

    Attributes:
        retry_after: Number of seconds until the rate limit resets.
    """

    def __init__(self, message: str, retry_after: int = 0) -> None:
        """Initialize with the rate limit message and retry-after duration.

        Args:
            message: Human-readable description of the rate limit.
            retry_after: Seconds until the client can retry.
        """
        super().__init__(message)
        self.retry_after = retry_after


# ---------------------------------------------------------------------------
# Rate Limiter (sliding window per wallet)
# ---------------------------------------------------------------------------


class WalletRateLimiter:
    """Sliding-window rate limiter for wallet sign-in attempts.

    Tracks sign-in attempts per wallet address using an in-memory
    sliding window. Each wallet is allowed a configurable number of
    attempts (default 5) within a time window (default 60 seconds).

    Thread-safe via a threading lock for concurrent request handling.

    Attributes:
        max_attempts: Maximum attempts allowed within the window.
        window_seconds: Duration of the sliding window in seconds.
    """

    def __init__(
        self,
        max_attempts: int = SIWS_RATE_LIMIT_MAX_ATTEMPTS,
        window_seconds: int = SIWS_RATE_LIMIT_WINDOW_SECONDS,
    ) -> None:
        """Initialize the wallet rate limiter.

        Args:
            max_attempts: Maximum sign-in attempts per wallet per window.
            window_seconds: Length of the sliding window in seconds.
        """
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: Dict[str, list] = defaultdict(list)
        self._lock = threading.Lock()

    def check_rate_limit(self, wallet_address: str) -> None:
        """Check and record a sign-in attempt for the given wallet.

        Removes expired entries from the sliding window, then checks
        whether the wallet has exceeded its attempt quota. If the limit
        is exceeded, raises ``RateLimitExceededError`` with the number
        of seconds until the oldest attempt falls out of the window.

        Args:
            wallet_address: The Solana wallet address to rate-limit.

        Raises:
            RateLimitExceededError: If the wallet has exceeded the
                maximum number of sign-in attempts within the window.
        """
        normalized = wallet_address.lower().strip()
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            # Prune expired entries
            self._attempts[normalized] = [
                timestamp
                for timestamp in self._attempts[normalized]
                if timestamp > cutoff
            ]

            if len(self._attempts[normalized]) >= self.max_attempts:
                oldest = self._attempts[normalized][0]
                retry_after = int(oldest + self.window_seconds - now) + 1
                logger.warning(
                    "SIWS rate limit exceeded for wallet %s "
                    "(%d attempts in %ds, retry after %ds)",
                    normalized[:16],
                    len(self._attempts[normalized]),
                    self.window_seconds,
                    retry_after,
                )
                raise RateLimitExceededError(
                    f"Too many sign-in attempts. Try again in {retry_after} seconds.",
                    retry_after=retry_after,
                )

            self._attempts[normalized].append(now)

    def get_attempt_count(self, wallet_address: str) -> int:
        """Return the current number of attempts in the window for a wallet.

        Args:
            wallet_address: The wallet address to query.

        Returns:
            Number of attempts within the current sliding window.
        """
        normalized = wallet_address.lower().strip()
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            return sum(
                1 for t in self._attempts.get(normalized, []) if t > cutoff
            )

    def reset(self, wallet_address: Optional[str] = None) -> None:
        """Reset rate limit tracking for a specific wallet or all wallets.

        Args:
            wallet_address: Specific wallet to reset, or None for all.
        """
        with self._lock:
            if wallet_address:
                self._attempts.pop(wallet_address.lower().strip(), None)
            else:
                self._attempts.clear()


# Global singleton
wallet_rate_limiter = WalletRateLimiter()


# ---------------------------------------------------------------------------
# Token Helpers
# ---------------------------------------------------------------------------


def _hash_token(token: str) -> str:
    """Compute SHA-256 hex digest of a token for secure database storage.

    Tokens are never stored in plaintext. Only the hash is persisted,
    and incoming tokens are hashed for comparison during validation.

    Args:
        token: The raw JWT token string.

    Returns:
        Hex-encoded SHA-256 hash of the token.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_siws_access_token(
    wallet_address: str,
    user_id: str,
    expires_delta: Optional[timedelta] = None,
) -> Tuple[str, str]:
    """Generate a signed JWT access token for a SIWS-authenticated wallet.

    The token includes the wallet address as the subject and the user ID
    in the claims. A unique JTI (JWT ID) is generated for token tracking.

    Args:
        wallet_address: The authenticated Solana wallet address.
        user_id: The database user ID associated with this wallet.
        expires_delta: Custom expiration duration. Defaults to 24 hours.

    Returns:
        Tuple of (encoded JWT string, JTI claim value).
    """
    expires_delta = expires_delta or timedelta(hours=SIWS_SESSION_EXPIRY_HOURS)
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(16)
    payload = {
        "sub": user_id,
        "wallet": wallet_address,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": jti,
        "auth_method": "siws",
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, jti


def create_siws_refresh_token(
    wallet_address: str,
    user_id: str,
    expires_delta: Optional[timedelta] = None,
) -> Tuple[str, str]:
    """Generate a signed JWT refresh token for a SIWS session.

    Refresh tokens allow obtaining new access tokens without requiring
    the user to re-sign a message with their wallet. They have a longer
    lifetime (default 7 days) than access tokens.

    Args:
        wallet_address: The authenticated Solana wallet address.
        user_id: The database user ID associated with this wallet.
        expires_delta: Custom expiration duration. Defaults to 7 days.

    Returns:
        Tuple of (encoded JWT string, JTI claim value).
    """
    expires_delta = expires_delta or timedelta(days=SIWS_REFRESH_EXPIRY_DAYS)
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(16)
    payload = {
        "sub": user_id,
        "wallet": wallet_address,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "jti": jti,
        "auth_method": "siws",
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, jti


def decode_siws_token(token: str, expected_type: str = "access") -> Dict[str, Any]:
    """Decode and validate a SIWS JWT token.

    Verifies the token signature, checks expiration, and validates
    that the token type matches the expected type (access or refresh).

    Args:
        token: The encoded JWT string to decode.
        expected_type: Expected token type claim ('access' or 'refresh').

    Returns:
        Dictionary containing the decoded token claims including
        'sub' (user_id), 'wallet', 'type', 'jti', and timestamps.

    Raises:
        SessionExpiredError: If the token has passed its expiration time.
        RefreshTokenExpiredError: If a refresh token has expired.
        InvalidRefreshTokenError: If the token is malformed or has
            an unexpected type claim.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])

        if payload.get("type") != expected_type:
            raise InvalidRefreshTokenError(
                f"Expected {expected_type} token, got {payload.get('type')}"
            )

        if not payload.get("sub"):
            raise InvalidRefreshTokenError("Token missing subject claim")

        return payload

    except JWTError as exc:
        error_message = str(exc).lower()
        if "expired" in error_message:
            if expected_type == "refresh":
                raise RefreshTokenExpiredError("Refresh token has expired")
            raise SessionExpiredError("Session token has expired")
        raise InvalidRefreshTokenError(f"Invalid token: {exc}")


# ---------------------------------------------------------------------------
# SIWS Message Format
# ---------------------------------------------------------------------------


def build_siws_message(
    wallet_address: str,
    nonce: str,
    domain: Optional[str] = None,
) -> Tuple[str, datetime, datetime]:
    """Build a SIWS-standard challenge message for wallet signing.

    The message follows the Sign-In With Solana specification, including
    all required fields: domain, wallet address, nonce, issued-at timestamp,
    and expiration timestamp.

    The format is compatible with Phantom, Solflare, and Backpack wallets,
    all of which sign the raw UTF-8 bytes of the message using Ed25519.

    Args:
        wallet_address: The Solana wallet address requesting authentication.
        nonce: A unique cryptographic nonce for replay prevention.
        domain: The application domain. Defaults to SIWS_DOMAIN config.

    Returns:
        Tuple of (formatted message string, issued_at datetime, expires_at datetime).
    """
    domain = domain or SIWS_DOMAIN
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=SIWS_NONCE_EXPIRY_MINUTES)

    message = (
        f"{domain} wants you to sign in with your Solana account:\n"
        f"{wallet_address}\n"
        f"\n"
        f"Sign in to SolFoundry\n"
        f"\n"
        f"URI: https://{domain}\n"
        f"Version: 1\n"
        f"Chain ID: mainnet\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at.strftime('%Y-%m-%dT%H:%M:%SZ')}\n"
        f"Expiration Time: {expires_at.strftime('%Y-%m-%dT%H:%M:%SZ')}"
    )

    return message, issued_at, expires_at


# ---------------------------------------------------------------------------
# Signature Verification
# ---------------------------------------------------------------------------


def _validate_wallet_address(wallet_address: str) -> Pubkey:
    """Validate and parse a Solana wallet address into a Pubkey.

    Checks that the address is a valid base58-encoded Ed25519 public key
    within the expected length range for Solana addresses.

    Args:
        wallet_address: The Solana wallet address string to validate.

    Returns:
        The parsed ``solders.pubkey.Pubkey`` instance.

    Raises:
        InvalidWalletAddressError: If the address is malformed, too short,
            too long, or not a valid base58 public key.
    """
    if not wallet_address or len(wallet_address) < 32 or len(wallet_address) > 48:
        raise InvalidWalletAddressError(
            f"Invalid wallet address length: expected 32-48 characters, "
            f"got {len(wallet_address) if wallet_address else 0}"
        )

    try:
        return Pubkey.from_string(wallet_address)
    except Exception as exc:
        raise InvalidWalletAddressError(
            f"Invalid Solana wallet address: {exc}"
        )


def verify_solana_signature(
    wallet_address: str,
    message: str,
    signature_b64: str,
) -> bool:
    """Verify an Ed25519 signature from a Solana wallet.

    Supports signature formats from Phantom, Solflare, and Backpack
    wallets. All three wallets sign the raw UTF-8 bytes of the message
    using the Ed25519 algorithm, producing a 64-byte signature.

    The signature is expected as a base64-encoded string. The function
    decodes it, validates the length, and verifies it against the
    wallet's public key and the original message bytes.

    Args:
        wallet_address: The Solana wallet address (public key) that
            allegedly signed the message.
        message: The original message that was signed (UTF-8 string).
        signature_b64: Base64-encoded 64-byte Ed25519 signature.

    Returns:
        True if the signature is valid.

    Raises:
        InvalidWalletAddressError: If the wallet address is invalid.
        SignatureVerificationError: If the signature is malformed,
            has wrong length, or fails cryptographic verification.
    """
    pubkey = _validate_wallet_address(wallet_address)

    try:
        signature_bytes = base64.b64decode(signature_b64)
    except Exception as exc:
        raise SignatureVerificationError(
            f"Failed to decode base64 signature: {exc}"
        )

    if len(signature_bytes) != 64:
        raise SignatureVerificationError(
            f"Invalid signature length: expected 64 bytes, got {len(signature_bytes)}"
        )

    try:
        signature = Signature(signature_bytes)
        message_bytes = message.encode("utf-8")
        is_valid = signature.verify(pubkey, message_bytes)
        if not is_valid:
            raise SignatureVerificationError(
                "Signature verification failed: signature does not match "
                "the wallet address and message"
            )
        return True
    except SignatureVerificationError:
        raise
    except Exception as exc:
        raise SignatureVerificationError(
            f"Signature verification failed: {exc}"
        )


def detect_wallet_type(user_agent: Optional[str] = None) -> str:
    """Detect the wallet provider from the User-Agent or context.

    Attempts to identify whether the request originates from Phantom,
    Solflare, or Backpack based on the User-Agent header. Falls back
    to 'unknown' if the wallet type cannot be determined.

    Args:
        user_agent: The HTTP User-Agent header value.

    Returns:
        Lowercase wallet type string: 'phantom', 'solflare',
        'backpack', or 'unknown'.
    """
    if not user_agent:
        return "unknown"

    user_agent_lower = user_agent.lower()
    if "phantom" in user_agent_lower:
        return "phantom"
    if "solflare" in user_agent_lower:
        return "solflare"
    if "backpack" in user_agent_lower:
        return "backpack"
    return "unknown"


# ---------------------------------------------------------------------------
# Core SIWS Flow (PostgreSQL-backed)
# ---------------------------------------------------------------------------


async def generate_nonce(
    db: AsyncSession,
    wallet_address: str,
    domain: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a SIWS challenge nonce and persist it in PostgreSQL.

    Creates a cryptographically random nonce, builds the SIWS-standard
    message, and stores both in the ``wallet_nonces`` table. The nonce
    is bound to the requesting wallet address and expires after
    ``SIWS_NONCE_EXPIRY_MINUTES`` (default 5 minutes).

    Args:
        db: Async SQLAlchemy session for database operations.
        wallet_address: The Solana wallet requesting authentication.
        domain: Optional domain override for the SIWS message.

    Returns:
        Dictionary containing:
        - message: The full SIWS message to be signed by the wallet.
        - nonce: The unique nonce string.
        - expires_at: ISO 8601 expiration timestamp.
        - domain: The domain included in the message.

    Raises:
        InvalidWalletAddressError: If the wallet address is invalid.
    """
    _validate_wallet_address(wallet_address)

    nonce = secrets.token_urlsafe(32)
    effective_domain = domain or SIWS_DOMAIN
    message, issued_at, expires_at = build_siws_message(
        wallet_address, nonce, effective_domain
    )

    nonce_record = WalletNonceDB(
        nonce=nonce,
        wallet_address=wallet_address.lower(),
        message=message,
        domain=effective_domain,
        issued_at=issued_at,
        expires_at=expires_at,
        used=False,
    )
    db.add(nonce_record)
    await db.commit()

    logger.info(
        "Generated SIWS nonce for wallet %s (expires: %s)",
        wallet_address[:16],
        expires_at.isoformat(),
    )

    return {
        "message": message,
        "nonce": nonce,
        "expires_at": expires_at,
        "domain": effective_domain,
    }


async def _consume_nonce(
    db: AsyncSession,
    nonce: str,
    wallet_address: str,
    message: str,
) -> WalletNonceDB:
    """Validate and consume a SIWS nonce from the database.

    Looks up the nonce in the ``wallet_nonces`` table, verifies it has
    not been used, has not expired, and is bound to the correct wallet
    address and message. On success, marks the nonce as used.

    This is an internal helper called during signature verification.

    Args:
        db: Async SQLAlchemy session.
        nonce: The nonce string to consume.
        wallet_address: Expected wallet address bound to the nonce.
        message: Expected message stored with the nonce.

    Returns:
        The consumed ``WalletNonceDB`` record.

    Raises:
        NonceNotFoundError: If the nonce does not exist.
        NonceAlreadyUsedError: If the nonce was previously consumed.
        NonceExpiredError: If the nonce has passed its expiration.
        WalletMismatchError: If the wallet address does not match.
        MessageMismatchError: If the message does not match.
    """
    result = await db.execute(
        select(WalletNonceDB).where(WalletNonceDB.nonce == nonce)
    )
    nonce_record = result.scalar_one_or_none()

    if not nonce_record:
        raise NonceNotFoundError(f"Nonce not found: {nonce[:16]}...")

    if nonce_record.used:
        raise NonceAlreadyUsedError(
            "This nonce has already been used. Request a new challenge."
        )

    now = datetime.now(timezone.utc)
    if nonce_record.expires_at.tzinfo is None:
        expires_at = nonce_record.expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = nonce_record.expires_at

    if now > expires_at:
        raise NonceExpiredError(
            "Nonce has expired. Request a new challenge."
        )

    if nonce_record.wallet_address != wallet_address.lower():
        raise WalletMismatchError(
            "Wallet address does not match the nonce."
        )

    if nonce_record.message != message:
        raise MessageMismatchError(
            "Message does not match the stored challenge."
        )

    # Mark nonce as consumed
    nonce_record.used = True
    nonce_record.used_at = now
    await db.commit()

    return nonce_record


async def authenticate_wallet(
    db: AsyncSession,
    wallet_address: str,
    signature: str,
    message: str,
    nonce: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Dict[str, Any]:
    """Complete the SIWS authentication flow.

    This is the main entry point for wallet authentication. It:
    1. Checks rate limiting for the wallet address.
    2. Validates and consumes the nonce from PostgreSQL.
    3. Verifies the Ed25519 signature against the wallet public key.
    4. Creates or updates the user record in the database.
    5. Issues JWT access and refresh tokens.
    6. Persists the session in the ``wallet_sessions`` table.

    Args:
        db: Async SQLAlchemy session for database operations.
        wallet_address: The Solana wallet address authenticating.
        signature: Base64-encoded Ed25519 signature of the message.
        message: The SIWS message that was signed.
        nonce: The nonce from the challenge phase.
        ip_address: Optional client IP for audit logging.
        user_agent: Optional User-Agent for wallet type detection.

    Returns:
        Dictionary containing:
        - access_token: JWT access token (24h expiry).
        - refresh_token: JWT refresh token (7d expiry).
        - token_type: Always 'bearer'.
        - expires_in: Access token lifetime in seconds.
        - session_id: UUID of the created session.
        - user: UserResponse-compatible dict with user profile.

    Raises:
        RateLimitExceededError: If the wallet has too many recent attempts.
        NonceNotFoundError: If the nonce is invalid.
        NonceAlreadyUsedError: If the nonce was already consumed.
        NonceExpiredError: If the nonce has expired.
        WalletMismatchError: If the wallet does not match the nonce.
        MessageMismatchError: If the message does not match.
        SignatureVerificationError: If the signature is invalid.
        InvalidWalletAddressError: If the wallet address is malformed.
    """
    # Step 1: Rate limiting
    wallet_rate_limiter.check_rate_limit(wallet_address)

    # Step 2: Consume nonce (validates expiry, wallet binding, replay)
    await _consume_nonce(db, nonce, wallet_address, message)

    # Step 3: Verify signature
    verify_solana_signature(wallet_address, message, signature)

    # Step 4: Find or create user
    result = await db.execute(
        select(User).where(User.wallet_address == wallet_address.lower())
    )
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if user:
        user.last_login_at = now
        user.updated_at = now
        user.wallet_verified = True
    else:
        user = User(
            github_id=f"wallet_{wallet_address[:16].lower()}",
            username=f"wallet_{wallet_address[:8].lower()}",
            wallet_address=wallet_address.lower(),
            wallet_verified=True,
            last_login_at=now,
        )
        db.add(user)

    await db.flush()

    user_id = str(user.id)

    # Step 5: Issue tokens
    access_token, access_jti = create_siws_access_token(
        wallet_address, user_id
    )
    refresh_token, refresh_jti = create_siws_refresh_token(
        wallet_address, user_id
    )

    # Step 6: Persist session
    wallet_type = detect_wallet_type(user_agent)
    session = WalletSessionDB(
        wallet_address=wallet_address.lower(),
        token_hash=_hash_token(access_token),
        refresh_token_hash=_hash_token(refresh_token),
        expires_at=now + timedelta(hours=SIWS_SESSION_EXPIRY_HOURS),
        refresh_expires_at=now + timedelta(days=SIWS_REFRESH_EXPIRY_DAYS),
        ip_address=ip_address,
        user_agent=user_agent,
        wallet_type=wallet_type,
    )
    db.add(session)
    await db.commit()
    await db.refresh(user)

    audit_event(
        "siws_authenticate",
        user_id=user_id,
        wallet_address=wallet_address.lower(),
        wallet_type=wallet_type,
        ip_address=ip_address or "unknown",
        session_id=str(session.id),
    )

    logger.info(
        "SIWS authentication successful for wallet %s (user: %s, session: %s)",
        wallet_address[:16],
        user_id,
        str(session.id),
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": SIWS_SESSION_EXPIRY_HOURS * 3600,
        "session_id": str(session.id),
        "user": {
            "id": str(user.id),
            "github_id": user.github_id,
            "username": user.username,
            "email": user.email,
            "avatar_url": user.avatar_url,
            "wallet_address": user.wallet_address,
            "wallet_verified": user.wallet_verified,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        },
    }


async def refresh_session(
    db: AsyncSession,
    refresh_token: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Dict[str, Any]:
    """Exchange a valid refresh token for a new access token.

    Looks up the session by refresh token hash, validates it has not
    been revoked or expired, and issues a new access token. The session's
    ``last_activity_at`` and access token hash are updated.

    This allows users to maintain their session without re-signing
    a wallet message, as long as the refresh token is still valid.

    Args:
        db: Async SQLAlchemy session.
        refresh_token: The JWT refresh token to exchange.
        ip_address: Optional client IP for audit logging.
        user_agent: Optional User-Agent header.

    Returns:
        Dictionary containing:
        - access_token: New JWT access token (24h expiry).
        - token_type: Always 'bearer'.
        - expires_in: Access token lifetime in seconds.
        - session_id: UUID of the refreshed session.

    Raises:
        RefreshTokenExpiredError: If the refresh token JWT has expired.
        InvalidRefreshTokenError: If the token is malformed or not found.
        SessionRevokedError: If the session has been revoked.
    """
    # Decode and validate the refresh token JWT
    claims = decode_siws_token(refresh_token, expected_type="refresh")
    user_id = claims["sub"]
    wallet_address = claims.get("wallet", "")

    # Look up session by refresh token hash
    refresh_hash = _hash_token(refresh_token)
    result = await db.execute(
        select(WalletSessionDB).where(
            WalletSessionDB.refresh_token_hash == refresh_hash
        )
    )
    session = result.scalar_one_or_none()

    if not session:
        raise InvalidRefreshTokenError(
            "Refresh token not found. Please sign in again."
        )

    if session.revoked:
        raise SessionRevokedError(
            "Session has been revoked. Please sign in again."
        )

    now = datetime.now(timezone.utc)

    if session.refresh_expires_at.tzinfo is None:
        refresh_expires = session.refresh_expires_at.replace(tzinfo=timezone.utc)
    else:
        refresh_expires = session.refresh_expires_at

    if now > refresh_expires:
        raise RefreshTokenExpiredError(
            "Refresh token has expired. Please sign in again."
        )

    # Verify user still exists
    user_result = await db.execute(select(User).where(User.id == uuid_module.UUID(user_id)))
    user = user_result.scalar_one_or_none()
    if not user:
        raise InvalidRefreshTokenError("User not found.")

    # Issue new access token
    new_access_token, new_jti = create_siws_access_token(
        wallet_address, user_id
    )

    # Update session
    session.token_hash = _hash_token(new_access_token)
    session.expires_at = now + timedelta(hours=SIWS_SESSION_EXPIRY_HOURS)
    session.last_activity_at = now

    await db.commit()

    audit_event(
        "siws_refresh",
        user_id=user_id,
        wallet_address=wallet_address,
        session_id=str(session.id),
    )

    logger.info(
        "SIWS session refreshed for wallet %s (user: %s)",
        wallet_address[:16],
        user_id,
    )

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": SIWS_SESSION_EXPIRY_HOURS * 3600,
        "session_id": str(session.id),
    }


async def revoke_session(
    db: AsyncSession,
    session_id: str,
    user_id: str,
) -> Dict[str, Any]:
    """Revoke a specific wallet session (logout).

    Marks the session as revoked in the database, preventing any
    further use of its access or refresh tokens.

    Args:
        db: Async SQLAlchemy session.
        session_id: UUID of the session to revoke.
        user_id: The authenticated user ID (for ownership verification).

    Returns:
        Dictionary with revocation confirmation.

    Raises:
        SessionRevokedError: If the session is not found or does not
            belong to the requesting user.
    """
    result = await db.execute(
        select(WalletSessionDB).where(WalletSessionDB.id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        raise SessionRevokedError("Session not found.")

    # Verify the session belongs to the user's wallet
    user_result = await db.execute(select(User).where(User.id == uuid_module.UUID(user_id)))
    user = user_result.scalar_one_or_none()
    if not user or session.wallet_address != (user.wallet_address or "").lower():
        raise SessionRevokedError("Session does not belong to this user.")

    now = datetime.now(timezone.utc)
    session.revoked = True
    session.revoked_at = now
    await db.commit()

    audit_event(
        "siws_session_revoked",
        user_id=user_id,
        session_id=session_id,
    )

    return {
        "success": True,
        "message": "Session revoked successfully.",
        "session_id": session_id,
    }


async def revoke_all_wallet_sessions(
    db: AsyncSession,
    wallet_address: str,
    user_id: str,
) -> Dict[str, Any]:
    """Revoke all active sessions for a wallet (logout from all devices).

    Marks all non-revoked sessions for the given wallet address as
    revoked. This is a security measure for compromised wallets or
    user-initiated global logout.

    Args:
        db: Async SQLAlchemy session.
        wallet_address: The wallet address whose sessions to revoke.
        user_id: The authenticated user ID for audit logging.

    Returns:
        Dictionary with the count of revoked sessions.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        update(WalletSessionDB)
        .where(
            and_(
                WalletSessionDB.wallet_address == wallet_address.lower(),
                WalletSessionDB.revoked == False,  # noqa: E712
            )
        )
        .values(revoked=True, revoked_at=now)
    )
    revoked_count = result.rowcount
    await db.commit()

    audit_event(
        "siws_all_sessions_revoked",
        user_id=user_id,
        wallet_address=wallet_address,
        revoked_count=revoked_count,
    )

    logger.warning(
        "Revoked all %d sessions for wallet %s (user: %s)",
        revoked_count,
        wallet_address[:16],
        user_id,
    )

    return {
        "success": True,
        "message": f"Revoked {revoked_count} active sessions.",
        "revoked_count": revoked_count,
    }


async def get_active_sessions(
    db: AsyncSession,
    wallet_address: str,
) -> list:
    """List all active (non-revoked, non-expired) sessions for a wallet.

    Returns session metadata without sensitive token hashes. Useful
    for showing users their active devices/sessions.

    Args:
        db: Async SQLAlchemy session.
        wallet_address: The wallet address to query sessions for.

    Returns:
        List of dictionaries with session metadata (id, created_at,
        last_activity_at, ip_address, wallet_type, expires_at).
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(WalletSessionDB).where(
            and_(
                WalletSessionDB.wallet_address == wallet_address.lower(),
                WalletSessionDB.revoked == False,  # noqa: E712
                WalletSessionDB.expires_at > now,
            )
        )
    )
    sessions = result.scalars().all()

    return [
        {
            "session_id": str(session.id),
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "last_activity_at": (
                session.last_activity_at.isoformat()
                if session.last_activity_at
                else None
            ),
            "ip_address": session.ip_address,
            "wallet_type": session.wallet_type,
            "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        }
        for session in sessions
    ]


async def validate_session_token(
    db: AsyncSession,
    token: str,
) -> Optional[Dict[str, Any]]:
    """Validate an access token against the session database.

    Decodes the JWT, looks up the session by token hash, and verifies
    the session is still active (not revoked, not expired). Updates
    the session's ``last_activity_at`` timestamp.

    Args:
        db: Async SQLAlchemy session.
        token: The JWT access token to validate.

    Returns:
        Dictionary with session claims if valid, or None if the
        session is revoked, expired, or not found.
    """
    try:
        claims = decode_siws_token(token, expected_type="access")
    except SIWSError:
        return None

    token_hash = _hash_token(token)
    result = await db.execute(
        select(WalletSessionDB).where(
            WalletSessionDB.token_hash == token_hash
        )
    )
    session = result.scalar_one_or_none()

    if not session or session.revoked:
        return None

    now = datetime.now(timezone.utc)
    if session.expires_at.tzinfo is None:
        expires_at = session.expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = session.expires_at

    if now > expires_at:
        return None

    # Update last activity
    session.last_activity_at = now
    await db.commit()

    return claims


async def cleanup_expired_nonces(db: AsyncSession) -> int:
    """Delete expired and consumed nonces from the database.

    Housekeeping function that removes nonces older than their expiry
    time plus a 1-hour grace period. Should be called periodically
    (e.g., every hour) to prevent table bloat.

    Args:
        db: Async SQLAlchemy session.

    Returns:
        Number of nonce records deleted.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    result = await db.execute(
        delete(WalletNonceDB).where(WalletNonceDB.expires_at < cutoff)
    )
    deleted = result.rowcount
    await db.commit()

    if deleted:
        logger.info("Cleaned up %d expired SIWS nonces", deleted)
    return deleted


async def cleanup_expired_sessions(db: AsyncSession) -> int:
    """Delete expired and revoked sessions from the database.

    Removes sessions that have been revoked or whose refresh token
    has expired (meaning the session can never be refreshed). Should
    be called periodically to prevent table bloat.

    Args:
        db: Async SQLAlchemy session.

    Returns:
        Number of session records deleted.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        delete(WalletSessionDB).where(
            (WalletSessionDB.refresh_expires_at < now)
            | (
                (WalletSessionDB.revoked == True)  # noqa: E712
                & (WalletSessionDB.revoked_at < now - timedelta(hours=24))
            )
        )
    )
    deleted = result.rowcount
    await db.commit()

    if deleted:
        logger.info("Cleaned up %d expired/revoked SIWS sessions", deleted)
    return deleted
