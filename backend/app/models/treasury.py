"""Payout, treasury, tokenomics, and buyback API models."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DataSourceStatus(str, Enum):
    """Indicates how complete or live the response data is."""

    live = "live"
    configured = "configured"
    unavailable = "unavailable"


class TreasuryDataSource(BaseModel):
    """Metadata about how treasury data was produced."""

    status: DataSourceStatus
    adapter: str
    detail: Optional[str] = None
    last_success_at: Optional[datetime] = None


class PayoutRecord(BaseModel):
    """A contributor payout event."""

    signature: str
    recipient_wallet: str
    gross_amount: float = Field(ge=0)
    fee_amount: float = Field(0.0, ge=0)
    net_amount: float = Field(ge=0)
    token_mint: str
    bounty_id: Optional[str] = None
    github_issue_number: Optional[int] = None
    github_pr_url: Optional[str] = None
    slot: Optional[int] = None
    block_time: Optional[datetime] = None
    status: str = "confirmed"
    source: str = "configured"
    notes: Optional[str] = None


class PayoutHistoryQuery(BaseModel):
    """Query params for payout history reads."""

    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)
    recipient_wallet: Optional[str] = None
    status: Optional[str] = None


class PayoutHistoryResponse(BaseModel):
    """Paginated payout history response."""

    items: list[PayoutRecord]
    total: int
    limit: int
    offset: int
    has_more: bool
    as_of: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: TreasuryDataSource


class BuybackRecord(BaseModel):
    """A treasury buyback event."""

    signature: str
    amount_spent: float = Field(ge=0)
    token_amount_acquired: Optional[float] = Field(None, ge=0)
    token_mint: str
    quote_symbol: str = "SOL"
    slot: Optional[int] = None
    block_time: Optional[datetime] = None
    source: str = "configured"
    notes: Optional[str] = None


class BuybackHistoryQuery(BaseModel):
    """Query params for buyback history reads."""

    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)


class BuybackHistoryResponse(BaseModel):
    """Paginated buyback history response."""

    items: list[BuybackRecord]
    total: int
    limit: int
    offset: int
    has_more: bool
    as_of: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: TreasuryDataSource


class TreasuryStatsResponse(BaseModel):
    """High-level treasury metrics."""

    treasury_wallet: str
    token_mint: str
    current_balance: Optional[float] = Field(None, ge=0)
    payout_count: int = Field(0, ge=0)
    buyback_count: int = Field(0, ge=0)
    total_distributed: float = Field(0.0, ge=0)
    total_fees_collected: float = Field(0.0, ge=0)
    total_buybacks: float = Field(0.0, ge=0)
    most_recent_payout_at: Optional[datetime] = None
    most_recent_buyback_at: Optional[datetime] = None
    as_of: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source: TreasuryDataSource


class TokenMetadata(BaseModel):
    """Core token metadata."""

    symbol: str
    chain: str
    mint: str
    treasury_wallet: str


class TokenomicsAllocation(BaseModel):
    """High-level token allocation bucket."""

    name: str
    description: str
    percentage: Optional[float] = Field(None, ge=0, le=100)


class TokenomicsSummaryResponse(BaseModel):
    """Tokenomics summary with dynamic treasury stats."""

    token: TokenMetadata
    payout_token: str
    buyback_rate: float = Field(ge=0, le=1)
    allocations: list[TokenomicsAllocation]
    utility: list[str]
    treasury: TreasuryStatsResponse
    source: TreasuryDataSource
