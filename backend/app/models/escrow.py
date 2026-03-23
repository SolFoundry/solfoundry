"""Escrow ORM model and Pydantic schemas for custodial $FNDRY escrow.

Escrow lifecycle::

    PENDING → FUNDED → ACTIVE → RELEASING → COMPLETED
                 |                              |
                 +→ REFUNDED  (timeout/cancel)  +→ (terminal)

The ``escrows`` table holds one row per bounty escrow. The
``escrow_ledger`` table logs every deposit, release, and refund
with its on-chain transaction hash for full auditability.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, Index, String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from pydantic import BaseModel, Field, field_validator

from app.database import Base

_BASE58_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
_TX_HASH_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,88}$")


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Escrow states
# ---------------------------------------------------------------------------


class EscrowState(str, Enum):
    """Lifecycle states for a custodial escrow."""

    PENDING = "pending"
    FUNDED = "funded"
    ACTIVE = "active"
    RELEASING = "releasing"
    COMPLETED = "completed"
    REFUNDED = "refunded"


ALLOWED_ESCROW_TRANSITIONS: dict[EscrowState, frozenset[EscrowState]] = {
    EscrowState.PENDING: frozenset({EscrowState.FUNDED, EscrowState.REFUNDED}),
    EscrowState.FUNDED: frozenset({EscrowState.ACTIVE, EscrowState.REFUNDED}),
    EscrowState.ACTIVE: frozenset({EscrowState.RELEASING, EscrowState.REFUNDED}),
    EscrowState.RELEASING: frozenset({EscrowState.COMPLETED, EscrowState.ACTIVE}),
    EscrowState.COMPLETED: frozenset(),
    EscrowState.REFUNDED: frozenset(),
}


class LedgerAction(str, Enum):
    """Types of escrow ledger entries."""

    DEPOSIT = "deposit"
    RELEASE = "release"
    REFUND = "refund"
    STATE_CHANGE = "state_change"


# ---------------------------------------------------------------------------
# SQLAlchemy ORM models
# ---------------------------------------------------------------------------


class EscrowTable(Base):
    """Persistent escrow record for a bounty's staked $FNDRY.

    One escrow per bounty. Tracks the full lifecycle from creation
    through funding, activation, release/refund, and completion.
    """

    __tablename__ = "escrows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bounty_id = Column(
        UUID(as_uuid=True),
        sa.ForeignKey("bounties.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    creator_wallet = Column(String(64), nullable=False)
    winner_wallet = Column(String(64), nullable=True)
    amount = Column(sa.Numeric(precision=20, scale=6), nullable=False)
    state = Column(String(20), nullable=False, server_default="pending")
    fund_tx_hash = Column(String(128), unique=True, nullable=True, index=True)
    release_tx_hash = Column(String(128), unique=True, nullable=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    __table_args__ = (
        Index("ix_escrows_state", state),
        Index("ix_escrows_expires", expires_at, state),
    )


class EscrowLedgerTable(Base):
    """Immutable audit log for every escrow financial event.

    Each row records a deposit, release, or refund along with the
    on-chain transaction hash and wallet addresses involved.
    """

    __tablename__ = "escrow_ledger"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    escrow_id = Column(
        UUID(as_uuid=True),
        sa.ForeignKey("escrows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action = Column(String(20), nullable=False)
    from_state = Column(String(20), nullable=False)
    to_state = Column(String(20), nullable=False)
    amount = Column(sa.Numeric(precision=20, scale=6), nullable=False)
    wallet = Column(String(64), nullable=False)
    tx_hash = Column(String(128), nullable=True, index=True)
    note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )


# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------


class EscrowFundRequest(BaseModel):
    """Request body for POST /escrow/fund."""

    bounty_id: str = Field(..., description="UUID of the bounty to escrow funds for")
    creator_wallet: str = Field(
        ..., min_length=32, max_length=44, description="Creator's Solana wallet address"
    )
    amount: float = Field(..., gt=0, description="Amount of $FNDRY to lock in escrow")
    expires_at: Optional[datetime] = Field(
        None, description="ISO 8601 expiry for auto-refund (optional)"
    )

    @field_validator("creator_wallet")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        if not _BASE58_RE.match(v):
            raise ValueError("creator_wallet must be a valid Solana base-58 address")
        return v


class EscrowReleaseRequest(BaseModel):
    """Request body for POST /escrow/release."""

    bounty_id: str = Field(
        ..., description="UUID of the bounty whose escrow to release"
    )
    winner_wallet: str = Field(
        ..., min_length=32, max_length=44, description="Winner's Solana wallet address"
    )

    @field_validator("winner_wallet")
    @classmethod
    def validate_wallet(cls, v: str) -> str:
        if not _BASE58_RE.match(v):
            raise ValueError("winner_wallet must be a valid Solana base-58 address")
        return v


class EscrowRefundRequest(BaseModel):
    """Request body for POST /escrow/refund."""

    bounty_id: str = Field(..., description="UUID of the bounty whose escrow to refund")


class EscrowResponse(BaseModel):
    """Public escrow response with full lifecycle metadata."""

    id: str = Field(..., description="Escrow UUID")
    bounty_id: str = Field(..., description="Associated bounty UUID")
    creator_wallet: str = Field(..., description="Creator's Solana wallet")
    winner_wallet: Optional[str] = Field(
        None, description="Winner's Solana wallet (set on release)"
    )
    amount: float = Field(..., description="Escrowed $FNDRY amount")
    state: EscrowState = Field(..., description="Current escrow lifecycle state")
    fund_tx_hash: Optional[str] = Field(
        None, description="Funding transaction signature"
    )
    release_tx_hash: Optional[str] = Field(
        None, description="Release/refund transaction signature"
    )
    expires_at: Optional[datetime] = Field(None, description="Auto-refund deadline")
    created_at: datetime = Field(..., description="Creation timestamp (UTC)")
    updated_at: datetime = Field(..., description="Last state-change timestamp (UTC)")


class EscrowLedgerEntry(BaseModel):
    """Single entry in the escrow audit ledger."""

    id: str
    escrow_id: str
    action: LedgerAction
    from_state: str
    to_state: str
    amount: float
    wallet: str
    tx_hash: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime


class EscrowStatusResponse(BaseModel):
    """GET /escrow/{bounty_id} response with state + balance + ledger."""

    escrow: EscrowResponse
    ledger: list[EscrowLedgerEntry] = Field(
        default_factory=list, description="Full audit trail"
    )
