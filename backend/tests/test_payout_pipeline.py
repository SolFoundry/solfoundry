"""Tests for the automated payout pipeline, admin approval, and wallet validation."""

from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.payout_service import acquire_payout_lock, release_payout_lock, reset_stores
from app.services.treasury_service import invalidate_cache

client = TestClient(app)
TX1 = chr(52) * 88
WALLET = chr(65) * 44
APPROVE = "/api/payouts/approve"


@pytest.fixture(autouse=True)
def _clean():
    """Reset stores and cache."""
    reset_stores()
    invalidate_cache()
    yield
    reset_stores()
    invalidate_cache()


def _pending(recipient="alice", wallet=WALLET, bounty_id="b-1"):
    """Create a pending payout."""
    r = client.post("/api/payouts", json={
        "recipient": recipient, "recipient_wallet": wallet, "amount": 500.0, "bounty_id": bounty_id})
    assert r.status_code == 201
    return r.json()


def _approve(payout_id):
    """Approve a payout."""
    client.post(APPROVE, json={"payout_id": payout_id, "approved": True, "admin_id": "admin"})


def test_pipeline_status():
    """Pipeline status counts pending and confirmed payouts."""
    _pending(bounty_id="b1")
    client.post("/api/payouts", json={"recipient": "b", "amount": 100.0, "tx_hash": TX1})
    d = client.get("/api/payouts/pipeline/status").json()
    assert d["pending_count"] == 1 and d["confirmed_count"] == 1 and d["total_pending_amount"] == 500.0


def test_approve_payout():
    """Approving sets admin_approved=True."""
    p = _pending()
    r = client.post(APPROVE, json={"payout_id": p["id"], "approved": True, "admin_id": "admin"})
    assert r.json()["admin_approved"] is True and r.json()["approved_by"] == "admin"


def test_reject_payout():
    """Rejecting sets status=failed with reason."""
    p = _pending()
    r = client.post(APPROVE, json={"payout_id": p["id"], "approved": False, "admin_id": "admin", "reason": "Suspicious"})
    assert r.json()["status"] == "failed" and r.json()["failure_reason"] == "Suspicious"


def test_approve_nonexistent():
    """Approving non-existent payout returns 400."""
    assert client.post(APPROVE, json={"payout_id": "x", "approved": True, "admin_id": "a"}).status_code == 400


def test_wallet_valid():
    """Valid base-58 wallet passes validation."""
    assert client.get(f"/api/payouts/validate-wallet/{WALLET}").json()["is_valid"] is True


def test_wallet_invalid():
    """Non-base58 address and program addresses are rejected."""
    assert client.get("/api/payouts/validate-wallet/0xinvalid").json()["is_valid"] is False
    d = client.get("/api/payouts/validate-wallet/11111111111111111111111111111111").json()
    assert d["is_valid"] is False and d["is_program_address"] is True


def test_payout_lock():
    """Double-lock fails; release allows reacquire."""
    assert acquire_payout_lock("b-1") is True
    assert acquire_payout_lock("b-1") is False
    release_payout_lock("b-1")
    assert acquire_payout_lock("b-1") is True


@patch("app.services.payout_pipeline.send_spl_token_transfer", new_callable=AsyncMock)
@patch("app.services.payout_pipeline.confirm_transaction", new_callable=AsyncMock)
def test_process_confirmed(mock_confirm, mock_transfer):
    """Approved payout transitions to confirmed with Solscan URL."""
    mock_transfer.return_value = "a" * 64
    mock_confirm.return_value = True
    p = _pending()
    _approve(p["id"])
    r = client.post(f"/api/payouts/{p['id']}/process")
    assert r.json()["status"] == "confirmed" and r.json()["solscan_url"] == f"https://solscan.io/tx/{'a' * 64}"


@patch("app.services.payout_pipeline.send_spl_token_transfer", new_callable=AsyncMock)
def test_process_transfer_fail(mock_transfer):
    """Failed transfer results in failed status."""
    mock_transfer.return_value = None
    p = _pending()
    _approve(p["id"])
    assert client.post(f"/api/payouts/{p['id']}/process").json()["status"] == "failed"


def test_process_unapproved():
    """Processing unapproved payout returns 400."""
    assert client.post(f"/api/payouts/{_pending()['id']}/process").status_code == 400


def test_process_nonexistent():
    """Processing non-existent payout returns 404."""
    assert client.post("/api/payouts/nonexistent/process").status_code == 404


@patch("app.services.payout_pipeline.send_spl_token_transfer", new_callable=AsyncMock)
@patch("app.services.payout_pipeline.confirm_transaction", new_callable=AsyncMock)
def test_process_no_wallet(mock_c, mock_t):
    """Payout without wallet fails gracefully."""
    r = client.post("/api/payouts", json={"recipient": "a", "amount": 100.0, "bounty_id": "b-1"})
    _approve(r.json()["id"])
    assert client.post(f"/api/payouts/{r.json()['id']}/process").json()["status"] == "failed"


@patch("app.services.payout_pipeline.send_spl_token_transfer", new_callable=AsyncMock)
def test_retry(mock_t):
    """Retrying a failed payout resets to pending; retrying pending fails."""
    mock_t.return_value = None
    p = _pending()
    _approve(p["id"])
    client.post(f"/api/payouts/{p['id']}/process")
    assert client.post(f"/api/payouts/{p['id']}/retry").json()["status"] == "pending"
    assert client.post(f"/api/payouts/{_pending(bounty_id='b2')['id']}/retry").status_code == 400


@patch("app.services.payout_pipeline.send_spl_token_transfer", new_callable=AsyncMock)
@patch("app.services.payout_pipeline.confirm_transaction", new_callable=AsyncMock)
def test_process_queue(mock_c, mock_t):
    """Queue processes approved payouts; empty queue returns []."""
    assert client.post("/api/payouts/process-queue").json() == []
    mock_t.return_value = "b" * 64
    mock_c.return_value = True
    p1, p2 = _pending(recipient="a", bounty_id="b1"), _pending(recipient="b", bounty_id="b2")
    _approve(p1["id"])
    _approve(p2["id"])
    results = client.post("/api/payouts/process-queue").json()
    assert len(results) == 2 and all(r["status"] == "confirmed" for r in results)


def test_filter_by_bounty_id():
    """Filter payouts by bounty_id."""
    _pending(recipient="a", bounty_id="b-100")
    _pending(recipient="b", bounty_id="b-200")
    assert client.get("/api/payouts?bounty_id=b-100").json()["total"] == 1
