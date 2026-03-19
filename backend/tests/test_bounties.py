"""Bounty search tests."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_search_bounties_basic():
    """Test basic bounty search."""
    response = client.get("/api/v1/bounties/search")
    assert response.status_code == 200
    data = response.json()
    assert "bounties" in data
    assert "total" in data


def test_search_with_tier_filter():
    """Test search with tier filter."""
    response = client.get("/api/v1/bounties/search?tier=1")
    assert response.status_code == 200


def test_search_with_status_filter():
    """Test search with status filter."""
    response = client.get("/api/v1/bounties/search?status=open")
    assert response.status_code == 200


def test_search_with_sorting():
    """Test search with different sorting options."""
    for sort_by in ["newest", "reward_high", "reward_low", "deadline"]:
        response = client.get(f"/api/v1/bounties/search?sort_by={sort_by}")
        assert response.status_code == 200


def test_search_pagination():
    """Test search pagination."""
    response = client.get("/api/v1/bounties/search?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 10


def test_suggestions():
    """Test autocomplete suggestions."""
    response = client.get("/api/v1/bounties/suggestions?q=auth")
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
