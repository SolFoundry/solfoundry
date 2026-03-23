"""Aggregate treasury health metrics for the admin treasury dashboard (read-only)."""

from __future__ import annotations

import os
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal

from app.models.bounty import BountyStatus
from app.models.payout import PayoutStatus
from app.services.bounty_service import _bounty_store
from app.services.payout_service import fetch_all_buyback_records, fetch_all_payout_records
from app.services.solana_client import TREASURY_WALLET, get_token_balance


def _treasury_pda_address() -> str:
    return os.getenv("TREASURY_PDA_WALLET", TREASURY_WALLET).strip() or TREASURY_WALLET


def _utc_date(dt: datetime) -> date:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).date()


def _week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _month_start(d: date) -> date:
    return date(d.year, d.month, 1)


def _bucket_key(period: str, d: date) -> tuple[str, date]:
    if period == "daily":
        return ("daily", d)
    if period == "weekly":
        return ("weekly", _week_start(d))
    return ("monthly", _month_start(d))


def _build_series(
    payouts_fndry: list[tuple[date, float]],
    buybacks_fndry: list[tuple[date, float]],
    period: Literal["daily", "weekly", "monthly"],
    num_buckets: int,
    end: date,
) -> list[dict[str, Any]]:
    out: dict[date, dict[str, float]] = defaultdict(lambda: {"inflow": 0.0, "outflow": 0.0})

    for d, amt in buybacks_fndry:
        _, bstart = _bucket_key(period, d)
        out[bstart]["inflow"] += amt

    for d, amt in payouts_fndry:
        _, bstart = _bucket_key(period, d)
        out[bstart]["outflow"] += amt

    if period == "daily":
        starts = [end - timedelta(days=i) for i in range(num_buckets - 1, -1, -1)]
    elif period == "weekly":
        w0 = _week_start(end)
        starts = [w0 - timedelta(weeks=i) for i in range(num_buckets - 1, -1, -1)]
    else:
        starts = []
        y, m = end.year, end.month
        for _ in range(num_buckets):
            starts.append(date(y, m, 1))
            if m == 1:
                y -= 1
                m = 12
            else:
                m -= 1
        starts.reverse()

    rows: list[dict[str, Any]] = []
    for bstart in starts:
        cell = out.get(bstart, {"inflow": 0.0, "outflow": 0.0})
        rows.append(
            {
                "period_start": bstart.isoformat(),
                "inflow": round(cell["inflow"], 6),
                "outflow": round(cell["outflow"], 6),
            }
        )
    return rows


async def fetch_treasury_pda_fndry_balance() -> float:
    """Current $FNDRY balance held by the configured treasury PDA (or treasury wallet)."""
    addr = _treasury_pda_address()
    return await get_token_balance(wallet=addr)


async def build_treasury_dashboard_payload() -> dict[str, Any]:
    """Assemble JSON-serialisable dashboard data (no chain writes)."""
    pda = _treasury_pda_address()
    fndry_balance = await fetch_treasury_pda_fndry_balance()

    payouts = await fetch_all_payout_records()
    buybacks = await fetch_all_buyback_records()

    payouts_fndry_confirmed = [
        p
        for p in payouts
        if p.status == PayoutStatus.CONFIRMED and p.token == "FNDRY"
    ]

    payouts_by_day: list[tuple[date, float]] = []
    for p in payouts_fndry_confirmed:
        ts = p.updated_at
        payouts_by_day.append((_utc_date(ts), p.amount))

    buybacks_by_day: list[tuple[date, float]] = [
        (_utc_date(b.created_at), b.amount_fndry) for b in buybacks
    ]

    today = datetime.now(timezone.utc).date()

    chart = {
        "daily": _build_series(payouts_by_day, buybacks_by_day, "daily", 30, today),
        "weekly": _build_series(payouts_by_day, buybacks_by_day, "weekly", 12, today),
        "monthly": _build_series(payouts_by_day, buybacks_by_day, "monthly", 12, today),
    }

    tx_rows: list[dict[str, Any]] = []
    for p in payouts:
        if p.status != PayoutStatus.CONFIRMED:
            continue
        tx_rows.append(
            {
                "id": p.id,
                "kind": "payout",
                "direction": "outflow",
                "amount_fndry": p.amount if p.token == "FNDRY" else None,
                "amount_sol": p.amount if p.token == "SOL" else None,
                "token": p.token,
                "occurred_at": p.updated_at.isoformat()
                if hasattr(p.updated_at, "isoformat")
                else str(p.updated_at),
                "tx_hash": p.tx_hash,
                "explorer_url": p.solscan_url
                or (f"https://solscan.io/tx/{p.tx_hash}" if p.tx_hash else None),
                "bounty_id": p.bounty_id,
                "bounty_title": p.bounty_title,
                "counterparty": p.recipient,
            }
        )

    for b in buybacks:
        tx_rows.append(
            {
                "id": b.id,
                "kind": "buyback",
                "direction": "inflow",
                "amount_fndry": b.amount_fndry,
                "amount_sol": b.amount_sol,
                "token": "FNDRY",
                "occurred_at": b.created_at.isoformat()
                if hasattr(b.created_at, "isoformat")
                else str(b.created_at),
                "tx_hash": b.tx_hash,
                "explorer_url": b.solscan_url
                or (f"https://solscan.io/tx/{b.tx_hash}" if b.tx_hash else None),
                "bounty_id": None,
                "bounty_title": None,
                "counterparty": None,
            }
        )

    def _sort_key(r: dict[str, Any]) -> str:
        return r.get("occurred_at") or ""

    tx_rows.sort(key=_sort_key, reverse=True)
    recent_transactions = tx_rows[:100]

    window_days = 30
    window_start = today - timedelta(days=window_days)
    recent_out = sum(
        amt for d, amt in payouts_by_day if d > window_start
    )
    avg_daily_outflow = recent_out / float(window_days) if window_days else 0.0

    runway_days: float | None = None
    projection_note: str | None = None
    if avg_daily_outflow > 1e-9:
        runway_days = round(fndry_balance / avg_daily_outflow, 2)
    elif recent_out <= 0:
        projection_note = "No FNDRY outflows in the last 30 days — runway not estimated."
    else:
        projection_note = "Burn rate too low to estimate runway."

    tier_fndry: dict[int, float] = {1: 0.0, 2: 0.0, 3: 0.0}
    tier_counts: dict[int, int] = {1: 0, 2: 0, 3: 0}
    for b in _bounty_store.values():
        if b.status != BountyStatus.PAID:
            continue
        tier_val = int(b.tier) if isinstance(b.tier, int) else int(b.tier.value)
        if tier_val in tier_fndry:
            tier_fndry[tier_val] += float(b.reward_amount)
            tier_counts[tier_val] += 1

    tier_spending = [
        {
            "tier": t,
            "total_fndry": round(tier_fndry[t], 4),
            "bounty_count": tier_counts[t],
        }
        for t in (1, 2, 3)
    ]

    return {
        "treasury_pda_address": pda,
        "fndry_balance": round(fndry_balance, 6),
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "chart": chart,
        "recent_transactions": recent_transactions,
        "projections": {
            "current_balance_fndry": round(fndry_balance, 6),
            "avg_daily_outflow_fndry": round(avg_daily_outflow, 8),
            "runway_days": runway_days,
            "window_days": window_days,
            "note": projection_note,
        },
        "tier_spending": tier_spending,
    }
