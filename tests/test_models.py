import pytest
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import Mock, patch, AsyncMock

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import IntegrityError

from backend.database.models import Base, Bounty, Contributor, Submission, Payout
from backend.database.migration import MigrationManager
from backend.services.database_service import DatabaseService, DatabaseError, ValidationError, ConnectionError


class TestBountyModel:
    """Test the Bounty model"""

    def test_bounty_creation_with_required_fields(self, test_session):
        """Test creating a bounty with only required fields"""
        contributor = Contributor(
            github_username="testuser",
            github_id=123456,
            display_name="Test User"
        )
        test_session.add(contributor)
        test_session.flush()

        bounty = Bounty(
            github_issue_number=1,
            title="Test Bounty",
            reward_amount=Decimal("100.50"),
            tier="beginner",
            creator_id=contributor.id
        )
        test_session.add(bounty)
        test_session.commit()

        assert bounty.id is not None
        assert bounty.github_issue_number == 1
        assert bounty.title == "Test Bounty"
        assert bounty.reward_amount == Decimal("100.50")
        assert bounty.currency == "FNDRY"  # default value
        assert bounty.status == "open"  # default value
        assert bounty.priority == "medium"  # default value
        assert bounty.difficulty == "intermediate"  # default value
        assert bounty.creator_id == contributor.id
        assert bounty.created_at is not None
        assert bounty.updated_at is not None

    def test_bounty_creation_with_all_fields(self, test_session):
        """Test creating a bounty with all fields populated"""
        contributor = Contributor(
            github_username="creator",
            github_id=123456
        )
        assignee = Contributor(
            github_username="assignee",
            github_id=789012
        )
        test_session.add_all([contributor, assignee])
        test_session.flush()

        deadline = datetime.now(timezone.utc)
        requirements = ["requirement1", "requirement2"]
        acceptance_criteria = ["criteria1", "criteria2"]
        tags = ["python", "api"]

        bounty = Bounty(
            github_issue_number=2,
            title="Complex Bounty",
            description="A complex bounty description",
            reward_amount=Decimal("500.00"),
            currency="SOL",
            tier="expert",
            status="assigned",
            creator_id=contributor.id,
            assignee_id=assignee.id,
            deadline=deadline,
            requirements=requirements,
            acceptance_criteria=acceptance_criteria,
            tags=tags,
            priority="high",
            difficulty="advanced",
            estimated_hours=40
        )
        test_session.add(bounty)
        test_session.commit()

        assert bounty.description == "A complex bounty description"
        assert bounty.currency == "SOL"
        assert bounty.tier == "expert"
        assert bounty.status == "assigned"
        assert bounty.assignee_id == assignee.id
        assert bounty.deadline == deadline
        assert bounty.requirements == requirements
        assert bounty.acceptance_criteria == acceptance_criteria
        assert bounty.tags == tags
        assert bounty.priority == "high"
        assert bounty.difficulty == "advanced"
        assert bounty.estimated_hours == 40

    def test_bounty_unique_github_issue_number_constraint(self, test_session):
        """Test that github_issue_number must be unique"""
        contributor = Contributor(
            github_username="testuser",
            github_id=123456
        )
        test_session.add(contributor)
        test_session.flush()

        bounty1 = Bounty(
            github_issue_number=100,
            title="First Bounty",
            reward_amount=Decimal("50.00"),
            tier="beginner",
            creator_id=contributor.id
        )
        test_session.add(bounty1)
        test_session.commit()

        bounty2 = Bounty(
            github_issue_number=100,  # Same issue number
            title="Second Bounty",
            reward_amount=Decimal("75.00"),
            tier="intermediate",
            creator_id=contributor.id
        )
        test_session.add(bounty2)

        with pytest.raises(IntegrityError):
            test_session.commit()

    def test_bounty_relationships(self, test_session):
        """Test bounty relationships with contributor, submissions, and payouts"""
        creator = Contributor(
            github_username="creator",
            github_id=123456
        )
        assignee = Contributor(
            github_username="assignee",
            github_id=789012
        )
        test_session.add_all([creator, assignee])
        test_session.flush()

        bounty = Bounty(
            github_issue_number=200,
            title="Relationship Test Bounty",
            reward_amount=Decimal("200.00"),
            tier="intermediate",
            creator_id=creator.id,
            assignee_id=assignee.id
        )
        test_session.add(bounty)
        test_session.flush()

        submission = Submission(
            bounty_id=bounty.id,
            contributor_id=assignee.id,
            pr_number=1,
            pr_url="https://github.com/test/repo/pull/1",
            status="pending"
        )
        test_session.add(submission)
        test_session.flush()

        payout = Payout(
            bounty_id=bounty.id,
            contributor_id=assignee.id,
            amount=Decimal("200.00"),
            currency="FNDRY",
            status="pending"
        )
        test_session.add(payout)
        test_session.commit()

        # Test relationships
        assert bounty.creator == creator
        assert bounty.assignee == assignee
        assert len(bounty.submissions) == 1
        assert bounty.submissions[0] == submission
        assert len(bounty.payouts) == 1
        assert bounty.payouts[0] == payout

    def test_bounty_cascade_deletion(self, test_session):
        """Test that deleting a bounty cascades to submissions and payouts"""
        contributor = Contributor(
            github_username="testuser",
            github_id=123456
        )
        test_session.add(contributor)
        test_session.flush()

        bounty = Bounty(
            github_issue_number=300,
            title="Cascade Test Bounty",
            reward_amount=Decimal("100.00"),
            tier="beginner",
            creator_id=contributor.id
        )
        test_session.add(bounty)
        test_session.flush()

        submission = Submission(
            bounty_id=bounty.id,
            contributor_id=contributor.id,
            pr_number=2,
            pr_url="https://github.com/test/repo/pull/2",
            status="pending"
        )
        payout = Payout(
            bounty_id=bounty.id,
            contributor_id=contributor.id,
            amount=Decimal("100.00"),
            currency="FNDRY",
            status="pending"
        )
        test_session.add_all([submission, payout])
        test_session.commit()

        submission_id = submission.id
        payout_id = payout.id

        # Delete bounty
        test_session.delete(bounty)
        test_session.commit()

        # Check that submissions and payouts were deleted
        assert test_session.get(Submission, submission_id) is None
        assert test_session.get(Payout, payout_id) is None


