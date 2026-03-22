"""Milestone models for T3 bounties."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


class MilestoneStatus(str, Enum):
    """Lifecycle status of a milestone."""

    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"


class MilestoneBase(BaseModel):
    """Base fields for all milestone models."""

    milestone_number: int = Field(..., ge=1)
    description: str = Field(..., min_length=1, max_length=1000)
    percentage: float = Field(..., gt=0, le=100)


class MilestoneCreate(MilestoneBase):
    """Payload for creating a milestone."""
    pass


class MilestoneSubmit(BaseModel):
    """Payload for submitting a milestone."""

    notes: Optional[str] = Field(None, max_length=1000)


class MilestoneResponse(MilestoneBase):
    """API response for a milestone."""

    id: uuid.UUID
    bounty_id: uuid.UUID
    status: MilestoneStatus
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    payout_tx_hash: Optional[str] = None

    model_config = {"from_attributes": True}


class MilestoneListResponse(BaseModel):
    """List of milestones for a bounty."""

    bounty_id: uuid.UUID
    milestones: List[MilestoneResponse]
    total_percentage: float
