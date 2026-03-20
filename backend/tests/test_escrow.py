"""Tests for $FNDRY custodial escrow API."""
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.escrow_service import reset_stores

client = TestClient(app)
W_A, W_B, W_C = "A" * 44, "B" * 44, "C" * 44
TX1, TX2, TX3 = chr(52) * 88, chr(53) * 88, chr(54) * 88


@pytest.fixture(autouse=True)
def _clean():
    reset_stores()
    yield
    reset_stores()


def _fund(bid="b1", w=None, amt=10000.0, tx=None, exp=None):
    p = {"bounty_id": bid, "creator_wallet": w or W_A, "amount": amt, "tx_hash": tx or TX1}
    if exp:
        p["expires_at"] = exp
    return client.post("/api/escrow/fund", json=p)


def test_fund_and_duplicates():
    """Fund creates FUNDED escrow; duplicates return 409."""
    r = _fund()
    assert r.status_code == 201 and r.json()["state"] == "funded"
    assert r.json()["solscan_fund_url"] == f"https://solscan.io/tx/{TX1}"
    assert _fund(bid="b1", tx=TX2).status_code == 409  # dup bounty
    assert _fund(bid="b2", tx=TX1).status_code == 409  # dup tx


def test_fund_expiry_and_reuse():
    """Expiry stored; re-fund after refund succeeds."""
    exp = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    assert _fund(bid="e", exp=exp).json()["expires_at"] is not None
    _fund(bid="r", tx=TX2)
    client.post("/api/escrow/r/refund")
    assert _fund(bid="r", tx=TX3).status_code == 201


def test_get_status():
    """GET returns escrow; 404 for missing; shows refunded state."""
    _fund(bid="s")
    assert client.get("/api/escrow/s").status_code == 200
    assert client.get("/api/escrow/x").status_code == 404
    _fund(bid="g", tx=TX2)
    client.post("/api/escrow/g/refund")
    assert client.get("/api/escrow/g").json()["state"] == "refunded"


def test_activate():
    """FUNDED->ACTIVE; double-activate and missing return 404."""
    _fund(bid="a")
    assert client.post("/api/escrow/a/activate").json()["state"] == "active"
    assert client.post("/api/escrow/a/activate").status_code == 404
    assert client.post("/api/escrow/x/activate").status_code == 404


def test_release():
    """ACTIVE->RELEASING; FUNDED returns 409; missing returns 404."""
    _fund(bid="r")
    client.post("/api/escrow/r/activate")
    r = client.post("/api/escrow/r/release", json={"winner_wallet": W_B})
    assert r.json()["state"] == "releasing" and r.json()["winner_wallet"] == W_B
    _fund(bid="f", tx=TX2)
    assert client.post("/api/escrow/f/release", json={"winner_wallet": W_B}).status_code == 409
    assert client.post("/api/escrow/x/release", json={"winner_wallet": W_B}).status_code == 404


def test_confirm():
    """RELEASING->COMPLETED; not-releasing=404; dup tx=409."""
    _fund(bid="c")
    client.post("/api/escrow/c/activate")
    client.post("/api/escrow/c/release", json={"winner_wallet": W_B})
    d = client.post(f"/api/escrow/c/confirm?tx_hash={TX2}").json()
    assert d["state"] == "completed" and d["release_tx_hash"] == TX2
    assert d["solscan_release_url"] == f"https://solscan.io/tx/{TX2}"
    _fund(bid="c2", tx=TX3)
    client.post("/api/escrow/c2/activate")
    assert client.post(f"/api/escrow/c2/confirm?tx_hash={TX2}").status_code == 404
    client.post("/api/escrow/c2/release", json={"winner_wallet": W_C})
    assert client.post(f"/api/escrow/c2/confirm?tx_hash={TX2}").status_code == 409


def test_refund_all_states():
    """Refund from FUNDED/ACTIVE/RELEASING; fail from COMPLETED and double."""
    _fund(bid="f1")
    assert client.post("/api/escrow/f1/refund").json()["state"] == "refunded"
    _fund(bid="f2", tx=TX2)
    client.post("/api/escrow/f2/activate")
    assert client.post("/api/escrow/f2/refund").json()["state"] == "refunded"
    _fund(bid="f3", tx=TX3)
    client.post("/api/escrow/f3/activate")
    client.post("/api/escrow/f3/release", json={"winner_wallet": W_B})
    assert client.post("/api/escrow/f3/refund").json()["state"] == "refunded"


