"""Dispute resolution database and Pydantic models.

Implements the full dispute lifecycle for bounty submission rejections:
  OPENED → EVIDENCE → MEDIATION → RESOLVED

Supports AI auto-mediation, manual admin resolution, evidence
submission by both parties, and reputation impact tracking.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    Column, String, DateTime, JSON, Text, Float, Integer,
    ForeignKey, Index, Boolean,
)
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class DisputeState(str, Enum):
    """Dispute lifecycle states."""
    OPENED = "opened"
    EVIDENCE = "evidence"
    MEDIATION = "mediation"
    RESOLVED = "resolved"


VALID_STATE_TRANSITIONS: dict[DisputeState, set[DisputeState]] = {
    DisputeState.OPENED: {DisputeState.EVIDENCE},
    DisputeState.EVIDENCE: {DisputeState.MEDIATION},
    DisputeState.MEDIATION: {DisputeState.RESOLVED},
    DisputeState.RESOLVED: set(),  # terminal
}


class DisputeOutcome(str, Enum):
    """Final resolution outcome."""
    RELEASE_TO_CONTRIBUTOR = "release_to_contributor"
    REFUND_TO_CREATOR = "refund_to_creator"
    SPLIT = "split"


class DisputeReason(str, Enum):
    """Reason for opening a dispute."""
    INCORRECT_REVIEW = "incorrect_review"
    VALID_SUBMISSION_REJECTED = "valid_submission_rejected"
    TECHNICAL_ISSUE = "technical_issue"
    UNFAIR_REJECTION = "unfair_rejection"
    OTHER = "other"


class MediationType(str, Enum):
    """How the dispute was mediated."""
    AI_AUTO = "ai_auto"
    ADMIN_MANUAL = "admin_manual"


class EvidenceParty(str, Enum):
    """Who submitted the evidence."""
    CONTRIBUTOR = "contributor"
    CREATOR = "creator"


DISPUTE_INITIATION_WINDOW_HOURS = 72


# ---------------------------------------------------------------------------
# SQLAlchemy models
# ---------------------------------------------------------------------------


class DisputeDB(Base):
    """Core dispute record tied to a rejected submission."""

    __tablename__ = "disputes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    bounty_id = Column(
        UUID(as_uuid=True),
        ForeignKey("bounties.id", ondelete="CASCADE"),
        nullable=False,
    )
    submission_id = Column(UUID(as_uuid=True), nullable=False)

    # Parties
    contributor_id = Column(UUID(as_uuid=True), nullable=False)
    creator_id = Column(UUID(as_uuid=True), nullable=False)

    # Dispute details
    reason = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)

    # State machine
    state = Column(String(20), nullable=False, default=DisputeState.OPENED.value)
    outcome = Column(String(30), nullable=True)

    # AI mediation
    ai_review_score = Column(Float, nullable=True)
    ai_review_summary = Column(Text, nullable=True)
    ai_mediation_threshold = Column(Float, nullable=False, default=7.0)

    # Manual mediation
    mediation_type = Column(String(20), nullable=True)
    resolver_id = Column(UUID(as_uuid=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    # Split details (only for SPLIT outcome)
    split_contributor_pct = Column(Float, nullable=True)
    split_creator_pct = Column(Float, nullable=True)

    # Reputation impact applied
    reputation_impact_applied = Column(Boolean, default=False, nullable=False)
    contributor_reputation_delta = Column(Integer, default=0, nullable=False)
    creator_reputation_delta = Column(Integer, default=0, nullable=False)

    # Telegram notification tracking
    telegram_notified = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    evidence_deadline = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # The original rejection timestamp — used to enforce 72h initiation window
    rejection_timestamp = Column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        Index("ix_disputes_bounty_id", bounty_id),
        Index("ix_disputes_submission_id", submission_id),
        Index("ix_disputes_state", state),
        Index("ix_disputes_contributor_id", contributor_id),
        Index("ix_disputes_creator_id", creator_id),
    )


class DisputeEvidenceDB(Base):
    """Evidence submitted by either party during the EVIDENCE phase."""

    __tablename__ = "dispute_evidence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dispute_id = Column(
        UUID(as_uuid=True),
        ForeignKey("disputes.id", ondelete="CASCADE"),
        nullable=False,
    )

    submitted_by = Column(UUID(as_uuid=True), nullable=False)
    party = Column(String(20), nullable=False)  # contributor | creator
    evidence_type = Column(String(50), nullable=False)  # link, explanation, screenshot
    url = Column(String(1000), nullable=True)
    description = Column(Text, nullable=False)
    extra_data = Column(JSON, default=dict, nullable=False)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_dispute_evidence_dispute_id", dispute_id),
    )


class DisputeAuditDB(Base):
    """Full audit trail for every state transition and action on a dispute."""

    __tablename__ = "dispute_audit"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dispute_id = Column(
        UUID(as_uuid=True),
        ForeignKey("disputes.id", ondelete="CASCADE"),
        nullable=False,
    )

    action = Column(String(50), nullable=False)
    previous_state = Column(String(20), nullable=True)
    new_state = Column(String(20), nullable=True)
    actor_id = Column(UUID(as_uuid=True), nullable=False)
    details = Column(JSON, default=dict, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_dispute_audit_dispute_id", dispute_id),
        Index("ix_dispute_audit_action", action),
    )


# ---------------------------------------------------------------------------
# Pydantic schemas — Evidence
# ---------------------------------------------------------------------------


class EvidenceItem(BaseModel):
    evidence_type: str = Field(..., description="link, explanation, or screenshot")
    url: Optional[str] = Field(None, max_length=1000)
    description: str = Field(..., min_length=1, max_length=2000)
    extra_data: dict = Field(default_factory=dict)


class EvidenceSubmit(BaseModel):
    """Payload for POST /disputes/{id}/evidence."""
    items: List[EvidenceItem] = Field(..., min_length=1, max_length=10)


class EvidenceResponse(BaseModel):
    id: str
    dispute_id: str
    submitted_by: str
    party: str
    evidence_type: str
    url: Optional[str] = None
    description: str
    extra_data: dict = Field(default_factory=dict)
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Pydantic schemas — Dispute CRUD
# ---------------------------------------------------------------------------


class DisputeCreate(BaseModel):
    """Payload for POST /disputes."""
    bounty_id: str = Field(..., description="UUID of the bounty")
    submission_id: str = Field(..., description="UUID of the rejected submission")
    reason: str = Field(..., description="Reason for disputing")
    description: str = Field(..., min_length=10, max_length=5000)
    evidence: List[EvidenceItem] = Field(
        default_factory=list,
        max_length=10,
        description="Optional initial evidence",
    )

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        valid = {r.value for r in DisputeReason}
        if v not in valid:
            raise ValueError(f"Invalid reason: {v}. Must be one of: {valid}")
        return v


class DisputeResolve(BaseModel):
    """Payload for POST /disputes/{id}/resolve (admin only)."""
    outcome: str
    resolution_notes: str = Field(..., min_length=1, max_length=5000)
    split_contributor_pct: Optional[float] = Field(
        None, ge=0.0, le=100.0,
        description="Contributor % for SPLIT outcome",
    )

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, v: str) -> str:
        valid = {o.value for o in DisputeOutcome}
        if v not in valid:
            raise ValueError(f"Invalid outcome: {v}. Must be one of: {valid}")
        return v

    @field_validator("split_contributor_pct")
    @classmethod
    def validate_split(cls, v: Optional[float], info) -> Optional[float]:
        outcome = info.data.get("outcome")
        if outcome == DisputeOutcome.SPLIT.value and v is None:
            raise ValueError("split_contributor_pct required for SPLIT outcome")
        return v


# ---------------------------------------------------------------------------
# Pydantic schemas — Responses
# ---------------------------------------------------------------------------


class DisputeAuditEntry(BaseModel):
    id: str
    dispute_id: str
    action: str
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    actor_id: str
    details: dict = Field(default_factory=dict)
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
    state: str
    outcome: Optional[str] = None
    ai_review_score: Optional[float] = None
    ai_review_summary: Optional[str] = None
    mediation_type: Optional[str] = None
    resolver_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    split_contributor_pct: Optional[float] = None
    split_creator_pct: Optional[float] = None
    reputation_impact_applied: bool = False
    contributor_reputation_delta: int = 0
    creator_reputation_delta: int = 0
    evidence_deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class DisputeDetailResponse(DisputeResponse):
    """Full dispute details with evidence and audit trail."""
    evidence: List[EvidenceResponse] = []
    audit_trail: List[DisputeAuditEntry] = []


class DisputeListItem(BaseModel):
    id: str
    bounty_id: str
    submission_id: str
    contributor_id: str
    creator_id: str
    reason: str
    state: str
    outcome: Optional[str] = None
    ai_review_score: Optional[float] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class DisputeListResponse(BaseModel):
    items: List[DisputeListItem]
    total: int
    skip: int
    limit: int


class DisputeStats(BaseModel):
    total: int = 0
    opened: int = 0
    in_evidence: int = 0
    in_mediation: int = 0
    resolved: int = 0
    outcome_contributor: int = 0
    outcome_creator: int = 0
    outcome_split: int = 0
    avg_ai_score: Optional[float] = None
