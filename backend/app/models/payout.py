"""Payout, treasury, and tokenomics Pydantic v2 models.

Defines strict domain types for the bounty payout system including
wallet-address and transaction-hash validation.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# Solana base-58 address: 32-44 chars of [1-9A-HJ-NP-Za-km-z]
_BASE58_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
# Solana tx signature: 64-88 base-58 chars
_TX_HASH_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,88}$")


class PayoutStatus(str, Enum):
    """Lifecycle states for a payout."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"


class PayoutRecord(BaseModel):
    """Internal storage model for a single payout."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipient: str = Field(..., min_length=1, max_length=100)
    recipient_wallet: Optional[str] = None
    amount: float = Field(..., gt=0, description="Payout amount (must be positive)")
    token: str = Field(default="FNDRY", pattern=r"^(FNDRY|SOL)$")
    bounty_id: Optional[str] = None
    bounty_title: Optional[str] = Field(default=None, max_length=200)
    tx_hash: Optional[str] = None
    status: PayoutStatus = PayoutStatus.PENDING
    solscan_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("recipient_wallet")
    @classmethod
    def validate_wallet(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *recipient_wallet* is a valid Solana base-58 address."""
        if v is not None and not _BASE58_RE.match(v):
            raise ValueError("recipient_wallet must be a valid Solana base-58 address")
        return v

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_hash(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *tx_hash* is a valid Solana transaction signature."""
        if v is not None and not _TX_HASH_RE.match(v):
            raise ValueError("tx_hash must be a valid Solana transaction signature")
        return v


class PayoutCreate(BaseModel):
    """Request body for recording a new payout."""

    recipient: str = Field(..., min_length=1, max_length=100, description="Recipient username or ID", examples=["cryptodev"])
    recipient_wallet: Optional[str] = Field(None, description="Solana wallet address for the payout", examples=["7Pq6..."])
    amount: float = Field(..., gt=0, description="Payout amount (must be positive)", examples=[100.0])
    token: str = Field(default="FNDRY", pattern=r"^(FNDRY|SOL)$", description="Token to use for payout", examples=["FNDRY"])
    bounty_id: Optional[str] = Field(None, description="Associated bounty UUID", examples=["550e8400-e29b-41d4-a716-446655440000"])
    bounty_title: Optional[str] = Field(default=None, max_length=200, description="Title of the bounty for reference")
    tx_hash: Optional[str] = Field(None, description="Solana transaction signature", examples=["5fX..."])

    @field_validator("recipient_wallet")
    @classmethod
    def validate_wallet(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *recipient_wallet* is a valid Solana base-58 address."""
        if v is not None and not _BASE58_RE.match(v):
            raise ValueError("recipient_wallet must be a valid Solana base-58 address")
        return v

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_hash(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *tx_hash* is a valid Solana transaction signature."""
        if v is not None and not _TX_HASH_RE.match(v):
            raise ValueError("tx_hash must be a valid Solana transaction signature")
        return v


class PayoutResponse(BaseModel):
    """Single payout API response."""

    id: str
    recipient: str
    recipient_wallet: Optional[str] = None
    amount: float
    token: str
    bounty_id: Optional[str] = None
    bounty_title: Optional[str] = None
    tx_hash: Optional[str] = None
    status: PayoutStatus
    solscan_url: Optional[str] = None
    created_at: datetime


class PayoutListResponse(BaseModel):
    """Paginated list of payouts."""

    items: list[PayoutResponse]
    total: int
    skip: int
    limit: int


class TreasuryStats(BaseModel):
    """Live treasury balance and aggregate statistics."""

    sol_balance: float = Field(0.0, description="Total SOL held in treasury", examples=[1250.5])
    fndry_balance: float = Field(0.0, description="Total FNDRY tokens held in treasury", examples=[500000.0])
    treasury_wallet: str = Field(..., description="Public address of the treasury wallet", examples=["Treasury..."])
    total_paid_out_fndry: float = Field(0.0, description="Cumulative FNDRY paid to contributors")
    total_paid_out_sol: float = Field(0.0, description="Cumulative SOL paid to contributors")
    total_payouts: int = Field(0, description="Total number of payout events")
    total_buyback_amount: float = Field(0.0, description="Total SOL spent on FNDRY buybacks")
    total_buybacks: int = Field(0, description="Total number of buyback events")
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class BuybackRecord(BaseModel):
    """Internal storage model for a buyback event."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    amount_sol: float = Field(..., gt=0)
    amount_fndry: float = Field(..., gt=0)
    price_per_fndry: float = Field(..., gt=0)
    tx_hash: Optional[str] = None
    solscan_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_hash(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *tx_hash* is a valid Solana transaction signature."""
        if v is not None and not _TX_HASH_RE.match(v):
            raise ValueError("tx_hash must be a valid Solana transaction signature")
        return v


class BuybackCreate(BaseModel):
    """Request body for recording a buyback."""

    amount_sol: float = Field(..., gt=0, description="SOL spent on buyback")
    amount_fndry: float = Field(..., gt=0, description="FNDRY tokens acquired")
    price_per_fndry: float = Field(..., gt=0, description="Price per FNDRY in SOL")
    tx_hash: Optional[str] = None

    @field_validator("tx_hash")
    @classmethod
    def validate_tx_hash(cls, v: Optional[str]) -> Optional[str]:
        """Ensure *tx_hash* is a valid Solana transaction signature."""
        if v is not None and not _TX_HASH_RE.match(v):
            raise ValueError("tx_hash must be a valid Solana transaction signature")
        return v


class BuybackResponse(BaseModel):
    """Single buyback API response."""

    id: str
    amount_sol: float
    amount_fndry: float
    price_per_fndry: float
    tx_hash: Optional[str] = None
    solscan_url: Optional[str] = None
    created_at: datetime


class BuybackListResponse(BaseModel):
    """Paginated list of buybacks."""

    items: list[BuybackResponse]
    total: int
    skip: int
    limit: int


class TokenomicsResponse(BaseModel):
    """$FNDRY tokenomics: circulating = total_supply - treasury_holdings."""

    token_name: str = "FNDRY"
    token_ca: str = "C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS"
    total_supply: float = 1_000_000_000.0
    circulating_supply: float = 0.0
    treasury_holdings: float = 0.0
    total_distributed: float = 0.0
    total_buybacks: float = 0.0
    total_burned: float = 0.0
    fee_revenue_sol: float = 0.0
    distribution_breakdown: dict[str, float] = Field(
        default_factory=lambda: {
            "contributor_rewards": 0.0,
            "treasury_reserve": 0.0,
            "buybacks": 0.0,
            "burned": 0.0,
        }
    )
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
