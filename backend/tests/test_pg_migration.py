"""PostgreSQL migration DB roundtrip tests (Issue #162)."""
import asyncio, os, uuid as _uuid
from pathlib import Path
import pytest
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")
from app.database import Base, get_db_session, init_db
from app.models.bounty import BountyCreate
from app.models.payout import BuybackCreate, PayoutCreate, PayoutRecord, PayoutStatus
from app.services import bounty_service, payout_service, contributor_service

def _uid(s):
    """The _uid function."""
    try: return _uuid.UUID(str(s))
    except (ValueError, AttributeError): return s

@pytest.fixture(scope="module")
def event_loop():
    """The event_loop function."""
    lp = asyncio.new_event_loop(); yield lp; lp.close()
@pytest.fixture(scope="module", autouse=True)
def db(event_loop):
    """The db function."""
    event_loop.run_until_complete(init_db())
@pytest.fixture(autouse=True)
def reset():
    """The reset function."""
    bounty_service._bounty_store.clear(); payout_service._payout_store.clear()
    payout_service._buyback_store.clear(); contributor_service._store.clear(); yield

def test_tables():
    """The test_tables function."""
    for t in ("bounties","payouts","buybacks","reputation_history","contributors"):
        assert t in Base.metadata.tables

def test_alembic():
    """The test_alembic function."""
    b = Path(__file__).parent.parent
    assert list((b/"migrations/alembic/versions").glob("*.py"))
    assert "postgres:postgres" not in (b/"alembic.ini").read_text()

@pytest.mark.asyncio
async def test_bounty_write_read():
    """Directly test pg_store persist/delete_bounty -> DB roundtrip."""
    from app.services.pg_store import persist_bounty, delete_bounty_row
    from app.models.bounty_table import BountyTable
    from app.models.bounty import BountyDB
    from sqlalchemy import select
    bounty = BountyDB(title="Roundtrip", reward_amount=1.0)
    await persist_bounty(bounty)
    async with get_db_session() as s:
        row = (await s.execute(select(BountyTable).where(BountyTable.id == _uid(bounty.id)))).scalars().first()
        assert row is not None and row.title == "Roundtrip"
    await delete_bounty_row(bounty.id)
    async with get_db_session() as s:
        assert (await s.execute(select(BountyTable).where(BountyTable.id == _uid(bounty.id)))).scalars().first() is None

@pytest.mark.asyncio
async def test_payout_write_read():
    """Directly test pg_store persist_payout -> DB read."""
    from app.services.pg_store import persist_payout
    from app.models.tables import PayoutTable
    from sqlalchemy import select
    rec = PayoutRecord(recipient="u", amount=1.0, status=PayoutStatus.PENDING)
    await persist_payout(rec)
    async with get_db_session() as s:
        row = (await s.execute(select(PayoutTable).where(PayoutTable.id == _uid(rec.id)))).scalars().first()
        assert row is not None and row.recipient == "u"

@pytest.mark.asyncio
async def test_contributor_write_read():
    """Directly test pg_store persist_contributor -> DB read."""
    from app.services.pg_store import persist_contributor
    from app.models.contributor import ContributorDB, ContributorCreate
    from sqlalchemy import select
    import uuid
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    db = ContributorDB(id=uuid.uuid4(), username="pgtest", display_name="PG",
                        created_at=now, updated_at=now)
    await persist_contributor(db)
    async with get_db_session() as s:
        row = (await s.execute(select(ContributorDB).where(ContributorDB.id == db.id))).scalars().first()
        assert row is not None and row.username == "pgtest"

def test_seed():
    """The test_seed function."""
    from app.seed_data import seed_bounties, LIVE_BOUNTIES
    seed_bounties(); assert len(bounty_service._bounty_store) == len(LIVE_BOUNTIES)
