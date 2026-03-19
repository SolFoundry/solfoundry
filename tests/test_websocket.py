import asyncio
import json
import pytest
import websockets
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timezone

from src.websocket_server import WebSocketServer, ConnectionManager
from src.auth import JWTManager
from src.models import User


class TestConnectionManager:
    @pytest.fixture
    def connection_manager(self):
        return ConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        mock = Mock()
        mock.closed = False
        mock.send = AsyncMock()
        mock.close = AsyncMock()
        mock.remote_address = ('127.0.0.1', 12345)
        return mock

    def test_add_connection(self, connection_manager, mock_websocket):
        user_id = "user123"
        connection_manager.add_connection(user_id, mock_websocket)
        
        assert user_id in connection_manager.connections
        assert mock_websocket in connection_manager.connections[user_id]

    def test_remove_connection(self, connection_manager, mock_websocket):
        user_id = "user123"
        connection_manager.add_connection(user_id, mock_websocket)
        connection_manager.remove_connection(user_id, mock_websocket)
        
        assert user_id not in connection_manager.connections

    def test_get_user_connections(self, connection_manager, mock_websocket):
        user_id = "user123"
        connection_manager.add_connection(user_id, mock_websocket)
        
        connections = connection_manager.get_user_connections(user_id)
        assert mock_websocket in connections

    def test_get_user_connections_empty(self, connection_manager):
        connections = connection_manager.get_user_connections("nonexistent")
        assert connections == []

    @pytest.mark.asyncio
    async def test_send_to_user(self, connection_manager, mock_websocket):
        user_id = "user123"
        message = {"type": "test", "data": "hello"}
        
        connection_manager.add_connection(user_id, mock_websocket)
        await connection_manager.send_to_user(user_id, message)
        
        mock_websocket.send.assert_called_once_with(json.dumps(message))

    @pytest.mark.asyncio
    async def test_send_to_user_closed_connection(self, connection_manager, mock_websocket):
        user_id = "user123"
        message = {"type": "test", "data": "hello"}
        mock_websocket.closed = True
        
        connection_manager.add_connection(user_id, mock_websocket)
        await connection_manager.send_to_user(user_id, message)
        
        # Should not send to closed connection
        mock_websocket.send.assert_not_called()
        assert user_id not in connection_manager.connections

    @pytest.mark.asyncio
    async def test_send_to_user_send_exception(self, connection_manager, mock_websocket):
        user_id = "user123"
        message = {"type": "test", "data": "hello"}
        mock_websocket.send.side_effect = Exception("Send failed")
        
        connection_manager.add_connection(user_id, mock_websocket)
        await connection_manager.send_to_user(user_id, message)
        
        # Connection should be removed after send failure
        assert user_id not in connection_manager.connections

    @pytest.mark.asyncio
    async def test_broadcast_to_all(self, connection_manager, mock_websocket):
        user_ids = ["user1", "user2", "user3"]
        message = {"type": "broadcast", "data": "hello all"}
        
        mock_websockets = []
        for user_id in user_ids:
            mock_ws = Mock()
            mock_ws.closed = False
            mock_ws.send = AsyncMock()
            mock_websockets.append(mock_ws)
            connection_manager.add_connection(user_id, mock_ws)
        
        await connection_manager.broadcast_to_all(message)
        
        for mock_ws in mock_websockets:
            mock_ws.send.assert_called_once_with(json.dumps(message))

    def test_get_stats(self, connection_manager, mock_websocket):
        user_ids = ["user1", "user2", "user3"]
        
        for user_id in user_ids:
            connection_manager.add_connection(user_id, mock_websocket)
        
        stats = connection_manager.get_stats()
        assert stats["total_connections"] == 3
        assert stats["unique_users"] == 3


