"""User model for authentication."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class User(BaseModel):
    """Represents a SolFoundry user."""
    id: str
    github_id: Optional[int] = None
    username: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    wallet_address: Optional[str] = None
    wallet_verified: bool = False
    created_at: Optional[datetime] = None


class GitHubTokenRequest(BaseModel):
    """Request body for exchanging a GitHub OAuth code."""
    code: str
    state: Optional[str] = None


class AuthTokens(BaseModel):
    """JWT token pair."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class GitHubCallbackResponse(AuthTokens):
    """Full response after GitHub OAuth callback."""
    user: User


class AuthorizeResponse(BaseModel):
    """GitHub authorize URL response."""
    authorize_url: str
