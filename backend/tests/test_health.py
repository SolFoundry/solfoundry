"""Unit tests for the /health endpoint.

Covers all service check scenarios:
- All services healthy
- Database down
- Redis down
- Solana RPC down / degraded / timeout
- GitHub API down / degraded (rate limit low) / timeout
- Multiple services down
- Overall status logic (healthy / degraded / unavailable)
"""

from unittest.mock import patch, AsyncMock, MagicMock

from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import RedisError
from httpx import ASGITransport, AsyncClient, TimeoutException, Response
from fastapi import FastAPI
from app.api.health import (
    router as health_router,
    _check_database,
    _check_redis,
    _check_solana_rpc,
    _check_github_api,
    _overall_status,
)

from tests.conftest import run_async

app = FastAPI()
app.include_router(health_router)


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------


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


class MockEngine:
    """Mock SQLAlchemy AsyncEngine whose connect() returns a given context manager."""

    def __init__(self, conn_ctx):
        self._conn_ctx = conn_ctx

    def connect(self):
        return self._conn_ctx


def _mock_solana_success():
    """Mock httpx client that returns a successful Solana RPC response."""
    mock_resp = MagicMock(spec=Response)
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"jsonrpc": "2.0", "id": 1, "result": 350000000}

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=mock_resp)
    mock_client.get = AsyncMock(return_value=mock_resp)
    return mock_client


def _mock_github_success(remaining=4500, limit=5000, reset=1700000000):
    """Mock httpx client that returns a successful GitHub rate_limit response."""
    mock_resp = MagicMock(spec=Response)
    mock_resp.status_code = 200
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "resources": {
            "core": {
                "remaining": remaining,
                "limit": limit,
                "reset": reset,
            }
        }
    }

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.post = AsyncMock(return_value=mock_resp)
    return mock_client


def _patch_all_external_healthy():
    """Return context manager patches for Solana RPC and GitHub API returning healthy.

    Patches the helper functions directly so tests are not sensitive to
    internal AsyncClient construction order.
    """
    solana_patch = patch(
        "app.api.health._check_solana_rpc",
        new=AsyncMock(
            return_value={"status": "healthy", "latency_ms": 10, "slot": 350000000}
        ),
    )
    github_patch = patch(
        "app.api.health._check_github_api",
        new=AsyncMock(
            return_value={
                "status": "healthy",
                "latency_ms": 15,
                "rate_limit": {"remaining": 4500, "limit": 5000, "reset_at": None},
            }
        ),
    )
    return solana_patch, github_patch


# ---------------------------------------------------------------------------
# Unit tests for _overall_status (synchronous — no event loop needed)
# ---------------------------------------------------------------------------


class TestOverallStatus:
    def test_all_healthy(self):
        services = {
            "database": {"status": "healthy"},
            "redis": {"status": "healthy"},
            "solana_rpc": {"status": "healthy"},
            "github_api": {"status": "healthy"},
        }
        assert _overall_status(services) == "healthy"

    def test_external_degraded(self):
        services = {
            "database": {"status": "healthy"},
            "redis": {"status": "healthy"},
            "solana_rpc": {"status": "degraded"},
            "github_api": {"status": "healthy"},
        }
        assert _overall_status(services) == "degraded"

    def test_core_unavailable(self):
        services = {
            "database": {"status": "unavailable"},
            "redis": {"status": "healthy"},
            "solana_rpc": {"status": "healthy"},
            "github_api": {"status": "healthy"},
        }
        assert _overall_status(services) == "unavailable"

    def test_redis_unavailable(self):
        services = {
            "database": {"status": "healthy"},
            "redis": {"status": "unavailable"},
            "solana_rpc": {"status": "healthy"},
            "github_api": {"status": "healthy"},
        }
        assert _overall_status(services) == "unavailable"

    def test_external_unavailable_core_healthy(self):
        services = {
            "database": {"status": "healthy"},
            "redis": {"status": "healthy"},
            "solana_rpc": {"status": "unavailable"},
            "github_api": {"status": "unavailable"},
        }
        assert _overall_status(services) == "degraded"

    def test_all_unavailable(self):
        services = {
            "database": {"status": "unavailable"},
            "redis": {"status": "unavailable"},
            "solana_rpc": {"status": "unavailable"},
            "github_api": {"status": "unavailable"},
        }
        assert _overall_status(services) == "unavailable"


# ---------------------------------------------------------------------------
# Unit tests for individual service checks (run via run_async helper)
# ---------------------------------------------------------------------------


class TestCheckDatabase:
    def test_healthy(self):
        with patch("app.api.health.engine", new=MockEngine(MockConn())):
            result = run_async(_check_database())
        assert result["status"] == "healthy"
        assert "latency_ms" in result

    def test_sqlalchemy_error(self):
        with patch("app.api.health.engine", new=MockEngine(FailingConn())):
            result = run_async(_check_database())
        assert result["status"] == "unavailable"
        assert result["error"] == "connection_error"
        assert "latency_ms" in result

    def test_unexpected_error(self):
        class UnexpectedConn:
            async def __aenter__(self):
                raise RuntimeError("unexpected")

            async def __aexit__(self, *a):
                pass

        with patch("app.api.health.engine", new=MockEngine(UnexpectedConn())):
            result = run_async(_check_database())
        assert result["status"] == "unavailable"
        assert result["error"] == "unexpected_error"
        assert "latency_ms" in result