class TestWebSocketServer:
    @pytest.fixture
    def jwt_manager(self):
        return JWTManager("test_secret")

    @pytest.fixture
    def mock_user(self):
        return User(
            id="user123",
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password"
        )

    @pytest.fixture
    def websocket_server(self, jwt_manager):
        return WebSocketServer(jwt_manager=jwt_manager)

    @pytest.fixture
    def mock_websocket(self):
        mock = Mock()
        mock.closed = False
        mock.send = AsyncMock()
        mock.close = AsyncMock()
        mock.recv = AsyncMock()
        mock.remote_address = ('127.0.0.1', 12345)
        return mock

    @pytest.mark.asyncio
    async def test_authenticate_valid_token(self, websocket_server, jwt_manager, mock_user):
        token = jwt_manager.create_access_token(mock_user.id)
        
        with patch('src.websocket_server.get_user_by_id') as mock_get_user:
            mock_get_user.return_value = mock_user
            user = await websocket_server.authenticate(token)
            assert user.id == mock_user.id

    @pytest.mark.asyncio
    async def test_authenticate_invalid_token(self, websocket_server):
        invalid_token = "invalid.jwt.token"
        user = await websocket_server.authenticate(invalid_token)
        assert user is None

    @pytest.mark.asyncio
    async def test_authenticate_expired_token(self, websocket_server, jwt_manager, mock_user):
        # Create an expired token
        with patch('src.auth.datetime') as mock_datetime:
            mock_datetime.now.return_value = datetime(2020, 1, 1, tzinfo=timezone.utc)
            mock_datetime.timezone = timezone
            token = jwt_manager.create_access_token(mock_user.id)
        
        user = await websocket_server.authenticate(token)
        assert user is None

    @pytest.mark.asyncio
    async def test_handle_connection_without_auth(self, websocket_server, mock_websocket):
        mock_websocket.recv.side_effect = [
            json.dumps({"type": "message", "data": "hello"}),
            websockets.exceptions.ConnectionClosed(None, None)
        ]
        
        with pytest.raises(websockets.exceptions.ConnectionClosedError):
            await websocket_server.handle_connection(mock_websocket, "/ws")

    @pytest.mark.asyncio
    async def test_handle_connection_with_auth(self, websocket_server, mock_websocket, jwt_manager, mock_user):
        token = jwt_manager.create_access_token(mock_user.id)
        
        mock_websocket.recv.side_effect = [
            json.dumps({"type": "auth", "token": token}),
            json.dumps({"type": "message", "data": "hello"}),
            websockets.exceptions.ConnectionClosed(None, None)
        ]
        
        with patch('src.websocket_server.get_user_by_id') as mock_get_user:
            mock_get_user.return_value = mock_user
            
            with pytest.raises(websockets.exceptions.ConnectionClosed):
                await websocket_server.handle_connection(mock_websocket, "/ws")

    @pytest.mark.asyncio
    async def test_handle_auth_message_success(self, websocket_server, mock_websocket, jwt_manager, mock_user):
        token = jwt_manager.create_access_token(mock_user.id)
        message = {"type": "auth", "token": token}
        
        with patch('src.websocket_server.get_user_by_id') as mock_get_user:
            mock_get_user.return_value = mock_user
            result = await websocket_server.handle_auth_message(mock_websocket, message)
            
            assert result is True
            mock_websocket.send.assert_called_with(json.dumps({
                "type": "auth_response",
                "success": True,
                "message": "Authentication successful"
            }))

    @pytest.mark.asyncio
    async def test_handle_auth_message_failure(self, websocket_server, mock_websocket):
        message = {"type": "auth", "token": "invalid_token"}
        
        result = await websocket_server.handle_auth_message(mock_websocket, message)
        
        assert result is False
        mock_websocket.send.assert_called_with(json.dumps({
            "type": "auth_response",
            "success": False,
            "message": "Authentication failed"
        }))

    @pytest.mark.asyncio
    async def test_handle_ping_message(self, websocket_server, mock_websocket, mock_user):
        message = {"type": "ping"}
        
        await websocket_server.handle_ping_message(mock_websocket, message, mock_user)
        
        mock_websocket.send.assert_called_with(json.dumps({"type": "pong"}))

    @pytest.mark.asyncio
    async def test_handle_message_unauthenticated(self, websocket_server, mock_websocket):
        message = {"type": "message", "data": "hello"}
        
        result = await websocket_server.handle_message(mock_websocket, message, None)
        
        assert result is False
        mock_websocket.send.assert_called_with(json.dumps({
            "type": "error",
            "message": "Authentication required"
        }))

    @pytest.mark.asyncio
    async def test_handle_unknown_message_type(self, websocket_server, mock_websocket, mock_user):
        message = {"type": "unknown_type", "data": "test"}
        
        await websocket_server.handle_message(mock_websocket, message, mock_user)
        
        mock_websocket.send.assert_called_with(json.dumps({
            "type": "error",
            "message": "Unknown message type: unknown_type"
        }))

    @pytest.mark.asyncio
    async def test_handle_malformed_json(self, websocket_server, mock_websocket):
        mock_websocket.recv.side_effect = [
            "invalid json",
            websockets.exceptions.ConnectionClosed(None, None)
        ]
        
        with pytest.raises(websockets.exceptions.ConnectionClosed):
            await websocket_server.handle_connection(mock_websocket, "/ws")
        
        # Should send error message for malformed JSON
        mock_websocket.send.assert_called_with(json.dumps({
            "type": "error",
            "message": "Invalid JSON format"
        }))

    def test_get_connection_stats(self, websocket_server, mock_websocket):
        user_id = "user123"
        websocket_server.connection_manager.add_connection(user_id, mock_websocket)
        
        stats = websocket_server.get_connection_stats()
        assert "total_connections" in stats
        assert "unique_users" in stats


