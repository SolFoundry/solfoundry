"""Database models for wallet-based session management (SIWS).

Provides PostgreSQL-backed tables for:
- Wallet authentication nonces: one-time-use challenge tokens that prevent
  replay attacks in the Sign-In With Solana flow.
- Wallet sessions: persistent session records tracking active JWTs, expiry
  times, and metadata for auditing and forced invalidation.

Each table uses server-side defaults for timestamps and includes appropriate
indexes for common query patterns (lookup by wallet address, cleanup of
expired records).

References:
    - SIWS Spec: https://github.com/phantom/sign-in-with-solana
    - OWASP Session Management:
      https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
)
from app.database import Base, GUID


class WalletNonceDB(Base):
    """PostgreSQL model for SIWS authentication nonces.

    Stores one-time-use nonces issued during the challenge phase of
    wallet authentication. Each nonce is bound to a specific wallet
    address and expires after a configurable window (default 5 minutes).

    After a nonce is consumed during signature verification it is marked
    as ``used`` rather than deleted, providing an audit trail and
    preventing replay even if the deletion is delayed.

    Attributes:
        id: Auto-incrementing primary key.
        nonce: Unique cryptographic nonce string (URL-safe base64).
        wallet_address: The Solana wallet address this nonce was issued for.
        message: The full SIWS message the wallet must sign.
        domain: The domain included in the SIWS message.
        issued_at: Timestamp when the nonce was created.
        expires_at: Timestamp when the nonce becomes invalid.
        used: Whether this nonce has already been consumed.
        used_at: Timestamp when the nonce was consumed (null if unused).
    """

    __tablename__ = "wallet_nonces"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nonce = Column(String(128), unique=True, nullable=False, index=True)
    wallet_address = Column(String(64), nullable=False, index=True)
    message = Column(Text, nullable=False)
    domain = Column(String(256), nullable=False)
    issued_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_wallet_nonces_wallet_expires", "wallet_address", "expires_at"),
        Index("idx_wallet_nonces_expires_used", "expires_at", "used"),
    )


class WalletSessionDB(Base):
    """PostgreSQL model for active wallet authentication sessions.

    Tracks every JWT session issued through the SIWS flow. Sessions store
    a SHA-256 hash of the access token (never plaintext) along with the
    wallet address, expiry times, and client metadata.

    The ``revoked`` flag allows immediate session invalidation without
    waiting for JWT expiry. Cleanup jobs periodically purge expired and
    revoked rows.

    Attributes:
        id: UUID primary key for the session.
        wallet_address: The authenticated wallet's Solana address.
        token_hash: SHA-256 hex digest of the JWT access token.
        refresh_token_hash: SHA-256 hex digest of the JWT refresh token.
        created_at: When the session was created.
        expires_at: When the access token expires (24 hours from creation).
        refresh_expires_at: When the refresh token expires (7 days from creation).
        last_activity_at: Timestamp of the most recent authenticated request.
        ip_address: Client IP address at session creation.
        user_agent: Client User-Agent header at session creation.
        wallet_type: Wallet provider name (phantom, solflare, backpack, unknown).
        revoked: Whether the session has been explicitly invalidated.
        revoked_at: When the session was revoked (null if still active).
    """

    __tablename__ = "wallet_sessions"

    id = Column(
        GUID(),
        primary_key=True,
        default=uuid4,
    )
    wallet_address = Column(String(64), nullable=False, index=True)
    token_hash = Column(String(128), nullable=False, unique=True, index=True)
    refresh_token_hash = Column(String(128), nullable=False, unique=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    refresh_expires_at = Column(DateTime(timezone=True), nullable=False)
    last_activity_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    wallet_type = Column(String(32), nullable=False, default="unknown")
    revoked = Column(Boolean, default=False, nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_wallet_sessions_wallet_active", "wallet_address", "revoked"),
        Index("idx_wallet_sessions_expires", "expires_at"),
        Index("idx_wallet_sessions_refresh_expires", "refresh_expires_at"),
    )
