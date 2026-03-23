"""On-chain webhook event models for SolFoundry.

Defines Pydantic and SQLAlchemy models for the on-chain event webhook
pipeline: escrow locks/releases, reputation updates, and staking events.

Event types
-----------
- escrow.locked      — escrow funded and activated on-chain
- escrow.released    — bounty winner paid out on-chain
- reputation.updated — contributor reputation score changed
- stake.deposited    — FNDRY staked into the staking program
- stake.withdrawn    — FNDRY unstaked from the staking program

Each event payload includes the on-chain transaction signature, slot,
timestamp, and relevant account data for full auditability.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.database import Base

# ---------------------------------------------------------------------------
# Event type enum
# ---------------------------------------------------------------------------


class OnChainEventType(str, Enum):
    """Supported on-chain webhook event types."""

    ESCROW_LOCKED = "escrow.locked"
    ESCROW_RELEASED = "escrow.released"
    REPUTATION_UPDATED = "reputation.updated"
    STAKE_DEPOSITED = "stake.deposited"
    STAKE_WITHDRAWN = "stake.withdrawn"


ON_CHAIN_EVENTS = tuple(e.value for e in OnChainEventType)


# ---------------------------------------------------------------------------
# Payload schemas — one per event type
# ---------------------------------------------------------------------------


class OnChainEventBase(BaseModel):
    """Common fields present in every on-chain event payload."""

    tx_signature: str = Field(
        ..., description="Solana transaction signature (base58)", min_length=44
    )
    slot: int = Field(..., description="Solana slot number at time of event", ge=0)
    block_time: int = Field(
        ..., description="Unix timestamp of the block containing this transaction", ge=0
    )
    program_id: str = Field(
        ..., description="Solana program address that emitted the event"
    )


class EscrowLockedPayload(OnChainEventBase):
    """Payload for escrow.locked — bounty funded and locked on-chain."""

    bounty_id: str = Field(..., description="SolFoundry bounty UUID")
    creator_wallet: str = Field(..., description="Creator's Solana wallet address")
    amount: float = Field(..., description="FNDRY amount locked in escrow", gt=0)
    escrow_account: str = Field(
        ..., description="On-chain escrow PDA or token account address"
    )
    mint: str = Field(..., description="FNDRY SPL token mint address")


class EscrowReleasedPayload(OnChainEventBase):
    """Payload for escrow.released — bounty payout sent to winner."""

    bounty_id: str = Field(..., description="SolFoundry bounty UUID")
    winner_wallet: str = Field(..., description="Winner's Solana wallet address")
    amount: float = Field(..., description="FNDRY amount released to winner", gt=0)
    escrow_account: str = Field(..., description="On-chain escrow account address")
    mint: str = Field(..., description="FNDRY SPL token mint address")


class ReputationUpdatedPayload(OnChainEventBase):
    """Payload for reputation.updated — contributor reputation changed."""

    contributor_wallet: str = Field(
        ..., description="Contributor's Solana wallet address"
    )
    previous_score: float = Field(
        ..., description="Reputation score before the update", ge=0
    )
    new_score: float = Field(..., description="Reputation score after the update", ge=0)
    delta: float = Field(..., description="Score change (positive = gain, negative = loss)")
    tier: str = Field(..., description="New reputation tier after the update")
    reason: str = Field(
        ..., description="Human-readable reason for the reputation change"
    )


class StakeDepositedPayload(OnChainEventBase):
    """Payload for stake.deposited — FNDRY staked into the staking program."""

    staker_wallet: str = Field(..., description="Staker's Solana wallet address")
    amount: float = Field(..., description="FNDRY amount deposited", gt=0)
    stake_account: str = Field(
        ..., description="On-chain stake account PDA address"
    )
    total_staked: float = Field(
        ..., description="Total FNDRY staked by this wallet after deposit", ge=0
    )
    lock_period_days: Optional[int] = Field(
        None, description="Optional lock period in days"
    )


class StakeWithdrawnPayload(OnChainEventBase):
    """Payload for stake.withdrawn — FNDRY unstaked from the staking program."""

    staker_wallet: str = Field(..., description="Staker's Solana wallet address")
    amount: float = Field(..., description="FNDRY amount withdrawn", gt=0)
    stake_account: str = Field(
        ..., description="On-chain stake account PDA address"
    )
    remaining_staked: float = Field(
        ..., description="Total FNDRY still staked by this wallet", ge=0
    )
    cooldown_ends_at: Optional[int] = Field(
        None, description="Unix timestamp when unstake cooldown expires (if applicable)"
    )


PAYLOAD_MODEL_MAP: Dict[OnChainEventType, type] = {
    OnChainEventType.ESCROW_LOCKED: EscrowLockedPayload,
    OnChainEventType.ESCROW_RELEASED: EscrowReleasedPayload,
    OnChainEventType.REPUTATION_UPDATED: ReputationUpdatedPayload,
    OnChainEventType.STAKE_DEPOSITED: StakeDepositedPayload,
    OnChainEventType.STAKE_WITHDRAWN: StakeWithdrawnPayload,
}


# ---------------------------------------------------------------------------
# Envelope — wraps all on-chain event deliveries
# ---------------------------------------------------------------------------


class OnChainWebhookPayload(BaseModel):
    """Envelope sent in every on-chain webhook HTTP POST."""

    event_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="Unique delivery ID for idempotency",
    )
    event_type: OnChainEventType = Field(..., description="Type of on-chain event")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        description="ISO-8601 UTC timestamp of this delivery",
    )
    data: Dict[str, Any] = Field(..., description="Event-specific payload data")

    model_config = {"use_enum_values": True}


class OnChainWebhookBatch(BaseModel):
    """Batch envelope grouping multiple events within a 5-second window."""

    batch_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    delivered_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    )
    event_count: int
    events: List[OnChainWebhookPayload]


# ---------------------------------------------------------------------------
# SQLAlchemy — on-chain webhook delivery log
# ---------------------------------------------------------------------------


class OnChainDeliveryLogDB(Base):
    """Persistent log of on-chain webhook delivery attempts."""

    __tablename__ = "onchain_webhook_delivery_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(50), nullable=False, index=True)
    tx_signature = Column(String(100), nullable=True, index=True)
    slot = Column(Integer, nullable=True)
    payload = Column(JSONB, nullable=False)
    target_url = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending/success/failed
    http_status = Column(Integer, nullable=True)
    attempt_count = Column(Integer, nullable=False, default=0)
    last_error = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    delivered_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_onchain_delivery_event_type", "event_type"),
        Index("ix_onchain_delivery_status", "status"),
        Index("ix_onchain_delivery_created_at", "created_at"),
    )


# ---------------------------------------------------------------------------
# SQLAlchemy — on-chain webhook subscription (global admin-managed endpoints)
# ---------------------------------------------------------------------------


class OnChainWebhookSubscriptionDB(Base):
    """Admin-managed global endpoint subscribed to on-chain events."""

    __tablename__ = "onchain_webhook_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(Text, nullable=False)
    secret = Column(Text, nullable=True)
    event_types = Column(JSONB, nullable=False, default=list)
    active = Column(Boolean, nullable=False, default=True)
    description = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    last_delivery_at = Column(DateTime(timezone=True), nullable=True)
    last_delivery_status = Column(String(20), nullable=True)
    failure_count = Column(Integer, nullable=False, default=0)


# ---------------------------------------------------------------------------
# API request/response schemas
# ---------------------------------------------------------------------------


class OnChainWebhookSubscriptionCreate(BaseModel):
    """Request body for registering an on-chain webhook subscription."""

    url: str = Field(..., description="HTTPS endpoint to receive webhook payloads")
    secret: Optional[str] = Field(
        None, description="HMAC-SHA256 signing secret (stored hashed)"
    )
    event_types: List[OnChainEventType] = Field(
        default_factory=list,
        description="Event types to subscribe to (empty = all events)",
    )
    description: Optional[str] = Field(None, max_length=500)

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        """Ensure URL uses HTTPS."""
        if not v.startswith("https://"):
            raise ValueError("Webhook URL must use HTTPS")
        return v


class OnChainWebhookSubscriptionResponse(BaseModel):
    """Response schema for a webhook subscription."""

    id: str
    url: str
    event_types: List[str]
    active: bool
    description: Optional[str] = None
    created_at: str
    last_delivery_at: Optional[str] = None
    last_delivery_status: Optional[str] = None
    failure_count: int = 0


class DeliveryLogEntry(BaseModel):
    """Single entry in the webhook delivery history."""

    id: str
    event_type: str
    tx_signature: Optional[str] = None
    slot: Optional[int] = None
    target_url: str
    status: str
    http_status: Optional[int] = None
    attempt_count: int
    last_error: Optional[str] = None
    created_at: str
    delivered_at: Optional[str] = None


class DeliveryDashboardResponse(BaseModel):
    """Aggregated delivery statistics for the admin dashboard."""

    total_deliveries: int
    successful_deliveries: int
    failed_deliveries: int
    pending_deliveries: int
    success_rate: float = Field(..., description="0.0 – 1.0")
    avg_attempts: float
    recent_failures: List[DeliveryLogEntry]
    by_event_type: Dict[str, int]


class TestEventRequest(BaseModel):
    """Request body for the test event endpoint."""

    event_type: OnChainEventType = Field(
        default=OnChainEventType.ESCROW_LOCKED,
        description="Event type to simulate",
    )
    target_url: Optional[str] = Field(
        None,
        description="Override URL to send the test event to (defaults to all active subscriptions)",
    )

    @field_validator("target_url")
    @classmethod
    def validate_target_url(cls, v: Optional[str]) -> Optional[str]:
        """Ensure override URL uses HTTPS."""
        if v and not v.startswith("https://"):
            raise ValueError("Target URL must use HTTPS")
        return v


class TestEventResponse(BaseModel):
    """Response after sending a test event."""

    event_id: str
    event_type: str
    targets_notified: int
    results: List[Dict[str, Any]]
