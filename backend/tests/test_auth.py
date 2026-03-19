"""Authentication tests."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"


def test_health():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_github_auth_start():
    """Test GitHub OAuth start endpoint."""
    response = client.post("/api/v1/auth/github")
    assert response.status_code == 200
    data = response.json()
    assert "auth_url" in data
    assert "state" in data
    assert "github.com" in data["auth_url"]


def test_github_callback_invalid_state():
    """Test GitHub OAuth callback with invalid state."""
    response = client.post("/api/v1/auth/github/callback?code=test&state=invalid")
    assert response.status_code == 400


def test_wallet_auth_invalid_signature():
    """Test wallet auth with invalid signature."""
    response = client.post(
        "/api/v1/auth/wallet",
        json={
            "wallet_address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
            "message": "test message",
            "signature": "invalid_signature",
        },
    )
    assert response.status_code == 400


def test_get_me_unauthorized():
    """Test get current user without auth."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_get_notifications_unauthorized():
    """Test get notifications without auth."""
    response = client.get("/api/v1/notifications")
    assert response.status_code == 401


def test_wallet_link_unauthorized():
    """Test wallet linking without auth."""
    response = client.post(
        "/api/v1/auth/link-wallet",
        json={
            "wallet_address": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
            "message": "test",
            "signature": "test",
        },
    )
    assert response.status_code == 401


def test_search_bounties():
    """Test bounty search endpoint."""
    response = client.get("/api/v1/bounties/search")
    assert response.status_code == 200
    data = response.json()
    assert "bounties" in data
    assert "total" in data
    assert "page" in data


def test_search_bounties_with_filters():
    """Test bounty search with filters."""
    response = client.get("/api/v1/bounties/search?tier=1&status=open")
    assert response.status_code == 200
    data = response.json()
    assert "bounties" in data


def test_search_suggestions():
    """Test autocomplete suggestions."""
    response = client.get("/api/v1/bounties/suggestions?q=test")
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
