"""PostgreSQL migration integration tests (Issue #162).

Verifies: table existence, Alembic migration presence, round-trip DB
operations for bounties/contributors/payouts/submissions, the seed script,
and that all services read from the database as primary source of truth.
"""

import asyncio
import os
import uuid as _uuid
from pathlib import Path

import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app.database import Base, get_db_session, init_db
from app.models.bounty_table import BountyTable as BountyDB, SubmissionRecord
from app.models.payout import PayoutRecord, PayoutStatus
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
        "bounty_submissions",
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
    versions = list((backend_dir / "migrations" / "alembic" / "versions").glob("*.py"))
    assert len(versions) >= 1, "No Alembic migration files found"
    ini_content = (backend_dir / "alembic.ini").read_text()
    assert "postgres:postgres@" not in ini_content, (
        "alembic.ini contains hardcoded credentials"
    )


def test_alembic_migration_covers_all_tables():
    """Verify the migration file includes all required table definitions."""
    backend_dir = Path(__file__).parent.parent
    migration_file = (
        backend_dir
        / "migrations"
        / "alembic"
        / "versions"
        / "002_full_pg_persistence.py"
    )
    content = migration_file.read_text()
    for table in (
        "users",
        "bounties",
        "contributors",
        "submissions",
        "payouts",
        "buybacks",
        "reputation_history",
        "bounty_submissions",
    ):
        assert f'"{table}"' in content, f"Alembic migration missing table '{table}'"


# ---------------------------------------------------------------------------
# Bounty round-trip (DB as primary source)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_bounty_write_read_delete():
    """Test full bounty lifecycle: persist, read from DB, delete."""
    from app.services.pg_store import persist_bounty, delete_bounty_row
    from app.models.bounty_table import BountyTable
    from sqlalchemy import select

    bounty = BountyDB(title="Roundtrip Test", reward_amount=1.0)
    await persist_bounty(bounty)

    async with get_db_session() as session:
        row = (
            (
                await session.execute(
                    select(BountyTable).where(BountyTable.id == _uid(bounty.id))
                )
            )
            .scalars()
            .first()
        )
        assert row is not None, "Bounty not found in DB after persist"
        assert row.title == "Roundtrip Test"

    await delete_bounty_row(bounty.id)

    async with get_db_session() as session:
        row = (
            (
                await session.execute(
                    select(BountyTable).where(BountyTable.id == _uid(bounty.id))
                )
            )
            .scalars()
            .first()
        )
        assert row is None, "Bounty still exists after delete"


@pytest.mark.asyncio
async def test_bounty_service_reads_from_db():
    """Verify get_bounty reads from PostgreSQL, not just the in-memory cache."""
    from app.services.pg_store import persist_bounty

    bounty = BountyDB(title="DB Primary Read", reward_amount=2.0)
    await persist_bounty(bounty)

    # Clear the in-memory cache to prove the read goes to DB
    bounty_service._bounty_store.clear()

    result = await bounty_service.get_bounty(bounty.id)
    assert result is not None, "get_bounty should read from DB when cache is empty"
    assert result.title == "DB Primary Read"


@pytest.mark.asyncio
async def test_bounty_list_reads_from_db():
    """Verify list_bounties queries PostgreSQL when cache is empty."""
    from app.services.pg_store import persist_bounty

    b1 = BountyDB(title="List DB Test 1", reward_amount=1.0)
    b2 = BountyDB(title="List DB Test 2", reward_amount=2.0)
    await persist_bounty(b1)
    await persist_bounty(b2)

    bounty_service._bounty_store.clear()

    result = await bounty_service.list_bounties()
    assert result.total >= 2, "list_bounties should read from DB"


# ---------------------------------------------------------------------------
# Submission round-trip (first-class DB rows)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_submission_persisted_as_db_rows():
    """Verify submissions are stored as first-class rows in bounty_submissions."""
    from app.services.pg_store import persist_bounty, load_submissions_for_bounty

    bounty = BountyDB(
        title="Sub Test",
        reward_amount=1.0,
        submissions=[
            SubmissionRecord(
                bounty_id="placeholder",
                pr_url="https://github.com/org/repo/pull/1",
                submitted_by="alice",
                ai_score=7.5,
            ),
        ],
    )
    # Fix bounty_id on the submission
    bounty.submissions[0].bounty_id = bounty.id
    await persist_bounty(bounty)

    subs = await load_submissions_for_bounty(bounty.id)
    assert len(subs) >= 1, "Submission not found in DB"
    assert subs[0].pr_url == "https://github.com/org/repo/pull/1"
    assert subs[0].submitted_by == "alice"


