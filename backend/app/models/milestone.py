"""Milestone Pydantic models and SQLAlchemy ORM table for multi-stage payouts.

Milestones enable T3 bounties to release partial $FNDRY payments at defined
checkpoints instead of all-or-nothing.  Each milestone carries a percentage
of the total bounty reward and must be approved sequentially (milestone N
must be approved before milestone N+1).

Lifecycle::

    PENDING -> SUBMITTED -> APPROVED -> PAID
                  |
                  +-> REJECTED -> (can re-submit as SUBMITTED)

PostgreSQL migration::

    CREATE TABLE milestones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bounty_id UUID NOT NULL REFERENCES bounties(id) ON DELETE CASCADE,
        milestone_number INTEGER NOT NULL CHECK (milestone_number >= 1),
        description TEXT NOT NULL,
        percentage NUMERIC(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        submitted_by VARCHAR(100),
        submitted_at TIMESTAMPTZ,
        approved_by VARCHAR(100),
        approved_at TIMESTAMPTZ,
        recipient_wallet VARCHAR(64),
        payout_tx_hash VARCHAR(128),
        payout_amount NUMERIC(20,6),
        payout_at TIMESTAMPTZ,
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(bounty_id, milestone_number)
    );
    CREATE INDEX idx_milestones_status ON milestones(status);
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, Index, Integer, String, Text
from pydantic import BaseModel, Field, field_validator

from app.database import Base, GUID


def _now() -> datetime:
    """Return the current UTC timestamp for column defaults."""
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Milestone status enum and state machine
# ---------------------------------------------------------------------------


class MilestoneStatus(str, Enum):
    """Lifecycle states for a milestone payout checkpoint.

    State machine::

        PENDING -> SUBMITTED -> APPROVED -> PAID
                      |
                      +-> REJECTED -> (can re-submit as SUBMITTED)
    """

    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"


ALLOWED_MILESTONE_TRANSITIONS: dict[MilestoneStatus, frozenset[MilestoneStatus]] = {
    MilestoneStatus.PENDING: frozenset({MilestoneStatus.SUBMITTED}),
    MilestoneStatus.SUBMITTED: frozenset({
        MilestoneStatus.APPROVED,
        MilestoneStatus.REJECTED,
    }),
    MilestoneStatus.APPROVED: frozenset({MilestoneStatus.PAID}),
    MilestoneStatus.REJECTED: frozenset({MilestoneStatus.SUBMITTED}),
    MilestoneStatus.PAID: frozenset(),  # terminal
}


# ---------------------------------------------------------------------------
# SQLAlchemy ORM model
# ---------------------------------------------------------------------------


class MilestoneTable(Base):
    """Persistent milestone record stored in PostgreSQL.

    Each row represents one checkpoint in a multi-stage bounty payout.
    The (bounty_id, milestone_number) pair is unique to prevent duplicate
    milestone numbers within a bounty.  Monetary columns use sa.Numeric
    for precision.

    Uses the cross-database GUID type (instead of PostgreSQL-specific UUID)
    to ensure compatibility with SQLite in test environments.
    """

    __tablename__ = "milestones"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(
        GUID(),
        sa.ForeignKey("bounties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    milestone_number = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    percentage = Column(
        sa.Numeric(precision=5, scale=2),
        nullable=False,
    )
    status = Column(String(20), nullable=False, server_default="pending")
    submitted_by = Column(String(100), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    recipient_wallet = Column(
        String(64),
        nullable=True,
        doc="Solana wallet address of the payout recipient (resolved from user record)",
    )
    payout_tx_hash = Column(String(128), nullable=True)
    payout_amount = Column(
        sa.Numeric(precision=20, scale=6),
        nullable=True,
    )
    payout_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String(100), nullable=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=_now,
        onupdate=_now,
    )

    __table_args__ = (
        Index(
            "ix_milestone_bounty_number",
            "bounty_id",
            "milestone_number",
            unique=True,
        ),
        Index("ix_milestones_status", "status"),
    )


# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------


class MilestoneCreate(BaseModel):
    """Request body for defining a single milestone on a bounty.

    The bounty owner provides a description and what percentage of
    the total reward this milestone represents.  Milestone numbers
    are assigned server-side in order of creation.

    Args (fields):
        description: What the contributor must deliver for this milestone.
        percentage: Share of the total bounty reward (0 < pct <= 100).
    """

    description: str = Field(
        ...,
        min_length=3,
        max_length=2000,
        description="What must be delivered for this milestone",
        examples=["Implement database schema and migration"],
    )
    percentage: Decimal = Field(
        ...,
        gt=Decimal("0"),
        le=Decimal("100"),
        description="Percentage of total bounty reward for this milestone",
        examples=[Decimal("33.33")],
    )

    @field_validator("percentage")
    @classmethod
    def validate_percentage_precision(cls, value: Decimal) -> Decimal:
        """Ensure percentage has at most 2 decimal places.

        Args:
            value: The percentage to validate.

        Returns:
            The validated Decimal value.

        Raises:
            ValueError: If more than 2 decimal places are provided.
        """
        if value.as_tuple().exponent < -2:  # type: ignore[operator]
            raise ValueError("Percentage must have at most 2 decimal places")
        return value


class MilestoneBatchCreate(BaseModel):
    """Request body for creating all milestones for a bounty at once.

    The total percentages across all milestones must sum to exactly 100%.

    Args (fields):
        milestones: Ordered list of milestone definitions.
    """

    milestones: list[MilestoneCreate] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Ordered list of milestones (percentages must sum to 100%)",
    )

    @field_validator("milestones")
    @classmethod
    def validate_total_percentage(cls, milestones: list[MilestoneCreate]) -> list[MilestoneCreate]:
        """Ensure milestone percentages sum to exactly 100%.

        Args:
            milestones: The list of milestone definitions to validate.

        Returns:
            The validated milestone list.

        Raises:
            ValueError: If percentages do not sum to 100%.
        """
        total = sum(milestone.percentage for milestone in milestones)
        if total != Decimal("100"):
            raise ValueError(
                f"Milestone percentages must sum to exactly 100%, got {total}%"
            )
        return milestones


class MilestoneSubmitRequest(BaseModel):
    """Request body for submitting a milestone for approval.

    The contributor provides evidence of completion (e.g. PR URL, notes).

    Args (fields):
        evidence: Description of work completed or link to deliverable.
    """

    evidence: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Evidence of milestone completion (PR URL, description, etc.)",
        examples=["https://github.com/org/repo/pull/42 - schema migration complete"],
    )


class MilestoneRejectRequest(BaseModel):
    """Request body for rejecting a milestone with an optional reason.

    The bounty owner can provide a reason explaining what needs to change.
    The reason is optional to allow quick rejections without explanation.

    Args (fields):
        reason: Optional reason for rejection explaining what needs to change.
    """

    reason: Optional[str] = Field(
        None,
        max_length=2000,
        description="Rejection reason explaining what needs to change",
        examples=["Missing error handling, please add try/except blocks"],
    )


class MilestoneResponse(BaseModel):
    """API response for a single milestone with full lifecycle metadata.

    Includes status, approval info, payout details, and timestamps for
    complete milestone tracking.
    """

    id: str = Field(..., description="Unique milestone identifier (UUID)")
    bounty_id: str = Field(..., description="Parent bounty UUID")
    milestone_number: int = Field(..., description="Sequential milestone number (1-based)")
    description: str = Field(..., description="What must be delivered")
    percentage: Decimal = Field(..., description="Percentage of total bounty reward")
    status: MilestoneStatus = Field(..., description="Current lifecycle state")
    submitted_by: Optional[str] = Field(None, description="Who submitted this milestone")
    submitted_at: Optional[datetime] = Field(None, description="When it was submitted")
    approved_by: Optional[str] = Field(None, description="Who approved this milestone")
    approved_at: Optional[datetime] = Field(None, description="When it was approved")
    recipient_wallet: Optional[str] = Field(None, description="Solana wallet address for payout")
    payout_tx_hash: Optional[str] = Field(None, description="On-chain transaction signature")
    payout_amount: Optional[Decimal] = Field(None, description="Actual payout amount in $FNDRY")
    payout_at: Optional[datetime] = Field(None, description="When the payout was sent")
    created_by: str = Field(..., description="Bounty owner who defined this milestone")
    created_at: datetime = Field(..., description="Creation timestamp (UTC)")
    updated_at: datetime = Field(..., description="Last update timestamp (UTC)")

    model_config = {"from_attributes": True}


class MilestoneListResponse(BaseModel):
    """List of milestones for a bounty, ordered by milestone_number.

    Used by the bounty detail page to show milestone progress.
    """

    bounty_id: str = Field(..., description="Parent bounty UUID")
    milestones: list[MilestoneResponse] = Field(
        default_factory=list,
        description="Milestones ordered by milestone_number",
    )
    total_percentage_approved: Decimal = Field(
        default=Decimal("0"),
        description="Sum of percentages for approved/paid milestones",
    )
    total_percentage_paid: Decimal = Field(
        default=Decimal("0"),
        description="Sum of percentages for paid milestones",
    )
    total_paid_amount: Decimal = Field(
        default=Decimal("0"),
        description="Total $FNDRY already paid across milestones",
    )
