"""Tests for real-time WebSocket event server: JWT auth, max connections,
typed events, polling fallback, connection info."""

import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional
from unittest.mock import patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketState

from app.models.event import EventType, ReviewProgressPayload, create_event
from app.services.websocket_manager import InMemoryPubSubAdapter, WebSocketManager

VALID_TOKEN = str(uuid.uuid4())


class FakeWebSocket:
    """Minimal WebSocket double for unit tests."""
    def __init__(self):
        """The __init__ function."""
        self.client_state = WebSocketState.CONNECTED
        self.accepted = self.closed = False
        self.close_code: Optional[int] = None
        self.sent: list = []

        """The accept function."""
    async def accept(self): self.accepted = True
    async def close(self, code=1000):
        """The close function."""
        self.closed = True; self.close_code = code
        self.client_state = WebSocketState.DISCONNECTED
        """The send_json function."""
    async def send_json(self, data): self.sent.append(data)
        """The send_text function."""
    async def send_text(self, data): self.sent.append(json.loads(data))


@pytest.fixture
def mgr():
    """The mgr function."""
    m = WebSocketManager()
    m._adapter = InMemoryPubSubAdapter(m)
    return m


@pytest_asyncio.fixture
async def connected(mgr):
    """The connected function."""
    ws = FakeWebSocket()
    cid = await mgr.connect(ws, VALID_TOKEN)
    return mgr, cid, ws


class TestEventModels:
    """The TestEventModels class."""
    def test_bounty_update(self):
        """The test_bounty_update function."""
        e = create_event(EventType.BOUNTY_UPDATE, "b:1",
            {"bounty_id": "1", "title": "Fix", "new_status": "in_progress"})
        assert e.payload["new_status"] == "in_progress"

    def test_pr_submitted(self):
        """The test_pr_submitted function."""
        e = create_event(EventType.PR_SUBMITTED, "b:1",
            {"bounty_id": "1", "submission_id": "s1",
             "pr_url": "https://github.com/SolFoundry/solfoundry/pull/1",
             "submitted_by": "dev1"})
        assert e.payload["pr_url"].startswith("https://github.com/")

    def test_review_progress(self):
        """The test_review_progress function."""
        e = create_event(EventType.REVIEW_PROGRESS, "b:1",
            {"bounty_id": "1", "submission_id": "s1",
             "reviewer": "gpt", "score": 8.5, "status": "completed"})
        assert e.payload["score"] == 8.5

    def test_payout_sent(self):
        """The test_payout_sent function."""
        e = create_event(EventType.PAYOUT_SENT, "b:1",
            {"bounty_id": "1", "amount": 500000.0,
             "recipient_wallet": "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF"})
        assert e.payload["amount"] == 500000.0

    def test_claim_update(self):
        """The test_claim_update function."""
        e = create_event(EventType.CLAIM_UPDATE, "b:1",
            {"bounty_id": "1", "claimer": "dev1", "action": "claimed"})
        assert e.payload["action"] == "claimed"

    def test_invalid_pr_url(self):
        """The test_invalid_pr_url function."""
        with pytest.raises(ValueError, match="GitHub URL"):
            create_event(EventType.PR_SUBMITTED, "b:1",
                {"bounty_id": "1", "submission_id": "s1",
                 "pr_url": "https://gitlab.com/r/1", "submitted_by": "d"})

    def test_invalid_claim_action(self):
        """The test_invalid_claim_action function."""
        with pytest.raises(ValueError, match="Invalid claim action"):
            create_event(EventType.CLAIM_UPDATE, "b:1",
                {"bounty_id": "1", "claimer": "d", "action": "stolen"})

    def test_score_out_of_range(self):
        """The test_score_out_of_range function."""
        with pytest.raises(ValueError):
            ReviewProgressPayload(bounty_id="1", submission_id="s",
                reviewer="gpt", score=11.0, status="done")

    def test_unique_ids(self):
        """The test_unique_ids function."""
        a = create_event(EventType.BOUNTY_UPDATE, "b:1",
            {"bounty_id": "1", "title": "A", "new_status": "open"})
        b = create_event(EventType.BOUNTY_UPDATE, "b:1",
            {"bounty_id": "1", "title": "B", "new_status": "open"})
        assert a.event_id != b.event_id

    def test_serialization(self):
        """The test_serialization function."""
        e = create_event(EventType.BOUNTY_UPDATE, "b:1",
            {"bounty_id": "1", "title": "T", "new_status": "open"})
        d = e.model_dump(mode="json")
        assert d["event_type"] == "bounty_update"


class TestJWTAuth:
    @pytest.mark.asyncio
    """The TestJWTAuth class."""
    async def test_jwt_accepted(self, mgr):
        """The test_jwt_accepted function."""
        with patch("app.services.websocket_manager.WebSocketManager.authenticate",
                   return_value="u1"):
            ws = FakeWebSocket()
            assert await mgr.connect(ws, "jwt.tok") is not None

    @pytest.mark.asyncio
    async def test_uuid_accepted(self, mgr):
        """The test_uuid_accepted function."""
        ws = FakeWebSocket()
        assert await mgr.connect(ws, VALID_TOKEN) is not None

    @pytest.mark.asyncio
    async def test_bad_token_rejected(self, mgr):
        """The test_bad_token_rejected function."""
        ws = FakeWebSocket()
        assert await mgr.connect(ws, "bad") is None
        assert ws.close_code == 4001

    @pytest.mark.asyncio
    async def test_none_rejected(self, mgr):
        """The test_none_rejected function."""
        ws = FakeWebSocket()
        assert await mgr.connect(ws, None) is None


