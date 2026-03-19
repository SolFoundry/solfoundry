"""WebSocket tests."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_websocket_endpoint_exists():
    """Test that WebSocket endpoint is registered."""
    # Check OpenAPI schema for WebSocket route
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    
    # WebSocket routes won't appear in OpenAPI, but we can check the app routes
    routes = [route.path for route in app.routes]
    assert "/ws/notifications" in routes or any("ws" in str(route).lower() for route in app.routes)


def test_websocket_unauthorized():
    """Test WebSocket connection without auth."""
    # WebSocket connections require authentication
    # This will fail with 401 or connection rejection
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/notifications") as websocket:
            websocket.receive_text()


def test_notification_model():
    """Test notification model structure."""
    from app.models.notification import Notification
    
    # Check that the model has required fields
    assert hasattr(Notification, "id")
    assert hasattr(Notification, "type")
    assert hasattr(Notification, "message")
    assert hasattr(Notification, "read")
    assert hasattr(Notification, "user_id")
    assert hasattr(Notification, "created_at")


def test_websocket_manager():
    """Test WebSocket connection manager."""
    from app.websocket import manager
    
    # Check manager is initialized
    assert manager is not None
    assert hasattr(manager, "active_connections")
    assert isinstance(manager.active_connections, dict)
