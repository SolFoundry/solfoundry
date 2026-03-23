"""Tests for the on-chain data API endpoints (bounty #507).

Covers:
- Each endpoint returns correct JSON structure
- X-Cache: MISS on first call, HIT on second (with mocked Redis)
- Rate limiter returns 429 after 60 requests
- Pagination (skip/limit) on reputation history
- Graceful degradation when Redis is unavailable
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.api.onchain import router as onchain_router

# ── test app ───────────────────────────────────────────────────────────────────

app = FastAPI()
app.include_router(onchain_router)

client = TestClient(app)

# ── fixtures / helpers ─────────────────────────────────────────────────────────


def _make_redis_miss():
    """Redis mock that always returns cache miss."""
    r = AsyncMock()
    r.ping = AsyncMock(return_value=True)
    r.get = AsyncMock(return_value=None)
    r.setex = AsyncMock(return_value=True)
    r.aclose = AsyncMock()
    return r


def _make_redis_hit(payload: dict):
    """Redis mock that returns a cache hit with given payload."""
    r = AsyncMock()
    r.ping = AsyncMock(return_value=True)
    r.get = AsyncMock(return_value=json.dumps(payload, default=str))
    r.setex = AsyncMock(return_value=True)
    r.aclose = AsyncMock()
    return r


def _make_redis_rate(count: int):
    """Redis mock for rate limiter that returns given call count."""
    pipe = MagicMock()
    pipe.zremrangebyscore = MagicMock(return_value=pipe)
    pipe.zadd = MagicMock(return_value=pipe)
    pipe.zcard = MagicMock(return_value=pipe)
    pipe.expire = MagicMock(return_value=pipe)
    pipe.execute = AsyncMock(return_value=[0, 1, count, True])

    r = AsyncMock()
    r.ping = AsyncMock(return_value=True)
    r.get = AsyncMock(return_value=None)
    r.setex = AsyncMock(return_value=True)
    r.pipeline = MagicMock(return_value=pipe)
    r.aclose = AsyncMock()
    return r


# ── /onchain/staking/{wallet} ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_staking_returns_correct_structure():
    """GET /onchain/staking/{wallet} returns expected fields."""
    redis_mock = _make_redis_miss()
    with patch(
        "app.api.onchain._get_redis", new_callable=AsyncMock, return_value=redis_mock
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get(
                "/onchain/staking/9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
            )
    assert resp.status_code == 200
    data = resp.json()
    assert "wallet" in data
    assert "staked_amount" in data
    assert "pending_rewards" in data
    assert "cooldown_ends_at" in data
    assert "apy_estimate" in data
    assert "status" in data
    assert data["status"] in ("active", "cooldown", "unstaked")


@pytest.mark.asyncio
async def test_staking_cache_miss_then_hit():
    """First call is MISS, second call with hit mock is HIT."""
    wallet = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"
    miss_redis = _make_redis_miss()

    with patch(
        "app.api.onchain._get_redis", new_callable=AsyncMock, return_value=miss_redis
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get(f"/onchain/staking/{wallet}")
    assert resp.headers.get("x-cache") == "MISS"

    payload = resp.json()
    hit_redis = _make_redis_hit(payload)
    with patch(
        "app.api.onchain._get_redis", new_callable=AsyncMock, return_value=hit_redis
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp2 = await ac.get(f"/onchain/staking/{wallet}")
    assert resp2.headers.get("x-cache") == "HIT"


# ── /onchain/treasury/stats ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_treasury_stats_structure():
    """GET /onchain/treasury/stats returns treasury fields."""
    from pydantic import BaseModel

    class FakeTreasuryStats(BaseModel):
        treasury_balance: float = 1_000_000.0
        total_paid_out: float = 250_000.0
        total_bounties: int = 42
        circulating_supply: float = 5_000_000.0

    redis_mock = _make_redis_miss()
    with (
        patch(
            "app.api.onchain._get_redis",
            new_callable=AsyncMock,
            return_value=redis_mock,
        ),
        patch(
            "app.services.treasury_service.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=FakeTreasuryStats(),
        ),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/onchain/treasury/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "treasury_balance" in data
    assert "total_paid_out" in data
    assert "active_escrows" in data
    assert "total_staked" in data
    assert data["treasury_balance"] == 1_000_000.0


@pytest.mark.asyncio
async def test_treasury_stats_cache_miss_header():
    """Treasury stats returns X-Cache: MISS on first call."""
    from pydantic import BaseModel

    class FakeTreasuryStats(BaseModel):
        treasury_balance: float = 0
        total_paid_out: float = 0
        total_bounties: int = 0
        circulating_supply: float = 0

    redis_mock = _make_redis_miss()
    with (
        patch(
            "app.api.onchain._get_redis",
            new_callable=AsyncMock,
            return_value=redis_mock,
        ),
        patch(
            "app.services.treasury_service.get_treasury_stats",
            new_callable=AsyncMock,
            return_value=FakeTreasuryStats(),
        ),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/onchain/treasury/stats")
    assert resp.headers.get("x-cache") == "MISS"


# ── /onchain/escrow/{bounty_id} ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_escrow_not_found_returns_404():
    """Unknown bounty_id raises 404."""
    redis_mock = _make_redis_miss()
    with (
        patch(
            "app.api.onchain._get_redis",
            new_callable=AsyncMock,
            return_value=redis_mock,
        ),
        patch(
            "app.services.escrow_service.get_escrow_status",
            new_callable=AsyncMock,
            side_effect=Exception("not found"),
        ),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/onchain/escrow/nonexistent-bounty")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_escrow_cache_hit():
    """GET /onchain/escrow/{id} returns X-Cache: HIT from Redis."""
    payload = {
        "bounty_id": "test-bounty",
        "state": "FUNDED",
        "amount": 5000.0,
        "creator_wallet": "wallet123",
        "winner_wallet": None,
        "funded_at": None,
        "expires_at": None,
        "participants": ["wallet123"],
        "source": "cached",
    }
    hit_redis = _make_redis_hit(payload)
    with patch(
        "app.api.onchain._get_redis", new_callable=AsyncMock, return_value=hit_redis
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/onchain/escrow/test-bounty")
    assert resp.status_code == 200
    assert resp.headers.get("x-cache") == "HIT"
    assert resp.json()["state"] == "FUNDED"


# ── /onchain/reputation/{wallet} ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reputation_not_found_returns_404():
    """Unknown wallet raises 404."""
    redis_mock = _make_redis_miss()
    with (
        patch(
            "app.api.onchain._get_redis",
            new_callable=AsyncMock,
            return_value=redis_mock,
        ),
        patch(
            "app.services.reputation_service.get_reputation",
            new_callable=AsyncMock,
            return_value=None,
        ),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/onchain/reputation/unknown-wallet")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_reputation_pagination():
    """skip/limit params are applied to history."""

    class FakeEntry:
        bounty_id = "b1"
        earned_reputation = 10.0
        review_score = 7.5
        tier = 1
        created_at = "2026-01-01"

    class FakeSummary:
        reputation_score = 100.0
        tier_progression = {}
        badge = None
        total_bounties_completed = 5
        average_review_score = 7.0
        is_veteran = False
        history = [FakeEntry() for _ in range(20)]

    redis_mock = _make_redis_miss()
    with (
        patch(
            "app.api.onchain._get_redis",
            new_callable=AsyncMock,
            return_value=redis_mock,
        ),
        patch(
            "app.services.reputation_service.get_reputation",
            new_callable=AsyncMock,
            return_value=FakeSummary(),
        ),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/onchain/reputation/wallet-xyz?skip=5&limit=3")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["history"]) == 3
    assert data["total_history"] == 20


# ── Rate limiter ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rate_limiter_blocks_at_61():
    """61st request in a window returns HTTP 429."""
    redis_mock = _make_redis_rate(61)
    with patch(
        "app.api.onchain._get_redis", new_callable=AsyncMock, return_value=redis_mock
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/onchain/staking/some-wallet")
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers


@pytest.mark.asyncio
async def test_rate_limiter_allows_at_60():
    """Exactly 60 requests in a window is allowed."""
    redis_rate = _make_redis_rate(60)
    # Also need cache to return miss and service call to work
    with (
        patch(
            "app.api.onchain._get_redis",
            new_callable=AsyncMock,
            return_value=redis_rate,
        ),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/onchain/staking/some-wallet")
    # Should not be 429 (may be 200 or other depending on service)
    assert resp.status_code != 429


# ── Redis unavailable (graceful degradation) ───────────────────────────────────


@pytest.mark.asyncio
async def test_graceful_degradation_when_redis_down():
    """When Redis is unavailable, requests still succeed (no caching)."""
    with patch("app.api.onchain._get_redis", new_callable=AsyncMock, return_value=None):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            resp = await ac.get("/onchain/staking/some-wallet")
    # Should succeed even without Redis
    assert resp.status_code == 200
    assert resp.headers.get("x-cache") == "MISS"
