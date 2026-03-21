"""Bounty submission database and Pydantic models.

This module defines the data models for the bounty submission system including
database models (ORM) and API models (Pydantic schemas).

Submissions track PRs submitted by contributors to claim bounties.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, String, DateTime, JSON, Float, Integer, Text, Index
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SubmissionStatus(str, Enum):
    """Submission lifecycle status."""

    PENDING = "pending"  # Submitted, awaiting review
    MATCHED = "matched"  # Auto-matched to a bounty
    REVIEWING = "reviewing"  # Under manual review
    APPROVED = "approved"  # Approved, pending payout
    REJECTED = "rejected"  # Rejected
    PAID = "paid"  # Payout completed
    DISPUTED = "disputed"  # Under dispute


class MatchConfidence(str, Enum):
    """Auto-matching confidence level."""

    HIGH = "high"  # >0.9 confidence - direct match
    MEDIUM = "medium"  # 0.7-0.9 confidence - likely match
    LOW = "low"  # <0.7 confidence - needs manual review


class SubmissionDB(Base):
    """
    Bounty submission database model.

    Tracks PR submissions for bounties including status,
    auto-matching results, and payout information.
    """

    __tablename__ = "submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Contributor information
    contributor_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    contributor_wallet = Column(String(64), nullable=False, index=True)

    # PR information
    pr_url = Column(String(500), nullable=False)
    pr_number = Column(Integer, nullable=True)
    pr_repo = Column(String(255), nullable=True)  # owner/repo format
    pr_status = Column(String(50), nullable=True)  # open, merged, closed
    pr_merged_at = Column(DateTime(timezone=True), nullable=True)

    # Bounty matching
    bounty_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    match_confidence = Column(String(20), nullable=True)  # high, medium, low
    match_score = Column(Float, nullable=True)  # 0.0-1.0
    match_reasons = Column(JSON, default=list, nullable=False)  # Why matched

    # Submission status
    status = Column(String(20), nullable=False, default="pending", index=True)
    review_notes = Column(Text, nullable=True)
    reviewer_id = Column(UUID(as_uuid=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Payout information
    reward_amount = Column(Float, nullable=True)
    reward_token = Column(String(20), nullable=True)
    payout_tx_hash = Column(String(128), nullable=True)
    payout_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    description = Column(Text, nullable=True)  # Contributor's description
    evidence = Column(JSON, default=list, nullable=False)  # Screenshots, links, etc.

    # Timestamps
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        Index("ix_submissions_contributor_status", contributor_id, status),
        Index("ix_submissions_bounty_status", bounty_id, status),
        Index("ix_submissions_status_created", status, created_at),
        Index("ix_submissions_wallet_status", contributor_wallet, status),
    )


# Pydantic models


class SubmissionBase(BaseModel):
    """Base fields shared across submission schemas."""

    pr_url: str = Field(..., min_length=10, max_length=500)
    description: Optional[str] = Field(None, max_length=2000)
    evidence: List[str] = Field(
        default_factory=list, description="Links to screenshots, videos, etc."
    )

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        """Validate GitHub PR URL format."""
        if not v.startswith(("https://github.com/", "http://github.com/")):
            raise ValueError("PR URL must be a valid GitHub URL")
        if "/pull/" not in v:
            raise ValueError("URL must be a pull request URL (containing /pull/)")
        return v


class SubmissionCreate(SubmissionBase):
    """Schema for creating a new submission."""

    bounty_id: Optional[str] = Field(
        None, description="Pre-selected bounty ID (optional)"
    )
    contributor_wallet: str = Field(
        ..., min_length=32, max_length=64, description="Wallet address for payout"
    )


class SubmissionUpdate(BaseModel):
    """Schema for updating a submission."""

    status: Optional[str] = None
    review_notes: Optional[str] = None
    bounty_id: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """The validate_status function."""
        valid_statuses = {s.value for s in SubmissionStatus}
        if v is not None and v not in valid_statuses:
            raise ValueError(f"Invalid status: {v}. Must be one of: {valid_statuses}")
        return v


class MatchResult(BaseModel):
    """Auto-matching result."""

    bounty_id: str
    bounty_title: str
    match_score: float = Field(..., ge=0.0, le=1.0)
    confidence: str
    reasons: List[str]
    github_issue_url: Optional[str] = None


class SubmissionResponse(SubmissionBase):
    """Full submission response."""

    id: str = Field(..., description="Unique submission ID", examples=["uuid-789"])
    contributor_id: str = Field(..., description="ID of the contributor user", examples=["uuid-123"])
    contributor_wallet: str = Field(..., description="Solana wallet address of the contributor", examples=["BSz85..."])
    pr_number: Optional[int] = Field(None, description="GitHub PR number", examples=[42])
    pr_repo: Optional[str] = Field(None, description="GitHub repository name (owner/repo)", examples=["solfoundry/solfoundry"])
    pr_status: Optional[str] = Field(None, description="Current status of the GitHub PR", examples=["open", "merged", "closed"])
    pr_merged_at: Optional[datetime] = Field(None, description="Timestamp when the PR was merged")
    bounty_id: Optional[str] = Field(None, description="ID of the bounty this submission is for", examples=["uuid-456"])
    match_confidence: Optional[str] = Field(None, description="Auto-matching confidence level", examples=["high", "medium", "low"])
    match_score: Optional[float] = Field(None, description="Auto-matching score (0-1)", examples=[0.95])
    match_reasons: List[str] = Field(default_factory=list, description="Reasoning for auto-matching", examples=[["Mentioned bounty ID in PR description"]])
    status: str = Field(..., description="Current lifecycle status of the submission", examples=["pending", "approved", "paid"])
    review_notes: Optional[str] = Field(None, description="Notes from the bounty creator's review", examples=["Great work, approved!"])
    reviewer_id: Optional[str] = Field(None, description="ID of the user who reviewed this submission", examples=["uuid-111"])
    reviewed_at: Optional[datetime] = Field(None, description="Timestamp of the review")
    reward_amount: Optional[float] = Field(None, description="Amount of reward to be paid", examples=[1.5])
    reward_token: Optional[str] = Field(None, description="Token symbol for reward", examples=["SOL", "USDC"])
    payout_tx_hash: Optional[str] = Field(None, description="Solana transaction hash for the payout", examples=["5G..."])
    payout_at: Optional[datetime] = Field(None, description="Timestamp of the payout")
    created_at: datetime = Field(..., description="Submission creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    model_config = {"from_attributes": True}


class SubmissionListItem(BaseModel):
    """Brief submission info for list views."""

    id: str = Field(..., description="Unique submission ID", examples=["uuid-789"])
    contributor_wallet: str = Field(..., description="Contributor's Solana wallet", examples=["BSz85..."])
    pr_url: str = Field(..., description="Link to the GitHub Pull Request", examples=["https://github.com/org/repo/pull/42"])
    pr_number: Optional[int] = Field(None, description="GitHub PR number", examples=[42])
    pr_repo: Optional[str] = Field(None, description="GitHub repository name", examples=["solfoundry/solfoundry"])
    bounty_id: Optional[str] = Field(None, description="Bounty ID", examples=["uuid-456"])
    match_confidence: Optional[str] = Field(None, description="Match confidence", examples=["high"])
    status: str = Field(..., description="Submission status", examples=["pending"])
    reward_amount: Optional[float] = Field(None, description="Reward amount", examples=[1.5])
    reward_token: Optional[str] = Field(None, description="Reward token", examples=["SOL"])
    created_at: datetime = Field(..., description="Creation timestamp")

    model_config = {"from_attributes": True}


class SubmissionListResponse(BaseModel):
    """Paginated submission list response."""

    items: List[SubmissionListItem]
    total: int
    skip: int
    limit: int


class SubmissionSearchParams(BaseModel):
    """Parameters for submission search endpoint."""

    contributor_id: Optional[str] = None
    bounty_id: Optional[str] = None
    status: Optional[str] = None
    wallet: Optional[str] = None
    sort: str = Field("newest", pattern="^(newest|oldest|status|reward)$")
    skip: int = Field(0, ge=0)
    limit: int = Field(20, ge=1, le=100)


class SubmissionStats(BaseModel):
    """Submission statistics for a contributor."""

    total_submissions: int = 0
    pending: int = 0
    approved: int = 0
    rejected: int = 0
    paid: int = 0
    total_earnings: float = 0.0
    approval_rate: float = 0.0
