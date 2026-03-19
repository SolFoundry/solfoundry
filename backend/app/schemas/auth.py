"""Authentication schemas."""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class GitHubCallback(BaseModel):
    """GitHub OAuth callback."""
    code: str
    state: Optional[str] = None


class WalletAuth(BaseModel):
    """Wallet authentication request."""
    wallet_address: str
    signature: str
    message: str


class LinkWallet(BaseModel):
    """Link wallet to GitHub account."""
    wallet_address: str
    signature: str
    message: str


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """User response schema."""
    id: int
    github_id: Optional[str]
    username: str
    avatar_url: Optional[str]
    wallet_address: Optional[str]
    email: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
