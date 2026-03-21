"""Dispute database and Pydantic models.

PostgreSQL migration path: CHAR(36) GUIDs for cross-DB compat.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator, HttpUrl
from sqlalchemy import Column, String, DateTime, JSON, Text, Float, ForeignKey, Index

from app.database import Base, GUID


class DisputeStatus(str, Enum):
    """Dispute lifecycle states."""
    OPENED = "opened"
    EVIDENCE = "evidence"
    MEDIATION = "mediation"
    RESOLVED = "resolved"


VALID_STATUS_TRANSITIONS: dict[DisputeStatus, set[DisputeStatus]] = {
    DisputeStatus.OPENED: {DisputeStatus.EVIDENCE},
    DisputeStatus.EVIDENCE: {DisputeStatus.MEDIATION},
    DisputeStatus.MEDIATION: {DisputeStatus.RESOLVED},
    DisputeStatus.RESOLVED: set(),
}


def validate_transition(current: DisputeStatus, target: DisputeStatus) -> None:
    """Validate that a status transition is allowed."""
    allowed = VALID_STATUS_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise ValueError(f"Invalid status transition: {current.value} -> {target.value}")



class DisputeOutcome(str, Enum):
    """Resolution outcomes."""
    CONTRIBUTOR_WINS = "contributor_wins"
    CREATOR_WINS = "creator_wins"
    SPLIT = "split"


class DisputeReason(str, Enum):
    """Valid reasons for filing a dispute."""
    INCORRECT_REVIEW = "incorrect_review"
    PLAGIARISM = "plagiarism"
    RULE_VIOLATION = "rule_violation"
    TECHNICAL_ISSUE = "technical_issue"
    UNFAIR_COMPETITION = "unfair_competition"
    OTHER = "other"


class DisputeDB(Base):
    """SQLAlchemy model for disputes table."""
    __tablename__ = "disputes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(
        GUID(), ForeignKey("bounties.id", ondelete="CASCADE"), nullable=False
    )
    submitter_id = Column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    creator_id = Column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    evidence_links = Column(JSON, default=list, nullable=False)
    status = Column(String(20), nullable=False, default=DisputeStatus.OPENED.value)
    outcome = Column(String(20), nullable=True)
    reviewer_id = Column(
        GUID(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_notes = Column(Text, nullable=True)
    resolution_action = Column(Text, nullable=True)
    ai_review_score = Column(Float, nullable=True)
    ai_recommendation = Column(String(20), nullable=True)
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
    """SQLAlchemy model for dispute audit trail."""
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
    evidence_type: str
    url: Optional[HttpUrl] = None
    description: str = Field(..., min_length=1, max_length=500)

    @field_validator("evidence_type")
    @classmethod
    def validate_evidence_type(cls, v: str) -> str:
        """Validate evidence type is one of the allowed values."""
        if v not in {"link", "screenshot", "explanation"}:
            raise ValueError(f"Invalid evidence type: {v}")
        return v

    @model_validator(mode="after")
    def validate_url_for_link_types(self) -> "EvidenceItem":
        """Ensure link/screenshot evidence has a valid http(s) URL."""
        if self.evidence_type in ("link", "screenshot"):
            if not self.url:
                raise ValueError(
                    f"{self.evidence_type} evidence requires a non-empty url"
                )
            url_str = str(self.url)
            if not url_str.startswith(("http://", "https://")):
                raise ValueError(
                    f"{self.evidence_type} url must use http or https scheme"
                )
        return self


class DisputeBase(BaseModel):
    """Base schema with shared validation."""
    reason: str
    description: str = Field(..., min_length=10, max_length=5000)
    evidence_links: List[EvidenceItem] = Field(default_factory=list, max_length=10)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v):
        """Validate reason is one of the allowed dispute reasons."""
        valid_reasons = {r.value for r in DisputeReason}
        if v not in valid_reasons:
            raise ValueError(f"Invalid reason: {v}")
        return v


class DisputeCreate(DisputeBase):
    """Schema for creating a new dispute."""
    bounty_id: str = Field(..., description="ID of the bounty being disputed")

    @field_validator("bounty_id")
    @classmethod
    def validate_bounty_id(cls, v):
        """Ensure bounty_id is a non-empty string after stripping whitespace."""
        if isinstance(v, str):
            v = v.strip()
        else:
            v = str(v).strip()
        if not v:
            raise ValueError("bounty_id must not be empty")
        return v


class EvidenceSubmit(BaseModel):
    """Schema for submitting additional evidence."""
    evidence_items: List[EvidenceItem] = Field(..., min_length=1, max_length=10)
    notes: Optional[str] = Field(None, max_length=2000)


class DisputeResolve(BaseModel):
    """Schema for resolving a dispute."""
    outcome: str
    review_notes: str = Field(..., min_length=1, max_length=5000)
    resolution_action: Optional[str] = Field(None, max_length=2000)

    @field_validator("outcome")
    @classmethod
    def validate_outcome(cls, v):
        """Validate outcome is one of the allowed dispute outcomes."""
        valid_outcomes = {o.value for o in DisputeOutcome}
        if v not in valid_outcomes:
            raise ValueError(f"Invalid outcome: {v}")
        return v


class DisputeResponse(DisputeBase):
    """Full dispute response returned by all mutation endpoints."""
    id: str
    bounty_id: str
    submitter_id: str
    creator_id: str
    status: str
    outcome: Optional[str] = None
    reviewer_id: Optional[str] = None
    review_notes: Optional[str] = None
    resolution_action: Optional[str] = None
    ai_review_score: Optional[float] = None
    ai_recommendation: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    model_config = {"from_attributes": True}


class DisputeListItem(BaseModel):
    """Compact dispute representation for list endpoints."""
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
    """Paginated dispute list response."""
    items: List[DisputeListItem]
    total: int
    skip: int
    limit: int


class DisputeHistoryItem(BaseModel):
    """Single audit trail entry for a dispute."""
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
    """Dispute response including full audit history."""
    history: List[DisputeHistoryItem] = []


class DisputeStats(BaseModel):
    """Aggregate dispute statistics across all disputes."""
    total_disputes: int = 0
    opened_disputes: int = 0
    evidence_disputes: int = 0
    mediation_disputes: int = 0
    resolved_disputes: int = 0
    contributor_wins: int = 0
    creator_wins: int = 0
    split_outcomes: int = 0
    contributor_win_rate: float = 0.0
