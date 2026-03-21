"""Escrow Pydantic v2 models for custodial $FNDRY staking.

PostgreSQL migration path (DDL)::

  CREATE TYPE escrow_state AS ENUM ('PENDING','FUNDED','ACTIVE','RELEASING','COMPLETED','REFUNDED');
  CREATE TABLE escrow_accounts (id UUID PRIMARY KEY, bounty_id VARCHAR(100) UNIQUE NOT NULL,
    creator_wallet VARCHAR(44), winner_wallet VARCHAR(44), amount FLOAT8 CHECK(amount>0),
    state escrow_state DEFAULT 'PENDING', fund_tx_hash VARCHAR(88), release_tx_hash VARCHAR(88),
    refund_tx_hash VARCHAR(88), created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, expires_at TIMESTAMPTZ);
  CREATE TABLE escrow_ledger (id UUID PRIMARY KEY, escrow_id UUID REFERENCES escrow_accounts(id),
    action VARCHAR(20), amount FLOAT8, tx_hash VARCHAR(88), wallet VARCHAR(44), created_at TIMESTAMPTZ);
"""
from __future__ import annotations
import re, uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator

_B58 = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
_TX = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,88}$")

VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    "PENDING": frozenset({"FUNDED","REFUNDED"}), "FUNDED": frozenset({"ACTIVE","REFUNDED"}),
    "ACTIVE": frozenset({"RELEASING","REFUNDED"}), "RELEASING": frozenset({"COMPLETED"}),
    "COMPLETED": frozenset(), "REFUNDED": frozenset(),
}

def _vw(v: Optional[str]) -> Optional[str]:
    """Validate optional Solana base-58 wallet."""
    if v is not None and not _B58.match(v): raise ValueError("Invalid Solana base-58 address")
    return v

def _vt(v: Optional[str]) -> Optional[str]:
    """Validate optional Solana tx signature."""
    if v is not None and not _TX.match(v): raise ValueError("Invalid Solana tx signature")
    return v

class EscrowState(str, Enum):
    """PENDING->FUNDED->ACTIVE->RELEASING->COMPLETED | REFUNDED."""
    PENDING="PENDING"; FUNDED="FUNDED"; ACTIVE="ACTIVE"
    RELEASING="RELEASING"; COMPLETED="COMPLETED"; REFUNDED="REFUNDED"

def _now(): return datetime.now(timezone.utc)
def _uid(): return str(uuid.uuid4())

class EscrowRecord(BaseModel):
    """Internal escrow account storage model."""
    model_config = {"from_attributes": True}
    id: str = Field(default_factory=_uid)
    bounty_id: str = Field(..., min_length=1, max_length=100)
    creator_wallet: str = Field(..., min_length=32, max_length=44)
    winner_wallet: Optional[str] = None
    amount: float = Field(..., gt=0)
    state: EscrowState = EscrowState.PENDING
    fund_tx_hash: Optional[str] = None
    release_tx_hash: Optional[str] = None
    refund_tx_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
    expires_at: Optional[datetime] = None
    _v1=field_validator("creator_wallet")(_vw); _v2=field_validator("winner_wallet")(_vw)
    _v3=field_validator("fund_tx_hash","release_tx_hash","refund_tx_hash")(_vt)

class LedgerEntry(BaseModel):
    """Ledger row for escrow financial event (ForeignKey -> escrow_accounts)."""
    model_config = {"from_attributes": True}
    id: str = Field(default_factory=_uid)
    escrow_id: str
    action: str = Field(..., pattern=r"^(deposit|release|refund)$")
    amount: float = Field(..., gt=0)
    tx_hash: Optional[str] = None
    wallet: str = Field(..., min_length=32, max_length=44)
    created_at: datetime = Field(default_factory=_now)
    _v1=field_validator("wallet")(_vw); _v2=field_validator("tx_hash")(_vt)

class EscrowCreateRequest(BaseModel):
    """POST /escrow/fund body."""
    bounty_id: str = Field(..., min_length=1, max_length=100)
    creator_wallet: str = Field(..., min_length=32, max_length=44)
    amount: float = Field(..., gt=0)
    tx_hash: Optional[str] = None
    expires_at: Optional[datetime] = None
    _v1=field_validator("creator_wallet")(_vw); _v2=field_validator("tx_hash")(_vt)

class EscrowReleaseRequest(BaseModel):
    """POST /escrow/release body."""
    bounty_id: str = Field(..., min_length=1, max_length=100)
    winner_wallet: str = Field(..., min_length=32, max_length=44)
    tx_hash: Optional[str] = None
    _v1=field_validator("winner_wallet")(_vw); _v2=field_validator("tx_hash")(_vt)

class EscrowRefundRequest(BaseModel):
    """POST /escrow/refund body."""
    bounty_id: str = Field(..., min_length=1, max_length=100)
    tx_hash: Optional[str] = None
    _v1=field_validator("tx_hash")(_vt)

class EscrowResponse(BaseModel):
    """Public escrow API response with ledger history."""
    id: str; bounty_id: str; creator_wallet: str; winner_wallet: Optional[str]=None
    amount: float; state: EscrowState
    fund_tx_hash: Optional[str]=None; release_tx_hash: Optional[str]=None; refund_tx_hash: Optional[str]=None
    created_at: datetime; updated_at: datetime; expires_at: Optional[datetime]=None
    ledger: list[LedgerEntry] = Field(default_factory=list)

class EscrowListResponse(BaseModel):
    """Paginated escrow list."""
    items: list[EscrowResponse]; total: int; skip: int; limit: int
