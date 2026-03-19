"""Payout service — in-memory store for payout history and treasury stats."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.models.payout import (
    Payout,
    PayoutListItem,
    PayoutListResponse,
    PayoutStatus,
    Treasury,
)

# ---------------------------------------------------------------------------
# In-memory stores (MVP — replace with DB later)
# ---------------------------------------------------------------------------

_payouts: dict[str, Payout] = {}  # keyed by tx_hash

_treasury = Treasury(
    total_paid=0.0,
    total_funded=0.0,
    token_supply=1_000_000.0,
    last_updated=datetime.now(timezone.utc),
)


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def add_payout(payout: Payout) -> Payout:
    """Insert a payout and update treasury stats."""
    _payouts[payout.tx_hash] = payout
    if payout.status == PayoutStatus.completed:
        _treasury.total_paid += payout.amount
    _treasury.last_updated = datetime.now(timezone.utc)
    return payout


def get_payout(tx_hash: str) -> Optional[Payout]:
    return _payouts.get(tx_hash)


def list_payouts(skip: int = 0, limit: int = 20) -> PayoutListResponse:
    items = sorted(_payouts.values(), key=lambda p: p.timestamp, reverse=True)
    total = len(items)
    page = items[skip : skip + limit]
    return PayoutListResponse(
        items=[PayoutListItem.model_validate(p) for p in page],
        total=total,
        skip=skip,
        limit=limit,
    )


def get_treasury() -> Treasury:
    return _treasury


def reset_stores() -> None:
    """Clear all data (used in tests)."""
    _payouts.clear()
    global _treasury
    _treasury = Treasury(
        total_paid=0.0,
        total_funded=0.0,
        token_supply=1_000_000.0,
        last_updated=datetime.now(timezone.utc),
    )
