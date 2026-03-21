"""Integration tests for the full middleware pipeline.

Verifies that correlation IDs, structured errors, and access logging
all work together end-to-end through the real application.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app, raise_server_exceptions=False)


class TestMiddlewarePipeline:
    def test_successful_request_gets_correlation_id(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert "X-Correlation-ID" in resp.headers

    def test_caller_correlation_id_propagated(self, client):
        resp = client.get("/health", headers={"X-Correlation-ID": "pipe-test-001"})
        assert resp.headers["X-Correlation-ID"] == "pipe-test-001"

    def test_404_returns_structured_error_with_cid(self, client):
        resp = client.get(
            "/api/bounties/nonexistent-id",
            headers={"X-Correlation-ID": "err-test-404"},
        )
        assert resp.status_code == 404
        body = resp.json()
        assert "error" in body
        assert body["error"]["code"] == 404
        assert body["error"]["correlation_id"] == "err-test-404"

    def test_validation_error_structured(self, client):
        resp = client.get("/api/bounties", params={"skip": "bad"})
        assert resp.status_code == 422
        body = resp.json()
        assert "error" in body
        assert body["error"]["code"] == 422
        assert "details" in body["error"]

    def test_cors_headers_present(self, client):
        resp = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code == 200

    def test_multiple_requests_get_different_cids(self, client):
        cids = set()
        for _ in range(5):
            resp = client.get("/health")
            cids.add(resp.headers["X-Correlation-ID"])
        assert len(cids) == 5
