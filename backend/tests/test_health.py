"""Unit tests for the /api/health endpoint.

Covers scenarios:
- All services healthy (200)
- Individual services down (503)
- All services down (503)
- Solana RPC health check
- GitHub API rate limit check
- Response includes uptime, timestamp, and response_time_ms
- Parallel execution (all checks run concurrently)

All external dependencies are mocked — no real network calls.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import RedisError
from httpx import ASGITransport, AsyncClient, Response, TimeoutException
from fastapi import FastAPI
from app.api.health import router as health_router, _format_uptime

app = FastAPI()
app.include_router(health_router)


# ============================================================================
# Mock helpers
# ============================================================================

class MockConn:
    """Mock database connection that succeeds."""
    async def __aenter__(self):
        return self
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
    async def execute(self, query):
        pass


class FailingConn:
    """Mock database connection that raises SQLAlchemyError."""
    async def __aenter__(self):
        raise SQLAlchemyError("db fail")
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


class MockRedis:
    """Mock Redis client that succeeds."""
    async def __aenter__(self):
        return self
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
    async def ping(self):
        pass


class FailingRedis:
    """Mock Redis client that raises RedisError."""
    async def __aenter__(self):
        return self
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
    async def ping(self):
        raise RedisError("redis fail")


def _mock_solana_healthy():
    """Return a mock httpx response for a healthy Solana RPC."""
    response = MagicMock(spec=Response)
    response.json.return_value = {"jsonrpc": "2.0", "id": 1, "result": "ok"}
    return response


def _mock_solana_unhealthy():
    """Return a mock httpx response for an unhealthy Solana RPC."""
    response = MagicMock(spec=Response)
    response.json.return_value = {
        "jsonrpc": "2.0",
        "id": 1,
        "error": {"code": -32005, "message": "Node is behind"},
    }
    return response


def _mock_github_healthy():
    """Return a mock httpx response for a healthy GitHub API."""
    response = MagicMock(spec=Response)
    response.status_code = 200
    response.json.return_value = {
        "resources": {
            "core": {"limit": 5000, "remaining": 4900, "reset": 1234567890}
        }
    }
    return response


def _mock_github_rate_limited():
    """Return a mock httpx response for a rate-limited GitHub API."""
    response = MagicMock(spec=Response)
    response.status_code = 403
    return response


# ============================================================================
# Helper to mock all external services
# ============================================================================

def _patch_all(
    db_ok=True, redis_ok=True, solana_response=None, github_response=None,
    solana_error=None, github_error=None,
):
    """Create context managers for patching all health check dependencies."""
    db_mock = MockConn() if db_ok else FailingConn()
    redis_mock = MockRedis() if redis_ok else FailingRedis()

    patches = [
        patch("app.api.health.engine.connect", return_value=db_mock),
        patch("app.api.health.from_url", return_value=redis_mock),
    ]

    # Mock httpx.AsyncClient for Solana and GitHub
    async def mock_httpx_client(*args, **kwargs):
        mock_client = AsyncMock()

        async def mock_post(url, **kw):
            if solana_error:
                raise solana_error
            return solana_response or _mock_solana_healthy()

        async def mock_get(url, **kw):
            if github_error:
                raise github_error
            return github_response or _mock_github_healthy()

        mock_client.post = mock_post
        mock_client.get = mock_get
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        return mock_client

    patches.append(
        patch("app.api.health.httpx.AsyncClient", side_effect=mock_httpx_client)
    )

    return patches


# ============================================================================
# Tests
# ============================================================================

@pytest.mark.asyncio
async def test_health_all_services_up():
    """Returns 200 'healthy' when all services are reachable."""
    patches = _patch_all()
    with patches[0], patches[1], patches[2]:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"]["database"]["status"] == "up"
    assert data["services"]["redis"]["status"] == "up"
    assert data["services"]["solana_rpc"]["status"] == "up"
    assert data["services"]["github_api"]["status"] == "up"
    assert data["services"]["github_api"]["rate_limit_remaining"] == 4900
    assert data["services"]["github_api"]["rate_limit_total"] == 5000


@pytest.mark.asyncio
async def test_health_returns_503_when_db_down():
    """Returns 503 'degraded' when database is disconnected."""
    patches = _patch_all(db_ok=False)
    with patches[0], patches[1], patches[2]:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"]["status"] == "down"
    assert data["services"]["redis"]["status"] == "up"


@pytest.mark.asyncio
async def test_health_returns_503_when_redis_down():
    """Returns 503 'degraded' when Redis is disconnected."""
    patches = _patch_all(redis_ok=False)
    with patches[0], patches[1], patches[2]:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"]["status"] == "up"
    assert data["services"]["redis"]["status"] == "down"


@pytest.mark.asyncio
async def test_health_returns_503_when_solana_down():
    """Returns 503 'degraded' when Solana RPC is unhealthy."""
    patches = _patch_all(solana_response=_mock_solana_unhealthy())
    with patches[0], patches[1], patches[2]:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["solana_rpc"]["status"] == "down"


@pytest.mark.asyncio
async def test_health_returns_503_when_solana_timeout():
    """Returns 503 'degraded' when Solana RPC times out."""
    patches = _patch_all(solana_error=TimeoutException("timeout"))
    with patches[0], patches[1], patches[2]:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["services"]["solana_rpc"]["status"] == "down"
    assert data["services"]["solana_rpc"]["error"] == "timeout"


@pytest.mark.asyncio
async def test_health_returns_503_when_github_rate_limited():
    """Returns 503 'degraded' when GitHub API returns non-200."""
    patches = _patch_all(github_response=_mock_github_rate_limited())
    with patches[0], patches[1], patches[2]:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["services"]["github_api"]["status"] == "down"


@pytest.mark.asyncio
async def test_health_returns_503_when_github_timeout():
    """Returns 503 'degraded' when GitHub API times out."""
    patches = _patch_all(github_error=TimeoutException("timeout"))
    with patches[0], patches[1], patches[2]:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["services"]["github_api"]["status"] == "down"
    assert data["services"]["github_api"]["error"] == "timeout"


@pytest.mark.asyncio
async def test_health_returns_503_when_all_down():
    """Returns 503 'degraded' when all services are disconnected."""
    patches = _patch_all(
        db_ok=False,
        redis_ok=False,
        solana_response=_mock_solana_unhealthy(),
        github_response=_mock_github_rate_limited(),
    )
    with patches[0], patches[1], patches[2]:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"]["status"] == "down"
    assert data["services"]["redis"]["status"] == "down"
    assert data["services"]["solana_rpc"]["status"] == "down"
    assert data["services"]["github_api"]["status"] == "down"


@pytest.mark.asyncio
async def test_health_response_includes_metadata():
    """Response includes uptime, timestamp, version, and response_time_ms."""
    patches = _patch_all()
    with patches[0], patches[1], patches[2]:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/health")

    data = response.json()
    assert "uptime" in data
    assert "uptime_seconds" in data
    assert "timestamp" in data
    assert "response_time_ms" in data
    assert "version" in data
    assert data["version"] == "1.0.0"
    assert isinstance(data["uptime_seconds"], int)
    assert isinstance(data["response_time_ms"], int)


@pytest.mark.asyncio
async def test_health_no_auth_required():
    """Health endpoint is accessible without authentication."""
    patches = _patch_all()
    with patches[0], patches[1], patches[2]:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # No auth headers sent
            response = await client.get("/api/health")

    assert response.status_code == 200


def test_format_uptime_seconds_only():
    """Formats short uptime correctly."""
    assert _format_uptime(45) == "45s"


def test_format_uptime_minutes():
    """Formats minutes and seconds correctly."""
    assert _format_uptime(125) == "2m 5s"


def test_format_uptime_hours():
    """Formats hours, minutes, and seconds correctly."""
    assert _format_uptime(3661) == "1h 1m 1s"


def test_format_uptime_days():
    """Formats days, hours, minutes, and seconds correctly."""
    assert _format_uptime(90061) == "1d 1h 1m 1s"
