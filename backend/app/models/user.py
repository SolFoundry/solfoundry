"""User model for authentication."""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pydantic import BaseModel, Field

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    github_id = Column(String(64), unique=True, nullable=False, index=True)
    username = Column(String(128), nullable=False)
    email = Column(String(256), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    wallet_address = Column(String(64), unique=True, nullable=True, index=True)
    wallet_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    last_login_at = Column(DateTime, nullable=True)


class UserDB(BaseModel):
    """Pydantic model for user data in tests and services."""

    id: Optional[object] = None
    github_id: str
    username: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    wallet_address: Optional[str] = None
    wallet_verified: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserResponse(BaseModel):
    id: str
    github_id: str
    username: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    wallet_address: Optional[str] = None
    wallet_verified: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Auth request/response models
# ---------------------------------------------------------------------------


class GitHubOAuthRequest(BaseModel):
    """GitHub OAuth callback with authorization code."""
    code: str = Field(..., min_length=1, description="GitHub OAuth authorization code")
    state: Optional[str] = Field(None, description="OAuth state for CSRF protection")


class GitHubOAuthResponse(BaseModel):
    """Response after successful GitHub OAuth."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user: UserResponse


class WalletAuthRequest(BaseModel):
    """Solana wallet signature authentication."""
    wallet_address: str = Field(..., min_length=32, max_length=64)
    signature: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)


class WalletAuthResponse(BaseModel):
    """Response after successful wallet authentication."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user: UserResponse


class LinkWalletRequest(BaseModel):
    """Link a Solana wallet to an existing user."""
    wallet_address: str = Field(..., min_length=32, max_length=64)
    signature: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)


class LinkWalletResponse(BaseModel):
    """Response after linking a wallet."""
    success: bool = True
    wallet_address: str
    message: str = "Wallet linked successfully"


class RefreshTokenRequest(BaseModel):
    """Refresh token exchange."""
    refresh_token: str = Field(..., min_length=1)


class RefreshTokenResponse(BaseModel):
    """New access token from refresh."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


class AuthMessageResponse(BaseModel):
    """Challenge message for wallet signature verification."""
    message: str
    nonce: str


# Legacy aliases
TokenRefreshRequest = RefreshTokenRequest
TokenRefreshResponse = RefreshTokenResponse
