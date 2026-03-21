"""PostgreSQL write-through persistence layer (Issue #162).

All write helpers log errors and re-raise so callers can decide whether
to degrade gracefully or abort.  The ``load_*`` functions hydrate
in-memory caches on startup so PostgreSQL is the source of truth.
"""

import json
import logging
from typing import Any

from sqlalchemy import text

from app.database import get_db_session

logger = logging.getLogger(__name__)


async def _execute_write(sql: str, params: dict[str, Any]) -> None:
    """Execute a write statement, logging and re-raising on failure."""
    try:
        async with get_db_session() as session:
            await session.execute(text(sql), params)
            await session.commit()
    except Exception:
        logger.error("pg_store write failed sql=%s", sql[:80], exc_info=True)
        raise


# -- Bounty persistence ------------------------------------------------------

async def persist_bounty(bounty: Any) -> None:
    """Upsert a bounty to PostgreSQL, updating ALL fields on conflict."""
    tier = bounty.tier.value if hasattr(bounty.tier, "value") else bounty.tier
    status = bounty.status.value if hasattr(bounty.status, "value") else bounty.status
    sub_count = len(bounty.submissions) if hasattr(bounty, "submissions") else 0
    await _execute_write(
        "INSERT INTO bounties (id,title,description,tier,reward_amount,"
        "status,skills,github_issue_url,created_by,submission_count,"
        "popularity,created_at,updated_at,deadline) VALUES "
        "(:id::uuid,:title,:desc,:tier,:rw,:st,:sk::jsonb,:gu,:cb,:sc,"
        "0,:ca,:ua,:dl) ON CONFLICT (id) DO UPDATE SET "
        "title=EXCLUDED.title,description=EXCLUDED.description,"
        "tier=EXCLUDED.tier,status=EXCLUDED.status,"
        "reward_amount=EXCLUDED.reward_amount,skills=EXCLUDED.skills,"
        "github_issue_url=EXCLUDED.github_issue_url,"
        "created_by=EXCLUDED.created_by,"
        "submission_count=EXCLUDED.submission_count,"
        "popularity=EXCLUDED.popularity,"
        "deadline=EXCLUDED.deadline,updated_at=EXCLUDED.updated_at",
        {"id": bounty.id, "title": bounty.title, "desc": bounty.description,
         "tier": tier, "rw": bounty.reward_amount, "st": status,
         "sk": json.dumps(bounty.required_skills),
         "gu": bounty.github_issue_url, "cb": bounty.created_by,
         "sc": sub_count, "ca": bounty.created_at,
         "ua": bounty.updated_at, "dl": bounty.deadline},
    )


async def delete_bounty(bounty_id: str) -> None:
    """Remove a bounty row from PostgreSQL."""
    await _execute_write("DELETE FROM bounties WHERE id=:id::uuid", {"id": bounty_id})


# -- Payout / buyback persistence --------------------------------------------

async def insert_payout(record: Any) -> None:
    """Insert a payout record (no-op on duplicate)."""
    await _execute_write(
        "INSERT INTO payouts (id,recipient,recipient_wallet,amount,token,"
        "bounty_id,bounty_title,tx_hash,status,solscan_url) VALUES "
        "(:id,:r,:w,:a,:t,:bid,:bt,:tx,:s,:su) ON CONFLICT (id) DO NOTHING",
        {"id": record.id, "r": record.recipient, "w": record.recipient_wallet,
         "a": record.amount, "t": record.token, "bid": record.bounty_id,
         "bt": record.bounty_title, "tx": record.tx_hash,
         "s": record.status.value, "su": record.solscan_url},
    )


async def insert_buyback(record: Any) -> None:
    """Insert a buyback record (no-op on duplicate)."""
    await _execute_write(
        "INSERT INTO buybacks (id,amount_sol,amount_fndry,price_per_fndry,"
        "tx_hash,solscan_url) VALUES (:id,:sol,:f,:p,:tx,:su) "
        "ON CONFLICT (id) DO NOTHING",
        {"id": record.id, "sol": record.amount_sol, "f": record.amount_fndry,
         "p": record.price_per_fndry, "tx": record.tx_hash,
         "su": record.solscan_url},
    )


# -- Reputation persistence --------------------------------------------------

async def insert_reputation_entry(entry: Any) -> None:
    """Insert a reputation history row (no-op on contributor+bounty dup)."""
    await _execute_write(
        "INSERT INTO reputation_history (id,contributor_id,bounty_id,"
        "bounty_title,bounty_tier,review_score,earned_reputation,"
        "anti_farming_applied) VALUES (:id,:cid,:bid,:t,:tier,:s,:r,:a) "
        "ON CONFLICT (contributor_id,bounty_id) DO NOTHING",
        {"id": entry.entry_id, "cid": entry.contributor_id,
         "bid": entry.bounty_id, "t": entry.bounty_title,
         "tier": entry.bounty_tier, "s": entry.review_score,
         "r": entry.earned_reputation, "a": entry.anti_farming_applied},
    )


# -- Hydration (load from PG on startup) -------------------------------------

async def load_payouts() -> dict[str, Any]:
    """Load all payout records from PostgreSQL into a dict keyed by ID."""
    from app.models.payout import PayoutRecord, PayoutStatus
    result: dict[str, Any] = {}
    async with get_db_session() as session:
        for row in await session.execute(text("SELECT * FROM payouts")):
            result[str(row.id)] = PayoutRecord(
                id=str(row.id), recipient=row.recipient,
                recipient_wallet=row.recipient_wallet, amount=row.amount,
                token=row.token, bounty_id=row.bounty_id,
                bounty_title=row.bounty_title, tx_hash=row.tx_hash,
                status=PayoutStatus(row.status), solscan_url=row.solscan_url,
                created_at=row.created_at)
    logger.info("Loaded %d payouts from PostgreSQL", len(result))
    return result


async def load_buybacks() -> dict[str, Any]:
    """Load all buyback records from PostgreSQL into a dict keyed by ID."""
    from app.models.payout import BuybackRecord
    result: dict[str, Any] = {}
    async with get_db_session() as session:
        for row in await session.execute(text("SELECT * FROM buybacks")):
            result[str(row.id)] = BuybackRecord(
                id=str(row.id), amount_sol=row.amount_sol,
                amount_fndry=row.amount_fndry,
                price_per_fndry=row.price_per_fndry, tx_hash=row.tx_hash,
                solscan_url=row.solscan_url, created_at=row.created_at)
    logger.info("Loaded %d buybacks from PostgreSQL", len(result))
    return result


async def load_reputation() -> dict[str, list[Any]]:
    """Load reputation history from PostgreSQL, grouped by contributor ID."""
    from app.models.reputation import ReputationHistoryEntry
    result: dict[str, list[Any]] = {}
    async with get_db_session() as session:
        for row in await session.execute(
                text("SELECT * FROM reputation_history ORDER BY created_at")):
            entry = ReputationHistoryEntry(
                entry_id=str(row.id), contributor_id=row.contributor_id,
                bounty_id=row.bounty_id, bounty_title=row.bounty_title,
                bounty_tier=row.bounty_tier, review_score=row.review_score,
                earned_reputation=row.earned_reputation,
                anti_farming_applied=row.anti_farming_applied,
                created_at=row.created_at)
            result.setdefault(row.contributor_id, []).append(entry)
    logger.info("Loaded reputation for %d contributors", len(result))
    return result