def test_refund_terminal():
    """Completed/refunded/missing all return 404."""
    _fund(bid="rc")
    client.post("/api/escrow/rc/activate")
    client.post("/api/escrow/rc/release", json={"winner_wallet": W_B})
    client.post(f"/api/escrow/rc/confirm?tx_hash={TX2}")
    assert client.post("/api/escrow/rc/refund").status_code == 404
    _fund(bid="dr", tx=TX3)
    client.post("/api/escrow/dr/refund")
    assert client.post("/api/escrow/dr/refund").status_code == 404
    assert client.post("/api/escrow/x/refund").status_code == 404


def test_expiration():
    """Expired auto-refund; future skipped; empty returns []."""
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    _fund(bid="e1", tx=TX1, exp=past)
    _fund(bid="e2", tx=TX2, exp=future)
    r = client.post("/api/escrow/expire-check").json()
    assert len(r) == 1 and r[0]["state"] == "refunded"


def test_list_filter_paginate():
    """List, filter by wallet/state, pagination."""
    assert client.get("/api/escrow/").json()["total"] == 0
    _fund(bid="l1", w=W_A, tx=TX1)
    _fund(bid="l2", w=W_B, tx=TX2)
    assert client.get("/api/escrow/").json()["total"] == 2
    assert client.get(f"/api/escrow/?creator_wallet={W_A}").json()["total"] == 1
    client.post("/api/escrow/l1/activate")
    assert client.get("/api/escrow/?state=active").json()["total"] == 1
    for i in range(3):
        _fund(bid=f"p{i}", tx=chr(ord("D") + i) * 88)
    p = client.get("/api/escrow/?skip=0&limit=2").json()
    assert len(p["items"]) == 2 and p["total"] == 5


def test_ledger():
    """Fund=1 entry; full lifecycle=4 entries; missing=404."""
    _fund(bid="lg")
    assert len(client.get("/api/escrow/lg/ledger").json()) == 1
    client.post("/api/escrow/lg/activate")
    client.post("/api/escrow/lg/release", json={"winner_wallet": W_B})
    client.post(f"/api/escrow/lg/confirm?tx_hash={TX2}")
    assert len(client.get("/api/escrow/lg/ledger").json()) == 4
    assert client.get("/api/escrow/x/ledger").status_code == 404


def test_total_escrowed():
    """Counts active; excludes completed/refunded."""
    assert client.get("/api/escrow/stats/total-escrowed").json()["total_escrowed_fndry"] == 0.0
    _fund(bid="t1", amt=10000.0, tx=TX1)
    _fund(bid="t2", amt=5000.0, tx=TX2)
    assert client.get("/api/escrow/stats/total-escrowed").json()["total_escrowed_fndry"] == 15000.0
    client.post("/api/escrow/t1/refund")
    assert client.get("/api/escrow/stats/total-escrowed").json()["total_escrowed_fndry"] == 5000.0


def test_validation():
    """Missing fields, bad amounts, invalid wallets/tx all return 422."""
    assert client.post("/api/escrow/fund", json={"creator_wallet": W_A, "amount": 1, "tx_hash": TX1}).status_code == 422
    assert _fund(bid="v", amt=0).status_code == 422
    assert _fund(bid="v", amt=-1).status_code == 422
    assert _fund(bid="v", amt=2e8).status_code == 422
    assert client.post("/api/escrow/fund", json={"bounty_id": "v", "creator_wallet": "0x", "amount": 1, "tx_hash": TX1}).status_code == 422
    assert client.post("/api/escrow/fund", json={"bounty_id": "v", "creator_wallet": W_A, "amount": 1, "tx_hash": "!"}).status_code == 422
    _fund(bid="vw")
    client.post("/api/escrow/vw/activate")
    assert client.post("/api/escrow/vw/release", json={"winner_wallet": "0x"}).status_code == 422
    assert client.get("/api/escrow/?limit=101").status_code == 422
    assert client.get("/api/escrow/?skip=-1").status_code == 422


def test_full_lifecycle():
    """Fund->activate->release->confirm: complete happy path."""
    assert _fund(bid="life").json()["state"] == "funded"
    assert client.post("/api/escrow/life/activate").json()["state"] == "active"
    assert client.post("/api/escrow/life/release", json={"winner_wallet": W_B}).json()["state"] == "releasing"
    d = client.post(f"/api/escrow/life/confirm?tx_hash={TX2}").json()
    assert d["state"] == "completed" and d["winner_wallet"] == W_B
    assert client.get("/api/escrow/life").json()["state"] == "completed"
