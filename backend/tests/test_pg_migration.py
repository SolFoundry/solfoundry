"""Tests for PostgreSQL migration (Issue #162)."""
import asyncio, os
from pathlib import Path
import pytest
os.environ.setdefault("DATABASE_URL","sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY","test-secret-key-for-ci")
from app.database import Base, engine, init_db
from app.models.bounty import BountyCreate, BountyDB, BountyStatus
from app.models.payout import BuybackCreate, PayoutCreate
from app.services import bounty_service, payout_service

@pytest.fixture(scope="module")
def event_loop():
    """The event_loop function."""
    loop = asyncio.new_event_loop(); yield loop; loop.close()

@pytest.fixture(scope="module",autouse=True)
def setup_db(event_loop):
    """The setup_db function."""
    event_loop.run_until_complete(init_db())

@pytest.fixture(autouse=True)
def clear():
    """The clear function."""
    bounty_service._bounty_store.clear()
    payout_service._payout_store.clear()
    payout_service._buyback_store.clear()
    yield

def test_tables_exist():
    """The test_tables_exist function."""
    for t in ("bounties","payouts","buybacks","reputation_history"):
        assert t in Base.metadata.tables

def test_migration_file():
    """The test_migration_file function."""
    p = Path(__file__).parent.parent/"migrations"/"002_full_pg_migration.sql"
    assert p.exists()
    sql = p.read_text()
    for t in ("payouts","buybacks","reputation_history"):
        assert t in sql
    assert "IF NOT EXISTS" in sql

@pytest.mark.asyncio
async def test_session():
    """The test_session function."""
    from app.database import get_db_session
    from sqlalchemy import text
    async with get_db_session() as s:
        assert (await s.execute(text("SELECT 1"))).scalar()==1

def test_bounty_crud():
    """The test_bounty_crud function."""
    r = bounty_service.create_bounty(BountyCreate(title="PG Test",reward_amount=100.0))
    assert r.id in bounty_service._bounty_store
    assert bounty_service.delete_bounty(r.id)

def test_payout_create():
    """The test_payout_create function."""
    r = payout_service.create_payout(PayoutCreate(recipient="u",amount=100.0))
    assert r.id in payout_service._payout_store

def test_buyback_create():
    """The test_buyback_create function."""
    r = payout_service.create_buyback(
        BuybackCreate(amount_sol=1.0,amount_fndry=2000.0,price_per_fndry=0.0005))
    assert r.id in payout_service._buyback_store

def test_seed():
    """The test_seed function."""
    from app.seed_data import seed_bounties, LIVE_BOUNTIES
    seed_bounties()
    assert len(bounty_service._bounty_store)==len(LIVE_BOUNTIES)

def test_api_compat():
    """The test_api_compat function."""
    r = bounty_service.create_bounty(BountyCreate(title="Compat",reward_amount=100.0))
    assert frozenset({"id","title","status","submissions"}).issubset(r.model_dump())
    from app.models.bounty import VALID_STATUS_TRANSITIONS
    assert VALID_STATUS_TRANSITIONS[BountyStatus.PAID]==set()
