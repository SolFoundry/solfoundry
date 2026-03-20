"""Pydantic models for the authentication system.

Covers request/response schemas for GitHub OAuth, Solana wallet auth,
JWT token pairs, and user profiles.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class GitHubAuthRequest(BaseModel):
    """Payload sent after GitHub OAuth redirect. State is required for CSRF."""
    code: str = Field(..., description="GitHub OAuth authorization code")
    state: str = Field(..., description="OAuth state token for CSRF protection (required)")

class WalletAuthRequest(BaseModel):
    """Payload for Solana wallet signature-based authentication."""
    wallet_address: str = Field(..., min_length=32, max_length=44)
    signature: str
    nonce: str = Field(..., min_length=8, max_length=64)

class LinkWalletRequest(BaseModel):
    """Payload for linking a Solana wallet to an existing account."""
    wallet_address: str = Field(..., min_length=32, max_length=44)
    signature: str
    nonce: str = Field(..., min_length=8, max_length=64)

class RefreshTokenRequest(BaseModel):
    """Payload for exchanging a refresh token for a new token pair."""
    refresh_token: str

class NonceRequest(BaseModel):
    """Request a challenge nonce for wallet authentication."""
    wallet_address: str = Field(..., min_length=32, max_length=44)

class OAuthStateResponse(BaseModel):
    """Response from the state-generation endpoint."""
    state: str

class TokenPair(BaseModel):
    """JWT access + opaque refresh token pair returned on login."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class NonceResponse(BaseModel):
    """Response containing a fresh nonce and the message to sign."""
    nonce: str
    message: str

class UserResponse(BaseModel):
    """Public-facing user profile returned by GET /me."""
    id: str
    github_id: Optional[int] = None
    username: str
    avatar_url: Optional[str] = None
    wallet_address: Optional[str] = None
    created_at: datetime

class User(BaseModel):
    """Internal user entity stored in the user registry."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    github_id: Optional[int] = None
    username: str
    avatar_url: Optional[str] = None
    wallet_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    def to_response(self) -> UserResponse:
        """Convert to a UserResponse suitable for API serialization."""
        return UserResponse(id=self.id, github_id=self.github_id, username=self.username,
                            avatar_url=self.avatar_url, wallet_address=self.wallet_address, created_at=self.created_at)
