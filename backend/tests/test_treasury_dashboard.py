"""Tests for GET /api/admin/treasury/dashboard.

Uses the in-memory payout/buyback stores and mocks the treasury_service so
tests run without a Solana RPC connection.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.api.admin as admin_module
from app.api.admin import router as admin_router
from app.models.bounty import BountyDB, BountyStatus, BountyTier
from app.models.payout import PayoutRecord, PayoutStatus, BuybackRecord
from app.services import bounty_service
from app.services.payout_service import _payout_store, _buyback_store

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TEST_API_KEY = "test-treasury-key"
AUTH_HEADER = {"Authorization": f"Bearer {TEST_API_KEY}"}
BAD_AUTH = {"Authorization": "Bearer wrong"}

MOCK_TREASURY_STATS = {
    "sol_balance": 125.5,
    "fndry_balance": 800_000.0,
    "treasury_wallet": "AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1",
    "total_paid_out_fndry": 200_000.0,
    "total_paid_out_sol": 5.0,
    "total_payouts": 40,
    "total_buyback_amount": 10.0,
    "total_buybacks": 2,
    "last_updated": datetime.now(timezone.utc),
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def patch_admin_key(monkeypatch):
    monkeypatch.setattr(admin_module, "_ADMIN_API_KEY", TEST_API_KEY)


@pytest.fixture()
def client():
    app = FastAPI()
    app.include_router(admin_router)
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture(autouse=True)
def clear_stores():
    _payout_store.clear()
    _buyback_store.clear()
    bounty_service._bounty_store.clear()
    yield
    _payout_store.clear()
    _buyback_store.clear()
    bounty_service._bounty_store.clear()


def _payout(
    pid="p1",
    amount=1000.0,
    token="FNDRY",
    status=PayoutStatus.CONFIRMED,
    recipient="alice",
    bounty_title="Fix bug",
    tx_hash=None,
    days_ago=1,
):
    p = PayoutRecord(
        id=pid,
        recipient=recipient,
        amount=amount,
        token=token,
        bounty_title=bounty_title,
        tx_hash=tx_hash,
        status=status,
        created_at=datetime.now(timezone.utc) - timedelta(days=days_ago),
        updated_at=datetime.now(timezone.utc),
    )
    _payout_store[pid] = p
    return p


def _buyback(bid="b1", amount_sol=5.0, amount_fndry=50_000.0):
    b = BuybackRecord(
        id=bid,
        amount_sol=amount_sol,
        amount_fndry=amount_fndry,
        price_per_fndry=amount_sol / amount_fndry,
        created_at=datetime.now(timezone.utc),
    )
    _buyback_store[bid] = b
    return b


def _bounty(bid="bounty1", status=BountyStatus.PAID, tier=BountyTier.T1, reward=500.0):
    b = BountyDB(
        id=bid,
        title="Test bounty",
        description="desc",
        tier=tier,
        required_skills=[],
        reward_amount=reward,
        created_by="admin",
        deadline=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        status=status,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    bounty_service._bounty_store[bid] = b
    return b


# ---------------------------------------------------------------------------
# Mock treasury stats helper
# ---------------------------------------------------------------------------


def _mock_treasury():
    from app.models.payout import TreasuryStats

    return TreasuryStats(**MOCK_TREASURY_STATS)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestTreasuryDashboardAuth:
    def test_requires_auth(self, client):
        resp = client.get("/api/admin/treasury/dashboard")
        assert resp.status_code == 401

    def test_rejects_bad_key(self, client):
        resp = client.get("/api/admin/treasury/dashboard", headers=BAD_AUTH)
        assert resp.status_code == 403

    def test_accepts_valid_key(self, client):
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        assert resp.status_code == 200


class TestTreasuryDashboardStructure:
    def test_response_has_all_required_fields(self, client):
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        data = resp.json()
        assert "sol_balance" in data
        assert "fndry_balance" in data
        assert "treasury_wallet" in data
        assert "total_paid_out_fndry" in data
        assert "daily_points" in data
        assert "burn_rate" in data
        assert "spending_by_tier" in data
        assert "recent_transactions" in data
        assert "last_updated" in data

    def test_burn_rate_has_required_fields(self, client):
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        burn = resp.json()["burn_rate"]
        assert "daily_avg_7d" in burn
        assert "daily_avg_30d" in burn
        assert "daily_avg_90d" in burn
        assert "runway_days_7d" in burn
        assert "runway_days_30d" in burn

    def test_daily_points_has_30_entries(self, client):
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        points = resp.json()["daily_points"]
        assert len(points) == 30

    def test_spending_by_tier_has_3_tiers(self, client):
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        tiers = resp.json()["spending_by_tier"]
        assert len(tiers) == 3
        tier_numbers = [t["tier"] for t in tiers]
        assert 1 in tier_numbers and 2 in tier_numbers and 3 in tier_numbers


class TestTreasuryBalances:
    def test_reflects_mock_balances(self, client):
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        data = resp.json()
        assert data["fndry_balance"] == 800_000.0
        assert data["sol_balance"] == 125.5
        assert data["treasury_wallet"] == "AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1"

    def test_totals_from_treasury_stats(self, client):
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        data = resp.json()
        assert data["total_paid_out_fndry"] == 200_000.0
        assert data["total_payouts"] == 40


class TestTreasuryTransactions:
    def test_payouts_appear_in_recent_transactions(self, client):
        _payout(pid="p1", amount=500.0, token="FNDRY", status=PayoutStatus.CONFIRMED)
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        txs = resp.json()["recent_transactions"]
        payout_txs = [t for t in txs if t["type"] == "payout"]
        assert len(payout_txs) >= 1
        assert payout_txs[0]["amount"] == 500.0

    def test_buybacks_appear_in_recent_transactions(self, client):
        _buyback(bid="b1", amount_sol=3.0, amount_fndry=30_000.0)
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        txs = resp.json()["recent_transactions"]
        buyback_txs = [t for t in txs if t["type"] == "buyback"]
        assert len(buyback_txs) == 1
        assert buyback_txs[0]["amount"] == 3.0
        assert buyback_txs[0]["token"] == "SOL"

    def test_max_20_recent_transactions(self, client):
        for i in range(25):
            _payout(pid=f"p{i}", amount=100.0, days_ago=i)
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        txs = resp.json()["recent_transactions"]
        assert len(txs) <= 20

    def test_transactions_sorted_newest_first(self, client):
        _payout(pid="old", amount=100.0, days_ago=5)
        _payout(pid="new", amount=200.0, days_ago=0)
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        txs = resp.json()["recent_transactions"]
        assert len(txs) >= 2
        # newest should appear first
        assert txs[0]["id"] == "new"

    def test_payout_includes_status_field(self, client):
        _payout(pid="p1", status=PayoutStatus.PENDING)
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        txs = resp.json()["recent_transactions"]
        payout = next(t for t in txs if t["id"] == "p1")
        assert payout["status"] == "pending"


class TestTreasuryDailyPoints:
    def test_outflow_accumulates_for_today(self, client):
        _payout(pid="p1", amount=1_000.0, days_ago=0, status=PayoutStatus.CONFIRMED)
        _payout(pid="p2", amount=2_000.0, days_ago=0, status=PayoutStatus.CONFIRMED)
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        points = resp.json()["daily_points"]
        today_str = datetime.now(timezone.utc).date().isoformat()
        today_point = next((p for p in points if p["date"] == today_str), None)
        assert today_point is not None
        assert today_point["outflow"] == pytest.approx(3_000.0)

    def test_pending_payouts_excluded_from_outflow(self, client):
        _payout(pid="p1", amount=5_000.0, days_ago=0, status=PayoutStatus.PENDING)
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        points = resp.json()["daily_points"]
        today_str = datetime.now(timezone.utc).date().isoformat()
        today_point = next((p for p in points if p["date"] == today_str), None)
        assert today_point is None or today_point["outflow"] == 0.0


class TestTreasuryBurnRate:
    def test_burn_rate_zero_when_no_payouts(self, client):
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        burn = resp.json()["burn_rate"]
        assert burn["daily_avg_7d"] == 0.0
        assert burn["daily_avg_30d"] == 0.0

    def test_runway_null_when_burn_rate_zero(self, client):
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        burn = resp.json()["burn_rate"]
        assert burn["runway_days_7d"] is None
        assert burn["runway_days_30d"] is None

    def test_runway_calculated_from_balance_and_burn(self, client):
        # Put 1000 FNDRY/day confirmed payouts for past 7 days
        for i in range(7):
            _payout(
                pid=f"p{i}", amount=1_000.0, days_ago=i, status=PayoutStatus.CONFIRMED
            )
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        burn = resp.json()["burn_rate"]
        # daily_avg_7d should be ~ 1000 * 7 / 30 (spread over 30 days window)
        # runway = 800_000 / daily_avg_7d
        assert burn["daily_avg_7d"] > 0
        assert burn["runway_days_7d"] is not None
        assert burn["runway_days_7d"] > 0


class TestTreasurySpendingByTier:
    def test_paid_bounties_appear_in_tier_breakdown(self, client):
        _bounty(bid="b1", status=BountyStatus.PAID, tier=BountyTier.T1, reward=500.0)
        _bounty(bid="b2", status=BountyStatus.PAID, tier=BountyTier.T3, reward=2_000.0)
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        tiers = {t["tier"]: t for t in resp.json()["spending_by_tier"]}
        assert tiers[1]["total_fndry"] == 500.0
        assert tiers[1]["count"] == 1
        assert tiers[3]["total_fndry"] == 2_000.0
        assert tiers[3]["count"] == 1

    def test_unpaid_bounties_excluded_from_tier_breakdown(self, client):
        _bounty(bid="b1", status=BountyStatus.OPEN, tier=BountyTier.T2, reward=800.0)
        with patch(
            "app.api.admin.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=_mock_treasury(),
        ):
            resp = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
        tiers = {t["tier"]: t for t in resp.json()["spending_by_tier"]}
        assert tiers[2]["total_fndry"] == 0.0
        assert tiers[2]["count"] == 0
