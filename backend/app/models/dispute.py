"""Dispute database and Pydantic models for Issue #192.

Defines the data models for the dispute resolution system including
SQLAlchemy ORM models (DisputeDB, DisputeHistoryDB) and Pydantic
API schemas (DisputeCreate, DisputeResponse, etc.).

State machine: OPENED -> EVIDENCE -> MEDIATION -> RESOLVED

Resolution outcomes:
    - release_to_contributor: Contributor was right, funds released.
    - refund_to_creator: Rejection upheld, funds refunded.
    - split: Partial fault, funds and penalties split.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    Column,
    String,
    Float,
    DateTime,
    JSON,
    Text,
    ForeignKey,
    Index,
)

from app.database import Base, GUID


class DisputeStatus(str, Enum):
    """Dispute lifecycle states per issue #192 spec.

    The valid progression is:
        OPENED -> EVIDENCE -> MEDIATION -> RESOLVED

    Additional states PENDING and UNDER_REVIEW are reserved for
    future use in extended dispute workflows.
    """

    OPENED = "opened"
    EVIDENCE = "evidence"
    MEDIATION = "mediation"
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"


class DisputeOutcome(str, Enum):
    """Resolution outcomes for a dispute.

    Primary outcomes used in the resolution flow:
        - RELEASE_TO_CONTRIBUTOR: Contributor wins, funds released.
        - REFUND_TO_CREATOR: Creator wins, rejection upheld.
        - SPLIT: Partial fault on both sides.

    Additional values (APPROVED, REJECTED, CANCELLED) support
    broader workflow states.
    """

    RELEASE_TO_CONTRIBUTOR = "release_to_contributor"
    REFUND_TO_CREATOR = "refund_to_creator"
    SPLIT = "split"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class DisputeReason(str, Enum):
    """Valid reasons for initiating a dispute.

    Each reason corresponds to a category of complaint that a
    contributor can file against a bounty rejection.
    """

    INCORRECT_REVIEW = "incorrect_review"
    PLAGIARISM = "plagiarism"
    RULE_VIOLATION = "rule_violation"
    TECHNICAL_ISSUE = "technical_issue"
    UNFAIR_REJECTION = "unfair_rejection"
    OTHER = "other"


VALID_DISPUTE_TRANSITIONS: dict[DisputeStatus, frozenset[DisputeStatus]] = {
    DisputeStatus.OPENED: frozenset({DisputeStatus.EVIDENCE}),
    DisputeStatus.EVIDENCE: frozenset({DisputeStatus.MEDIATION}),
    DisputeStatus.MEDIATION: frozenset({DisputeStatus.RESOLVED}),
    DisputeStatus.RESOLVED: frozenset(),
}
"""Maps each state to its valid successor states."""


def validate_transition(current: DisputeStatus, target: DisputeStatus) -> bool:
    """Check whether a state transition is valid.

    Args:
        current: The dispute's current status.
        target: The desired target status.

    Returns:
        True if the transition is allowed, False otherwise.
    """
    return target in VALID_DISPUTE_TRANSITIONS.get(current, frozenset())


class DisputeDB(Base):
    """Dispute database model with full audit trail support.

    Represents a dispute filed by a contributor against a bounty
    rejection. Tracks the full lifecycle from creation through
    evidence collection, AI mediation, and final resolution.

    Supports database-level row locking via SELECT ... FOR UPDATE
    for safe concurrent state transitions.
    """

    __tablename__ = "disputes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(
        GUID(),
        ForeignKey("bounties.id", ondelete="CASCADE"),
        nullable=False,
    )
    submission_id = Column(GUID(), nullable=False)
    contributor_id = Column(GUID(), nullable=False)
    creator_id = Column(GUID(), nullable=False)
    reason = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    evidence_links = Column(JSON, default=list, nullable=False)
    status = Column(
        String(20),
        nullable=False,
        default=DisputeStatus.OPENED.value,
    )
    outcome = Column(String(30), nullable=True)
    ai_review_score = Column(Float, nullable=True)
    ai_recommendation = Column(Text, nullable=True)
    resolver_id = Column(GUID(), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    reputation_impact_creator = Column(Float, nullable=True, default=0.0)
    reputation_impact_contributor = Column(Float, nullable=True, default=0.0)
    rejection_timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_disputes_bounty_id", bounty_id),
        Index("ix_disputes_status", status),
        Index("ix_disputes_contributor_id", contributor_id),
    )


class DisputeHistoryDB(Base):
    """Audit trail entry for dispute state changes.

    Each entry records a single action taken on a dispute, including
    the status transition, who performed it, and any notes. Used to
    reconstruct the dispute timeline in the frontend.
    """

    __tablename__ = "dispute_history"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    dispute_id = Column(
        GUID(),
        ForeignKey("disputes.id", ondelete="CASCADE"),
        nullable=False,
    )
    action = Column(String(50), nullable=False)
    previous_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=True)
    actor_id = Column(GUID(), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (Index("ix_dispute_history_dispute_id", dispute_id),)


# -- Pydantic Schemas ----------------------------------------------------------


class EvidenceItem(BaseModel):
    """A single piece of evidence attached to a dispute.

    Evidence can be links, screenshots, code references, or documents
    that support one side of the dispute.

    Attributes:
        evidence_type: Category of evidence (e.g., 'link', 'screenshot').
        url: Optional URL pointing to the evidence.
        description: Human-readable description of this evidence item.
    """

    evidence_type: str = Field(..., min_length=1, max_length=50)
    url: Optional[str] = Field(None, max_length=2000)
    description: str = Field(..., min_length=1, max_length=500)


class DisputeBase(BaseModel):
    """Base schema for dispute creation and inheritance.

    Contains the core fields shared across dispute creation
    and response schemas.
    """

    reason: str
    description: str = Field(..., min_length=10, max_length=5000)
    evidence_links: List[EvidenceItem] = Field(default_factory=list)


class DisputeCreate(DisputeBase):
    """Schema for initiating a new dispute.

    The caller provides the bounty and submission being disputed,
    along with a reason and description. Evidence items are optional
    at creation time and can be added later.

    Attributes:
        bounty_id: The bounty being disputed.
        submission_id: The rejected submission.
    """

    bounty_id: str = Field(..., description="Bounty being disputed")
    submission_id: str = Field(..., description="Rejected submission")

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        """Ensure the reason is a valid DisputeReason value.

        Args:
            value: The reason string to validate.

        Returns:
            The validated reason string.

        Raises:
            ValueError: If the reason is not a valid DisputeReason.
        """
        valid_reasons = {reason.value for reason in DisputeReason}
        if value not in valid_reasons:
            raise ValueError(
                f"Invalid reason: {value}. Must be one of: {sorted(valid_reasons)}"
            )
        return value

    @field_validator("bounty_id")
    @classmethod
    def validate_bounty_id(cls, value):
        """Validate and normalize the bounty ID to a string.

        Args:
            value: The bounty ID, possibly a UUID object.

        Returns:
            The bounty ID as a string.
        """
        if isinstance(value, str):
            return value
        return str(value)


class DisputeEvidenceSubmit(BaseModel):
    """Schema for submitting additional evidence to a dispute.

    At least one evidence item is required per submission. Optional
    notes provide additional context for the evidence batch.

    Attributes:
        evidence_links: List of evidence items (minimum 1).
        notes: Optional context for this evidence submission.
    """

    evidence_links: List[EvidenceItem] = Field(..., min_length=1)
    notes: Optional[str] = Field(None, max_length=2000)


class DisputeUpdate(BaseModel):
    """Schema for updating a dispute's description or evidence.

    Allows partial updates to the dispute's mutable fields.

    Attributes:
        description: Updated dispute description.
        evidence_links: Updated evidence items list.
    """

    description: Optional[str] = Field(None, min_length=10, max_length=5000)
    evidence_links: Optional[List[EvidenceItem]] = None


class DisputeResolve(BaseModel):
    """Schema for admin dispute resolution.

    Admins select an outcome and provide notes explaining the
    decision rationale. The outcome determines reputation impacts.

    Attributes:
        outcome: The resolution outcome (e.g., release_to_contributor).
        resolution_notes: Admin's explanation of the decision.
    """

    outcome: str
    resolution_notes: str = Field(..., min_length=1, max_length=5000)

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, value: str) -> str:
        """Ensure the outcome is a valid DisputeOutcome value.

        Args:
            value: The outcome string to validate.

        Returns:
            The validated outcome string.

        Raises:
            ValueError: If the outcome is not a valid DisputeOutcome.
        """
        valid_outcomes = {outcome.value for outcome in DisputeOutcome}
        if value not in valid_outcomes:
            raise ValueError(
                f"Invalid outcome: {value}. Must be one of: {sorted(valid_outcomes)}"
            )
        return value


class DisputeResponse(DisputeBase):
    """Full dispute response returned from API endpoints.

    Contains all dispute fields including computed values like
    AI mediation scores and reputation impacts.
    """

    id: str
    bounty_id: str
    submission_id: str
    contributor_id: str
    creator_id: str
    reason: str
    description: str
    evidence_links: list = Field(default_factory=list)
    status: str
    outcome: Optional[str] = None
    ai_review_score: Optional[float] = None
    ai_recommendation: Optional[str] = None
    resolver_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    reputation_impact_creator: Optional[float] = None
    reputation_impact_contributor: Optional[float] = None
    rejection_timestamp: datetime
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class DisputeListItem(BaseModel):
    """Brief dispute info for list views.

    Contains only the essential fields needed for rendering
    dispute cards in list or grid layouts.
    """

    id: str
    bounty_id: str
    contributor_id: str
    reason: str
    status: str
    outcome: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class DisputeListResponse(BaseModel):
    """Paginated dispute list response.

    Wraps a page of dispute items with pagination metadata.

    Attributes:
        items: The dispute items for this page.
        total: Total number of disputes matching the query.
        skip: Number of items skipped (offset).
        limit: Maximum items per page.
    """

    items: List[DisputeListItem]
    total: int
    skip: int
    limit: int


class DisputeHistoryItem(BaseModel):
    """Pydantic schema for a dispute audit history entry.

    Used in API responses to serialize dispute timeline entries.
    """

    id: str
    dispute_id: str
    action: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    actor_id: str
    notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class DisputeDetailResponse(DisputeResponse):
    """Full dispute detail response with audit history.

    Extends the base response with the complete timeline of
    actions taken on this dispute, ordered chronologically.
    """

    history: List[DisputeHistoryItem] = []


class DisputeStats(BaseModel):
    """Aggregate dispute statistics for dashboard views.

    Provides counts and rates for monitoring the dispute
    resolution system health.

    Attributes:
        total_disputes: Total number of disputes filed.
        opened_disputes: Disputes currently in OPENED state.
        evidence_phase_disputes: Disputes currently collecting evidence.
        mediation_phase_disputes: Disputes in AI or admin mediation.
        resolved_disputes: Total resolved disputes.
        release_to_contributor_count: Disputes won by contributors.
        refund_to_creator_count: Disputes won by creators.
        split_count: Disputes resolved as split decisions.
        contributor_favorable_rate: Percentage of disputes won by contributors.
    """

    total_disputes: int = 0
    opened_disputes: int = 0
    evidence_phase_disputes: int = 0
    mediation_phase_disputes: int = 0
    resolved_disputes: int = 0
    release_to_contributor_count: int = 0
    refund_to_creator_count: int = 0
    split_count: int = 0
    contributor_favorable_rate: float = 0.0
