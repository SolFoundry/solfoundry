"""Tests for security and rate limiting middleware (Issue #158-161).

Covers:
- Security headers (HSTS, CSP, etc.)
- Request size limits
- IP blocklist (Redis-backed)
- Rate limiting (Redis token bucket)
"""

import time
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI, Request

from app.core import redis as redis_util
from app.middleware.security import SecurityMiddleware
from app.middleware.ip_blocklist import IPBlocklistMiddleware
from app.middleware.rate_limiter import RateLimiterMiddleware

@pytest_asyncio.fixture
async def test_app():
    """Create a new FastAPI app instance for each test to avoid state leakage."""
    new_app = FastAPI()

    @new_app.get("/mock-test")
    async def mock_endpoint():
        return {"message": "ok"}

    @new_app.post("/mock-test-post")
    async def mock_post_endpoint(request: Request):
        return {"message": "ok"}

    # Register middleware
    new_app.add_middleware(RateLimiterMiddleware)
    new_app.add_middleware(IPBlocklistMiddleware)
    new_app.add_middleware(SecurityMiddleware)
    
    return new_app

@pytest_asyncio.fixture
async def client(test_app):
    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as ac:
        yield ac

@pytest.fixture(autouse=True)
def mock_redis_global():
    """Inject a mock Redis client into the global redis utility."""
    mock_redis = AsyncMock()
    mock_redis.sismember.return_value = False # Default to not blocked
    
    # Script mock
    mock_script = AsyncMock()
    # redis.register_script is sync
    mock_redis.register_script = MagicMock(return_value=mock_script)
    
    # Store original and inject mock
    original_client = redis_util._redis_client
    redis_util._redis_client = mock_redis
    
    yield mock_redis, mock_script
    
    # Restore original
    redis_util._redis_client = original_client

@pytest.mark.asyncio
async def test_security_headers(client):
    """Verify standard security headers are present."""
    response = await client.get("/mock-test")
    
    assert response.status_code == 200
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "Content-Security-Policy" in response.headers
    assert "Strict-Transport-Security" in response.headers

@pytest.mark.asyncio
async def test_request_size_limit(client):
    """Verify 413 response when payload exceeds limit."""
    headers = {"Content-Length": str(11 * 1024 * 1024)}
    response = await client.post("/mock-test-post", headers=headers)
    
    assert response.status_code == 413
    assert response.json()["code"] == "PAYLOAD_TOO_LARGE"

@pytest.mark.asyncio
async def test_ip_blocklist_blocked(client, mock_redis_global):
    """Verify 403 response when IP is in blocklist."""
    mock_redis, _ = mock_redis_global
    mock_redis.sismember.return_value = True # IP is blocked
    
    response = await client.get("/mock-test")
    
    assert response.status_code == 403
    assert response.json()["code"] == "IP_BLOCKED"

@pytest.mark.asyncio
async def test_rate_limiter_allowed(client, mock_redis_global):
    """Verify headers and 200 OK when under rate limit."""
    mock_redis, mock_script = mock_redis_global
    # Script returns [allowed, remaining, reset_time]
    mock_script.return_value = [1, 59, int(time.time() + 60)]
    
    response = await client.get("/mock-test")
    
    assert response.status_code == 200
    assert response.headers["X-RateLimit-Limit"] == "60"
    assert response.headers["X-RateLimit-Remaining"] == "59"
    assert "X-RateLimit-Reset" in response.headers

@pytest.mark.asyncio
async def test_rate_limiter_exceeded(client, mock_redis_global):
    """Verify 429 response when rate limit is exceeded."""
    mock_redis, mock_script = mock_redis_global
    # [allowed=0, remaining=0, reset_time=...]
    mock_script.return_value = [0, 0, int(time.time() + 30)]
    
    response = await client.get("/mock-test")
    
    assert response.status_code == 429
    assert response.json()["code"] == "RATE_LIMIT_EXCEEDED"
    assert response.headers["Retry-After"] == "30"
