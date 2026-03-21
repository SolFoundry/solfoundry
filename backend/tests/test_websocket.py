"""Tests for WebSocket server: auth, heartbeat, broadcast, Redis, rate limiting."""

import asyncio
import json
import uuid
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.services.websocket_manager import (
    InMemoryPubSubAdapter,
    RedisPubSubAdapter,
    WebSocketManager,
)

VALID_TOKEN = str(uuid.uuid4())
OTHER_TOKEN = str(uuid.uuid4())
INVALID_TOKEN = "not-a-uuid"


class FakeWebSocket:
    """Minimal WS double for unit tests."""

    def __init__(self):
        from starlette.websockets import WebSocketState

        self.client_state = WebSocketState.CONNECTED
        self.accepted = False
        self.closed = False
        self.close_code: Optional[int] = None
        self.sent: list = []

    async def accept(self):
        self.accepted = True

    async def close(self, code: int = 1000):
        from starlette.websockets import WebSocketState

        self.closed = True
        self.close_code = code
        self.client_state = WebSocketState.DISCONNECTED

    async def send_json(self, data: dict):
        self.sent.append(data)

    async def send_text(self, data: str):
        self.sent.append(json.loads(data))


@pytest.fixture
def mgr():
    m = WebSocketManager()
    m._adapter = InMemoryPubSubAdapter(m)
    return m


@pytest_asyncio.fixture
async def connected(mgr):
    ws = FakeWebSocket()
    cid = await mgr.connect(ws, VALID_TOKEN)
    assert cid is not None
    return mgr, cid, ws


# -- Auth tests --


class TestAuthentication:
    @pytest.mark.asyncio
    async def test_connect_valid_token(self, mgr):
        ws = FakeWebSocket()
        cid = await mgr.connect(ws, VALID_TOKEN)
        assert cid is not None and ws.accepted

    @pytest.mark.asyncio
    async def test_connect_invalid_token_rejected(self, mgr):
        ws = FakeWebSocket()
        cid = await mgr.connect(ws, INVALID_TOKEN)
        assert cid is None and ws.close_code == 4001

    @pytest.mark.asyncio
    async def test_connect_missing_token_rejected(self, mgr):
        ws = FakeWebSocket()
        cid = await mgr.connect(ws, None)
        assert cid is None and ws.close_code == 4001

    @pytest.mark.asyncio
    async def test_subscribe_reauth_wrong_token(self, connected):
        mgr, cid, _ = connected
        assert not await mgr.subscribe(cid, "ch", token=OTHER_TOKEN)

    @pytest.mark.asyncio
    async def test_subscribe_reauth_invalid_token(self, connected):
        mgr, cid, _ = connected
        assert not await mgr.subscribe(cid, "ch", token=INVALID_TOKEN)

    @pytest.mark.asyncio
    async def test_broadcast_reauth_invalid_token(self, connected):
        mgr, cid, _ = connected
        assert await mgr.broadcast("ch", {"x": 1}, token=INVALID_TOKEN) == 0

    @pytest.mark.asyncio
    async def test_broadcast_requires_identity(self, mgr):
        assert await mgr.broadcast("ch", {"x": 1}) == 0


# -- Heartbeat tests --


class TestHeartbeat:
    @pytest.mark.asyncio
    async def test_heartbeat_sends_ping(self, connected):
        mgr, cid, ws = connected
        with patch("app.services.websocket_manager.HEARTBEAT_INTERVAL", 0.05):
            task = asyncio.create_task(mgr.heartbeat(cid))
            await asyncio.sleep(0.15)
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        pings = [m for m in ws.sent if m.get("type") == "ping"]
        assert len(pings) >= 1

    @pytest.mark.asyncio
    async def test_heartbeat_stops_on_disconnect(self, mgr):
        ws = FakeWebSocket()
        cid = await mgr.connect(ws, VALID_TOKEN)
        await mgr.disconnect(cid)
        with patch("app.services.websocket_manager.HEARTBEAT_INTERVAL", 0.01):
            task = asyncio.create_task(mgr.heartbeat(cid))
            await asyncio.sleep(0.05)
            assert task.done()

    @pytest.mark.asyncio
    async def test_pong_handled(self, connected):
        mgr, cid, _ = connected
        assert await mgr.handle_message(cid, json.dumps({"type": "pong"})) is None


# -- Broadcast tests --


class TestBroadcast:
    @pytest.mark.asyncio
    async def test_broadcast_delivers_to_subscribers(self, mgr):
        ws1, ws2 = FakeWebSocket(), FakeWebSocket()
        cid1 = await mgr.connect(ws1, VALID_TOKEN)
        cid2 = await mgr.connect(ws2, OTHER_TOKEN)
        await mgr.subscribe(cid1, "events")
        await mgr.subscribe(cid2, "events")
        n = await mgr.broadcast("events", {"msg": "hello"}, sender_user_id=VALID_TOKEN)
        assert n == 2
        assert any(m.get("data", {}).get("msg") == "hello" for m in ws1.sent)
        assert any(m.get("data", {}).get("msg") == "hello" for m in ws2.sent)

    @pytest.mark.asyncio
    async def test_concurrent_broadcast_20_clients(self, mgr):
        sockets = []
        for _ in range(20):
            ws = FakeWebSocket()
            cid = await mgr.connect(ws, str(uuid.uuid4()))
            await mgr.subscribe(cid, "load")
            sockets.append(ws)
        n = await mgr.broadcast("load", {"tick": 1}, sender_user_id=VALID_TOKEN)
        assert n == 20
        for ws in sockets:
            assert len(ws.sent) == 1

    @pytest.mark.asyncio
    async def test_broadcast_skips_failed_connections(self, mgr):
        ws_good, ws_bad = FakeWebSocket(), FakeWebSocket()
        cid1 = await mgr.connect(ws_good, VALID_TOKEN)
        cid2 = await mgr.connect(ws_bad, OTHER_TOKEN)
        await mgr.subscribe(cid1, "ch")
        await mgr.subscribe(cid2, "ch")
        ws_bad.send_text = AsyncMock(side_effect=ConnectionError("gone"))
        n = await mgr.broadcast("ch", {"x": 1}, sender_user_id=VALID_TOKEN)
        assert n == 1
        assert cid2 not in mgr._connections


