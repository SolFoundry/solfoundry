"""Tests for Payout, Treasury, and Tokenomics API endpoints."""
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.payout_service import reset_stores
from app.services.treasury_service import CACHE_TTL, _cache, invalidate_cache

client = TestClient(app)
TX1, TX2, TX3, TX4 = chr(52)*88, chr(53)*88, chr(54)*88, chr(55)*88
WALLET = chr(65)*44

@pytest.fixture(autouse=True)
def _clean(): reset_stores(); invalidate_cache(); yield; reset_stores(); invalidate_cache()

def test_empty_payouts():
    r = client.get("/api/payouts"); assert r.json()["total"] == 0

def test_create_payout():
    r = client.post("/api/payouts", json={"recipient": "alice", "recipient_wallet": WALLET, "amount": 500.0, "token": "FNDRY", "bounty_id": "b-123", "bounty_title": "Fix bug", "tx_hash": TX1})
    assert r.status_code == 201 and r.json()["status"] == "confirmed" and r.json()["solscan_url"] == f"https://solscan.io/tx/{TX1}"

def test_pending_without_tx():
    r = client.post("/api/payouts", json={"recipient": "bob", "amount": 100.0})
    assert r.status_code == 201 and r.json()["status"] == "pending" and r.json()["tx_hash"] is None

def test_pagination():
    for i in range(5): client.post("/api/payouts", json={"recipient": f"u{i}", "amount": float(100*(i+1)), "tx_hash": chr(ord("A")+i)*88})
    assert len(client.get("/api/payouts?skip=0&limit=2").json()["items"]) == 2
    assert client.get("/api/payouts?skip=0&limit=2").json()["total"] == 5

def test_filter_recipient():
    client.post("/api/payouts", json={"recipient": "alice", "amount": 100.0, "tx_hash": TX1})
    client.post("/api/payouts", json={"recipient": "bob", "amount": 200.0, "tx_hash": TX2})
    assert client.get("/api/payouts?recipient=alice").json()["total"] == 1

def test_filter_status():
    client.post("/api/payouts", json={"recipient": "a", "amount": 100.0, "tx_hash": TX1})
    client.post("/api/payouts", json={"recipient": "b", "amount": 200.0})
    assert client.get("/api/payouts?status=confirmed").json()["total"] == 1
    assert client.get("/api/payouts?status=pending").json()["total"] == 1

def test_get_by_tx():
    client.post("/api/payouts", json={"recipient": "alice", "amount": 750.0, "tx_hash": TX1})
    assert client.get(f"/api/payouts/{TX1}").json()["tx_hash"] == TX1

def test_get_tx_not_found():
    assert client.get(f"/api/payouts/{TX2}").status_code == 404

@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_treasury_stats(mock_bal):
    mock_bal.return_value = (12.5, 500000.0)
    client.post("/api/payouts", json={"recipient": "a", "amount": 1000.0, "token": "FNDRY", "tx_hash": TX1})
    client.post("/api/payouts", json={"recipient": "b", "amount": 500.0, "token": "FNDRY", "tx_hash": TX2})
    client.post("/api/payouts", json={"recipient": "c", "amount": 2.0, "token": "SOL", "tx_hash": TX3})
    client.post("/api/treasury/buybacks", json={"amount_sol": 5.0, "amount_fndry": 10000.0, "price_per_fndry": 0.0005, "tx_hash": TX4})
    d = client.get("/api/treasury").json()
    assert d["sol_balance"] == 12.5 and d["fndry_balance"] == 500000.0
    assert d["total_paid_out_fndry"] == 1500.0 and d["total_payouts"] == 3

@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_treasury_rpc_fail(mock_bal):
    mock_bal.side_effect = Exception("timeout")
    d = client.get("/api/treasury").json()
    assert d["sol_balance"] == 0.0 and d["fndry_balance"] == 0.0

@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_treasury_cache(mock_bal):
    mock_bal.return_value = (10.0, 100000.0)
    client.get("/api/treasury"); client.get("/api/treasury")
    assert mock_bal.call_count == 1

def test_buybacks_crud():
    assert client.get("/api/treasury/buybacks").json()["total"] == 0
    r = client.post("/api/treasury/buybacks", json={"amount_sol": 10.0, "amount_fndry": 20000.0, "price_per_fndry": 0.0005, "tx_hash": TX1})
    assert r.status_code == 201 and r.json()["solscan_url"] == f"https://solscan.io/tx/{TX1}"

@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_tokenomics(mock_bal):
    """circulating_supply = total_supply - treasury_holdings (not just paid out)"""
    mock_bal.return_value = (50.0, 250000.0)
    client.post("/api/payouts", json={"recipient": "a", "amount": 5000.0, "token": "FNDRY", "tx_hash": TX1})
    client.post("/api/treasury/buybacks", json={"amount_sol": 2.0, "amount_fndry": 4000.0, "price_per_fndry": 0.0005})
    d = client.get("/api/tokenomics").json()
    assert d["token_name"] == "FNDRY" and d["total_supply"] == 1_000_000_000.0
    assert d["circulating_supply"] == 1_000_000_000.0 - 250000.0  # supply minus treasury
    assert d["treasury_holdings"] == 250000.0

@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_tokenomics_empty(mock_bal):
    mock_bal.return_value = (0.0, 0.0)
    d = client.get("/api/tokenomics").json()
    assert d["circulating_supply"] == 1_000_000_000.0  # all supply circulating when treasury is 0

class TestValidation:
    def test_missing_recipient(self): assert client.post("/api/payouts", json={"amount": 100.0}).status_code == 422
    def test_zero_amount(self): assert client.post("/api/payouts", json={"recipient": "a", "amount": 0}).status_code == 422
    def test_negative_amount(self): assert client.post("/api/payouts", json={"recipient": "a", "amount": -50.0}).status_code == 422
    def test_invalid_token(self): assert client.post("/api/payouts", json={"recipient": "a", "amount": 1.0, "token": "BTC"}).status_code == 422
    def test_invalid_wallet(self): assert client.post("/api/payouts", json={"recipient": "a", "amount": 1.0, "recipient_wallet": "0xinvalid"}).status_code == 422
    def test_invalid_tx_path(self): assert client.get("/api/payouts/not-valid!").status_code == 400
    def test_dup_tx(self):
        p = {"recipient": "a", "amount": 1.0, "tx_hash": TX1}
        assert client.post("/api/payouts", json=p).status_code == 201
        assert client.post("/api/payouts", json=p).status_code == 409
    def test_limit_over_100(self): assert client.get("/api/payouts?limit=101").status_code == 422

class TestPendingNotCounted:
    @patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
    def test_pending_excluded(self, mock_bal):
        mock_bal.return_value = (10.0, 100000.0)
        client.post("/api/payouts", json={"recipient": "a", "amount": 500.0, "token": "FNDRY", "tx_hash": TX1})
        client.post("/api/payouts", json={"recipient": "b", "amount": 300.0, "token": "FNDRY"})
        d = client.get("/api/treasury").json()
        assert d["total_paid_out_fndry"] == 500.0 and d["total_payouts"] == 1
