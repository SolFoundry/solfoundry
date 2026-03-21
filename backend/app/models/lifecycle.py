"""Pydantic models for bounty lifecycle management (Issue #164).

PostgreSQL migration path: lifecycle_audit_log(id, bounty_id, from_status,
to_status, triggered_by, action, reason, metadata JSONB, created_at).
bounty_claims(id, bounty_id, claimed_by, claimed_at, deadline,
estimated_hours, released, released_at, warning_sent).
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


class LifecycleNotFoundError(Exception):
    """Raised when a bounty is not found during a lifecycle operation."""


class LifecycleValidationError(Exception):
    """Raised when a lifecycle transition is invalid or disallowed."""


class LifecycleAction(str, Enum):
    """Actions that trigger lifecycle state transitions."""
    CREATE_DRAFT = "create_draft"
    PUBLISH = "publish"
    CLAIM = "claim"
    RELEASE_CLAIM = "release_claim"
    SUBMIT_FOR_REVIEW = "submit_for_review"
    APPROVE = "approve"
    REJECT = "reject"
    MARK_PAID = "mark_paid"
    AUTO_RELEASE = "auto_release"
    DEADLINE_WARNING = "deadline_warning"
    WEBHOOK_UPDATE = "webhook_update"


class AuditLogEntry(BaseModel):
    """Immutable record of a lifecycle state transition."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str
    from_status: str
    to_status: str
    triggered_by: str = "system"
    action: str
    reason: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ClaimRequest(BaseModel):
    """Payload for claiming a bounty."""
    claimed_by: str = Field(..., min_length=1, max_length=100)
    estimated_hours: Optional[int] = Field(None, ge=1, le=720)

    @field_validator("claimed_by")
    @classmethod
    def validate_claimed_by(cls, v: str) -> str:
        """Reject blank-after-trim values."""
        if not v.strip():
            raise ValueError("claimed_by must not be blank")
        return v.strip()


class ClaimRecord(BaseModel):
    """Internal storage for an active bounty claim."""
    bounty_id: str
    claimed_by: str
    claimed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deadline: Optional[datetime] = None
    estimated_hours: Optional[int] = None
    released: bool = False
    released_at: Optional[datetime] = None
    warning_sent: bool = False


class ReleaseClaimRequest(BaseModel):
    """Payload for releasing a claim."""
    released_by: str = Field(..., min_length=1, max_length=100)
    reason: Optional[str] = Field(None, max_length=500)


class WebhookTransitionRequest(BaseModel):
    """Payload for webhook-triggered status updates."""
    # NOTE: pr_url min_length=1 is intentional; full URL format validated below.
    pr_url: str = Field(..., min_length=1)
    pr_action: str = Field(...)
    sender: str = Field(..., min_length=1, max_length=100)

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, v: str) -> str:
        """Validate GitHub URL format.

        Note: This duplicates bounty.py SubmissionCreate.validate_pr_url.
        Both share the same GitHub URL rule; extracting to a shared helper
        is deferred to keep the diff minimal. See bounty.py for the canonical
        version.
        """
        if not v.startswith(("https://github.com/", "http://github.com/")):
            raise ValueError("pr_url must be a valid GitHub URL")
        return v

    @field_validator("pr_action")
    @classmethod
    def validate_pr_action(cls, v: str) -> str:
        """Validate PR action type."""
        if v not in {"opened", "merged", "closed"}:
            raise ValueError("pr_action must be one of: closed, merged, opened")
        return v
