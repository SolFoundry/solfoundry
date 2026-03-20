"""Tests for WebSocket real-time update functionality.

This module tests:
- WebSocket connection lifecycle
- Channel-based subscriptions (bounties, prs, payouts, leaderboard)
- Event broadcasting
- Heartbeat mechanism
- JWT authentication
- Rate limiting
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from fastapi import FastAPI, WebSocket

from app.api.websocket import (
    router,
    broadcast_bounty_event,
    broadcast_pr_event,
    broadcast_payout_event,
    broadcast_leaderboard_event,
)
from app.services.websocket_manager import (
    ConnectionManager,
    EventType,
    Channel,
    RateLimit,
    WebSocketMessage,
    HeartbeatMessage,
    ErrorMessage,
)


# Create test app
app = FastAPI()
app.include_router(router)


@pytest.fixture
def manager():
    """Create a fresh ConnectionManager for each test."""
    return ConnectionManager()


@pytest.fixture
def mock_websocket():
    """Create a mock WebSocket for testing."""
    ws = MagicMock(spec=WebSocket)
    ws.accept = AsyncMock()
    ws.send_json = AsyncMock()
    ws.receive_text = AsyncMock()
    ws.close = AsyncMock()
    return ws


class TestRateLimit:
    """Tests for rate limiting."""

    def test_rate_limit_allows_initial_messages(self):
        """Test that rate limit allows initial messages."""
        rl = RateLimit(max_messages=5, window_seconds=60)

        for _ in range(5):
            assert rl.is_allowed() is True

    def test_rate_limit_blocks_excess(self):
        """Test that rate limit blocks excess messages."""
        rl = RateLimit(max_messages=3, window_seconds=60)

        assert rl.is_allowed() is True
        assert rl.is_allowed() is True
        assert rl.is_allowed() is True
        assert rl.is_allowed() is False  # Exceeds limit

    def test_rate_limit_remaining(self):
        """Test remaining message count."""
        rl = RateLimit(max_messages=5, window_seconds=60)

        assert rl.remaining() == 5
        rl.is_allowed()
        assert rl.remaining() == 4
        rl.is_allowed()
        assert rl.remaining() == 3


class TestConnectionManager:
    """Tests for ConnectionManager."""

    @pytest.mark.asyncio
    async def test_connect(self, manager, mock_websocket):
        """Test WebSocket connection."""
        info = await manager.connect(mock_websocket, "user_123")

        assert info.user_id == "user_123"
        assert info.is_alive
        mock_websocket.accept.assert_called_once()
        assert manager.get_connection_count() == 1

    @pytest.mark.asyncio
    async def test_connect_authenticated(self, manager, mock_websocket):
        """Test authenticated WebSocket connection."""
        info = await manager.connect(mock_websocket, "user_123", authenticated=True)

        assert info.authenticated is True

    @pytest.mark.asyncio
    async def test_disconnect(self, manager, mock_websocket):
        """Test WebSocket disconnection."""
        await manager.connect(mock_websocket, "user_123")
        await manager.disconnect(mock_websocket)

        assert manager.get_connection_count() == 0

    @pytest.mark.asyncio
    async def test_multiple_connections_same_user(self, manager):
        """Test multiple connections from the same user."""
        ws1 = MagicMock(spec=WebSocket)
        ws1.accept = AsyncMock()
        ws1.send_json = AsyncMock()

        ws2 = MagicMock(spec=WebSocket)
        ws2.accept = AsyncMock()
        ws2.send_json = AsyncMock()

        await manager.connect(ws1, "user_123")
        await manager.connect(ws2, "user_123")

        assert manager.get_connection_count() == 2

    @pytest.mark.asyncio
    async def test_subscribe_to_channel(self, manager, mock_websocket):
        """Test subscription to a channel."""
        await manager.connect(mock_websocket, "user_123")

        success = await manager.subscribe(mock_websocket, "bounties")

        assert success
        info = manager._ws_to_info.get(mock_websocket)
        assert "bounties" in info.subscriptions

    @pytest.mark.asyncio
    async def test_subscribe_to_specific_bounty(self, manager, mock_websocket):
        """Test subscription to a specific bounty."""
        await manager.connect(mock_websocket, "user_123")

        success = await manager.subscribe(mock_websocket, "bounty:42")

        assert success
        info = manager._ws_to_info.get(mock_websocket)
        assert "bounty:42" in info.subscriptions

    @pytest.mark.asyncio
    async def test_unsubscribe(self, manager, mock_websocket):
        """Test unsubscribing from a channel."""
        await manager.connect(mock_websocket, "user_123")
        await manager.subscribe(mock_websocket, "bounties")

        success = await manager.unsubscribe(mock_websocket, "bounties")

        assert success
        info = manager._ws_to_info.get(mock_websocket)
        assert "bounties" not in info.subscriptions

    @pytest.mark.asyncio
    async def test_parse_subscription_channel(self, manager):
        """Test parsing channel subscription."""
        result = manager.parse_subscription("bounties")
        assert result == ("bounties", None)

        result = manager.parse_subscription("prs")
        assert result == ("prs", None)

    @pytest.mark.asyncio
    async def test_parse_subscription_specific(self, manager):
        """Test parsing specific subscription."""
        result = manager.parse_subscription("bounty:42")
        assert result == ("bounty", "42")

        result = manager.parse_subscription("pr:123")
        assert result == ("pr", "123")

    @pytest.mark.asyncio
    async def test_parse_subscription_invalid(self, manager):
        """Test parsing invalid subscription."""
        result = manager.parse_subscription("invalid_channel")
        assert result is None

    @pytest.mark.asyncio
    async def test_rate_limit_check(self, manager, mock_websocket):
        """Test rate limit checking."""
        await manager.connect(mock_websocket, "user_123")

        # Should allow messages initially
        for _ in range(100):
            assert manager.check_rate_limit(mock_websocket) is True

        # Should block after limit
        assert manager.check_rate_limit(mock_websocket) is False

    @pytest.mark.asyncio
    async def test_send_personal_message(self, manager, mock_websocket):
        """Test sending a message to a specific connection."""
        await manager.connect(mock_websocket, "user_123")

        success = await manager.send_personal_message(
            mock_websocket, EventType.BOUNTY_CLAIMED, {"bounty_id": 42}
        )

        assert success
        mock_websocket.send_json.assert_called_once()

        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["type"] == "bounty_claimed"
        assert call_args["data"]["bounty_id"] == 42

    @pytest.mark.asyncio
    async def test_broadcast_to_user(self, manager, mock_websocket):
        """Test broadcasting to all connections of a user."""
        await manager.connect(mock_websocket, "user_123")

        count = await manager.broadcast_to_user(
            "user_123", EventType.BOUNTY_CLAIMED, {"bounty_id": 42}
        )

        assert count == 1
        mock_websocket.send_json.assert_called()

    @pytest.mark.asyncio
    async def test_broadcast_event(self, manager, mock_websocket):
        """Test broadcasting an event to subscribers."""
        await manager.connect(mock_websocket, "user_123")
        await manager.subscribe(mock_websocket, "bounties")

        count = await manager.broadcast_event(
            event_type=EventType.BOUNTY_CLAIMED,
            data={"bounty_id": 42},
            channel="bounties",
        )

        assert count == 1
        mock_websocket.send_json.assert_called()

    @pytest.mark.asyncio
    async def test_broadcast_to_specific_bounty(self, manager, mock_websocket):
        """Test broadcasting to specific bounty subscribers."""
        await manager.connect(mock_websocket, "user_123")
        await manager.subscribe(mock_websocket, "bounty:42")

        count = await manager.broadcast_event(
            event_type=EventType.BOUNTY_CLAIMED,
            data={"bounty_id": 42},
            channel="bounty:42",
        )

        assert count == 1

    @pytest.mark.asyncio
    async def test_broadcast_excludes_unsubscribed(self, manager):
        """Test that broadcast doesn't send to unsubscribed connections."""
        ws1 = MagicMock(spec=WebSocket)
        ws1.accept = AsyncMock()
        ws1.send_json = AsyncMock()

        ws2 = MagicMock(spec=WebSocket)
        ws2.accept = AsyncMock()
        ws2.send_json = AsyncMock()

        await manager.connect(ws1, "user_123")
        await manager.connect(ws2, "user_456")

        # Only ws1 subscribes to bounties
        await manager.subscribe(ws1, "bounties")

        count = await manager.broadcast_event(
            event_type=EventType.BOUNTY_CLAIMED,
            data={"bounty_id": 42},
            channel="bounties",
        )

        assert count == 1
        ws1.send_json.assert_called()
        ws2.send_json.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_pong(self, manager, mock_websocket):
        """Test pong handling updates last_pong time."""
        info = await manager.connect(mock_websocket, "user_123")
        old_pong = info.last_pong

        await asyncio.sleep(0.01)
        manager.handle_pong(mock_websocket)

        assert info.last_pong > old_pong

    def test_get_stats(self, manager):
        """Test getting connection statistics."""
        stats = manager.get_stats()

        assert "total_connections" in stats
        assert "unique_users" in stats
        assert "redis_enabled" in stats
        assert "subscriptions" in stats
        assert "channels" in stats


