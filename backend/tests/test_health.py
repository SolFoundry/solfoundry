"""Unit tests for the /health endpoint (Issue #343).

Covers healthy, degraded, and bot-compatibility scenarios.
"""

from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI
from app.api.health import router as health_router

# Create a dedicated test app instance
app = FastAPI()
app.include_router(health_router)

@pytest.mark.asyncio
async def test_health_all_services_up():
    """Returns 'healthy' when DB and Redis are both reachable."""
    with (
        patch("app.api.health._check_database", new=AsyncMock(return_value="connected")),
        patch("app.api.health._check_redis", new=AsyncMock(return_value="connected")),
        patch("app.services.github_sync.get_last_sync", return_value=None),
        patch("app.services.bounty_service._bounty_store", []),
        patch("app.services.contributor_service._store", {}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"]["database"] == "connected"
    assert data["services"]["redis"] == "connected"
    assert data["database_legacy"] == "ok"
    assert "uptime_seconds" in data
    assert "timestamp" in data
    assert "version" in data

@pytest.mark.asyncio
async def test_health_check_db_down():
    """Returns 'degraded' when database is disconnected."""
    with (
        patch("app.api.health._check_database", new=AsyncMock(return_value="disconnected")),
        patch("app.api.health._check_redis", new=AsyncMock(return_value="connected")),
        patch("app.services.github_sync.get_last_sync", return_value=None),
        patch("app.services.bounty_service._bounty_store", []),
        patch("app.services.contributor_service._store", {}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"] == "disconnected"
    assert data["database_legacy"] == "error"

@pytest.mark.asyncio
async def test_health_check_redis_down():
    """Returns 'degraded' when redis is disconnected."""
    with (
        patch("app.api.health._check_database", new=AsyncMock(return_value="connected")),
        patch("app.api.health._check_redis", new=AsyncMock(return_value="disconnected")),
        patch("app.services.github_sync.get_last_sync", return_value=None),
        patch("app.services.bounty_service._bounty_store", []),
        patch("app.services.contributor_service._store", {}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["redis"] == "disconnected"
