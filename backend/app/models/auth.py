"""Auth models for GitHub OAuth + Wallet authentication."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class GitHubAuthRequest(BaseModel):
    code: str = Field(..., description="GitHub OAuth authorization code")
    state: Optional[str] = Field(None, description="OAuth state param for CSRF protection")

class WalletAuthRequest(BaseModel):
    wallet_address: str = Field(..., min_length=32, max_length=44)
    signature: str
    nonce: str = Field(..., min_length=8, max_length=64)

class LinkWalletRequest(BaseModel):
    wallet_address: str = Field(..., min_length=32, max_length=44)
    signature: str
    nonce: str = Field(..., min_length=8, max_length=64)

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class NonceRequest(BaseModel):
    wallet_address: str = Field(..., min_length=32, max_length=44)

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class NonceResponse(BaseModel):
    nonce: str
    message: str

class UserResponse(BaseModel):
    id: str
    github_id: Optional[int] = None
    username: str
    avatar_url: Optional[str] = None
    wallet_address: Optional[str] = None
    created_at: datetime

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    github_id: Optional[int] = None
    username: str
    avatar_url: Optional[str] = None
    wallet_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    def to_response(self) -> UserResponse:
        return UserResponse(id=self.id, github_id=self.github_id, username=self.username,
                            avatar_url=self.avatar_url, wallet_address=self.wallet_address, created_at=self.created_at)
