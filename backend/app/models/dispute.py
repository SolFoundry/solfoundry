"""Dispute database and Pydantic models.

This module defines the data models for the dispute resolution system including
database models (ORM) and API models (Pydantic schemas).

Dispute Lifecycle:
    OPENED → EVIDENCE → MEDIATION → RESOLVED

Dispute Outcomes:
    - RELEASE_TO_CONTRIBUTOR: Bounty reward released to the contributor
    - REFUND_TO_CREATOR: Bounty reward refunded to the bounty creator
    - SPLIT: Reward split between contributor and creator
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey, Index, Integer, Float

from app.database import Base, GUID


class DisputeState(str, Enum):
    """Dispute lifecycle states.

    State transitions:
    - OPENED: Initial state when dispute is created
    - EVIDENCE: Both parties submitting evidence
    - MEDIATION: Under review (AI or manual)
    - RESOLVED: Final decision made
    """
    OPENED = "OPENED"
    EVIDENCE = "EVIDENCE"
    MEDIATION = "MEDIATION"
    RESOLVED = "RESOLVED"


class DisputeOutcome(str, Enum):
    """Dispute resolution outcomes."""
    RELEASE_TO_CONTRIBUTOR = "release_to_contributor"
    REFUND_TO_CREATOR = "refund_to_creator"
    SPLIT = "split"


class DisputeReason(str, Enum):
    """Reasons for disputing a rejection."""
    INCORRECT_REVIEW = "incorrect_review"
    MET_REQUIREMENTS = "met_requirements"
    UNFAIR_REJECTION = "unfair_rejection"
    MISUNDERSTANDING = "misunderstanding"
    TECHNICAL_ISSUE = "technical_issue"
    OTHER = "other"


class EvidenceType(str, Enum):
    """Types of evidence that can be submitted."""
    LINK = "link"
    IMAGE = "image"
    TEXT = "text"
    CODE = "code"
    DOCUMENT = "document"


class DisputeDB(Base):
    """Dispute database model.

    Tracks disputes when contributors believe their submission was unfairly rejected.
    Includes full audit trail and support for AI-assisted mediation.
    """
    __tablename__ = "disputes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)

    # References
    bounty_id = Column(
        GUID(), ForeignKey("bounties.id", ondelete="CASCADE"), nullable=False
    )
    submission_id = Column(
        GUID(), ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False
    )
    contributor_id = Column(GUID(), nullable=False)  # The disputing contributor
    creator_id = Column(GUID(), nullable=False)  # The bounty creator

    # Dispute details
    reason = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)

    # State management
    state = Column(String(20), nullable=False, default="OPENED")
    outcome = Column(String(30), nullable=True)

    # Evidence storage (JSON array of evidence items)
    contributor_evidence = Column(JSON, default=list, nullable=False)
    creator_evidence = Column(JSON, default=list, nullable=False)

    # AI mediation
    ai_review_score = Column(Float, nullable=True)  # 0.0 to 10.0
    ai_review_notes = Column(Text, nullable=True)
    auto_resolved = Column(Integer, default=0)  # 0 = no, 1 = yes

    # Manual resolution
    resolver_id = Column(GUID(), nullable=True)  # Admin who resolved
    resolution_notes = Column(Text, nullable=True)

    # Reputation impact
    creator_reputation_penalty = Column(Float, default=0.0)
    contributor_reputation_penalty = Column(Float, default=0.0)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    evidence_deadline = Column(DateTime(timezone=True), nullable=True)  # 72h from creation
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_disputes_bounty_id", bounty_id),
        Index("ix_disputes_submission_id", submission_id),
        Index("ix_disputes_contributor_id", contributor_id),
        Index("ix_disputes_creator_id", creator_id),
        Index("ix_disputes_state", state),
        Index("ix_disputes_created_at", created_at),
    )


class DisputeHistoryDB(Base):
    """Dispute history audit trail.

    Records all state transitions and actions taken on a dispute.
    """
    __tablename__ = "dispute_history"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    dispute_id = Column(
        GUID(), ForeignKey("disputes.id", ondelete="CASCADE"), nullable=False
    )
    action = Column(String(50), nullable=False)
    previous_state = Column(String(20), nullable=True)
    new_state = Column(String(20), nullable=True)
    actor_id = Column(GUID(), nullable=False)
    actor_role = Column(String(20), nullable=False)  # contributor, creator, admin, system
    notes = Column(Text, nullable=True)
    metadata = Column(JSON, nullable=True)  # Additional context
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_dispute_history_dispute_id", dispute_id),
        Index("ix_dispute_history_created_at", created_at),
    )


# Pydantic Models

class EvidenceItem(BaseModel):
    """Evidence item submitted by a party."""
    type: EvidenceType
    url: Optional[str] = Field(None, max_length=2000)
    description: str = Field(..., min_length=1, max_length=2000)
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    submitted_by: str  # contributor or creator


class DisputeBase(BaseModel):
    """Base fields for dispute creation."""
    reason: DisputeReason
    description: str = Field(..., min_length=10, max_length=5000)
    initial_evidence: List[EvidenceItem] = Field(default_factory=list)


class DisputeCreate(DisputeBase):
    """Schema for creating a new dispute."""
    bounty_id: str = Field(..., description="ID of the bounty")
    submission_id: str = Field(..., description="ID of the rejected submission")


class EvidenceSubmission(BaseModel):
    """Schema for submitting evidence to a dispute."""
    evidence: List[EvidenceItem] = Field(..., min_length=1)


class DisputeResolve(BaseModel):
    """Schema for resolving a dispute."""
    outcome: DisputeOutcome
    resolution_notes: str = Field(..., min_length=1, max_length=5000)
    creator_penalty: Optional[float] = Field(0.0, ge=0, le=100)
    contributor_penalty: Optional[float] = Field(0.0, ge=0, le=100)


class DisputeTransition(BaseModel):
    """Schema for state transitions."""
    new_state: DisputeState
    notes: Optional[str] = Field(None, max_length=2000)


class DisputeResponse(BaseModel):
    """Full dispute response."""
    id: str
    bounty_id: str
    submission_id: str
    contributor_id: str
    creator_id: str
    reason: str
    description: str
    state: str
    outcome: Optional[str] = None
    contributor_evidence: List[dict] = []
    creator_evidence: List[dict] = []
    ai_review_score: Optional[float] = None
    ai_review_notes: Optional[str] = None
    auto_resolved: bool = False
    resolver_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    creator_reputation_penalty: float = 0.0
    contributor_reputation_penalty: float = 0.0
    created_at: datetime
    evidence_deadline: Optional[datetime] = None
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DisputeListItem(BaseModel):
    """Brief dispute info for list views."""
    id: str
    bounty_id: str
    submission_id: str
    contributor_id: str
    creator_id: str
    reason: str
    state: str
    outcome: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DisputeListResponse(BaseModel):
    """Paginated dispute list response."""
    items: List[DisputeListItem]
    total: int
    skip: int
    limit: int


class DisputeHistoryItem(BaseModel):
    """Dispute history item."""
    id: str
    dispute_id: str
    action: str
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    actor_id: str
    actor_role: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DisputeDetailResponse(DisputeResponse):
    """Detailed dispute response with history."""
    history: List[DisputeHistoryItem] = []


class DisputeStats(BaseModel):
    """Dispute statistics."""
    total_disputes: int = 0
    opened_disputes: int = 0
    evidence_disputes: int = 0
    mediation_disputes: int = 0
    resolved_disputes: int = 0
    contributor_wins: int = 0
    creator_wins: int = 0
    splits: int = 0
    auto_resolved_count: int = 0
    manual_resolved_count: int = 0
    avg_resolution_time_hours: float = 0.0