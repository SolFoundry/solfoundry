"""Pydantic request and response models for Sign-In With Solana (SIWS) endpoints.

Provides typed validation models for all SIWS API operations:
- Nonce generation (challenge phase)
- Wallet authentication (signature verification)
- Session refresh (token exchange without re-signing)
- Session management (list, revoke, revoke all)

All models use Pydantic v2 with ``model_config = {"from_attributes": True}``
for ORM compatibility. Request models enforce field constraints (min/max
length, patterns) to reject malformed input early.

References:
    - Pydantic v2 Models: https://docs.pydantic.dev/latest/
    - SIWS Spec: https://github.com/phantom/sign-in-with-solana
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.user import UserResponse


class SIWSNonceRequest(BaseModel):
    """Request model for generating a SIWS challenge nonce.

    The wallet address must be a valid Solana public key (32-44 characters,
    base58 encoded). An optional domain override allows testing against
    non-production domains.

    Attributes:
        wallet_address: The Solana wallet address requesting authentication.
        domain: Optional domain override for the SIWS message.
    """

    wallet_address: str = Field(
        ...,
        min_length=32,
        max_length=48,
        description="Solana wallet address (base58-encoded public key)",
        examples=["7Pq6gYm5gzNkPnXSEqzKb9Lxz8HKGF5dTqYVMxqW2Jn"],
    )
    domain: Optional[str] = Field(
        None,
        max_length=256,
        description="Optional domain override for the SIWS message",
    )


class SIWSNonceResponse(BaseModel):
    """Response model for a generated SIWS challenge nonce.

    Contains the full SIWS-standard message that the wallet must sign,
    the unique nonce for replay prevention, the expiration timestamp,
    and the domain used in the message.

    Attributes:
        message: The full SIWS message to be signed by the wallet.
        nonce: Unique cryptographic nonce for this challenge.
        expires_at: When the nonce expires and can no longer be used.
        domain: The domain included in the SIWS message.
    """

    message: str = Field(
        ...,
        description="Full SIWS message for the wallet to sign",
    )
    nonce: str = Field(
        ...,
        description="Unique nonce for replay attack prevention",
    )
    expires_at: datetime = Field(
        ...,
        description="ISO 8601 timestamp when this challenge expires",
    )
    domain: str = Field(
        ...,
        description="Domain included in the SIWS message",
    )


class SIWSAuthenticateRequest(BaseModel):
    """Request model for completing SIWS wallet authentication.

    The client submits the wallet address, the signature of the challenge
    message, the original message, and the nonce. The signature must be
    a base64-encoded Ed25519 signature (64 bytes).

    Attributes:
        wallet_address: The Solana wallet that signed the message.
        signature: Base64-encoded Ed25519 signature.
        message: The original SIWS message that was signed.
        nonce: The nonce from the challenge phase.
    """

    wallet_address: str = Field(
        ...,
        min_length=32,
        max_length=48,
        description="Solana wallet address that signed the message",
    )
    signature: str = Field(
        ...,
        min_length=1,
        description="Base64-encoded Ed25519 signature of the message",
    )
    message: str = Field(
        ...,
        min_length=1,
        description="The SIWS message that was signed",
    )
    nonce: str = Field(
        ...,
        min_length=1,
        description="The nonce from the challenge phase",
    )


class SIWSAuthenticateResponse(BaseModel):
    """Response model for successful SIWS wallet authentication.

    Contains the issued JWT tokens, session metadata, and the
    authenticated user profile.

    Attributes:
        access_token: JWT access token for API authentication (24h expiry).
        refresh_token: JWT refresh token for session extension (7d expiry).
        token_type: Always 'bearer'.
        expires_in: Access token lifetime in seconds (86400 = 24 hours).
        session_id: UUID of the created session record.
        user: The authenticated user's profile.
    """

    access_token: str = Field(
        ...,
        description="JWT access token (24-hour expiry)",
    )
    refresh_token: str = Field(
        ...,
        description="JWT refresh token (7-day expiry)",
    )
    token_type: str = Field(
        "bearer",
        description="Token type, always 'bearer'",
    )
    expires_in: int = Field(
        86400,
        description="Access token lifetime in seconds",
    )
    session_id: str = Field(
        ...,
        description="UUID of the created session",
    )
    user: UserResponse = Field(
        ...,
        description="Authenticated user profile",
    )


class SIWSRefreshRequest(BaseModel):
    """Request model for refreshing a SIWS session without re-signing.

    Exchanges a valid refresh token for a new access token.

    Attributes:
        refresh_token: The JWT refresh token from the authentication response.
    """

    refresh_token: str = Field(
        ...,
        min_length=1,
        description="JWT refresh token to exchange for a new access token",
    )


class SIWSRefreshResponse(BaseModel):
    """Response model for a successfully refreshed SIWS session.

    Attributes:
        access_token: New JWT access token (24-hour expiry).
        token_type: Always 'bearer'.
        expires_in: Access token lifetime in seconds.
        session_id: UUID of the refreshed session.
    """

    access_token: str = Field(
        ...,
        description="New JWT access token (24-hour expiry)",
    )
    token_type: str = Field(
        "bearer",
        description="Token type, always 'bearer'",
    )
    expires_in: int = Field(
        86400,
        description="Access token lifetime in seconds",
    )
    session_id: str = Field(
        ...,
        description="UUID of the refreshed session",
    )


class SIWSSessionInfo(BaseModel):
    """Metadata for a single active SIWS session.

    Excludes sensitive token hashes — only returns audit-friendly fields.

    Attributes:
        session_id: UUID of the session.
        created_at: When the session was created.
        last_activity_at: Timestamp of the most recent authenticated request.
        ip_address: Client IP at session creation.
        wallet_type: Detected wallet provider (phantom, solflare, backpack, unknown).
        expires_at: When the access token expires.
    """

    session_id: str = Field(..., description="UUID of the session")
    created_at: Optional[str] = Field(None, description="Session creation timestamp")
    last_activity_at: Optional[str] = Field(
        None, description="Last authenticated request timestamp"
    )
    ip_address: Optional[str] = Field(None, description="Client IP at creation")
    wallet_type: str = Field("unknown", description="Detected wallet provider")
    expires_at: Optional[str] = Field(None, description="Access token expiry")


class SIWSSessionListResponse(BaseModel):
    """Response model for listing active SIWS sessions.

    Attributes:
        sessions: List of active session metadata.
        total: Total number of active sessions.
    """

    sessions: List[SIWSSessionInfo] = Field(
        ..., description="Active sessions for this wallet"
    )
    total: int = Field(..., description="Total number of active sessions")


class SIWSRevokeRequest(BaseModel):
    """Request model for revoking a specific SIWS session.

    Attributes:
        session_id: UUID of the session to revoke.
    """

    session_id: str = Field(
        ...,
        description="UUID of the session to revoke",
    )


class SIWSRevokeResponse(BaseModel):
    """Response model for session revocation.

    Attributes:
        success: Whether the revocation was successful.
        message: Human-readable confirmation message.
        session_id: UUID of the revoked session (for single revoke).
        revoked_count: Number of sessions revoked (for revoke-all).
    """

    success: bool = Field(..., description="Whether the operation succeeded")
    message: str = Field(..., description="Human-readable result message")
    session_id: Optional[str] = Field(
        None, description="UUID of the revoked session"
    )
    revoked_count: Optional[int] = Field(
        None, description="Number of sessions revoked (revoke-all)"
    )
