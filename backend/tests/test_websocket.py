import asyncio
import json
import pytest
import pytest_asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.testclient import TestClient
import jwt

from backend.app import app
from backend.models import User, Bounty, BountyStatus
from backend.websocket.manager import WebSocketManager, ConnectionManager
from backend.websocket.events import EventTypes, format_bounty_event, format_pr_event
from backend.websocket.auth import authenticate_websocket
from backend.database import get_db


class TestWebSocketAuth:
    """Test WebSocket JWT authentication"""

    @pytest.fixture
    def valid_token(self, test_user):
        payload = {
            "sub": str(test_user.id),
            "username": test_user.username,
            "exp": 9999999999
        }
        return jwt.encode(payload, "test-secret", algorithm="HS256")

    @pytest.fixture
    def expired_token(self, test_user):
        payload = {
            "sub": str(test_user.id),
            "username": test_user.username,
            "exp": 1000000000
        }
        return jwt.encode(payload, "test-secret", algorithm="HS256")

    @pytest.mark.asyncio
    async def test_authenticate_valid_token(self, valid_token, test_user, mock_db):
        mock_db.query().filter().first.return_value = test_user

        result = await authenticate_websocket(valid_token, mock_db)

        assert result == test_user
        mock_db.query.assert_called_once_with(User)

    @pytest.mark.asyncio
    async def test_authenticate_expired_token(self, expired_token, mock_db):
        result = await authenticate_websocket(expired_token, mock_db)
        assert result is None

    @pytest.mark.asyncio
    async def test_authenticate_invalid_token(self, mock_db):
        result = await authenticate_websocket("invalid.token.here", mock_db)
        assert result is None

    @pytest.mark.asyncio
    async def test_authenticate_user_not_found(self, valid_token, mock_db):
        mock_db.query().filter().first.return_value = None

        result = await authenticate_websocket(valid_token, mock_db)
        assert result is None


class TestEventFormatting:
    """Test WebSocket event message formatting"""

    def test_format_bounty_event_update(self, test_bounty):
        event = format_bounty_event(
            event_type=EventTypes.BOUNTY_UPDATE,
            bounty=test_bounty,
            data={"status": "in_progress"}
        )

        assert event["type"] == EventTypes.BOUNTY_UPDATE
        assert event["bounty_id"] == test_bounty.id
        assert event["data"]["status"] == "in_progress"
        assert "timestamp" in event

    def test_format_pr_event_submitted(self, test_bounty):
        pr_data = {
            "pr_number": 123,
            "author": "testdev",
            "title": "Fix bounty issue",
            "url": "https://github.com/test/repo/pull/123"
        }

        event = format_pr_event(
            event_type=EventTypes.PR_SUBMITTED,
            bounty_id=test_bounty.id,
            pr_data=pr_data
        )

        assert event["type"] == EventTypes.PR_SUBMITTED
        assert event["bounty_id"] == test_bounty.id
        assert event["data"]["pr_number"] == 123
        assert event["data"]["author"] == "testdev"

    def test_format_payout_event(self, test_bounty):
        payout_data = {
            "amount": "500000",
            "token": "FNDRY",
            "recipient": "test_wallet_address",
            "transaction_id": "tx123"
        }

        event = {
            "type": EventTypes.PAYOUT_SENT,
            "bounty_id": test_bounty.id,
            "data": payout_data,
            "timestamp": "2024-01-01T00:00:00Z"
        }

        assert event["type"] == EventTypes.PAYOUT_SENT
        assert event["data"]["amount"] == "500000"
        assert event["data"]["token"] == "FNDRY"