class TestContributorModel:
    """Test the Contributor model"""

    def test_contributor_creation_with_required_fields(self, test_session):
        """Test creating a contributor with only required fields"""
        contributor = Contributor(
            github_username="testuser",
            github_id=123456
        )
        test_session.add(contributor)
        test_session.commit()

        assert contributor.id is not None
        assert contributor.github_username == "testuser"
        assert contributor.github_id == 123456
        assert contributor.total_earnings == Decimal("0.00")  # default value
        assert contributor.completed_bounties == 0  # default value
        assert contributor.average_rating == Decimal("0.00")  # default value
        assert contributor.is_active is True  # default value
        assert contributor.created_at is not None
        assert contributor.last_activity is not None

    def test_contributor_unique_constraints(self, test_session):
        """Test unique constraints on github_username and github_id"""
        contributor1 = Contributor(
            github_username="testuser",
            github_id=123456
        )
        test_session.add(contributor1)
        test_session.commit()

        # Test unique github_username
        contributor2 = Contributor(
            github_username="testuser",  # Same username
            github_id=789012
        )
        test_session.add(contributor2)
        with pytest.raises(IntegrityError):
            test_session.commit()

        test_session.rollback()

        # Test unique github_id
        contributor3 = Contributor(
            github_username="different_user",
            github_id=123456  # Same github_id
        )
        test_session.add(contributor3)
        with pytest.raises(IntegrityError):
            test_session.commit()

    def test_contributor_relationships(self, test_session):
        """Test contributor relationships with bounties"""
        creator = Contributor(
            github_username="creator",
            github_id=123456
        )
        assignee = Contributor(
            github_username="assignee",
            github_id=789012
        )
        test_session.add_all([creator, assignee])
        test_session.flush()

        bounty1 = Bounty(
            github_issue_number=101,
            title="Created Bounty",
            reward_amount=Decimal("100.00"),
            tier="beginner",
            creator_id=creator.id
        )
        bounty2 = Bounty(
            github_issue_number=102,
            title="Assigned Bounty",
            reward_amount=Decimal("150.00"),
            tier="intermediate",
            creator_id=creator.id,
            assignee_id=assignee.id
        )
        test_session.add_all([bounty1, bounty2])
        test_session.commit()

        # Test creator relationships
        assert len(creator.created_bounties) == 2
        assert bounty1 in creator.created_bounties
        assert bounty2 in creator.created_bounties

        # Test assignee relationships
        assert len(assignee.assigned_bounties) == 1
        assert bounty2 in assignee.assigned_bounties


