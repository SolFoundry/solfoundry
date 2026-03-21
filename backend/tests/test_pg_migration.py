"""PostgreSQL migration integration tests (Issue #162).

Verifies: table existence, Alembic migration presence, round-trip DB
operations for bounties/contributors/payouts, and the seed script.
"""

import asyncio
import os
import uuid as _uuid
from pathlib import Path

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app.database import Base, get_db_session, init_db
from app.models.bounty import BountyCreate
from app.models.payout import BuybackCreate, PayoutCreate, PayoutRecord, PayoutStatus
from app.services import bounty_service, payout_service, contributor_service


def _uid(value):
    """Coerce a value to uuid.UUID for ORM lookups.

    Args:
        value: A string or UUID to coerce.

    Returns:
        A uuid.UUID instance, or the original value if conversion fails.
    """
    try:
        return _uuid.UUID(str(value))
    except (ValueError, AttributeError):
        return value


@pytest.fixture(scope="module")
def event_loop():
    """Create a dedicated event loop for module-scoped async tests."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module", autouse=True)
def db(event_loop):
    """Initialize the database schema once per module."""
    event_loop.run_until_complete(init_db())


@pytest.fixture(autouse=True)
def reset():
    """Clear in-memory stores between tests to ensure isolation."""
    bounty_service._bounty_store.clear()
    payout_service._payout_store.clear()
    payout_service._buyback_store.clear()
    contributor_service._store.clear()
    yield


# ---------------------------------------------------------------------------
# Table existence
# ---------------------------------------------------------------------------


def test_all_tables_exist():
    """Verify all required tables are registered in SQLAlchemy metadata."""
    expected_tables = (
        "bounties",
        "payouts",
        "buybacks",
        "reputation_history",
        "contributors",
        "submissions",
        "users",
    )
    for table_name in expected_tables:
        assert table_name in Base.metadata.tables, (
            f"Table '{table_name}' not found in metadata"
        )


# ---------------------------------------------------------------------------
# Alembic migration files
# ---------------------------------------------------------------------------


def test_alembic_migration_exists():
    """Verify Alembic migration files exist and alembic.ini is safe."""
    backend_dir = Path(__file__).parent.parent
    versions = list(
        (backend_dir / "migrations" / "alembic" / "versions").glob("*.py")
    )
    assert len(versions) >= 1, "No Alembic migration files found"
    ini_content = (backend_dir / "alembic.ini").read_text()
    assert "postgres:postgres@" not in ini_content, (
        "alembic.ini contains hardcoded credentials"
    )


# ---------------------------------------------------------------------------
# Bounty round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_bounty_write_read_delete():
    """Test full bounty lifecycle: persist, read, delete in PostgreSQL."""
    from app.services.pg_store import persist_bounty, delete_bounty_row
    from app.models.bounty_table import BountyTable
    from app.models.bounty import BountyDB
    from sqlalchemy import select

    bounty = BountyDB(title="Roundtrip Test", reward_amount=1.0)
    await persist_bounty(bounty)

    async with get_db_session() as session:
        row = (
            await session.execute(
                select(BountyTable).where(
                    BountyTable.id == _uid(bounty.id)
                )
            )
        ).scalars().first()
        assert row is not None, "Bounty not found in DB after persist"
        assert row.title == "Roundtrip Test"

    await delete_bounty_row(bounty.id)

    async with get_db_session() as session:
        row = (
            await session.execute(
                select(BountyTable).where(
                    BountyTable.id == _uid(bounty.id)
                )
            )
        ).scalars().first()
        assert row is None, "Bounty still exists after delete"


# ---------------------------------------------------------------------------
# Payout round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_payout_write_read():
    """Test payout persistence and retrieval from PostgreSQL."""
    from app.services.pg_store import persist_payout
    from app.models.tables import PayoutTable
    from sqlalchemy import select

    record = PayoutRecord(
        recipient="test_user", amount=42.5, status=PayoutStatus.PENDING
    )
    await persist_payout(record)

    async with get_db_session() as session:
        row = (
            await session.execute(
                select(PayoutTable).where(
                    PayoutTable.id == _uid(record.id)
                )
            )
        ).scalars().first()
        assert row is not None, "Payout not found in DB after persist"
        assert row.recipient == "test_user"
        assert float(row.amount) == 42.5


# ---------------------------------------------------------------------------
# Contributor round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_contributor_write_read():
    """Test contributor persistence and retrieval from PostgreSQL."""
    from app.services.pg_store import persist_contributor
    from app.models.contributor import ContributorDB
    from sqlalchemy import select
    import uuid
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    contributor = ContributorDB(
        id=uuid.uuid4(),
        username="pgtest_user",
        display_name="PG Test",
        created_at=now,
        updated_at=now,
    )
    await persist_contributor(contributor)

    async with get_db_session() as session:
        row = (
            await session.execute(
                select(ContributorDB).where(
                    ContributorDB.id == contributor.id
                )
            )
        ).scalars().first()
        assert row is not None, "Contributor not found in DB after persist"
        assert row.username == "pgtest_user"


# ---------------------------------------------------------------------------
# Reputation round-trip
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reputation_write_read():
    """Test reputation entry persistence and load from PostgreSQL."""
    from app.services.pg_store import persist_reputation_entry, load_reputation
    from app.models.reputation import ReputationHistoryEntry
    from datetime import datetime, timezone
    import uuid

    entry = ReputationHistoryEntry(
        entry_id=str(uuid.uuid4()),
        contributor_id="test-contributor",
        bounty_id="test-bounty",
        bounty_title="Test Bounty",
        bounty_tier=1,
        review_score=7.5,
        earned_reputation=5.0,
        anti_farming_applied=False,
        created_at=datetime.now(timezone.utc),
    )
    await persist_reputation_entry(entry)

    loaded = await load_reputation()
    assert "test-contributor" in loaded
    assert len(loaded["test-contributor"]) >= 1
    assert loaded["test-contributor"][0].bounty_id == "test-bounty"


# ---------------------------------------------------------------------------
# Seed script
# ---------------------------------------------------------------------------


def test_seed_data_populates_store():
    """Verify seed_bounties populates the in-memory store correctly."""
    from app.seed_data import seed_bounties, LIVE_BOUNTIES

    seed_bounties()
    assert len(bounty_service._bounty_store) == len(LIVE_BOUNTIES)


# ---------------------------------------------------------------------------
# Load functions with ordering
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_load_payouts_ordered():
    """Verify load_payouts returns results ordered by created_at desc."""
    from app.services.pg_store import persist_payout, load_payouts
    from datetime import datetime, timezone, timedelta

    older = PayoutRecord(
        recipient="old_user",
        amount=10.0,
        status=PayoutStatus.PENDING,
        created_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    newer = PayoutRecord(
        recipient="new_user",
        amount=20.0,
        status=PayoutStatus.CONFIRMED,
        created_at=datetime.now(timezone.utc),
    )
    await persist_payout(older)
    await persist_payout(newer)

    loaded = await load_payouts()
    ids = list(loaded.keys())
    # Newer should come first
    assert ids[0] == newer.id
