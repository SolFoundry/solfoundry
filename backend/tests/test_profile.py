"""Tests for the profile API endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_get_own_profile(client):
    async with client as c:
        resp = await c.get("/api/profile/me")
        assert resp.status_code == 200
        data = resp.json()
        assert "username" in data
        assert "github_id" in data
        assert "bounties_completed" in data


@pytest.mark.asyncio
async def test_get_public_profile(client):
    async with client as c:
        resp = await c.get("/api/profile/demo-contributor")
        assert resp.status_code == 200
        data = resp.json()
        assert data["username"] == "demo-contributor"
        assert data["bounties_completed"] >= 0


@pytest.mark.asyncio
async def test_get_unknown_profile_404(client):
    async with client as c:
        resp = await c.get("/api/profile/nonexistent-user-xyz")
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_profile(client):
    async with client as c:
        resp = await c.patch(
            "/api/profile/me",
            json={"display_name": "Updated Name", "bio": "New bio"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["profile"]["display_name"] == "Updated Name"
        assert data["profile"]["bio"] == "New bio"


@pytest.mark.asyncio
async def test_update_profile_partial(client):
    async with client as c:
        resp = await c.patch("/api/profile/me", json={"twitter": "newhandle"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["profile"]["twitter"] == "newhandle"