# -- Redis adapter tests (mocked) --


class TestRedisPubSubAdapter:
    @pytest.mark.asyncio
    async def test_publish_calls_redis(self):
        mgr = WebSocketManager()
        adapter = RedisPubSubAdapter("redis://mock:6379/0", mgr)
        adapter._redis = AsyncMock()
        adapter._pubsub = AsyncMock()
        await adapter.publish("ch", '{"data":"test"}')
        adapter._redis.publish.assert_awaited_once_with("ch", '{"data":"test"}')

    @pytest.mark.asyncio
    async def test_subscribe_starts_listener(self):
        mgr = WebSocketManager()
        adapter = RedisPubSubAdapter("redis://mock:6379/0", mgr)
        adapter._redis = AsyncMock()
        adapter._pubsub = AsyncMock()
        adapter._pubsub.listen = MagicMock(return_value=_empty_aiter())
        await adapter.subscribe("bounty:1")
        assert "bounty:1" in adapter._channels
        assert adapter._listener_task is not None
        await adapter.close()

    @pytest.mark.asyncio
    async def test_listener_dispatches_messages(self):
        mgr = WebSocketManager()
        mgr.dispatch_local = AsyncMock(return_value=1)
        adapter = RedisPubSubAdapter("redis://mock:6379/0", mgr)
        adapter._redis = AsyncMock()
        adapter._pubsub = AsyncMock()
        messages = [
            {"type": "subscribe", "channel": "ch", "data": None},
            {"type": "message", "channel": "ch", "data": '{"test":1}'},
        ]
        adapter._pubsub.listen = MagicMock(return_value=_async_iter(messages))
        await adapter.listen()
        mgr.dispatch_local.assert_awaited_once_with("ch", '{"test":1}')

    @pytest.mark.asyncio
    async def test_init_falls_back_to_inmemory(self):
        mgr = WebSocketManager()
        with patch("app.services.websocket_manager.REDIS_URL", "redis://bad:9999"):
            with patch.object(
                RedisPubSubAdapter, "_connect", side_effect=ConnectionError
            ):
                await mgr.init()
        assert isinstance(mgr._adapter, InMemoryPubSubAdapter)


# -- Rate limiting --


class TestRateLimiting:
    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self, connected):
        mgr, cid, _ = connected
        with patch("app.services.websocket_manager.RATE_LIMIT_MAX", 3):
            for _ in range(3):
                await mgr.handle_message(cid, json.dumps({"type": "pong"}))
            resp = await mgr.handle_message(cid, json.dumps({"type": "pong"}))
            assert resp is not None and "rate limit" in resp["detail"]


# -- Channel lifecycle --


class TestChannelLifecycle:
    @pytest.mark.asyncio
    async def test_subscribe_unsubscribe(self, connected):
        mgr, cid, _ = connected
        resp = await mgr.handle_message(
            cid, json.dumps({"type": "subscribe", "channel": "b:42"})
        )
        assert resp["type"] == "subscribed"
        resp = await mgr.handle_message(
            cid, json.dumps({"type": "unsubscribe", "channel": "b:42"})
        )
        assert resp["type"] == "unsubscribed"
        assert "b:42" not in mgr._subscriptions

    @pytest.mark.asyncio
    async def test_disconnect_cleans_subscriptions(self, connected):
        mgr, cid, _ = connected
        await mgr.subscribe(cid, "ch1")
        await mgr.subscribe(cid, "ch2")
        await mgr.disconnect(cid)
        assert "ch1" not in mgr._subscriptions and cid not in mgr._connections

    @pytest.mark.asyncio
    async def test_invalid_json_error(self, connected):
        mgr, cid, _ = connected
        resp = await mgr.handle_message(cid, "not json")
        assert resp["type"] == "error" and "invalid JSON" in resp["detail"]

    @pytest.mark.asyncio
    async def test_unknown_type_error(self, connected):
        mgr, cid, _ = connected
        resp = await mgr.handle_message(cid, json.dumps({"type": "foobar"}))
        assert resp["type"] == "error" and "unknown" in resp["detail"]


# -- Integration --


class TestEndpoint:
    @pytest.mark.asyncio
    async def test_connect_without_token_rejected(self):
        from app.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/ws")
            assert resp.status_code in (403, 422, 400)


# -- helpers --


async def _empty_aiter():
    return
    yield


async def _async_iter(items):
    for item in items:
        yield item
