import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from sqlalchemy.orm import Session

from backend.bounty_lifecycle import BountyLifecycleEngine, BountyLifecycleError, StateTransition
from backend.lifecycle_webhooks import WebhookProcessor
from backend.api_lifecycle import router
from backend.models import Bounty, BountyState, BountyTier, User, BountyAuditLog
from backend.database import get_db


class TestBountyLifecycleEngine:

    def test_valid_state_transitions(self):
        """Test that all valid state transitions are properly defined"""
        db_mock = Mock(spec=Session)
        engine = BountyLifecycleEngine(db_mock)

        # Test draft to open transition
        assert BountyState.OPEN in engine.valid_transitions[BountyState.DRAFT]

        # Test open can go to claimed or in_review
        assert BountyState.CLAIMED in engine.valid_transitions[BountyState.OPEN]
        assert BountyState.IN_REVIEW in engine.valid_transitions[BountyState.OPEN]

        # Test claimed can go back to open or forward to in_review
        assert BountyState.OPEN in engine.valid_transitions[BountyState.CLAIMED]
        assert BountyState.IN_REVIEW in engine.valid_transitions[BountyState.CLAIMED]

        # Test in_review can complete or go back to open
        assert BountyState.COMPLETED in engine.valid_transitions[BountyState.IN_REVIEW]
        assert BountyState.OPEN in engine.valid_transitions[BountyState.IN_REVIEW]

        # Test completed can only go to paid
        assert BountyState.PAID in engine.valid_transitions[BountyState.COMPLETED]

        # Test paid is terminal state
        assert engine.valid_transitions[BountyState.PAID] == []

    def test_validate_transition_valid_cases(self):
        """Test validation of valid state transitions"""
        db_mock = Mock(spec=Session)
        engine = BountyLifecycleEngine(db_mock)

        bounty_draft = Mock(spec=Bounty)
        bounty_draft.state = BountyState.DRAFT

        bounty_open = Mock(spec=Bounty)
        bounty_open.state = BountyState.OPEN

        bounty_claimed = Mock(spec=Bounty)
        bounty_claimed.state = BountyState.CLAIMED

        # Valid transitions should return True
        assert engine._validate_transition(bounty_draft, BountyState.OPEN) is True
        assert engine._validate_transition(bounty_open, BountyState.CLAIMED) is True
        assert engine._validate_transition(bounty_claimed, BountyState.IN_REVIEW) is True

    def test_validate_transition_invalid_cases(self):
        """Test validation rejects invalid state transitions"""
        db_mock = Mock(spec=Session)
        engine = BountyLifecycleEngine(db_mock)

        bounty_draft = Mock(spec=Bounty)
        bounty_draft.state = BountyState.DRAFT

        bounty_paid = Mock(spec=Bounty)
        bounty_paid.state = BountyState.PAID

        # Invalid transitions should return False
        assert engine._validate_transition(bounty_draft, BountyState.COMPLETED) is False
        assert engine._validate_transition(bounty_draft, BountyState.PAID) is False
        assert engine._validate_transition(bounty_paid, BountyState.OPEN) is False

    def test_log_audit_creates_entry(self):
        """Test that audit logging creates proper database entries"""
        db_mock = Mock(spec=Session)
        engine = BountyLifecycleEngine(db_mock)

        bounty = Mock(spec=Bounty)
        bounty.id = 123

        metadata = {"test_key": "test_value"}

        with patch('backend.bounty_lifecycle.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2023, 1, 1, 12, 0, 0)

            engine._log_audit(
                bounty=bounty,
                action="STATE_CHANGE",
                old_state=BountyState.DRAFT,
                new_state=BountyState.OPEN,
                user_id=456,
                metadata=metadata
            )

        # Verify audit log was created and added to session
        db_mock.add.assert_called_once()
        db_mock.flush.assert_called_once()

        added_audit = db_mock.add.call_args[0][0]
        assert isinstance(added_audit, BountyAuditLog)
        assert added_audit.bounty_id == 123
        assert added_audit.action == "STATE_CHANGE"
        assert added_audit.old_state == BountyState.DRAFT
        assert added_audit.new_state == BountyState.OPEN
        assert added_audit.user_id == 456
        assert added_audit.metadata == metadata

    def test_claim_timeouts_configuration(self):
        """Test that claim timeouts are properly configured for each tier"""
        db_mock = Mock(spec=Session)
        engine = BountyLifecycleEngine(db_mock)

        # T1 should have no timeout (immediate race)
        assert engine.claim_timeouts[BountyTier.T1] == 0

        # T2 should have 48 hour timeout
        assert engine.claim_timeouts[BountyTier.T2] == 48

        # T3 should have 72 hour timeout
        assert engine.claim_timeouts[BountyTier.T3] == 72


class TestWebhookProcessor:

    def test_verify_github_signature_valid(self):
        """Test GitHub webhook signature verification with valid signature"""
        processor = WebhookProcessor()

        with patch('backend.lifecycle_webhooks.current_app') as mock_app:
            mock_app.config.get.return_value = 'test_secret'

            payload = b'{"test": "data"}'
            # Create expected signature
            import hmac
            import hashlib
            expected_sig = 'sha256=' + hmac.new(
                b'test_secret',
                payload,
                hashlib.sha256
            ).hexdigest()

            assert processor.verify_github_signature(payload, expected_sig) is True

    def test_verify_github_signature_invalid(self):
        """Test GitHub webhook signature verification with invalid signature"""
        processor = WebhookProcessor()

        with patch('backend.lifecycle_webhooks.current_app') as mock_app:
            mock_app.config.get.return_value = 'test_secret'

            payload = b'{"test": "data"}'
            invalid_signature = 'sha256=invalid_signature'

            assert processor.verify_github_signature(payload, invalid_signature) is False

    def test_verify_github_signature_no_secret(self):
        """Test webhook verification fails when no secret is configured"""
        processor = WebhookProcessor()

        with patch('backend.lifecycle_webhooks.current_app') as mock_app:
            mock_app.config.get.return_value = ''

            payload = b'{"test": "data"}'
            signature = 'sha256=any_signature'

            assert processor.verify_github_signature(payload, signature) is False

    def test_process_pr_webhook_no_pr_number(self):
        """Test PR webhook processing when PR number is missing"""
        processor = WebhookProcessor()

        payload = {
            'action': 'opened',
            'pull_request': {}  # Missing number
        }

        result = processor.process_pr_webhook(payload)
        assert result is None

    def test_process_pr_webhook_with_valid_data(self):
        """Test PR webhook processing with valid PR data"""
        processor = WebhookProcessor()

        payload = {
            'action': 'opened',
            'pull_request': {
                'number': 123,
                'state': 'open',
                'merged': False,
                'body': 'This PR closes #456'
            }
        }

        # Mock the bounty finding method
        mock_bounty = Mock(spec=Bounty)
        mock_bounty.id = 456

        with patch.object(processor, '_find_bounties_for_pr', return_value=[mock_bounty]):
            with patch.object(processor, '_handle_pr_state_change', return_value={'bounty_id': 456}):
                result = processor.process_pr_webhook(payload)

                assert result is not None
                assert 'processed_bounties' in result
                assert len(result['processed_bounties']) == 1
                assert result['processed_bounties'][0]['bounty_id'] == 456

    def test_find_bounties_for_pr_with_references(self):
        """Test finding bounties from PR body references"""
        processor = WebhookProcessor()

        payload = {
            'pull_request': {
                'body': 'This PR closes #123 and fixes #456'
            }
        }

        # Mock Bounty query
        mock_bounty_123 = Mock(spec=Bounty)
        mock_bounty_123.id = 123

        mock_bounty_456 = Mock(spec=Bounty)
        mock_bounty_456.id = 456

        with patch('backend.lifecycle_webhooks.Bounty') as mock_bounty_class:
            mock_query = Mock()
            mock_bounty_class.query = mock_query

            # Configure query to return different bounties for different IDs
            def filter_by_side_effect(id=None):
                mock_filter = Mock()
                if id == 123:
                    mock_filter.first.return_value = mock_bounty_123
                elif id == 456:
                    mock_filter.first.return_value = mock_bounty_456
                else:
                    mock_filter.first.return_value = None
                return mock_filter

            mock_query.filter_by.side_effect = filter_by_side_effect

            bounties = processor._find_bounties_for_pr(999, payload)

            # Should find both bounties
            assert len(bounties) == 2
            assert mock_bounty_123 in bounties
            assert mock_bounty_456 in bounties


class TestAPILifecycle:

    @pytest.fixture
    def mock_db_session(self):
        """Create a mock database session"""
        session = Mock(spec=Session)
        return session

    @pytest.fixture
    def mock_user(self):
        """Create a mock user"""
        user = Mock(spec=User)
        user.id = 1
        user.username = "testuser"
        return user

    def test_create_draft_success(self, mock_db_session, mock_user):
        """Test successful draft bounty creation"""
        from backend.api_lifecycle import create_draft
        from backend.schemas.bounty import BountyCreate

        bounty_data = Mock(spec=BountyCreate)
        bounty_data.title = "Test Bounty"
        bounty_data.description = "Test Description"
        bounty_data.tier = BountyTier.T2
        bounty_data.reward_amount = 100
        bounty_data.deadline = datetime.utcnow() + timedelta(days=7)

        # Mock the created bounty
        created_bounty = Mock(spec=Bounty)
        created_bounty.id = 123
        created_bounty.tier = BountyTier.T2

        mock_db_session.refresh.side_effect = lambda bounty: setattr(bounty, 'id', 123)

        with patch('backend.api_lifecycle.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2023, 1, 1, 12, 0, 0)

            with patch('backend.api_lifecycle.Bounty', return_value=created_bounty):
                with patch('backend.api_lifecycle.AuditLog') as mock_audit:
                    result = create_draft(bounty_data, mock_db_session, mock_user)

        # Verify bounty was added to session
        mock_db_session.add.assert_called()
        mock_db_session.commit.assert_called()

        # Verify response
        assert result["id"] == 123
        assert result["status"] == "draft"
        assert "successfully" in result["message"]

    def test_create_draft_database_error(self, mock_db_session, mock_user):
        """Test draft creation with database error"""
        from backend.api_lifecycle import create_draft
        from backend.schemas.bounty import BountyCreate
        from fastapi import HTTPException

        bounty_data = Mock(spec=BountyCreate)
        bounty_data.title = "Test Bounty"
        bounty_data.description = "Test Description"
        bounty_data.tier = BountyTier.T1
        bounty_data.reward_amount = 50
        bounty_data.deadline = datetime.utcnow() + timedelta(days=3)

        # Make database operation fail
        mock_db_session.commit.side_effect = Exception("Database error")

        with pytest.raises(HTTPException) as exc_info:
            create_draft(bounty_data, mock_db_session, mock_user)

        assert exc_info.value.status_code == 500
        assert "Failed to create draft bounty" in str(exc_info.value.detail)

    def test_publish_bounty_success(self, mock_db_session, mock_user):
        """Test successful bounty publishing from draft to open"""
        from backend.api_lifecycle import publish_bounty
        from backend.models.bounty import BountyStatus

        # Create mock bounty in draft state
        mock_bounty = Mock(spec=Bounty)
        mock_bounty.id = 123
        mock_bounty.creator_id = mock_user.id
        mock_bounty.status = BountyStatus.DRAFT
        mock_bounty.tier = BountyTier.T2
        mock_bounty.reward_amount = 100

        # Configure query to return the bounty
        mock_query = Mock()
        mock_db_session.query.return_value = mock_query
        mock_query.filter.return_value.first.return_value = mock_bounty

        with patch('backend.api_lifecycle.datetime') as mock_datetime:
            mock_datetime.utcnow.return_value = datetime(2023, 1, 1, 12, 0, 0)

            with patch('backend.api_lifecycle.AuditLog') as mock_audit:
                result = publish_bounty(123, mock_db_session, mock_user)

        # Verify bounty state changed
        assert mock_bounty.status == BountyStatus.OPEN
        assert hasattr(mock_bounty, 'published_at')

        # Verify database commit
        mock_db_session.commit.assert_called_once()

    def test_publish_bounty_not_found(self, mock_db_session, mock_user):
        """Test publishing non-existent bounty"""
        from backend.api_lifecycle import publish_bounty
        from fastapi import HTTPException

        # Configure query to return None
        mock_query = Mock()
        mock_db_session.query.return_value = mock_query
        mock_query.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            publish_bounty(999, mock_db_session, mock_user)

        assert exc_info.value.status_code == 404
        assert "Bounty not found" in str(exc_info.value.detail)

    def test_publish_bounty_wrong_creator(self, mock_db_session, mock_user):
        """Test publishing bounty by non-creator"""
        from backend.api_lifecycle import publish_bounty
        from backend.models.bounty import BountyStatus
        from fastapi import HTTPException

        # Create bounty with different creator
        mock_bounty = Mock(spec=Bounty)
        mock_bounty.id = 123
        mock_bounty.creator_id = 999  # Different from mock_user.id (1)
        mock_bounty.status = BountyStatus.DRAFT

        mock_query = Mock()
        mock_db_session.query.return_value = mock_query
        mock_query.filter.return_value.first.return_value = mock_bounty

        with pytest.raises(HTTPException) as exc_info:
            publish_bounty(123, mock_db_session, mock_user)

        assert exc_info.value.status_code == 403
        assert "Only creator can publish bounty" in str(exc_info.value.detail)

    def test_publish_bounty_wrong_state(self, mock_db_session, mock_user):
        """Test publishing bounty not in draft state"""
        from backend.api_lifecycle import publish_bounty
        from backend.models.bounty import BountyStatus
        from fastapi import HTTPException

        mock_bounty = Mock(spec=Bounty)
        mock_bounty.id = 123
        mock_bounty.creator_id = mock_user.id
        mock_bounty.status = BountyStatus.OPEN  # Already published

        mock_query = Mock()
        mock_db_session.query.return_value = mock_query
        mock_query.filter.return_value.first.return_value = mock_bounty

        with pytest.raises(HTTPException) as exc_info:
            publish_bounty(123, mock_db_session, mock_user)

        assert exc_info.value.status_code == 400
        assert "Can only publish draft bounties" in str(exc_info.value.detail)
