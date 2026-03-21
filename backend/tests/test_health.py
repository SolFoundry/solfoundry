import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from app.main import app

@pytest.mark.asyncio
async def test_health_check_all_ok():
    """Test /health when both DB and Redis are reachable."""
    with patch("app.api.health.engine") as mock_engine, \
         patch("redis.asyncio.from_url") as mock_redis_func:
        
        # Mock DB connection context manager
        mock_conn = AsyncMock()
        mock_engine.connect.return_value.__aenter__.return_value = mock_conn
        
        # Mock Redis connectivity
        mock_redis = AsyncMock()
        mock_redis_func.return_value = mock_redis
        mock_redis.__aenter__.return_value = mock_redis
        mock_redis.ping.return_value = True
        
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/health")
            
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["services"]["database"] == "connected"
        assert data["services"]["redis"] == "connected"
        assert "uptime_seconds" in data
        assert "timestamp" in data

@pytest.mark.asyncio
async def test_health_check_db_down():
    """Test /health when database is unreachable."""
    with patch("app.api.health.engine") as mock_engine, \
         patch("redis.asyncio.from_url") as mock_redis_func:
        
        # Mock DB failure
        mock_engine.connect.side_effect = Exception("DB Error")
        
        # Mock Redis OK
        mock_redis = AsyncMock()
        mock_redis_func.return_value = mock_redis
        mock_redis.__aenter__.return_value = mock_redis
        
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/health")
            
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["services"]["database"] == "disconnected"
        assert data["services"]["redis"] == "connected"

@pytest.mark.asyncio
async def test_health_check_redis_down():
    """Test /health when Redis is unreachable."""
    with patch("app.api.health.engine") as mock_engine, \
         patch("redis.asyncio.from_url") as mock_redis_func:
        
        # Mock DB OK
        mock_conn = AsyncMock()
        mock_engine.connect.return_value.__aenter__.return_value = mock_conn
        
        # Mock Redis Failure
        mock_redis = AsyncMock()
        mock_redis_func.return_value = mock_redis
        mock_redis.__aenter__.return_value = mock_redis
        mock_redis.ping.side_effect = Exception("Redis Connection Error")
        
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/health")
            
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["services"]["database"] == "connected"
        assert data["services"]["redis"] == "disconnected"

@pytest.mark.asyncio
async def test_health_check_both_down():
    """Test /health when all critical services are failing."""
    with patch("app.api.health.engine") as mock_engine, \
         patch("redis.asyncio.from_url", side_effect=Exception("Redis Failure")):
        
        mock_engine.connect.side_effect = Exception("DB Failure")
        
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.get("/health")
            
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["services"]["database"] == "disconnected"
        assert data["services"]["redis"] == "disconnected"