class TestConnectionManager:
    """Test WebSocket connection management"""

    @pytest.fixture
    def manager(self):
        return ConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        ws = Mock(spec=WebSocket)
        ws.send_text = AsyncMock()
        ws.accept = AsyncMock()
        ws.close = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_connect_user(self, manager, mock_websocket, test_user):
        await manager.connect(mock_websocket, test_user)

        assert test_user.id in manager.active_connections
        assert mock_websocket in manager.active_connections[test_user.id]
        mock_websocket.accept.assert_called_once()

    @pytest.mark.asyncio
    async def test_disconnect_user(self, manager, mock_websocket, test_user):
        await manager.connect(mock_websocket, test_user)
        manager.disconnect(mock_websocket, test_user.id)

        assert mock_websocket not in manager.active_connections.get(test_user.id, [])

    @pytest.mark.asyncio
    async def test_send_personal_message(self, manager, mock_websocket, test_user):
        await manager.connect(mock_websocket, test_user)

        message = {"type": "test", "data": "hello"}
        await manager.send_personal_message(message, test_user.id)

        mock_websocket.send_text.assert_called_once_with(json.dumps(message))

    @pytest.mark.asyncio
    async def test_broadcast_to_room(self, manager, mock_websocket, test_user, test_bounty):
        await manager.connect(mock_websocket, test_user)
        manager.subscribe_to_room(test_user.id, f"bounty_{test_bounty.id}")

        message = {"type": "bounty_update", "bounty_id": test_bounty.id}
        await manager.broadcast_to_room(f"bounty_{test_bounty.id}", message)

        mock_websocket.send_text.assert_called_once_with(json.dumps(message))

    def test_subscribe_to_room(self, manager, test_user, test_bounty):
        room = f"bounty_{test_bounty.id}"
        manager.subscribe_to_room(test_user.id, room)

        assert room in manager.room_subscriptions
        assert test_user.id in manager.room_subscriptions[room]

    def test_unsubscribe_from_room(self, manager, test_user, test_bounty):
        room = f"bounty_{test_bounty.id}"
        manager.subscribe_to_room(test_user.id, room)
        manager.unsubscribe_from_room(test_user.id, room)

        assert test_user.id not in manager.room_subscriptions.get(room, set())

    @pytest.mark.asyncio
    async def test_heartbeat_mechanism(self, manager, mock_websocket, test_user):
        await manager.connect(mock_websocket, test_user)

        await manager.send_heartbeat(test_user.id)

        expected_message = {"type": "heartbeat", "timestamp": pytest.approx(float, abs=1)}
        call_args = mock_websocket.send_text.call_args[0][0]
        sent_message = json.loads(call_args)

        assert sent_message["type"] == "heartbeat"
        assert "timestamp" in sent_message

    @pytest.mark.asyncio
    async def test_handle_stale_connections(self, manager, mock_websocket, test_user):
        mock_websocket.send_text.side_effect = Exception("Connection lost")
        await manager.connect(mock_websocket, test_user)

        await manager.send_heartbeat(test_user.id)

        # Connection should be removed after failed heartbeat
        assert mock_websocket not in manager.active_connections.get(test_user.id, [])


class TestWebSocketManager:
    """Test high-level WebSocket manager with Redis integration"""

    @pytest.fixture
    def mock_redis(self):
        redis = AsyncMock()
        redis.publish = AsyncMock()
        redis.subscribe = AsyncMock()
        return redis

    @pytest.fixture
    def ws_manager(self, mock_redis):
        manager = WebSocketManager()
        manager.redis = mock_redis
        return manager

    @pytest.mark.asyncio
    async def test_publish_event_to_redis(self, ws_manager, mock_redis, test_bounty):
        event = {
            "type": EventTypes.BOUNTY_UPDATE,
            "bounty_id": test_bounty.id,
            "data": {"status": "completed"}
        }

        await ws_manager.publish_event(event)

        mock_redis.publish.assert_called_once_with(
            "websocket_events",
            json.dumps(event)
        )

    @pytest.mark.asyncio
    async def test_handle_redis_message(self, ws_manager):
        ws_manager.connection_manager = Mock()
        ws_manager.connection_manager.broadcast_to_room = AsyncMock()

        message_data = {
            "type": EventTypes.BOUNTY_UPDATE,
            "bounty_id": 123,
            "data": {"status": "in_review"}
        }

        await ws_manager.handle_redis_message(json.dumps(message_data))

        ws_manager.connection_manager.broadcast_to_room.assert_called_once_with(
            "bounty_123",
            message_data
        )

    @pytest.mark.asyncio
    async def test_bounty_status_change_broadcast(self, ws_manager, test_bounty):
        ws_manager.connection_manager = Mock()
        ws_manager.connection_manager.broadcast_to_room = AsyncMock()

        await ws_manager.broadcast_bounty_update(
            bounty=test_bounty,
            event_type=EventTypes.BOUNTY_UPDATE,
            data={"status": "completed", "completed_at": "2024-01-01T12:00:00Z"}
        )

        # Should broadcast to bounty-specific room
        expected_room = f"bounty_{test_bounty.id}"
        ws_manager.connection_manager.broadcast_to_room.assert_called_once()

        call_args = ws_manager.connection_manager.broadcast_to_room.call_args
        assert call_args[0][0] == expected_room
        assert call_args[0][1]["type"] == EventTypes.BOUNTY_UPDATE


