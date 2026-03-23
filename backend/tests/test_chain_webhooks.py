"""Tests for on-chain webhook ingestion, batching, and delivery metadata."""

from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.chain_webhook_indexer import router as indexer_router
from app.models.contributor_webhook import WebhookBatchPayload, WebhookPayload
from app.services.chain_webhook_batcher import ChainWebhookBatcher, WINDOW_SECONDS


@pytest.fixture
def indexer_app() -> FastAPI:
    app = FastAPI()
    app.include_router(indexer_router, prefix="/api")
    return app


def _valid_body() -> dict:
    return {
        "event": "escrow.locked",
        "transaction_signature": "5" * 88,
        "slot": 123_456,
        "accounts": {"escrow": "So11111111111111111111111111111111111111112"},
    }


@pytest.mark.asyncio
async def test_indexer_ingest_rejects_when_secret_unset(indexer_app, monkeypatch):
    monkeypatch.delenv("CHAIN_WEBHOOK_INDEXER_SECRET", raising=False)
    async with AsyncClient(
        transport=ASGITransport(app=indexer_app), base_url="http://test"
    ) as client:
        r = await client.post(
            "/api/webhooks/internal/chain-events",
            json=_valid_body(),
            headers={"X-Chain-Indexer-Key": "anything"},
        )
    assert r.status_code == 503


@pytest.mark.asyncio
async def test_indexer_ingest_401_bad_key(indexer_app, monkeypatch):
    monkeypatch.setenv("CHAIN_WEBHOOK_INDEXER_SECRET", "expected")
    async with AsyncClient(
        transport=ASGITransport(app=indexer_app), base_url="http://test"
    ) as client:
        r = await client.post(
            "/api/webhooks/internal/chain-events",
            json=_valid_body(),
            headers={"X-Chain-Indexer-Key": "wrong"},
        )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_indexer_ingest_422_unknown_event(indexer_app, monkeypatch):
    monkeypatch.setenv("CHAIN_WEBHOOK_INDEXER_SECRET", "k")
    body = _valid_body()
    body["event"] = "unknown.event"
    async with AsyncClient(
        transport=ASGITransport(app=indexer_app), base_url="http://test"
    ) as client:
        r = await client.post(
            "/api/webhooks/internal/chain-events",
            json=body,
            headers={"X-Chain-Indexer-Key": "k"},
        )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_indexer_ingest_accepts_and_enqueues(indexer_app, monkeypatch):
    monkeypatch.setenv("CHAIN_WEBHOOK_INDEXER_SECRET", "secret")
    with patch(
        "app.api.chain_webhook_indexer.chain_webhook_batcher.enqueue",
        new_callable=AsyncMock,
    ) as mock_enqueue:
        async with AsyncClient(
            transport=ASGITransport(app=indexer_app), base_url="http://test"
        ) as client:
            r = await client.post(
                "/api/webhooks/internal/chain-events",
                json=_valid_body(),
                headers={"X-Chain-Indexer-Key": "secret"},
            )
    assert r.status_code == 202
    assert mock_enqueue.await_count == 1
    args = mock_enqueue.await_args[0]
    assert args[0]["event"] == "escrow.locked"
    assert args[0]["slot"] == 123_456
    assert args[0]["transaction_signature"] == "5" * 88
    assert args[1] is None


def test_batch_payload_json_roundtrip():
    p = WebhookPayload(
        event="stake.deposited",
        bounty_id="",
        timestamp="2026-03-23T12:00:00Z",
        data={"accounts": {"pool": "abc"}},
        transaction_signature="x" * 88,
        slot=99,
    )
    batch = WebhookBatchPayload(
        batch_id=str(uuid.uuid4()),
        timestamp="2026-03-23T12:00:01Z",
        events=[p],
    )
    raw = batch.model_dump_json(exclude_none=True)
    data = json.loads(raw)
    assert data["delivery_mode"] == "batch"
    assert data["window_seconds"] == 5
    assert len(data["events"]) == 1
    assert data["events"][0]["transaction_signature"] == "x" * 88


@pytest.mark.asyncio
async def test_batcher_flush_groups_by_notify_user(monkeypatch):
    @asynccontextmanager
    async def fake_session():
        yield MagicMock()

    monkeypatch.setattr(
        "app.services.chain_webhook_batcher.get_db_session", fake_session
    )

    deliveries: list[tuple[list, str | None]] = []

    async def capture_batch(events, notify_user_id=None):
        deliveries.append((events, notify_user_id))

    with patch(
        "app.services.chain_webhook_batcher.ContributorWebhookService"
    ) as MockSvc:
        inst = MagicMock()
        inst.deliver_chain_batch = AsyncMock(side_effect=capture_batch)
        MockSvc.return_value = inst

        b = ChainWebhookBatcher()
        d1 = {**_valid_body(), "timestamp": "t1"}
        d2 = {**_valid_body(), "timestamp": "t2"}
        uid = str(uuid.uuid4())
        await b.enqueue(d1, None)
        await b.enqueue(d2, uid)
        await b._flush_unlocked()

    assert len(deliveries) == 2
    by_user = {n: ev for ev, n in deliveries}
    assert len(by_user[None]) == 1
    assert len(by_user[uid]) == 1
    assert WINDOW_SECONDS == 5
