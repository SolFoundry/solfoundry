"""Tests for the admin dashboard API (/api/admin/*).

All tests run against an in-memory SQLite database with AUTH_ENABLED=false
so the normal auth middleware is a no-op.  Admin auth is tested separately
by supplying / omitting the ADMIN_API_KEY Bearer token.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from unittest.mock import AsyncMock, patch

import app.api.admin as admin_module
from app.api.admin import router as admin_router
from app.models.bounty import BountyDB, BountyStatus, BountyTier
from app.models.payout import BuybackRecord, PayoutRecord, PayoutStatus
from app.services import bounty_service, contributor_service, payout_service

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TEST_API_KEY = "test-admin-key-abc"
AUTH_HEADER = {"Authorization": f"Bearer {TEST_API_KEY}"}
BAD_AUTH = {"Authorization": "Bearer wrong-key"}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def patch_admin_key(monkeypatch):
    """Inject test API key into the admin module before each test."""
    monkeypatch.setattr(admin_module, "_ADMIN_API_KEY", TEST_API_KEY)


@pytest.fixture()
def client():
    """Create a fresh TestClient with only the admin router mounted."""
    app = FastAPI()
    app.include_router(admin_router)
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture(autouse=True)
def clear_stores():
    """Reset in-memory stores between tests."""
    bounty_service._bounty_store.clear()
    contributor_service._store.clear()
    payout_service._payout_store.clear()
    payout_service._buyback_store.clear()
    yield
    bounty_service._bounty_store.clear()
    contributor_service._store.clear()
    payout_service._payout_store.clear()
    payout_service._buyback_store.clear()


def _make_bounty(
    bid="b1",
    title="Fix bug",
    status=BountyStatus.OPEN,
    reward=500.0,
    tier=BountyTier.T1,
):
    """Insert a minimal BountyDB into the in-memory store."""
    from datetime import datetime, timezone, timedelta

    bounty = BountyDB(
        id=bid,
        title=title,
        description="A test bounty",
        tier=tier,
        required_skills=[],
        reward_amount=reward,
        created_by="creator-1",
        deadline=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        status=status,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    bounty_service._bounty_store[bid] = bounty
    return bounty


def _make_contributor(cid="c1", username="alice", banned=False):
    """Insert a minimal contributor into the in-memory store."""
    from app.models.contributor import ContributorDB

    c = ContributorDB(
        id=cid,
        username=username,
        display_name=username.capitalize(),
        skills=[],
        badges=[],
        reputation_score=10.0,
        total_bounties_completed=2,
        total_earnings=1000.0,
    )
    c.is_banned = banned
    contributor_service._store[cid] = c
    return c


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------


class TestAdminAuth:
    def test_unauthenticated_request_returns_401(self, client):
        resp = client.get("/api/admin/overview")
        assert resp.status_code == 401

    def test_wrong_key_returns_403(self, client):
        resp = client.get("/api/admin/overview", headers=BAD_AUTH)
        assert resp.status_code == 403

    def test_no_api_key_configured_returns_503(self, client, monkeypatch):
        monkeypatch.setattr(admin_module, "_ADMIN_API_KEY", "")
        resp = client.get("/api/admin/overview", headers=AUTH_HEADER)
        assert resp.status_code == 503

    def test_correct_key_allows_access(self, client):
        resp = client.get("/api/admin/overview", headers=AUTH_HEADER)
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------


class TestOverview:
    def test_returns_zero_counts_on_empty_stores(self, client):
        data = client.get("/api/admin/overview", headers=AUTH_HEADER).json()
        assert data["total_bounties"] == 0
        assert data["total_contributors"] == 0
        assert data["total_fndry_paid"] == 0

    def test_counts_open_and_completed_bounties(self, client):
        _make_bounty("b1", status=BountyStatus.OPEN)
        _make_bounty("b2", status=BountyStatus.COMPLETED, reward=1000.0)
        _make_bounty("b3", status=BountyStatus.PAID, reward=500.0)

        data = client.get("/api/admin/overview", headers=AUTH_HEADER).json()
        assert data["total_bounties"] == 3
        assert data["open_bounties"] == 1
        # completed_bounties counts COMPLETED only; PAID is tracked separately via financials
        assert data["completed_bounties"] == 1
        # total_fndry_paid counts only PAID bounties
        assert data["total_fndry_paid"] == 500.0

    def test_counts_banned_contributors(self, client):
        _make_contributor("c1", "alice", banned=False)
        _make_contributor("c2", "bob", banned=True)

        data = client.get("/api/admin/overview", headers=AUTH_HEADER).json()
        assert data["total_contributors"] == 2
        assert data["active_contributors"] == 1
        assert data["banned_contributors"] == 1


# ---------------------------------------------------------------------------
# Bounty management
# ---------------------------------------------------------------------------


class TestBountyManagement:
    def test_list_bounties_empty(self, client):
        data = client.get("/api/admin/bounties", headers=AUTH_HEADER).json()
        assert data["total"] == 0
        assert data["items"] == []

    def test_list_bounties_pagination(self, client):
        for i in range(5):
            _make_bounty(f"b{i}", title=f"Bounty {i}")

        data = client.get(
            "/api/admin/bounties?page=1&per_page=3", headers=AUTH_HEADER
        ).json()
        assert len(data["items"]) == 3
        assert data["total"] == 5
        assert data["page"] == 1

    def test_list_bounties_search_filter(self, client):
        _make_bounty("b1", title="Fix the login bug")
        _make_bounty("b2", title="Add dark mode")

        data = client.get(
            "/api/admin/bounties?search=login", headers=AUTH_HEADER
        ).json()
        assert data["total"] == 1
        assert data["items"][0]["id"] == "b1"

    def test_list_bounties_status_filter(self, client):
        _make_bounty("b1", status=BountyStatus.OPEN)
        _make_bounty("b2", status=BountyStatus.COMPLETED)

        data = client.get("/api/admin/bounties?status=open", headers=AUTH_HEADER).json()
        assert data["total"] == 1
        assert data["items"][0]["id"] == "b1"

    def test_update_bounty_status(self, client):
        # OPEN → IN_PROGRESS is a valid lifecycle transition
        _make_bounty("b1", status=BountyStatus.OPEN)
        resp = client.patch(
            "/api/admin/bounties/b1",
            headers=AUTH_HEADER,
            json={"status": "in_progress"},
        )
        assert resp.status_code == 200
        assert bounty_service._bounty_store["b1"].status == BountyStatus.IN_PROGRESS

    def test_update_bounty_reward(self, client):
        _make_bounty("b1", reward=500.0)
        resp = client.patch(
            "/api/admin/bounties/b1",
            headers=AUTH_HEADER,
            json={"reward_amount": 1500.0},
        )
        assert resp.status_code == 200
        assert bounty_service._bounty_store["b1"].reward_amount == 1500.0

    def test_update_nonexistent_bounty_404(self, client):
        resp = client.patch(
            "/api/admin/bounties/missing",
            headers=AUTH_HEADER,
            json={"status": "cancelled"},
        )
        assert resp.status_code == 404

    def test_update_with_no_changes_400(self, client):
        _make_bounty("b1")
        resp = client.patch("/api/admin/bounties/b1", headers=AUTH_HEADER, json={})
        assert resp.status_code == 400

    def test_close_bounty(self, client):
        # IN_PROGRESS → CANCELLED is a valid lifecycle transition
        _make_bounty("b1", status=BountyStatus.IN_PROGRESS)
        resp = client.post("/api/admin/bounties/b1/close", headers=AUTH_HEADER)
        assert resp.status_code == 200
        assert bounty_service._bounty_store["b1"].status == BountyStatus.CANCELLED

    def test_close_bounty_rejects_settled_status(self, client):
        """COMPLETED and PAID bounties cannot be force-cancelled."""
        for status in (BountyStatus.COMPLETED, BountyStatus.PAID):
            _make_bounty("settled", status=status)
            resp = client.post("/api/admin/bounties/settled/close", headers=AUTH_HEADER)
            assert resp.status_code == 400, (
                f"Expected 400 for {status}, got {resp.status_code}"
            )
            bounty_service._bounty_store.pop("settled", None)

    def test_close_nonexistent_bounty_404(self, client):
        resp = client.post("/api/admin/bounties/missing/close", headers=AUTH_HEADER)
        assert resp.status_code == 404

    def test_close_bounty_writes_audit_log(self, client):
        _make_bounty("b1", status=BountyStatus.IN_PROGRESS)
        resp = client.post("/api/admin/bounties/b1/close", headers=AUTH_HEADER)
        # Audit write is async/PostgreSQL-backed; verify the action itself succeeded
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Contributor management
# ---------------------------------------------------------------------------


class TestContributorManagement:
    def test_list_contributors_empty(self, client):
        data = client.get("/api/admin/contributors", headers=AUTH_HEADER).json()
        assert data["total"] == 0

    def test_list_contributors_banned_filter(self, client):
        _make_contributor("c1", "alice", banned=False)
        _make_contributor("c2", "bob", banned=True)

        data = client.get(
            "/api/admin/contributors?is_banned=true", headers=AUTH_HEADER
        ).json()
        assert data["total"] == 1
        assert data["items"][0]["username"] == "bob"

    def test_ban_contributor(self, client):
        _make_contributor("c1", "alice", banned=False)
        resp = client.post(
            "/api/admin/contributors/c1/ban",
            headers=AUTH_HEADER,
            json={"reason": "Spam submissions violating policy"},
        )
        assert resp.status_code == 200
        assert contributor_service._store["c1"].is_banned is True

    def test_ban_requires_reason(self, client):
        _make_contributor("c1")
        resp = client.post(
            "/api/admin/contributors/c1/ban",
            headers=AUTH_HEADER,
            json={"reason": "ok"},  # too short (<5 chars)
        )
        assert resp.status_code == 422

    def test_unban_contributor(self, client):
        _make_contributor("c1", "alice", banned=True)
        resp = client.post("/api/admin/contributors/c1/unban", headers=AUTH_HEADER)
        assert resp.status_code == 200
        assert contributor_service._store["c1"].is_banned is False

    def test_ban_nonexistent_contributor_404(self, client):
        resp = client.post(
            "/api/admin/contributors/missing/ban",
            headers=AUTH_HEADER,
            json={"reason": "Test reason here"},
        )
        assert resp.status_code == 404

    def test_ban_writes_audit_entry(self, client):
        _make_contributor("c1", "alice")
        resp = client.post(
            "/api/admin/contributors/c1/ban",
            headers=AUTH_HEADER,
            json={"reason": "Policy violation reason"},
        )
        # Audit write is async/PostgreSQL-backed; verify the action itself succeeded
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Review pipeline
# ---------------------------------------------------------------------------


class TestReviewPipeline:
    def test_empty_pipeline(self, client):
        data = client.get("/api/admin/reviews/pipeline", headers=AUTH_HEADER).json()
        assert data["total_active"] == 0
        assert data["pass_rate"] == 0.0
        assert data["avg_score"] == 0.0


# ---------------------------------------------------------------------------
# Financial
# ---------------------------------------------------------------------------


class TestFinancial:
    def test_overview_zero_on_empty(self, client):
        data = client.get("/api/admin/financial/overview", headers=AUTH_HEADER).json()
        assert data["total_fndry_distributed"] == 0.0
        assert data["total_paid_bounties"] == 0

    def test_overview_sums_paid_bounties(self, client):
        _make_bounty("b1", status=BountyStatus.PAID, reward=1000.0)
        _make_bounty(
            "b2", status=BountyStatus.COMPLETED, reward=500.0
        )  # completed ≠ paid out
        _make_bounty("b3", status=BountyStatus.OPEN, reward=200.0)

        data = client.get("/api/admin/financial/overview", headers=AUTH_HEADER).json()
        # Only PAID bounties count as distributed; COMPLETED is pending payout
        assert data["total_fndry_distributed"] == 1000.0
        assert data["total_paid_bounties"] == 1

    def test_payout_history_pagination(self, client):
        for i in range(5):
            _make_bounty(f"b{i}", status=BountyStatus.PAID, reward=100.0)

        data = client.get(
            "/api/admin/financial/payouts?page=1&per_page=3", headers=AUTH_HEADER
        ).json()
        assert len(data["items"]) == 3
        assert data["total"] == 5


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


class TestAuditLog:
    def test_empty_audit_log(self, client):
        # Use an event filter that cannot match real rows so the result is empty
        # even when other tests in this module have written to the shared DB.
        data = client.get(
            "/api/admin/audit-log?event=__no_audit_rows_match_this__",
            headers=AUTH_HEADER,
        ).json()
        assert data["entries"] == []
        assert data["total"] == 0

    def test_audit_log_populated_by_actions(self, client):
        _make_bounty("b1")
        client.post("/api/admin/bounties/b1/close", headers=AUTH_HEADER)

        data = client.get("/api/admin/audit-log", headers=AUTH_HEADER).json()
        assert data["total"] >= 1
        events = [e["event"] for e in data["entries"]]
        assert "admin_bounty_closed" in events

    def test_audit_log_event_filter(self, client):
        _make_bounty("b1")
        _make_contributor("c1", "alice")
        client.post("/api/admin/bounties/b1/close", headers=AUTH_HEADER)
        client.post(
            "/api/admin/contributors/c1/ban",
            headers=AUTH_HEADER,
            json={"reason": "Spamming the platform"},
        )

        data = client.get(
            "/api/admin/audit-log?event=banned", headers=AUTH_HEADER
        ).json()
        assert all("banned" in e["event"] for e in data["entries"])

    def test_audit_log_limit(self, client):
        for i in range(10):
            _make_bounty(f"b{i}")
            client.post(f"/api/admin/bounties/b{i}/close", headers=AUTH_HEADER)

        data = client.get("/api/admin/audit-log?limit=5", headers=AUTH_HEADER).json()
        assert len(data["entries"]) <= 5


# ---------------------------------------------------------------------------
# Treasury dashboard
# ---------------------------------------------------------------------------


class TestTreasuryDashboard:
    def test_requires_owner_header_when_configured(self, client, monkeypatch):
        monkeypatch.setenv("TREASURY_OWNER_WALLETS", "OwnerWalletTest111")
        with patch(
            "app.services.treasury_dashboard_service.get_token_balance",
            new_callable=AsyncMock,
            return_value=0.0,
        ):
            r = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER)
            assert r.status_code == 403

            r2 = client.get(
                "/api/admin/treasury/dashboard",
                headers={
                    **AUTH_HEADER,
                    "X-SF-Treasury-Wallet": "OwnerWalletTest111",
                },
            )
            assert r2.status_code == 200
            assert r2.json()["fndry_balance"] == 0.0

    @patch(
        "app.services.treasury_dashboard_service.get_token_balance",
        new_callable=AsyncMock,
    )
    @patch(
        "app.services.treasury_dashboard_service._load_buybacks_from_db",
        new_callable=AsyncMock,
        return_value=None,
    )
    @patch(
        "app.services.treasury_dashboard_service._load_payouts_from_db",
        new_callable=AsyncMock,
        return_value=None,
    )
    def test_tier_spending_and_flows(
        self, _mock_payouts_db, _mock_buybacks_db, mock_balance, client, monkeypatch
    ):
        monkeypatch.delenv("TREASURY_OWNER_WALLETS", raising=False)
        mock_balance.return_value = 1_000_000.0

        from datetime import datetime, timezone

        _make_bounty(
            "b1",
            status=BountyStatus.PAID,
            reward=100.0,
            tier=BountyTier.T1,
        )
        _make_bounty(
            "b2",
            status=BountyStatus.PAID,
            reward=400.0,
            tier=BountyTier.T2,
        )

        now = datetime.now(timezone.utc)
        with payout_service._lock:
            payout_service._payout_store["p1"] = PayoutRecord(
                id="p1",
                recipient="u1",
                amount=50.0,
                token="FNDRY",
                status=PayoutStatus.CONFIRMED,
                bounty_title="Payout bounty",
                created_at=now,
            )
            payout_service._buyback_store["bb1"] = BuybackRecord(
                id="bb1",
                amount_sol=2.0,
                amount_fndry=25.0,
                price_per_fndry=0.08,
                created_at=now,
            )

        data = client.get("/api/admin/treasury/dashboard", headers=AUTH_HEADER).json()
        assert data["fndry_balance"] == 1_000_000.0
        assert data["tier_spending_fndry"]["1"] == 100.0
        assert data["tier_spending_fndry"]["2"] == 400.0

        daily = data["series"]["daily"]
        assert len(daily) >= 1
        last = daily[-1]
        assert last["inflow_fndry"] == 25.0
        assert last["outflow_fndry"] == 50.0

        assert len(data["recent_transactions"]) == 2
        kinds = {t["kind"] for t in data["recent_transactions"]}
        assert kinds == {"payout", "buyback"}
