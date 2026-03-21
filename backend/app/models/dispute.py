"""Dispute resolution database and Pydantic models.

Implements the full dispute lifecycle:
    OPENED → EVIDENCE → MEDIATION → RESOLVED

Supports AI auto-mediation, manual admin resolution, and reputation
adjustments for unfair rejections / frivolous disputes.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    Column,
    String,
    DateTime,
    JSON,
    Text,
    Float,
    Boolean,
    ForeignKey,
    Index,
)

from app.database import Base, GUID


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class DisputeStatus(str, Enum):
    OPENED = "opened"
    EVIDENCE = "evidence"
    MEDIATION = "mediation"
    RESOLVED = "resolved"


class DisputeOutcome(str, Enum):
    RELEASE_TO_CONTRIBUTOR = "release_to_contributor"
    REFUND_TO_CREATOR = "refund_to_creator"
    SPLIT = "split"


class MediationType(str, Enum):
    AI = "ai"
    MANUAL = "manual"


class DisputeReason(str, Enum):
    INCORRECT_REVIEW = "incorrect_review"
    PLAGIARISM = "plagiarism"
    RULE_VIOLATION = "rule_violation"
    TECHNICAL_ISSUE = "technical_issue"
    UNFAIR_REJECTION = "unfair_rejection"
    OTHER = "other"


# ---------------------------------------------------------------------------
# SQLAlchemy ORM models
# ---------------------------------------------------------------------------


class DisputeDB(Base):
    __tablename__ = "disputes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(
        GUID(), ForeignKey("bounties.id", ondelete="CASCADE"), nullable=False
    )
    submission_id = Column(String(36), nullable=False)
    contributor_id = Column(String(100), nullable=False)
    creator_id = Column(String(100), nullable=False)

    reason = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)

    status = Column(
        String(20), nullable=False, default=DisputeStatus.OPENED.value
    )
    outcome = Column(String(30), nullable=True)
    mediation_type = Column(String(10), nullable=True)

    # AI mediation fields
    ai_score = Column(Float, nullable=True)
    ai_review_summary = Column(Text, nullable=True)
    ai_auto_resolved = Column(Boolean, default=False, nullable=False)

    # Resolution
    resolver_id = Column(String(100), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    split_percentage = Column(Float, nullable=True)

    # Reputation adjustments applied
    contributor_rep_delta = Column(Float, default=0.0, nullable=False)
    creator_rep_delta = Column(Float, default=0.0, nullable=False)

    # Rejection timestamp (for 72-hour window validation)
    rejection_at = Column(DateTime(timezone=True), nullable=False)

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
        Index("ix_disputes_contributor_id", contributor_id),
        Index("ix_disputes_creator_id", creator_id),
    )


class DisputeEvidenceDB(Base):
    """Evidence items submitted by either party."""

    __tablename__ = "dispute_evidence"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    dispute_id = Column(
        GUID(), ForeignKey("disputes.id", ondelete="CASCADE"), nullable=False
    )
    submitted_by = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)  # "contributor" or "creator"
    evidence_type = Column(String(30), nullable=False)  # "link", "text", "screenshot"
    url = Column(String(2000), nullable=True)
    explanation = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (Index("ix_dispute_evidence_dispute_id", dispute_id),)


class DisputeHistoryDB(Base):
    """Audit trail for every state transition and action."""

    __tablename__ = "dispute_history"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    dispute_id = Column(
        GUID(), ForeignKey("disputes.id", ondelete="CASCADE"), nullable=False
    )
    action = Column(String(50), nullable=False)
    previous_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=True)
    actor_id = Column(String(100), nullable=False)
    actor_role = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (Index("ix_dispute_history_dispute_id", dispute_id),)


# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------


class EvidenceItem(BaseModel):
    evidence_type: str = Field(
        ..., description="link, text, or screenshot"
    )
    url: Optional[str] = Field(None, max_length=2000)
    explanation: str = Field(..., min_length=1, max_length=2000)

    @field_validator("evidence_type")
    @classmethod
    def validate_type(cls, v):
        if v not in ("link", "text", "screenshot"):
            raise ValueError("evidence_type must be link, text, or screenshot")
        return v


class DisputeCreate(BaseModel):
    bounty_id: str = Field(..., description="ID of the bounty being disputed")
    submission_id: str = Field(..., description="ID of the rejected submission")
    reason: str = Field(..., description="Reason for the dispute")
    description: str = Field(..., min_length=10, max_length=5000)
    evidence: List[EvidenceItem] = Field(
        default_factory=list, description="Initial evidence items"
    )

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v):
        valid = {r.value for r in DisputeReason}
        if v not in valid:
            raise ValueError(f"Invalid reason: {v}. Must be one of: {valid}")
        return v


class EvidenceSubmit(BaseModel):
    items: List[EvidenceItem] = Field(..., min_items=1, max_length=10)


class DisputeResolve(BaseModel):
    outcome: str = Field(..., description="Resolution outcome")
    resolution_notes: str = Field(..., min_length=1, max_length=5000)
    split_percentage: Optional[float] = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Contributor's share when outcome is 'split'",
    )

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, v):
        valid = {o.value for o in DisputeOutcome}
        if v not in valid:
            raise ValueError(f"Invalid outcome: {v}. Must be one of: {valid}")
        return v


class EvidenceResponse(BaseModel):
    id: str
    dispute_id: str
    submitted_by: str
    role: str
    evidence_type: str
    url: Optional[str] = None
    explanation: str
    created_at: datetime
    model_config = {"from_attributes": True}


class DisputeHistoryItem(BaseModel):
    id: str
    dispute_id: str
    action: str
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    actor_id: str
    actor_role: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class DisputeResponse(BaseModel):
    id: str
    bounty_id: str
    submission_id: str
    contributor_id: str
    creator_id: str
    reason: str
    description: str
    status: str
    outcome: Optional[str] = None
    mediation_type: Optional[str] = None
    ai_score: Optional[float] = None
    ai_review_summary: Optional[str] = None
    ai_auto_resolved: bool = False
    resolver_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    split_percentage: Optional[float] = None
    contributor_rep_delta: float = 0.0
    creator_rep_delta: float = 0.0
    rejection_at: datetime
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class DisputeDetailResponse(DisputeResponse):
    evidence: List[EvidenceResponse] = []
    history: List[DisputeHistoryItem] = []


class DisputeListItem(BaseModel):
    id: str
    bounty_id: str
    submission_id: str
    contributor_id: str
    reason: str
    status: str
    outcome: Optional[str] = None
    ai_score: Optional[float] = None
    ai_auto_resolved: bool = False
    created_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class DisputeListResponse(BaseModel):
    items: List[DisputeListItem]
    total: int
    skip: int
    limit: int


class DisputeStats(BaseModel):
    total_disputes: int = 0
    opened_disputes: int = 0
    in_evidence: int = 0
    in_mediation: int = 0
    resolved_disputes: int = 0
    ai_resolved_count: int = 0
    manual_resolved_count: int = 0
    release_to_contributor_count: int = 0
    refund_to_creator_count: int = 0
    split_count: int = 0
    avg_ai_score: Optional[float] = None
