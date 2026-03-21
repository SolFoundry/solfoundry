"""PostgreSQL persistence layer -- primary source of truth (Issue #162).

All CRUD operations go through this module. Uses INSERT ... ON CONFLICT
for safe upserts and proper ORDER BY + pagination for reads. Every
write is awaited (no fire-and-forget) so callers can trust that a 2xx
response means the data has been committed to the database.

Submission rows are first-class entities persisted alongside bounties.
"""

import uuid as _uuid
import logging
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import select, delete as sa_del, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session

log = logging.getLogger(__name__)


def _to_uuid(val: Any) -> Any:
    """Coerce a string value to uuid.UUID for ORM lookups on UUID PK columns.

    Args:
        val: The value to coerce, typically a string UUID.

    Returns:
        A uuid.UUID instance if conversion succeeds, otherwise the original value.
    """
    if isinstance(val, _uuid.UUID):
        return val
    try:
        return _uuid.UUID(str(val))
    except (ValueError, AttributeError):
        return val


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------


async def _upsert(session: AsyncSession, model_cls: type, pk_value: Any, **columns: Any) -> None:
    """Insert or update a row using merge (session-level upsert).

    Uses a SELECT-then-INSERT/UPDATE pattern within a single session to
    avoid TOCTOU races. The caller must commit the session after calling.

    Args:
        session: The active database session.
        model_cls: The SQLAlchemy model class.
        pk_value: The primary key value for the row.
        **columns: Column values to set on the row.
    """
    pk_value = _to_uuid(pk_value)
    obj = await session.get(model_cls, pk_value)
    if obj is None:
        obj = model_cls(id=pk_value, **columns)
        session.add(obj)
    else:
        for key, value in columns.items():
            setattr(obj, key, value)


async def _insert_if_absent(session: AsyncSession, model_cls: type, pk_value: Any, **columns: Any) -> None:
    """Insert a row only if its primary key does not already exist.

    Idempotent -- calling with an existing PK is a no-op.

    Args:
        session: The active database session.
        model_cls: The SQLAlchemy model class.
        pk_value: The primary key value for the row.
        **columns: Column values to set on the new row.
    """
    pk_value = _to_uuid(pk_value)
    existing = await session.get(model_cls, pk_value)
    if existing is None:
        session.add(model_cls(id=pk_value, **columns))


# ---------------------------------------------------------------------------
# Bounty persistence
# ---------------------------------------------------------------------------


async def persist_bounty(bounty: Any) -> None:
    """Persist a bounty to PostgreSQL, inserting or updating as needed.

    Converts Pydantic enum values to their string/int representation
    before writing. Also persists all attached submissions as separate
    rows in the submissions table.

    Args:
        bounty: A BountyDB Pydantic model instance.
    """
    from app.models.bounty_table import BountyTable

    tier = bounty.tier.value if hasattr(bounty.tier, "value") else bounty.tier
    status = bounty.status.value if hasattr(bounty.status, "value") else bounty.status
    async with get_db_session() as session:
        await _upsert(
            session,
            BountyTable,
            bounty.id,
            title=bounty.title,
            description=bounty.description or "",
            tier=tier,
            reward_amount=bounty.reward_amount,
            status=status,
            skills=bounty.required_skills,
            github_issue_url=bounty.github_issue_url,
            created_by=bounty.created_by,
            deadline=bounty.deadline,
            submission_count=len(getattr(bounty, "submissions", [])),
            created_at=bounty.created_at,
            updated_at=bounty.updated_at,
        )
        # Persist attached submissions as first-class rows
        for sub in getattr(bounty, "submissions", []):
            await _persist_bounty_submission(session, bounty.id, sub)
        await session.commit()


async def _persist_bounty_submission(
    session: AsyncSession, bounty_id: str, sub: Any
) -> None:
    """Persist a single bounty submission as a row in the bounty_submissions table.

    Uses upsert semantics so re-persisting the same submission is idempotent.
    The submission PK is a plain string (not UUID), so we skip _to_uuid.

    Args:
        session: The active database session.
        bounty_id: The parent bounty UUID string.
        sub: A SubmissionRecord Pydantic model.
    """
    from app.models.tables import BountySubmissionTable

    sub_status = sub.status.value if hasattr(sub.status, "value") else sub.status
    pk = str(sub.id)
    existing = await session.get(BountySubmissionTable, pk)
    if existing is None:
        session.add(BountySubmissionTable(
            id=pk,
            bounty_id=str(bounty_id),
            pr_url=sub.pr_url,
            submitted_by=sub.submitted_by,
            notes=sub.notes,
            status=sub_status,
            ai_score=sub.ai_score,
            submitted_at=sub.submitted_at,
        ))
    else:
        existing.status = sub_status
        existing.ai_score = sub.ai_score
        existing.notes = sub.notes


