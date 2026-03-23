"""Treasury health aggregation for the admin dashboard (read-only)."""

from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from app.models.bounty import BountyStatus
from app.models.payout import PayoutStatus
from app.services.bounty_service import _bounty_store
from app.services.payout_service import (
    _buyback_store,
    _load_buybacks_from_db,
    _load_payouts_from_db,
    _lock as _payout_lock,
    _payout_store,
    SOLSCAN_TX_BASE,
)
from app.services.solana_client import TREASURY_WALLET, get_token_balance

RUNWAY_WINDOW_DAYS = 30


def treasury_pda_wallet() -> str:
    """On-chain address whose $FNDRY balance is shown (treasury / PDA)."""
    addr = os.getenv("TREASURY_PDA_WALLET", "").strip()
    return addr or TREASURY_WALLET


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _bucket_key(dt: datetime, granularity: str) -> str:
    d = _utc(dt).date()
    if granularity == "daily":
        return d.isoformat()
    if granularity == "weekly":
        monday = d - timedelta(days=d.weekday())
        return monday.isoformat()
    if granularity == "monthly":
        return f"{d.year:04d}-{d.month:02d}"
    raise ValueError(f"Unknown granularity: {granularity}")


def _series_for(
    payouts: list[Any],
    buybacks: list[Any],
    granularity: str,
) -> list[dict[str, Any]]:
    infl: dict[str, float] = defaultdict(float)
    outf: dict[str, float] = defaultdict(float)
    for bb in buybacks:
        k = _bucket_key(bb.created_at, granularity)
        infl[k] += float(bb.amount_fndry)
    for p in payouts:
        if p.status != PayoutStatus.CONFIRMED or p.token != "FNDRY":
            continue
        k = _bucket_key(p.created_at, granularity)
        outf[k] += float(p.amount)
    keys = sorted(set(infl) | set(outf))
    return [
        {
            "period": k,
            "inflow_fndry": round(infl[k], 6),
            "outflow_fndry": round(outf[k], 6),
        }
        for k in keys
    ]


async def _payouts_snapshot() -> list[Any]:
    db = await _load_payouts_from_db()
    with _payout_lock:
        src = db if db is not None else _payout_store
        return list(src.values())


async def _buybacks_snapshot() -> list[Any]:
    db = await _load_buybacks_from_db()
    with _payout_lock:
        src = db if db is not None else _buyback_store
        return list(src.values())


async def build_treasury_dashboard() -> dict[str, Any]:
    """Assemble treasury balance, flows, runway, tier spend, and recent activity."""
    wallet = treasury_pda_wallet()
    try:
        fndry_balance = await get_token_balance(wallet)
    except Exception:
        fndry_balance = 0.0

    payouts = await _payouts_snapshot()
    buybacks = await _buybacks_snapshot()

    daily = _series_for(payouts, buybacks, "daily")
    weekly = _series_for(payouts, buybacks, "weekly")
    monthly = _series_for(payouts, buybacks, "monthly")

    tx_rows: list[dict[str, Any]] = []
    for p in payouts:
        if p.status != PayoutStatus.CONFIRMED or p.token != "FNDRY":
            continue
        url = p.solscan_url or (
            f"{SOLSCAN_TX_BASE}/{p.tx_hash}" if p.tx_hash else None
        )
        tx_rows.append(
            {
                "id": p.id,
                "kind": "payout",
                "label": (p.bounty_title or p.recipient or "Payout")[:200],
                "amount_fndry": float(p.amount),
                "amount_sol": None,
                "occurred_at": _utc(p.created_at).isoformat(),
                "explorer_url": url,
                "tx_hash": p.tx_hash,
            }
        )
    for bb in buybacks:
        url = bb.solscan_url or (
            f"{SOLSCAN_TX_BASE}/{bb.tx_hash}" if bb.tx_hash else None
        )
        tx_rows.append(
            {
                "id": bb.id,
                "kind": "buyback",
                "label": "Buyback",
                "amount_fndry": float(bb.amount_fndry),
                "amount_sol": float(bb.amount_sol),
                "occurred_at": _utc(bb.created_at).isoformat(),
                "explorer_url": url,
                "tx_hash": bb.tx_hash,
            }
        )
    tx_rows.sort(key=lambda r: r["occurred_at"], reverse=True)
    recent = tx_rows[:100]

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=RUNWAY_WINDOW_DAYS)
    window_out = 0.0
    for p in payouts:
        if p.status != PayoutStatus.CONFIRMED or p.token != "FNDRY":
            continue
        if _utc(p.created_at) < cutoff:
            continue
        window_out += float(p.amount)
    avg_daily = window_out / float(RUNWAY_WINDOW_DAYS)
    runway_days: float | None = None
    if avg_daily > 0:
        runway_days = fndry_balance / avg_daily

    tier_totals: dict[int, float] = defaultdict(float)
    for b in _bounty_store.values():
        if b.status != BountyStatus.PAID:
            continue
        tid = int(b.tier)
        tier_totals[tid] += float(b.reward_amount)
    tier_spending = {str(k): round(v, 6) for k, v in sorted(tier_totals.items())}

    return {
        "treasury_wallet": wallet,
        "fndry_balance": round(float(fndry_balance), 6),
        "series": {"daily": daily, "weekly": weekly, "monthly": monthly},
        "recent_transactions": recent,
        "runway": {
            "avg_daily_outflow_fndry": round(avg_daily, 6),
            "estimated_runway_days": round(runway_days, 2)
            if runway_days is not None
            else None,
            "window_days": RUNWAY_WINDOW_DAYS,
            "total_outflow_window_fndry": round(window_out, 6),
        },
        "tier_spending_fndry": tier_spending,
        "generated_at": now.isoformat(),
    }
