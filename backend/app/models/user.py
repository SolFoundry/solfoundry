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
    id: str = Field(..., description="Unique user UUID", examples=["550e8400-e29b-41d4-a716-446655440000"])
    github_id: str = Field(..., description="GitHub numeric user ID", examples=["12345678"])
    username: str = Field(..., description="GitHub username", examples=["alice"])
    email: Optional[str] = Field(None, description="GitHub email (if public)", examples=["alice@example.com"])
    avatar_url: Optional[str] = Field(None, description="GitHub avatar URL", examples=["https://avatars.githubusercontent.com/u/12345678"])
    wallet_address: Optional[str] = Field(None, description="Linked Solana wallet address (base-58)", examples=["7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"])
    wallet_verified: bool = Field(False, description="Whether the wallet signature has been verified")
    created_at: datetime = Field(..., description="Account creation timestamp (UTC)")
    updated_at: datetime = Field(..., description="Last profile update timestamp (UTC)")

    class Config:
        from_attributes = True

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "github_id": "12345678",
                "username": "alice",
                "email": "alice@example.com",
                "avatar_url": "https://avatars.githubusercontent.com/u/12345678",
                "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                "wallet_verified": True,
                "created_at": "2024-01-15T10:30:00Z",
                "updated_at": "2024-01-20T08:15:00Z",
            }
        }
    }


# ---------------------------------------------------------------------------
# Auth request/response models
# ---------------------------------------------------------------------------


class GitHubOAuthRequest(BaseModel):
    """GitHub OAuth callback with authorization code."""
    code: str = Field(
        ...,
        min_length=1,
        description="GitHub OAuth authorization code from the callback redirect",
        examples=["gho_16C7e42F292c6912E7710c838347Ae178B4a"],
    )
    state: Optional[str] = Field(
        None,
        description="OAuth state token (CSRF protection) — must match what was returned by GET /auth/github/authorize",
        examples=["a1b2c3d4e5f6"],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "code": "gho_16C7e42F292c6912E7710c838347Ae178B4a",
                "state": "a1b2c3d4e5f6",
            }
        }
    }


class GitHubOAuthResponse(BaseModel):
    """Response after successful GitHub OAuth."""
    access_token: str = Field(..., description="JWT access token — valid for 1 hour")
    refresh_token: str = Field(..., description="JWT refresh token — valid for 7 days")
    token_type: str = Field("bearer", description="Token type — always 'bearer'")
    expires_in: int = Field(3600, description="Access token lifetime in seconds")
    user: UserResponse = Field(..., description="Authenticated user profile")

    model_config = {
        "json_schema_extra": {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMCIsInR5cGUiOiJhY2Nlc3MifQ.sig",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMCIsInR5cGUiOiJyZWZyZXNoIn0.sig",
                "token_type": "bearer",
                "expires_in": 3600,
                "user": {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "github_id": "12345678",
                    "username": "alice",
                    "email": "alice@example.com",
                    "avatar_url": "https://avatars.githubusercontent.com/u/12345678",
                    "wallet_address": None,
                    "wallet_verified": False,
                    "created_at": "2024-01-15T10:30:00Z",
                    "updated_at": "2024-01-15T10:30:00Z",
                },
            }
        }
    }


class WalletAuthRequest(BaseModel):
    """Solana wallet signature authentication."""
    wallet_address: str = Field(
        ...,
        min_length=32,
        max_length=64,
        description="Solana wallet address (base-58 encoded, 32–44 chars)",
        examples=["7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"],
    )
    signature: str = Field(
        ...,
        min_length=1,
        description="Base64-encoded Ed25519 signature of the challenge message",
        examples=["3yZe7d9...encoded_signature"],
    )
    message: str = Field(
        ...,
        min_length=1,
        description="The exact challenge message string returned by GET /auth/wallet/message",
        examples=["Sign in to SolFoundry\n\nWallet: 7xKXtg...\nNonce: a1b2c3\nTimestamp: 2024-01-15T10:30:00Z"],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                "signature": "3yZe7d9Xk2mLpQrNvBcHfJTsAuWeDgYoPiRtMnCbVEFqhSzIjUxOlKwGd4a8",
                "message": "Sign in to SolFoundry\n\nWallet: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\nNonce: a1b2c3d4\nTimestamp: 2024-01-15T10:30:00Z",
            }
        }
    }


