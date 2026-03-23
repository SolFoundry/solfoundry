"""Tests for the bounty boost feature.

Covers:
  - BoostRequest Pydantic validation (min amount, wallet format)
  - boost_service.create_boost — happy path, below-minimum, invalid bounty, closed bounty
  - boost_service.get_boosts — pagination, total_boosted only counts confirmed
  - boost_service.get_boost_leaderboard — ranking by wallet total
  - boost_service.get_boost_summary — correct totals
  - boost_service.refund_bounty_boosts — marks confirmed boosts as REFUNDED
  - API endpoints: POST /bounties/{id}/boost, GET boosts, GET boost-leaderboard
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

import asyncio
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.bounties import router as bounties_router
from app.database import Base
from app.exceptions import BoostBelowMinimumError, BoostInvalidBountyError
from app.models.boost import (
    BoostRequest,
    BoostStatus,
    BountyBoostTable,
    MINIMUM_BOOST_AMOUNT,
)
from app.models.bounty_table import BountyTable
from app.services import boost_service

# ---------------------------------------------------------------------------
# SQLite in-memory test DB
# ---------------------------------------------------------------------------

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

_engine = create_async_engine(
    TEST_DB_URL,
    poolclass=StaticPool,
    connect_args={"check_same_thread": False},
)
_session_factory = async_sessionmaker(
    _engine, class_=AsyncSession, expire_on_commit=False
)


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


@pytest.fixture(scope="module", autouse=True)
def create_tables():
    """Create all tables once for the module."""

    async def _create():
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    run(_create())
    yield

    async def _drop():
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    run(_drop())


@pytest.fixture(autouse=True)
def clean_tables():
    """Truncate boost + bounty tables between tests."""

    async def _clean():
        async with _session_factory() as db:
            await db.execute(BountyBoostTable.__table__.delete())
            await db.execute(BountyTable.__table__.delete())
            await db.commit()

    run(_clean())


# ---------------------------------------------------------------------------
# Patch get_db_session to use the test DB
# ---------------------------------------------------------------------------


@asynccontextmanager
async def _test_db_session():
    async with _session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


@pytest.fixture(autouse=True)
def patch_db(monkeypatch):
    monkeypatch.setattr(boost_service, "get_db_session", _test_db_session)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_WALLET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
WALLET_B = "7nkFRQMdByBmgZFdGtJv6F5EZqnc9tJo9XsEoQFaJLqV"
WALLET_C = "9wFFyRfZBsuAha4YcuxcXLKwMxJR43S7fPfQLZacgYmW"


def make_bounty_id() -> str:
    return str(uuid.uuid4())


def insert_bounty(bounty_id: str, status: str = "open", reward: float = 5000.0) -> None:
    """Insert a minimal BountyTable row directly into the test DB."""

    async def _insert():
        async with _session_factory() as db:
            row = BountyTable(
                id=bounty_id,
                title="Test Bounty",
                description="desc",
                tier=2,
                reward_amount=reward,
                status=status,
                created_by="system",
            )
            db.add(row)
            await db.commit()

    run(_insert())


def insert_boost(
    bounty_id: str,
    wallet: str = VALID_WALLET,
    amount: float = 2000.0,
    status: str = BoostStatus.CONFIRMED.value,
) -> str:
    """Insert a BountyBoostTable row directly and return its id."""
    bid = str(uuid.uuid4())

    async def _insert():
        async with _session_factory() as db:
            row = BountyBoostTable(
                id=bid,
                bounty_id=bounty_id,
                booster_wallet=wallet,
                amount=amount,
                status=status,
            )
            db.add(row)
            await db.commit()

    run(_insert())
    return bid


# ---------------------------------------------------------------------------
# Pydantic schema validation
# ---------------------------------------------------------------------------


class TestBoostRequestSchema:
    def test_valid_request(self):
        req = BoostRequest(booster_wallet=VALID_WALLET, amount=5000.0)
        assert req.amount == 5000.0
        assert req.tx_hash is None

    def test_below_minimum_raises(self):
        with pytest.raises(Exception):
            BoostRequest(booster_wallet=VALID_WALLET, amount=999.0)

    def test_exactly_minimum_is_valid(self):
        req = BoostRequest(booster_wallet=VALID_WALLET, amount=MINIMUM_BOOST_AMOUNT)
        assert req.amount == MINIMUM_BOOST_AMOUNT

    def test_invalid_wallet_raises(self):
        with pytest.raises(Exception):
            BoostRequest(booster_wallet="not-a-wallet", amount=5000.0)

    def test_with_tx_hash(self):
        req = BoostRequest(booster_wallet=VALID_WALLET, amount=1000.0, tx_hash="abc123")
        assert req.tx_hash == "abc123"


# ---------------------------------------------------------------------------
# boost_service.create_boost
# ---------------------------------------------------------------------------


class TestCreateBoost:
    def test_creates_confirmed_boost_with_tx_hash(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        with patch.object(boost_service, "_send_telegram", new=AsyncMock()):
            result = run(
                boost_service.create_boost(bid, VALID_WALLET, 2000.0, tx_hash="txABC")
            )
        assert result.status == BoostStatus.CONFIRMED
        assert result.tx_hash == "txABC"
        assert result.bounty_id == bid
        assert result.amount == 2000.0

    def test_creates_pending_boost_without_tx_hash(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        with patch.object(boost_service, "_send_telegram", new=AsyncMock()):
            result = run(boost_service.create_boost(bid, VALID_WALLET, 1500.0))
        assert result.status == BoostStatus.PENDING
        assert result.tx_hash is None

    def test_raises_below_minimum(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        with pytest.raises(BoostBelowMinimumError):
            run(boost_service.create_boost(bid, VALID_WALLET, 500.0))

    def test_raises_for_nonexistent_bounty(self):
        with pytest.raises(BoostInvalidBountyError):
            run(boost_service.create_boost("no-such-bounty", VALID_WALLET, 2000.0))

    def test_raises_for_cancelled_bounty(self):
        bid = make_bounty_id()
        insert_bounty(bid, status="cancelled")
        with pytest.raises(BoostInvalidBountyError):
            run(boost_service.create_boost(bid, VALID_WALLET, 2000.0))

    def test_raises_for_paid_bounty(self):
        bid = make_bounty_id()
        insert_bounty(bid, status="paid")
        with pytest.raises(BoostInvalidBountyError):
            run(boost_service.create_boost(bid, VALID_WALLET, 2000.0))

    def test_in_progress_bounty_is_boostable(self):
        bid = make_bounty_id()
        insert_bounty(bid, status="in_progress")
        with patch.object(boost_service, "_send_telegram", new=AsyncMock()):
            result = run(boost_service.create_boost(bid, VALID_WALLET, 1000.0))
        assert result.status == BoostStatus.PENDING

    def test_telegram_notification_sent(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        mock_tg = AsyncMock()
        with patch.object(boost_service, "_send_telegram", new=mock_tg):
            run(boost_service.create_boost(bid, VALID_WALLET, 1000.0))
        mock_tg.assert_awaited_once()
        call_arg: str = mock_tg.call_args[0][0]
        assert "Bounty Boosted" in call_arg or "boosted" in call_arg.lower()


# ---------------------------------------------------------------------------
# boost_service.get_boosts
# ---------------------------------------------------------------------------


class TestGetBoosts:
    def test_returns_empty_for_unknown_bounty(self):
        result = run(boost_service.get_boosts("no-bounty"))
        assert result.boosts == []
        assert result.total == 0
        assert result.total_boosted == 0.0

    def test_returns_all_boosts_for_bounty(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 1000.0)
        insert_boost(bid, WALLET_B, 3000.0)
        result = run(boost_service.get_boosts(bid))
        assert len(result.boosts) == 2

    def test_total_boosted_only_counts_confirmed(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 2000.0, status=BoostStatus.CONFIRMED.value)
        insert_boost(bid, WALLET_B, 5000.0, status=BoostStatus.PENDING.value)
        insert_boost(bid, WALLET_C, 1000.0, status=BoostStatus.REFUNDED.value)
        result = run(boost_service.get_boosts(bid))
        assert result.total_boosted == 2000.0
        assert result.total == 1  # only confirmed counts in total

    def test_pagination_limit(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        for _ in range(5):
            insert_boost(bid, VALID_WALLET, 1000.0)
        result = run(boost_service.get_boosts(bid, skip=0, limit=2))
        assert len(result.boosts) == 2

    def test_pagination_skip(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        for _ in range(4):
            insert_boost(bid, VALID_WALLET, 1000.0)
        result = run(boost_service.get_boosts(bid, skip=3, limit=10))
        assert len(result.boosts) == 1


# ---------------------------------------------------------------------------
# boost_service.get_boost_leaderboard
# ---------------------------------------------------------------------------


class TestGetBoostLeaderboard:
    def test_empty_leaderboard_for_unknown_bounty(self):
        result = run(boost_service.get_boost_leaderboard("no-bounty"))
        assert result.leaderboard == []
        assert result.total_boosted == 0.0

    def test_single_booster_ranked_first(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 5000.0)
        result = run(boost_service.get_boost_leaderboard(bid))
        assert len(result.leaderboard) == 1
        assert result.leaderboard[0].rank == 1
        assert result.leaderboard[0].booster_wallet == VALID_WALLET
        assert result.leaderboard[0].total_boosted == 5000.0

    def test_multiple_boosters_sorted_by_total(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 1000.0)
        insert_boost(bid, WALLET_B, 8000.0)
        insert_boost(bid, WALLET_C, 3000.0)
        result = run(boost_service.get_boost_leaderboard(bid))
        wallets = [e.booster_wallet for e in result.leaderboard]
        assert wallets[0] == WALLET_B
        assert wallets[1] == WALLET_C
        assert wallets[2] == VALID_WALLET

    def test_same_wallet_boosts_aggregated(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 2000.0)
        insert_boost(bid, VALID_WALLET, 3000.0)
        result = run(boost_service.get_boost_leaderboard(bid))
        assert len(result.leaderboard) == 1
        assert result.leaderboard[0].total_boosted == 5000.0
        assert result.leaderboard[0].boost_count == 2

    def test_pending_and_refunded_excluded_from_leaderboard(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 9000.0, status=BoostStatus.PENDING.value)
        insert_boost(bid, WALLET_B, 5000.0, status=BoostStatus.REFUNDED.value)
        insert_boost(bid, WALLET_C, 1000.0, status=BoostStatus.CONFIRMED.value)
        result = run(boost_service.get_boost_leaderboard(bid))
        assert len(result.leaderboard) == 1
        assert result.leaderboard[0].booster_wallet == WALLET_C


# ---------------------------------------------------------------------------
# boost_service.get_boost_summary
# ---------------------------------------------------------------------------


class TestGetBoostSummary:
    def test_summary_no_boosts(self):
        bid = make_bounty_id()
        insert_bounty(bid, reward=5000.0)
        result = run(boost_service.get_boost_summary(bid, original_amount=5000.0))
        assert result.original_amount == 5000.0
        assert result.total_boosted == 0.0
        assert result.total_amount == 5000.0
        assert result.boost_count == 0

    def test_summary_with_confirmed_boosts(self):
        bid = make_bounty_id()
        insert_bounty(bid, reward=5000.0)
        insert_boost(bid, VALID_WALLET, 2000.0)
        insert_boost(bid, WALLET_B, 3000.0)
        result = run(boost_service.get_boost_summary(bid, original_amount=5000.0))
        assert result.total_boosted == 5000.0
        assert result.total_amount == 10_000.0
        assert result.boost_count == 2

    def test_summary_ignores_pending_and_refunded(self):
        bid = make_bounty_id()
        insert_bounty(bid, reward=1000.0)
        insert_boost(bid, VALID_WALLET, 5000.0, status=BoostStatus.PENDING.value)
        result = run(boost_service.get_boost_summary(bid, original_amount=1000.0))
        assert result.total_boosted == 0.0
        assert result.total_amount == 1000.0


# ---------------------------------------------------------------------------
# boost_service.refund_bounty_boosts
# ---------------------------------------------------------------------------


class TestRefundBountyBoosts:
    def test_refunds_all_confirmed_boosts(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 2000.0, status=BoostStatus.CONFIRMED.value)
        insert_boost(bid, WALLET_B, 3000.0, status=BoostStatus.CONFIRMED.value)
        count = run(boost_service.refund_bounty_boosts(bid))
        assert count == 2
        # Verify they are now REFUNDED
        summary = run(boost_service.get_boost_summary(bid, original_amount=0.0))
        assert summary.total_boosted == 0.0

    def test_does_not_refund_pending_boosts(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 2000.0, status=BoostStatus.PENDING.value)
        count = run(boost_service.refund_bounty_boosts(bid))
        assert count == 0

    def test_does_not_double_refund_already_refunded(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 2000.0, status=BoostStatus.REFUNDED.value)
        count = run(boost_service.refund_bounty_boosts(bid))
        assert count == 0

    def test_returns_zero_for_bounty_with_no_boosts(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        count = run(boost_service.refund_bounty_boosts(bid))
        assert count == 0

    def test_mixed_statuses_only_refunds_confirmed(self):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 2000.0, status=BoostStatus.CONFIRMED.value)
        insert_boost(bid, WALLET_B, 1000.0, status=BoostStatus.PENDING.value)
        insert_boost(bid, WALLET_C, 3000.0, status=BoostStatus.REFUNDED.value)
        count = run(boost_service.refund_bounty_boosts(bid))
        assert count == 1


# ---------------------------------------------------------------------------
# API endpoints (via FastAPI TestClient + HTTP)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def api_client():
    """Create a TestClient with only the bounties router."""
    from unittest.mock import patch as _patch

    app = FastAPI()
    app.include_router(bounties_router, prefix="/api")

    with _patch.object(boost_service, "get_db_session", _test_db_session):
        yield TestClient(app, raise_server_exceptions=False)


class TestBoostAPI:
    def test_post_boost_returns_201(self, api_client):
        bid = make_bounty_id()
        insert_bounty(bid)
        with patch.object(boost_service, "_send_telegram", new=AsyncMock()):
            resp = api_client.post(
                f"/api/bounties/{bid}/boost",
                json={"booster_wallet": VALID_WALLET, "amount": 2000.0},
            )
        assert resp.status_code == 201
        body = resp.json()
        assert body["bounty_id"] == bid
        assert body["amount"] == 2000.0
        assert body["status"] == "pending"

    def test_post_boost_confirmed_with_tx_hash(self, api_client):
        bid = make_bounty_id()
        insert_bounty(bid)
        with patch.object(boost_service, "_send_telegram", new=AsyncMock()):
            resp = api_client.post(
                f"/api/bounties/{bid}/boost",
                json={
                    "booster_wallet": VALID_WALLET,
                    "amount": 1000.0,
                    "tx_hash": "txXYZ",
                },
            )
        assert resp.status_code == 201
        assert resp.json()["status"] == "confirmed"

    def test_post_boost_below_minimum_returns_422(self, api_client):
        bid = make_bounty_id()
        insert_bounty(bid)
        resp = api_client.post(
            f"/api/bounties/{bid}/boost",
            json={"booster_wallet": VALID_WALLET, "amount": 500.0},
        )
        assert resp.status_code == 422  # Pydantic validation

    def test_post_boost_invalid_bounty_returns_404(self, api_client):
        with patch.object(boost_service, "_send_telegram", new=AsyncMock()):
            resp = api_client.post(
                "/api/bounties/no-such-bounty/boost",
                json={"booster_wallet": VALID_WALLET, "amount": 1000.0},
            )
        assert resp.status_code == 404

    def test_post_boost_invalid_wallet_returns_422(self, api_client):
        bid = make_bounty_id()
        insert_bounty(bid)
        resp = api_client.post(
            f"/api/bounties/{bid}/boost",
            json={"booster_wallet": "bad-wallet", "amount": 1000.0},
        )
        assert resp.status_code == 422

    def test_get_boosts_returns_200(self, api_client):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 1000.0)
        resp = api_client.get(f"/api/bounties/{bid}/boosts")
        assert resp.status_code == 200
        body = resp.json()
        assert "boosts" in body
        assert "total" in body
        assert "total_boosted" in body

    def test_get_boosts_empty_for_unknown_bounty(self, api_client):
        resp = api_client.get("/api/bounties/unknown-id/boosts")
        assert resp.status_code == 200
        assert resp.json()["boosts"] == []

    def test_get_boost_leaderboard_returns_200(self, api_client):
        bid = make_bounty_id()
        insert_bounty(bid)
        insert_boost(bid, VALID_WALLET, 5000.0)
        resp = api_client.get(f"/api/bounties/{bid}/boost-leaderboard")
        assert resp.status_code == 200
        body = resp.json()
        assert "leaderboard" in body
        assert "total_boosted" in body

    def test_get_boost_leaderboard_empty(self, api_client):
        resp = api_client.get("/api/bounties/no-boosts-here/boost-leaderboard")
        assert resp.status_code == 200
        assert resp.json()["leaderboard"] == []

    def test_get_boosts_pagination(self, api_client):
        bid = make_bounty_id()
        insert_bounty(bid)
        for _ in range(6):
            insert_boost(bid, VALID_WALLET, 1000.0)
        resp = api_client.get(f"/api/bounties/{bid}/boosts?limit=3")
        assert resp.status_code == 200
        assert len(resp.json()["boosts"]) == 3
