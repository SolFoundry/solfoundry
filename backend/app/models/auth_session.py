"""Authentication session and challenge database models.

This module defines PostgreSQL-backed models for:
- AuthSession: Tracks active JWT sessions with revocation support.
- AuthChallenge: Stores SIWS nonce challenges for wallet signature verification.

All auth state is persisted in PostgreSQL — no in-memory dicts.
This ensures fail-closed behavior: if the DB is unavailable, auth fails.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    String,
    DateTime,
    Boolean,
    Text,
    Index,
    ForeignKey,
    Uuid,
)

from app.database import Base


class SessionStatus(str, Enum):
    """Status of an authentication session.

    Attributes:
        ACTIVE: Session is valid and can be used.
        REVOKED: Session was explicitly revoked by the user or admin.
        EXPIRED: Session has passed its expiration time.
    """

    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


class AuthSession(Base):
    """Database model for tracking JWT authentication sessions.

    Each successful login (wallet or GitHub) creates an AuthSession record.
    Sessions can be revoked individually or in bulk (revoke all for a user).
    The JWT token ID (jti) is stored to enable token-level revocation.

    Attributes:
        id: Primary key UUID.
        user_id: Foreign key to the users table.
        token_id: Unique JWT token identifier (jti claim) for revocation lookups.
        refresh_token_id: Unique identifier for the paired refresh token.
        wallet_address: The wallet used for this session (null for GitHub auth).
        provider: Wallet provider or 'github' for OAuth sessions.
        ip_address: Client IP address at session creation.
        user_agent: Client User-Agent header at session creation.
        status: Current session status (active, revoked, expired).
        expires_at: When the access token expires.
        refresh_expires_at: When the refresh token expires.
        created_at: When the session was created.
        revoked_at: When the session was revoked (null if still active).
    """

    __tablename__ = "auth_sessions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_id = Column(String(64), nullable=False, unique=True, index=True)
    refresh_token_id = Column(String(64), nullable=False, unique=True, index=True)
    wallet_address = Column(String(64), nullable=True)
    provider = Column(String(32), nullable=False, default="unknown")
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    status = Column(
        String(20),
        nullable=False,
        default=SessionStatus.ACTIVE.value,
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    refresh_expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_auth_sessions_user_status", user_id, status),
        Index("ix_auth_sessions_expires", expires_at),
    )


class AuthChallenge(Base):
    """Database model for SIWS authentication challenges.

    Stores nonce-bound challenge messages for wallet signature verification.
    Each challenge is single-use: once verified or expired, it is consumed.
    Challenges expire after 5 minutes to prevent replay attacks.

    Attributes:
        id: Primary key UUID.
        nonce: Unique cryptographic nonce for this challenge.
        wallet_address: The wallet address this challenge was generated for.
        message: The full SIWS message the wallet must sign.
        expires_at: When this challenge expires (5 minutes from creation).
        consumed: Whether this challenge has been used.
        created_at: When the challenge was created.
    """

    __tablename__ = "auth_challenges"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    nonce = Column(String(64), nullable=False, unique=True, index=True)
    wallet_address = Column(String(64), nullable=False)
    message = Column(Text, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_auth_challenges_expires", expires_at),
        Index("ix_auth_challenges_wallet", wallet_address),
    )


class RateLimitRecord(Base):
    """Database model for tracking authentication rate limits.

    Stores per-IP and per-wallet rate limit counters with sliding windows.
    Used to enforce 5 attempts per minute on auth endpoints.

    Attributes:
        id: Primary key UUID.
        identifier: The rate-limited entity (IP address or wallet address).
        endpoint: The endpoint being rate-limited.
        attempt_at: Timestamp of this attempt.
    """

    __tablename__ = "auth_rate_limits"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    identifier = Column(String(128), nullable=False, index=True)
    endpoint = Column(String(128), nullable=False)
    attempt_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    __table_args__ = (
        Index("ix_rate_limits_identifier_endpoint", identifier, endpoint),
    )


# ---------------------------------------------------------------------------
# Pydantic request/response schemas
# ---------------------------------------------------------------------------


class SIWSMessageRequest(BaseModel):
    """Request for generating a SIWS (Sign-In With Solana) challenge message.

    Attributes:
        wallet_address: The Solana wallet public key to generate a challenge for.
        provider: The wallet provider being used (phantom, solflare, backpack).
    """

    wallet_address: str = Field(
        ...,
        min_length=32,
        max_length=64,
        description="Solana wallet public key (base58-encoded)",
    )
    provider: Optional[str] = Field(
        None,
        description="Wallet provider (phantom, solflare, backpack)",
    )


class SIWSMessageResponse(BaseModel):
    """Response containing the SIWS challenge message to sign.

    The frontend must present this message to the wallet for signing.
    The nonce is used to prevent replay attacks and must be included
    when submitting the signed message for verification.

    Attributes:
        message: The SIWS challenge message to sign with the wallet.
        nonce: Unique nonce for this challenge (include when verifying).
        expires_at: When this challenge expires (5 minutes from creation).
    """

    message: str
    nonce: str
    expires_at: datetime


class SIWSVerifyRequest(BaseModel):
    """Request to verify a signed SIWS message and create a session.

    After the wallet signs the challenge message, submit the signature
    here to complete authentication and receive JWT tokens.

    Attributes:
        wallet_address: The Solana wallet that signed the message.
        signature: Base64-encoded Ed25519 signature.
        message: The exact challenge message that was signed.
        nonce: The nonce from the challenge for replay protection.
        provider: The wallet provider used for signing.
    """

    wallet_address: str = Field(
        ...,
        min_length=32,
        max_length=64,
        description="Solana wallet public key",
    )
    signature: str = Field(
        ...,
        min_length=1,
        description="Base64-encoded Ed25519 signature",
    )
    message: str = Field(
        ...,
        min_length=1,
        description="The exact SIWS challenge message that was signed",
    )
    nonce: str = Field(
        ...,
        min_length=1,
        description="Nonce from the challenge for replay protection",
    )
    provider: Optional[str] = Field(
        "unknown",
        description="Wallet provider (phantom, solflare, backpack)",
    )


class SIWSVerifyResponse(BaseModel):
    """Response after successful SIWS verification.

    Contains JWT tokens for subsequent authenticated requests and
    the session ID for session management operations.

    Attributes:
        access_token: JWT access token for API requests.
        refresh_token: JWT refresh token for obtaining new access tokens.
        token_type: Token type (always 'bearer').
        expires_in: Access token lifetime in seconds.
        session_id: Unique session identifier for management/revocation.
        user: The authenticated user profile.
    """

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    session_id: str
    user: "UserResponse"


class SessionResponse(BaseModel):
    """Response schema for a single auth session.

    Attributes:
        id: Session UUID.
        wallet_address: Wallet used for this session (null for GitHub auth).
        provider: Auth provider (wallet provider name or 'github').
        ip_address: Client IP at session creation.
        status: Current session status.
        created_at: When the session was created.
        expires_at: When the session expires.
    """

    id: str
    wallet_address: Optional[str] = None
    provider: str
    ip_address: Optional[str] = None
    status: str
    created_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    """Paginated list of auth sessions.

    Attributes:
        items: List of session responses.
        total: Total number of sessions.
    """

    items: List[SessionResponse]
    total: int


class RevokeSessionRequest(BaseModel):
    """Request to revoke a specific session.

    Attributes:
        session_id: The UUID of the session to revoke.
    """

    session_id: str = Field(
        ...,
        min_length=1,
        description="UUID of the session to revoke",
    )


class RevokeAllSessionsResponse(BaseModel):
    """Response after revoking all sessions.

    Attributes:
        revoked_count: Number of sessions that were revoked.
        message: Human-readable result message.
    """

    revoked_count: int
    message: str


class RefreshSessionRequest(BaseModel):
    """Request to refresh a session using a refresh token.

    Attributes:
        refresh_token: The JWT refresh token.
    """

    refresh_token: str = Field(
        ...,
        min_length=1,
        description="JWT refresh token",
    )


class RefreshSessionResponse(BaseModel):
    """Response after refreshing a session.

    Attributes:
        access_token: New JWT access token.
        token_type: Token type (always 'bearer').
        expires_in: New access token lifetime in seconds.
    """

    access_token: str
    token_type: str = "bearer"
    expires_in: int


# Avoid circular import — import at module level for type resolution
from app.models.user import UserResponse  # noqa: E402

SIWSVerifyResponse.model_rebuild()