class WalletAuthResponse(BaseModel):
    """Response after successful wallet authentication."""
    access_token: str = Field(..., description="JWT access token — valid for 1 hour")
    refresh_token: str = Field(..., description="JWT refresh token — valid for 7 days")
    token_type: str = Field("bearer", description="Token type — always 'bearer'")
    expires_in: int = Field(3600, description="Access token lifetime in seconds")
    user: UserResponse = Field(..., description="Authenticated user profile")


class LinkWalletRequest(BaseModel):
    """Link a Solana wallet to an existing user."""
    wallet_address: str = Field(
        ...,
        min_length=32,
        max_length=64,
        description="Solana wallet address to link (base-58, 32–44 chars)",
        examples=["7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"],
    )
    signature: str = Field(
        ...,
        min_length=1,
        description="Base64-encoded Ed25519 signature of the challenge message",
    )
    message: str = Field(
        ...,
        min_length=1,
        description="The exact challenge message string from GET /auth/wallet/message",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                "signature": "3yZe7d9Xk2mLpQrNvBcHfJTsAuWeDgYoPiRtMnCbVEFqhSzIjUxOlKwGd4a8",
                "message": "Sign in to SolFoundry\n\nWallet: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\nNonce: b2c3d4e5\nTimestamp: 2024-01-15T11:00:00Z",
            }
        }
    }


class LinkWalletResponse(BaseModel):
    """Response after linking a wallet."""
    success: bool = Field(True, description="Whether the link succeeded")
    wallet_address: str = Field(..., description="The linked wallet address")
    message: str = Field("Wallet linked successfully", description="Human-readable status message")

    model_config = {
        "json_schema_extra": {
            "example": {
                "success": True,
                "wallet_address": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
                "message": "Wallet linked successfully",
            }
        }
    }


class RefreshTokenRequest(BaseModel):
    """Refresh token exchange."""
    refresh_token: str = Field(
        ...,
        min_length=1,
        description="JWT refresh token received during login — valid for 7 days",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMCIsInR5cGUiOiJyZWZyZXNoIn0.sig"
            }
        }
    }


class RefreshTokenResponse(BaseModel):
    """New access token from refresh."""
    access_token: str = Field(..., description="New JWT access token — valid for 1 hour")
    token_type: str = Field("bearer", description="Token type — always 'bearer'")
    expires_in: int = Field(3600, description="Access token lifetime in seconds")

    model_config = {
        "json_schema_extra": {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMCIsInR5cGUiOiJhY2Nlc3MifQ.newsig",
                "token_type": "bearer",
                "expires_in": 3600,
            }
        }
    }


class AuthMessageResponse(BaseModel):
    """Challenge message for wallet signature verification."""
    message: str = Field(
        ...,
        description="The message string to sign with your Solana wallet",
        examples=["Sign in to SolFoundry\n\nWallet: 7xKXtg...\nNonce: a1b2c3\nTimestamp: 2024-01-15T10:30:00Z"],
    )
    nonce: str = Field(
        ...,
        description="The nonce embedded in the message (for reference)",
        examples=["a1b2c3d4e5f6"],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "message": "Sign in to SolFoundry\n\nWallet: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU\nNonce: a1b2c3d4\nTimestamp: 2024-01-15T10:30:00Z",
                "nonce": "a1b2c3d4e5f6",
            }
        }
    }


# Legacy aliases
TokenRefreshRequest = RefreshTokenRequest
TokenRefreshResponse = RefreshTokenResponse