class TestWebSocketStress:
    @pytest.fixture
    def websocket_server(self):
        jwt_manager = JWTManager("test_secret")
        return WebSocketServer(jwt_manager=jwt_manager)

    @pytest.mark.asyncio
    async def test_concurrent_connections(self, websocket_server):
        """Test handling multiple concurrent connections"""
        num_connections = 100
        mock_websockets = []
        
        for i in range(num_connections):
            mock_ws = Mock()
            mock_ws.closed = False
            mock_ws.send = AsyncMock()
            mock_ws.recv = AsyncMock(return_value=json.dumps({"type": "ping"}))
            mock_websockets.append(mock_ws)
            websocket_server.connection_manager.add_connection(f"user{i}", mock_ws)
        
        # Broadcast message to all connections
        message = {"type": "broadcast", "data": "stress test"}
        await websocket_server.connection_manager.broadcast_to_all(message)
        
        # Verify all connections received the message
        for mock_ws in mock_websockets:
            mock_ws.send.assert_called_with(json.dumps(message))

    @pytest.mark.asyncio
    async def test_rapid_message_sending(self, websocket_server):
        """Test rapid message sending to a single connection"""
        mock_websocket = Mock()
        mock_websocket.closed = False
        mock_websocket.send = AsyncMock()
        
        user_id = "user123"
        websocket_server.connection_manager.add_connection(user_id, mock_websocket)
        
        # Send many messages rapidly
        num_messages = 1000
        tasks = []
        
        for i in range(num_messages):
            message = {"type": "test", "data": f"message_{i}"}
            task = asyncio.create_task(
                websocket_server.connection_manager.send_to_user(user_id, message)
            )
            tasks.append(task)
        
        await asyncio.gather(*tasks)
        
        # Verify all messages were sent
        assert mock_websocket.send.call_count == num_messages

    @pytest.mark.asyncio
    async def test_connection_cleanup_on_error(self, websocket_server):
        """Test that failed connections are properly cleaned up"""
        mock_websockets = []
        
        # Create connections, some of which will fail
        for i in range(10):
            mock_ws = Mock()
            mock_ws.closed = False
            
            # Make some connections fail on send
            if i % 3 == 0:
                mock_ws.send = AsyncMock(side_effect=Exception("Connection failed"))
            else:
                mock_ws.send = AsyncMock()
            
            mock_websockets.append(mock_ws)
            websocket_server.connection_manager.add_connection(f"user{i}", mock_ws)
        
        # Broadcast message
        message = {"type": "test", "data": "cleanup test"}
        await websocket_server.connection_manager.broadcast_to_all(message)
        
        # Check that failed connections were removed
        stats = websocket_server.connection_manager.get_stats()
        assert stats["total_connections"] < 10  # Some should be removed

    @pytest.mark.asyncio
    async def test_memory_usage_with_many_connections(self, websocket_server):
        """Test memory usage doesn't grow excessively with many connections"""
        import gc
        import sys
        
        initial_objects = len(gc.get_objects())
        
        # Create many connections
        for i in range(1000):
            mock_ws = Mock()
            mock_ws.closed = False
            mock_ws.send = AsyncMock()
            websocket_server.connection_manager.add_connection(f"user{i}", mock_ws)
        
        # Remove all connections
        websocket_server.connection_manager.connections.clear()
        
        # Force garbage collection
        gc.collect()
        
        final_objects = len(gc.get_objects())
        
        # Memory usage should not have grown significantly
        # Allow for some variance in object counts
        assert final_objects - initial_objects < 100

    @pytest.mark.asyncio
    async def test_authentication_rate_limiting(self, websocket_server):
        """Test that rapid authentication attempts are handled properly"""
        mock_websocket = Mock()
        mock_websocket.closed = False
        mock_websocket.send = AsyncMock()
        
        # Attempt many rapid authentications
        num_attempts = 100
        tasks = []
        
        for i in range(num_attempts):
            message = {"type": "auth", "token": f"invalid_token_{i}"}
            task = asyncio.create_task(
                websocket_server.handle_auth_message(mock_websocket, message)
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        
        # All should fail (invalid tokens)
        assert all(result is False for result in results)
        assert mock_websocket.send.call_count == num_attempts


class TestWebSocketIntegration:
    @pytest.mark.asyncio
    async def test_full_websocket_flow(self):
        """Test complete WebSocket connection flow"""
        jwt_manager = JWTManager("test_secret")
        server = WebSocketServer(jwt_manager=jwt_manager)
        
        # Mock user
        mock_user = User(
            id="user123",
            username="testuser",
            email="test@example.com",
            password_hash="hashed"
        )
        
        # Create token
        token = jwt_manager.create_access_token(mock_user.id)
        
        # Mock WebSocket
        mock_websocket = Mock()
        mock_websocket.closed = False
        mock_websocket.send = AsyncMock()
        mock_websocket.remote_address = ('127.0.0.1', 12345)
        
        # Simulate connection flow
        messages = [
            json.dumps({"type": "auth", "token": token}),
            json.dumps({"type": "ping"}),
            json.dumps({"type": "message", "data": "hello world"})
        ]
        
        mock_websocket.recv = AsyncMock(side_effect=messages + [
            websockets.exceptions.ConnectionClosed(None, None)
        ])
        
        with patch('src.websocket_server.get_user_by_id') as mock_get_user:
            mock_get_user.return_value = mock_user
            
            with pytest.raises(websockets.exceptions.ConnectionClosed):
                await server.handle_connection(mock_websocket, "/ws")
        
        # Verify authentication response and pong were sent
        assert mock_websocket.send.call_count >= 2

    @pytest.mark.asyncio
    async def test_websocket_server_start_stop(self):
        """Test WebSocket server start and stop functionality"""
        jwt_manager = JWTManager("test_secret")
        server = WebSocketServer(jwt_manager=jwt_manager, host="localhost", port=0)
        
        # Start server
        server_task = asyncio.create_task(server.start())
        
        # Wait a bit for server to start
        await asyncio.sleep(0.1)
        
        # Stop server
        server.stop()
        
        # Wait for server task to complete
        try:
            await asyncio.wait_for(server_task, timeout=1.0)
        except asyncio.TimeoutError:
            server_task.cancel()