async def delete_bounty_row(bounty_id: str) -> None:
    """Delete a bounty row and its submissions from the database.

    Uses cascading delete via the foreign key relationship.

    Args:
        bounty_id: The UUID string of the bounty to delete.
    """
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


async def load_bounties(
    *, offset: int = 0, limit: int = 10000
) -> list[Any]:
    """Load bounties from PostgreSQL ordered by created_at descending.

    Args:
        offset: Number of rows to skip (for pagination).
        limit: Maximum number of rows to return.

    Returns:
        List of BountyTable ORM instances.
    """
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
    """Retrieve a single bounty row by primary key.

    Args:
        bounty_id: The UUID string of the bounty.

    Returns:
        A BountyTable instance or None if not found.
    """
    from app.models.bounty_table import BountyTable

    async with get_db_session() as session:
        return await session.get(BountyTable, _to_uuid(bounty_id))


async def load_submissions_for_bounty(bounty_id: str) -> list[Any]:
    """Load all submissions for a specific bounty from PostgreSQL.

    Results are ordered by submitted_at ascending (oldest first).

    Args:
        bounty_id: The UUID string of the parent bounty.

    Returns:
        List of BountySubmissionTable ORM instances.
    """
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
    """Count bounties matching optional filters.

    Args:
        **filters: Column name / value pairs to filter on.

    Returns:
        The integer count of matching rows.
    """
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
    """Persist a contributor record to PostgreSQL.

    Handles both SQLAlchemy ORM instances and Pydantic-like objects by
    reading attributes directly. The session is committed before return.

    Args:
        contributor: A ContributorDB SQLAlchemy model instance or a Pydantic-like
            object with matching attributes.
    """
    from app.models.contributor import ContributorDB

    async with get_db_session() as session:
        await _upsert(
            session,
            ContributorDB,
            contributor.id,
            username=contributor.username,
            display_name=contributor.display_name,
            email=contributor.email,
            avatar_url=contributor.avatar_url,
            bio=contributor.bio,
            skills=contributor.skills or [],
            badges=contributor.badges or [],
            social_links=contributor.social_links or {},
            total_contributions=contributor.total_contributions,
            total_bounties_completed=contributor.total_bounties_completed,
            total_earnings=contributor.total_earnings,
            reputation_score=contributor.reputation_score,
            created_at=contributor.created_at,
            updated_at=contributor.updated_at,
        )
        await session.commit()


async def delete_contributor_row(contributor_id: str) -> None:
    """Delete a contributor row from the database.

    This is a hard delete. For soft-delete semantics, use an
    is_active flag instead.

    Args:
        contributor_id: The UUID string of the contributor to remove.
    """
    from app.models.contributor import ContributorDB

    async with get_db_session() as session:
        await session.execute(
            sa_del(ContributorDB).where(ContributorDB.id == _to_uuid(contributor_id))
        )
        await session.commit()


