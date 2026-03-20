"""User database and Pydantic models for authentication.

This module provides the User model with GitHub OAuth and Solana wallet support.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class UserDB(Base):
    """Database model for users with GitHub OAuth and Solana wallet support."""
    
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    github_id = Column(String(50), unique=True, nullable=False, index=True)
    username = Column(String(100), nullable=False, index=True)
    email = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    wallet_address = Column(String(100), unique=True, nullable=True, index=True)
    wallet_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    last_login_at = Column(DateTime(timezone=True), nullable=True)


# Pydantic models for API

class UserBase(BaseModel):
    """Base user model with common fields."""
    username: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    """Model for creating a new user from GitHub OAuth."""
    github_id: str = Field(..., min_length=1, max_length=50)


class UserResponse(UserBase):
    """Response model for user data."""
    id: str
    github_id: str
    wallet_address: Optional[str] = None
    wallet_verified: bool = False
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class UserWithWalletResponse(UserResponse):
    """Response model for user data with wallet details."""
    wallet_linked: bool = False


class GitHubOAuthRequest(BaseModel):
    """Request model for GitHub OAuth callback."""
    code: str = Field(..., min_length=1, description="GitHub OAuth authorization code")
    state: Optional[str] = Field(None, description="Optional state parameter for CSRF protection")


class GitHubOAuthResponse(BaseModel):
    """Response model for successful GitHub OAuth."""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer")
    expires_in: int = Field(default=3600, description="Access token expiry in seconds")
    user: UserResponse


class WalletAuthRequest(BaseModel):
    """Request model for Solana wallet authentication."""
    wallet_address: str = Field(..., min_length=32, max_length=100, description="Solana wallet address")
    signature: str = Field(..., min_length=1, description="Base64-encoded signature")
    message: str = Field(..., min_length=1, description="Message that was signed")


class WalletAuthResponse(BaseModel):
    """Response model for successful wallet authentication."""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer")
    expires_in: int = Field(default=3600, description="Access token expiry in seconds")
    user: UserResponse


class LinkWalletRequest(BaseModel):
    """Request model for linking a wallet to an existing account."""
    wallet_address: str = Field(..., min_length=32, max_length=100, description="Solana wallet address")
    signature: str = Field(..., min_length=1, description="Base64-encoded signature")
    message: str = Field(..., min_length=1, description="Message that was signed")


class LinkWalletResponse(BaseModel):
    """Response model for successful wallet linking."""
    success: bool = True
    message: str = "Wallet linked successfully"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """Request model for refreshing access token."""
    refresh_token: str = Field(..., min_length=1, description="JWT refresh token")


class RefreshTokenResponse(BaseModel):
    """Response model for token refresh."""
    access_token: str = Field(..., description="New JWT access token")
    token_type: str = Field(default="bearer")
    expires_in: int = Field(default=3600, description="Access token expiry in seconds")


class AuthMessageResponse(BaseModel):
    """Response model for auth message to sign."""
    message: str = Field(..., description="Message to sign for wallet authentication")
    nonce: str = Field(..., description="Unique nonce for this auth request")
    expires_at: datetime = Field(..., description="When this message expires")