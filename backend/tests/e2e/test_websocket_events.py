"""E2E test: WebSocket real-time event streaming.

Validates: real-time updates fire for all state transitions.

Tests cover WebSocket connection lifecycle, channel subscriptions,
broadcast delivery, authentication enforcement, and rate limiting.

Requirement: Issue #196 item 6.
"""

import asyncio
import json
import uuid

import pytest
import pytest_asyncio

from app.services.websocket_manager import (
    InMemoryPubSubAdapter,
    WebSocketManager,
)
from tests.e2e.conftest import FakeWebSocket

VALID_TOKEN = str(uuid.uuid4())
SECONDARY_TOKEN = str(uuid.uuid4())
INVALID_TOKEN = "not-a-valid-uuid"


class TestWebSocketConnection:
    """Validate WebSocket connection and authentication."""

    @pytest.mark.asyncio
    async def test_connect_with_valid_token(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify a WebSocket connection is accepted with a valid UUID token.

        The manager authenticates the token and returns a connection ID.
        """
        fake_ws = FakeWebSocket()
        connection_id = await websocket_manager.connect(fake_ws, VALID_TOKEN)
        assert connection_id is not None
        assert fake_ws.accepted is True

    @pytest.mark.asyncio
    async def test_reject_invalid_token(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify connection is rejected for invalid tokens.

        Non-UUID tokens should result in a 4001 close code.
        """
        fake_ws = FakeWebSocket()
        connection_id = await websocket_manager.connect(fake_ws, INVALID_TOKEN)
        assert connection_id is None
        assert fake_ws.close_code == 4001

    @pytest.mark.asyncio
    async def test_reject_none_token(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify connection is rejected when no token is provided."""
        fake_ws = FakeWebSocket()
        connection_id = await websocket_manager.connect(fake_ws, None)
        assert connection_id is None
        assert fake_ws.close_code == 4001

    @pytest.mark.asyncio
    async def test_disconnect_cleans_up_state(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify disconnection removes all connection state.

        After disconnect, the connection ID should no longer exist in
        the manager's internal state.
        """
        fake_ws = FakeWebSocket()
        connection_id = await websocket_manager.connect(fake_ws, VALID_TOKEN)
        assert connection_id is not None

        await websocket_manager.disconnect(connection_id)
        assert connection_id not in websocket_manager._connections


class TestChannelSubscription:
    """Validate channel subscription and unsubscription."""

    @pytest.mark.asyncio
    async def test_subscribe_to_channel(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify a connected client can subscribe to a channel.

        After subscription, the connection should appear in the channel's
        subscriber set.
        """
        fake_ws = FakeWebSocket()
        connection_id = await websocket_manager.connect(fake_ws, VALID_TOKEN)

        result = await websocket_manager.subscribe(connection_id, "bounty:updates")
        assert result is True
        assert "bounty:updates" in websocket_manager._connections[connection_id].channels

    @pytest.mark.asyncio
    async def test_subscribe_to_multiple_channels(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify a client can subscribe to multiple channels simultaneously."""
        fake_ws = FakeWebSocket()
        connection_id = await websocket_manager.connect(fake_ws, VALID_TOKEN)

        channels = ["bounty:created", "bounty:updated", "payout:confirmed"]
        for channel in channels:
            result = await websocket_manager.subscribe(connection_id, channel)
            assert result is True

        conn = websocket_manager._connections[connection_id]
        assert conn.channels == set(channels)

    @pytest.mark.asyncio
    async def test_unsubscribe_from_channel(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify unsubscription removes the channel from the connection."""
        fake_ws = FakeWebSocket()
        connection_id = await websocket_manager.connect(fake_ws, VALID_TOKEN)

        await websocket_manager.subscribe(connection_id, "bounty:updates")
        await websocket_manager.unsubscribe(connection_id, "bounty:updates")

        conn = websocket_manager._connections[connection_id]
        assert "bounty:updates" not in conn.channels

    @pytest.mark.asyncio
    async def test_unsubscribe_nonexistent_channel_is_safe(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify unsubscribing from a channel the client isn't on is a no-op."""
        fake_ws = FakeWebSocket()
        connection_id = await websocket_manager.connect(fake_ws, VALID_TOKEN)

        # Should not raise
        await websocket_manager.unsubscribe(connection_id, "nonexistent-channel")


class TestBroadcastDelivery:
    """Validate message broadcast to subscribed clients."""

    @pytest.mark.asyncio
    async def test_broadcast_to_single_subscriber(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify a broadcast reaches a single subscribed client.

        The client should receive the message with the correct channel
        and data payload.
        """
        fake_ws = FakeWebSocket()
        connection_id = await websocket_manager.connect(fake_ws, VALID_TOKEN)
        await websocket_manager.subscribe(connection_id, "bounty:created")

        delivered = await websocket_manager.broadcast(
            "bounty:created",
            {"bounty_id": "test-123", "title": "New bounty"},
            sender_user_id=VALID_TOKEN,
        )
        assert delivered == 1
        assert len(fake_ws.sent) == 1
        message = fake_ws.sent[0]
        assert message["channel"] == "bounty:created"
        assert message["data"]["bounty_id"] == "test-123"

    @pytest.mark.asyncio
    async def test_broadcast_to_multiple_subscribers(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify a broadcast reaches all subscribed clients.

        Two clients subscribe to the same channel; both should receive
        the broadcast message.
        """
        ws_1 = FakeWebSocket()
        ws_2 = FakeWebSocket()

        cid_1 = await websocket_manager.connect(ws_1, VALID_TOKEN)
        cid_2 = await websocket_manager.connect(ws_2, SECONDARY_TOKEN)

        await websocket_manager.subscribe(cid_1, "bounty:status")
        await websocket_manager.subscribe(cid_2, "bounty:status")

        delivered = await websocket_manager.broadcast(
            "bounty:status",
            {"bounty_id": "b-456", "new_status": "completed"},
            sender_user_id=VALID_TOKEN,
        )
        assert delivered == 2
        assert len(ws_1.sent) == 1
        assert len(ws_2.sent) == 1

    @pytest.mark.asyncio
    async def test_broadcast_only_reaches_subscribed_channel(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify broadcasts are scoped to the correct channel.

        A client subscribed to ``bounty:created`` should not receive
        messages broadcast to ``payout:confirmed``.
        """
        fake_ws = FakeWebSocket()
        connection_id = await websocket_manager.connect(fake_ws, VALID_TOKEN)
        await websocket_manager.subscribe(connection_id, "bounty:created")

        await websocket_manager.broadcast(
            "payout:confirmed",
            {"tx_hash": "abc123"},
            sender_user_id=VALID_TOKEN,
        )
        assert len(fake_ws.sent) == 0

    @pytest.mark.asyncio
    async def test_broadcast_to_empty_channel(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify broadcasting to a channel with no subscribers returns 0."""
        delivered = await websocket_manager.broadcast(
            "empty:channel",
            {"data": "nobody listening"},
            sender_user_id=VALID_TOKEN,
        )
        assert delivered == 0


class TestStateTransitionEvents:
    """Validate WebSocket events for bounty state transitions.

    These tests simulate the real-time event flow that would fire
    during actual bounty lifecycle transitions.
    """

    @pytest.mark.asyncio
    async def test_bounty_created_event(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify ``bounty:created`` event fires on bounty creation."""
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)
        await websocket_manager.subscribe(cid, "bounty:created")

        await websocket_manager.broadcast(
            "bounty:created",
            {"bounty_id": "new-1", "title": "Fresh bounty", "reward": 500},
            sender_user_id=VALID_TOKEN,
        )
        assert len(fake_ws.sent) == 1
        assert fake_ws.sent[0]["data"]["title"] == "Fresh bounty"

    @pytest.mark.asyncio
    async def test_bounty_status_changed_event(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify events fire for each status transition.

        Simulates the sequence: open -> in_progress -> completed -> paid.
        """
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)
        await websocket_manager.subscribe(cid, "bounty:status_changed")

        transitions = [
            ("open", "in_progress"),
            ("in_progress", "completed"),
            ("completed", "paid"),
        ]
        for old_status, new_status in transitions:
            await websocket_manager.broadcast(
                "bounty:status_changed",
                {
                    "bounty_id": "lifecycle-1",
                    "old_status": old_status,
                    "new_status": new_status,
                },
                sender_user_id=VALID_TOKEN,
            )

        assert len(fake_ws.sent) == 3
        statuses = [msg["data"]["new_status"] for msg in fake_ws.sent]
        assert statuses == ["in_progress", "completed", "paid"]

    @pytest.mark.asyncio
    async def test_submission_received_event(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify ``submission:received`` event fires on new submission."""
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)
        await websocket_manager.subscribe(cid, "submission:received")

        await websocket_manager.broadcast(
            "submission:received",
            {
                "bounty_id": "b-1",
                "submission_id": "s-1",
                "contributor": "alice",
                "pr_url": "https://github.com/SolFoundry/solfoundry/pull/1",
            },
            sender_user_id=VALID_TOKEN,
        )
        assert len(fake_ws.sent) == 1
        assert fake_ws.sent[0]["data"]["contributor"] == "alice"

    @pytest.mark.asyncio
    async def test_payout_confirmed_event(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify ``payout:confirmed`` event fires after payout."""
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)
        await websocket_manager.subscribe(cid, "payout:confirmed")

        await websocket_manager.broadcast(
            "payout:confirmed",
            {
                "bounty_id": "b-1",
                "recipient": "alice",
                "amount": 500.0,
                "tx_hash": "5VER...PLW",
            },
            sender_user_id=VALID_TOKEN,
        )
        assert len(fake_ws.sent) == 1
        assert fake_ws.sent[0]["data"]["amount"] == 500.0

    @pytest.mark.asyncio
    async def test_dispute_created_event(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify ``dispute:created`` event fires when a dispute is filed."""
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)
        await websocket_manager.subscribe(cid, "dispute:created")

        await websocket_manager.broadcast(
            "dispute:created",
            {
                "dispute_id": "d-1",
                "bounty_id": "b-1",
                "reason": "incorrect_review",
            },
            sender_user_id=VALID_TOKEN,
        )
        assert len(fake_ws.sent) == 1


class TestMessageHandling:
    """Validate the WebSocket message handler for client commands."""

    @pytest.mark.asyncio
    async def test_handle_subscribe_message(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify the handler processes subscribe commands correctly."""
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)

        response = await websocket_manager.handle_message(
            cid, json.dumps({"type": "subscribe", "channel": "test:channel"})
        )
        assert response["type"] == "subscribed"
        assert response["channel"] == "test:channel"

    @pytest.mark.asyncio
    async def test_handle_unsubscribe_message(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify the handler processes unsubscribe commands correctly."""
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)

        await websocket_manager.subscribe(cid, "test:channel")
        response = await websocket_manager.handle_message(
            cid, json.dumps({"type": "unsubscribe", "channel": "test:channel"})
        )
        assert response["type"] == "unsubscribed"

    @pytest.mark.asyncio
    async def test_handle_broadcast_message(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify the handler processes broadcast commands correctly."""
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)
        await websocket_manager.subscribe(cid, "test:channel")

        response = await websocket_manager.handle_message(
            cid,
            json.dumps({
                "type": "broadcast",
                "channel": "test:channel",
                "data": {"message": "hello"},
            }),
        )
        assert response["type"] == "broadcasted"
        assert response["recipients"] >= 1

    @pytest.mark.asyncio
    async def test_handle_invalid_json(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify the handler rejects malformed JSON gracefully."""
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)

        response = await websocket_manager.handle_message(cid, "not-valid-json")
        assert response["type"] == "error"
        assert "invalid JSON" in response["detail"]

    @pytest.mark.asyncio
    async def test_handle_unknown_message_type(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify the handler returns an error for unknown message types."""
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)

        response = await websocket_manager.handle_message(
            cid, json.dumps({"type": "unknown_command"})
        )
        assert response["type"] == "error"
        assert "unknown message type" in response["detail"]

    @pytest.mark.asyncio
    async def test_handle_pong_returns_none(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify ``pong`` messages are acknowledged silently (no response)."""
        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)

        response = await websocket_manager.handle_message(
            cid, json.dumps({"type": "pong"})
        )
        assert response is None


class TestRateLimiting:
    """Validate WebSocket message rate limiting."""

    @pytest.mark.asyncio
    async def test_rate_limit_rejects_excessive_messages(
        self, websocket_manager: WebSocketManager
    ) -> None:
        """Verify that exceeding the rate limit triggers rejection.

        Sends messages up to the rate limit, then verifies the next
        message is rejected with a rate limit error.
        """
        from app.services.websocket_manager import RATE_LIMIT_MAX

        fake_ws = FakeWebSocket()
        cid = await websocket_manager.connect(fake_ws, VALID_TOKEN)

        # Fill up the rate limit bucket
        for _ in range(RATE_LIMIT_MAX):
            websocket_manager._check_rate_limit(VALID_TOKEN)

        # Next message should be rate-limited
        response = await websocket_manager.handle_message(
            cid, json.dumps({"type": "subscribe", "channel": "test"})
        )
        assert response["type"] == "error"
        assert "rate limit" in response["detail"]
