"""Unit tests for the /health endpoint (Issue #490).

Covers the following scenarios with mocked service responses:
- All services healthy → HTTP 200 + status 'healthy'
- Database down → HTTP 503 + status 'unhealthy'
- Redis down → HTTP 503 + status 'unhealthy'
- Solana RPC down → HTTP 503 + status 'unhealthy'
- GitHub rate limit exhausted → HTTP 503 + status 'unhealthy'
- Both DB and Redis down → HTTP 503 + status 'unhealthy'
- Solana returns non-ok result → HTTP 503 + status 'unhealthy'
- GitHub API returns network error → HTTP 503 + status 'unhealthy'
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import RedisError
from httpx import ASGITransport, AsyncClient, Response, Request
from fastapi import FastAPI
from app.api.health import router as health_router

app = FastAPI()
app.include_router(health_router)


# ---------------------------------------------------------------------------
# Helper context-manager mocks
# ---------------------------------------------------------------------------

class MockConn:
    """Simulates a healthy async DB connection context manager."""
    async def __aenter__(self):
        return self
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
    async def execute(self, query):
        pass


class MockRedis:
    """Simulates a healthy async Redis client context manager."""
    async def __aenter__(self):
        return self
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
    async def ping(self):
        pass


def _make_httpx_response(status_code: int, json_body: dict) -> Response:
    """Build a minimal httpx.Response for use in mocks."""
    import json
    content = json.dumps(json_body).encode()
    request = Request("POST", "http://test")
    return Response(status_code=status_code, content=content, request=request)


# ---------------------------------------------------------------------------
# Shared patch helpers
# ---------------------------------------------------------------------------

def _healthy_db():
    return patch("app.api.health.engine.connect", return_value=MockConn())

def _healthy_redis():
    return patch("app.api.health.from_url", return_value=MockRedis())

def _healthy_solana():
    """Patch httpx.AsyncClient so Solana check returns {"result": "ok"}."""
    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(
        return_value=_make_httpx_response(200, {"jsonrpc": "2.0", "id": 1, "result": "ok"})
    )
    mock_client.get = AsyncMock(
        return_value=_make_httpx_response(
            200,
            {"rate": {"limit": 60, "remaining": 45, "reset": 9999999999}},
        )
    )
    return patch("app.api.health.httpx.AsyncClient", return_value=mock_client)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_all_services_up():
    """HTTP 200 + 'healthy' when all four services respond correctly."""

    class _Client:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def post(self, *a, **kw):
            return _make_httpx_response(200, {"jsonrpc": "2.0", "id": 1, "result": "ok"})
        async def get(self, *a, **kw):
            return _make_httpx_response(
                200,
                {"rate": {"limit": 60, "remaining": 45, "reset": 9999999999}},
            )

    with _healthy_db(), _healthy_redis(), \
         patch("app.api.health.httpx.AsyncClient", return_value=_Client()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"]["db"] == "up"
    assert data["services"]["redis"] == "up"
    assert data["services"]["solana"] == "up"
    assert data["services"]["github"] == "rate_limit_ok"
    assert "uptime" in data


@pytest.mark.asyncio
async def test_health_db_down():
    """HTTP 503 + 'unhealthy' when database connection fails."""

    class FailingConn:
        async def __aenter__(self):
            raise SQLAlchemyError("db fail")
        async def __aexit__(self, *a):
            pass

    class _Client:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def post(self, *a, **kw):
            return _make_httpx_response(200, {"jsonrpc": "2.0", "id": 1, "result": "ok"})
        async def get(self, *a, **kw):
            return _make_httpx_response(
                200,
                {"rate": {"limit": 60, "remaining": 45, "reset": 9999999999}},
            )

    with patch("app.api.health.engine.connect", return_value=FailingConn()), \
         _healthy_redis(), \
         patch("app.api.health.httpx.AsyncClient", return_value=_Client()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["db"] == "down"
    assert data["services"]["redis"] == "up"


@pytest.mark.asyncio
async def test_health_redis_down():
    """HTTP 503 + 'unhealthy' when Redis connection fails."""

    class FailingRedis:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def ping(self):
            raise RedisError("redis fail")

    class _Client:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def post(self, *a, **kw):
            return _make_httpx_response(200, {"jsonrpc": "2.0", "id": 1, "result": "ok"})
        async def get(self, *a, **kw):
            return _make_httpx_response(
                200,
                {"rate": {"limit": 60, "remaining": 45, "reset": 9999999999}},
            )

    with _healthy_db(), \
         patch("app.api.health.from_url", return_value=FailingRedis()), \
         patch("app.api.health.httpx.AsyncClient", return_value=_Client()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["db"] == "up"
    assert data["services"]["redis"] == "down"


@pytest.mark.asyncio
async def test_health_solana_down():
    """HTTP 503 + 'unhealthy' when Solana RPC is unreachable."""

    class _Client:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def post(self, *a, **kw):
            raise Exception("connection refused")
        async def get(self, *a, **kw):
            return _make_httpx_response(
                200,
                {"rate": {"limit": 60, "remaining": 45, "reset": 9999999999}},
            )

    with _healthy_db(), _healthy_redis(), \
         patch("app.api.health.httpx.AsyncClient", return_value=_Client()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["solana"] == "down"


@pytest.mark.asyncio
async def test_health_solana_unhealthy_result():
    """HTTP 503 when Solana RPC returns a non-ok result field."""

    class _Client:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def post(self, *a, **kw):
            return _make_httpx_response(200, {"jsonrpc": "2.0", "id": 1, "result": "behind"})
        async def get(self, *a, **kw):
            return _make_httpx_response(
                200,
                {"rate": {"limit": 60, "remaining": 45, "reset": 9999999999}},
            )

    with _healthy_db(), _healthy_redis(), \
         patch("app.api.health.httpx.AsyncClient", return_value=_Client()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 503
    data = response.json()
    assert data["services"]["solana"] == "down"


@pytest.mark.asyncio
async def test_health_github_rate_limit_exhausted():
    """HTTP 503 when GitHub API rate limit remaining == 0."""

    class _Client:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def post(self, *a, **kw):
            return _make_httpx_response(200, {"jsonrpc": "2.0", "id": 1, "result": "ok"})
        async def get(self, *a, **kw):
            return _make_httpx_response(
                200,
                {"rate": {"limit": 60, "remaining": 0, "reset": 9999999999}},
            )

    with _healthy_db(), _healthy_redis(), \
         patch("app.api.health.httpx.AsyncClient", return_value=_Client()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["github"] == "rate_limit_exhausted"


@pytest.mark.asyncio
async def test_health_github_api_error():
    """HTTP 503 when GitHub API is unreachable."""

    class _Client:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def post(self, *a, **kw):
            return _make_httpx_response(200, {"jsonrpc": "2.0", "id": 1, "result": "ok"})
        async def get(self, *a, **kw):
            raise Exception("network error")

    with _healthy_db(), _healthy_redis(), \
         patch("app.api.health.httpx.AsyncClient", return_value=_Client()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 503
    data = response.json()
    assert data["services"]["github"] == "down"


@pytest.mark.asyncio
async def test_health_db_and_redis_both_down():
    """HTTP 503 when both DB and Redis are disconnected."""

    class FailingConn:
        async def __aenter__(self):
            raise SQLAlchemyError("db fail")
        async def __aexit__(self, *a):
            pass

    class FailingRedis:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def ping(self):
            raise RedisError("redis fail")

    class _Client:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def post(self, *a, **kw):
            return _make_httpx_response(200, {"jsonrpc": "2.0", "id": 1, "result": "ok"})
        async def get(self, *a, **kw):
            return _make_httpx_response(
                200,
                {"rate": {"limit": 60, "remaining": 45, "reset": 9999999999}},
            )

    with patch("app.api.health.engine.connect", return_value=FailingConn()), \
         patch("app.api.health.from_url", return_value=FailingRedis()), \
         patch("app.api.health.httpx.AsyncClient", return_value=_Client()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["db"] == "down"
    assert data["services"]["redis"] == "down"


@pytest.mark.asyncio
async def test_health_response_shape():
    """Verify the full response shape matches the specified contract."""

    class _Client:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            pass
        async def post(self, *a, **kw):
            return _make_httpx_response(200, {"jsonrpc": "2.0", "id": 1, "result": "ok"})
        async def get(self, *a, **kw):
            return _make_httpx_response(
                200,
                {"rate": {"limit": 60, "remaining": 45, "reset": 9999999999}},
            )

    with _healthy_db(), _healthy_redis(), \
         patch("app.api.health.httpx.AsyncClient", return_value=_Client()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")

    data = response.json()
    # Top-level keys
    assert "status" in data
    assert "services" in data
    assert "uptime" in data
    # Services keys
    services = data["services"]
    assert "db" in services
    assert "redis" in services
    assert "solana" in services
    assert "github" in services
    # No auth required — no 401/403
    assert response.status_code != 401
    assert response.status_code != 403
