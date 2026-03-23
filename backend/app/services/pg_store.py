"""PostgreSQL persistence layer -- primary source of truth (Issue #162)."""

import uuid as _uuid
import logging
from typing import Any, Optional, Dict, List
from decimal import Decimal
from datetime import datetime

from sqlalchemy import select, delete as sa_del, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session

log = logging.getLogger(__name__)

def _to_uuid(val: Any) -> Any:
    if isinstance(val, _uuid.UUID): return val
    try: return _uuid.UUID(str(val))
    except (ValueError, AttributeError): return val

async def _upsert(session: AsyncSession, model_cls: type, pk_value: Any, **columns: Any) -> None:
    """Insert or update a row using merge (session-level upsert)."""
    pk_value = _to_uuid(pk_value)
    obj = await session.get(model_cls, pk_value)
    if obj is None:
        obj = model_cls(id=pk_value, **columns)
        session.add(obj)
    else:
        for key, value in columns.items():
            setattr(obj, key, value)

async def _insert_if_absent(session: AsyncSession, model_cls: type, pk_value: Any, **columns: Any) -> None:
    """Insert a row only if its primary key does not already exist."""
    pk_value = _to_uuid(pk_value)
    existing = await session.get(model_cls, pk_value)
    if existing is None:
        session.add(model_cls(id=pk_value, **columns))

# ---------------------------------------------------------------------------
# Bounty persistence
# ---------------------------------------------------------------------------

async def persist_bounty(bounty: Any) -> None:
    """Persist a bounty to PostgreSQL, inserting or updating as needed."""
    from app.models.bounty_table import BountyTable

    tier = bounty.tier.value if hasattr(bounty.tier, "value") else bounty.tier
    status = bounty.status.value if hasattr(bounty.status, "value") else bounty.status
    
    async with get_db_session() as session:
        await _upsert(
            session,
            BountyTable,
            bounty.id,
            title=bounty.title,
            project_name=getattr(bounty, "project_name", None),
            description=bounty.description or "",
            tier=tier,
            category=getattr(bounty, "category", None),
            reward_amount=bounty.reward_amount,
            status=status,
            creator_type=getattr(bounty, "creator_type", "platform"),
            skills=bounty.required_skills,
            github_issue_url=bounty.github_issue_url,
            created_by=bounty.created_by,
            deadline=bounty.deadline,
            submission_count=len(getattr(bounty, "submissions", [])),
            created_at=bounty.created_at,
            updated_at=getattr(bounty, "updated_at", bounty.created_at),
        )
        # Persist attached submissions as first-class rows
        for sub in getattr(bounty, "submissions", []):
            await _persist_bounty_submission(session, bounty.id, sub)
        await session.commit()

async def _persist_bounty_submission(session: AsyncSession, bounty_id: str, sub: Any) -> None:
    """Persist a single bounty submission as a row in the bounty_submissions table."""
    from app.models.tables import BountySubmissionTable

    sub_status = sub.status.value if hasattr(sub.status, "value") else sub.status
    pk = str(sub.id)
    existing = await session.get(BountySubmissionTable, pk)
    if existing is None:
        session.add(
            BountySubmissionTable(
                id=pk,
                bounty_id=str(bounty_id),
                pr_url=sub.pr_url,
                submitted_by=sub.submitted_by,
                notes=sub.notes,
                status=sub_status,
                ai_score=sub.ai_score,
                submitted_at=sub.submitted_at,
            )
        )
    else:
        existing.status = sub_status
        existing.ai_score = sub.ai_score
        existing.notes = sub.notes

async def delete_bounty_row(bounty_id: str) -> None:
    """Delete a bounty row and its submissions from the database."""
    from app.models.bounty_table import BountyTable
    from app.models.tables import BountySubmissionTable

    async with get_db_session() as session:
        # Delete child submissions first
        await session.execute(
            sa_del(BountySubmissionTable).where(
                BountySubmissionTable.bounty_id == bounty_id
            )
        )
        await session.execute(
            sa_del(BountyTable).where(BountyTable.id == _to_uuid(bounty_id))
        )
        await session.commit()

async def load_bounties(*, offset: int = 0, limit: int = 10000) -> List[Any]:
    from app.models.bounty_table import BountyTable
    async with get_db_session() as session:
        stmt = (
            select(BountyTable)
            .order_by(BountyTable.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

async def get_bounty_by_id(bounty_id: str) -> Optional[Any]:
    from app.models.bounty_table import BountyTable
    async with get_db_session() as session:
        return await session.get(BountyTable, _to_uuid(bounty_id))

async def load_submissions_for_bounty(bounty_id: str) -> List[Any]:
    from app.models.tables import BountySubmissionTable
    async with get_db_session() as session:
        stmt = (
            select(BountySubmissionTable)
            .where(BountySubmissionTable.bounty_id == bounty_id)
            .order_by(BountySubmissionTable.submitted_at.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

async def count_bounties(**filters: Any) -> int:
    from app.models.bounty_table import BountyTable
    async with get_db_session() as session:
        stmt = select(func.count(BountyTable.id))
        for col_name, value in filters.items():
            col = getattr(BountyTable, col_name, None)
            if col is not None and value is not None:
                stmt = stmt.where(col == value)
        result = await session.execute(stmt)
        return result.scalar() or 0

# ---------------------------------------------------------------------------
# Contributor persistence
# ---------------------------------------------------------------------------

async def persist_contributor(contributor: Any) -> None:
    from app.models.contributor import ContributorDB
    async with get_db_session() as session:
        await _upsert(
            session,
            ContributorDB,
            contributor.id,
            username=contributor.username,
            display_name=getattr(contributor, "display_name", None),
            email=getattr(contributor, "email", None),
            avatar_url=getattr(contributor, "avatar_url", None),
            bio=getattr(contributor, "bio", None),
            skills=getattr(contributor, "skills", []) or [],
            badges=getattr(contributor, "badges", []) or [],
            social_links=getattr(contributor, "social_links", {}) or {},
            total_contributions=getattr(contributor, "total_contributions", 0),
            total_bounties_completed=getattr(contributor, "total_bounties_completed", 0),
            total_earnings=getattr(contributor, "total_earnings", 0.0),
            reputation_score=getattr(contributor, "reputation_score", 0.0),
            created_at=contributor.created_at,
            updated_at=getattr(contributor, "updated_at", contributor.created_at),
        )
        await session.commit()

# ---------------------------------------------------------------------------
# Payout & Treasury persistence
# ---------------------------------------------------------------------------

async def persist_payout(record: Any) -> None:
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

async def persist_buyback(record: Any) -> None:
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

# ---------------------------------------------------------------------------
# Sync & System persistence
# ---------------------------------------------------------------------------

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