class TestMigrationManager:
    """Test the MigrationManager class"""

    def test_migration_manager_initialization(self):
        """Test MigrationManager initialization with default settings"""
        manager = MigrationManager()

        assert manager.database_url is not None
        assert manager.async_database_url.startswith('postgresql+asyncpg://')
        assert 'poolclass' in manager.pool_config
        assert manager.pool_config['pool_size'] == 20
        assert manager.alembic_cfg is not None

    def test_migration_manager_custom_database_url(self):
        """Test MigrationManager with custom database URL"""
        custom_url = "postgresql://user:pass@localhost/customdb"
        manager = MigrationManager(database_url=custom_url)

        assert manager.database_url == custom_url
        assert manager.async_database_url == "postgresql+asyncpg://user:pass@localhost/customdb"

    @patch('backend.database.migration.create_async_engine')
    def test_async_engine_creation(self, mock_create_engine):
        """Test async engine creation with proper configuration"""
        manager = MigrationManager()

        # Access async_engine property to trigger creation
        engine = manager.async_engine

        mock_create_engine.assert_called_once()
        call_args = mock_create_engine.call_args
        assert call_args[0][0] == manager.async_database_url
        assert 'poolclass' in call_args[1]
        assert call_args[1]['pool_size'] == 20

    @patch('backend.database.migration.async_sessionmaker')
    def test_session_maker_creation(self, mock_sessionmaker):
        """Test session maker creation"""
        manager = MigrationManager()

        # Access session_maker property to trigger creation
        session_maker = manager.session_maker

        mock_sessionmaker.assert_called_once()
        call_args = mock_sessionmaker.call_args
        assert call_args[1]['class_'] == AsyncSession
        assert call_args[1]['expire_on_commit'] is False

    @pytest.mark.asyncio
    async def test_get_session_context_manager(self):
        """Test get_session context manager"""
        manager = MigrationManager()

        # Mock the session maker to return a mock session
        mock_session = AsyncMock()
        manager._session_maker = Mock(return_value=mock_session)

        async with manager.get_session() as session:
            assert session == mock_session

        # Verify session was properly handled
        mock_session.__aenter__.assert_called_once()
        mock_session.__aexit__.assert_called_once()


