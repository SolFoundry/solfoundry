"""Dispute database and Pydantic models."""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey, Index

from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class DisputeStatus(str, Enum):
    OPENED = "opened"
    EVIDENCE = "evidence"
    MEDIATION = "mediation"
    RESOLVED = "resolved"


class DisputeOutcome(str, Enum):
    RELEASE_TO_CONTRIBUTOR = "release_to_contributor"
    REFUND_TO_CREATOR = "refund_to_creator"
    SPLIT = "split"


class DisputeReason(str, Enum):
    INCORRECT_REVIEW = "incorrect_review"
    PLAGIARISM = "plagiarism"
    RULE_VIOLATION = "rule_violation"
    TECHNICAL_ISSUE = "technical_issue"
    UNFAIR_COMPETITION = "unfair_competition"
    OTHER = "other"


class DisputeDB(Base):
    __tablename__ = "disputes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(
        UUID(as_uuid=True), ForeignKey("bounties.id", ondelete="CASCADE"), nullable=False
    )
    submitter_id = Column(UUID(as_uuid=True), nullable=False)
    reason = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    evidence_links = Column(JSON, default=list, nullable=False)
    status = Column(String(20), nullable=False, default="opened")
    outcome = Column(String(20), nullable=True)
    reviewer_id = Column(UUID(as_uuid=True), nullable=True)
    review_notes = Column(Text, nullable=True)
    resolution_action = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
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
    )


class DisputeHistoryDB(Base):
    __tablename__ = "dispute_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dispute_id = Column(
        UUID(as_uuid=True), ForeignKey("disputes.id", ondelete="CASCADE"), nullable=False
    )
    action = Column(String(50), nullable=False)
    previous_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=True)
    actor_id = Column(UUID(as_uuid=True), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (Index("ix_dispute_history_dispute_id", dispute_id),)


class EvidenceItem(BaseModel):
    type: str = Field(..., pattern="^(screenshot|video|link|code|other)$")
    url: Optional[str] = Field(None, pattern=r"^https?://[^\s/$.?#].[^\s]*$")
    description: str = Field(..., min_length=1, max_length=500)


class DisputeBase(BaseModel):
    reason: str
    description: str = Field(..., min_length=10, max_length=5000)
    evidence_links: List[EvidenceItem] = Field(default_factory=list)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v):
        valid_reasons = {r.value for r in DisputeReason}
        if v not in valid_reasons:
            raise ValueError(f"Invalid reason: {v}")
        return v


class DisputeCreate(DisputeBase):
    bounty_id: uuid.UUID = Field(..., description="ID of the bounty being disputed")



class DisputeUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=10, max_length=5000)
    evidence_links: Optional[List[EvidenceItem]] = None


class DisputeResolve(BaseModel):
    outcome: str
    split_percent: Optional[float] = Field(None, ge=0, le=100, description="Percentage of reward to contributor (only for SPLIT outcome)")
    review_notes: str = Field(..., min_length=1, max_length=5000)
    resolution_action: Optional[str] = Field(None, max_length=2000)

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, v):
        valid_outcomes = {o.value for o in DisputeOutcome}
        if v not in valid_outcomes:
            raise ValueError(f"Invalid outcome: {v}")
        return v


class DisputeResponse(DisputeBase):
    id: str
    bounty_id: str
    submitter_id: str
    status: str
    outcome: Optional[str] = None
    reviewer_id: Optional[str] = None
    review_notes: Optional[str] = None
    resolution_action: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class DisputeListItem(BaseModel):
    id: str
    bounty_id: str
    submitter_id: str
    reason: str
    status: str
    outcome: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class DisputeListResponse(BaseModel):
    items: List[DisputeListItem]
    total: int
    skip: int
    limit: int


class DisputeHistoryItem(BaseModel):
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
    history: List[DisputeHistoryItem] = []


class DisputeStats(BaseModel):
    total_disputes: int = 0
    pending_disputes: int = 0
    resolved_disputes: int = 0
    approved_disputes: int = 0
    rejected_disputes: int = 0
    approval_rate: float = 0.0
