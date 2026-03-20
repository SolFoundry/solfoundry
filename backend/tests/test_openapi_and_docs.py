"""Tests for OpenAPI schema behavior and the developer guide route.

Verifies:
- GET /openapi.json returns a valid OpenAPI document
- GET /docs/getting-started returns HTML with expected content
- POST /notifications without auth returns 401
"""

import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-ci")
os.environ.setdefault("AUTH_ENABLED", "true")

from app.main import app  # noqa: E402


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_openapi_json_is_served(client):
    """GET /openapi.json should return a valid OpenAPI 3.x document."""
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "openapi" in data
    assert data["openapi"].startswith("3.")
    assert "info" in data
    assert "paths" in data


@pytest.mark.asyncio
async def test_openapi_json_has_notifications_path(client):
    """The OpenAPI schema must include the /api/notifications path."""
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json().get("paths", {})
    assert "/api/notifications" in paths


@pytest.mark.asyncio
async def test_developer_guide_returns_html(client):
    """GET /docs/getting-started should return HTML with guide content."""
    response = await client.get("/docs/getting-started")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    body = response.text
    assert "SolFoundry" in body
    assert "<html" in body.lower()


@pytest.mark.asyncio
async def test_developer_guide_contains_key_sections(client):
    """The developer guide page should contain expected section anchors."""
    response = await client.get("/docs/getting-started")
    assert response.status_code == 200
    body = response.text
    for anchor in ("overview", "quick-start", "github-oauth", "wallet-auth", "websocket"):
        assert anchor in body, f"Missing section anchor: {anchor}"


@pytest.mark.asyncio
async def test_create_notification_requires_auth(client):
    """POST /api/notifications without auth must return 401."""
    payload = {
        "user_id": "660e8400-e29b-41d4-a716-446655440000",
        "notification_type": "payout_sent",
        "title": "Test",
        "message": "Test message",
    }
    response = await client.post("/api/notifications", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_notification_invalid_token_returns_401(client):
    """POST /api/notifications with a bad token must return 401."""
    payload = {
        "user_id": "660e8400-e29b-41d4-a716-446655440000",
        "notification_type": "payout_sent",
        "title": "Test",
        "message": "Test message",
    }
    response = await client.post(
        "/api/notifications",
        json=payload,
        headers={"Authorization": "Bearer not-a-valid-token"},
    )
    assert response.status_code == 401
