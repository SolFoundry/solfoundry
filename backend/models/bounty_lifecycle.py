from enum import Enum
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import uuid

Base = declarative_base()


class BountyStatus(str, Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    CLAIMED = "CLAIMED"
    IN_REVIEW = "IN_REVIEW"
    COMPLETED = "COMPLETED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"

    @classmethod
    def terminal_states(cls):
        return {cls.COMPLETED, cls.PAID, cls.CANCELLED}

    @classmethod
    def valid_transitions(cls):
        return {
            cls.DRAFT: {cls.OPEN, cls.CANCELLED},
            cls.OPEN: {cls.CLAIMED, cls.IN_REVIEW, cls.CANCELLED},
            cls.CLAIMED: {cls.IN_REVIEW, cls.OPEN, cls.CANCELLED},
            cls.IN_REVIEW: {cls.COMPLETED, cls.CLAIMED, cls.CANCELLED},
            cls.COMPLETED: {cls.PAID},
            cls.PAID: set(),
            cls.CANCELLED: set()
        }


class BountyLifecycleState(Base):
    __tablename__ = 'bounty_lifecycle_states'

    id = Column(Integer, primary_key=True, index=True)
    bounty_id = Column(Integer, ForeignKey('bounties.id'), nullable=False, unique=True)
    status = Column(String(20), nullable=False, default=BountyStatus.DRAFT.value)
    claimed_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    claim_deadline = Column(DateTime, nullable=True)
    warning_sent = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    bounty = relationship("Bounty", back_populates="lifecycle_state")
    claimed_user = relationship("User", foreign_keys=[claimed_by])

    __table_args__ = (
        Index('ix_bounty_lifecycle_status', 'status'),
        Index('ix_bounty_lifecycle_claim_deadline', 'claim_deadline'),
        Index('ix_bounty_lifecycle_claimed_by', 'claimed_by'),
    )

    def is_claim_expired(self) -> bool:
        if not self.claim_deadline or self.status != BountyStatus.CLAIMED.value:
            return False
        return datetime.utcnow() > self.claim_deadline

    def should_send_warning(self, warning_threshold_hours: int = 24) -> bool:
        if not self.claim_deadline or self.warning_sent or self.status != BountyStatus.CLAIMED.value:
            return False
        warning_time = self.claim_deadline - timedelta(hours=warning_threshold_hours)
        return datetime.utcnow() >= warning_time

    def can_transition_to(self, new_status: BountyStatus) -> bool:
        current_status = BountyStatus(self.status)
        valid_next = BountyStatus.valid_transitions().get(current_status, set())
        return new_status in valid_next


class AuditLogEntry(Base):
    __tablename__ = 'audit_log_entries'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    bounty_id = Column(Integer, ForeignKey('bounties.id'), nullable=False, index=True)
    action = Column(String(50), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True, index=True)
    details = Column(JSONB, nullable=True)

    bounty = relationship("Bounty")
    user = relationship("User")

    __table_args__ = (
        Index('ix_audit_log_bounty_timestamp', 'bounty_id', 'timestamp'),
        Index('ix_audit_log_action_timestamp', 'action', 'timestamp'),
    )


class BountyLifecycleStateResponse(BaseModel):
    id: int
    bounty_id: int
    status: BountyStatus
    claimed_by: Optional[int] = None
    claim_deadline: Optional[datetime] = None
    warning_sent: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class BountyLifecycleStateCreate(BaseModel):
    bounty_id: int
    status: BountyStatus = BountyStatus.DRAFT
    claimed_by: Optional[int] = None
    claim_deadline: Optional[datetime] = None

    @validator('status')
    def validate_initial_status(cls, v):
        if v not in {BountyStatus.DRAFT, BountyStatus.OPEN}:
            raise ValueError("Initial status must be DRAFT or OPEN")
        return v


class BountyLifecycleStateUpdate(BaseModel):
    status: Optional[BountyStatus] = None
    claimed_by: Optional[int] = None
    claim_deadline: Optional[datetime] = None
    warning_sent: Optional[bool] = None


class BountyStatusTransition(BaseModel):
    bounty_id: int
    from_status: BountyStatus
    to_status: BountyStatus
    user_id: Optional[int] = None
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    @validator('to_status')
    def validate_transition(cls, v, values):
        from_status = values.get('from_status')
        if from_status:
            valid_transitions = BountyStatus.valid_transitions().get(from_status, set())
            if v not in valid_transitions:
                raise ValueError(f"Invalid transition from {from_status.value} to {v.value}")
        return v


class AuditLogEntryResponse(BaseModel):
    id: str
    timestamp: datetime
    bounty_id: int
    action: str
    user_id: Optional[int] = None
    details: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            uuid.UUID: str
        }


class AuditLogEntryCreate(BaseModel):
    bounty_id: int
    action: str
    user_id: Optional[int] = None
    details: Optional[Dict[str, Any]] = None

    @validator('action')
    def validate_action(cls, v):
        valid_actions = {
            'status_change', 'claimed', 'released', 'deadline_extended',
            'warning_sent', 'auto_released', 'payment_processed', 'cancelled'
        }
        if v not in valid_actions:
            raise ValueError(f"Invalid action: {v}")
        return v


class BountyClaimRequest(BaseModel):
    bounty_id: int
    user_id: int
    claim_duration_hours: int = Field(default=72, ge=24, le=168)

    @validator('claim_duration_hours')
    def validate_claim_duration(cls, v):
        if v not in {24, 48, 72, 96, 120, 144, 168}:
            raise ValueError("Claim duration must be 24, 48, 72, 96, 120, 144, or 168 hours")
        return v


class BountyReleaseRequest(BaseModel):
    bounty_id: int
    reason: str = Field(max_length=500)
    forced: bool = False


class DeadlineWarning(BaseModel):
    bounty_id: int
    claimed_by: int
    claim_deadline: datetime
    hours_remaining: int
    tier: str

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