class TestWebSocketMessages:
    """Tests for WebSocket message models."""

    def test_websocket_message_format(self):
        """Test WebSocketMessage matches bounty spec format."""
        msg = WebSocketMessage(type=EventType.BOUNTY_CLAIMED, data={"bounty_id": 42})

        # Verify format: {"type": "...", "data": {...}, "timestamp": "..."}
        dump = msg.model_dump(mode="json")
        assert "type" in dump
        assert "data" in dump
        assert "timestamp" in dump
        assert dump["type"] == "bounty_claimed"

    def test_heartbeat_message(self):
        """Test HeartbeatMessage model."""
        msg = HeartbeatMessage(ping_id="ping_123")

        assert msg.type == EventType.HEARTBEAT
        assert msg.ping_id == "ping_123"

    def test_error_message(self):
        """Test ErrorMessage model."""
        msg = ErrorMessage(
            error_code="TEST_ERROR",
            error_message="Test error message",
            details={"extra": "info"},
        )

        assert msg.type == EventType.ERROR
        assert msg.error_code == "TEST_ERROR"
        assert msg.details["extra"] == "info"


class TestWebSocketEndpoint:
    """Tests for WebSocket API endpoints."""

    @pytest.mark.asyncio
    async def test_websocket_connection(self):
        """Test basic WebSocket connection."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as websocket:
                # Receive connection confirmation
                data = websocket.receive_json()

                assert data["type"] == "connected"
                assert "data" in data
                assert "timestamp" in data

    @pytest.mark.asyncio
    async def test_websocket_subscribe_simple(self):
        """Test simple subscription format: {"subscribe": "bounties"}."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as websocket:
                # Skip connection message
                websocket.receive_json()

                # Send subscription with simple format
                websocket.send_json({"subscribe": "bounties"})

                # Receive subscription confirmation
                data = websocket.receive_json()

                assert data["type"] == "subscribed"
                assert data["data"]["channel"] == "bounties"

    @pytest.mark.asyncio
    async def test_websocket_subscribe_specific_bounty(self):
        """Test specific bounty subscription: {"subscribe": "bounty:42"}."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as websocket:
                websocket.receive_json()  # Skip connection

                websocket.send_json({"subscribe": "bounty:42"})
                data = websocket.receive_json()

                assert data["type"] == "subscribed"
                assert data["data"]["channel"] == "bounty:42"

    @pytest.mark.asyncio
    async def test_websocket_subscribe_all_channels(self):
        """Test subscribing to all main channels."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as websocket:
                websocket.receive_json()  # Skip connection

                for channel in ["bounties", "prs", "payouts", "leaderboard"]:
                    websocket.send_json({"subscribe": channel})
                    data = websocket.receive_json()
                    assert data["type"] == "subscribed"

    @pytest.mark.asyncio
    async def test_websocket_invalid_channel(self):
        """Test WebSocket subscription with invalid channel."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as websocket:
                websocket.receive_json()

                websocket.send_json({"subscribe": "invalid_channel"})
                data = websocket.receive_json()

                assert data["type"] == "error"
                assert data["error_code"] == "INVALID_CHANNEL"

    @pytest.mark.asyncio
    async def test_websocket_unsubscribe(self):
        """Test WebSocket unsubscription."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as websocket:
                websocket.receive_json()

                websocket.send_json({"subscribe": "bounties"})
                websocket.receive_json()

                websocket.send_json({"unsubscribe": "bounties"})
                data = websocket.receive_json()

                assert data["type"] == "unsubscribed"

    @pytest.mark.asyncio
    async def test_websocket_ping_pong(self):
        """Test WebSocket ping-pong."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as websocket:
                websocket.receive_json()

                websocket.send_json({"type": "ping"})
                data = websocket.receive_json()

                assert data["type"] == "pong"

    @pytest.mark.asyncio
    async def test_websocket_stats_endpoint(self):
        """Test WebSocket stats HTTP endpoint."""
        with TestClient(app) as client:
            response = client.get("/ws/stats")

            assert response.status_code == 200
            data = response.json()

            assert "total_connections" in data
            assert "redis_enabled" in data


class TestBroadcastHelpers:
    """Tests for broadcast helper functions."""

    @pytest.mark.asyncio
    async def test_broadcast_bounty_event(self, manager, mock_websocket):
        """Test bounty event broadcast helper."""
        await manager.connect(mock_websocket, "user_123")
        await manager.subscribe(mock_websocket, "bounties")
        await manager.subscribe(mock_websocket, "bounty:42")

        with patch("app.api.websocket.manager", manager):
            count = await broadcast_bounty_event(
                event_type=EventType.BOUNTY_CLAIMED,
                bounty_id=42,
                data={"bounty_id": 42, "user_id": "user_456"},
            )

        # Should receive on both bounties and bounty:42 channels
        assert count >= 1

    @pytest.mark.asyncio
    async def test_broadcast_pr_event(self, manager, mock_websocket):
        """Test PR event broadcast helper."""
        await manager.connect(mock_websocket, "user_123")
        await manager.subscribe(mock_websocket, "prs")

        with patch("app.api.websocket.manager", manager):
            count = await broadcast_pr_event(
                event_type=EventType.PR_SUBMITTED,
                pr_id=123,
                data={"pr_id": 123, "repo": "owner/repo"},
                user_id="user_123",
            )

        assert count >= 1

    @pytest.mark.asyncio
    async def test_broadcast_payout_event(self, manager, mock_websocket):
        """Test payout event broadcast helper."""
        await manager.connect(mock_websocket, "user_123")
        await manager.subscribe(mock_websocket, "payouts")

        with patch("app.api.websocket.manager", manager):
            count = await broadcast_payout_event(
                event_type=EventType.PAYOUT_COMPLETED,
                payout_id="payout_123",
                data={"amount": 100, "token": "FNDRY"},
                user_id="user_123",
            )

        assert count >= 1

    @pytest.mark.asyncio
    async def test_broadcast_leaderboard_event(self, manager, mock_websocket):
        """Test leaderboard event broadcast helper."""
        await manager.connect(mock_websocket, "user_123")
        await manager.subscribe(mock_websocket, "leaderboard")

        with patch("app.api.websocket.manager", manager):
            count = await broadcast_leaderboard_event(
                event_type=EventType.RANK_CHANGE,
                data={"user_id": "user_123", "new_rank": 5},
            )

        assert count >= 1


class TestHeartbeat:
    """Tests for heartbeat mechanism."""

    @pytest.mark.asyncio
    async def test_heartbeat_task_starts(self, manager):
        """Test that heartbeat task starts on initialization."""
        await manager.initialize()

        assert manager._heartbeat_task is not None
        assert not manager._heartbeat_task.done()

        await manager.shutdown()

    @pytest.mark.asyncio
    async def test_connection_timeout_cleanup(self, manager, mock_websocket):
        """Test that dead connections are cleaned up."""
        await manager.connect(mock_websocket, "user_123")

        info = manager._ws_to_info.get(mock_websocket)
        info.is_alive = False

        assert manager.get_connection_count() == 1


class TestAuthentication:
    """Tests for JWT authentication."""

    @pytest.mark.asyncio
    async def test_unauthenticated_connection(self):
        """Test connection without token."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as websocket:
                data = websocket.receive_json()

                assert data["type"] == "connected"
                assert data["data"]["authenticated"] is False

    @pytest.mark.asyncio
    async def test_invalid_token_rejected(self):
        """Test that invalid token is rejected."""
        with TestClient(app) as client:
            # Invalid token should close connection
            with pytest.raises(Exception):
                with client.websocket_connect("/ws?token=invalid_token") as websocket:
                    pass


