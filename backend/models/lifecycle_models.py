from enum import Enum
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field, validator
from uuid import UUID


class BountyLifecycleState(str, Enum):
    """Bounty lifecycle states with progression flow."""
    DRAFT = "draft"
    OPEN = "open"
    CLAIMED = "claimed"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"
    PAID = "paid"

    @classmethod
    def get_valid_transitions(cls, current_state: str) -> List[str]:
        """Get valid next states from current state."""
        transitions = {
            cls.DRAFT: [cls.OPEN],
            cls.OPEN: [cls.CLAIMED, cls.IN_REVIEW],  # T1 can skip claimed
            cls.CLAIMED: [cls.IN_REVIEW, cls.OPEN],  # can release back
            cls.IN_REVIEW: [cls.COMPLETED, cls.OPEN, cls.CLAIMED],
            cls.COMPLETED: [cls.PAID, cls.IN_REVIEW],  # can revert to review
            cls.PAID: []  # terminal state
        }
        return transitions.get(current_state, [])


class LifecycleTransition(BaseModel):
    """Model for lifecycle state transitions."""
    from_state: BountyLifecycleState
    to_state: BountyLifecycleState
    triggered_by: str  # user_id or 'system'
    trigger_type: Literal["manual", "webhook", "deadline", "system"] = "manual"
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    reason: Optional[str] = None

    @validator('to_state')
    def validate_transition(cls, v, values):
        """Validate state transition is allowed."""
        from_state = values.get('from_state')
        if from_state:
            valid_transitions = BountyLifecycleState.get_valid_transitions(from_state)
            if v not in valid_transitions:
                raise ValueError(f"Invalid transition from {from_state} to {v}")
        return v


class ClaimRequest(BaseModel):
    """Model for bounty claim requests."""
    bounty_id: UUID
    claimer_id: str
    claim_type: Literal["standard", "emergency"] = "standard"
    proposed_deadline: Optional[datetime] = None
    claim_message: Optional[str] = None
    github_username: Optional[str] = None
    estimated_completion_hours: Optional[int] = None
    previous_work_examples: List[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @validator('estimated_completion_hours')
    def validate_hours(cls, v):
        """Validate completion hours are reasonable."""
        if v is not None and (v < 1 or v > 720):  # 1 hour to 30 days
            raise ValueError("Estimated hours must be between 1 and 720")
        return v


class DeadlineCheck(BaseModel):
    """Model for deadline monitoring and enforcement."""
    bounty_id: UUID
    claim_id: UUID
    claimer_id: str
    deadline: datetime
    warning_sent_80: bool = False
    warning_sent_90: bool = False
    auto_released: bool = False
    last_checked: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    time_remaining_hours: Optional[float] = None
    completion_percentage: float = 0.0
    status: Literal["active", "warning", "critical", "expired"] = "active"

    @validator('completion_percentage')
    def validate_percentage(cls, v):
        """Validate completion percentage is valid."""
        if v < 0 or v > 100:
            raise ValueError("Completion percentage must be between 0 and 100")
        return v

    def calculate_status(self) -> str:
        """Calculate current deadline status."""
        now = datetime.now(timezone.utc)
        if self.deadline <= now:
            return "expired"

        time_left = (self.deadline - now).total_seconds() / 3600
        total_time = (self.deadline - (now - (now - self.last_checked))).total_seconds() / 3600

        if time_left <= total_time * 0.1:  # 10% or less remaining
            return "critical"
        elif time_left <= total_time * 0.2:  # 20% or less remaining
            return "warning"
        return "active"


class AuditLogEntry(BaseModel):
    """Immutable audit log entry for bounty lifecycle events."""
    id: UUID
    bounty_id: UUID
    event_type: Literal[
        "state_transition", "claim_created", "claim_released",
        "deadline_warning", "deadline_expired", "payment_processed",
        "webhook_received", "manual_override"
    ]
    actor_id: str  # user_id or 'system'
    actor_type: Literal["user", "system", "webhook"] = "user"
    event_data: Dict[str, Any] = Field(default_factory=dict)
    previous_state: Optional[BountyLifecycleState] = None
    new_state: Optional[BountyLifecycleState] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    rollback_reference: Optional[UUID] = None

    class Config:
        """Pydantic config for audit log."""
        frozen = True  # Make immutable
        extra = "forbid"  # Strict field validation


class WebhookEvent(BaseModel):
    """Model for GitHub webhook events affecting bounty lifecycle."""
    event_id: UUID = Field(default_factory=lambda: UUID.uuid4())
    bounty_id: Optional[UUID] = None
    event_type: str  # 'pull_request', 'issues', etc.
    action: str  # 'opened', 'closed', 'merged', etc.
    github_data: Dict[str, Any] = Field(default_factory=dict)
    pr_number: Optional[int] = None
    pr_state: Optional[str] = None
    pr_merged: bool = False
    author_username: Optional[str] = None
    processed: bool = False
    processing_result: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: Optional[datetime] = None
    retry_count: int = 0

    @validator('github_data')
    def sanitize_github_data(cls, v):
        """Remove sensitive data from GitHub webhook payload."""
        sensitive_keys = ['token', 'installation', 'sender.email']
        cleaned = dict(v)
        for key in sensitive_keys:
            if '.' in key:
                parts = key.split('.')
                current = cleaned
                for part in parts[:-1]:
                    if isinstance(current, dict) and part in current:
                        current = current[part]
                    else:
                        break
                else:
                    if isinstance(current, dict) and parts[-1] in current:
                        del current[parts[-1]]
            elif key in cleaned:
                del cleaned[key]
        return cleaned


class BountyLifecycleExtension(BaseModel):
    """Extension fields for existing bounty model to support lifecycle."""
    lifecycle_state: BountyLifecycleState = BountyLifecycleState.DRAFT
    claimed_by: Optional[str] = None
    claim_deadline: Optional[datetime] = None
    claim_id: Optional[UUID] = None
    last_state_change: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    state_change_count: int = 0
    auto_release_enabled: bool = True
    deadline_warnings_sent: int = 0
    completion_estimated_hours: Optional[int] = None
    actual_completion_hours: Optional[float] = None

    @validator('lifecycle_state')
    def validate_state_consistency(cls, v, values):
        """Ensure lifecycle state is consistent with other fields."""
        claimed_by = values.get('claimed_by')
        if v == BountyLifecycleState.CLAIMED and not claimed_by:
            raise ValueError("CLAIMED state requires claimed_by to be set")
        if v != BountyLifecycleState.CLAIMED and claimed_by:
            # Allow for IN_REVIEW and COMPLETED states to keep claimer info
            if v not in [BountyLifecycleState.IN_REVIEW, BountyLifecycleState.COMPLETED]:
                raise ValueError(f"State {v} should not have claimed_by set")
        return v
