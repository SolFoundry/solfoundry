"""SQLAlchemy ORM models and Pydantic schemas for on-chain event indexing.

Stores Solana program events captured via Helius/Shyft webhooks.  Each
indexed event is immutable and uniquely identified by its transaction
signature + log index, enabling deduplication across webhook retries.

PostgreSQL migration path::

    CREATE TABLE indexed_events (
        id              VARCHAR(36) PRIMARY KEY,
        transaction_signature VARCHAR(128) NOT NULL,
        log_index       INTEGER NOT NULL DEFAULT 0,
        event_type      VARCHAR(40) NOT NULL,
        program_id      VARCHAR(64) NOT NULL,
        block_slot      BIGINT NOT NULL,
        block_time      TIMESTAMPTZ NOT NULL,
        source          VARCHAR(20) NOT NULL DEFAULT 'helius',
        accounts        JSONB NOT NULL DEFAULT '{}',
        data            JSONB NOT NULL DEFAULT '{}',
        user_wallet     VARCHAR(64),
        bounty_id       VARCHAR(36),
        amount          NUMERIC(20,6),
        status          VARCHAR(20) NOT NULL DEFAULT 'confirmed',
        indexed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (transaction_signature, log_index)
    );

    CREATE INDEX ix_indexed_events_event_type ON indexed_events (event_type);
    CREATE INDEX ix_indexed_events_user_wallet ON indexed_events (user_wallet);
    CREATE INDEX ix_indexed_events_block_time ON indexed_events (block_time);
    CREATE INDEX ix_indexed_events_bounty_id ON indexed_events (bounty_id);
    CREATE INDEX ix_indexed_events_status ON indexed_events (status);
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, Index, Integer, String, Text, BigInteger
from pydantic import BaseModel, Field, field_validator

from app.database import Base


def _now() -> datetime:
    """Return current UTC timestamp for default column values."""
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class OnChainEventType(str, Enum):
    """Types of on-chain events that the indexer captures.

    Each type maps to a specific instruction in the SolFoundry
    Anchor programs (escrow, reputation, staking).
    """

    ESCROW_CREATED = "escrow_created"
    ESCROW_RELEASED = "escrow_released"
    REPUTATION_UPDATED = "reputation_updated"
    STAKE_DEPOSITED = "stake_deposited"
    ESCROW_REFUNDED = "escrow_refunded"
    ESCROW_FUNDED = "escrow_funded"


class EventSource(str, Enum):
    """Webhook provider that delivered the event.

    Helius and Shyft are the two supported indexing providers.
    The 'backfill' source is used for historical data loaded via
    the backfill command.
    """

    HELIUS = "helius"
    SHYFT = "shyft"
    BACKFILL = "backfill"


class IndexedEventStatus(str, Enum):
    """Processing status of an indexed event.

    Events start as 'confirmed' when received from the webhook
    provider. The 'processing' state is transient during queue
    handling. 'failed' indicates a processing error that needs
    manual review.
    """

    CONFIRMED = "confirmed"
    PROCESSING = "processing"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# SQLAlchemy ORM model
# ---------------------------------------------------------------------------

class IndexedEventTable(Base):
    """Persistent record for an on-chain Solana program event.

    One row per unique (transaction_signature, log_index) pair.
    The log_index differentiates multiple events within a single
    transaction (e.g., an escrow fund + state change in one tx).

    Attributes:
        id: Unique UUID primary key.
        transaction_signature: Solana transaction signature (base-58).
        log_index: Position of this event within the transaction logs.
        event_type: Categorized event type from OnChainEventType enum.
        program_id: Solana program address that emitted the event.
        block_slot: Solana slot number when the transaction was confirmed.
        block_time: On-chain block timestamp (UTC).
        source: Webhook provider or backfill origin.
        accounts: JSON object mapping account roles to public keys.
        data: Raw event data payload as JSON.
        user_wallet: Primary user wallet associated with this event.
        bounty_id: Associated bounty UUID if applicable.
        amount: Token amount involved in the event (Decimal for precision).
        status: Current processing status.
        indexed_at: Timestamp when this event was stored in the database.
    """

    __tablename__ = "indexed_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_signature = Column(String(128), nullable=False, index=True)
    log_index = Column(Integer, nullable=False, default=0)
    event_type = Column(String(40), nullable=False, index=True)
    program_id = Column(String(64), nullable=False)
    block_slot = Column(BigInteger, nullable=False)
    block_time = Column(DateTime(timezone=True), nullable=False)
    source = Column(String(20), nullable=False, default="helius")
    accounts = Column(sa.JSON, nullable=False, default=dict)
    data = Column(sa.JSON, nullable=False, default=dict)
    user_wallet = Column(String(64), nullable=True, index=True)
    bounty_id = Column(String(36), nullable=True, index=True)
    amount = Column(sa.Numeric(precision=20, scale=6), nullable=True)
    status = Column(String(20), nullable=False, default="confirmed")
    indexed_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True,
    )

    __table_args__ = (
        sa.UniqueConstraint(
            "transaction_signature", "log_index",
            name="uq_indexed_events_tx_log",
        ),
        Index("ix_indexed_events_block_time", block_time),
        Index("ix_indexed_events_status", status),
    )


# ---------------------------------------------------------------------------
# Indexer health tracking table
# ---------------------------------------------------------------------------

class IndexerHealthTable(Base):
    """Tracks the health and progress of the event indexer.

    A single row per source tracks the latest processed slot and
    timestamp, enabling gap detection and staleness alerts.

    Attributes:
        id: Unique UUID primary key.
        source: The indexing source (helius, shyft, backfill).
        latest_slot: Most recently processed Solana slot number.
        latest_block_time: Timestamp of the most recently processed block.
        events_processed: Cumulative count of events indexed from this source.
        last_webhook_received_at: Timestamp of last webhook delivery.
        last_error: Most recent error message if any.
        updated_at: Last time this health record was updated.
    """

    __tablename__ = "indexer_health"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source = Column(String(20), nullable=False, unique=True)
    latest_slot = Column(BigInteger, nullable=False, default=0)
    latest_block_time = Column(DateTime(timezone=True), nullable=True)
    events_processed = Column(BigInteger, nullable=False, default=0)
    last_webhook_received_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now,
    )


# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------

class HeliusWebhookEvent(BaseModel):
    """Single event from a Helius enhanced transaction webhook.

    Helius sends an array of these in the webhook body.  Each
    represents one parsed transaction with account and token
    transfer details.

    Attributes:
        signature: Transaction signature (base-58 encoded).
        slot: Solana slot number.
        blockTime: Unix timestamp of the block.
        type: Helius-classified transaction type.
        source: Source program or protocol name.
        accountData: List of account state changes.
        nativeTransfers: SOL transfer details.
        tokenTransfers: SPL token transfer details.
        description: Human-readable transaction description.
    """

    signature: str = Field(..., min_length=64, max_length=128)
    slot: int = Field(..., ge=0)
    blockTime: int = Field(..., ge=0)
    type: str = Field(default="UNKNOWN")
    source: str = Field(default="")
    accountData: List[Dict[str, Any]] = Field(default_factory=list)
    nativeTransfers: List[Dict[str, Any]] = Field(default_factory=list)
    tokenTransfers: List[Dict[str, Any]] = Field(default_factory=list)
    description: str = Field(default="")

    model_config = {"from_attributes": True}


class ShyftWebhookEvent(BaseModel):
    """Single event from a Shyft transaction webhook.

    Shyft uses a different payload structure with nested result
    objects for parsed instructions.

    Attributes:
        txn_signature: Transaction signature (base-58 encoded).
        slot: Solana slot number.
        block_time: Unix timestamp of the block.
        type: Shyft-classified event type.
        actions: List of parsed instruction actions.
        raw: Optional raw transaction data.
    """

    txn_signature: str = Field(..., min_length=64, max_length=128, alias="signature")
    slot: int = Field(..., ge=0)
    block_time: int = Field(default=0, alias="blockTime")
    type: str = Field(default="UNKNOWN")
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    raw: Optional[Dict[str, Any]] = Field(default=None)

    model_config = {"from_attributes": True, "populate_by_name": True}


class IndexedEventResponse(BaseModel):
    """Public response schema for a single indexed on-chain event.

    Attributes:
        id: Unique event UUID.
        transaction_signature: Solana transaction signature.
        log_index: Position within the transaction logs.
        event_type: Categorized event type.
        program_id: Emitting Solana program address.
        block_slot: Solana slot number.
        block_time: Block timestamp (ISO 8601).
        source: Webhook provider that delivered this event.
        accounts: Account role to public key mapping.
        data: Raw event data payload.
        user_wallet: Primary user wallet if identified.
        bounty_id: Associated bounty UUID if applicable.
        amount: Token amount involved (if applicable).
        status: Processing status.
        indexed_at: When this event was stored.
    """

    id: str
    transaction_signature: str
    log_index: int
    event_type: str
    program_id: str
    block_slot: int
    block_time: datetime
    source: str
    accounts: Dict[str, Any] = Field(default_factory=dict)
    data: Dict[str, Any] = Field(default_factory=dict)
    user_wallet: Optional[str] = None
    bounty_id: Optional[str] = None
    amount: Optional[float] = None
    status: str
    indexed_at: datetime

    model_config = {"from_attributes": True}


class IndexedEventListResponse(BaseModel):
    """Paginated list of indexed events with metadata.

    Attributes:
        events: List of indexed event records.
        total: Total number of events matching the filter criteria.
        page: Current page number (1-indexed).
        page_size: Number of events per page.
        has_more: Whether additional pages are available.
    """

    events: List[IndexedEventResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class IndexerHealthResponse(BaseModel):
    """Health status of the event indexer.

    Attributes:
        source: Indexing source name.
        latest_slot: Most recently processed slot.
        latest_block_time: Timestamp of latest processed block.
        events_processed: Total events indexed.
        last_webhook_received_at: When the last webhook arrived.
        last_error: Most recent error message if any.
        is_healthy: Whether the indexer is operating normally.
        seconds_behind: Estimated seconds behind real-time.
    """

    source: str
    latest_slot: int
    latest_block_time: Optional[datetime] = None
    events_processed: int
    last_webhook_received_at: Optional[datetime] = None
    last_error: Optional[str] = None
    is_healthy: bool
    seconds_behind: Optional[float] = None


class IndexerHealthListResponse(BaseModel):
    """Aggregated health status across all indexing sources.

    Attributes:
        sources: Per-source health information.
        overall_healthy: True if all sources are healthy.
    """

    sources: List[IndexerHealthResponse]
    overall_healthy: bool


class BackfillRequest(BaseModel):
    """Request body for triggering a historical event backfill.

    Attributes:
        start_slot: First Solana slot to index from.
        end_slot: Last Solana slot to index (inclusive).
        source: Provider to use for fetching historical data.
    """

    start_slot: int = Field(..., ge=0, description="First Solana slot to backfill from")
    end_slot: int = Field(..., ge=0, description="Last Solana slot to backfill (inclusive)")
    source: EventSource = Field(
        default=EventSource.HELIUS,
        description="Provider for fetching historical transactions",
    )

    @field_validator("end_slot")
    @classmethod
    def end_after_start(cls, value: int, info) -> int:
        """Validate that end_slot is greater than or equal to start_slot."""
        start = info.data.get("start_slot", 0)
        if value < start:
            raise ValueError("end_slot must be >= start_slot")
        return value


class BackfillResponse(BaseModel):
    """Response from a backfill operation.

    Attributes:
        status: Current status of the backfill (started, completed, failed).
        events_indexed: Number of events successfully indexed.
        start_slot: First slot that was processed.
        end_slot: Last slot that was processed.
        errors: List of error messages encountered during backfill.
    """

    status: str
    events_indexed: int
    start_slot: int
    end_slot: int
    errors: List[str] = Field(default_factory=list)
