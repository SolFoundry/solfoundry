"""Tests for the on-chain data REST API endpoints.

All tests use the full FastAPI app over httpx.ASGITransport with:
- Mocked Redis (cache always misses by default, verifies writes)
- Mocked Solana RPC (get_sol_balance, get_token_balance)
- Mocked treasury_service.get_treasury_stats
- Mocked reputation_service.get_reputation / wallet lookup
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


def _make_reputation_summary() -> dict:
    return {
        "contributor_id": "alice",
        "username": "alice",
        "display_name": "Alice",
        "reputation_score": 42.5,
        "badge": None,
        "tier_progression": {
            "current_tier": "T1",
            "t1_completions": 5,
            "t2_completions": 0,
            "t3_completions": 0,
            "t1_required": 3,
            "t2_required": 5,
            "t3_required": 3,
            "next_tier": "T2",
            "progress_pct": 100.0,
        },
        "is_veteran": False,
        "total_bounties_completed": 5,
        "average_review_score": 8.1,
        "history": [],
    }


def _make_treasury_stats() -> dict:
    return {
        "sol_balance": 12.5,
        "fndry_balance": 500_000.0,
        "treasury_wallet": "AqqW7hFLau8oH8nDuZp5jPjM3EXUrD7q3SxbcNE8YTN1",
        "total_paid_out_fndry": 10_000.0,
        "total_paid_out_sol": 0.5,
        "total_payouts": 20,
        "total_buyback_amount": 1.0,
        "total_buybacks": 3,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Cache helpers used across tests
# ---------------------------------------------------------------------------


def _miss_cache() -> tuple[AsyncMock, AsyncMock]:
    """Return (cache_get, cache_set) mocks where get always misses."""
    get_mock = AsyncMock(return_value=None)
    set_mock = AsyncMock()
    return get_mock, set_mock


def _hit_cache(value) -> tuple[AsyncMock, AsyncMock]:
    """Return (cache_get, cache_set) mocks where get returns *value*."""
    get_mock = AsyncMock(return_value=value)
    set_mock = AsyncMock()
    return get_mock, set_mock


# ---------------------------------------------------------------------------
# GET /api/reputation/{wallet}
# ---------------------------------------------------------------------------


class TestReputationEndpoint:
    @pytest.mark.asyncio
    async def test_returns_404_when_no_contributor_for_wallet(self, client):
        with (
            patch("app.api.onchain.cache_get", AsyncMock(return_value=None)),
            patch("app.api.onchain.cache_set", AsyncMock()),
            patch(
                "app.api.onchain._get_reputation_by_wallet",
                AsyncMock(return_value=None),
            ),
        ):
            resp = await client.get("/api/reputation/UnknownWallet123")
            assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_reputation_from_rpc_on_cache_miss(self, client):
        from app.models.reputation import ReputationSummary

        summary = ReputationSummary.model_validate(_make_reputation_summary())
        get_mock, set_mock = _miss_cache()

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
            patch(
                "app.api.onchain._get_reputation_by_wallet",
                AsyncMock(return_value=summary),
            ),
        ):
            resp = await client.get("/api/reputation/ValidWallet1234")
            assert resp.status_code == 200
            data = resp.json()
            assert data["username"] == "alice"
            assert data["reputation_score"] == 42.5

    @pytest.mark.asyncio
    async def test_writes_to_cache_on_miss(self, client):
        from app.models.reputation import ReputationSummary

        summary = ReputationSummary.model_validate(_make_reputation_summary())
        get_mock, set_mock = _miss_cache()

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
            patch(
                "app.api.onchain._get_reputation_by_wallet",
                AsyncMock(return_value=summary),
            ),
        ):
            await client.get("/api/reputation/ValidWallet1234")
            set_mock.assert_awaited_once()
            args = set_mock.call_args[0]
            assert args[0] == "reputation"
            assert args[1] == "ValidWallet1234"

    @pytest.mark.asyncio
    async def test_returns_cached_value_without_rpc(self, client):
        cached = _make_reputation_summary()
        get_mock, set_mock = _hit_cache(cached)
        rpc_mock = AsyncMock()

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
            patch("app.api.onchain._get_reputation_by_wallet", rpc_mock),
        ):
            resp = await client.get("/api/reputation/CachedWallet1234")
            assert resp.status_code == 200
            rpc_mock.assert_not_awaited()
            set_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_pagination_skip_limit(self, client):
        summary_data = _make_reputation_summary()
        summary_data["history"] = [
            {
                "id": str(i),
                "contributor_id": "alice",
                "bounty_id": f"b{i}",
                "bounty_title": f"Bounty {i}",
                "bounty_tier": 1,
                "review_score": 8.0,
                "earned_reputation": 5.0,
                "is_veteran_penalty": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            for i in range(5)
        ]

        get_mock, set_mock = _hit_cache(summary_data)

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
        ):
            resp = await client.get("/api/reputation/SomeWallet123?skip=2&limit=2")
            assert resp.status_code == 200
            assert len(resp.json()["history"]) == 2


# ---------------------------------------------------------------------------
# GET /api/staking/{wallet}
# ---------------------------------------------------------------------------


class TestStakingEndpoint:
    @pytest.mark.asyncio
    async def test_returns_balances_from_rpc(self, client):
        get_mock, set_mock = _miss_cache()

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
            patch("app.api.onchain.get_sol_balance", AsyncMock(return_value=1.5)),
            patch(
                "app.api.onchain.get_token_balance", AsyncMock(return_value=25_000.0)
            ),
        ):
            resp = await client.get("/api/staking/DevWallet12345678")
            assert resp.status_code == 200
            data = resp.json()
            assert data["sol_balance"] == 1.5
            assert data["fndry_balance"] == 25_000.0
            assert data["cached"] is False

    @pytest.mark.asyncio
    async def test_returns_cached_balances(self, client):
        cached = {
            "wallet": "DevWallet12345678",
            "sol_balance": 2.0,
            "fndry_balance": 5_000.0,
        }
        get_mock, set_mock = _hit_cache(cached)

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
        ):
            resp = await client.get("/api/staking/DevWallet12345678")
            assert resp.status_code == 200
            assert resp.json()["cached"] is True
            assert resp.json()["sol_balance"] == 2.0

    @pytest.mark.asyncio
    async def test_writes_cache_on_rpc_hit(self, client):
        get_mock, set_mock = _miss_cache()

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
            patch("app.api.onchain.get_sol_balance", AsyncMock(return_value=0.0)),
            patch("app.api.onchain.get_token_balance", AsyncMock(return_value=0.0)),
        ):
            await client.get("/api/staking/ZeroWallet12345678")
            set_mock.assert_awaited_once()
            assert set_mock.call_args[0][0] == "staking"

    @pytest.mark.asyncio
    async def test_returns_502_on_rpc_error(self, client):
        from app.services.solana_client import SolanaRPCError

        get_mock, set_mock = _miss_cache()

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
            patch(
                "app.api.onchain.get_sol_balance",
                AsyncMock(side_effect=SolanaRPCError("node unavailable")),
            ),
        ):
            resp = await client.get("/api/staking/BadWallet123456")
            assert resp.status_code == 502


# ---------------------------------------------------------------------------
# GET /api/treasury/stats
# ---------------------------------------------------------------------------


class TestTreasuryStatsEndpoint:
    @pytest.mark.asyncio
    async def test_returns_stats_from_service(self, client):
        from app.models.payout import TreasuryStats

        stats = TreasuryStats.model_validate(_make_treasury_stats())
        get_mock, set_mock = _miss_cache()

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
            patch("app.api.onchain.get_treasury_stats", AsyncMock(return_value=stats)),
        ):
            resp = await client.get("/api/treasury/stats")
            assert resp.status_code == 200
            data = resp.json()
            assert data["sol_balance"] == 12.5
            assert data["total_payouts"] == 20

    @pytest.mark.asyncio
    async def test_serves_from_cache(self, client):
        cached = _make_treasury_stats()
        get_mock, set_mock = _hit_cache(cached)
        service_mock = AsyncMock()

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
            patch("app.api.onchain.get_treasury_stats", service_mock),
        ):
            resp = await client.get("/api/treasury/stats")
            assert resp.status_code == 200
            service_mock.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_returns_503_on_service_error(self, client):
        get_mock, set_mock = _miss_cache()

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
            patch(
                "app.api.onchain.get_treasury_stats",
                AsyncMock(side_effect=RuntimeError("RPC down")),
            ),
        ):
            resp = await client.get("/api/treasury/stats")
            assert resp.status_code == 503

    @pytest.mark.asyncio
    async def test_writes_cache_on_service_hit(self, client):
        from app.models.payout import TreasuryStats

        stats = TreasuryStats.model_validate(_make_treasury_stats())
        get_mock, set_mock = _miss_cache()

        with (
            patch("app.api.onchain.cache_get", get_mock),
            patch("app.api.onchain.cache_set", set_mock),
            patch("app.api.onchain.get_treasury_stats", AsyncMock(return_value=stats)),
        ):
            await client.get("/api/treasury/stats")
            set_mock.assert_awaited_once()
            assert set_mock.call_args[0] == ("treasury", "stats")


# ---------------------------------------------------------------------------
# POST /api/webhooks/helius
# ---------------------------------------------------------------------------


class TestHeliusWebhook:
    @pytest.mark.asyncio
    async def test_invalidates_staking_and_reputation_per_account(self, client):
        invalidate_mock = AsyncMock()
        prefix_mock = AsyncMock(return_value=1)

        with (
            patch("app.api.onchain.cache_invalidate", invalidate_mock),
            patch("app.api.onchain.cache_invalidate_prefix", prefix_mock),
            patch("app.api.onchain._HELIUS_WEBHOOK_SECRET", ""),
        ):
            resp = await client.post(
                "/api/webhooks/helius",
                json={"type": "TRANSFER", "accounts": ["walletA", "walletB"]},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["keys_removed"] == 3  # 2 accounts + 1 treasury prefix

    @pytest.mark.asyncio
    async def test_always_busts_treasury_cache(self, client):
        prefix_mock = AsyncMock(return_value=2)

        with (
            patch("app.api.onchain.cache_invalidate", AsyncMock()),
            patch("app.api.onchain.cache_invalidate_prefix", prefix_mock),
            patch("app.api.onchain._HELIUS_WEBHOOK_SECRET", ""),
        ):
            await client.post(
                "/api/webhooks/helius", json={"type": "SWAP", "accounts": []}
            )
            prefix_mock.assert_awaited_once_with("treasury")

    @pytest.mark.asyncio
    async def test_rejects_missing_signature_when_secret_set(self, client):
        with patch("app.api.onchain._HELIUS_WEBHOOK_SECRET", "supersecret"):
            resp = await client.post(
                "/api/webhooks/helius",
                json={"type": "TRANSFER", "accounts": []},
            )
            assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_rejects_invalid_signature(self, client):
        with patch("app.api.onchain._HELIUS_WEBHOOK_SECRET", "supersecret"):
            resp = await client.post(
                "/api/webhooks/helius",
                headers={"X-Helius-Signature": "badsig"},
                json={"type": "TRANSFER", "accounts": []},
            )
            assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_accepts_valid_signature(self, client):
        import hashlib
        import hmac

        secret = "supersecret"
        with (
            patch("app.api.onchain._HELIUS_WEBHOOK_SECRET", secret),
            patch("app.api.onchain.cache_invalidate", AsyncMock()),
            patch("app.api.onchain.cache_invalidate_prefix", AsyncMock(return_value=0)),
        ):
            # Build exact JSON that Pydantic will serialize
            from app.api.onchain import HeliusWebhookPayload

            body = HeliusWebhookPayload(type="TRANSFER", accounts=["wallet1"])
            correct_sig = hmac.new(
                secret.encode(),
                msg=body.model_dump_json().encode(),
                digestmod=hashlib.sha256,
            ).hexdigest()

            resp = await client.post(
                "/api/webhooks/helius",
                headers={"X-Helius-Signature": correct_sig},
                json={"type": "TRANSFER", "accounts": ["wallet1"]},
            )
            assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Escrow cache integration
# ---------------------------------------------------------------------------


class TestEscrowCaching:
    @pytest.mark.asyncio
    async def test_get_escrow_writes_cache_on_miss(self, client):
        from app.models.escrow import EscrowState, EscrowStatusResponse

        mock_status = EscrowStatusResponse(
            bounty_id="b1",
            state=EscrowState.ACTIVE,
            amount=1000.0,
            creator_wallet="creator",
            winner_wallet=None,
            expires_at=None,
            ledger=[],
        )

        set_mock = AsyncMock()

        with (
            patch("app.api.escrow.cache_get", AsyncMock(return_value=None)),
            patch("app.api.escrow.cache_set", set_mock),
            patch(
                "app.api.escrow.get_escrow_status",
                AsyncMock(return_value=mock_status),
            ),
        ):
            resp = await client.get("/api/escrow/b1")
            assert resp.status_code == 200
            set_mock.assert_awaited_once()
            assert set_mock.call_args[0][:2] == ("escrow", "b1")

    @pytest.mark.asyncio
    async def test_get_escrow_serves_from_cache(self, client):
        from app.models.escrow import EscrowState

        cached = {
            "bounty_id": "b1",
            "state": EscrowState.ACTIVE,
            "amount": 1000.0,
            "creator_wallet": "creator",
            "winner_wallet": None,
            "expires_at": None,
            "ledger": [],
        }
        service_mock = AsyncMock()

        with (
            patch("app.api.escrow.cache_get", AsyncMock(return_value=cached)),
            patch("app.api.escrow.get_escrow_status", service_mock),
        ):
            resp = await client.get("/api/escrow/b1")
            assert resp.status_code == 200
            service_mock.assert_not_awaited()
