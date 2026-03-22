"""Unit tests for the /health endpoint (Issue #343).

Covers four scenarios:
- All services healthy
- Database down
- Redis down
- Both down
Testing exception handling directly on dependencies.
"""

import pytest
from unittest.mock import AsyncMock, patch
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
async def test_health_all_services_up():
    """Returns 'healthy' when DB and Redis are both reachable."""
    with (
        patch("app.api.health.engine.connect", return_value=MockConn()),
        patch("app.api.health.from_url", return_value=MockRedis()),
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


@pytest.mark.asyncio
async def test_health_check_db_down():
    """Returns 'degraded' when database throws connection exception."""

    class FailingConn:
        async def __aenter__(self):
            raise SQLAlchemyError("db fail")

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with (
        patch("app.api.health.engine.connect", return_value=FailingConn()),
        patch("app.api.health.from_url", return_value=MockRedis()),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"] == "disconnected"
    assert data["services"]["redis"] == "connected"


@pytest.mark.asyncio
async def test_health_check_redis_down():
    """Returns 'degraded' when redis throws connection exception."""

    class FailingRedis:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def ping(self):
            raise RedisError("redis fail")

    with (
        patch("app.api.health.engine.connect", return_value=MockConn()),
        patch("app.api.health.from_url", return_value=FailingRedis()),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"] == "connected"
    assert data["services"]["redis"] == "disconnected"


@pytest.mark.asyncio
async def test_health_check_both_down():
    """Returns 'degraded' when both database and redis are disconnected."""

    class FailingConn:
        async def __aenter__(self):
            raise SQLAlchemyError("db fail")

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    class FailingRedis:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def ping(self):
            raise RedisError("redis fail")

    with (
        patch("app.api.health.engine.connect", return_value=FailingConn()),
        patch("app.api.health.from_url", return_value=FailingRedis()),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"] == "disconnected"
    assert data["services"]["redis"] == "disconnected"
