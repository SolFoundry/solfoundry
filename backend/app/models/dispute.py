"""Dispute database and Pydantic models."""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey, Index

from app.database import Base, GUID


class DisputeStatus(str, Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"
    CLOSED = "closed"


class DisputeOutcome(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class DisputeReason(str, Enum):
    INCORRECT_REVIEW = "incorrect_review"
    PLAGIARISM = "plagiarism"
    RULE_VIOLATION = "rule_violation"
    TECHNICAL_ISSUE = "technical_issue"
    UNFAIR_COMPETITION = "unfair_competition"
    OTHER = "other"


class DisputeDB(Base):
    __tablename__ = "disputes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(GUID(), ForeignKey("bounties.id", ondelete="CASCADE"), nullable=False)
    submitter_id = Column(GUID(), nullable=False)
    reason = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    evidence_links = Column(JSON, default=list, nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    outcome = Column(String(20), nullable=True)
    reviewer_id = Column(GUID(), nullable=True)
    review_notes = Column(Text, nullable=True)
    resolution_action = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index('ix_disputes_bounty_id', bounty_id),
        Index('ix_disputes_status', status),
    )


class DisputeHistoryDB(Base):
    __tablename__ = "dispute_history"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    dispute_id = Column(GUID(), ForeignKey("disputes.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)
    previous_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=True)
    actor_id = Column(GUID(), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (Index('ix_dispute_history_dispute_id', dispute_id),)


class EvidenceItem(BaseModel):
    type: str
    url: Optional[str] = None
    description: str = Field(..., min_length=1, max_length=500)


class DisputeBase(BaseModel):
    reason: str
    description: str = Field(..., min_length=10, max_length=5000)
    evidence_links: List[EvidenceItem] = Field(default_factory=list)

    @field_validator('reason')
    @classmethod
    def validate_reason(cls, v):
        valid_reasons = {r.value for r in DisputeReason}
        if v not in valid_reasons:
            raise ValueError(f"Invalid reason: {v}")
        return v


class DisputeCreate(DisputeBase):
    bounty_id: str = Field(..., description="ID of the bounty being disputed")
    
    @field_validator('bounty_id')
    @classmethod
    def validate_bounty_id(cls, v):
        if isinstance(v, str):
            return v
        return str(v)


class DisputeUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=10, max_length=5000)
    evidence_links: Optional[List[EvidenceItem]] = None


class DisputeResolve(BaseModel):
    outcome: str
    review_notes: str = Field(..., min_length=1, max_length=5000)
    resolution_action: Optional[str] = Field(None, max_length=2000)

    @field_validator('outcome')
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