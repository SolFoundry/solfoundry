"""Contributor database table and Pydantic API schemas.

Defines the SQLAlchemy ORM model for the ``contributors`` table and the
Pydantic schemas used by the REST API.  The table stores contributor
profiles, aggregated stats (earnings, bounties completed, reputation),
and metadata (skills, badges, social links).

PostgreSQL migration: managed by Alembic (see ``alembic/versions/``).
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ContributorTable(Base):
    """SQLAlchemy model for the ``contributors`` table.

    Stores contributor profiles with aggregated stats.  Uses ``Numeric``
    for earnings to avoid floating-point rounding errors on financial
    values.  JSON columns store variable-length lists (skills, badges)
    and free-form dicts (social_links).

    Indexes:
        - ``ix_contributors_username`` -- unique lookup by GitHub handle.
        - ``ix_contributors_reputation_earnings`` -- composite index for
          leaderboard ORDER BY queries.
    """

    __tablename__ = "contributors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    skills = Column(JSON, default=list, nullable=False)
    badges = Column(JSON, default=list, nullable=False)
    social_links = Column(JSON, default=dict, nullable=False)
    total_contributions = Column(Integer, default=0, nullable=False)
    total_bounties_completed = Column(Integer, default=0, nullable=False)
    total_earnings = Column(Numeric(precision=18, scale=2), default=0, nullable=False)
    reputation_score = Column(Float, default=0.0, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index(
            "ix_contributors_reputation_earnings",
            "total_earnings",
            "reputation_score",
        ),
    )

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return (
            f"<ContributorTable(id={self.id!r}, username={self.username!r})>"
        )


# Keep backward-compatible alias so existing imports still work
ContributorDB = ContributorTable


# ---------------------------------------------------------------------------
# Pydantic API schemas -- these define the public contract and MUST NOT change
# ---------------------------------------------------------------------------


class ContributorBase(BaseModel):
    """Shared fields for contributor create and response schemas.

    Contains optional profile metadata.  ``display_name`` is required;
    everything else is optional with sensible defaults.
    """

    display_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    skills: list[str] = []
    badges: list[str] = []
    social_links: dict = {}


class ContributorCreate(ContributorBase):
    """Schema for POST /contributors -- creates a new contributor profile.

    ``username`` must be 3-50 alphanumeric characters (plus ``-`` and ``_``).
    """

    username: str = Field(
        ..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$"
    )


class ContributorUpdate(BaseModel):
    """Schema for PATCH /contributors/{id} -- partial profile update.

    All fields are optional.  Only provided fields are applied.
    """

    display_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[list[str]] = None
    badges: Optional[list[str]] = None
    social_links: Optional[dict] = None


class BadgeStats(BaseModel):
    """Statistics for contributor badges and achievements."""
    merged_pr_count: int = 0
    merged_without_revision_count: int = 0
    is_top_contributor_this_month: bool = False
    pr_submission_timestamps_utc: list[datetime] = []


class ContributorStats(BaseModel):
    """Aggregated statistics embedded in contributor API responses.

    Returned as a nested object under ``stats`` in both single and list
    endpoints so the frontend can render counters without extra calls.
    """

    total_contributions: int = 0
    total_bounties_completed: int = 0
    total_earnings: float = 0.0
    reputation_score: float = 0.0


class ContributorResponse(ContributorBase):
    """Full contributor profile returned by GET /contributors/{id}.

    Includes all base fields plus ``id``, ``username``, nested ``stats``,
    and timestamps.
    """

    id: str
    username: str
    stats: ContributorStats
    badge_stats: BadgeStats = Field(default_factory=BadgeStats)
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ContributorListItem(BaseModel):
    """Lightweight contributor summary for list endpoints.

    Omits email, bio, and social_links to reduce payload size on
    paginated list responses.
    """

    id: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    skills: list[str] = []
    badges: list[str] = []
    stats: ContributorStats
    model_config = {"from_attributes": True}


class ContributorListResponse(BaseModel):
    """Paginated list of contributors returned by GET /contributors.

    Includes the full result count for frontend pagination controls.
    """

    items: list[ContributorListItem]
    total: int
    skip: int
    limit: int
