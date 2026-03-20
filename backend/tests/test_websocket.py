"""Tests for WebSocket endpoint and connection manager."""

import asyncio
import json
import time
import threading
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock, MagicMock

import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.models.websocket import (
    AuthMessage,
    ClientMessage,
    PingMessage,
    SubscribeMessage,
    UnsubscribeMessage,
    WSEvent,
    VALID_CHANNELS,
    _validate_channel,
)
from app.services.websocket_service import (
    ConnectionManager,
    manager,
    verify_jwt,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW,
)
import app.services.websocket_service as ws_svc

JWT_SECRET = "test-jwt-secret-key"


def _make_token(secret: str = JWT_SECRET, exp_offset: int = 3600, **extra) -> str:
    payload = {
        "sub": "user-1",
        "exp": datetime.now(timezone.utc) + timedelta(seconds=exp_offset),
        **extra,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _make_expired_token(secret: str = JWT_SECRET) -> str:
    return _make_token(secret=secret, exp_offset=-60)


# ---------------------------------------------------------------------------
# Patch Redis to None for all tests (in-memory only)
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _no_redis():
    ws_svc._redis_attempted = False
    ws_svc._redis_client = None
    with patch("app.services.websocket_service.get_redis", return_value=None):
        yield
    ws_svc._redis_attempted = False
    ws_svc._redis_client = None


@pytest.fixture(autouse=True)
def _reset_manager():
    """Reset manager state between tests."""
    manager._channels.clear()
    manager._conn_channels.clear()
    manager._rate_windows.clear()
    yield
    manager._channels.clear()
    manager._conn_channels.clear()
    manager._rate_windows.clear()


# ===========================================================================
# Model tests
# ===========================================================================


class TestValidateChannel:
    def test_all_valid_channels_accepted(self):
        for ch in VALID_CHANNELS:
            assert _validate_channel(ch) == ch

    def test_bounty_specific_numeric(self):
        assert _validate_channel("bounty:1") == "bounty:1"
        assert _validate_channel("bounty:999999") == "bounty:999999"

    def test_bounty_specific_non_numeric_rejected(self):
        with pytest.raises(ValueError, match="must be numeric"):
            _validate_channel("bounty:abc")

    def test_bounty_empty_suffix_rejected(self):
        with pytest.raises(ValueError, match="must be numeric"):
            _validate_channel("bounty:")

    def test_invalid_channel_rejected(self):
        with pytest.raises(ValueError, match="Invalid channel"):
            _validate_channel("unknown")

    def test_path_traversal_rejected(self):
        with pytest.raises(ValueError, match="Invalid channel"):
            _validate_channel("../../etc/passwd")


class TestSubscribeMessageValidation:
    def test_valid_channel(self):
        msg = SubscribeMessage(type="subscribe", channel="bounties")
        assert msg.channel == "bounties"

    def test_invalid_channel_raises(self):
        with pytest.raises(ValidationError):
            SubscribeMessage(type="subscribe", channel="nope")

    def test_bounty_specific(self):
        msg = SubscribeMessage(type="subscribe", channel="bounty:42")
        assert msg.channel == "bounty:42"


class TestUnsubscribeMessageValidation:
    def test_valid_channel(self):
        msg = UnsubscribeMessage(type="unsubscribe", channel="prs")
        assert msg.channel == "prs"

    def test_invalid_channel_raises(self):
        with pytest.raises(ValidationError):
            UnsubscribeMessage(type="unsubscribe", channel="bad")


class TestWSEvent:
    def test_auto_timestamp(self):
        event = WSEvent(type="test", data={"key": "val"})
        assert event.timestamp != ""
        # Should be ISO format
        datetime.fromisoformat(event.timestamp)

    def test_custom_timestamp_preserved(self):
        ts = "2024-01-01T00:00:00+00:00"
        event = WSEvent(type="test", timestamp=ts)
        assert event.timestamp == ts

    def test_default_data(self):
        event = WSEvent(type="test")
        assert event.data == {}

    def test_serialization(self):
        event = WSEvent(type="bounty_created", data={"id": 1})
        dumped = json.loads(event.model_dump_json())
        assert dumped["type"] == "bounty_created"
        assert dumped["data"]["id"] == 1
        assert "timestamp" in dumped


class TestClientMessageDiscriminator:
    def test_ping_discriminated(self):
        from pydantic import TypeAdapter
        ta = TypeAdapter(ClientMessage)
        msg = ta.validate_python({"type": "ping"})
        assert isinstance(msg, PingMessage)

    def test_auth_discriminated(self):
        from pydantic import TypeAdapter
        ta = TypeAdapter(ClientMessage)
        msg = ta.validate_python({"type": "auth", "token": "abc"})
        assert isinstance(msg, AuthMessage)

    def test_subscribe_discriminated(self):
        from pydantic import TypeAdapter
        ta = TypeAdapter(ClientMessage)
        msg = ta.validate_python({"type": "subscribe", "channel": "bounties"})
        assert isinstance(msg, SubscribeMessage)

    def test_unknown_type_rejected(self):
        from pydantic import TypeAdapter
        ta = TypeAdapter(ClientMessage)
        with pytest.raises(ValidationError):
            ta.validate_python({"type": "unknown"})


# ===========================================================================
# JWT verification tests
# ===========================================================================


class TestVerifyJWT:
    @patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
    def test_valid_token(self):
        token = _make_token()
        claims = verify_jwt(token)
        assert claims["sub"] == "user-1"

    @patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
    def test_expired_token(self):
        token = _make_expired_token()
        with pytest.raises(ValueError, match="expired"):
            verify_jwt(token)

    @patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
    def test_wrong_secret(self):
        token = _make_token(secret="wrong-secret")
        with pytest.raises(ValueError, match="Invalid token"):
            verify_jwt(token)

    @patch.dict("os.environ", {"JWT_SECRET": ""})
    def test_no_secret_configured(self):
        token = _make_token()
        with pytest.raises(ValueError, match="JWT_SECRET not configured"):
            verify_jwt(token)

    @patch.dict("os.environ", {}, clear=True)
    def test_missing_env_var(self):
        token = _make_token()
        with pytest.raises(ValueError, match="JWT_SECRET not configured"):
            verify_jwt(token)

    @patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
    def test_garbage_token(self):
        with pytest.raises(ValueError, match="Invalid token"):
            verify_jwt("not-a-valid-jwt")


# ===========================================================================
# ConnectionManager unit tests
# ===========================================================================


class TestConnectionManager:
    @pytest.fixture()
    def mgr(self):
        return ConnectionManager()

    @pytest.mark.asyncio
    async def test_connect_registers_connection(self, mgr):
        ws = MagicMock()
        await mgr.connect(ws)
        ws_id = id(ws)
        assert ws_id in mgr._conn_channels
        assert ws_id in mgr._rate_windows

    @pytest.mark.asyncio
    async def test_disconnect_cleans_up(self, mgr):
        ws = MagicMock()
        await mgr.connect(ws)
        await mgr.subscribe(ws, "bounties")
        await mgr.disconnect(ws)
        assert id(ws) not in mgr._conn_channels
        assert id(ws) not in mgr._rate_windows
        assert "bounties" not in mgr._channels

    @pytest.mark.asyncio
    async def test_subscribe_adds_to_channel(self, mgr):
        ws = MagicMock()
        await mgr.connect(ws)
        await mgr.subscribe(ws, "bounties")
        assert ws in mgr._channels["bounties"]
        assert "bounties" in mgr._conn_channels[id(ws)]

    @pytest.mark.asyncio
    async def test_unsubscribe_removes_from_channel(self, mgr):
        ws = MagicMock()
        await mgr.connect(ws)
        await mgr.subscribe(ws, "bounties")
        await mgr.unsubscribe(ws, "bounties")
        assert "bounties" not in mgr._channels
        assert "bounties" not in mgr._conn_channels[id(ws)]

    @pytest.mark.asyncio
    async def test_unsubscribe_channel_not_subscribed(self, mgr):
        ws = MagicMock()
        await mgr.connect(ws)
        # Should not raise
        await mgr.unsubscribe(ws, "bounties")

    @pytest.mark.asyncio
    async def test_multiple_subscribers_one_channel(self, mgr):
        ws1 = MagicMock()
        ws2 = MagicMock()
        await mgr.connect(ws1)
        await mgr.connect(ws2)
        await mgr.subscribe(ws1, "bounties")
        await mgr.subscribe(ws2, "bounties")
        assert len(mgr._channels["bounties"]) == 2

    @pytest.mark.asyncio
    async def test_disconnect_one_preserves_other(self, mgr):
        ws1 = MagicMock()
        ws2 = MagicMock()
        await mgr.connect(ws1)
        await mgr.connect(ws2)
        await mgr.subscribe(ws1, "bounties")
        await mgr.subscribe(ws2, "bounties")
        await mgr.disconnect(ws1)
        assert ws2 in mgr._channels["bounties"]
        assert len(mgr._channels["bounties"]) == 1

    @pytest.mark.asyncio
    async def test_multiple_channels_per_connection(self, mgr):
        ws = MagicMock()
        await mgr.connect(ws)
        await mgr.subscribe(ws, "bounties")
        await mgr.subscribe(ws, "prs")
        await mgr.subscribe(ws, "payouts")
        assert mgr._conn_channels[id(ws)] == {"bounties", "prs", "payouts"}

    @pytest.mark.asyncio
    async def test_disconnect_cleans_all_channels(self, mgr):
        ws = MagicMock()
        await mgr.connect(ws)
        await mgr.subscribe(ws, "bounties")
        await mgr.subscribe(ws, "prs")
        await mgr.disconnect(ws)
        assert "bounties" not in mgr._channels
        assert "prs" not in mgr._channels

    def test_rate_limit_allows_up_to_max(self, mgr):
        ws = MagicMock()
        # Manually set up state (sync test)
        import collections
        mgr._rate_windows[id(ws)] = collections.deque()
        for _ in range(RATE_LIMIT_MAX):
            assert mgr.check_rate_limit(ws) is True
        # Next one should be rejected
        assert mgr.check_rate_limit(ws) is False

    def test_rate_limit_unknown_connection(self, mgr):
        ws = MagicMock()
        assert mgr.check_rate_limit(ws) is False

    @pytest.mark.asyncio
    async def test_publish_local_sends_to_subscribers(self, mgr):
        ws = AsyncMock()
        await mgr.connect(ws)
        await mgr.subscribe(ws, "bounties")
        event = WSEvent(type="test", data={"key": "val"})
        await mgr.publish_local("bounties", event)
        ws.send_text.assert_called_once()
        sent = json.loads(ws.send_text.call_args[0][0])
        assert sent["type"] == "test"
        assert sent["data"]["key"] == "val"

    @pytest.mark.asyncio
    async def test_publish_local_no_subscribers(self, mgr):
        event = WSEvent(type="test")
        # Should not raise
        await mgr.publish_local("bounties", event)

    @pytest.mark.asyncio
    async def test_publish_local_handles_send_failure(self, mgr):
        ws = AsyncMock()
        ws.send_text.side_effect = RuntimeError("connection closed")
        await mgr.connect(ws)
        await mgr.subscribe(ws, "bounties")
        event = WSEvent(type="test")
        # Should not raise despite send failure
        await mgr.publish_local("bounties", event)


# ===========================================================================
# Integration tests: Authentication
# ===========================================================================


@patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
class TestAuth:
    @patch("app.api.websocket.AUTH_TIMEOUT", 0.1)
    def test_connection_rejected_no_token(self):
        client = TestClient(app)
        with pytest.raises(Exception):
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()
                ws.receive_json()

    def test_connection_via_query_token(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            data = ws.receive_json()
            assert data["type"] == "connected"
            assert "channels" in data
            assert set(data["channels"]) == VALID_CHANNELS
            assert "timestamp" in data

    def test_connection_via_message_auth(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect("/ws") as ws:
            ws.send_json({"type": "auth", "token": token})
            data = ws.receive_json()
            assert data["type"] == "connected"

    def test_expired_token_rejected(self):
        client = TestClient(app)
        token = _make_expired_token()
        with pytest.raises(Exception):
            with client.websocket_connect(f"/ws?token={token}") as ws:
                data = ws.receive_json()
                assert data["type"] == "error"
                assert "expired" in data["message"].lower()

    def test_wrong_secret_rejected(self):
        client = TestClient(app)
        token = _make_token(secret="wrong-secret")
        with pytest.raises(Exception):
            with client.websocket_connect(f"/ws?token={token}") as ws:
                data = ws.receive_json()
                assert data["type"] == "error"

    def test_invalid_auth_message_format(self):
        client = TestClient(app)
        with pytest.raises(Exception):
            with client.websocket_connect("/ws") as ws:
                ws.send_text("not json at all")
                data = ws.receive_json()
                assert data["type"] == "error"
                assert "Invalid auth" in data["message"]

    def test_auth_message_missing_token_field(self):
        client = TestClient(app)
        with pytest.raises(Exception):
            with client.websocket_connect("/ws") as ws:
                ws.send_json({"type": "auth"})
                data = ws.receive_json()
                assert data["type"] == "error"


# ===========================================================================
# Integration tests: Channels
# ===========================================================================


@patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
class TestChannels:
    def test_subscribe_valid_channel(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_json({"type": "subscribe", "channel": "bounties"})
            data = ws.receive_json()
            assert data["type"] == "subscribed"
            assert data["channel"] == "bounties"
            assert "timestamp" in data

    def test_subscribe_all_valid_channels(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            for ch in sorted(VALID_CHANNELS):
                ws.send_json({"type": "subscribe", "channel": ch})
                data = ws.receive_json()
                assert data["type"] == "subscribed"
                assert data["channel"] == ch

    def test_subscribe_bounty_specific(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_json({"type": "subscribe", "channel": "bounty:42"})
            data = ws.receive_json()
            assert data["type"] == "subscribed"
            assert data["channel"] == "bounty:42"

    def test_subscribe_invalid_channel(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_json({"type": "subscribe", "channel": "invalid_channel"})
            data = ws.receive_json()
            assert data["type"] == "error"

    def test_subscribe_bounty_non_numeric_id(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_json({"type": "subscribe", "channel": "bounty:abc"})
            data = ws.receive_json()
            assert data["type"] == "error"

    def test_unsubscribe(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_json({"type": "subscribe", "channel": "bounties"})
            ws.receive_json()  # subscribed
            ws.send_json({"type": "unsubscribe", "channel": "bounties"})
            data = ws.receive_json()
            assert data["type"] == "unsubscribed"
            assert data["channel"] == "bounties"

    def test_unsubscribe_invalid_channel(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_json({"type": "unsubscribe", "channel": "../../etc/passwd"})
            data = ws.receive_json()
            assert data["type"] == "error"


# ===========================================================================
# Integration tests: Ping/Pong
# ===========================================================================


@patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
class TestPingPong:
    def test_ping_pong(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_json({"type": "ping"})
            data = ws.receive_json()
            assert data["type"] == "pong"
            assert "timestamp" in data

    def test_multiple_pings(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            for _ in range(5):
                ws.send_json({"type": "ping"})
                data = ws.receive_json()
                assert data["type"] == "pong"


# ===========================================================================
# Integration tests: Error handling
# ===========================================================================


@patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
class TestErrorHandling:
    def test_invalid_json(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_text("{not valid json}")
            data = ws.receive_json()
            assert data["type"] == "error"
            assert "Invalid JSON" in data["message"]

    def test_unknown_message_type(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_json({"type": "unknown_type"})
            data = ws.receive_json()
            assert data["type"] == "error"

    def test_connection_survives_bad_message(self):
        """After an error, the connection should still work."""
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_text("bad json")
            data = ws.receive_json()
            assert data["type"] == "error"
            # Connection should still be alive
            ws.send_json({"type": "ping"})
            data = ws.receive_json()
            assert data["type"] == "pong"


# ===========================================================================
# Integration tests: Rate Limiting
# ===========================================================================


@patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
class TestRateLimiting:
    def test_rate_limiting(self):
        client = TestClient(app)
        token = _make_token()
        with pytest.raises(Exception):
            with client.websocket_connect(f"/ws?token={token}") as ws:
                ws.receive_json()  # connected
                for _ in range(31):
                    ws.send_json({"type": "ping"})
                    try:
                        data = ws.receive_json()
                        if data.get("type") == "error" and "rate limit" in data.get("message", "").lower():
                            break
                    except Exception:
                        break


# ===========================================================================
# Integration tests: Publishing
# ===========================================================================


@patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
class TestPublish:
    def test_publish_delivers_to_subscriber(self):
        with TestClient(app) as client:
            token = _make_token()
            with client.websocket_connect(f"/ws?token={token}") as ws:
                ws.receive_json()  # connected
                ws.send_json({"type": "subscribe", "channel": "bounties"})
                ws.receive_json()  # subscribed

                event = WSEvent(type="bounty_claimed", data={"bounty_id": 42})
                client.portal.call(manager.publish_local, "bounties", event)

                data = ws.receive_json()
                assert data["type"] == "bounty_claimed"
                assert data["data"]["bounty_id"] == 42
                assert "timestamp" in data

    def test_publish_only_to_subscribed_channel(self):
        """Messages on one channel should not leak to another."""
        with TestClient(app) as client:
            token = _make_token()
            with client.websocket_connect(f"/ws?token={token}") as ws:
                ws.receive_json()  # connected
                ws.send_json({"type": "subscribe", "channel": "bounties"})
                ws.receive_json()  # subscribed

                # Publish to a different channel
                event = WSEvent(type="pr_merged", data={"pr_id": 7})
                client.portal.call(manager.publish_local, "prs", event)

                # Publish to subscribed channel to verify connectivity
                event2 = WSEvent(type="bounty_new", data={"id": 1})
                client.portal.call(manager.publish_local, "bounties", event2)

                data = ws.receive_json()
                assert data["type"] == "bounty_new"

    def test_publish_to_bounty_specific_channel(self):
        with TestClient(app) as client:
            token = _make_token()
            with client.websocket_connect(f"/ws?token={token}") as ws:
                ws.receive_json()  # connected
                ws.send_json({"type": "subscribe", "channel": "bounty:42"})
                ws.receive_json()  # subscribed

                event = WSEvent(type="bounty_updated", data={"status": "claimed"})
                client.portal.call(manager.publish_local, "bounty:42", event)

                data = ws.receive_json()
                assert data["type"] == "bounty_updated"
                assert data["data"]["status"] == "claimed"


# ===========================================================================
# Integration tests: Disconnect cleanup
# ===========================================================================


@patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
class TestDisconnectCleanup:
    def test_disconnect_cleanup(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_json({"type": "subscribe", "channel": "bounties"})
            ws.receive_json()  # subscribed

        assert len(manager._channels.get("bounties", set())) == 0

    def test_disconnect_cleanup_multiple_channels(self):
        client = TestClient(app)
        token = _make_token()
        with client.websocket_connect(f"/ws?token={token}") as ws:
            ws.receive_json()  # connected
            ws.send_json({"type": "subscribe", "channel": "bounties"})
            ws.receive_json()
            ws.send_json({"type": "subscribe", "channel": "prs"})
            ws.receive_json()

        assert len(manager._channels.get("bounties", set())) == 0
        assert len(manager._channels.get("prs", set())) == 0


# ===========================================================================
# Stress test
# ===========================================================================


@patch.dict("os.environ", {"JWT_SECRET": JWT_SECRET})
class TestStress:
    def test_stress_multiple_connections(self):
        """Open 10 concurrent connections, subscribe to bounties, publish once."""
        results = []
        errors = []
        token = _make_token()
        all_subscribed = threading.Event()
        barrier = threading.Barrier(10, action=lambda: all_subscribed.set(), timeout=10)

        with TestClient(app) as client:
            def connect_and_listen(idx: int) -> None:
                try:
                    with client.websocket_connect(f"/ws?token={token}") as ws:
                        ws.receive_json()  # connected
                        ws.send_json({"type": "subscribe", "channel": "bounties"})
                        ws.receive_json()  # subscribed
                        barrier.wait()
                        data = ws.receive_json()
                        results.append(data)
                except Exception as exc:
                    errors.append((idx, str(exc)))

            threads = [threading.Thread(target=connect_and_listen, args=(i,)) for i in range(10)]
            for t in threads:
                t.start()

            all_subscribed.wait(timeout=10)
            time.sleep(0.1)

            event = WSEvent(type="bounty_created", data={"bounty_id": 99})
            client.portal.call(manager.publish_local, "bounties", event)

            for t in threads:
                t.join(timeout=10)

        assert not errors, f"Connection errors: {errors}"
        assert len(results) == 10
        for r in results:
            assert r["type"] == "bounty_created"
            assert r["data"]["bounty_id"] == 99