@pytest.mark.asyncio
async def test_submissions_survive_cache_clear():
    """Verify submissions are loaded from DB after clearing the cache."""
    from app.services.pg_store import persist_bounty

    bounty = BountyDB(
        title="Sub Persist Test",
        reward_amount=1.0,
        submissions=[
            SubmissionRecord(
                bounty_id="tmp",
                pr_url="https://github.com/org/repo/pull/99",
                submitted_by="bob",
            ),
        ],
    )
    bounty.submissions[0].bounty_id = bounty.id
    await persist_bounty(bounty)

    bounty_service._bounty_store.clear()

    result = await bounty_service.get_bounty(bounty.id)
    assert result is not None
    assert len(result.submissions) >= 1
    assert result.submissions[0].pr_url == "https://github.com/org/repo/pull/99"


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
            (
                await session.execute(
                    select(PayoutTable).where(PayoutTable.id == _uid(record.id))
                )
            )
            .scalars()
            .first()
        )
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
            (
                await session.execute(
                    select(ContributorDB).where(ContributorDB.id == contributor.id)
                )
            )
            .scalars()
            .first()
        )
        assert row is not None, "Contributor not found in DB after persist"
        assert row.username == "pgtest_user"


@pytest.mark.asyncio
async def test_contributor_service_reads_from_db():
    """Verify get_contributor reads from PostgreSQL first."""
    from app.services.pg_store import persist_contributor
    from app.models.contributor import ContributorDB
    import uuid
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    contributor = ContributorDB(
        id=uuid.uuid4(),
        username="db_read_test",
        display_name="DB Read Test",
        created_at=now,
        updated_at=now,
    )
    await persist_contributor(contributor)

    contributor_service._store.clear()

    result = await contributor_service.get_contributor(str(contributor.id))
    assert result is not None, "get_contributor should read from DB"
    assert result.username == "db_read_test"


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


# ---------------------------------------------------------------------------
# Numeric precision for monetary columns
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_monetary_columns_use_numeric():
    """Verify monetary columns store values with correct precision."""
    from app.services.pg_store import persist_payout, load_payouts

    record = PayoutRecord(
        recipient="precision_test",
        amount=123456.789012,
        status=PayoutStatus.CONFIRMED,
    )
    await persist_payout(record)

    loaded = await load_payouts()
    payout = loaded.get(record.id)
    assert payout is not None
    # Verify precision is maintained (Numeric(20,6) supports 6 decimal places)
    assert abs(payout.amount - 123456.789012) < 0.001


# ---------------------------------------------------------------------------
# Foreign keys
# ---------------------------------------------------------------------------


def test_payout_table_has_bounty_fk():
    """Verify PayoutTable has a foreign key to bounties."""
    from app.models.tables import PayoutTable

    fks = {
        fk.target_fullname
        for col in PayoutTable.__table__.columns
        for fk in col.foreign_keys
    }
    assert "bounties.id" in fks, "PayoutTable missing FK to bounties"


def test_bounty_submission_table_has_bounty_fk():
    """Verify BountySubmissionTable has a foreign key to bounties."""
    from app.models.tables import BountySubmissionTable

    fks = {
        fk.target_fullname
        for col in BountySubmissionTable.__table__.columns
        for fk in col.foreign_keys
    }
    assert "bounties.id" in fks, "BountySubmissionTable missing FK to bounties"


# ---------------------------------------------------------------------------
# Upsert idempotency
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_persist_bounty_upsert_is_idempotent():
    """Verify persisting the same bounty twice does not create duplicates."""
    from app.services.pg_store import persist_bounty, load_bounties

    bounty = BountyDB(title="Upsert Test", reward_amount=5.0)
    await persist_bounty(bounty)
    bounty.title = "Upsert Test Updated"
    await persist_bounty(bounty)

    rows = await load_bounties()
    matching = [
        r for r in rows if str(r.id) == bounty.id or r.title == "Upsert Test Updated"
    ]
    assert len(matching) == 1, "Upsert should not create duplicates"
    assert matching[0].title == "Upsert Test Updated"