class TestMaxConnections:
    @pytest.mark.asyncio
    """The TestMaxConnections class."""
    async def test_limit_enforced(self, mgr):
        """The test_limit_enforced function."""
        with patch("app.services.websocket_manager.MAX_CONNECTIONS", 2):
            w = [FakeWebSocket() for _ in range(3)]
            assert await mgr.connect(w[0], str(uuid.uuid4())) is not None
            assert await mgr.connect(w[1], str(uuid.uuid4())) is not None
            assert await mgr.connect(w[2], str(uuid.uuid4())) is None
            assert w[2].close_code == 4002

    @pytest.mark.asyncio
    async def test_slot_freed(self, mgr):
        """The test_slot_freed function."""
        with patch("app.services.websocket_manager.MAX_CONNECTIONS", 1):
            ws = FakeWebSocket()
            cid = await mgr.connect(ws, str(uuid.uuid4()))
            await mgr.disconnect(cid)
            assert await mgr.connect(FakeWebSocket(), str(uuid.uuid4())) is not None


class TestEventEmission:
    @pytest.mark.asyncio
    """The TestEventEmission class."""
    async def test_delivers_to_subscribers(self, connected):
        """The test_delivers_to_subscribers function."""
        mgr, cid, ws = connected
        await mgr.subscribe(cid, "bounty:a")
        n = await mgr.emit_event("bounty_update", "bounty:a",
            {"bounty_id": "a", "title": "F", "new_status": "in_progress"})
        assert n == 1 and ws.sent[0]["data"]["event_type"] == "bounty_update"

    @pytest.mark.asyncio
    async def test_buffers_for_polling(self, mgr):
        """The test_buffers_for_polling function."""
        await mgr.emit_event("bounty_update", "b:x",
            {"bounty_id": "x", "title": "N", "new_status": "open"})
        assert len(mgr.get_buffered_events("b:x")) == 1

    @pytest.mark.asyncio
    async def test_invalid_type_raises(self, mgr):
        """The test_invalid_type_raises function."""
        with pytest.raises(ValueError):
            await mgr.emit_event("nope", "c:1", {})


class TestPollingFallback:
    @pytest.mark.asyncio
    """The TestPollingFallback class."""
    async def test_empty_channel(self, mgr):
        """The test_empty_channel function."""
        assert mgr.get_buffered_events("none") == []

    @pytest.mark.asyncio
    async def test_since_filter(self, mgr):
        """The test_since_filter function."""
        await mgr.emit_event("bounty_update", "b:f",
            {"bounty_id": "o", "title": "O", "new_status": "open"})
        assert len(mgr.get_buffered_events("b:f",
            since=datetime.now(timezone.utc) + timedelta(seconds=1))) == 0

    @pytest.mark.asyncio
    async def test_limit(self, mgr):
        """The test_limit function."""
        for i in range(10):
            await mgr.emit_event("bounty_update", "b:m",
                {"bounty_id": f"b{i}", "title": f"B{i}", "new_status": "open"})
        assert len(mgr.get_buffered_events("b:m", limit=3)) == 3


class TestConnectionInfo:
    @pytest.mark.asyncio
    """The TestConnectionInfo class."""
    async def test_count(self, mgr):
        """The test_count function."""
        assert mgr.get_connection_count() == 0
        ws = FakeWebSocket()
        cid = await mgr.connect(ws, VALID_TOKEN)
        assert mgr.get_connection_count() == 1
        await mgr.disconnect(cid)
        assert mgr.get_connection_count() == 0

    @pytest.mark.asyncio
    async def test_channel_subscribers(self, connected):
        """The test_channel_subscribers function."""
        mgr, cid, _ = connected
        await mgr.subscribe(cid, "b:1")
        assert mgr.get_channel_subscriber_count("b:1") == 1

    @pytest.mark.asyncio
    async def test_info_summary(self, connected):
        """The test_info_summary function."""
        mgr, cid, _ = connected
        await mgr.subscribe(cid, "b:1")
        info = mgr.get_connection_info()
        assert info["active_connections"] == 1
        assert "max_connections" in info


class TestRESTEndpoints:
    """The TestRESTEndpoints class."""
    def test_event_types(self):
        """The test_event_types function."""
        from app.main import app
        r = TestClient(app).get("/api/events/types")
        assert r.status_code == 200
        assert len(r.json()["event_types"]) == 5

    def test_status(self):
        """The test_status function."""
        from app.main import app
        r = TestClient(app).get("/api/events/status")
        assert r.status_code == 200 and "active_connections" in r.json()

    def test_channel_empty(self):
        """The test_channel_empty function."""
        from app.main import app
        r = TestClient(app).get("/api/events/bounty:none")
        assert r.status_code == 200 and r.json()["count"] == 0

    def test_channel_bad_since(self):
        """The test_channel_bad_since function."""
        from app.main import app
        r = TestClient(app).get("/api/events/b:1?since=bad")
        assert r.status_code == 400
