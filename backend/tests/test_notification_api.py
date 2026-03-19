"""Tests for notification API endpoints."""

import os
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
async def sample_notifications(db_session):
    """Create sample notifications for testing."""
    import uuid
    user_id = str(uuid.uuid4())
    
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


class TestNotificationAPI:
    """Tests for notification endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_notifications(self, client, sample_notifications):
        """Test listing notifications."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(f"/notifications?user_id={user_id}")
        
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
            f"/notifications?user_id={user_id}&unread_only=true"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 2
        for item in data["items"]:
            assert item["read"] == False
    
    @pytest.mark.asyncio
    async def test_pagination(self, client, sample_notifications):
        """Test pagination."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(
            f"/notifications?user_id={user_id}&skip=0&limit=2"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["items"]) == 2
        assert data["skip"] == 0
        assert data["limit"] == 2
    
    @pytest.mark.asyncio
    async def test_get_unread_count(self, client, sample_notifications):
        """Test getting unread count."""
        user_id = sample_notifications["user_id"]
        
        response = await client.get(f"/notifications/unread-count?user_id={user_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["unread_count"] == 2
    
    @pytest.mark.asyncio
    async def test_mark_notification_read(self, client, sample_notifications):
        """Test marking notification as read."""
        user_id = sample_notifications["user_id"]
        notification_id = str(sample_notifications["notifications"][0].id)
        
        response = await client.patch(
            f"/notifications/{notification_id}/read?user_id={user_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["read"] == True
    
    @pytest.mark.asyncio
    async def test_mark_notification_read_not_found(self, client):
        """Test marking non-existent notification."""
        import uuid
        response = await client.patch(
            f"/notifications/{uuid.uuid4()}/read?user_id={uuid.uuid4()}"
        )
        
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_mark_all_read(self, client, sample_notifications):
        """Test marking all notifications as read."""
        user_id = sample_notifications["user_id"]
        
        response = await client.post(f"/notifications/read-all?user_id={user_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["count"] == 2
        
        # Verify all are read
        response = await client.get(f"/notifications/unread-count?user_id={user_id}")
        assert response.json()["unread_count"] == 0
    
    @pytest.mark.asyncio
    async def test_create_notification(self, client, sample_notifications):
        """Test creating a notification."""
        import uuid
        user_id = str(uuid.uuid4())
        
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
    async def test_create_notification_invalid_type(self, client):
        """Test creating notification with invalid type."""
        import uuid
        
        response = await client.post(
            "/notifications",
            json={
                "user_id": str(uuid.uuid4()),
                "notification_type": "invalid_type",
                "title": "Test",
                "message": "Test",
            }
        )
        
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_notifications_sorted_by_date(self, client, db_session):
        """Test that notifications are sorted by creation date."""
        import uuid
        import asyncio
        from sqlalchemy import select
        
        user_id = str(uuid.uuid4())
        
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
        
        await asyncio.sleep(0.1)
        
        n2 = NotificationDB(
            user_id=user_id,
            notification_type="bounty_claimed",
            title="Second",
            message="Second notification",
            read=False,
        )
        db_session.add(n2)
        await db_session.commit()
        
        response = await client.get(f"/notifications?user_id={user_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Newest should be first
        assert data["items"][0]["title"] == "Second"
        assert data["items"][1]["title"] == "First"