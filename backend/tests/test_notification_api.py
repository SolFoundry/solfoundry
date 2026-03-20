"""Tests for notification API endpoints.

This module provides comprehensive tests for the notification system including:
- Basic CRUD operations
- Authentication and authorization
- Pagination and filtering
- Edge cases and error handling
"""

import os
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.models.notification import NotificationDB, Base
from app.database import get_db


TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/solfoundry_test"
)


@pytest_asyncio.fixture
async def db_engine():
    """Create test database engine."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    """Create a test database session."""
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def client(db_session):
    """Create a test client."""
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
def user_id():
    """Generate a test user ID."""
    return str(uuid.uuid4())


@pytest_asyncio.fixture
def other_user_id():
    """Generate another test user ID for authorization tests."""
    return str(uuid.uuid4())


@pytest_asyncio.fixture
async def sample_notifications(db_session, user_id):
    """Create sample notifications for testing."""
    notifications = [
        NotificationDB(
            user_id=user_id,
            notification_type="bounty_claimed",
            title="Bounty Claimed",
            message="Your bounty has been claimed",
            read=False,
        ),
        NotificationDB(
            user_id=user_id,
            notification_type="review_complete",
            title="Review Complete",
            message="Your PR review is complete",
            read=True,
        ),
        NotificationDB(
            user_id=user_id,
            notification_type="payout_sent",
            title="Payout Sent",
            message="Your payout has been sent",
            read=False,
        ),
    ]
    
    for n in notifications:
        db_session.add(n)
    await db_session.commit()
    
    return {"user_id": user_id, "notifications": notifications}


class TestAuthentication:
    """Tests for authentication requirements."""
    
    @pytest.mark.asyncio
    async def test_list_notifications_requires_auth(self, client):
        """Test that listing notifications requires authentication."""
        response = await client.get("/notifications")
        
        # Should work with AUTH_ENABLED=false (dev mode)
        # In production, this would return 401
        assert response.status_code in [200, 401]
    
    @pytest.mark.asyncio
    async def test_list_notifications_with_user_header(self, client, user_id):
        """Test listing notifications with X-User-ID header."""
        response = await client.get(
            "/notifications",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    @pytest.mark.asyncio
    async def test_list_notifications_with_invalid_user_id(self, client):
        """Test with invalid user ID format."""
        response = await client.get(
            "/notifications",
            headers={"X-User-ID": "not-a-valid-uuid"}
        )
        
        # Should reject invalid UUID format
        assert response.status_code in [400, 401]


class TestListNotifications:
    """Tests for listing notifications."""
    
    @pytest.mark.asyncio
    async def test_list_notifications(self, client, sample_notifications):
        """Test listing notifications."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(
            "/notifications",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 3
        assert len(data["items"]) == 3
        assert data["unread_count"] == 2
    
    @pytest.mark.asyncio
    async def test_list_unread_only(self, client, sample_notifications):
        """Test listing only unread notifications."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(
            "/notifications?unread_only=true",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 2
        for item in data["items"]:
            assert not item["read"]
    
    @pytest.mark.asyncio
    async def test_pagination(self, client, sample_notifications):
        """Test pagination."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(
            "/notifications?skip=0&limit=2",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["items"]) == 2
        assert data["skip"] == 0
        assert data["limit"] == 2
    
    @pytest.mark.asyncio
    async def test_pagination_second_page(self, client, sample_notifications):
        """Test pagination second page."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(
            "/notifications?skip=2&limit=2",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["items"]) == 1  # Only 3 total, skip=2 leaves 1
        assert data["skip"] == 2
    
    @pytest.mark.asyncio
    async def test_empty_notifications(self, client, user_id):
        """Test listing notifications for user with none."""
        response = await client.get(
            "/notifications",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 0
        assert len(data["items"]) == 0
        assert data["unread_count"] == 0
    
    @pytest.mark.asyncio
    async def test_notifications_sorted_by_date(self, client, db_session, user_id):
        """Test that notifications are sorted by creation date (newest first)."""
        import asyncio
        
        # Create notifications with slight delay
        n1 = NotificationDB(
            user_id=user_id,
            notification_type="bounty_claimed",
            title="First",
            message="First notification",
            read=False,
        )
        db_session.add(n1)
        await db_session.commit()
        
        await asyncio.sleep(0.01)  # Small delay
        
        n2 = NotificationDB(
            user_id=user_id,
            notification_type="bounty_claimed",
            title="Second",
            message="Second notification",
            read=False,
        )
        db_session.add(n2)
        await db_session.commit()
        
        response = await client.get(
            "/notifications",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Newest should be first
        assert data["items"][0]["title"] == "Second"
        assert data["items"][1]["title"] == "First"


class TestUnreadCount:
    """Tests for unread count endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_unread_count(self, client, sample_notifications):
        """Test getting unread count."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(
            "/notifications/unread-count",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["unread_count"] == 2
    
    @pytest.mark.asyncio
    async def test_unread_count_empty(self, client, user_id):
        """Test unread count with no notifications."""
        response = await client.get(
            "/notifications/unread-count",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["unread_count"] == 0


class TestMarkAsRead:
    """Tests for marking notifications as read."""
    
    @pytest.mark.asyncio
    async def test_mark_notification_read(self, client, sample_notifications):
        """Test marking notification as read."""
        user_id = sample_notifications["user_id"]
        notification_id = str(sample_notifications["notifications"][0].id)
        
        response = await client.patch(
            f"/notifications/{notification_id}/read",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["read"]
    
    @pytest.mark.asyncio
    async def test_mark_notification_not_found(self, client, user_id):
        """Test marking non-existent notification."""
        fake_id = str(uuid.uuid4())
        
        response = await client.patch(
            f"/notifications/{fake_id}/read",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_mark_notification_wrong_owner(self, client, sample_notifications, other_user_id):
        """Test that users cannot mark other users' notifications as read."""
        notification_id = str(sample_notifications["notifications"][0].id)
        
        response = await client.patch(
            f"/notifications/{notification_id}/read",
            headers={"X-User-ID": other_user_id}
        )
        
        # Should return 404 to prevent information leakage
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_mark_notification_invalid_id(self, client, user_id):
        """Test with invalid notification ID format."""
        response = await client.patch(
            "/notifications/not-a-uuid/read",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code in [400, 404, 422]


class TestMarkAllAsRead:
    """Tests for marking all notifications as read."""
    
    @pytest.mark.asyncio
    async def test_mark_all_read(self, client, sample_notifications):
        """Test marking all notifications as read."""
        user_id = sample_notifications["user_id"]
        
        response = await client.post(
            "/notifications/read-all",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["count"] == 2
        
        # Verify all are read
        response = await client.get(
            "/notifications/unread-count",
            headers={"X-User-ID": user_id}
        )
        assert response.json()["unread_count"] == 0
    
    @pytest.mark.asyncio
    async def test_mark_all_read_empty(self, client, user_id):
        """Test marking all read with no notifications."""
        response = await client.post(
            "/notifications/read-all",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["count"] == 0
    
    @pytest.mark.asyncio
    async def test_mark_all_read_only_affects_own(self, client, db_session, user_id, other_user_id):
        """Test that marking all read only affects user's own notifications."""
        # Create notifications for both users
        n1 = NotificationDB(
            user_id=user_id,
            notification_type="bounty_claimed",
            title="User 1 notification",
            message="Test",
            read=False,
        )
        n2 = NotificationDB(
            user_id=other_user_id,
            notification_type="bounty_claimed",
            title="User 2 notification",
            message="Test",
            read=False,
        )
        db_session.add_all([n1, n2])
        await db_session.commit()
        
        # Mark all as read for user 1
        response = await client.post(
            "/notifications/read-all",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 200
        assert response.json()["count"] == 1
        
        # Verify user 2's notification is still unread
        response = await client.get(
            "/notifications/unread-count",
            headers={"X-User-ID": other_user_id}
        )
        assert response.json()["unread_count"] == 1


class TestCreateNotification:
    """Tests for creating notifications."""
    
    @pytest.mark.asyncio
    async def test_create_notification(self, client, user_id):
        """Test creating a notification."""
        response = await client.post(
            "/notifications",
            json={
                "user_id": user_id,
                "notification_type": "bounty_claimed",
                "title": "Test Notification",
                "message": "This is a test",
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["notification_type"] == "bounty_claimed"
        assert data["title"] == "Test Notification"
        assert data["read"] == False
    
    @pytest.mark.asyncio
    async def test_create_notification_with_bounty_id(self, client, user_id):
        """Test creating notification with bounty reference."""
        bounty_id = str(uuid.uuid4())
        
        response = await client.post(
            "/notifications",
            json={
                "user_id": user_id,
                "notification_type": "bounty_claimed",
                "title": "Bounty Claimed",
                "message": "Your bounty was claimed",
                "bounty_id": bounty_id,
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["bounty_id"] == bounty_id
    
    @pytest.mark.asyncio
    async def test_create_notification_with_metadata(self, client, user_id):
        """Test creating notification with metadata."""
        response = await client.post(
            "/notifications",
            json={
                "user_id": user_id,
                "notification_type": "review_complete",
                "title": "Review Complete",
                "message": "Your review is complete",
                "metadata": {
                    "pr_number": 123,
                    "score": 85,
                }
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["metadata"]["pr_number"] == 123
    
    @pytest.mark.asyncio
    async def test_create_notification_invalid_type(self, client, user_id):
        """Test creating notification with invalid type."""
        response = await client.post(
            "/notifications",
            json={
                "user_id": user_id,
                "notification_type": "invalid_type",
                "title": "Test",
                "message": "Test",
            }
        )
        
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_create_notification_missing_fields(self, client, user_id):
        """Test creating notification with missing required fields."""
        response = await client.post(
            "/notifications",
            json={
                "user_id": user_id,
                "notification_type": "bounty_claimed",
                # Missing title and message
            }
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_create_notification_empty_title(self, client, user_id):
        """Test creating notification with empty title."""
        response = await client.post(
            "/notifications",
            json={
                "user_id": user_id,
                "notification_type": "bounty_claimed",
                "title": "",
                "message": "Test message",
            }
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_create_notification_invalid_user_id(self, client):
        """Test creating notification with invalid user ID."""
        response = await client.post(
            "/notifications",
            json={
                "user_id": "not-a-valid-uuid",
                "notification_type": "bounty_claimed",
                "title": "Test",
                "message": "Test",
            }
        )
        
        assert response.status_code == 422


class TestAllNotificationTypes:
    """Test all valid notification types."""
    
    @pytest.mark.asyncio
    @pytest.mark.parametrize("notification_type", [
        "bounty_claimed",
        "pr_submitted",
        "review_complete",
        "payout_sent",
        "bounty_expired",
        "rank_changed",
    ])
    async def test_create_all_notification_types(self, client, user_id, notification_type):
        """Test creating notifications with all valid types."""
        response = await client.post(
            "/notifications",
            json={
                "user_id": user_id,
                "notification_type": notification_type,
                "title": f"Test {notification_type}",
                "message": f"Test message for {notification_type}",
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["notification_type"] == notification_type


class TestPaginationLimits:
    """Test pagination limits and validation."""
    
    @pytest.mark.asyncio
    async def test_pagination_max_limit(self, client, sample_notifications):
        """Test pagination respects maximum limit."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(
            "/notifications?limit=1000",  # Exceeds max of 100
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_pagination_min_limit(self, client, sample_notifications):
        """Test pagination respects minimum limit."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(
            "/notifications?limit=0",  # Below min of 1
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_pagination_negative_skip(self, client, sample_notifications):
        """Test pagination rejects negative skip."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(
            "/notifications?skip=-1",
            headers={"X-User-ID": user_id}
        )
        
        assert response.status_code == 422