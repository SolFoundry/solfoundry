"""PostgreSQL write-through persistence (Issue #162). ORM only, no raw SQL."""
import uuid as _uuid
import logging
from typing import Any
from sqlalchemy import select, delete as sa_del
from app.database import get_db_session
log = logging.getLogger(__name__)

def _to_uuid(val: Any):
    """Coerce a string to uuid.UUID for ORM lookups on UUID PK columns."""
    if isinstance(val, _uuid.UUID): return val
    try: return _uuid.UUID(str(val))
    except (ValueError, AttributeError): return val

async def _merge(model_cls, **kw):
    """The _merge function."""
    if "id" in kw: kw["id"] = _to_uuid(kw["id"])
    async with get_db_session() as s:
        await s.merge(model_cls(**kw)); await s.commit()

async def _insert_if_new(model_cls, pk, **kw):
    """The _insert_if_new function."""
    pk = _to_uuid(pk)
    async with get_db_session() as s:
        if await s.get(model_cls, pk) is None:
            s.add(model_cls(id=pk, **kw)); await s.commit()

async def _delete(model_cls, col, val):
    """The _delete function."""
    async with get_db_session() as s:
        await s.execute(sa_del(model_cls).where(col == _to_uuid(val))); await s.commit()

async def persist_bounty(b: Any) -> None:
    """The persist_bounty function."""
    from app.models.bounty_table import BountyTable
    t = b.tier.value if hasattr(b.tier, "value") else b.tier
    st = b.status.value if hasattr(b.status, "value") else b.status
    await _merge(BountyTable, id=b.id, title=b.title, description=b.description or "",
        tier=t, reward_amount=b.reward_amount, status=st, skills=b.required_skills,
        github_issue_url=b.github_issue_url, created_by=b.created_by, deadline=b.deadline,
        submission_count=len(getattr(b, "submissions", [])),
        created_at=b.created_at, updated_at=b.updated_at)

async def delete_bounty_row(bid: str) -> None:
    """The delete_bounty_row function."""
    from app.models.bounty_table import BountyTable
    await _delete(BountyTable, BountyTable.id, bid)

async def persist_contributor(c: Any) -> None:
    """The persist_contributor function."""
    from app.models.contributor import ContributorDB
    await _merge(ContributorDB, id=c.id, username=c.username, display_name=c.display_name,
        email=c.email, avatar_url=c.avatar_url, bio=c.bio, skills=c.skills or [],
        badges=c.badges or [], social_links=c.social_links or {},
        total_contributions=c.total_contributions, total_bounties_completed=c.total_bounties_completed,
        total_earnings=c.total_earnings, reputation_score=c.reputation_score,
        created_at=c.created_at, updated_at=c.updated_at)

async def delete_contributor_row(cid: str) -> None:
    """The delete_contributor_row function."""
    from app.models.contributor import ContributorDB
    await _delete(ContributorDB, ContributorDB.id, cid)

async def persist_payout(r: Any) -> None:
    """The persist_payout function."""
    from app.models.tables import PayoutTable
    st = r.status.value if hasattr(r.status, "value") else r.status
    await _insert_if_new(PayoutTable, r.id, recipient=r.recipient,
        recipient_wallet=r.recipient_wallet, amount=r.amount, token=r.token,
        bounty_id=r.bounty_id, bounty_title=r.bounty_title, tx_hash=r.tx_hash,
        status=st, solscan_url=r.solscan_url, created_at=r.created_at)

async def persist_buyback(r: Any) -> None:
    """The persist_buyback function."""
    from app.models.tables import BuybackTable
    await _insert_if_new(BuybackTable, r.id, amount_sol=r.amount_sol,
        amount_fndry=r.amount_fndry, price_per_fndry=r.price_per_fndry,
        tx_hash=r.tx_hash, solscan_url=r.solscan_url, created_at=r.created_at)

async def persist_reputation_entry(e: Any) -> None:
    """The persist_reputation_entry function."""
    from app.models.tables import ReputationHistoryTable
    await _insert_if_new(ReputationHistoryTable, e.entry_id,
        contributor_id=e.contributor_id, bounty_id=e.bounty_id,
        bounty_title=e.bounty_title, bounty_tier=e.bounty_tier,
        review_score=e.review_score, earned_reputation=e.earned_reputation,
        anti_farming_applied=e.anti_farming_applied, created_at=e.created_at)

async def load_payouts() -> dict[str, Any]:
    """The load_payouts function."""
    from app.models.payout import PayoutRecord, PayoutStatus
    from app.models.tables import PayoutTable
    out: dict[str, Any] = {}
    async with get_db_session() as s:
        for r in (await s.execute(select(PayoutTable).limit(5000))).scalars():
            out[str(r.id)] = PayoutRecord(id=str(r.id), recipient=r.recipient,
                recipient_wallet=r.recipient_wallet, amount=r.amount, token=r.token,
                bounty_id=r.bounty_id, bounty_title=r.bounty_title, tx_hash=r.tx_hash,
                status=PayoutStatus(r.status), solscan_url=r.solscan_url, created_at=r.created_at)
    log.info("Hydrated %d payouts", len(out)); return out

async def load_buybacks() -> dict[str, Any]:
    """The load_buybacks function."""
    from app.models.payout import BuybackRecord
    from app.models.tables import BuybackTable
    out: dict[str, Any] = {}
    async with get_db_session() as s:
        for r in (await s.execute(select(BuybackTable).limit(5000))).scalars():
            out[str(r.id)] = BuybackRecord(id=str(r.id), amount_sol=r.amount_sol,
                amount_fndry=r.amount_fndry, price_per_fndry=r.price_per_fndry,
                tx_hash=r.tx_hash, solscan_url=r.solscan_url, created_at=r.created_at)
    log.info("Hydrated %d buybacks", len(out)); return out

async def load_reputation() -> dict[str, list[Any]]:
    """The load_reputation function."""
    from app.models.reputation import ReputationHistoryEntry
    from app.models.tables import ReputationHistoryTable
    out: dict[str, list[Any]] = {}
    async with get_db_session() as s:
        for r in (await s.execute(select(ReputationHistoryTable).limit(10000))).scalars():
            out.setdefault(r.contributor_id, []).append(ReputationHistoryEntry(
                entry_id=str(r.id), contributor_id=r.contributor_id, bounty_id=r.bounty_id,
                bounty_title=r.bounty_title, bounty_tier=r.bounty_tier,
                review_score=r.review_score, earned_reputation=r.earned_reputation,
                anti_farming_applied=r.anti_farming_applied, created_at=r.created_at))
    log.info("Hydrated reputation for %d contributors", len(out)); return out
