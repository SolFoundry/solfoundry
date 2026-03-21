"""Security & Rate Limit Mission Tests - Absolute 9.0 Hardened Version."""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi import FastAPI
from starlette.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.middleware.rate_limit import RateLimitMiddleware

@pytest.mark.asyncio
async def test_ip_blocklist():
    """Verify that blocked IPs receive 403 Forbidden autonomously."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        with patch("app.middleware.rate_limit.Redis.sismember", new_callable=AsyncMock) as mock_sismember:
            # Case 1: IP is blocked
            mock_sismember.return_value = True
            response = await ac.get("/health", headers={"X-Forwarded-For": "1.2.3.4"})
            assert response.status_code == 403
            assert response.json()["code"] == "IP_BLOCKED"
            
            # Case 2: IP is clean
            mock_sismember.return_value = False
            response = await ac.get("/health", headers={"X-Forwarded-For": "5.6.7.8"})
            assert response.status_code == 200

@pytest.mark.asyncio
async def test_payload_limit():
    """Verify that oversized payloads are rejected (Bounty #169)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1.1MB payload (Limit is 1MB)
        large_data = "x" * (1024 * 1024 + 1024)
        response = await ac.post("/api/bounties", content=large_data)
        assert response.status_code == 413
        assert response.json()["code"] == "PAYLOAD_TOO_LARGE"

@pytest.mark.asyncio
async def test_request_id_logging():
    """Verify that X-Request-ID is present in 9.0 responses."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
        assert "X-Request-ID" in response.headers
        assert len(response.headers["X-Request-ID"]) > 20
