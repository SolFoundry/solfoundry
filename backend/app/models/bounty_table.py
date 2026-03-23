"""SQLAlchemy ORM model for the bounties table.

Supports full-text search via a tsvector column (PostgreSQL) with a
fallback Text column for SQLite in tests. Monetary columns use
sa.Numeric for precision.
"""

import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    Text,
    Index,
    JSON,
)
from sqlalchemy.orm import relationship
from app.database import Base, GUID


class BountyTable(Base):
    """Persistent bounty record stored in PostgreSQL.

    Serves as the authoritative source of truth for bounty data.
    In-memory caches may sit in front of this table for performance
    but all reads ultimately resolve here.
    """

    __tablename__ = "bounties"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    project_name = Column(String(100), nullable=True)
    description = Column(Text, nullable=False, server_default="")
    tier = Column(Integer, nullable=False, default=2)
    reward_amount = Column(sa.Numeric(precision=20, scale=6), nullable=False)
    status = Column(String(20), nullable=False, default="open")
    category = Column(String(50), nullable=True)
    creator_type = Column(String(20), nullable=False, server_default="platform")
    github_issue_url = Column(String(512), nullable=True)
    github_issue_number = Column(Integer, nullable=True)
    skills = Column(JSON, nullable=False, default=list)
    deadline = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(100), nullable=False, server_default="system")
    submission_count = Column(Integer, nullable=False, server_default="0")
    popularity = Column(Integer, nullable=False, server_default="0")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    search_vector = Column(
        Text, nullable=True
    )  # Fallback for SQLite; TSVECTOR is PG-only

    submissions = relationship(
        "BountySubmissionTable", back_populates="bounty", cascade="all, delete-orphan"
    )

    @property
    def required_skills(self):
        """Alias for skills to maintain compatibility with Pydantic models."""
        return self.skills

    @required_skills.setter
    def required_skills(self, value):
        self.skills = value

    __table_args__ = (
        Index("ix_bounties_search_vector", search_vector),
        Index("ix_bounties_tier_status", tier, status),
        Index("ix_bounties_category_status", category, status),
        Index("ix_bounties_reward", reward_amount),
        Index("ix_bounties_deadline", deadline),
        Index("ix_bounties_popularity", popularity),
    )


# Alias for backward compatibility with existing tests and services
BountyDB = BountyTable
