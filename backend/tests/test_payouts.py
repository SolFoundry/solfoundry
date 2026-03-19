"""Tests for the Payout & Treasury API."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.payout import Payout, PayoutStatus
from app.services.payout_service import add_payout, reset_stores

client = TestClient(app)


def _seed_payout(
    recipient: str = "alice",
    amount: float = 500.0,
    bounty_id: str = "bounty-1",
    tx_hash: str = "tx_abc123",
    status: PayoutStatus = PayoutStatus.completed,
) -> Payout:
    payout = Payout(
        recipient=recipient,
        amount=amount,
        bounty_id=bounty_id,
        tx_hash=tx_hash,
        timestamp=datetime.now(timezone.utc),
        status=status,
    )
    return add_payout(payout)


@pytest.fixture(autouse=True)
def _clean():
    """Reset stores before every test."""
    reset_stores()
    yield
    reset_stores()


# ── Payout history tests ─────────────────────────────────────────────────


def test_empty_payouts():
    resp = client.get("/api/payouts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_list_payouts():
    _seed_payout(tx_hash="tx_1", amount=100.0)
    _seed_payout(tx_hash="tx_2", amount=200.0)

    resp = client.get("/api/payouts")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


def test_payouts_pagination_limit():
    for i in range(5):
        _seed_payout(tx_hash=f"tx_{i}", amount=float(100 * (i + 1)))

    resp = client.get("/api/payouts?limit=2&skip=0")
    data = resp.json()
    assert data["total"] == 5
    assert len(data["items"]) == 2
    assert data["limit"] == 2
    assert data["skip"] == 0


def test_payouts_pagination_offset():
    for i in range(5):
        _seed_payout(tx_hash=f"tx_{i}", amount=float(100 * (i + 1)))

    resp = client.get("/api/payouts?limit=2&skip=3")
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["skip"] == 3


def test_payouts_beyond_total():
    _seed_payout(tx_hash="tx_only", amount=100.0)

    resp = client.get("/api/payouts?limit=10&skip=5")
    data = resp.json()
    assert data["total"] == 1
    assert len(data["items"]) == 0


def test_payouts_newest_first():
    older = Payout(
        recipient="a", amount=100.0, bounty_id="b1",
        tx_hash="tx_old", timestamp=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    newer = Payout(
        recipient="b", amount=200.0, bounty_id="b2",
        tx_hash="tx_new", timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    add_payout(older)
    add_payout(newer)

    resp = client.get("/api/payouts")
    items = resp.json()["items"]
    assert items[0]["tx_hash"] == "tx_new"
    assert items[1]["tx_hash"] == "tx_old"


# ── Single payout detail tests ───────────────────────────────────────────


def test_payout_detail_found():
    _seed_payout(tx_hash="tx_abc123", amount=500.0)

    resp = client.get("/api/payouts/tx_abc123")
    assert resp.status_code == 200
    data = resp.json()
    assert data["tx_hash"] == "tx_abc123"
    assert data["amount"] == 500.0
    assert data["recipient"] == "alice"


def test_payout_detail_not_found():
    resp = client.get("/api/payouts/nonexistent")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Payout not found"


def test_payout_detail_includes_metadata():
    payout = Payout(
        recipient="bob", amount=1000.0, bounty_id="b3",
        tx_hash="tx_meta", timestamp=datetime.now(timezone.utc),
        metadata={"reason": "bug fix"},
    )
    add_payout(payout)

    resp = client.get("/api/payouts/tx_meta")
    assert resp.json()["metadata"]["reason"] == "bug fix"


# ── Treasury tests ───────────────────────────────────────────────────────


def test_treasury_default():
    resp = client.get("/api/treasury")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_paid"] == 0.0
    assert data["token_supply"] == 1_000_000.0
    assert "last_updated" in data


def test_treasury_updates_on_completed_payout():
    _seed_payout(amount=500.0, status=PayoutStatus.completed)

    resp = client.get("/api/treasury")
    assert resp.json()["total_paid"] == 500.0


def test_treasury_ignores_pending_payout():
    _seed_payout(amount=300.0, status=PayoutStatus.pending)

    resp = client.get("/api/treasury")
    assert resp.json()["total_paid"] == 0.0


def test_treasury_ignores_failed_payout():
    _seed_payout(amount=200.0, status=PayoutStatus.failed)

    resp = client.get("/api/treasury")
    assert resp.json()["total_paid"] == 0.0


def test_treasury_accumulates():
    _seed_payout(tx_hash="tx_1", amount=500.0, status=PayoutStatus.completed)
    _seed_payout(tx_hash="tx_2", amount=300.0, status=PayoutStatus.completed)

    resp = client.get("/api/treasury")
    assert resp.json()["total_paid"] == 800.0
