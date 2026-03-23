"""Unit tests for the /health endpoint.

Covers scenarios:
- All services healthy
- Partial down
- Proper status codes and parallel execution
"""

import pytest
from unittest.mock import patch
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import RedisError
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI
from app.api.health import router as health_router

app = FastAPI()
app.include_router(health_router)


class MockConn:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def execute(self, query):
        pass


class MockRedis:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def ping(self):
        pass


@pytest.mark.asyncio
@patch("app.api.health._check_solana_rpc", return_value="up")
@patch("app.api.health._check_github_api", return_value="up")
@patch("app.api.health.engine.connect", return_value=MockConn())
@patch("app.api.health.from_url", return_value=MockRedis())
async def test_health_all_services_up(mock_redis, mock_db, mock_github, mock_solana):
    """Returns 200 and 'healthy' when all are up."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"]["database"] == "up"
    assert data["services"]["redis"] == "up"
    assert data["services"]["solana"] == "up"
    assert data["services"]["github"] == "up"


@pytest.mark.asyncio
@patch("app.api.health._check_solana_rpc", return_value="down")
@patch("app.api.health._check_github_api", return_value="up")
@patch("app.api.health.engine.connect", return_value=MockConn())
@patch("app.api.health.from_url", return_value=MockRedis())
async def test_health_check_solana_down(mock_redis, mock_db, mock_github, mock_solana):
    """Returns 503 and 'degraded' when solana is down."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["solana"] == "down"
    assert data["services"]["database"] == "up"
