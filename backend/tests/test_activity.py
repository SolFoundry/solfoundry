import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timezone
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.core.database import get_db
from backend.models.activity import Activity, ActivityType
from backend.models.bounty import Bounty
from backend.models.user import User
from backend.services.activity_service import ActivityService
from backend.api.endpoints.activities import router
from backend.main import app


class TestActivityModel:
    """Test suite for Activity model functionality"""

    def test_activity_creation(self, db_session):
        """Test creating a new activity record"""
        user = User(username="testuser", email="test@example.com", wallet_address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")
        db_session.add(user)
        db_session.commit()

        activity = Activity(
            user_id=user.id,
            activity_type=ActivityType.BOUNTY_CREATED,
            title="New bounty created",
            description="Created a new bounty for smart contract development",
            metadata={"bounty_id": 123, "amount": "1000 FNDRY"}
        )

        db_session.add(activity)
        db_session.commit()

        assert activity.id is not None
        assert activity.user_id == user.id
        assert activity.activity_type == ActivityType.BOUNTY_CREATED
        assert activity.title == "New bounty created"
        assert activity.metadata["bounty_id"] == 123
        assert activity.created_at is not None

    def test_activity_types_enum(self):
        """Test all activity type enum values"""
        assert ActivityType.BOUNTY_CREATED.value == "bounty_created"
        assert ActivityType.BOUNTY_COMPLETED.value == "bounty_completed"
        assert ActivityType.SUBMISSION_CREATED.value == "submission_created"
        assert ActivityType.SUBMISSION_APPROVED.value == "submission_approved"
        assert ActivityType.COMMENT_ADDED.value == "comment_added"
        assert ActivityType.USER_REGISTERED.value == "user_registered"

    def test_activity_metadata_serialization(self, db_session):
        """Test JSON metadata storage and retrieval"""
        user = User(username="metauser", email="meta@test.com", wallet_address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")
        db_session.add(user)
        db_session.commit()

        complex_metadata = {
            "bounty_data": {
                "id": 456,
                "title": "Complex Task",
                "tags": ["rust", "solana", "anchor"]
            },
            "stats": {
                "views": 100,
                "applicants": 5
            }
        }

        activity = Activity(
            user_id=user.id,
            activity_type=ActivityType.BOUNTY_CREATED,
            title="Complex bounty",
            metadata=complex_metadata
        )

        db_session.add(activity)
        db_session.commit()

        retrieved = db_session.query(Activity).filter_by(id=activity.id).first()
        assert retrieved.metadata["bounty_data"]["id"] == 456
        assert "rust" in retrieved.metadata["bounty_data"]["tags"]
        assert retrieved.metadata["stats"]["views"] == 100


class TestActivityService:
    """Test suite for ActivityService business logic"""

    @pytest.fixture
    def activity_service(self, db_session):
        return ActivityService(db_session)

    @pytest.fixture
    def sample_user(self, db_session):
        user = User(
            username="serviceuser",
            email="service@test.com",
            wallet_address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
        )
        db_session.add(user)
        db_session.commit()
        return user

    def test_create_activity(self, activity_service, sample_user):
        """Test creating activity through service"""
        activity = activity_service.create_activity(
            user_id=sample_user.id,
            activity_type=ActivityType.BOUNTY_COMPLETED,
            title="Bounty finished",
            description="Successfully completed the development task",
            metadata={"bounty_id": 789, "reward": "500 FNDRY"}
        )

        assert activity.user_id == sample_user.id
        assert activity.activity_type == ActivityType.BOUNTY_COMPLETED
        assert activity.metadata["reward"] == "500 FNDRY"

    def test_get_user_activities(self, activity_service, sample_user):
        """Test retrieving user activities with pagination"""
        # Create multiple activities
        for i in range(15):
            activity_service.create_activity(
                user_id=sample_user.id,
                activity_type=ActivityType.COMMENT_ADDED,
                title=f"Comment {i}",
                description=f"Added comment number {i}"
            )

        # Test pagination
        activities = activity_service.get_user_activities(sample_user.id, skip=0, limit=10)
        assert len(activities) == 10

        # Test second page
        activities_page2 = activity_service.get_user_activities(sample_user.id, skip=10, limit=10)
        assert len(activities_page2) == 5

        # Verify ordering (most recent first)
        assert activities[0].created_at >= activities[1].created_at

    def test_get_activities_by_type(self, activity_service, sample_user):
        """Test filtering activities by type"""
        activity_service.create_activity(
            user_id=sample_user.id,
            activity_type=ActivityType.BOUNTY_CREATED,
            title="New bounty"
        )

        activity_service.create_activity(
            user_id=sample_user.id,
            activity_type=ActivityType.COMMENT_ADDED,
            title="New comment"
        )

        bounty_activities = activity_service.get_activities_by_type(
            ActivityType.BOUNTY_CREATED,
            limit=10
        )

        assert len(bounty_activities) == 1
        assert bounty_activities[0].activity_type == ActivityType.BOUNTY_CREATED

    @pytest.mark.asyncio
    async def test_log_bounty_activity(self, activity_service, sample_user, db_session):
        """Test logging bounty-specific activities"""
        bounty = Bounty(
            title="Test Bounty",
            description="Test description",
            creator_id=sample_user.id,
            reward_amount=1000,
            status="open"
        )
        db_session.add(bounty)
        db_session.commit()

        activity = activity_service.log_bounty_activity(
            user_id=sample_user.id,
            bounty=bounty,
            activity_type=ActivityType.BOUNTY_CREATED
        )

        assert activity.metadata["bounty_id"] == bounty.id
        assert activity.metadata["bounty_title"] == "Test Bounty"
        assert activity.metadata["reward_amount"] == 1000


class TestActivityAPI:
    """Test suite for Activity API endpoints"""

    def test_get_user_activities_endpoint(self, client, auth_headers, sample_user):
        """Test GET /activities/user/{user_id} endpoint"""
        response = client.get(
            f"/api/v1/activities/user/{sample_user.id}",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "activities" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data

    def test_get_activities_pagination(self, client, auth_headers, sample_user, db_session):
        """Test activity endpoint pagination parameters"""
        # Create test activities
        for i in range(25):
            activity = Activity(
                user_id=sample_user.id,
                activity_type=ActivityType.COMMENT_ADDED,
                title=f"Activity {i}"
            )
            db_session.add(activity)
        db_session.commit()

        # Test first page
        response = client.get(
            f"/api/v1/activities/user/{sample_user.id}?skip=0&limit=10",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["activities"]) == 10
        assert data["skip"] == 0
        assert data["limit"] == 10

        # Test second page
        response = client.get(
            f"/api/v1/activities/user/{sample_user.id}?skip=10&limit=10",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["activities"]) == 10
        assert data["skip"] == 10

    def test_get_global_activities(self, client):
        """Test GET /activities/global endpoint"""
        response = client.get("/api/v1/activities/global")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["activities"], list)
        assert "total" in data

    def test_get_activities_by_type_endpoint(self, client, sample_user, db_session):
        """Test GET /activities/type/{activity_type} endpoint"""
        # Create activities of different types
        activity1 = Activity(
            user_id=sample_user.id,
            activity_type=ActivityType.BOUNTY_CREATED,
            title="Bounty activity"
        )
        activity2 = Activity(
            user_id=sample_user.id,
            activity_type=ActivityType.SUBMISSION_CREATED,
            title="Submission activity"
        )

        db_session.add_all([activity1, activity2])
        db_session.commit()

        response = client.get("/api/v1/activities/type/bounty_created")

        assert response.status_code == 200
        data = response.json()
        assert len(data["activities"]) >= 1
        assert all(a["activity_type"] == "bounty_created" for a in data["activities"])

    def test_unauthorized_access(self, client, sample_user):
        """Test accessing protected endpoints without authentication"""
        response = client.get(f"/api/v1/activities/user/{sample_user.id}")

        assert response.status_code == 401

    def test_invalid_activity_type(self, client):
        """Test requesting activities with invalid type"""
        response = client.get("/api/v1/activities/type/invalid_type")

        assert response.status_code == 400
        assert "Invalid activity type" in response.json()["detail"]


class TestActivityIntegration:
    """Integration tests for activity system with bounty workflow"""

    @pytest.mark.asyncio
    async def test_bounty_creation_generates_activity(self, client, auth_headers, sample_user):
        """Test that creating bounty automatically generates activity"""
        bounty_data = {
            "title": "Smart Contract Development",
            "description": "Build a Solana smart contract",
            "reward_amount": 2000,
            "tags": ["solana", "rust"],
            "requirements": "Must know Anchor framework"
        }

        # Create bounty
        response = client.post(
            "/api/v1/bounties/",
            json=bounty_data,
            headers=auth_headers
        )

        assert response.status_code == 201
        bounty_id = response.json()["id"]

        # Verify activity was created
        activities_response = client.get(
            f"/api/v1/activities/user/{sample_user.id}",
            headers=auth_headers
        )

        assert activities_response.status_code == 200
        activities = activities_response.json()["activities"]

        bounty_activity = next(
            (a for a in activities if a["activity_type"] == "bounty_created"),
            None
        )

        assert bounty_activity is not None
        assert bounty_activity["metadata"]["bounty_id"] == bounty_id
        assert "Smart Contract Development" in bounty_activity["title"]

    def test_activity_filtering_and_search(self, client, auth_headers, sample_user, db_session):
        """Test advanced filtering and search functionality"""
        # Create diverse activities
        activities_data = [
            (ActivityType.BOUNTY_CREATED, "Frontend Task", {"tags": ["react", "typescript"]}),
            (ActivityType.BOUNTY_COMPLETED, "Backend API", {"tags": ["python", "fastapi"]}),
            (ActivityType.SUBMISSION_CREATED, "Smart Contract", {"tags": ["solana", "rust"]}),
        ]

        for activity_type, title, metadata in activities_data:
            activity = Activity(
                user_id=sample_user.id,
                activity_type=activity_type,
                title=title,
                metadata=metadata
            )
            db_session.add(activity)

        db_session.commit()

        # Test type filtering
        response = client.get("/api/v1/activities/type/bounty_created")
        assert response.status_code == 200

        filtered_activities = response.json()["activities"]
        assert all(a["activity_type"] == "bounty_created" for a in filtered_activities)

    def test_activity_feed_performance(self, client, auth_headers, sample_user, db_session):
        """Test activity feed performance with large dataset"""
        # Create many activities
        activities = []
        for i in range(100):
            activity = Activity(
                user_id=sample_user.id,
                activity_type=ActivityType.COMMENT_ADDED,
                title=f"Performance test activity {i}",
                metadata={"test_id": i}
            )
            activities.append(activity)

        db_session.add_all(activities)
        db_session.commit()

        # Test paginated retrieval
        response = client.get(
            f"/api/v1/activities/user/{sample_user.id}?limit=50",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["activities"]) == 50
        assert data["total"] >= 100

    def test_activity_metadata_validation(self, client, auth_headers, sample_user, db_session):
        """Test that activity metadata is properly validated and stored"""
        activity = Activity(
            user_id=sample_user.id,
            activity_type=ActivityType.BOUNTY_CREATED,
            title="Validation test",
            metadata={
                "bounty_id": 999,
                "nested_data": {
                    "complexity": "high",
                    "estimated_hours": 40
                },
                "technologies": ["rust", "solana", "anchor"]
            }
        )

        db_session.add(activity)
        db_session.commit()

        # Retrieve and verify
        response = client.get(
            f"/api/v1/activities/user/{sample_user.id}",
            headers=auth_headers
        )

        activities = response.json()["activities"]
        test_activity = next(a for a in activities if a["title"] == "Validation test")

        assert test_activity["metadata"]["bounty_id"] == 999
        assert test_activity["metadata"]["nested_data"]["complexity"] == "high"
        assert "rust" in test_activity["metadata"]["technologies"]
