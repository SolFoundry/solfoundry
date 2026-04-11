"""User model for authentication."""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from pydantic import BaseModel

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
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), 
                        onupdate=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime, nullable=True)


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


class GitHubOAuthRequest(BaseModel):
    """Request model for GitHub OAuth callback."""
    code: str
    state: Optional[str] = None


class GitHubOAuthResponse(BaseModel):
    """Response model for successful GitHub OAuth login."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class WalletAuthRequest(BaseModel):
    """Request model for wallet authentication."""
    wallet_address: str
    signature: str
    message: str
    nonce: Optional[str] = None


class WalletAuthResponse(BaseModel):
    """Response model for successful wallet authentication."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class LinkWalletRequest(BaseModel):
    """Request model for linking a wallet to user account."""
    wallet_address: str
    signature: str
    message: str
    nonce: Optional[str] = None


class LinkWalletResponse(BaseModel):
    """Response model for wallet linking."""
    success: bool
    message: str
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """Request model for token refresh."""
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    """Response model for token refresh."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthMessageResponse(BaseModel):
    """Response model for auth message generation."""
    message: str
    nonce: str
    expires_at: datetime