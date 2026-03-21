"""Tests for correlation ID middleware and request tracing."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.correlation import (
    CorrelationMiddleware,
    get_correlation_id,
    set_correlation_id,
    HEADER_NAME,
)


def _create_test_app() -> FastAPI:
    test_app = FastAPI()
    test_app.add_middleware(CorrelationMiddleware)

    @test_app.get("/echo-cid")
    async def echo_cid():
        return {"correlation_id": get_correlation_id()}

    @test_app.get("/health")
    async def health():
        return {"ok": True}

    return test_app


@pytest.fixture
def client():
    return TestClient(_create_test_app())


class TestCorrelationMiddleware:
    def test_generates_correlation_id_when_absent(self, client):
        resp = client.get("/health")
        assert HEADER_NAME in resp.headers
        cid = resp.headers[HEADER_NAME]
        assert len(cid) == 36  # UUID4

    def test_reuses_caller_correlation_id(self, client):
        resp = client.get("/health", headers={HEADER_NAME: "my-trace-id"})
        assert resp.headers[HEADER_NAME] == "my-trace-id"

    def test_correlation_id_available_in_route(self, client):
        resp = client.get("/echo-cid", headers={HEADER_NAME: "route-test-99"})
        assert resp.json()["correlation_id"] == "route-test-99"

    def test_unique_ids_per_request(self, client):
        ids = set()
        for _ in range(10):
            resp = client.get("/health")
            ids.add(resp.headers[HEADER_NAME])
        assert len(ids) == 10


class TestCorrelationContextVars:
    def test_set_and_get(self):
        set_correlation_id("ctx-test-abc")
        assert get_correlation_id() == "ctx-test-abc"

    def test_default_is_none(self):
        from app.core.correlation import _correlation_id
        _correlation_id.set(None)
        assert get_correlation_id() is None
