"""Pydantic v2 models for $FNDRY custodial escrow.

PostgreSQL migration: CREATE TABLE escrow_ledger (id UUID PRIMARY KEY,
bounty_id VARCHAR(100) UNIQUE, creator_wallet VARCHAR(44), amount NUMERIC,
state VARCHAR(20), fund_tx_hash VARCHAR(88), release_tx_hash VARCHAR(88),
winner_wallet VARCHAR(44), created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ);
"""
from __future__ import annotations
import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator

SOLANA_BASE58_PATTERN = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
SOLANA_TX_PATTERN = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,88}$")


class EscrowState(str, Enum):
    """PENDING -> FUNDED -> ACTIVE -> RELEASING -> COMPLETED | REFUNDED."""
    PENDING = "pending"
    FUNDED = "funded"
    ACTIVE = "active"
    RELEASING = "releasing"
    COMPLETED = "completed"
    REFUNDED = "refunded"


VALID_TRANSITIONS: dict[EscrowState, list[EscrowState]] = {
    EscrowState.PENDING: [EscrowState.FUNDED, EscrowState.REFUNDED],
    EscrowState.FUNDED: [EscrowState.ACTIVE, EscrowState.REFUNDED],
    EscrowState.ACTIVE: [EscrowState.RELEASING, EscrowState.REFUNDED],
    EscrowState.RELEASING: [EscrowState.COMPLETED, EscrowState.REFUNDED],
    EscrowState.COMPLETED: [],
    EscrowState.REFUNDED: [],
}

# Admin user IDs for maintenance endpoints. frozenset for immutability.
ADMIN_USER_IDS: frozenset[str] = frozenset()


class EscrowNotFoundError(Exception):
    """Raised when no escrow exists for the given bounty or ID."""


class EscrowConflictError(Exception):
    """Raised on duplicate fund/release tx_hash or duplicate active escrow."""


class EscrowStateError(Exception):
    """Raised when a requested state transition is invalid."""


def _validate_base58_address(v, n):
    """Validate Solana base-58 address."""
    if v is not None and not SOLANA_BASE58_PATTERN.match(v):
        raise ValueError(f"{n} must be a valid Solana base-58 address")
    return v


def _validate_tx_signature(v, n):
    """Validate Solana tx signature."""
    if v is not None and not SOLANA_TX_PATTERN.match(v):
        raise ValueError(f"{n} must be a valid Solana transaction signature")
    return v


class EscrowRecord(BaseModel):
    """Internal escrow storage model."""
    model_config = {"from_attributes": True}
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str = Field(..., min_length=1, max_length=100)
    creator_wallet: str = Field(..., min_length=32, max_length=44)
    amount: float = Field(..., gt=0)
    state: EscrowState = EscrowState.PENDING
    fund_tx_hash: Optional[str] = None
    release_tx_hash: Optional[str] = None
    winner_wallet: Optional[str] = None
    solscan_fund_url: Optional[str] = None
    solscan_release_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    _val_cw = field_validator("creator_wallet")(classmethod(lambda cls, v: _validate_base58_address(v, "creator_wallet")))
    _val_ww = field_validator("winner_wallet")(classmethod(lambda cls, v: _validate_base58_address(v, "winner_wallet")))
    _val_ft = field_validator("fund_tx_hash")(classmethod(lambda cls, v: _validate_tx_signature(v, "fund_tx_hash")))
    _val_rt = field_validator("release_tx_hash")(classmethod(lambda cls, v: _validate_tx_signature(v, "release_tx_hash")))


class EscrowFundRequest(BaseModel):
    """Request body for funding an escrow."""
    bounty_id: str = Field(..., min_length=1, max_length=100)
    creator_wallet: str = Field(..., min_length=32, max_length=44)
    amount: float = Field(..., gt=0, le=100_000_000)
    tx_hash: str = Field(..., min_length=64, max_length=88)
    expires_at: Optional[datetime] = None
    _val_w = field_validator("creator_wallet")(classmethod(lambda cls, v: _validate_base58_address(v, "creator_wallet")))
    _val_t = field_validator("tx_hash")(classmethod(lambda cls, v: _validate_tx_signature(v, "tx_hash")))


class EscrowReleaseRequest(BaseModel):
    """Request for releasing escrow to winner."""
    winner_wallet: str = Field(..., min_length=32, max_length=44)
    _val = field_validator("winner_wallet")(classmethod(lambda cls, v: _validate_base58_address(v, "winner_wallet")))


class EscrowResponse(BaseModel):
    """Public escrow API response."""
    model_config = {"from_attributes": True}
    id: str
    bounty_id: str
    creator_wallet: str
    amount: float
    state: EscrowState
    fund_tx_hash: Optional[str] = None
    release_tx_hash: Optional[str] = None
    winner_wallet: Optional[str] = None
    solscan_fund_url: Optional[str] = None
    solscan_release_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime] = None


class EscrowListResponse(BaseModel):
    """Paginated escrow list."""
    items: list[EscrowResponse]
    total: int
    skip: int
    limit: int


class EscrowLedgerEntry(BaseModel):
    """Audit log entry for escrow state changes."""
    model_config = {"from_attributes": True}
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    escrow_id: str
    action: str = Field(..., pattern=r"^(fund|release|refund|expire|state_change)$")
    from_state: EscrowState
    to_state: EscrowState
    tx_hash: Optional[str] = None
    amount: Optional[float] = None
    details: Optional[str] = Field(default=None, max_length=500)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    _val_tx = field_validator("tx_hash")(classmethod(lambda cls, v: _validate_tx_signature(v, "tx_hash")))