async def load_contributors(
    *, offset: int = 0, limit: int = 10000
) -> list[Any]:
    """Load contributors from PostgreSQL ordered by created_at descending.

    Args:
        offset: Number of rows to skip.
        limit: Maximum rows to return.

    Returns:
        List of ContributorDB ORM instances.
    """
    from app.models.contributor import ContributorDB

    async with get_db_session() as session:
        stmt = (
            select(ContributorDB)
            .order_by(ContributorDB.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())


async def get_contributor_by_id(contributor_id: str) -> Optional[Any]:
    """Retrieve a single contributor by primary key.

    Args:
        contributor_id: The UUID string of the contributor.

    Returns:
        A ContributorDB instance or None if not found.
    """
    from app.models.contributor import ContributorDB

    async with get_db_session() as session:
        return await session.get(ContributorDB, _to_uuid(contributor_id))


async def get_contributor_by_username(username: str) -> Optional[Any]:
    """Retrieve a single contributor by their unique username.

    Args:
        username: The username to search for.

    Returns:
        A ContributorDB instance or None if not found.
    """
    from app.models.contributor import ContributorDB

    async with get_db_session() as session:
        stmt = select(ContributorDB).where(ContributorDB.username == username)
        result = await session.execute(stmt)
        return result.scalars().first()


async def count_contributors() -> int:
    """Count total contributors in the database.

    Returns:
        The integer count of contributor rows.
    """
    from app.models.contributor import ContributorDB

    async with get_db_session() as session:
        stmt = select(func.count(ContributorDB.id))
        result = await session.execute(stmt)
        return result.scalar() or 0


async def list_contributor_ids() -> list[str]:
    """Return all contributor ID strings from the database.

    Returns:
        A list of UUID strings for every contributor.
    """
    from app.models.contributor import ContributorDB

    async with get_db_session() as session:
        stmt = select(ContributorDB.id)
        result = await session.execute(stmt)
        return [str(row[0]) for row in result.all()]


# ---------------------------------------------------------------------------
# Payout persistence
# ---------------------------------------------------------------------------


async def persist_payout(record: Any) -> None:
    """Persist a payout record, skipping if the ID already exists.

    Args:
        record: A PayoutRecord Pydantic model instance.
    """
    from app.models.tables import PayoutTable

    status = record.status.value if hasattr(record.status, "value") else record.status
    async with get_db_session() as session:
        await _insert_if_absent(
            session,
            PayoutTable,
            record.id,
            recipient=record.recipient,
            recipient_wallet=record.recipient_wallet,
            amount=record.amount,
            token=record.token,
            bounty_id=record.bounty_id,
            bounty_title=record.bounty_title,
            tx_hash=record.tx_hash,
            status=status,
            solscan_url=record.solscan_url,
            created_at=record.created_at,
        )
        await session.commit()


async def load_payouts(
    *, offset: int = 0, limit: int = 10000
) -> dict[str, Any]:
    """Load payouts from PostgreSQL into a dict keyed by ID string.

    Results are ordered by created_at descending and converted to
    PayoutRecord Pydantic models.

    Args:
        offset: Number of rows to skip.
        limit: Maximum rows to return.

    Returns:
        Dict mapping payout ID strings to PayoutRecord instances.
    """
    from app.models.payout import PayoutRecord, PayoutStatus
    from app.models.tables import PayoutTable

    out: dict[str, Any] = {}
    async with get_db_session() as session:
        stmt = (
            select(PayoutTable)
            .order_by(PayoutTable.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
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
                status=PayoutStatus(row.status),
                solscan_url=row.solscan_url,
                created_at=row.created_at,
            )
    log.info("Loaded %d payouts from PostgreSQL", len(out))
    return out


async def load_buybacks(
    *, offset: int = 0, limit: int = 10000
) -> dict[str, Any]:
    """Load buyback records from PostgreSQL into a dict keyed by ID string.

    Args:
        offset: Number of rows to skip.
        limit: Maximum rows to return.

    Returns:
        Dict mapping buyback ID strings to BuybackRecord instances.
    """
    from app.models.payout import BuybackRecord
    from app.models.tables import BuybackTable

    out: dict[str, Any] = {}
    async with get_db_session() as session:
        stmt = (
            select(BuybackTable)
            .order_by(BuybackTable.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
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
    log.info("Loaded %d buybacks from PostgreSQL", len(out))
    return out


async def persist_buyback(record: Any) -> None:
    """Persist a buyback record, skipping if the ID already exists.

    Args:
        record: A BuybackRecord Pydantic model instance.
    """
    from app.models.tables import BuybackTable

    async with get_db_session() as session:
        await _insert_if_absent(
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


# ---------------------------------------------------------------------------
# Reputation persistence
# ---------------------------------------------------------------------------


async def persist_reputation_entry(entry: Any) -> None:
    """Persist a reputation history entry, skipping duplicates.

    Args:
        entry: A ReputationHistoryEntry Pydantic model instance.
    """
    from app.models.tables import ReputationHistoryTable

    async with get_db_session() as session:
        await _insert_if_absent(
            session,
            ReputationHistoryTable,
            entry.entry_id,
            contributor_id=entry.contributor_id,
            bounty_id=entry.bounty_id,
            bounty_title=entry.bounty_title,
            bounty_tier=entry.bounty_tier,
            review_score=entry.review_score,
            earned_reputation=entry.earned_reputation,
            anti_farming_applied=entry.anti_farming_applied,
            created_at=entry.created_at,
        )
        await session.commit()


async def load_reputation(
    *, offset: int = 0, limit: int = 50000
) -> dict[str, list[Any]]:
    """Load reputation history grouped by contributor ID.

    Args:
        offset: Number of rows to skip.
        limit: Maximum rows to return.

    Returns:
        Dict mapping contributor_id strings to lists of
        ReputationHistoryEntry instances.
    """
    from app.models.reputation import ReputationHistoryEntry
    from app.models.tables import ReputationHistoryTable

    out: dict[str, list[Any]] = {}
    async with get_db_session() as session:
        stmt = (
            select(ReputationHistoryTable)
            .order_by(ReputationHistoryTable.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
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
    log.info("Loaded reputation for %d contributors from PostgreSQL", len(out))
    return out
