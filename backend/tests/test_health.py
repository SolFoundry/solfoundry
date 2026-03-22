"""Unit tests for the health endpoint."""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.api.health import router


client = TestClient(app)


@pytest.mark.asyncio
async def test_health_check_all_services_healthy():
    """Test health endpoint when all services are healthy."""
    
    with patch("app.api.health._check_database") as mock_db:
        mock_db.return_value = "connected"
        
    with patch("app.api.health._check_redis") as mock_redis:
        mock_redis.return_value = "connected"
        
    with patch("app.api.health._check_github_api") as mock_github:
        mock_github.return_value = {"status": "connected", "rate_limit_remaining": "1000"}
        
    with patch("app.api.health._check_solana_rpc") as mock_solana:
        mock_solana.return_value = {"status": "connected", "latency": 0.1}
    
    response = client.get("/health")
    
    assert response.status[0] == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["services"]["database"] == "connected"
    assert response.json()["services"]["redis"] == "connected"
    assert response.json()["services"]["github_api"] == "connected"
    assert response.json()["services"]["github_rate_limit_remaining"] == "1000"
    assert response.json()["services"]["solana_rpc"] == "connected"


@pytest.mark.asyncio
async def test_health_check_database_down():
    """Test health endpoint when database is disconnected."""
    
    with patch("app.api.health._check_database") as mock_db:
        mock_db.return_value = "disconnected"
        
    with patch("app.api.health._check_redis") as mock_redis:
        mock_redis.return_value = "connected"
        
    with patch("app.api.health._check_github_api") as mock_github:
        mock_github.return_value = {"status": "connected", "rate_limit_remaining": "1000"}
        
    with patch("app.api.health._check_solana_rpc") as mock_solana:
        mock_solana.return_value = {"status": "connected", "latency": 0.1}
    
    response = client.get("/health")
    
    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["services"]["database"] == "disconnected"


@pytest.mark.asyncio
async def test_health_check_redis_down():
    """Test health endpoint when Redis is disconnected."""
    
    with patch("app.api.health._check_database") as mock_db:
        mock_db.return_value = "connected"
        
    with patch("app.api.health._check_redis") as mock_redis:
        mock_redis.return_value = "disconnected"
        
    with patch("app.api.health._check_github_api") as mock_github:
        mock_github.return_value = {"status": "connected", "rate_limit_remaining": "1000"}
        
    with patch("app.api.health._check_solana_rpc") as mock_solana:
        mock_solana.return_value = {"status": "connected", "latency": 0.1}
    
    response = client.get("/health")
    
    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
    assert response.json()["services"]["redis"] == "disconnected"


@pytest.mark.asyncio
async def test_health_check_github_api_unauthorized():
    """Test health endpoint when GitHub API is unauthorized."""
    
    with patch("app.api.health._check_database") as mock_db:
        mock_db.return_value = "connected"
        
    with patch("app.api.health._check_redis") as mock_redis:
        mock_redis.return_value = "connected"
        
    with patch("app.api.health._check_github_api") as mock_github:
        mock_github.return_value = {"status": "unauthorized"}
        
    with patch("app.api.health._check_solana_rpc") as mock_solana:
        mock_solana.return_value = {"status": "connected", "latency": 0.1}
    
    response = client.get("/health")
    
    assert response.status_code == 200  # GitHub auth issues don't cause degraded status
    assert response.json()["status"] == "degraded"  # but system is degraded
    assert response.json()["services"]["github_api"] == "unauthorized"


@pytest.mark.asyncio
async def test_health_check_solana_rpc_timeout():
    """Test health endpoint when Solana RPC timeout occurs."""
    
    with patch("app.api.health._check_database") as mock_db:
        mock_db.return_value = "connected"
        
    with patch("app.api.health._check_redis") as mock_redis:
        mock_redis.return_value = "connected"
        
    with patch("app.api.health._check_github_api") as mock_github:
        mock_github.return_value = {"status": "connected", "rate_limit_remaining": "1000"}
        
    with patch("app.api.health._check_solana_rpc") as mock_solana:
        mock_solana.return_value = {"status": "timeout"}
    
    response = client.get("/health")
    
    assert response.status_code == 200  # Core services are healthy
    assert response.json()["status"] == "degraded"
    assert response.json()["services"]["solana_rpc"] == "timeout"


@pytest.mark.asyncio
async def test_health_check_response_time():
    """Test health endpoint response time is reported."""
    
    with patch("app.api.health._check_database") as mock_db:
        mock_db.return_value = "connected"
        
    with patch("app.api.health._check_redis") as mock_redis:
        mock_redis.return_value = "connected"
        
    with patch("app.api.health._check_github_api") as mock_github:
        mock_github.return_value = {"status": "connected", "rate_limit_remaining": "1000"}
        
    with patch("app.api.health._check_solana_rpc") as mock_solana:
        mock_solana.return_value = {"status": "connected", "latency": 0.05}
    
    response = client.get("/health")
    
    assert response.status_code == 200
    assert "response_time_ms" in response.json()
    assert isinstance(response.json()["response_time_ms"], int)
    assert response.json()["response_time_ms"] < 2000  # Should be under 2 seconds


@pytest.mark.asyncio
async def test_health_check_structure():
    """Test health endpoint returns correct JSON structure."""
    
    with patch("app.api.health._check_database") as mock_db:
        mock_db.return_value = "connected"
        
    with patch("app.api.health._check_redis") as mock_redis:
        mock_redis.return_value = "connected"
        
    with patch("app.api.health._check_github_api") as mock_github:
        mock_github.return_value = {"status": "connected", "rate_limit_remaining": "1000"}
        
    with patch("app.api.health._check_solana_rpc") as mock_solana:
        mock_solana.return_value = {"status": "connected", "latency": 0.1}
    
    response = client.get("/health")
    data = response.json()
    
    assert "status" in data
    assert "status_code" in data
    assert "version" in data
    assert "uptime_seconds" in data
    assert "timestamp" in data
    assert "response_time_ms" in data
    assert "services" in data
    
    services = data["services"]
    assert "database" in services
    assert "redis" in services
    assert "github_api" in services
    assert "github_rate_limit_remaining" in services
    assert "solana_rpc" in services
    assert "solana_latency_ms" in services