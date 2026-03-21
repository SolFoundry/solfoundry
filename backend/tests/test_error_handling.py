"""Tests for global exception handling and structured error responses."""

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.core.exceptions import register_exception_handlers
from app.core.correlation import CorrelationMiddleware


def _create_test_app() -> FastAPI:
    test_app = FastAPI()
    register_exception_handlers(test_app)
    test_app.add_middleware(CorrelationMiddleware)

    @test_app.get("/ok")
    async def ok():
        return {"status": "ok"}

    @test_app.get("/http-error")
    async def http_error():
        raise HTTPException(status_code=403, detail="Forbidden resource")

    @test_app.get("/not-found")
    async def not_found():
        raise HTTPException(status_code=404, detail="Item not found")

    @test_app.get("/server-error")
    async def server_error():
        raise HTTPException(status_code=500, detail="Something broke")

    @test_app.get("/unhandled")
    async def unhandled():
        raise RuntimeError("unexpected crash")

    @test_app.get("/validation")
    async def validation(count: int):
        return {"count": count}

    return test_app


@pytest.fixture
def client():
    return TestClient(_create_test_app(), raise_server_exceptions=False)


class TestStructuredErrorResponses:
    def test_http_403_returns_structured_json(self, client):
        resp = client.get("/http-error")
        assert resp.status_code == 403
        body = resp.json()
        assert "error" in body
        assert body["error"]["code"] == 403
        assert body["error"]["message"] == "Forbidden resource"
        assert "correlation_id" in body["error"]

    def test_http_404_returns_structured_json(self, client):
        resp = client.get("/not-found")
        assert resp.status_code == 404
        body = resp.json()
        assert body["error"]["code"] == 404
        assert body["error"]["message"] == "Item not found"

    def test_http_500_returns_structured_json(self, client):
        resp = client.get("/server-error")
        assert resp.status_code == 500
        body = resp.json()
        assert body["error"]["code"] == 500

    def test_unhandled_exception_returns_500(self, client):
        resp = client.get("/unhandled")
        assert resp.status_code == 500
        body = resp.json()
        assert body["error"]["code"] == 500
        assert body["error"]["message"] == "Internal server error"
        assert "correlation_id" in body["error"]

    def test_validation_error_returns_422(self, client):
        resp = client.get("/validation", params={"count": "not-a-number"})
        assert resp.status_code == 422
        body = resp.json()
        assert body["error"]["code"] == 422
        assert body["error"]["message"] == "Validation error"
        assert "details" in body["error"]
        assert isinstance(body["error"]["details"], list)

    def test_successful_request_not_affected(self, client):
        resp = client.get("/ok")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestCorrelationIdInErrors:
    def test_error_includes_correlation_id_from_header(self, client):
        resp = client.get(
            "/not-found",
            headers={"X-Correlation-ID": "test-trace-123"},
        )
        body = resp.json()
        assert body["error"]["correlation_id"] == "test-trace-123"

    def test_error_generates_correlation_id_when_none_supplied(self, client):
        resp = client.get("/not-found")
        body = resp.json()
        cid = body["error"]["correlation_id"]
        assert cid and cid != "-"
        assert len(cid) == 36  # UUID4 format
