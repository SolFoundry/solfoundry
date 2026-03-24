"""Wallet session model for SIWS (Sign-In With Solana) authentication.

Stores active wallet sessions with JWT token hashes, expiry times,
and refresh token support. Replaces the in-memory nonce store with
a persistent DB-backed approach.
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pydantic import BaseModel, Field

from app.database import Base


class WalletSession(Base):
    """Persistent wallet session for SIWS auth."""

    __tablename__ = "wallet_sessions"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    wallet_address = Column(String(64), nullable=False, index=True)
    # SHA-256 hex digest of the JWT access token (never store raw tokens)
    access_token_hash = Column(String(64), nullable=False)
    # SHA-256 hex digest of the refresh token
    refresh_token_hash = Column(String(64), nullable=False, unique=True, index=True)
    access_expires_at = Column(DateTime(timezone=True), nullable=False)
    refresh_expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    revoked = Column(Boolean, default=False, nullable=False)
    # Nonce used to create this session (for audit trail)
    nonce = Column(String(64), nullable=True)

    __table_args__ = (
        # Fast lookup: active sessions by wallet
        Index("ix_wallet_sessions_wallet_active", "wallet_address", "revoked"),
        # Fast lookup: revoke by token hash
        Index("ix_wallet_sessions_access_hash", "access_token_hash"),
    )


class SiwsNonce(Base):
    """Short-lived nonces for SIWS challenge-response flow.

    Replaces the in-memory _auth_challenges dict with a persistent table.
    Rows are cleaned up after use or expiry.
    """

    __tablename__ = "siws_nonces"

    nonce = Column(String(64), primary_key=True)
    wallet_address = Column(String(64), nullable=False, index=True)
    domain = Column(String(256), nullable=False)
    issued_at = Column(DateTime(timezone=True), nullable=False)
    expiration_time = Column(DateTime(timezone=True), nullable=False)
    # The full SIWS message body (for exact-match verification)
    message_body = Column(String(2048), nullable=False)
    used = Column(Boolean, default=False, nullable=False)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class SiwsMessageResponse(BaseModel):
    """Response containing the SIWS message to sign."""

    domain: str = Field(..., description="Origin domain (e.g. app.solfoundry.io)")
    address: str = Field(..., description="Solana wallet public key")
    statement: str = Field(
        ..., description="Human-readable statement shown in wallet UI"
    )
    uri: str = Field(..., description="URI of the resource being accessed")
    version: str = Field("1", description="SIWS version")
    chain_id: str = Field("mainnet", description="Solana cluster")
    nonce: str = Field(..., description="Random nonce — prevents replay attacks")
    issued_at: str = Field(..., description="ISO-8601 timestamp")
    expiration_time: str = Field(..., description="ISO-8601 expiration timestamp")
    # Full canonical message text the wallet must sign
    message: str = Field(..., description="Full message text for wallet signing")


class SiwsAuthRequest(BaseModel):
    """Request to complete SIWS sign-in."""

    wallet_address: str = Field(
        ..., description="Solana public key (base58)", min_length=32, max_length=48
    )
    signature: str = Field(
        ..., description="Base64-encoded ed25519 signature over the message"
    )
    nonce: str = Field(..., description="Nonce from the challenge message")
    message: str = Field(..., description="Exact message that was signed")


class SiwsAuthResponse(BaseModel):
    """Response after successful SIWS sign-in."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token lifetime in seconds")
    wallet_address: str
