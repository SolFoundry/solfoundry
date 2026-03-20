"""Tests for Payout, Treasury, and Tokenomics API endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.payout_service import reset_stores
from app.services.treasury_service import invalidate_cache

client = TestClient(app)
TX1, TX2, TX3, TX4 = chr(52) * 88, chr(53) * 88, chr(54) * 88, chr(55) * 88
WALLET = chr(65) * 44


@pytest.fixture(autouse=True)
def _clean():
    """Reset in-memory stores and cache before/after every test."""
    reset_stores()
    invalidate_cache()
    yield
    reset_stores()
    invalidate_cache()


# --- basic CRUD ---


def test_empty_payouts():
    """GET /payouts returns zero items when the store is empty."""
    r = client.get("/api/payouts")
    assert r.json()["total"] == 0


def test_create_payout():
    """POST /payouts with tx_hash sets status=confirmed and generates solscan_url."""
    r = client.post("/api/payouts", json={
        "recipient": "alice", "recipient_wallet": WALLET,
        "amount": 500.0, "token": "FNDRY",
        "bounty_id": "b-123", "bounty_title": "Fix bug", "tx_hash": TX1,
    })
    assert r.status_code == 201
    d = r.json()
    assert d["status"] == "confirmed"
    assert d["solscan_url"] == f"https://solscan.io/tx/{TX1}"


def test_pending_without_tx():
    """POST /payouts without tx_hash sets status=pending."""
    r = client.post("/api/payouts", json={"recipient": "bob", "amount": 100.0})
    assert r.status_code == 201
    d = r.json()
    assert d["status"] == "pending"
    assert d["tx_hash"] is None


def test_create_sol_payout():
    """POST /payouts with token=SOL is accepted."""
    r = client.post("/api/payouts", json={
        "recipient": "carol", "amount": 1.5, "token": "SOL", "tx_hash": TX1,
    })
    assert r.status_code == 201
    assert r.json()["token"] == "SOL"


# --- pagination & filtering ---


def test_pagination():
    """Pagination returns correct page size while total reflects all records."""
    for i in range(5):
        client.post("/api/payouts", json={
            "recipient": f"u{i}", "amount": float(100 * (i + 1)),
            "tx_hash": chr(ord("A") + i) * 88,
        })
    page = client.get("/api/payouts?skip=0&limit=2").json()
    assert len(page["items"]) == 2
    assert page["total"] == 5


def test_pagination_skip_past_end():
    """Skipping past all records returns an empty page."""
    client.post("/api/payouts", json={"recipient": "a", "amount": 1.0, "tx_hash": TX1})
    page = client.get("/api/payouts?skip=100&limit=10").json()
    assert len(page["items"]) == 0
    assert page["total"] == 1


def test_filter_recipient():
    """Filter by recipient returns only matching payouts."""
    client.post("/api/payouts", json={"recipient": "alice", "amount": 100.0, "tx_hash": TX1})
    client.post("/api/payouts", json={"recipient": "bob", "amount": 200.0, "tx_hash": TX2})
    assert client.get("/api/payouts?recipient=alice").json()["total"] == 1


def test_filter_status():
    """Filter by status correctly separates confirmed/pending payouts."""
    client.post("/api/payouts", json={"recipient": "a", "amount": 100.0, "tx_hash": TX1})
    client.post("/api/payouts", json={"recipient": "b", "amount": 200.0})
    assert client.get("/api/payouts?status=confirmed").json()["total"] == 1
    assert client.get("/api/payouts?status=pending").json()["total"] == 1


def test_filter_combined():
    """Filters can be combined (recipient + status)."""
    client.post("/api/payouts", json={"recipient": "alice", "amount": 100.0, "tx_hash": TX1})
    client.post("/api/payouts", json={"recipient": "alice", "amount": 50.0})
    client.post("/api/payouts", json={"recipient": "bob", "amount": 200.0, "tx_hash": TX2})
    page = client.get("/api/payouts?recipient=alice&status=confirmed").json()
    assert page["total"] == 1


# --- lookup by tx_hash ---


def test_get_by_tx():
    """GET /payouts/{tx_hash} returns the matching payout."""
    client.post("/api/payouts", json={"recipient": "alice", "amount": 750.0, "tx_hash": TX1})
    assert client.get(f"/api/payouts/{TX1}").json()["tx_hash"] == TX1


def test_get_tx_not_found():
    """GET /payouts/{tx_hash} returns 404 for unknown hashes."""
    assert client.get(f"/api/payouts/{TX2}").status_code == 404


def test_get_tx_hex_hash_accepted():
    """GET /payouts/{tx_hash} accepts 64-char hex hashes (relaxed regex)."""
    hex_hash = "a" * 64
    r = client.get(f"/api/payouts/{hex_hash}")
    # Should be 404 (not found) rather than 400 (bad format)
    assert r.status_code == 404


# --- treasury stats ---


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_treasury_stats(mock_bal):
    """Treasury endpoint aggregates balances, payouts, and buybacks."""
    mock_bal.return_value = (12.5, 500000.0)
    client.post("/api/payouts", json={"recipient": "a", "amount": 1000.0, "token": "FNDRY", "tx_hash": TX1})
    client.post("/api/payouts", json={"recipient": "b", "amount": 500.0, "token": "FNDRY", "tx_hash": TX2})
    client.post("/api/payouts", json={"recipient": "c", "amount": 2.0, "token": "SOL", "tx_hash": TX3})
    client.post("/api/treasury/buybacks", json={
        "amount_sol": 5.0, "amount_fndry": 10000.0,
        "price_per_fndry": 0.0005, "tx_hash": TX4,
    })
    d = client.get("/api/treasury").json()
    assert d["sol_balance"] == 12.5 and d["fndry_balance"] == 500000.0
    assert d["total_paid_out_fndry"] == 1500.0
    assert d["total_payouts"] == 3


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_treasury_rpc_fail(mock_bal):
    """Treasury endpoint returns zero balances when RPC is unreachable."""
    mock_bal.side_effect = Exception("timeout")
    d = client.get("/api/treasury").json()
    assert d["sol_balance"] == 0.0 and d["fndry_balance"] == 0.0


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_treasury_cache(mock_bal):
    """Repeated treasury requests within TTL hit the cache, not RPC."""
    mock_bal.return_value = (10.0, 100000.0)
    client.get("/api/treasury")
    client.get("/api/treasury")
    assert mock_bal.call_count == 1


# --- buybacks ---


def test_buybacks_crud():
    """POST/GET buyback CRUD round-trip with solscan_url."""
    assert client.get("/api/treasury/buybacks").json()["total"] == 0
    r = client.post("/api/treasury/buybacks", json={
        "amount_sol": 10.0, "amount_fndry": 20000.0,
        "price_per_fndry": 0.0005, "tx_hash": TX1,
    })
    assert r.status_code == 201
    assert r.json()["solscan_url"] == f"https://solscan.io/tx/{TX1}"


def test_buyback_without_tx():
    """Buyback without tx_hash still succeeds (off-chain record)."""
    r = client.post("/api/treasury/buybacks", json={
        "amount_sol": 1.0, "amount_fndry": 2000.0, "price_per_fndry": 0.0005,
    })
    assert r.status_code == 201
    assert r.json()["tx_hash"] is None


def test_buyback_dup_tx():
    """Duplicate buyback tx_hash returns 409."""
    payload = {"amount_sol": 1.0, "amount_fndry": 2000.0, "price_per_fndry": 0.0005, "tx_hash": TX1}
    assert client.post("/api/treasury/buybacks", json=payload).status_code == 201
    assert client.post("/api/treasury/buybacks", json=payload).status_code == 409


# --- tokenomics ---


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_tokenomics(mock_bal):
    """circulating_supply = total_supply - treasury_holdings (not paid out)."""
    mock_bal.return_value = (50.0, 250000.0)
    client.post("/api/payouts", json={"recipient": "a", "amount": 5000.0, "token": "FNDRY", "tx_hash": TX1})
    client.post("/api/treasury/buybacks", json={
        "amount_sol": 2.0, "amount_fndry": 4000.0, "price_per_fndry": 0.0005,
    })
    d = client.get("/api/tokenomics").json()
    assert d["token_name"] == "FNDRY"
    assert d["total_supply"] == 1_000_000_000.0
    assert d["circulating_supply"] == 1_000_000_000.0 - 250000.0
    assert d["treasury_holdings"] == 250000.0
    assert d["total_distributed"] == 5000.0
    assert d["total_buybacks"] == 4000.0


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_tokenomics_circulating_not_paid_out(mock_bal):
    """Circulating supply must differ from total paid out when treasury != 0."""
    mock_bal.return_value = (10.0, 900_000_000.0)
    client.post("/api/payouts", json={"recipient": "x", "amount": 100.0, "token": "FNDRY", "tx_hash": TX1})
    d = client.get("/api/tokenomics").json()
    # Circulating should be 100M (1B - 900M treasury), NOT 100 (paid out).
    assert d["circulating_supply"] == 100_000_000.0
    assert d["total_distributed"] == 100.0


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_tokenomics_empty(mock_bal):
    """When treasury holds nothing, all supply is circulating."""
    mock_bal.return_value = (0.0, 0.0)
    d = client.get("/api/tokenomics").json()
    assert d["circulating_supply"] == 1_000_000_000.0


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_tokenomics_distribution_breakdown(mock_bal):
    """Distribution breakdown keys match expected categories."""
    mock_bal.return_value = (5.0, 400_000.0)
    client.post("/api/payouts", json={"recipient": "a", "amount": 1000.0, "tx_hash": TX1})
    d = client.get("/api/tokenomics").json()
    bd = d["distribution_breakdown"]
    assert set(bd.keys()) == {"contributor_rewards", "treasury_reserve", "buybacks", "burned"}
    assert bd["contributor_rewards"] == 1000.0
    assert bd["treasury_reserve"] == 400_000.0


# --- validation ---


class TestValidation:
    """Input validation edge cases."""

    def test_missing_recipient(self):
        """Omitting required recipient field returns 422."""
        assert client.post("/api/payouts", json={"amount": 100.0}).status_code == 422

    def test_zero_amount(self):
        """Zero amount is rejected (must be > 0)."""
        assert client.post("/api/payouts", json={"recipient": "a", "amount": 0}).status_code == 422

    def test_negative_amount(self):
        """Negative amount is rejected."""
        assert client.post("/api/payouts", json={"recipient": "a", "amount": -50.0}).status_code == 422

    def test_invalid_token(self):
        """Only FNDRY and SOL tokens are accepted."""
        assert client.post("/api/payouts", json={"recipient": "a", "amount": 1.0, "token": "BTC"}).status_code == 422

    def test_invalid_wallet(self):
        """Non-base58 wallet addresses are rejected."""
        assert client.post("/api/payouts", json={"recipient": "a", "amount": 1.0, "recipient_wallet": "0xinvalid"}).status_code == 422

    def test_invalid_tx_path(self):
        """Path tx_hash with special characters returns 400."""
        assert client.get("/api/payouts/not-valid!").status_code == 400

    def test_dup_tx(self):
        """Duplicate payout tx_hash returns 409 Conflict."""
        p = {"recipient": "a", "amount": 1.0, "tx_hash": TX1}
        assert client.post("/api/payouts", json=p).status_code == 201
        assert client.post("/api/payouts", json=p).status_code == 409

    def test_limit_over_100(self):
        """Limit > 100 is rejected by query validation."""
        assert client.get("/api/payouts?limit=101").status_code == 422

    def test_negative_skip(self):
        """Negative skip is rejected."""
        assert client.get("/api/payouts?skip=-1").status_code == 422

    def test_long_bounty_title(self):
        """Bounty title over 200 chars is rejected."""
        assert client.post("/api/payouts", json={
            "recipient": "a", "amount": 1.0, "bounty_title": "x" * 201,
        }).status_code == 422


# --- pending payouts excluded from totals ---


class TestPendingNotCounted:
    """Pending payouts must not affect treasury totals."""

    @patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
    def test_pending_excluded_from_paid_out(self, mock_bal):
        """Only confirmed payouts count toward total_paid_out_fndry."""
        mock_bal.return_value = (10.0, 100000.0)
        client.post("/api/payouts", json={"recipient": "a", "amount": 500.0, "token": "FNDRY", "tx_hash": TX1})
        client.post("/api/payouts", json={"recipient": "b", "amount": 300.0, "token": "FNDRY"})
        d = client.get("/api/treasury").json()
        assert d["total_paid_out_fndry"] == 500.0
        assert d["total_payouts"] == 1

    @patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
    def test_pending_excluded_from_tokenomics(self, mock_bal):
        """Pending payouts do not inflate total_distributed in tokenomics."""
        mock_bal.return_value = (5.0, 999_000.0)
        client.post("/api/payouts", json={"recipient": "a", "amount": 1000.0, "token": "FNDRY", "tx_hash": TX1})
        client.post("/api/payouts", json={"recipient": "b", "amount": 2000.0, "token": "FNDRY"})
        d = client.get("/api/tokenomics").json()
        assert d["total_distributed"] == 1000.0  # only the confirmed one
