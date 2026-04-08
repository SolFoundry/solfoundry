"""API tests for bounty analytics endpoints (seed data)."""

from __future__ import annotations

from typing import Any, Dict, List

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_bounty_volume_shape(client: TestClient) -> None:
    r = client.get("/api/analytics/bounty-volume")
    assert r.status_code == 200
    data: List[Dict[str, Any]] = r.json()
    assert len(data) >= 7
    row = data[0]
    assert "date" in row and "count" in row
    assert isinstance(row["count"], int)


def test_payouts_shape(client: TestClient) -> None:
    r = client.get("/api/analytics/payouts")
    assert r.status_code == 200
    data: List[Dict[str, Any]] = r.json()
    assert len(data) >= 7
    assert "amountUsd" in data[0]


def test_contributors_shape(client: TestClient) -> None:
    r = client.get("/api/analytics/contributors")
    assert r.status_code == 200
    body: Dict[str, Any] = r.json()
    assert "new_contributors_last_30d" in body
    assert "retention_rate" in body
    assert 0 <= float(body["retention_rate"]) <= 1
    assert isinstance(body["weekly_growth"], list)


def test_export_csv_headers(client: TestClient) -> None:
    r = client.get("/api/analytics/reports/export.csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert "attachment" in r.headers.get("content-disposition", "")
    text = r.text
    assert "bounty_volume" in text or "section" in text


def test_export_pdf_content_type(client: TestClient) -> None:
    r = client.get("/api/analytics/reports/export.pdf")
    assert r.status_code == 200
    assert r.headers.get("content-type") == "application/pdf"
    assert r.content[:4] == b"%PDF"
    assert "attachment" in r.headers.get("content-disposition", "")


