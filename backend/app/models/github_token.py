"""PostgreSQL-backed encrypted GitHub token storage.

Stores GitHub OAuth access tokens in encrypted form so they can be:
- Used for API calls on behalf of the user (e.g., fetching repos)
- Revoked when the user disconnects their GitHub account
- Rotated when tokens are refreshed

Tokens are encrypted at rest using Fernet symmetric encryption with a
key derived from the JWT_SECRET_KEY. This prevents token exposure even
if the database is compromised.

PostgreSQL schema:
    CREATE TABLE github_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        encrypted_token TEXT NOT NULL,
        github_user_id VARCHAR(64) NOT NULL,
        github_username VARCHAR(128) NOT NULL,
        scopes VARCHAR(256) NOT NULL DEFAULT 'read:user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        UNIQUE(user_id)
    );
    CREATE INDEX idx_github_tokens_user ON github_tokens(user_id);
    CREATE INDEX idx_github_tokens_active ON github_tokens(is_active);

References:
    - OWASP Cryptographic Storage: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Boolean, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.database import Base


class GitHubTokenDB(Base):
    """SQLAlchemy model for storing encrypted GitHub OAuth access tokens.

    Each user can have at most one active GitHub token. When a user
    re-authorizes, the old token is revoked and replaced. Tokens are
    encrypted at rest using Fernet symmetric encryption.

    Attributes:
        id: Unique UUID primary key.
        user_id: Foreign key to the users table.
        encrypted_token: The Fernet-encrypted GitHub access token.
        github_user_id: The GitHub user's numeric ID (as string).
        github_username: The GitHub user's login handle.
        scopes: Comma-separated list of OAuth scopes granted.
        created_at: When the token was first stored.
        updated_at: When the token was last updated or rotated.
        revoked_at: When the token was revoked (None if still active).
        is_active: Whether the token is currently valid and usable.
    """

    __tablename__ = "github_tokens"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        doc="Foreign key to the owning user",
    )
    encrypted_token = Column(
        Text,
        nullable=False,
        doc="Fernet-encrypted GitHub OAuth access token",
    )
    github_user_id = Column(
        String(64),
        nullable=False,
        doc="GitHub user's numeric ID",
    )
    github_username = Column(
        String(128),
        nullable=False,
        doc="GitHub user's login handle",
    )
    scopes = Column(
        String(256),
        nullable=False,
        default="read:user",
        doc="Comma-separated list of OAuth scopes",
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        doc="When the token was first stored",
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        doc="When the token record was last modified",
    )
    revoked_at = Column(
        DateTime(timezone=True),
        nullable=True,
        doc="When the token was revoked (null if still active)",
    )
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        doc="Whether the token is currently valid",
    )

    __table_args__ = (
        Index("idx_github_tokens_user_id", "user_id"),
        Index("idx_github_tokens_active", "is_active"),
    )

    def __repr__(self) -> str:
        """Return a developer-friendly string representation of the token record."""
        return (
            f"<GitHubTokenDB(id={self.id}, user_id={self.user_id}, "
            f"github_username={self.github_username}, is_active={self.is_active})>"
        )