class TestCheckRedis:
    def test_healthy(self):
        with patch("app.api.health.from_url", return_value=MockRedis()):
            result = run_async(_check_redis())
        assert result["status"] == "healthy"
        assert "latency_ms" in result

    def test_redis_error(self):
        with patch("app.api.health.from_url", return_value=FailingRedis()):
            result = run_async(_check_redis())
        assert result["status"] == "unavailable"
        assert result["error"] == "connection_error"
        assert "latency_ms" in result

    def test_unexpected_error(self):
        """Non-Redis exceptions should also return unavailable with unexpected_error."""

        class UnexpectedRedis:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                pass

            async def ping(self):
                raise RuntimeError("unexpected failure")

        with patch("app.api.health.from_url", return_value=UnexpectedRedis()):
            result = run_async(_check_redis())
        assert result["status"] == "unavailable"
        assert result["error"] == "unexpected_error"
        assert "latency_ms" in result


class TestCheckSolanaRpc:
    def test_healthy(self):
        with patch(
            "app.api.health.httpx.AsyncClient", return_value=_mock_solana_success()
        ):
            result = run_async(_check_solana_rpc())
        assert result["status"] == "healthy"
        assert result["slot"] == 350000000
        assert "latency_ms" in result

    def test_timeout(self):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=TimeoutException("timeout"))

        with patch("app.api.health.httpx.AsyncClient", return_value=mock_client):
            result = run_async(_check_solana_rpc())
        assert result["status"] == "degraded"
        assert result["error"] == "timeout"
        assert "latency_ms" in result

    def test_no_slot(self):
        mock_resp = MagicMock(spec=Response)
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {"jsonrpc": "2.0", "id": 1, "result": None}

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.api.health.httpx.AsyncClient", return_value=mock_client):
            result = run_async(_check_solana_rpc())
        assert result["status"] == "degraded"
        assert result["error"] == "no_slot_in_response"

    def test_connection_error(self):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=Exception("connection refused"))

        with patch("app.api.health.httpx.AsyncClient", return_value=mock_client):
            result = run_async(_check_solana_rpc())
        assert result["status"] == "unavailable"

    def test_malformed_response(self):
        """Malformed JSON response should return degraded, not unavailable."""
        mock_resp = MagicMock(spec=Response)
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.side_effect = ValueError("invalid json")

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.api.health.httpx.AsyncClient", return_value=mock_client):
            result = run_async(_check_solana_rpc())
        assert result["status"] == "degraded"
        assert result["error"] == "malformed_response"

    def test_http_status_error(self):
        """Non-2xx HTTP responses (e.g. 503) should return degraded with http_<code> error."""
        from httpx import HTTPStatusError, Request as HttpxRequest

        mock_request = HttpxRequest("POST", "https://api.mainnet-beta.solana.com")
        mock_err_resp = MagicMock()
        mock_err_resp.status_code = 503

        http_error = HTTPStatusError(
            "503 Service Unavailable", request=mock_request, response=mock_err_resp
        )

        mock_resp = MagicMock(spec=Response)
        mock_resp.status_code = 503
        mock_resp.raise_for_status = MagicMock(side_effect=http_error)

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("app.api.health.httpx.AsyncClient", return_value=mock_client):
            result = run_async(_check_solana_rpc())
        assert result["status"] == "degraded"
        assert result["error"] == "http_503"
        assert "latency_ms" in result


