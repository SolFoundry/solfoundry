"""Unit tests for the /health endpoint (Issue #343).

Covers four scenarios:
- All services healthy
- Database down
- Redis down
- Both down
"""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI

from app.api.health import router as health_router

# Minimal test app
_test_app = FastAPI()
_test_app.include_router(health_router)


@pytest.mark.asyncio
async def test_health_all_services_up():
    """Returns 'healthy' when DB and Redis are both reachable."""
    with (
        patch("app.api.health._check_database", new=AsyncMock(return_value="connected")),
        patch("app.api.health._check_redis", new=AsyncMock(return_value="connected")),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=_test_app), base_url="http://test"
        ) as client:
            resp = await client.get("/health")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["version"] == "1.0.0"
    assert isinstance(data["uptime_seconds"], int)
    assert "timestamp" in data
    assert data["services"]["database"] == "connected"
    assert data["services"]["redis"] == "connected"


@pytest.mark.asyncio
async def test_health_database_down():
    """Returns 'degraded' and marks database as 'disconnected' when DB is unreachable."""
    with (
        patch("app.api.health._check_database", new=AsyncMock(return_value="disconnected")),
        patch("app.api.health._check_redis", new=AsyncMock(return_value="connected")),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=_test_app), base_url="http://test"
        ) as client:
            resp = await client.get("/health")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"] == "disconnected"
    assert data["services"]["redis"] == "connected"


@pytest.mark.asyncio
async def test_health_redis_down():
    """Returns 'degraded' and marks redis as 'disconnected' when Redis is unreachable."""
    with (
        patch("app.api.health._check_database", new=AsyncMock(return_value="connected")),
        patch("app.api.health._check_redis", new=AsyncMock(return_value="disconnected")),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=_test_app), base_url="http://test"
        ) as client:
            resp = await client.get("/health")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"] == "connected"
    assert data["services"]["redis"] == "disconnected"


@pytest.mark.asyncio
async def test_health_both_services_down():
    """Returns 'degraded' with both services 'disconnected'."""
    with (
        patch("app.api.health._check_database", new=AsyncMock(return_value="disconnected")),
        patch("app.api.health._check_redis", new=AsyncMock(return_value="disconnected")),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=_test_app), base_url="http://test"
        ) as client:
            resp = await client.get("/health")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"] == "disconnected"
    assert data["services"]["redis"] == "disconnected"
