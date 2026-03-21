"""Tests for health check API endpoint.

This module tests:
- All services healthy response
- Database disconnected scenario
- Redis disconnected scenario
- Both services down scenario
- Response time constraint
"""

import pytest
from unittest.mock import AsyncMock, patch
import time

from fastapi.testclient import TestClient

from app.main import app
from app.api import health as health_module


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


class TestHealthEndpoint:
    """Test suite for /health endpoint."""

    def test_all_healthy(self, client):
        """Test response when all services are connected."""
        with patch.object(health_module, 'check_database', new_callable=AsyncMock) as mock_db, \
             patch.object(health_module, 'check_redis', new_callable=AsyncMock) as mock_redis:
            mock_db.return_value = "connected"
            mock_redis.return_value = "connected"
            
            response = client.get("/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["version"] == "1.0.0"
            assert data["uptime_seconds"] >= 0
            assert "timestamp" in data
            assert data["services"]["database"] == "connected"
            assert data["services"]["redis"] == "connected"

    def test_database_down(self, client):
        """Test response when database is disconnected."""
        with patch.object(health_module, 'check_database', new_callable=AsyncMock) as mock_db, \
             patch.object(health_module, 'check_redis', new_callable=AsyncMock) as mock_redis:
            mock_db.return_value = "disconnected"
            mock_redis.return_value = "connected"
            
            response = client.get("/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "degraded"
            assert data["services"]["database"] == "disconnected"
            assert data["services"]["redis"] == "connected"

    def test_redis_down(self, client):
        """Test response when Redis is disconnected."""
        with patch.object(health_module, 'check_database', new_callable=AsyncMock) as mock_db, \
             patch.object(health_module, 'check_redis', new_callable=AsyncMock) as mock_redis:
            mock_db.return_value = "connected"
            mock_redis.return_value = "disconnected"
            
            response = client.get("/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "degraded"
            assert data["services"]["database"] == "connected"
            assert data["services"]["redis"] == "disconnected"

    def test_both_down(self, client):
        """Test response when both services are disconnected."""
        with patch.object(health_module, 'check_database', new_callable=AsyncMock) as mock_db, \
             patch.object(health_module, 'check_redis', new_callable=AsyncMock) as mock_redis:
            mock_db.return_value = "disconnected"
            mock_redis.return_value = "disconnected"
            
            response = client.get("/health")
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "degraded"
            assert data["services"]["database"] == "disconnected"
            assert data["services"]["redis"] == "disconnected"

    def test_response_time(self, client):
        """Test that response time is under 500ms."""
        with patch.object(health_module, 'check_database', new_callable=AsyncMock) as mock_db, \
             patch.object(health_module, 'check_redis', new_callable=AsyncMock) as mock_redis:
            mock_db.return_value = "connected"
            mock_redis.return_value = "connected"
            
            start = time.time()
            response = client.get("/health")
            elapsed = (time.time() - start) * 1000  # Convert to ms
            
            assert response.status_code == 200
            assert elapsed < 500, f"Response time {elapsed}ms exceeds 500ms limit"

    def test_uptime_increases(self, client):
        """Test that uptime_seconds increases over time."""
        with patch.object(health_module, 'check_database', new_callable=AsyncMock) as mock_db, \
             patch.object(health_module, 'check_redis', new_callable=AsyncMock) as mock_redis:
            mock_db.return_value = "connected"
            mock_redis.return_value = "connected"
            
            response1 = client.get("/health")
            uptime1 = response1.json()["uptime_seconds"]
            
            # Small delay
            time.sleep(0.1)
            
            response2 = client.get("/health")
            uptime2 = response2.json()["uptime_seconds"]
            
            assert uptime2 > uptime1, "Uptime should increase over time"

    def test_no_auth_required(self, client):
        """Test that health endpoint requires no authentication."""
        with patch.object(health_module, 'check_database', new_callable=AsyncMock) as mock_db, \
             patch.object(health_module, 'check_redis', new_callable=AsyncMock) as mock_redis:
            mock_db.return_value = "connected"
            mock_redis.return_value = "connected"
            
            # Request without any auth headers
            response = client.get("/health")
            
            # Should succeed without 401 Unauthorized
            assert response.status_code == 200