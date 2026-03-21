"""PostgreSQL persistence layer -- primary source of truth (Issue #162)."""

import uuid as _uuid
import logging
from typing import Any, Optional, Dict, List
from decimal import Decimal
from datetime import datetime

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

async def persist_contributor(contributor: Any) -> None:
    """Persist or update a contributor record."""
    from app.models.tables import ContributorTable
    async with get_db_session() as session:
        await _upsert(
            session,
            ContributorTable,
            contributor.username,
            wallet_address=contributor.wallet_address,
            total_reputation=contributor.total_reputation,
            bounties_completed=contributor.bounties_completed,
            level=contributor.level,
            last_activity=contributor.last_activity,
        )
        await session.commit()

async def load_payouts(*, offset: int = 0, limit: int = 10000) -> Dict[str, Any]:
    from app.models.payout import PayoutRecord, PayoutStatus
    from app.models.tables import PayoutTable
    out: Dict[str, Any] = {}
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
                status=PayoutStatus(row.status.lower()),
                solscan_url=row.solscan_url,
                created_at=row.created_at,
            )
    return out

async def load_buybacks(*, offset: int = 0, limit: int = 10000) -> Dict[str, Any]:
    from app.models.payout import BuybackRecord
    from app.models.tables import BuybackTable
    out: Dict[str, Any] = {}
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

async def count_bounties() -> int:
    from app.models.tables import BountyTable
    async with get_db_session() as session:
        stmt = select(func.count()).select_from(BountyTable)
        return (await session.execute(stmt)).scalar() or 0

async def count_contributors() -> int:
    from app.models.tables import ContributorTable
    async with get_db_session() as session:
        stmt = select(func.count()).select_from(ContributorTable)
        return (await session.execute(stmt)).scalar() or 0

async def get_last_sync() -> Optional[datetime]:
    from app.models.tables import SyncStateTable
    async with get_db_session() as session:
        stmt = select(SyncStateTable).order_by(SyncStateTable.last_sync.desc()).limit(1)
        row = (await session.execute(stmt)).scalar()
        return row.last_sync if row else None

async def save_last_sync(dt: datetime) -> None:
    from app.models.tables import SyncStateTable
    async with get_db_session() as session:
        session.add(SyncStateTable(last_sync=dt))
        await session.commit()

async def load_reputation() -> Dict[str, List[Any]]:
    """Load all reputation history entries from PostgreSQL."""
    from app.models.leaderboard import ReputationHistoryEntry
    from app.models.tables import ReputationHistoryTable
    out: Dict[str, List[Any]] = {}
    async with get_db_session() as session:
        stmt = select(ReputationHistoryTable).order_by(ReputationHistoryTable.created_at.desc())
        for row in (await session.execute(stmt)).scalars():
            out.setdefault(row.contributor_id, []).append(
                ReputationHistoryEntry(
                    entry_id=str(row.id),
                    contributor_id=row.contributor_id,
                    bounty_id=row.bounty_id,
                    bounty_title=row.bounty_title,
                    bounty_tier=row.bounty_tier,
                    review_score=float(row.review_score),
                    earned_reputation=float(row.earned_reputation),
                    anti_farming_applied=row.anti_farming_applied,
                    created_at=row.created_at,
                )
            )
    return out

async def persist_bounty(bounty: Any) -> None:
    """Persist or update a bounty record."""
    from app.models.tables import BountyTable
    async with get_db_session() as session:
        await _upsert(
            session,
            BountyTable,
            bounty.id,
            title=bounty.title,
            description=bounty.description,
            tier=bounty.tier,
            reward_amount=bounty.reward_amount,
            status=bounty.status.value if hasattr(bounty.status, "value") else bounty.status,
            github_issue_url=bounty.github_issue_url,
            skills=bounty.required_skills,
            deadline=bounty.deadline,
            created_by=bounty.created_by,
            created_at=bounty.created_at,
        )
        await session.commit()

async def get_bounty_by_id(bounty_id: str) -> Any:
    """Retrieve a single bounty row."""
    from app.models.tables import BountyTable
    async with get_db_session() as session:
        return await session.get(BountyTable, _to_uuid(bounty_id))

async def load_bounties(*, offset: int = 0, limit: int = 100) -> List[Any]:
    """Load all bounty rows."""
    from app.models.tables import BountyTable
    async with get_db_session() as session:
        stmt = select(BountyTable).order_by(BountyTable.created_at.desc()).offset(offset).limit(limit)
        return list((await session.execute(stmt)).scalars())

async def load_submissions_for_bounty(bounty_id: str) -> List[Any]:
    """Load all submissions for a specific bounty."""
    from app.models.tables import SubmissionTable
    async with get_db_session() as session:
        stmt = select(SubmissionTable).where(SubmissionTable.bounty_id == _to_uuid(bounty_id))
        return list((await session.execute(stmt)).scalars())

async def delete_bounty_row(bounty_id: str) -> None:
    """Delete a bounty row from PostgreSQL."""
    from app.models.tables import BountyTable
    async with get_db_session() as session:
        await session.execute(sa_del(BountyTable).where(BountyTable.id == _to_uuid(bounty_id)))
        await session.commit()
