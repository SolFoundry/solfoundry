"""PostgreSQL-backed OAuth state storage for CSRF protection.

Stores OAuth state parameters in the database instead of in-memory dicts
to ensure they survive server restarts, work across multiple workers,
and provide a reliable CSRF protection mechanism for the GitHub OAuth flow.

Each state record has a short TTL (10 minutes) and is consumed on first use,
preventing replay attacks. Expired states are cleaned up periodically.

References:
    - OWASP CSRF Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
    - GitHub OAuth Security: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
"""

from datetime import datetime, timezone, timedelta
from uuid import uuid4

from sqlalchemy import Column, String, DateTime, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from app.database import Base


class OAuthStateDB(Base):
    """SQLAlchemy model for persisting OAuth CSRF state tokens.

    Each row represents a single OAuth authorization attempt. The state
    parameter is sent to GitHub and must be returned unchanged on callback.
    States expire after 10 minutes and are marked as consumed after use.

    Attributes:
        id: Unique UUID primary key for the state record.
        state_token: The cryptographically random state string sent to GitHub.
        created_at: When the state was generated.
        expires_at: When the state becomes invalid (10 minutes after creation).
        consumed: Whether this state has already been used in a callback.
        ip_address: The IP address of the client that initiated the OAuth flow.
    """

    __tablename__ = "oauth_states"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    state_token = Column(
        String(128),
        unique=True,
        nullable=False,
        index=True,
        doc="Cryptographically random state parameter for CSRF protection",
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        doc="Timestamp when the state was generated",
    )
    expires_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc) + timedelta(minutes=10),
        nullable=False,
        doc="Timestamp when the state expires (10 minutes TTL)",
    )
    consumed = Column(
        Boolean,
        default=False,
        nullable=False,
        doc="Whether this state has been consumed by a callback",
    )
    ip_address = Column(
        String(45),
        nullable=True,
        doc="IP address of the client that initiated the OAuth flow",
    )

    __table_args__ = (
        Index("idx_oauth_states_expires", "expires_at"),
        Index("idx_oauth_states_consumed", "consumed"),
    )

    def __repr__(self) -> str:
        """Return a developer-friendly string representation of the state record."""
        return (
            f"<OAuthStateDB(id={self.id}, state_token={self.state_token[:8]}..., "
            f"consumed={self.consumed}, expires_at={self.expires_at})>"
        )