class TestDatabaseService:
    """Test the DatabaseService class"""

    def test_database_service_initialization(self):
        """Test DatabaseService initialization with default parameters"""
        service = DatabaseService("postgresql://user:pass@localhost/testdb")

        assert service.database_url == "postgresql://user:pass@localhost/testdb"
        assert service.pool_size == 20
        assert service.max_overflow == 40
        assert service.async_engine is not None
        assert service.sync_engine is not None
        assert service._is_connected is False

    def test_database_service_custom_pool_settings(self):
        """Test DatabaseService with custom pool settings"""
        service = DatabaseService(
            "postgresql://user:pass@localhost/testdb",
            pool_size=10,
            max_overflow=20
        )

        assert service.pool_size == 10
        assert service.max_overflow == 20

    @pytest.mark.asyncio
    @patch('backend.services.database_service.create_async_engine')
    @patch('backend.services.database_service.text')
    async def test_database_service_initialization_success(self, mock_text, mock_create_engine):
        """Test successful database service initialization"""
        # Mock the engine and connection
        mock_engine = AsyncMock()
        mock_conn = AsyncMock()
        mock_engine.begin.return_value.__aenter__.return_value = mock_conn
        mock_create_engine.return_value = mock_engine

        service = DatabaseService("postgresql://user:pass@localhost/testdb")
        service.async_engine = mock_engine

        await service.initialize()

        assert service._is_connected is True
        mock_conn.execute.assert_called()
        mock_conn.run_sync.assert_called()

    @pytest.mark.asyncio
    async def test_database_service_initialization_failure(self):
        """Test database service initialization failure"""
        # Use an invalid database URL to trigger connection failure
        service = DatabaseService("postgresql://invalid:invalid@nonexistent/db")

        with pytest.raises(Exception):
            await service.initialize()

        assert service._is_connected is False

    def test_database_error_hierarchy(self):
        """Test database error class hierarchy"""
        base_error = DatabaseError("Base error")
        validation_error = ValidationError("Validation failed")
        connection_error = ConnectionError("Connection failed")

        assert isinstance(validation_error, DatabaseError)
        assert isinstance(connection_error, DatabaseError)
        assert str(base_error) == "Base error"
        assert str(validation_error) == "Validation failed"
        assert str(connection_error) == "Connection failed"

    @patch('backend.services.database_service.logger')
    @pytest.mark.asyncio
    async def test_database_service_logging(self, mock_logger):
        """Test that database service logs appropriately"""
        mock_engine = AsyncMock()
        mock_conn = AsyncMock()
        mock_engine.begin.return_value.__aenter__.return_value = mock_conn

        service = DatabaseService("postgresql://user:pass@localhost/testdb")
        service.async_engine = mock_engine

        await service.initialize()

        # Verify logging was called
        mock_logger.info.assert_called_with("Database service initialized successfully")


class TestModelIndexes:
    """Test database indexes are properly defined"""

    def test_bounty_indexes_defined(self):
        """Test that Bounty model has proper indexes defined"""
        indexes = Bounty.__table_args__

        index_names = [idx.name for idx in indexes if hasattr(idx, 'name')]

        expected_indexes = [
            'idx_bounties_status',
            'idx_bounties_tier',
            'idx_bounties_creator',
            'idx_bounties_assignee',
            'idx_bounties_created_at'
        ]

        for expected_index in expected_indexes:
            assert expected_index in index_names

    def test_contributor_indexes_defined(self):
        """Test that Contributor model has proper indexes defined"""
        indexes = Contributor.__table_args__

        index_names = [idx.name for idx in indexes if hasattr(idx, 'name')]

        expected_indexes = [
            'idx_contributors_github_username',
            'idx_contributors_total_earnings',
            'idx_contributors_is_active'
        ]

        for expected_index in expected_indexes:
            assert expected_index in index_names


class TestModelDefaults:
    """Test model default values and behaviors"""

    def test_bounty_default_values(self, test_session):
        """Test Bounty model default values"""
        contributor = Contributor(
            github_username="testuser",
            github_id=123456
        )
        test_session.add(contributor)
        test_session.flush()

        bounty = Bounty(
            github_issue_number=999,
            title="Default Test",
            reward_amount=Decimal("100.00"),
            tier="beginner",
            creator_id=contributor.id
        )
        test_session.add(bounty)
        test_session.commit()

        # Test JSONB default values
        assert bounty.requirements == []
        assert bounty.acceptance_criteria == []
        assert bounty.tags == []

    def test_uuid_generation(self, test_session):
        """Test that UUID fields are properly generated"""
        contributor = Contributor(
            github_username="uuidtest",
            github_id=999999
        )
        test_session.add(contributor)
        test_session.flush()

        bounty = Bounty(
            github_issue_number=888,
            title="UUID Test",
            reward_amount=Decimal("50.00"),
            tier="beginner",
            creator_id=contributor.id
        )
        test_session.add(bounty)
        test_session.commit()

        # Verify UUIDs are properly generated
        assert contributor.id is not None
        assert isinstance(contributor.id, uuid.UUID)
        assert bounty.id is not None
        assert isinstance(bounty.id, uuid.UUID)
        assert contributor.id != bounty.id  # Should be different UUIDs
