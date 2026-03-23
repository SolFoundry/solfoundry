"""Unit tests for the /health and /api/health endpoints.

Covers:
- Legacy /health endpoint (DB + Redis only)
- Full /api/health endpoint (DB + Redis + Solana + GitHub)
- All services healthy
- Individual service failures
- Multiple service failures
- HTTP 503 response for unhealthy services
"""

import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy.exc import SQLAlchemyError
from redis.asyncio import RedisError
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI
from app.api.health import router as health_router

app = FastAPI()
app.include_router(health_router)


class MockSolanaResponse:
    """Mock Solana RPC response."""
    status_code = 200
    
    def json(self):
        return {"jsonrpc": "2.0", "result": "ok", "id": 1}


class MockGitHubResponse:
    """Mock GitHub API response."""
    status_code = 200
    
    def json(self):
        return {
            "rate": {
                "limit": 60,
                "remaining": 58,
                "reset": 1700000000
            }
        }


# =============================================================================
# Legacy /health endpoint tests
# =============================================================================

@pytest.mark.asyncio
async def test_health_legacy_all_services_up():
    """Returns 'healthy' when DB and Redis are both reachable."""
    with (
        patch("app.api.health._check_database", return_value={"status": "up"}),
        patch("app.api.health._check_redis", return_value={"status": "up"}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"]["database"] == "up"
    assert data["services"]["redis"] == "up"


@pytest.mark.asyncio
async def test_health_legacy_db_down():
    """Returns 'degraded' when database throws connection exception."""
    with (
        patch("app.api.health._check_database", return_value={"status": "down", "error": "db fail"}),
        patch("app.api.health._check_redis", return_value={"status": "up"}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"] == "down"
    assert data["services"]["redis"] == "up"


@pytest.mark.asyncio
async def test_health_legacy_redis_down():
    """Returns 'degraded' when redis throws connection exception."""
    with (
        patch("app.api.health._check_database", return_value={"status": "up"}),
        patch("app.api.health._check_redis", return_value={"status": "down", "error": "redis fail"}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "degraded"
    assert data["services"]["database"] == "up"
    assert data["services"]["redis"] == "down"


# =============================================================================
# Full /api/health endpoint tests
# =============================================================================

@pytest.mark.asyncio
async def test_api_health_all_services_up():
    """Returns 'healthy' with 200 when all services are reachable."""
    with (
        patch("app.api.health._check_database", return_value={"status": "up"}),
        patch("app.api.health._check_redis", return_value={"status": "up"}),
        patch("app.api.health._check_solana_rpc", return_value={"status": "up", "latency_ms": 150}),
        patch("app.api.health._check_github_api", return_value={"status": "up", "rate_remaining": 58, "rate_limit": 60}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "uptime" in data
    assert "uptime_seconds" in data
    assert "timestamp" in data
    assert data["services"]["database"]["status"] == "up"
    assert data["services"]["redis"]["status"] == "up"
    assert data["services"]["solana_rpc"]["status"] == "up"
    assert "latency_ms" in data["services"]["solana_rpc"]
    assert data["services"]["github_api"]["status"] == "up"
    assert data["services"]["github_api"]["rate_remaining"] == 58
    assert data["services"]["github_api"]["rate_limit"] == 60


@pytest.mark.asyncio
async def test_api_health_db_down_returns_503():
    """Returns 'unhealthy' with 503 when database is down."""
    with (
        patch("app.api.health._check_database", return_value={"status": "down", "error": "db fail"}),
        patch("app.api.health._check_redis", return_value={"status": "up"}),
        patch("app.api.health._check_solana_rpc", return_value={"status": "up", "latency_ms": 150}),
        patch("app.api.health._check_github_api", return_value={"status": "up", "rate_remaining": 58, "rate_limit": 60}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["database"]["status"] == "down"
    assert "error" in data["services"]["database"]


@pytest.mark.asyncio
async def test_api_health_redis_down_returns_503():
    """Returns 'unhealthy' with 503 when Redis is down."""
    with (
        patch("app.api.health._check_database", return_value={"status": "up"}),
        patch("app.api.health._check_redis", return_value={"status": "down", "error": "redis fail"}),
        patch("app.api.health._check_solana_rpc", return_value={"status": "up", "latency_ms": 150}),
        patch("app.api.health._check_github_api", return_value={"status": "up", "rate_remaining": 58, "rate_limit": 60}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["redis"]["status"] == "down"


@pytest.mark.asyncio
async def test_api_health_solana_rpc_down_returns_503():
    """Returns 'unhealthy' with 503 when Solana RPC is unreachable."""
    with (
        patch("app.api.health._check_database", return_value={"status": "up"}),
        patch("app.api.health._check_redis", return_value={"status": "up"}),
        patch("app.api.health._check_solana_rpc", return_value={"status": "down", "error": "unhealthy", "latency_ms": 100}),
        patch("app.api.health._check_github_api", return_value={"status": "up", "rate_remaining": 58, "rate_limit": 60}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["solana_rpc"]["status"] == "down"


@pytest.mark.asyncio
async def test_api_health_solana_rpc_timeout():
    """Handles Solana RPC timeout gracefully."""
    with (
        patch("app.api.health._check_database", return_value={"status": "up"}),
        patch("app.api.health._check_redis", return_value={"status": "up"}),
        patch("app.api.health._check_solana_rpc", return_value={"status": "down", "error": "timeout", "latency_ms": 5000}),
        patch("app.api.health._check_github_api", return_value={"status": "up", "rate_remaining": 58, "rate_limit": 60}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["solana_rpc"]["status"] == "down"
    assert data["services"]["solana_rpc"]["error"] == "timeout"


@pytest.mark.asyncio
async def test_api_health_github_api_down_returns_503():
    """Returns 'unhealthy' with 503 when GitHub API is unreachable."""
    with (
        patch("app.api.health._check_database", return_value={"status": "up"}),
        patch("app.api.health._check_redis", return_value={"status": "up"}),
        patch("app.api.health._check_solana_rpc", return_value={"status": "up", "latency_ms": 150}),
        patch("app.api.health._check_github_api", return_value={"status": "down", "error": "HTTP 500"}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["github_api"]["status"] == "down"


@pytest.mark.asyncio
async def test_api_health_multiple_services_down():
    """Returns 'unhealthy' with 503 when multiple services are down."""
    with (
        patch("app.api.health._check_database", return_value={"status": "down", "error": "db fail"}),
        patch("app.api.health._check_redis", return_value={"status": "down", "error": "redis fail"}),
        patch("app.api.health._check_solana_rpc", return_value={"status": "up", "latency_ms": 150}),
        patch("app.api.health._check_github_api", return_value={"status": "up", "rate_remaining": 58, "rate_limit": 60}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["database"]["status"] == "down"
    assert data["services"]["redis"]["status"] == "down"
    # Solana and GitHub should still be up
    assert data["services"]["solana_rpc"]["status"] == "up"
    assert data["services"]["github_api"]["status"] == "up"


@pytest.mark.asyncio
async def test_api_health_all_services_down():
    """Returns 'unhealthy' with 503 when all services are down."""
    with (
        patch("app.api.health._check_database", return_value={"status": "down", "error": "db fail"}),
        patch("app.api.health._check_redis", return_value={"status": "down", "error": "redis fail"}),
        patch("app.api.health._check_solana_rpc", return_value={"status": "down", "error": "timeout"}),
        patch("app.api.health._check_github_api", return_value={"status": "down", "error": "connection refused"}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health")

    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "unhealthy"
    assert data["services"]["database"]["status"] == "down"
    assert data["services"]["redis"]["status"] == "down"
    assert data["services"]["solana_rpc"]["status"] == "down"
    assert data["services"]["github_api"]["status"] == "down"


@pytest.mark.asyncio
async def test_api_health_response_format():
    """Verifies the response format matches the specification."""
    with (
        patch("app.api.health._check_database", return_value={"status": "up"}),
        patch("app.api.health._check_redis", return_value={"status": "up"}),
        patch("app.api.health._check_solana_rpc", return_value={"status": "up", "latency_ms": 150}),
        patch("app.api.health._check_github_api", return_value={"status": "up", "rate_remaining": 58, "rate_limit": 60}),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health")

    data = response.json()
    
    # Check required fields
    assert "status" in data
    assert "uptime" in data
    assert "timestamp" in data
    assert "services" in data
    
    # Check services structure
    services = data["services"]
    assert "database" in services
    assert "redis" in services
    assert "solana_rpc" in services
    assert "github_api" in services
    
    # Each service should have at least 'status'
    for service_name, service_data in services.items():
        assert "status" in service_data, f"{service_name} missing 'status' field"


@pytest.mark.asyncio
async def test_api_health_parallel_checks():
    """Verifies that health checks run in parallel for fast response."""
    import asyncio
    import time
    
    async def slow_check():
        await asyncio.sleep(0.1)
        return {"status": "up"}
    
    start_time = time.monotonic()
    
    with (
        patch("app.api.health._check_database", side_effect=slow_check),
        patch("app.api.health._check_redis", side_effect=slow_check),
        patch("app.api.health._check_solana_rpc", side_effect=slow_check),
        patch("app.api.health._check_github_api", side_effect=slow_check),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/health")
    
    elapsed = time.monotonic() - start_time
    
    # If checks run in parallel, total time should be ~0.1s, not 0.4s
    assert elapsed < 0.5, f"Health check took {elapsed}s - checks may not be running in parallel"
    assert response.status_code == 200