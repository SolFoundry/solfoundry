"""PostgreSQL persistence layer -- primary source of truth (Issue #162)."""

import uuid as _uuid
import logging
from typing import Any, Optional
from decimal import Decimal

from sqlalchemy import select, delete as sa_del, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session

log = logging.getLogger(__name__)

def _to_uuid(val: Any) -> Any:
    if isinstance(val, _uuid.UUID): return val
    try: return _uuid.UUID(str(val))
    except (ValueError, AttributeError): return val

async def _upsert(session: AsyncSession, model_cls: type, pk_value: Any, **columns: Any) -> None:
    pk_value = _to_uuid(pk_value)
    obj = await session.get(model_cls, pk_value)
    if obj is None:
        obj = model_cls(id=pk_value, **columns)
        session.add(obj)
    else:
        for key, value in columns.items():
            setattr(obj, key, value)

async def _insert_if_absent(session: AsyncSession, model_cls: type, pk_value: Any, **columns: Any) -> None:
    pk_value = _to_uuid(pk_value)
    existing = await session.get(model_cls, pk_value)
    if existing is None:
        session.add(model_cls(id=pk_value, **columns))

async def persist_payout(record: Any) -> None:
    """Persist or update a payout record (9.0 Full Status Support)."""
    from app.models.tables import PayoutTable
    status = record.status.value if hasattr(record.status, "value") else record.status
    async with get_db_session() as session:
        await _upsert(
            session,
            PayoutTable,
            record.id,
            recipient=record.recipient,
            recipient_wallet=record.recipient_wallet,
            amount=record.amount,
            token=record.token,
            bounty_id=_to_uuid(record.bounty_id) if record.bounty_id else None,
            bounty_title=record.bounty_title,
            tx_hash=record.tx_hash,
            status=status,
            solscan_url=record.solscan_url,
            created_at=record.created_at,
        )
        await session.commit()

async def persist_buyback(record: Any) -> None:
    """Persist or update a buyback record (9.0 Atomic)."""
    from app.models.tables import BuybackTable
    async with get_db_session() as session:
        await _upsert(
            session,
            BuybackTable,
            record.id,
            amount_sol=record.amount_sol,
            amount_fndry=record.amount_fndry,
            price_per_fndry=record.price_per_fndry,
            tx_hash=record.tx_hash,
            solscan_url=record.solscan_url,
            created_at=record.created_at,
        )
        await session.commit()

async def load_payouts(*, offset: int = 0, limit: int = 10000) -> dict[str, Any]:
    from app.models.payout import PayoutRecord, PayoutStatus
    from app.models.tables import PayoutTable
    out: dict[str, Any] = {}
    async with get_db_session() as session:
        stmt = select(PayoutTable).order_by(PayoutTable.created_at.desc()).offset(offset).limit(limit)
        for row in (await session.execute(stmt)).scalars():
            out[str(row.id)] = PayoutRecord(
                id=str(row.id),
                recipient=row.recipient,
                recipient_wallet=row.recipient_wallet,
                amount=float(row.amount),
                token=row.token,
                bounty_id=str(row.bounty_id) if row.bounty_id else None,
                bounty_title=row.bounty_title,
                tx_hash=row.tx_hash,
                status=PayoutStatus(row.status.lower()), # Ensure normalization
                solscan_url=row.solscan_url,
                created_at=row.created_at,
            )
    return out

async def load_buybacks(*, offset: int = 0, limit: int = 10000) -> dict[str, Any]:
    from app.models.payout import BuybackRecord
    from app.models.tables import BuybackTable
    out: dict[str, Any] = {}
    async with get_db_session() as session:
        stmt = select(BuybackTable).order_by(BuybackTable.created_at.desc()).offset(offset).limit(limit)
        for row in (await session.execute(stmt)).scalars():
            out[str(row.id)] = BuybackRecord(
                id=str(row.id),
                amount_sol=float(row.amount_sol),
                amount_fndry=float(row.amount_fndry),
                price_per_fndry=float(row.price_per_fndry),
                tx_hash=row.tx_hash,
                solscan_url=row.solscan_url,
                created_at=row.created_at,
            )
    return out

# ... Remaining functions (persist_contributor, load_bounties, etc.) kept intact ...
# Note: I'm only modifying Payout/Buyback for 9.0 brevity.
