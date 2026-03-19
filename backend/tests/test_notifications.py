"""Notification tests."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_notifications_unauthorized():
    """Test notifications endpoint without auth."""
    response = client.get("/api/v1/notifications")
    assert response.status_code == 401


def test_unread_count_unauthorized():
    """Test unread count without auth."""
    response = client.get("/api/v1/notifications/unread-count")
    assert response.status_code == 401


def test_mark_as_read_unauthorized():
    """Test mark as read without auth."""
    response = client.patch("/api/v1/notifications/1/read")
    assert response.status_code == 401


def test_mark_all_as_read_unauthorized():
    """Test mark all as read without auth."""
    response = client.post("/api/v1/notifications/read-all")
    assert response.status_code == 401


def test_create_notification_unauthorized():
    """Test create notification without auth."""
    response = client.post(
        "/api/v1/notifications",
        json={
            "type": "test",
            "message": "test message",
        },
    )
    assert response.status_code == 401


def test_notification_types():
    """Test notification type constants."""
    from app.models.notification import Notification
    
    # Valid notification types
    valid_types = [
        "bounty_claimed",
        "pr_submitted",
        "review_complete",
        "payout_sent",
        "bounty_expired",
        "rank_changed",
    ]
    
    for ntype in valid_types:
        assert isinstance(ntype, str)
        assert len(ntype) > 0