class TestWebSocketEndpoints:
    """Integration tests for WebSocket endpoints"""

    @pytest.fixture
    def client(self):
        return TestClient(app)

    @pytest.mark.asyncio
    async def test_websocket_connection_with_valid_token(self, client, valid_token):
        with patch('backend.websocket.auth.authenticate_websocket') as mock_auth:
            mock_auth.return_value = Mock(id=1, username="testuser")

            with client.websocket_connect(f"/ws?token={valid_token}") as websocket:
                # Connection should be established
                assert websocket is not None

    @pytest.mark.asyncio
    async def test_websocket_connection_rejected_invalid_token(self, client):
        with pytest.raises(Exception):
            with client.websocket_connect("/ws?token=invalid_token") as websocket:
                pass

    @pytest.mark.asyncio
    async def test_websocket_room_subscription(self, client, valid_token):
        with patch('backend.websocket.auth.authenticate_websocket') as mock_auth:
            mock_auth.return_value = Mock(id=1, username="testuser")

            with client.websocket_connect(f"/ws?token={valid_token}") as websocket:
                # Send subscription message
                subscribe_msg = {
                    "action": "subscribe",
                    "room": "bounty_123"
                }
                websocket.send_json(subscribe_msg)

                # Should receive confirmation
                response = websocket.receive_json()
                assert response.get("type") == "subscription_confirmed"

    @pytest.mark.asyncio
    async def test_websocket_handles_disconnect_gracefully(self, client, valid_token):
        with patch('backend.websocket.auth.authenticate_websocket') as mock_auth:
            mock_auth.return_value = Mock(id=1, username="testuser")

            try:
                with client.websocket_connect(f"/ws?token={valid_token}") as websocket:
                    websocket.close()
            except WebSocketDisconnect:
                # Should handle disconnect gracefully
                pass


class TestRedisIntegration:
    """Test Redis pub/sub integration for multi-worker scenarios"""

    @pytest.fixture
    def mock_redis_client(self):
        client = AsyncMock()
        client.pubsub = Mock()
        pubsub = AsyncMock()
        client.pubsub.return_value = pubsub
        return client, pubsub

    @pytest.mark.asyncio
    async def test_redis_pubsub_listener(self, mock_redis_client):
        redis_client, pubsub = mock_redis_client

        # Mock message from Redis
        mock_message = {
            "type": "message",
            "data": json.dumps({
                "type": EventTypes.PR_SUBMITTED,
                "bounty_id": 123,
                "data": {"pr_number": 456}
            }).encode()
        }

        pubsub.listen = AsyncMock(return_value=[mock_message])

        manager = WebSocketManager()
        manager.redis = redis_client
        manager.connection_manager = Mock()
        manager.connection_manager.broadcast_to_room = AsyncMock()

        # Start listening (would run in background task)
        async for message in pubsub.listen():
            if message["type"] == "message":
                await manager.handle_redis_message(message["data"].decode())
                break

        manager.connection_manager.broadcast_to_room.assert_called_once()

    @pytest.mark.asyncio
    async def test_cross_worker_event_propagation(self, mock_redis_client):
        redis_client, _ = mock_redis_client

        manager = WebSocketManager()
        manager.redis = redis_client

        event = {
            "type": EventTypes.PAYOUT_SENT,
            "bounty_id": 789,
            "data": {
                "amount": "1000000",
                "recipient": "wallet_address"
            }
        }

        await manager.publish_event(event)

        redis_client.publish.assert_called_once_with(
            "websocket_events",
            json.dumps(event)
        )


class TestGracefulDegradation:
    """Test fallback mechanisms and error handling"""

    @pytest.mark.asyncio
    async def test_redis_connection_failure_fallback(self):
        manager = WebSocketManager()
        manager.redis = None  # Simulate Redis unavailable
        manager.connection_manager = Mock()
        manager.connection_manager.broadcast_to_room = AsyncMock()

        # Should still work locally without Redis
        event = {"type": "test", "bounty_id": 123}
        await manager.publish_event_local(event)

        manager.connection_manager.broadcast_to_room.assert_called_once()

    @pytest.mark.asyncio
    async def test_websocket_connection_limit(self):
        manager = ConnectionManager(max_connections_per_user=2)
        user_id = 1

        # Mock WebSocket connections
        ws1, ws2, ws3 = Mock(), Mock(), Mock()
        ws1.accept = AsyncMock()
        ws2.accept = AsyncMock()
        ws3.accept = AsyncMock()
        ws1.close = AsyncMock()

        user = Mock(id=user_id)

        # Add connections up to limit
        await manager.connect(ws1, user)
        await manager.connect(ws2, user)

        # Third connection should close oldest
        await manager.connect(ws3, user)

        ws1.close.assert_called_once()
        assert len(manager.active_connections[user_id]) == 2

    @pytest.mark.asyncio
    async def test_malformed_message_handling(self):
        manager = WebSocketManager()
        manager.connection_manager = Mock()

        # Should not crash on malformed JSON
        try:
            await manager.handle_redis_message("{invalid json")
        except Exception as e:
            pytest.fail(f"Should handle malformed messages gracefully: {e}")

    @pytest.mark.asyncio
    async def test_connection_cleanup_on_error(self):
        manager = ConnectionManager()
        mock_ws = Mock()
        mock_ws.accept = AsyncMock()
        mock_ws.send_text = AsyncMock(side_effect=Exception("Connection broken"))

        user = Mock(id=1)
        await manager.connect(mock_ws, user)

        # Sending message should fail and clean up connection
        message = {"type": "test"}
        try:
            await manager.send_personal_message(message, user.id)
        except:
            pass

        # Connection should be removed from active connections
        assert mock_ws not in manager.active_connections.get(user.id, [])
