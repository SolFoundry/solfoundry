"""Tests for the GitHub Repo Marketplace."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_marketplace_stats(client):
    resp = await client.get("/marketplace/stats")
    assert resp.status_code == 200
    body = resp.json()
    assert "total_funding_goals" in body
    assert "total_raised" in body


@pytest.mark.asyncio
async def test_add_repo_validation(client):
    resp = await client.post("/marketplace/repos", json={"repo_url": "not-a-url"})
    assert resp.status_code == 422  # validation error


@pytest.mark.asyncio
async def test_list_repos_empty(client):
    resp = await client.get("/marketplace/repos")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)