class TestCheckGitHubApi:
    def test_healthy(self):
        with patch(
            "app.api.health.httpx.AsyncClient", return_value=_mock_github_success()
        ):
            result = run_async(_check_github_api())
        assert result["status"] == "healthy"
        assert result["rate_limit"]["remaining"] == 4500
        assert "latency_ms" in result

    def test_degraded_low_rate_limit(self):
        with patch(
            "app.api.health.httpx.AsyncClient",
            return_value=_mock_github_success(remaining=50, limit=5000),
        ):
            result = run_async(_check_github_api())
        assert result["status"] == "degraded"
        assert result["rate_limit"]["remaining"] == 50

    def test_healthy_unauthenticated_low_limit(self):
        """With unauthenticated limit=60, threshold is 10% = 6; remaining=10 → healthy."""
        with patch(
            "app.api.health.httpx.AsyncClient",
            return_value=_mock_github_success(remaining=10, limit=60),
        ):
            result = run_async(_check_github_api())
        assert result["status"] == "healthy"
        assert result["rate_limit"]["remaining"] == 10

    def test_degraded_unauthenticated_exhausted(self):
        """With unauthenticated limit=60, remaining=5 (< 10%) → degraded."""
        with patch(
            "app.api.health.httpx.AsyncClient",
            return_value=_mock_github_success(remaining=5, limit=60),
        ):
            result = run_async(_check_github_api())
        assert result["status"] == "degraded"

    def test_timeout(self):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(side_effect=TimeoutException("timeout"))

        with patch("app.api.health.httpx.AsyncClient", return_value=mock_client):
            result = run_async(_check_github_api())
        assert result["status"] == "degraded"
        assert result["error"] == "timeout"
        assert "latency_ms" in result

    def test_connection_error(self):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(side_effect=Exception("connection refused"))

        with patch("app.api.health.httpx.AsyncClient", return_value=mock_client):
            result = run_async(_check_github_api())
        assert result["status"] == "unavailable"

    def test_malformed_response(self):
        """Malformed JSON response should return degraded, not unavailable."""
        mock_resp = MagicMock(spec=Response)
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.side_effect = ValueError("invalid json")

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_resp)

        with patch("app.api.health.httpx.AsyncClient", return_value=mock_client):
            result = run_async(_check_github_api())
        assert result["status"] == "degraded"
        assert result["error"] == "malformed_response"

    def test_http_status_error(self):
        """Non-2xx GitHub responses (e.g. 403, 500) return degraded with http_<code> error."""
        from httpx import HTTPStatusError, Request as HttpxRequest

        mock_request = HttpxRequest("GET", "https://api.github.com/rate_limit")
        mock_err_resp = MagicMock()
        mock_err_resp.status_code = 403

        http_error = HTTPStatusError(
            "403 Forbidden", request=mock_request, response=mock_err_resp
        )

        mock_resp = MagicMock(spec=Response)
        mock_resp.status_code = 403
        mock_resp.raise_for_status = MagicMock(side_effect=http_error)

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_resp)

        with patch("app.api.health.httpx.AsyncClient", return_value=mock_client):
            result = run_async(_check_github_api())
        assert result["status"] == "degraded"
        assert result["error"] == "http_403"
        assert "latency_ms" in result


# ---------------------------------------------------------------------------
# Integration-style endpoint tests (use run_async for async client)
# ---------------------------------------------------------------------------


def test_health_all_services_up():
    """Returns 'healthy' when all services are reachable."""
    solana_patch, github_patch = _patch_all_external_healthy()
    with (
        patch("app.api.health.engine", new=MockEngine(MockConn())),
        patch("app.api.health.from_url", return_value=MockRedis()),
        solana_patch,
        github_patch,
    ):

        async def _run():
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                return await client.get("/health")

        response = run_async(_run())

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"]["database"]["status"] == "healthy"
    assert data["services"]["redis"]["status"] == "healthy"
    assert "solana_rpc" in data["services"]
    assert "github_api" in data["services"]
    assert "uptime_seconds" in data
    assert "timestamp" in data


def test_health_check_db_down():
    """Returns 'unavailable' when database throws connection exception."""
    solana_patch, github_patch = _patch_all_external_healthy()
    with (
        patch("app.api.health.engine", new=MockEngine(FailingConn())),
        patch("app.api.health.from_url", return_value=MockRedis()),
        solana_patch,
        github_patch,
    ):

        async def _run():
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                return await client.get("/health")

        response = run_async(_run())

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "unavailable"
    assert data["services"]["database"]["status"] == "unavailable"


def test_health_check_redis_down():
    """Returns 'unavailable' when Redis throws connection exception."""
    solana_patch, github_patch = _patch_all_external_healthy()
    with (
        patch("app.api.health.engine", new=MockEngine(MockConn())),
        patch("app.api.health.from_url", return_value=FailingRedis()),
        solana_patch,
        github_patch,
    ):

        async def _run():
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                return await client.get("/health")

        response = run_async(_run())

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "unavailable"
    assert data["services"]["redis"]["status"] == "unavailable"


def test_health_check_both_core_down():
    """Returns 'unavailable' when both DB and Redis are disconnected."""
    solana_patch, github_patch = _patch_all_external_healthy()
    with (
        patch("app.api.health.engine", new=MockEngine(FailingConn())),
        patch("app.api.health.from_url", return_value=FailingRedis()),
        solana_patch,
        github_patch,
    ):

        async def _run():
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                return await client.get("/health")

        response = run_async(_run())

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "unavailable"
    assert data["services"]["database"]["status"] == "unavailable"
    assert data["services"]["redis"]["status"] == "unavailable"


def test_health_response_structure():
    """Verify the full response schema."""
    solana_patch, github_patch = _patch_all_external_healthy()
    with (
        patch("app.api.health.engine", new=MockEngine(MockConn())),
        patch("app.api.health.from_url", return_value=MockRedis()),
        solana_patch,
        github_patch,
    ):

        async def _run():
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                return await client.get("/health")

        response = run_async(_run())

    data = response.json()
    assert "status" in data
    assert "version" in data
    assert "uptime_seconds" in data
    assert "timestamp" in data
    assert "services" in data

    services = data["services"]
    assert "database" in services
    assert "redis" in services
    assert "solana_rpc" in services
    assert "github_api" in services
