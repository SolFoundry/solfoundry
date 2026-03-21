import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
from backend.services.onboarding import OnboardingService
from backend.models.user import User
from backend.models.bounty import Bounty
from backend.models.onboarding import OnboardingStage, OnboardingProgress
from backend.database import db_session
from backend.exceptions import ValidationError, NotFoundError


class TestOnboardingFlow:
    """Test suite for contributor onboarding flow functionality"""

    @pytest.fixture
    def onboarding_service(self):
        return OnboardingService()

    @pytest.fixture
    def mock_user(self):
        user = Mock(spec=User)
        user.id = 123
        user.username = "new_contributor"
        user.skill_level = "beginner"
        user.is_active = True
        user.created_at = datetime.utcnow()
        return user

    @pytest.fixture
    def mock_mentor(self):
        mentor = Mock(spec=User)
        mentor.id = 456
        mentor.username = "senior_dev"
        mentor.is_mentor = True
        mentor.mentor_capacity = 5
        mentor.active_mentees = 2
        return mentor

    @pytest.fixture
    def beginner_bounties(self):
        bounties = []
        for i in range(3):
            bounty = Mock(spec=Bounty)
            bounty.id = f"bounty_{i}"
            bounty.title = f"Beginner Task {i+1}"
            bounty.difficulty = "beginner"
            bounty.reward_amount = 100
            bounty.status = "open"
            bounty.labels = ["good-first-issue"]
            bounties.append(bounty)
        return bounties

    @pytest.mark.asyncio
    async def test_start_onboarding_flow_success(self, onboarding_service, mock_user):
        """Test successful onboarding flow initialization"""
        with patch.object(db_session, 'query') as mock_query:
            mock_query.return_value.filter.return_value.first.return_value = None

            with patch.object(db_session, 'add') as mock_add:
                with patch.object(db_session, 'commit'):
                    progress = await onboarding_service.start_onboarding(mock_user.id)

                    assert progress.user_id == mock_user.id
                    assert progress.current_stage == OnboardingStage.WELCOME
                    assert progress.started_at is not None
                    mock_add.assert_called_once()

    @pytest.mark.asyncio
    async def test_start_onboarding_already_exists(self, onboarding_service, mock_user):
        """Test starting onboarding when user already has progress"""
        existing_progress = Mock(spec=OnboardingProgress)
        existing_progress.user_id = mock_user.id
        existing_progress.current_stage = OnboardingStage.PROFILE_SETUP

        with patch.object(db_session, 'query') as mock_query:
            mock_query.return_value.filter.return_value.first.return_value = existing_progress

            progress = await onboarding_service.start_onboarding(mock_user.id)

            assert progress == existing_progress
            assert progress.current_stage == OnboardingStage.PROFILE_SETUP

    @pytest.mark.asyncio
    async def test_stage_progression_valid(self, onboarding_service, mock_user):
        """Test valid stage progression through onboarding"""
        progress = Mock(spec=OnboardingProgress)
        progress.user_id = mock_user.id
        progress.current_stage = OnboardingStage.WELCOME
        progress.stages_completed = []

        with patch.object(onboarding_service, 'get_progress') as mock_get:
            mock_get.return_value = progress

            with patch.object(db_session, 'commit'):
                updated_progress = await onboarding_service.advance_stage(
                    mock_user.id, OnboardingStage.PROFILE_SETUP
                )

                assert updated_progress.current_stage == OnboardingStage.PROFILE_SETUP
                assert OnboardingStage.WELCOME in progress.stages_completed

    @pytest.mark.asyncio
    async def test_stage_progression_invalid_skip(self, onboarding_service, mock_user):
        """Test invalid stage progression (skipping stages)"""
        progress = Mock(spec=OnboardingProgress)
        progress.user_id = mock_user.id
        progress.current_stage = OnboardingStage.WELCOME
        progress.stages_completed = []

        with patch.object(onboarding_service, 'get_progress') as mock_get:
            mock_get.return_value = progress

            with pytest.raises(ValidationError) as exc_info:
                await onboarding_service.advance_stage(
                    mock_user.id, OnboardingStage.FIRST_BOUNTY
                )

            assert "Invalid stage progression" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_mentor_assignment_success(self, onboarding_service, mock_user, mock_mentor):
        """Test successful mentor assignment to new contributor"""
        available_mentors = [mock_mentor]

        with patch.object(onboarding_service, '_find_available_mentors') as mock_find:
            mock_find.return_value = available_mentors

            with patch.object(db_session, 'commit'):
                assigned_mentor = await onboarding_service.assign_mentor(mock_user.id)

                assert assigned_mentor == mock_mentor
                assert mock_mentor.active_mentees == 3

    @pytest.mark.asyncio
    async def test_mentor_assignment_no_available(self, onboarding_service, mock_user):
        """Test mentor assignment when no mentors are available"""
        with patch.object(onboarding_service, '_find_available_mentors') as mock_find:
            mock_find.return_value = []

            assigned_mentor = await onboarding_service.assign_mentor(mock_user.id)

            assert assigned_mentor is None

    @pytest.mark.asyncio
    async def test_beginner_bounty_filtering(self, onboarding_service, beginner_bounties):
        """Test filtering of appropriate beginner bounties"""
        all_bounties = beginner_bounties + [
            Mock(difficulty="intermediate", status="open"),
            Mock(difficulty="beginner", status="claimed"),
            Mock(difficulty="advanced", status="open")
        ]

        with patch.object(db_session, 'query') as mock_query:
            mock_query.return_value.filter.return_value.all.return_value = all_bounties

            filtered = await onboarding_service.get_beginner_bounties()

            assert len(filtered) == 3
            for bounty in filtered:
                assert bounty.difficulty == "beginner"
                assert bounty.status == "open"

    @pytest.mark.asyncio
    async def test_completion_tracking_partial(self, onboarding_service, mock_user):
        """Test tracking partial completion of onboarding"""
        progress = Mock(spec=OnboardingProgress)
        progress.user_id = mock_user.id
        progress.current_stage = OnboardingStage.MENTOR_MATCH
        progress.stages_completed = [
            OnboardingStage.WELCOME,
            OnboardingStage.PROFILE_SETUP
        ]
        progress.completion_percentage = 40.0
        progress.is_completed = False

        with patch.object(onboarding_service, 'get_progress') as mock_get:
            mock_get.return_value = progress

            completion_status = await onboarding_service.get_completion_status(mock_user.id)

            assert completion_status['percentage'] == 40.0
            assert completion_status['is_completed'] is False
            assert completion_status['current_stage'] == OnboardingStage.MENTOR_MATCH

    @pytest.mark.asyncio
    async def test_completion_tracking_full(self, onboarding_service, mock_user):
        """Test tracking full completion of onboarding"""
        progress = Mock(spec=OnboardingProgress)
        progress.user_id = mock_user.id
        progress.current_stage = OnboardingStage.COMPLETED
        progress.stages_completed = list(OnboardingStage)
        progress.completion_percentage = 100.0
        progress.is_completed = True
        progress.completed_at = datetime.utcnow()

        with patch.object(onboarding_service, 'get_progress') as mock_get:
            mock_get.return_value = progress

            completion_status = await onboarding_service.get_completion_status(mock_user.id)

            assert completion_status['percentage'] == 100.0
            assert completion_status['is_completed'] is True
            assert completion_status['completed_at'] is not None

    @pytest.mark.asyncio
    async def test_error_handling_user_not_found(self, onboarding_service):
        """Test error handling for non-existent user"""
        with patch.object(db_session, 'query') as mock_query:
            mock_query.return_value.filter.return_value.first.return_value = None

            with pytest.raises(NotFoundError) as exc_info:
                await onboarding_service.get_progress(999)

            assert "User not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_integration_full_onboarding_pipeline(self, onboarding_service, mock_user, mock_mentor, beginner_bounties):
        """Integration test for complete onboarding pipeline"""
        # Mock database interactions
        with patch.object(db_session, 'query') as mock_query:
            with patch.object(db_session, 'add'):
                with patch.object(db_session, 'commit'):
                    # Start onboarding
                    mock_query.return_value.filter.return_value.first.return_value = None
                    progress = await onboarding_service.start_onboarding(mock_user.id)
                    assert progress.current_stage == OnboardingStage.WELCOME

                    # Mock progress for subsequent calls
                    mock_progress = Mock(spec=OnboardingProgress)
                    mock_progress.user_id = mock_user.id
                    mock_progress.current_stage = OnboardingStage.WELCOME
                    mock_progress.stages_completed = []
                    mock_query.return_value.filter.return_value.first.return_value = mock_progress

                    # Advance through stages
                    with patch.object(onboarding_service, 'get_progress') as mock_get:
                        mock_get.return_value = mock_progress

                        # Profile setup
                        mock_progress.current_stage = OnboardingStage.PROFILE_SETUP
                        await onboarding_service.advance_stage(mock_user.id, OnboardingStage.PROFILE_SETUP)

                        # Mentor assignment
                        with patch.object(onboarding_service, '_find_available_mentors') as mock_find:
                            mock_find.return_value = [mock_mentor]
                            mentor = await onboarding_service.assign_mentor(mock_user.id)
                            assert mentor == mock_mentor

                        # Get beginner bounties
                        mock_query.return_value.filter.return_value.all.return_value = beginner_bounties
                        bounties = await onboarding_service.get_beginner_bounties()
                        assert len(bounties) == 3

                        # Complete onboarding
                        mock_progress.is_completed = True
                        mock_progress.completion_percentage = 100.0
                        completion = await onboarding_service.get_completion_status(mock_user.id)
                        assert completion['is_completed'] is True

    @pytest.mark.asyncio
    async def test_onboarding_timeout_handling(self, onboarding_service, mock_user):
        """Test handling of stalled onboarding sessions"""
        old_progress = Mock(spec=OnboardingProgress)
        old_progress.user_id = mock_user.id
        old_progress.current_stage = OnboardingStage.PROFILE_SETUP
        old_progress.last_activity = datetime.utcnow() - timedelta(days=7)
        old_progress.is_stalled = False

        with patch.object(onboarding_service, 'get_progress') as mock_get:
            mock_get.return_value = old_progress

            with patch.object(db_session, 'commit'):
                result = await onboarding_service.check_stalled_progress(mock_user.id)

                assert result['is_stalled'] is True
                assert old_progress.is_stalled is True

    def test_stage_validation_enum_values(self, onboarding_service):
        """Test that all onboarding stages are properly defined"""
        expected_stages = [
            OnboardingStage.WELCOME,
            OnboardingStage.PROFILE_SETUP,
            OnboardingStage.MENTOR_MATCH,
            OnboardingStage.FIRST_BOUNTY,
            OnboardingStage.COMPLETED
        ]

        for stage in expected_stages:
            assert isinstance(stage, OnboardingStage)
            assert stage.value is not None
