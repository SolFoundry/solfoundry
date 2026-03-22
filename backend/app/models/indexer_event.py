"""SQLAlchemy model for the indexed events table.

Stores all platform events (Solana on-chain and GitHub activity) in a
queryable PostgreSQL table with proper indexing for time-series queries,
contributor lookups, and bounty-specific filtering.

PostgreSQL partitioning strategy: range partition on ``created_at`` by month.
For MVP, we rely on composite indexes; partitioning can be added via Alembic
when data volume warrants it.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import (
    Column,
    DateTime,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.database import Base


class EventSource(str, Enum):
    """Origin of an indexed event."""

    SOLANA = "solana"
    GITHUB = "github"
    SYSTEM = "system"


class IndexedEventCategory(str, Enum):
    """High-level event categories for filtering."""

    BOUNTY_CREATED = "bounty_created"
    BOUNTY_CLAIMED = "bounty_claimed"
    BOUNTY_COMPLETED = "bounty_completed"
    BOUNTY_CANCELLED = "bounty_cancelled"
    PR_OPENED = "pr_opened"
    PR_MERGED = "pr_merged"
    PR_CLOSED = "pr_closed"
    REVIEW_SUBMITTED = "review_submitted"
    ISSUE_OPENED = "issue_opened"
    ISSUE_CLOSED = "issue_closed"
    ISSUE_LABELED = "issue_labeled"
    PAYOUT_INITIATED = "payout_initiated"
    PAYOUT_CONFIRMED = "payout_confirmed"
    ESCROW_FUNDED = "escrow_funded"
    ESCROW_RELEASED = "escrow_released"
    ESCROW_REFUNDED = "escrow_refunded"
    CONTRIBUTOR_REGISTERED = "contributor_registered"
    REPUTATION_CHANGED = "reputation_changed"


class IndexedEventDB(Base):
    """SQLAlchemy model for the ``indexed_events`` table.

    Stores every platform event with metadata for querying by source,
    category, contributor, bounty, and time range.  Uses PostgreSQL-native
    UUID primary keys and JSONB for flexible payload storage.

    Indexes:
        - ``ix_indexed_events_created_at`` -- time-series range scans.
        - ``ix_indexed_events_source`` -- filter by origin (solana/github).
        - ``ix_indexed_events_category`` -- filter by event category.
        - ``ix_indexed_events_contributor`` -- contributor activity lookups.
        - ``ix_indexed_events_bounty_id`` -- bounty-specific event history.
        - ``ix_indexed_events_source_category_created`` -- composite index
          for the most common query pattern (source + category + time).
    """

    __tablename__ = "indexed_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(20), nullable=False, index=True)
    category = Column(String(50), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    contributor_username = Column(String(100), nullable=True, index=True)
    bounty_id = Column(String(100), nullable=True, index=True)
    bounty_number = Column(Integer, nullable=True)
    transaction_hash = Column(String(128), nullable=True)
    github_url = Column(String(500), nullable=True)
    amount = Column(Numeric(precision=18, scale=2), nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index(
            "ix_indexed_events_source_category_created",
            "source",
            "category",
            "created_at",
        ),
        Index(
            "ix_indexed_events_contributor_created",
            "contributor_username",
            "created_at",
        ),
        Index(
            "ix_indexed_events_bounty_created",
            "bounty_id",
            "created_at",
        ),
    )

    def __repr__(self) -> str:
        """Return a developer-friendly string representation."""
        return (
            f"<IndexedEventDB(id={self.id!r}, source={self.source!r}, "
            f"category={self.category!r})>"
        )


# ---------------------------------------------------------------------------
# Pydantic API schemas
# ---------------------------------------------------------------------------


class IndexedEventCreate(BaseModel):
    """Schema for creating a new indexed event.

    Used internally by the ingestion pipeline to validate event data
    before persisting to PostgreSQL.

    Attributes:
        source: Origin of the event (solana, github, system).
        category: High-level event category for filtering.
        title: Human-readable event title.
        description: Optional longer description of the event.
        contributor_username: GitHub username of the contributor involved.
        bounty_id: Internal bounty identifier (e.g., 'gh-601').
        bounty_number: GitHub issue number for cross-referencing.
        transaction_hash: Solana transaction signature if applicable.
        github_url: URL to the GitHub resource (PR, issue, review).
        amount: Token amount involved (e.g., payout amount in $FNDRY).
        payload: Arbitrary JSON payload for source-specific data.
    """

    source: EventSource
    category: IndexedEventCategory
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    contributor_username: Optional[str] = None
    bounty_id: Optional[str] = None
    bounty_number: Optional[int] = None
    transaction_hash: Optional[str] = None
    github_url: Optional[str] = None
    amount: Optional[Decimal] = None
    payload: Optional[Dict[str, Any]] = None


class IndexedEventResponse(BaseModel):
    """Schema for returning an indexed event in API responses.

    Attributes:
        id: Unique event identifier.
        source: Origin of the event.
        category: Event category.
        title: Human-readable title.
        description: Optional description.
        contributor_username: GitHub username if applicable.
        bounty_id: Internal bounty ID if applicable.
        bounty_number: GitHub issue number if applicable.
        transaction_hash: Solana tx hash if applicable.
        github_url: GitHub URL if applicable.
        amount: Token amount if applicable.
        payload: Additional event data.
        created_at: Timestamp of when the event was indexed.
    """

    id: str
    source: str
    category: str
    title: str
    description: Optional[str] = None
    contributor_username: Optional[str] = None
    bounty_id: Optional[str] = None
    bounty_number: Optional[int] = None
    transaction_hash: Optional[str] = None
    github_url: Optional[str] = None
    amount: Optional[float] = None
    payload: Optional[Dict[str, Any]] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class PaginatedEventResponse(BaseModel):
    """Paginated list of indexed events.

    Attributes:
        items: List of events in the current page.
        total: Total number of matching events.
        page: Current page number (1-based).
        page_size: Number of items per page.
        has_next: Whether more pages exist after this one.
    """

    items: List[IndexedEventResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


class BountyStatsResponse(BaseModel):
    """Bounty listing with aggregated statistics.

    Attributes:
        bounty_id: Internal bounty identifier.
        bounty_number: GitHub issue number.
        title: Bounty title.
        total_claims: Number of times the bounty was claimed.
        total_completions: Number of successful completions.
        total_prs: Number of PRs submitted for this bounty.
        average_review_score: Mean review score across submissions.
        total_payout: Total $FNDRY paid out for this bounty.
        status: Current bounty status.
        created_at: When the bounty was first indexed.
        last_activity_at: Most recent event timestamp.
    """

    bounty_id: str
    bounty_number: Optional[int] = None
    title: str
    total_claims: int = 0
    total_completions: int = 0
    total_prs: int = 0
    average_review_score: Optional[float] = None
    total_payout: float = 0.0
    status: str = "open"
    created_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None


class ContributorProfileResponse(BaseModel):
    """Contributor profile with aggregated statistics from indexed events.

    Attributes:
        username: GitHub username.
        total_events: Total number of events involving this contributor.
        total_prs_opened: PRs opened by this contributor.
        total_prs_merged: PRs merged by this contributor.
        total_bounties_completed: Bounties successfully completed.
        total_earnings: Total $FNDRY earned.
        average_review_score: Mean review score across submissions.
        first_activity_at: Timestamp of first indexed event.
        last_activity_at: Timestamp of most recent event.
        top_categories: Most frequent event categories.
    """

    username: str
    total_events: int = 0
    total_prs_opened: int = 0
    total_prs_merged: int = 0
    total_bounties_completed: int = 0
    total_earnings: float = 0.0
    average_review_score: Optional[float] = None
    first_activity_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    top_categories: List[str] = []


class PlatformAnalyticsResponse(BaseModel):
    """Platform-wide metrics computed from indexed events.

    Attributes:
        total_events: Total number of indexed events.
        total_bounties: Total bounties tracked.
        total_contributors: Unique contributors with activity.
        completion_rate: Percentage of bounties completed vs created.
        average_completion_time_hours: Mean time from creation to completion.
        total_payout: Total $FNDRY paid out across all bounties.
        events_last_24h: Events indexed in the last 24 hours.
        events_last_7d: Events indexed in the last 7 days.
        top_contributors: Top contributors by earnings.
        category_breakdown: Event counts by category.
    """

    total_events: int = 0
    total_bounties: int = 0
    total_contributors: int = 0
    completion_rate: float = 0.0
    average_completion_time_hours: Optional[float] = None
    total_payout: float = 0.0
    events_last_24h: int = 0
    events_last_7d: int = 0
    top_contributors: List[Dict[str, Any]] = []
    category_breakdown: Dict[str, int] = {}


class LeaderboardEntryResponse(BaseModel):
    """Single entry in the event-indexed leaderboard.

    Attributes:
        rank: Position in the leaderboard (1-based).
        username: GitHub username.
        bounties_completed: Number of completed bounties.
        total_earnings: Total $FNDRY earned.
        total_prs_merged: Total PRs merged.
        average_review_score: Mean review score.
        tier: Current contributor tier (1, 2, or 3).
    """

    rank: int
    username: str
    bounties_completed: int = 0
    total_earnings: float = 0.0
    total_prs_merged: int = 0
    average_review_score: Optional[float] = None
    tier: int = 1


class LeaderboardResponse(BaseModel):
    """Paginated leaderboard response.

    Attributes:
        entries: List of leaderboard entries for the current page.
        total: Total number of ranked contributors.
        page: Current page number.
        page_size: Number of entries per page.
    """

    entries: List[LeaderboardEntryResponse]
    total: int
    page: int
    page_size: int