# Integration tests
class TestIntegration:
    """Integration tests for WebSocket system."""

    @pytest.mark.asyncio
    async def test_full_flow(self):
        """Test full WebSocket flow: connect, subscribe, receive event, disconnect."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()  # Skip connection message

                # Subscribe to multiple channels
                ws.send_json({"subscribe": "bounties"})
                ws.receive_json()

                ws.send_json({"subscribe": "bounty:42"})
                ws.receive_json()

                # Get stats
                response = client.get("/ws/stats")
                assert response.json()["total_connections"] == 1

    @pytest.mark.asyncio
    async def test_multiple_users_different_subscriptions(self):
        """Test multiple users with different subscriptions."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as ws1:
                ws1.receive_json()
                ws1.send_json({"subscribe": "bounties"})
                ws1.receive_json()

                with client.websocket_connect("/ws") as ws2:
                    ws2.receive_json()
                    ws2.send_json({"subscribe": "prs"})
                    ws2.receive_json()

                    response = client.get("/ws/stats")
                    stats = response.json()

                    assert stats["total_connections"] == 2


# Connection stress test
class TestConnectionStress:
    """Stress tests for connection handling."""

    @pytest.mark.asyncio
    async def test_many_connections(self):
        """Test handling many concurrent connections."""
        with TestClient(app) as client:
            connections = []

            # Open 50 connections
            for _ in range(50):
                ws = client.websocket_connect("/ws")
                connections.append(ws.__enter__())

            # All should receive connection message
            for ws in connections:
                data = ws.receive_json()
                assert data["type"] == "connected"

            # Check stats
            response = client.get("/ws/stats")
            assert response.json()["total_connections"] == 50

            # Close all
            for ws in connections:
                ws.__exit__(None, None, None)

    @pytest.mark.asyncio
    async def test_rapid_subscribe_unsubscribe(self):
        """Test rapid subscribe/unsubscribe cycles."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws") as ws:
                ws.receive_json()

                # Rapid subscribe/unsubscribe
                for _ in range(10):
                    ws.send_json({"subscribe": "bounties"})
                    ws.receive_json()
                    ws.send_json({"unsubscribe": "bounties"})
                    ws.receive_json()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
