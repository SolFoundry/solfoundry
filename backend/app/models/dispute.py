"""Dispute database and Pydantic models.

State machine: OPENED -> EVIDENCE -> MEDIATION -> RESOLVED
Outcomes: release_to_contributor, refund_to_creator, split
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, String, Float, DateTime, JSON, Text, ForeignKey, Index

from app.database import Base, GUID


class DisputeStatus(str, Enum):
    """Dispute lifecycle states per issue #192 spec."""
    OPENED = "opened"
    EVIDENCE = "evidence"
    MEDIATION = "mediation"
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"


class DisputeOutcome(str, Enum):
    """Resolution outcomes."""
    RELEASE_TO_CONTRIBUTOR = "release_to_contributor"
    REFUND_TO_CREATOR = "refund_to_creator"
    SPLIT = "split"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class DisputeReason(str, Enum):
    """Valid reasons for initiating a dispute."""
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


def validate_transition(current: DisputeStatus, target: DisputeStatus) -> bool:
    """Check whether a state transition is valid."""
    return target in VALID_DISPUTE_TRANSITIONS.get(current, frozenset())


class DisputeDB(Base):
    """Dispute database model with full audit trail support."""
    __tablename__ = "disputes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(GUID(), ForeignKey("bounties.id", ondelete="CASCADE"), nullable=False)
    submission_id = Column(GUID(), nullable=False)
    contributor_id = Column(GUID(), nullable=False)
    creator_id = Column(GUID(), nullable=False)
    reason = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    evidence_links = Column(JSON, default=list, nullable=False)
    status = Column(String(20), nullable=False, default=DisputeStatus.OPENED.value)
    outcome = Column(String(30), nullable=True)
    ai_review_score = Column(Float, nullable=True)
    ai_recommendation = Column(Text, nullable=True)
    resolver_id = Column(GUID(), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    reputation_impact_creator = Column(Float, nullable=True, default=0.0)
    reputation_impact_contributor = Column(Float, nullable=True, default=0.0)
    rejection_timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
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
    """DisputeHistoryDB."""
    __tablename__ = "dispute_history"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    dispute_id = Column(
        GUID(), ForeignKey("disputes.id", ondelete="CASCADE"), nullable=False
    )
    action = Column(String(50), nullable=False)
    previous_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=True)
    actor_id = Column(GUID(), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (Index("ix_dispute_history_dispute_id", dispute_id),)


class EvidenceItem(BaseModel):
    """A single piece of evidence attached to a dispute."""
    evidence_type: str = Field(..., min_length=1, max_length=50)
    url: Optional[str] = Field(None, max_length=2000)
    description: str = Field(..., min_length=1, max_length=500)


class DisputeBase(BaseModel):
    """Base schema for dispute creation and inheritance."""
    reason: str
    description: str = Field(..., min_length=10, max_length=5000)
    evidence_links: List[EvidenceItem] = Field(default_factory=list)


class DisputeCreate(DisputeBase):
    """Schema for initiating a new dispute."""
    bounty_id: str = Field(..., description="Bounty being disputed")
    submission_id: str = Field(..., description="Rejected submission")

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        """Ensure the reason is a valid DisputeReason value."""
        valid = {r.value for r in DisputeReason}
        if v not in valid:
            raise ValueError(f"Invalid reason: {v}. Must be one of: {sorted(valid)}")
        return v


    @field_validator("bounty_id")
    @classmethod
    def validate_bounty_id(cls, v):
        """Validate bounty id."""
        if isinstance(v, str):
            return v
        return str(v)


class DisputeEvidenceSubmit(BaseModel):
    """Schema for submitting additional evidence."""
    evidence_links: List[EvidenceItem] = Field(..., min_length=1)
    notes: Optional[str] = Field(None, max_length=2000)


class DisputeUpdate(BaseModel):
    """Schema for updating a dispute."""
    description: Optional[str] = Field(None, min_length=10, max_length=5000)
    evidence_links: Optional[List[EvidenceItem]] = None


class DisputeResolve(BaseModel):
    """Schema for admin dispute resolution."""
    outcome: str
    resolution_notes: str = Field(..., min_length=1, max_length=5000)

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, v: str) -> str:
        """Ensure the outcome is a valid DisputeOutcome value."""
        valid = {o.value for o in DisputeOutcome}
        if v not in valid:
            raise ValueError(f"Invalid outcome: {v}. Must be one of: {sorted(valid)}")
        return v


class DisputeResponse(DisputeBase):
    """Full dispute response schema."""
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
    """Brief dispute info for list views."""
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
    """DisputeListResponse."""
    items: List[DisputeListItem]
    total: int
    skip: int
    limit: int


class DisputeHistoryItem(BaseModel):
    """DisputeHistoryItem."""
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
    """DisputeDetailResponse."""
    history: List[DisputeHistoryItem] = []


class DisputeStats(BaseModel):
    """Aggregate dispute statistics."""
    total_disputes: int = 0
    opened_disputes: int = 0
    evidence_phase_disputes: int = 0
    mediation_phase_disputes: int = 0
    resolved_disputes: int = 0
    release_to_contributor_count: int = 0
    refund_to_creator_count: int = 0
    split_count: int = 0
    contributor_favorable_rate: float = 0.0
