"""In-memory payout service for MVP."""

from __future__ import annotations

import threading
from typing import Optional

from app.models.payout import (
    BuybackCreate, BuybackRecord, BuybackResponse, BuybackListResponse,
    PayoutCreate, PayoutRecord, PayoutResponse, PayoutListResponse, PayoutStatus,
)

_lock = threading.Lock()
_payout_store: dict[str, PayoutRecord] = {}
_buyback_store: dict[str, BuybackRecord] = {}

SOLSCAN_TX_BASE = "https://solscan.io/tx"


def _solscan_url(tx_hash: Optional[str]) -> Optional[str]:
    if not tx_hash:
        return None
    return f"{SOLSCAN_TX_BASE}/{tx_hash}"


def _payout_to_response(p: PayoutRecord) -> PayoutResponse:
    return PayoutResponse(
        id=p.id, recipient=p.recipient, recipient_wallet=p.recipient_wallet,
        amount=p.amount, token=p.token, bounty_id=p.bounty_id,
        bounty_title=p.bounty_title, tx_hash=p.tx_hash, status=p.status,
        solscan_url=p.solscan_url, created_at=p.created_at,
    )


def _buyback_to_response(b: BuybackRecord) -> BuybackResponse:
    return BuybackResponse(
        id=b.id, amount_sol=b.amount_sol, amount_fndry=b.amount_fndry,
        price_per_fndry=b.price_per_fndry, tx_hash=b.tx_hash,
        solscan_url=b.solscan_url, created_at=b.created_at,
    )


def create_payout(data: PayoutCreate) -> PayoutResponse:
    solscan = _solscan_url(data.tx_hash)
    status = PayoutStatus.CONFIRMED if data.tx_hash else PayoutStatus.PENDING
    record = PayoutRecord(
        recipient=data.recipient, recipient_wallet=data.recipient_wallet,
        amount=data.amount, token=data.token, bounty_id=data.bounty_id,
        bounty_title=data.bounty_title, tx_hash=data.tx_hash,
        status=status, solscan_url=solscan,
    )
    with _lock:
        if data.tx_hash:
            for existing in _payout_store.values():
                if existing.tx_hash == data.tx_hash:
                    raise ValueError(f"Payout with tx_hash already exists")
        _payout_store[record.id] = record
    return _payout_to_response(record)


def get_payout_by_id(payout_id: str) -> Optional[PayoutResponse]:
    with _lock:
        record = _payout_store.get(payout_id)
    return _payout_to_response(record) if record else None


def get_payout_by_tx_hash(tx_hash: str) -> Optional[PayoutResponse]:
    with _lock:
        for record in _payout_store.values():
            if record.tx_hash == tx_hash:
                return _payout_to_response(record)
    return None


def list_payouts(
    recipient: Optional[str] = None,
    status: Optional[PayoutStatus] = None,
    skip: int = 0,
    limit: int = 20,
) -> PayoutListResponse:
    with _lock:
        results = sorted(_payout_store.values(), key=lambda p: p.created_at, reverse=True)
    if recipient:
        results = [p for p in results if p.recipient == recipient]
    if status:
        results = [p for p in results if p.status == status]
    total = len(results)
    page = results[skip : skip + limit]
    return PayoutListResponse(
        items=[_payout_to_response(p) for p in page], total=total, skip=skip, limit=limit,
    )


def get_total_paid_out() -> tuple[float, float]:
    total_fndry = 0.0
    total_sol = 0.0
    with _lock:
      for p in _payout_store.values():
        if p.status == PayoutStatus.CONFIRMED:
            if p.token == "FNDRY":
                total_fndry += p.amount
            elif p.token == "SOL":
                total_sol += p.amount
    return total_fndry, total_sol


def create_buyback(data: BuybackCreate) -> BuybackResponse:
    solscan = _solscan_url(data.tx_hash)
    record = BuybackRecord(
        amount_sol=data.amount_sol, amount_fndry=data.amount_fndry,
        price_per_fndry=data.price_per_fndry, tx_hash=data.tx_hash, solscan_url=solscan,
    )
    with _lock:
        if data.tx_hash:
            for existing in _buyback_store.values():
                if existing.tx_hash == data.tx_hash:
                    raise ValueError(f"Buyback with tx_hash already exists")
        _buyback_store[record.id] = record
    return _buyback_to_response(record)


def list_buybacks(skip: int = 0, limit: int = 20) -> BuybackListResponse:
    with _lock:
        results = sorted(_buyback_store.values(), key=lambda b: b.created_at, reverse=True)
    total = len(results)
    page = results[skip : skip + limit]
    return BuybackListResponse(
        items=[_buyback_to_response(b) for b in page], total=total, skip=skip, limit=limit,
    )


def get_total_buybacks() -> tuple[float, float]:
    total_sol = 0.0
    total_fndry = 0.0
    with _lock:
      for b in _buyback_store.values():
        total_sol += b.amount_sol
        total_fndry += b.amount_fndry
    return total_sol, total_fndry


def reset_stores() -> None:
    with _lock:
        _payout_store.clear()
        _buyback_store.clear()
