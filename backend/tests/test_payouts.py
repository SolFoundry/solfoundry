"""Tests for the automated payout pipeline (Closes #167).

Covers the full payout lifecycle: creation, admin approval, on-chain
execution, transaction confirmation, wallet validation, treasury stats,
tokenomics, buybacks, date-range filtering, retry tracking, and
double-pay prevention.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.admin import _resolve_role
from app.services.payout_service import reset_stores
from app.services.treasury_service import invalidate_cache

client = TestClient(app)

@pytest.fixture(autouse=True)
def override_admin_auth():
    """Mock admin authentication for all tests in this file."""
    app.dependency_overrides[_resolve_role] = lambda: ("test_admin", "admin")
    yield
    app.dependency_overrides.pop(_resolve_role, None)


# Deterministic test fixtures for base-58-like transaction hashes (88 chars)
TX1: str = chr(52) * 88
TX2: str = chr(53) * 88
TX3: str = chr(54) * 88
TX4: str = chr(55) * 88

# Valid base-58 wallet address (44 chars of 'A')
WALLET: str = chr(65) * 44


@pytest.fixture(autouse=True)
def _clean():
    """Reset in-memory stores and cache before and after every test."""
    reset_stores()
    invalidate_cache()
    yield
    reset_stores()
    invalidate_cache()


# =========================================================================
# Basic CRUD
# =========================================================================


def test_empty_payouts():
    """GET /payouts returns zero items when the store is empty."""
    response = client.get("/api/payouts")
    assert response.json()["total"] == 0


def test_create_payout():
    """POST /payouts with tx_hash sets status=confirmed and generates solscan_url."""
    response = client.post(
        "/api/payouts",
        json={
            "recipient": "alice",
            "recipient_wallet": WALLET,
            "amount": 500.0,
            "token": "FNDRY",
            "bounty_id": "b-123",
            "bounty_title": "Fix bug",
            "tx_hash": TX1,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "confirmed"
    assert data["solscan_url"] == f"https://solscan.io/tx/{TX1}"
    assert data["recipient"] == "alice"
    assert data["amount"] == 500.0


def test_pending_without_tx():
    """POST /payouts without tx_hash sets status=pending."""
    response = client.post("/api/payouts", json={"recipient": "bob", "amount": 100.0})
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["tx_hash"] is None


def test_create_sol_payout():
    """POST /payouts with token=SOL is accepted."""
    response = client.post(
        "/api/payouts",
        json={
            "recipient": "carol",
            "amount": 1.5,
            "token": "SOL",
            "tx_hash": TX1,
        },
    )
    assert response.status_code == 201
    assert response.json()["token"] == "SOL"


def test_payout_has_updated_at():
    """Payout response includes updated_at timestamp."""
    response = client.post("/api/payouts", json={"recipient": "dave", "amount": 50.0})
    data = response.json()
    assert "updated_at" in data
    assert data["updated_at"] is not None


def test_payout_has_retry_count():
    """Payout response includes retry_count field (initially 0)."""
    response = client.post("/api/payouts", json={"recipient": "eve", "amount": 75.0})
    data = response.json()
    assert data["retry_count"] == 0


# =========================================================================
# Pagination & filtering
# =========================================================================


def test_pagination():
    """Pagination returns correct page size while total reflects all records."""
    for i in range(5):
        client.post(
            "/api/payouts",
            json={
                "recipient": f"user{i}",
                "amount": float(100 * (i + 1)),
                "tx_hash": chr(ord("A") + i) * 88,
            },
        )
    page = client.get("/api/payouts?skip=0&limit=2").json()
    assert len(page["items"]) == 2
    assert page["total"] == 5


def test_pagination_skip_past_end():
    """Skipping past all records returns an empty page."""
    client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 1.0, "tx_hash": TX1},
    )
    page = client.get("/api/payouts?skip=100&limit=10").json()
    assert len(page["items"]) == 0
    assert page["total"] == 1


def test_filter_recipient():
    """Filter by recipient returns only matching payouts."""
    client.post(
        "/api/payouts",
        json={"recipient": "alice", "amount": 100.0, "tx_hash": TX1},
    )
    client.post(
        "/api/payouts",
        json={"recipient": "bob", "amount": 200.0, "tx_hash": TX2},
    )
    assert client.get("/api/payouts?recipient=alice").json()["total"] == 1


def test_filter_status():
    """Filter by status correctly separates confirmed/pending payouts."""
    client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 100.0, "tx_hash": TX1},
    )
    client.post("/api/payouts", json={"recipient": "b", "amount": 200.0})
    assert client.get("/api/payouts?status=confirmed").json()["total"] == 1
    assert client.get("/api/payouts?status=pending").json()["total"] == 1


def test_filter_combined():
    """Filters can be combined (recipient + status)."""
    client.post(
        "/api/payouts",
        json={"recipient": "alice", "amount": 100.0, "tx_hash": TX1},
    )
    client.post("/api/payouts", json={"recipient": "alice", "amount": 50.0})
    client.post(
        "/api/payouts",
        json={"recipient": "bob", "amount": 200.0, "tx_hash": TX2},
    )
    page = client.get("/api/payouts?recipient=alice&status=confirmed").json()
    assert page["total"] == 1


def test_filter_by_bounty_id():
    """Filter by bounty_id returns only matching payouts."""
    client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 100.0, "bounty_id": "b-1", "tx_hash": TX1},
    )
    client.post(
        "/api/payouts",
        json={"recipient": "b", "amount": 200.0, "bounty_id": "b-2", "tx_hash": TX2},
    )
    assert client.get("/api/payouts?bounty_id=b-1").json()["total"] == 1


def test_filter_by_token():
    """Filter by token returns only matching payouts."""
    client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 100.0, "token": "FNDRY", "tx_hash": TX1},
    )
    client.post(
        "/api/payouts",
        json={"recipient": "b", "amount": 1.0, "token": "SOL", "tx_hash": TX2},
    )
    assert client.get("/api/payouts?token=FNDRY").json()["total"] == 1


def test_filter_by_date_range():
    """Filter by start_date and end_date narrows results by created_at."""
    client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 100.0, "tx_hash": TX1},
    )
    # Query with a future start_date should return zero results
    # Use 'Z' suffix instead of '+00:00' to avoid URL-encoding issues with '+'
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    result = client.get(f"/api/payouts?start_date={future}").json()
    assert result["total"] == 0

    # Query with a past start_date should return the record
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    result = client.get(f"/api/payouts?start_date={past}").json()
    assert result["total"] == 1


def test_filter_by_end_date():
    """Filter by end_date excludes payouts created after the cutoff."""
    client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 100.0, "tx_hash": TX1},
    )
    # end_date in the past should exclude the record
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    result = client.get(f"/api/payouts?end_date={past}").json()
    assert result["total"] == 0

    # end_date in the future should include the record
    future = (datetime.now(timezone.utc) + timedelta(hours=1)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    result = client.get(f"/api/payouts?end_date={future}").json()
    assert result["total"] == 1


# =========================================================================
# Lookup by tx_hash
# =========================================================================


def test_get_by_tx():
    """GET /payouts/{tx_hash} returns the matching payout."""
    client.post(
        "/api/payouts",
        json={"recipient": "alice", "amount": 750.0, "tx_hash": TX1},
    )
    assert client.get(f"/api/payouts/{TX1}").json()["tx_hash"] == TX1


def test_get_tx_not_found():
    """GET /payouts/{tx_hash} returns 404 for unknown hashes."""
    assert client.get(f"/api/payouts/{TX2}").status_code == 404


def test_get_tx_hex_hash_accepted():
    """GET /payouts/{tx_hash} accepts 64-char hex hashes (relaxed regex)."""
    hex_hash = "a" * 64
    response = client.get(f"/api/payouts/{hex_hash}")
    # Should be 404 (not found) rather than 400 (bad format)
    assert response.status_code == 404


# =========================================================================
# Treasury stats
# =========================================================================


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_treasury_stats(mock_balances):
    """Treasury endpoint aggregates balances, payouts, and buybacks."""
    mock_balances.return_value = (12.5, 500000.0)
    client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 1000.0, "token": "FNDRY", "tx_hash": TX1},
    )
    client.post(
        "/api/payouts",
        json={"recipient": "b", "amount": 500.0, "token": "FNDRY", "tx_hash": TX2},
    )
    client.post(
        "/api/payouts",
        json={"recipient": "c", "amount": 2.0, "token": "SOL", "tx_hash": TX3},
    )
    client.post(
        "/api/payouts/treasury/buybacks",
        json={
            "amount_sol": 5.0,
            "amount_fndry": 10000.0,
            "price_per_fndry": 0.0005,
            "tx_hash": TX4,
        },
    )
    data = client.get("/api/payouts/treasury").json()
    assert data["sol_balance"] == 12.5 and data["fndry_balance"] == 500000.0
    assert data["total_paid_out_fndry"] == 1500.0
    assert data["total_payouts"] == 3


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_treasury_rpc_fail(mock_balances):
    """Treasury endpoint returns zero balances when RPC is unreachable."""
    mock_balances.side_effect = Exception("timeout")
    data = client.get("/api/payouts/treasury").json()
    assert data["sol_balance"] == 0.0 and data["fndry_balance"] == 0.0


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_treasury_cache(mock_balances):
    """Repeated treasury requests within TTL hit the cache, not RPC."""
    mock_balances.return_value = (10.0, 100000.0)
    client.get("/api/payouts/treasury")
    client.get("/api/payouts/treasury")
    assert mock_balances.call_count == 1


# =========================================================================
# Buybacks
# =========================================================================


def test_buybacks_crud():
    """POST/GET buyback CRUD round-trip with solscan_url."""
    assert client.get("/api/payouts/treasury/buybacks").json()["total"] == 0
    response = client.post(
        "/api/payouts/treasury/buybacks",
        json={
            "amount_sol": 10.0,
            "amount_fndry": 20000.0,
            "price_per_fndry": 0.0005,
            "tx_hash": TX1,
        },
    )
    assert response.status_code == 201
    assert response.json()["solscan_url"] == f"https://solscan.io/tx/{TX1}"


def test_buyback_without_tx():
    """Buyback without tx_hash still succeeds (off-chain record)."""
    response = client.post(
        "/api/payouts/treasury/buybacks",
        json={
            "amount_sol": 1.0,
            "amount_fndry": 2000.0,
            "price_per_fndry": 0.0005,
        },
    )
    assert response.status_code == 201
    assert response.json()["tx_hash"] is None


def test_buyback_dup_tx():
    """Duplicate buyback tx_hash returns 409."""
    payload = {
        "amount_sol": 1.0,
        "amount_fndry": 2000.0,
        "price_per_fndry": 0.0005,
        "tx_hash": TX1,
    }
    assert (
        client.post("/api/payouts/treasury/buybacks", json=payload).status_code == 201
    )
    assert (
        client.post("/api/payouts/treasury/buybacks", json=payload).status_code == 409
    )


# =========================================================================
# Tokenomics
# =========================================================================


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_tokenomics(mock_balances):
    """circulating_supply = total_supply - treasury_holdings (not paid out)."""
    mock_balances.return_value = (50.0, 250000.0)
    client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 5000.0, "token": "FNDRY", "tx_hash": TX1},
    )
    client.post(
        "/api/payouts/treasury/buybacks",
        json={
            "amount_sol": 2.0,
            "amount_fndry": 4000.0,
            "price_per_fndry": 0.0005,
        },
    )
    data = client.get("/api/payouts/tokenomics").json()
    assert data["token_name"] == "FNDRY"
    assert data["total_supply"] == 1_000_000_000.0
    assert data["circulating_supply"] == 1_000_000_000.0 - 250000.0
    assert data["treasury_holdings"] == 250000.0
    assert data["total_distributed"] == 5000.0
    assert data["total_buybacks"] == 4000.0


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_tokenomics_circulating_not_paid_out(mock_balances):
    """Circulating supply must differ from total paid out when treasury != 0."""
    mock_balances.return_value = (10.0, 900_000_000.0)
    client.post(
        "/api/payouts",
        json={"recipient": "x", "amount": 100.0, "token": "FNDRY", "tx_hash": TX1},
    )
    data = client.get("/api/payouts/tokenomics").json()
    # Circulating should be 100M (1B - 900M treasury), NOT 100 (paid out).
    assert data["circulating_supply"] == 100_000_000.0
    assert data["total_distributed"] == 100.0


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_tokenomics_empty(mock_balances):
    """When treasury holds nothing, all supply is circulating."""
    mock_balances.return_value = (0.0, 0.0)
    data = client.get("/api/payouts/tokenomics").json()
    assert data["circulating_supply"] == 1_000_000_000.0


@patch("app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock)
def test_tokenomics_distribution_breakdown(mock_balances):
    """Distribution breakdown keys match expected categories."""
    mock_balances.return_value = (5.0, 400_000.0)
    client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 1000.0, "tx_hash": TX1},
    )
    data = client.get("/api/payouts/tokenomics").json()
    breakdown = data["distribution_breakdown"]
    assert set(breakdown.keys()) == {
        "contributor_rewards",
        "treasury_reserve",
        "buybacks",
        "burned",
    }
    assert breakdown["contributor_rewards"] == 1000.0
    assert breakdown["treasury_reserve"] == 400_000.0


# =========================================================================
# Validation
# =========================================================================


class TestValidation:
    """Input validation edge cases."""

    def test_missing_recipient(self):
        """Omitting required recipient field returns 422."""
        assert client.post("/api/payouts", json={"amount": 100.0}).status_code == 422

    def test_zero_amount(self):
        """Zero amount is rejected (must be > 0)."""
        assert (
            client.post(
                "/api/payouts", json={"recipient": "a", "amount": 0}
            ).status_code
            == 422
        )

    def test_negative_amount(self):
        """Negative amount is rejected."""
        assert (
            client.post(
                "/api/payouts", json={"recipient": "a", "amount": -50.0}
            ).status_code
            == 422
        )

    def test_invalid_token(self):
        """Only FNDRY and SOL tokens are accepted."""
        assert (
            client.post(
                "/api/payouts",
                json={"recipient": "a", "amount": 1.0, "token": "BTC"},
            ).status_code
            == 422
        )

    def test_invalid_wallet(self):
        """Non-base58 wallet addresses are rejected."""
        assert (
            client.post(
                "/api/payouts",
                json={"recipient": "a", "amount": 1.0, "recipient_wallet": "0xinvalid"},
            ).status_code
            == 422
        )

    def test_invalid_tx_path(self):
        """Path tx_hash with special characters returns 400."""
        assert client.get("/api/payouts/not-valid!").status_code == 400

    def test_dup_tx(self):
        """Duplicate payout tx_hash returns 409 Conflict."""
        payload = {"recipient": "a", "amount": 1.0, "tx_hash": TX1}
        assert client.post("/api/payouts", json=payload).status_code == 201
        assert client.post("/api/payouts", json=payload).status_code == 409

    def test_limit_over_100(self):
        """Limit > 100 is rejected by query validation."""
        assert client.get("/api/payouts?limit=101").status_code == 422

    def test_negative_skip(self):
        """Negative skip is rejected."""
        assert client.get("/api/payouts?skip=-1").status_code == 422

    def test_long_bounty_title(self):
        """Bounty title over 200 chars is rejected."""
        assert (
            client.post(
                "/api/payouts",
                json={
                    "recipient": "a",
                    "amount": 1.0,
                    "bounty_title": "x" * 201,
                },
            ).status_code
            == 422
        )


# =========================================================================
# Pending payouts excluded from totals
# =========================================================================


class TestPendingNotCounted:
    """Pending payouts must not affect treasury totals."""

    @patch(
        "app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock
    )
    def test_pending_excluded_from_paid_out(self, mock_balances):
        """Only confirmed payouts count toward total_paid_out_fndry."""
        mock_balances.return_value = (10.0, 100000.0)
        client.post(
            "/api/payouts",
            json={"recipient": "a", "amount": 500.0, "token": "FNDRY", "tx_hash": TX1},
        )
        client.post(
            "/api/payouts",
            json={"recipient": "b", "amount": 300.0, "token": "FNDRY"},
        )
        data = client.get("/api/payouts/treasury").json()
        assert data["total_paid_out_fndry"] == 500.0
        assert data["total_payouts"] == 1

    @patch(
        "app.services.treasury_service.get_treasury_balances", new_callable=AsyncMock
    )
    def test_pending_excluded_from_tokenomics(self, mock_balances):
        """Pending payouts do not inflate total_distributed in tokenomics."""
        mock_balances.return_value = (5.0, 999_000.0)
        client.post(
            "/api/payouts",
            json={"recipient": "a", "amount": 1000.0, "token": "FNDRY", "tx_hash": TX1},
        )
        client.post(
            "/api/payouts",
            json={"recipient": "b", "amount": 2000.0, "token": "FNDRY"},
        )
        data = client.get("/api/payouts/tokenomics").json()
        assert data["total_distributed"] == 1000.0  # only the confirmed one


# =========================================================================
# Double-pay prevention
# =========================================================================


class TestDoublePay:
    """Per-bounty lock mechanism prevents paying the same bounty twice."""

    def test_double_pay_blocked(self):
        """Second payout for the same bounty_id returns 409."""
        assert (
            client.post(
                "/api/payouts",
                json={
                    "recipient": "a",
                    "amount": 500.0,
                    "bounty_id": "b-42",
                    "tx_hash": TX1,
                },
            ).status_code
            == 201
        )
        response = client.post(
            "/api/payouts",
            json={
                "recipient": "b",
                "amount": 500.0,
                "bounty_id": "b-42",
                "tx_hash": TX2,
            },
        )
        assert response.status_code == 409
        assert "already has an active payout" in response.json()["message"]

    def test_different_bounties_ok(self):
        """Payouts to different bounty_ids are independent."""
        assert (
            client.post(
                "/api/payouts",
                json={
                    "recipient": "a",
                    "amount": 500.0,
                    "bounty_id": "b-1",
                    "tx_hash": TX1,
                },
            ).status_code
            == 201
        )
        assert (
            client.post(
                "/api/payouts",
                json={
                    "recipient": "b",
                    "amount": 300.0,
                    "bounty_id": "b-2",
                    "tx_hash": TX2,
                },
            ).status_code
            == 201
        )

    def test_failed_bounty_allows_retry(self):
        """A failed payout for a bounty does not block a new payout attempt.

        This ensures that the double-pay check ignores FAILED payouts,
        allowing re-submission after a transfer failure.
        """
        # Create and reject first payout for bounty b-99
        payout_id = client.post(
            "/api/payouts",
            json={"recipient": "a", "amount": 500.0, "bounty_id": "b-99"},
        ).json()["id"]
        client.post(
            f"/api/payouts/{payout_id}/approve",
            json={"approved": False, "admin_id": "admin-1", "reason": "Wrong amount"},
        )
        # Now a new payout for the same bounty should succeed
        response = client.post(
            "/api/payouts",
            json={"recipient": "a", "amount": 500.0, "bounty_id": "b-99"},
        )
        assert response.status_code == 201


# =========================================================================
# Admin approval gate
# =========================================================================


class TestAdminApproval:
    """Admin approval and rejection of pending payouts."""

    def test_approve(self):
        """Approving a pending payout transitions to 'approved'."""
        payout_id = client.post(
            "/api/payouts", json={"recipient": "a", "amount": 500.0}
        ).json()["id"]
        response = client.post(
            f"/api/payouts/{payout_id}/approve",
            json={"approved": True, "admin_id": "admin-1"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "approved"

    def test_reject(self):
        """Rejecting a pending payout transitions to 'failed'."""
        payout_id = client.post(
            "/api/payouts", json={"recipient": "b", "amount": 300.0}
        ).json()["id"]
        response = client.post(
            f"/api/payouts/{payout_id}/approve",
            json={"approved": False, "admin_id": "admin-1", "reason": "Bad work"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "failed"

    def test_approve_non_pending_fails(self):
        """Approving an already-confirmed payout returns 409."""
        payout_id = client.post(
            "/api/payouts",
            json={"recipient": "c", "amount": 100.0, "tx_hash": TX1},
        ).json()["id"]
        assert (
            client.post(
                f"/api/payouts/{payout_id}/approve",
                json={"approved": True, "admin_id": "a"},
            ).status_code
            == 409
        )

    def test_approve_nonexistent(self):
        """Approving a non-existent payout returns 404."""
        assert (
            client.post(
                "/api/payouts/bad-id/approve",
                json={"approved": True, "admin_id": "a"},
            ).status_code
            == 404
        )

    def test_rejection_stores_reason(self):
        """Rejected payout stores the failure reason in the record."""
        payout_id = client.post(
            "/api/payouts", json={"recipient": "d", "amount": 200.0}
        ).json()["id"]
        client.post(
            f"/api/payouts/{payout_id}/approve",
            json={
                "approved": False,
                "admin_id": "admin-2",
                "reason": "Spam submission",
            },
        )
        payout = client.get(f"/api/payouts/id/{payout_id}").json()
        assert payout["failure_reason"] == "Spam submission"


# =========================================================================
# Payout queue lifecycle (pending -> approved -> confirmed/failed)
# =========================================================================


class TestPayoutExecution:
    """End-to-end: pending -> approved -> confirmed/failed."""

    @patch("app.services.payout_service.confirm_transaction", new_callable=AsyncMock)
    @patch("app.services.payout_service.send_spl_transfer", new_callable=AsyncMock)
    def test_full_lifecycle(self, mock_transfer, mock_confirm):
        """Payout goes pending -> approved -> processing -> confirmed."""
        mock_transfer.return_value = "a" * 64
        mock_confirm.return_value = True

        payout_id = client.post(
            "/api/payouts",
            json={"recipient": "a", "amount": 500.0, "recipient_wallet": WALLET},
        ).json()["id"]

        client.post(
            f"/api/payouts/{payout_id}/approve",
            json={"approved": True, "admin_id": "admin-1"},
        )
        response = client.post(f"/api/payouts/{payout_id}/execute")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "confirmed"
        assert data["solscan_url"] == f"https://solscan.io/tx/{'a' * 64}"
        assert data["tx_hash"] == "a" * 64

    @patch("app.services.payout_service.send_spl_transfer", new_callable=AsyncMock)
    def test_transfer_failure(self, mock_transfer):
        """When transfer raises, payout moves to 'failed' with error details."""
        from app.exceptions import TransferError

        mock_transfer.side_effect = TransferError("RPC down", attempts=3)

        payout_id = client.post(
            "/api/payouts",
            json={"recipient": "b", "amount": 300.0, "recipient_wallet": WALLET},
        ).json()["id"]

        client.post(
            f"/api/payouts/{payout_id}/approve",
            json={"approved": True, "admin_id": "admin-1"},
        )
        response = client.post(f"/api/payouts/{payout_id}/execute")
        data = response.json()

        assert data["status"] == "failed"
        assert data["failure_reason"] is not None
        assert "RPC down" in data["failure_reason"]

    @patch("app.services.payout_service.send_spl_transfer", new_callable=AsyncMock)
    def test_transfer_failure_tracks_retry_count(self, mock_transfer):
        """Failed transfer records the number of retry attempts."""
        from app.exceptions import TransferError

        mock_transfer.side_effect = TransferError("Timeout", attempts=3)

        payout_id = client.post(
            "/api/payouts",
            json={"recipient": "c", "amount": 100.0, "recipient_wallet": WALLET},
        ).json()["id"]

        client.post(
            f"/api/payouts/{payout_id}/approve",
            json={"approved": True, "admin_id": "admin-1"},
        )
        response = client.post(f"/api/payouts/{payout_id}/execute")
        data = response.json()

        assert data["retry_count"] == 3

    def test_execute_unapproved(self):
        """Executing a pending payout returns 409 (must be approved first)."""
        payout_id = client.post(
            "/api/payouts", json={"recipient": "c", "amount": 100.0}
        ).json()["id"]
        assert client.post(f"/api/payouts/{payout_id}/execute").status_code == 409

    @patch("app.services.payout_service.confirm_transaction", new_callable=AsyncMock)
    @patch("app.services.payout_service.send_spl_transfer", new_callable=AsyncMock)
    def test_updated_at_changes_on_execution(self, mock_transfer, mock_confirm):
        """The updated_at timestamp advances through each state transition."""
        mock_transfer.return_value = "b" * 64
        mock_confirm.return_value = True

        create_response = client.post(
            "/api/payouts",
            json={"recipient": "d", "amount": 250.0, "recipient_wallet": WALLET},
        ).json()
        created_time = create_response["updated_at"]

        payout_id = create_response["id"]
        _approve_response = client.post(
            f"/api/payouts/{payout_id}/approve",
            json={"approved": True, "admin_id": "admin-1"},
        ).json()

        # After approval the payout's updated_at should be refreshed
        payout_after_approve = client.get(f"/api/payouts/id/{payout_id}").json()
        assert payout_after_approve["updated_at"] >= created_time

        execute_response = client.post(f"/api/payouts/{payout_id}/execute").json()
        assert execute_response["updated_at"] >= payout_after_approve["updated_at"]


# =========================================================================
# Wallet validation
# =========================================================================


class TestWalletValidation:
    """Wallet validation including program address rejection."""

    def test_valid(self):
        """Normal base-58 address passes validation."""
        response = client.post(
            "/api/payouts/validate-wallet",
            json={"wallet_address": WALLET},
        )
        assert response.json()["valid"] is True

    def test_invalid_format(self):
        """Non-base58 string is flagged invalid."""
        response = client.post(
            "/api/payouts/validate-wallet",
            json={"wallet_address": "0xinvalid"},
        )
        assert response.json()["valid"] is False

    def test_program_address_rejected(self):
        """Known program addresses are flagged as invalid."""
        response = client.post(
            "/api/payouts/validate-wallet",
            json={"wallet_address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"},
        )
        assert response.json()["valid"] is False
        assert response.json()["is_program_address"] is True

    def test_payout_rejects_program_wallet(self):
        """Creating payout with program address wallet returns 422."""
        response = client.post(
            "/api/payouts",
            json={
                "recipient": "a",
                "amount": 100.0,
                "recipient_wallet": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
            },
        )
        assert response.status_code == 422

    def test_system_program_rejected(self):
        """System program address (all 1s) is flagged as program address."""
        response = client.post(
            "/api/payouts/validate-wallet",
            json={"wallet_address": "11111111111111111111111111111111"},
        )
        assert response.json()["valid"] is False
        assert response.json()["is_program_address"] is True

    def test_short_address_rejected(self):
        """Address shorter than 32 chars is rejected."""
        response = client.post(
            "/api/payouts/validate-wallet",
            json={"wallet_address": "ABC123"},
        )
        assert response.json()["valid"] is False

    def test_too_long_address_rejected(self):
        """Address longer than 44 chars is rejected."""
        response = client.post(
            "/api/payouts/validate-wallet",
            json={"wallet_address": "A" * 50},
        )
        assert response.json()["valid"] is False


# =========================================================================
# Payout lookup by ID
# =========================================================================


def test_get_by_id():
    """GET /payouts/id/{payout_id} returns the matching payout."""
    payout_id = client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 500.0, "tx_hash": TX1},
    ).json()["id"]
    response = client.get(f"/api/payouts/id/{payout_id}")
    assert response.status_code == 200
    assert response.json()["id"] == payout_id


def test_get_by_id_not_found():
    """GET /payouts/id/{unknown} returns 404."""
    assert client.get("/api/payouts/id/nonexistent").status_code == 404


# =========================================================================
# Solscan link generation
# =========================================================================


def test_solscan_url_format():
    """Confirmed payouts have a valid Solscan URL following the expected format."""
    response = client.post(
        "/api/payouts",
        json={"recipient": "a", "amount": 100.0, "tx_hash": TX1},
    )
    data = response.json()
    assert data["solscan_url"].startswith("https://solscan.io/tx/")
    assert TX1 in data["solscan_url"]


def test_pending_payout_no_solscan():
    """Pending payouts without tx_hash have no Solscan URL."""
    response = client.post("/api/payouts", json={"recipient": "b", "amount": 50.0})
    assert response.json()["solscan_url"] is None
