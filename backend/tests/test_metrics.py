"""Prometheus /metrics endpoint."""

import pytest
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI

from app.api.metrics import router as metrics_router

app = FastAPI()
app.include_router(metrics_router)


@pytest.mark.asyncio
async def test_metrics_returns_prometheus_text():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/metrics")

    assert response.status_code == 200
    ct = response.headers.get("content-type", "")
    assert "text/plain" in ct
    body = response.text
    assert "# HELP" in body or "# TYPE" in body
