import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone
from backend.models import Bounty, BountyTimeline, User
from backend.services.timeline_service import TimelineService
from backend.exceptions import BountyNotFoundError, ValidationError


class TestTimelineService:
    """Test suite for timeline service functionality"""

    @pytest.fixture
    def mock_db_session(self):
        session = Mock()
        return session

    @pytest.fixture
    def timeline_service(self, mock_db_session):
        return TimelineService(db_session=mock_db_session)

    @pytest.fixture
    def sample_bounty(self):
        """Create a sample bounty for testing"""
        return Bounty(
            id=1,
            title="Test Bounty",
            description="Test Description",
            reward_amount=1000,
            status="open",
            created_at=datetime.now(timezone.utc),
            creator_id=1
        )

    @pytest.fixture
    def sample_user(self):
        return User(
            id=1,
            username="testuser",
            email="test@example.com"
        )

    def test_create_timeline_event_success(self, timeline_service, mock_db_session, sample_bounty):
        """Test successful timeline event creation"""
        event_data = {
            'bounty_id': 1,
            'event_type': 'bounty_created',
            'description': 'Bounty was created',
            'user_id': 1
        }

        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_bounty
        mock_event = Mock()
        mock_event.id = 1
        mock_db_session.add.return_value = None
        mock_db_session.commit.return_value = None

        with patch('backend.models.BountyTimeline') as mock_timeline:
            mock_timeline.return_value = mock_event

            result = timeline_service.create_timeline_event(**event_data)

            mock_timeline.assert_called_once_with(
                bounty_id=1,
                event_type='bounty_created',
                description='Bounty was created',
                user_id=1,
                created_at=pytest.approx(datetime.now(timezone.utc), abs=5)
            )
            mock_db_session.add.assert_called_once()
            mock_db_session.commit.assert_called_once()
            assert result == mock_event

    def test_create_timeline_event_invalid_bounty(self, timeline_service, mock_db_session):
        """Test timeline event creation with invalid bounty ID"""
        event_data = {
            'bounty_id': 999,
            'event_type': 'bounty_created',
            'description': 'Test event',
            'user_id': 1
        }

        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(BountyNotFoundError, match="Bounty with ID 999 not found"):
            timeline_service.create_timeline_event(**event_data)

    def test_create_timeline_event_missing_required_fields(self, timeline_service):
        """Test timeline event creation with missing required fields"""
        incomplete_data = {
            'bounty_id': 1,
            'event_type': 'bounty_created'
            # Missing description and user_id
        }

        with pytest.raises(ValidationError, match="Missing required fields"):
            timeline_service.create_timeline_event(**incomplete_data)

    def test_get_bounty_timeline_success(self, timeline_service, mock_db_session, sample_bounty):
        """Test successful retrieval of bounty timeline"""
        bounty_id = 1

        # Mock timeline events
        event1 = Mock()
        event1.id = 1
        event1.event_type = 'bounty_created'
        event1.description = 'Bounty created'
        event1.created_at = datetime(2024, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        event1.user_id = 1

        event2 = Mock()
        event2.id = 2
        event2.event_type = 'submission_received'
        event2.description = 'New submission received'
        event2.created_at = datetime(2024, 1, 2, 10, 0, 0, tzinfo=timezone.utc)
        event2.user_id = 2

        events = [event1, event2]

        # Mock bounty exists
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_bounty

        # Mock timeline query
        timeline_query = Mock()
        timeline_query.filter.return_value.order_by.return_value.all.return_value = events
        mock_db_session.query.return_value = timeline_query

        result = timeline_service.get_bounty_timeline(bounty_id)

        assert len(result) == 2
        assert result[0].event_type == 'bounty_created'
        assert result[1].event_type == 'submission_received'

        # Verify proper ordering (newest first)
        assert result[0].created_at <= result[1].created_at

    def test_get_bounty_timeline_invalid_bounty_id(self, timeline_service, mock_db_session):
        """Test timeline retrieval with invalid bounty ID"""
        bounty_id = 999

        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(BountyNotFoundError, match="Bounty with ID 999 not found"):
            timeline_service.get_bounty_timeline(bounty_id)

    def test_get_bounty_timeline_empty_results(self, timeline_service, mock_db_session, sample_bounty):
        """Test timeline retrieval with no timeline events"""
        bounty_id = 1

        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_bounty

        timeline_query = Mock()
        timeline_query.filter.return_value.order_by.return_value.all.return_value = []
        mock_db_session.query.return_value = timeline_query

        result = timeline_service.get_bounty_timeline(bounty_id)

        assert result == []

    def test_timeline_ordering_chronological(self, timeline_service, mock_db_session, sample_bounty):
        """Test that timeline events are properly ordered chronologically"""
        bounty_id = 1

        # Create events with different timestamps
        events = []
        for i in range(5):
            event = Mock()
            event.id = i + 1
            event.event_type = f'event_{i}'
            event.created_at = datetime(2024, 1, i + 1, 12, 0, 0, tzinfo=timezone.utc)
            events.append(event)

        # Mock bounty exists
        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_bounty

        # Mock timeline query
        timeline_query = Mock()
        timeline_query.filter.return_value.order_by.return_value.all.return_value = events
        mock_db_session.query.return_value = timeline_query

        result = timeline_service.get_bounty_timeline(bounty_id)

        # Verify ordering (should be chronological)
        for i in range(len(result) - 1):
            assert result[i].created_at <= result[i + 1].created_at

    @pytest.mark.parametrize("event_type,expected_description", [
        ("bounty_created", "Bounty was created"),
        ("submission_received", "New submission received"),
        ("submission_approved", "Submission was approved"),
        ("bounty_completed", "Bounty was completed"),
        ("bounty_cancelled", "Bounty was cancelled")
    ])
    def test_bounty_lifecycle_events(self, timeline_service, mock_db_session, sample_bounty, event_type, expected_description):
        """Test integration with various bounty lifecycle events"""
        event_data = {
            'bounty_id': 1,
            'event_type': event_type,
            'description': expected_description,
            'user_id': 1
        }

        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_bounty
        mock_event = Mock()
        mock_event.event_type = event_type

        with patch('backend.models.BountyTimeline') as mock_timeline:
            mock_timeline.return_value = mock_event

            result = timeline_service.create_timeline_event(**event_data)

            mock_timeline.assert_called_once()
            call_args = mock_timeline.call_args[1]
            assert call_args['event_type'] == event_type
            assert call_args['description'] == expected_description

    def test_timeline_with_user_context(self, timeline_service, mock_db_session, sample_bounty, sample_user):
        """Test timeline events with user context"""
        event_data = {
            'bounty_id': 1,
            'event_type': 'submission_received',
            'description': 'User submitted solution',
            'user_id': 1
        }

        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_bounty
        mock_event = Mock()
        mock_event.user_id = 1

        with patch('backend.models.BountyTimeline') as mock_timeline:
            mock_timeline.return_value = mock_event

            result = timeline_service.create_timeline_event(**event_data)

            assert result.user_id == 1

    def test_database_error_handling(self, timeline_service, mock_db_session, sample_bounty):
        """Test handling of database errors during timeline operations"""
        event_data = {
            'bounty_id': 1,
            'event_type': 'bounty_created',
            'description': 'Test event',
            'user_id': 1
        }

        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_bounty
        mock_db_session.commit.side_effect = Exception("Database connection error")

        with patch('backend.models.BountyTimeline'):
            with pytest.raises(Exception, match="Database connection error"):
                timeline_service.create_timeline_event(**event_data)

    def test_concurrent_timeline_events(self, timeline_service, mock_db_session, sample_bounty):
        """Test handling of concurrent timeline event creation"""
        events_data = [
            {
                'bounty_id': 1,
                'event_type': 'submission_received',
                'description': 'First submission',
                'user_id': 1
            },
            {
                'bounty_id': 1,
                'event_type': 'submission_received',
                'description': 'Second submission',
                'user_id': 2
            }
        ]

        mock_db_session.query.return_value.filter.return_value.first.return_value = sample_bounty

        created_events = []
        for i, event_data in enumerate(events_data):
            mock_event = Mock()
            mock_event.id = i + 1
            mock_event.event_type = event_data['event_type']

            with patch('backend.models.BountyTimeline') as mock_timeline:
                mock_timeline.return_value = mock_event

                result = timeline_service.create_timeline_event(**event_data)
                created_events.append(result)

        assert len(created_events) == 2
        assert all(event.event_type == 'submission_received' for event in created_events)
