"""Tests for PostgreSQL full migration (Issue #162)."""

import asyncio
import os
from pathlib import Path
import pytest

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from app.database import Base, init_db
from app.models.bounty import BountyCreate, BountyStatus
from app.models.payout import BuybackCreate, PayoutCreate
from app.services import bounty_service, payout_service


@pytest.fixture(scope="module")
def event_loop():
    """Module-scoped event loop for async fixtures."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module", autouse=True)
def setup_db(event_loop):
    """Create all ORM tables in the in-memory SQLite database."""
    event_loop.run_until_complete(init_db())


@pytest.fixture(autouse=True)
def clear():
    """Reset stores between tests."""
    bounty_service._bounty_store.clear()
    payout_service._payout_store.clear()
    payout_service._buyback_store.clear()
    yield


def test_tables_registered():
    """ORM tables exist in metadata."""
    for t in ("bounties", "payouts", "buybacks", "reputation_history"):
        assert t in Base.metadata.tables


def test_migration_sql():
    """Raw SQL migration file is valid and idempotent."""
    p = Path(__file__).parent.parent / "migrations" / "002_full_pg_migration.sql"
    assert p.exists()
    sql = p.read_text()
    for t in ("payouts", "buybacks", "reputation_history"):
        assert t in sql
    assert "IF NOT EXISTS" in sql


def test_alembic_env():
    """Alembic env.py exists for managed migrations."""
    assert (Path(__file__).parent.parent / "migrations" / "alembic" / "env.py").exists()


@pytest.mark.asyncio
async def test_session():
    """Database session executes queries."""
    from app.database import get_db_session
    from sqlalchemy import text
    async with get_db_session() as s:
        assert (await s.execute(text("SELECT 1"))).scalar() == 1


def test_bounty_crud():
    """Create and delete bounty via write-through service."""
    r = bounty_service.create_bounty(BountyCreate(title="PG Test", reward_amount=100.0))
    assert r.id in bounty_service._bounty_store
    assert bounty_service.delete_bounty(r.id)


def test_payout_create():
    """Create a payout and verify it lands in the store."""
    r = payout_service.create_payout(PayoutCreate(recipient="u", amount=100.0))
    assert r.id in payout_service._payout_store


def test_buyback_create():
    """Create a buyback and verify it lands in the store."""
    r = payout_service.create_buyback(
        BuybackCreate(amount_sol=1.0, amount_fndry=2000.0, price_per_fndry=0.0005))
    assert r.id in payout_service._buyback_store


def test_seed():
    """seed_bounties() loads all LIVE_BOUNTIES into the store."""
    from app.seed_data import seed_bounties, LIVE_BOUNTIES
    seed_bounties()
    assert len(bounty_service._bounty_store) == len(LIVE_BOUNTIES)


def test_api_compat():
    """BountyResponse schema and status transitions unchanged."""
    r = bounty_service.create_bounty(BountyCreate(title="Compat", reward_amount=100.0))
    assert frozenset({"id", "title", "status", "submissions"}).issubset(r.model_dump())
    from app.models.bounty import VALID_STATUS_TRANSITIONS
    assert VALID_STATUS_TRANSITIONS[BountyStatus.PAID] == set()


@pytest.mark.asyncio
async def test_pg_store_raises_on_bad_sql():
    """_execute_write must raise on invalid SQL, never swallow."""
    from app.services.pg_store import _execute_write
    with pytest.raises(Exception):
        await _execute_write("INVALID SQL", {})
