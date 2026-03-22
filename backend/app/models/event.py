"""Typed event models for the real-time WebSocket event server.

Defines Pydantic models for all event types emitted through pub/sub:
bounty_update, pr_submitted, review_progress, payout_sent, claim_update.
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


class EventType(str, Enum):
    """All supported real-time event types."""

    BOUNTY_UPDATE = "bounty_update"
    PR_SUBMITTED = "pr_submitted"
    REVIEW_PROGRESS = "review_progress"
    PAYOUT_SENT = "payout_sent"
    CLAIM_UPDATE = "claim_update"


class BountyUpdatePayload(BaseModel):
    """Payload for bounty lifecycle changes."""

    bounty_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=200)
    previous_status: Optional[str] = None
    new_status: str = Field(..., min_length=1)
    tier: Optional[int] = Field(None, ge=1, le=3)
    reward_amount: Optional[float] = Field(None, ge=0)
    model_config = {"from_attributes": True}


class PullRequestSubmittedPayload(BaseModel):
    """Payload for new PR submissions against a bounty."""

    bounty_id: str = Field(..., min_length=1)
    submission_id: str = Field(..., min_length=1)
    pr_url: str = Field(..., min_length=1)
    submitted_by: str = Field(..., min_length=1)
    model_config = {"from_attributes": True}

    @field_validator("pr_url")
    @classmethod
    def validate_pr_url(cls, value: str) -> str:
        """Ensure the PR URL points to GitHub."""
        if not value.startswith(("https://github.com/", "http://github.com/")):
            raise ValueError("pr_url must be a valid GitHub URL")
        return value


class ReviewProgressPayload(BaseModel):
    """Payload for AI review pipeline progress."""

    bounty_id: str = Field(..., min_length=1)
    submission_id: str = Field(..., min_length=1)
    reviewer: str = Field(..., min_length=1)
    score: Optional[float] = Field(None, ge=0, le=10)
    status: str = Field(..., min_length=1)
    details: Optional[str] = Field(None, max_length=2000)
    model_config = {"from_attributes": True}


class PayoutSentPayload(BaseModel):
    """Payload for confirmed on-chain payout events."""

    bounty_id: str = Field(..., min_length=1)
    recipient_wallet: str = Field(..., min_length=32, max_length=48)
    amount: float = Field(..., gt=0)
    tx_hash: Optional[str] = None
    solscan_url: Optional[str] = None
    model_config = {"from_attributes": True}


class ClaimUpdatePayload(BaseModel):
    """Payload for bounty claim lifecycle changes."""

    bounty_id: str = Field(..., min_length=1)
    claimer: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)
    deadline: Optional[datetime] = None
    model_config = {"from_attributes": True}

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: str) -> str:
        """Ensure action is one of the allowed claim actions."""
        allowed = {"claimed", "released", "expired"}
        if value not in allowed:
            raise ValueError(
                f"Invalid claim action: '{value}'. Must be one of: {sorted(allowed)}"
            )
        return value


PAYLOAD_TYPE_MAP: Dict[EventType, type] = {
    EventType.BOUNTY_UPDATE: BountyUpdatePayload,
    EventType.PR_SUBMITTED: PullRequestSubmittedPayload,
    EventType.REVIEW_PROGRESS: ReviewProgressPayload,
    EventType.PAYOUT_SENT: PayoutSentPayload,
    EventType.CLAIM_UPDATE: ClaimUpdatePayload,
}


class EventEnvelope(BaseModel):
    """Standard envelope wrapping every real-time event."""

    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: EventType
    channel: str = Field(..., min_length=1)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    payload: Dict[str, Any] = Field(default_factory=dict)
    model_config = {"from_attributes": True}


def create_event(
    event_type: EventType,
    channel: str,
    payload: Dict[str, Any],
) -> EventEnvelope:
    """Create and validate an event envelope for the given type."""
    payload_model = PAYLOAD_TYPE_MAP.get(event_type)
    if payload_model is not None:
        validated = payload_model(**payload)
        payload = validated.model_dump(mode="json")
    return EventEnvelope(
        event_type=event_type,
        channel=channel,
        payload=payload,
    )
