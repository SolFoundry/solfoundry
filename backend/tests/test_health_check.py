"""Tests for the enhanced health check endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


class TestHealthCheck:
    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_contains_status_field(self, client):
        resp = client.get("/health")
        data = resp.json()
        assert "status" in data
        assert data["status"] in ("healthy", "degraded")

    def test_health_contains_dependencies(self, client):
        resp = client.get("/health")
        data = resp.json()
        assert "dependencies" in data
        deps = data["dependencies"]
        assert "database" in deps
        assert "redis" in deps
        for dep_name, dep_info in deps.items():
            assert "status" in dep_info
            assert dep_info["status"] in ("healthy", "unhealthy")

    def test_health_contains_bounties_count(self, client):
        resp = client.get("/health")
        data = resp.json()
        assert "bounties" in data
        assert isinstance(data["bounties"], int)

    def test_health_contains_contributors_count(self, client):
        resp = client.get("/health")
        data = resp.json()
        assert "contributors" in data
        assert isinstance(data["contributors"], int)

    def test_health_contains_last_sync(self, client):
        resp = client.get("/health")
        data = resp.json()
        assert "last_sync" in data

    def test_health_returns_correlation_id(self, client):
        resp = client.get("/health", headers={"X-Correlation-ID": "health-check-test"})
        assert resp.headers.get("X-Correlation-ID") == "health-check-test"
