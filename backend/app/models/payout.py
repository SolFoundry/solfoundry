"""Payout and Treasury Pydantic models."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PayoutStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"


class Payout(BaseModel):
    """Single payout record."""

    recipient: str
    amount: float
    bounty_id: str
    tx_hash: str
    timestamp: datetime
    status: PayoutStatus = PayoutStatus.pending
    metadata: dict = {}

    model_config = {"from_attributes": True}


class PayoutListItem(BaseModel):
    """Compact view for paginated list."""

    recipient: str
    amount: float
    bounty_id: str
    tx_hash: str
    timestamp: datetime
    status: PayoutStatus
    model_config = {"from_attributes": True}


class PayoutListResponse(BaseModel):
    """Paginated payout history."""

    items: list[PayoutListItem]
    total: int
    skip: int
    limit: int


class Treasury(BaseModel):
    """Treasury / financial overview."""

    total_paid: float = 0.0
    total_funded: float = 0.0
    token_supply: float = 0.0
    last_updated: datetime
