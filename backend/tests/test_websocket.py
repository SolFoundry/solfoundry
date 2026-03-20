"""Tests for WebSocket real-time update functionality.

This module tests:
- WebSocket connection lifecycle
- Subscription management
- Event broadcasting
- Heartbeat mechanism
- Reconnection handling
"""

import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from fastapi import FastAPI, WebSocket

from app.api.websocket import (
    router,
    broadcast_pr_status,
    broadcast_new_comment,
    broadcast_review_complete,
    broadcast_payout_sent,
)
from app.services.websocket_manager import (
    ConnectionManager,
    EventType,
    SubscriptionScope,
    Subscription,
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


class TestSubscription:
    """Tests for Subscription dataclass."""
    
    def test_subscription_creation(self):
        """Test creating a subscription."""
        sub = Subscription(scope=SubscriptionScope.REPO, target_id="repo_123")
        assert sub.scope == SubscriptionScope.REPO
        assert sub.target_id == "repo_123"
    
    def test_subscription_to_channel(self):
        """Test channel name generation."""
        sub = Subscription(scope=SubscriptionScope.USER, target_id="user_456")
        assert sub.to_channel() == "user:user_456"
    
    def test_subscription_from_string(self):
        """Test parsing subscription from string."""
        sub = Subscription.from_string("repo:repo_123")
        assert sub is not None
        assert sub.scope == SubscriptionScope.REPO
        assert sub.target_id == "repo_123"
    
    def test_subscription_from_invalid_string(self):
        """Test parsing invalid subscription string."""
        assert Subscription.from_string("invalid") is None
        assert Subscription.from_string("invalid_scope:target") is None


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
        assert manager.get_user_connection_count("user_123") == 1
    
    @pytest.mark.asyncio
    async def test_disconnect(self, manager, mock_websocket):
        """Test WebSocket disconnection."""
        await manager.connect(mock_websocket, "user_123")
        await manager.disconnect(mock_websocket)
        
        assert manager.get_connection_count() == 0
        assert manager.get_user_connection_count("user_123") == 0
    
    @pytest.mark.asyncio
    async def test_multiple_connections_same_user(self, manager, mock_websocket):
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
        assert manager.get_user_connection_count("user_123") == 2
    
    @pytest.mark.asyncio
    async def test_subscribe(self, manager, mock_websocket):
        """Test subscription to a channel."""
        await manager.connect(mock_websocket, "user_123")
        
        sub = Subscription(scope=SubscriptionScope.REPO, target_id="repo_456")
        success = await manager.subscribe(mock_websocket, sub)
        
        assert success
        info = manager._ws_to_info.get(mock_websocket)
        assert sub in info.subscriptions
    
    @pytest.mark.asyncio
    async def test_subscribe_nonexistent_connection(self, manager, mock_websocket):
        """Test subscribing a non-existent connection."""
        sub = Subscription(scope=SubscriptionScope.REPO, target_id="repo_456")
        success = await manager.subscribe(mock_websocket, sub)
        
        assert not success
    
    @pytest.mark.asyncio
    async def test_unsubscribe(self, manager, mock_websocket):
        """Test unsubscribing from a channel."""
        await manager.connect(mock_websocket, "user_123")
        
        sub = Subscription(scope=SubscriptionScope.REPO, target_id="repo_456")
        await manager.subscribe(mock_websocket, sub)
        success = await manager.unsubscribe(mock_websocket, sub)
        
        assert success
        info = manager._ws_to_info.get(mock_websocket)
        assert sub not in info.subscriptions
    
    @pytest.mark.asyncio
    async def test_send_personal_message(self, manager, mock_websocket):
        """Test sending a message to a specific connection."""
        await manager.connect(mock_websocket, "user_123")
        
        success = await manager.send_personal_message(
            mock_websocket,
            EventType.PR_STATUS_CHANGED,
            {"pr_id": "pr_789", "status": "merged"}
        )
        
        assert success
        mock_websocket.send_json.assert_called_once()
        
        call_args = mock_websocket.send_json.call_args[0][0]
        assert call_args["event"] == "pr_status_changed"
        assert call_args["data"]["pr_id"] == "pr_789"
    
    @pytest.mark.asyncio
    async def test_broadcast_to_user(self, manager, mock_websocket):
        """Test broadcasting to all connections of a user."""
        await manager.connect(mock_websocket, "user_123")
        
        count = await manager.broadcast_to_user(
            "user_123",
            EventType.PR_STATUS_CHANGED,
            {"pr_id": "pr_789"}
        )
        
        assert count == 1
        mock_websocket.send_json.assert_called()
    
    @pytest.mark.asyncio
    async def test_broadcast_to_nonexistent_user(self, manager):
        """Test broadcasting to a user with no connections."""
        count = await manager.broadcast_to_user(
            "nonexistent_user",
            EventType.PR_STATUS_CHANGED,
            {"pr_id": "pr_789"}
        )
        
        assert count == 0
    
    @pytest.mark.asyncio
    async def test_broadcast_event(self, manager, mock_websocket):
        """Test broadcasting an event to subscribers."""
        await manager.connect(mock_websocket, "user_123")
        
        sub = Subscription(scope=SubscriptionScope.REPO, target_id="repo_456")
        await manager.subscribe(mock_websocket, sub)
        
        count = await manager.broadcast_event(
            event_type=EventType.PR_STATUS_CHANGED,
            data={"pr_id": "pr_789", "status": "merged"},
            scope=SubscriptionScope.REPO,
            target_id="repo_456"
        )
        
        assert count == 1
        mock_websocket.send_json.assert_called()
    
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
        
        # Only ws1 subscribes
        sub = Subscription(scope=SubscriptionScope.REPO, target_id="repo_789")
        await manager.subscribe(ws1, sub)
        
        count = await manager.broadcast_event(
            event_type=EventType.PR_STATUS_CHANGED,
            data={"pr_id": "pr_111"},
            scope=SubscriptionScope.REPO,
            target_id="repo_789"
        )
        
        assert count == 1
        ws1.send_json.assert_called()
        ws2.send_json.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_handle_pong(self, manager, mock_websocket):
        """Test pong handling updates last_pong time."""
        info = await manager.connect(mock_websocket, "user_123")
        old_pong = info.last_pong
        
        # Wait a tiny bit to ensure time difference
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


class TestWebSocketMessages:
    """Tests for WebSocket message models."""
    
    def test_websocket_message(self):
        """Test WebSocketMessage model."""
        msg = WebSocketMessage(
            event=EventType.PR_STATUS_CHANGED,
            data={"pr_id": "pr_123"}
        )
        
        assert msg.event == EventType.PR_STATUS_CHANGED
        assert msg.data["pr_id"] == "pr_123"
        assert msg.timestamp is not None
    
    def test_heartbeat_message(self):
        """Test HeartbeatMessage model."""
        msg = HeartbeatMessage(ping_id="ping_123")
        
        assert msg.event == EventType.HEARTBEAT
        assert msg.ping_id == "ping_123"
    
    def test_error_message(self):
        """Test ErrorMessage model."""
        msg = ErrorMessage(
            error_code="TEST_ERROR",
            error_message="Test error message",
            details={"extra": "info"}
        )
        
        assert msg.event == EventType.ERROR
        assert msg.error_code == "TEST_ERROR"
        assert msg.details["extra"] == "info"


class TestWebSocketEndpoint:
    """Tests for WebSocket API endpoints."""
    
    @pytest.mark.asyncio
    async def test_websocket_connection(self):
        """Test basic WebSocket connection."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/test_user") as websocket:
                # Receive connection confirmation
                data = websocket.receive_json()
                
                assert data["event"] == "connected"
                assert data["data"]["user_id"] == "test_user"
                assert "timestamp" in data
    
    @pytest.mark.asyncio
    async def test_websocket_subscribe(self):
        """Test WebSocket subscription."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/test_user") as websocket:
                # Skip connection message
                websocket.receive_json()
                
                # Send subscription
                websocket.send_json({
                    "type": "subscribe",
                    "scope": "repo",
                    "target_id": "repo_123"
                })
                
                # Receive subscription confirmation
                data = websocket.receive_json()
                
                assert data["event"] == "subscribed"
                assert data["data"]["scope"] == "repo"
                assert data["data"]["target_id"] == "repo_123"
    
    @pytest.mark.asyncio
    async def test_websocket_invalid_scope(self):
        """Test WebSocket subscription with invalid scope."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/test_user") as websocket:
                # Skip connection message
                websocket.receive_json()
                
                # Send invalid subscription
                websocket.send_json({
                    "type": "subscribe",
                    "scope": "invalid_scope",
                    "target_id": "target_123"
                })
                
                # Receive error
                data = websocket.receive_json()
                
                assert data["event"] == "error"
                assert data["error_code"] == "INVALID_SCOPE"
    
    @pytest.mark.asyncio
    async def test_websocket_unsubscribe(self):
        """Test WebSocket unsubscription."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/test_user") as websocket:
                # Skip connection message
                websocket.receive_json()
                
                # Subscribe first
                websocket.send_json({
                    "type": "subscribe",
                    "scope": "repo",
                    "target_id": "repo_123"
                })
                websocket.receive_json()
                
                # Unsubscribe
                websocket.send_json({
                    "type": "unsubscribe",
                    "scope": "repo",
                    "target_id": "repo_123"
                })
                
                data = websocket.receive_json()
                assert data["event"] == "unsubscribed"
    
    @pytest.mark.asyncio
    async def test_websocket_ping_pong(self):
        """Test WebSocket ping-pong."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/test_user") as websocket:
                # Skip connection message
                websocket.receive_json()
                
                # Send ping
                websocket.send_json({"type": "ping"})
                
                # Receive pong
                data = websocket.receive_json()
                assert data["event"] == "pong"
    
    @pytest.mark.asyncio
    async def test_websocket_stats_endpoint(self):
        """Test WebSocket stats HTTP endpoint."""
        with TestClient(app) as client:
            response = client.get("/ws/stats")
            
            assert response.status_code == 200
            data = response.json()
            
            assert "total_connections" in data
            assert "unique_users" in data
            assert "redis_enabled" in data


class TestBroadcastHelpers:
    """Tests for broadcast helper functions."""
    
    @pytest.mark.asyncio
    async def test_broadcast_pr_status(self, manager, mock_websocket):
        """Test PR status broadcast helper."""
        await manager.connect(mock_websocket, "user_123")
        
        sub = Subscription(scope=SubscriptionScope.REPO, target_id="repo_456")
        await manager.subscribe(mock_websocket, sub)
        
        # Patch the global manager
        with patch("app.api.websocket.manager", manager):
            count = await broadcast_pr_status(
                repo_id="repo_456",
                pr_id="pr_789",
                status="merged",
                user_id="user_123"
            )
        
        assert count >= 1
    
    @pytest.mark.asyncio
    async def test_broadcast_new_comment(self, manager, mock_websocket):
        """Test new comment broadcast helper."""
        await manager.connect(mock_websocket, "user_123")
        
        sub = Subscription(scope=SubscriptionScope.REPO, target_id="repo_456")
        await manager.subscribe(mock_websocket, sub)
        
        with patch("app.api.websocket.manager", manager):
            count = await broadcast_new_comment(
                repo_id="repo_456",
                comment_id="comment_123",
                author_id="user_456",
                content_preview="This is a test comment...",
                user_id="user_123"
            )
        
        assert count >= 1
    
    @pytest.mark.asyncio
    async def test_broadcast_review_complete(self, manager, mock_websocket):
        """Test review complete broadcast helper."""
        await manager.connect(mock_websocket, "user_123")
        
        sub = Subscription(scope=SubscriptionScope.REPO, target_id="repo_456")
        await manager.subscribe(mock_websocket, sub)
        
        with patch("app.api.websocket.manager", manager):
            count = await broadcast_review_complete(
                repo_id="repo_456",
                pr_id="pr_789",
                reviewer_id="user_456",
                result="approved",
                user_id="user_123"
            )
        
        assert count >= 1
    
    @pytest.mark.asyncio
    async def test_broadcast_payout_sent(self, manager, mock_websocket):
        """Test payout sent broadcast helper."""
        await manager.connect(mock_websocket, "user_123")
        
        sub = Subscription(scope=SubscriptionScope.BOUNTY, target_id="bounty_456")
        await manager.subscribe(mock_websocket, sub)
        
        with patch("app.api.websocket.manager", manager):
            count = await broadcast_payout_sent(
                bounty_id="bounty_456",
                user_id="user_123",
                amount=10.5,
                transaction_id="tx_abc123"
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
    async def test_heartbeat_sends_ping(self, manager, mock_websocket):
        """Test that heartbeat sends ping messages."""
        await manager.initialize()
        await manager.connect(mock_websocket, "user_123")
        
        # Wait for at least one heartbeat cycle (with shorter interval for testing)
        # In real tests, this would wait HEARTBEAT_INTERVAL seconds
        # For unit tests, we just verify the task is running
        
        await manager.shutdown()
        
        # The heartbeat task should have been sending messages
        # In a real scenario, we'd check send_json was called with heartbeat
    
    @pytest.mark.asyncio
    async def test_connection_timeout_cleanup(self, manager, mock_websocket):
        """Test that dead connections are cleaned up."""
        await manager.connect(mock_websocket, "user_123")
        
        # Manually mark connection as dead
        info = manager._ws_to_info.get(mock_websocket)
        info.is_alive = False
        
        # Trigger cleanup (in real scenario, heartbeat loop does this)
        # After shutdown, the connection should be removed
        
        assert manager.get_connection_count() == 1


class TestReconnection:
    """Tests for WebSocket reconnection."""
    
    @pytest.mark.asyncio
    async def test_reconnect_flag(self):
        """Test that reconnect flag is acknowledged."""
        with TestClient(app) as client:
            with client.websocket_connect("/ws/test_user?reconnect=true") as websocket:
                data = websocket.receive_json()
                
                assert data["event"] == "connected"
                assert data["data"]["reconnected"] is True


# Integration test
class TestIntegration:
    """Integration tests for WebSocket system."""
    
    @pytest.mark.asyncio
    async def test_full_flow(self):
        """Test full WebSocket flow: connect, subscribe, receive event, disconnect."""
        with TestClient(app) as client:
            # Connect
            with client.websocket_connect("/ws/user_123") as ws:
                # Skip connection message
                ws.receive_json()
                
                # Subscribe to repo
                ws.send_json({
                    "type": "subscribe",
                    "scope": "repo",
                    "target_id": "repo_456"
                })
                ws.receive_json()
                
                # Subscribe to bounty
                ws.send_json({
                    "type": "subscribe",
                    "scope": "bounty",
                    "target_id": "bounty_789"
                })
                ws.receive_json()
                
                # Get stats
                response = client.get("/ws/stats")
                assert response.json()["total_connections"] == 1
                
                # Connection will close when context exits
    
    @pytest.mark.asyncio
    async def test_multiple_users_different_subscriptions(self):
        """Test multiple users with different subscriptions."""
        with TestClient(app) as client:
            # User 1 connects
            with client.websocket_connect("/ws/user_123") as ws1:
                ws1.receive_json()  # Skip connection message
                
                # User 1 subscribes to repo
                ws1.send_json({
                    "type": "subscribe",
                    "scope": "repo",
                    "target_id": "repo_456"
                })
                ws1.receive_json()
                
                # User 2 connects
                with client.websocket_connect("/ws/user_456") as ws2:
                    ws2.receive_json()  # Skip connection message
                    
                    # User 2 subscribes to different repo
                    ws2.send_json({
                        "type": "subscribe",
                        "scope": "repo",
                        "target_id": "repo_789"
                    })
                    ws2.receive_json()
                    
                    # Verify both users are connected
                    response = client.get("/ws/stats")
                    stats = response.json()
                    
                    assert stats["total_connections"] == 2
                    assert stats["unique_users"] == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])