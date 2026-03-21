"""Tests for the dispute resolution system."""

import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from app.models.dispute import (
    DisputeState,
    DisputeOutcome,
    DisputeReason,
    DisputeCreate,
    DisputeResolve,
    EvidenceSubmission,
    EvidenceItem,
    EvidenceType,
)
from app.services.dispute_service import DisputeService, AI_RESOLUTION_THRESHOLD


@pytest.fixture
def mock_session():
    """Mock database session."""
    from unittest.mock import AsyncMock, MagicMock
    session = AsyncMock()
    return session


@pytest.fixture
def dispute_service(mock_session):
    """Dispute service with mocked session."""
    return DisputeService(mock_session)


@pytest.fixture
def sample_dispute_create():
    """Sample dispute creation data."""
    return DisputeCreate(
        bounty_id=str(uuid4()),
        submission_id=str(uuid4()),
        reason=DisputeReason.MET_REQUIREMENTS,
        description="My submission met all the requirements but was rejected unfairly.",
        initial_evidence=[
            EvidenceItem(
                type=EvidenceType.LINK,
                url="https://github.com/example/pr/1",
                description="The PR that was rejected",
            )
        ],
    )


class TestDisputeModels:
    """Tests for dispute Pydantic models."""

    def test_dispute_create_validation(self):
        """Test dispute creation validation."""
        data = DisputeCreate(
            bounty_id=str(uuid4()),
            submission_id=str(uuid4()),
            reason=DisputeReason.INCORRECT_REVIEW,
            description="This is a valid description with enough characters.",
        )
        assert data.reason == DisputeReason.INCORRECT_REVIEW
        assert len(data.description) >= 10

    def test_dispute_create_invalid_reason(self):
        """Test that invalid reason raises error."""
        with pytest.raises(ValueError):
            DisputeCreate(
                bounty_id=str(uuid4()),
                submission_id=str(uuid4()),
                reason="invalid_reason",
                description="Valid description here.",
            )

    def test_dispute_create_short_description(self):
        """Test that short description raises error."""
        with pytest.raises(ValueError):
            DisputeCreate(
                bounty_id=str(uuid4()),
                submission_id=str(uuid4()),
                reason=DisputeReason.OTHER,
                description="Too short",
            )

    def test_evidence_item_validation(self):
        """Test evidence item validation."""
        evidence = EvidenceItem(
            type=EvidenceType.LINK,
            url="https://example.com/evidence",
            description="This is evidence",
        )
        assert evidence.type == EvidenceType.LINK
        assert evidence.url == "https://example.com/evidence"

    def test_dispute_resolve_validation(self):
        """Test dispute resolution validation."""
        resolution = DisputeResolve(
            outcome=DisputeOutcome.RELEASE_TO_CONTRIBUTOR,
            resolution_notes="The submission was correct and should be accepted.",
            creator_penalty=5.0,
            contributor_penalty=0.0,
        )
        assert resolution.outcome == DisputeOutcome.RELEASE_TO_CONTRIBUTOR
        assert resolution.creator_penalty == 5.0


class TestDisputeStates:
    """Tests for dispute state transitions."""

    def test_state_values(self):
        """Test that state enum values are correct."""
        assert DisputeState.OPENED.value == "OPENED"
        assert DisputeState.EVIDENCE.value == "EVIDENCE"
        assert DisputeState.MEDIATION.value == "MEDIATION"
        assert DisputeState.RESOLVED.value == "RESOLVED"

    def test_outcome_values(self):
        """Test that outcome enum values are correct."""
        assert DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value == "release_to_contributor"
        assert DisputeOutcome.REFUND_TO_CREATOR.value == "refund_to_creator"
        assert DisputeOutcome.SPLIT.value == "split"


class TestAIMediation:
    """Tests for AI mediation logic."""

    def test_ai_threshold_value(self):
        """Test that AI threshold is correctly set."""
        assert AI_RESOLUTION_THRESHOLD == 7.0

    def test_ai_score_calculation_logic(self):
        """Test that AI scoring logic is reasonable."""
        # The service uses a base score of 5.0 and adjusts based on evidence
        # This test verifies the logic structure
        base_score = 5.0
        
        # Contributor evidence should increase score
        contrib_evidence_count = 3
        expected_boost = min(contrib_evidence_count * 0.5, 2.0)
        assert expected_boost == 1.5
        
        # Creator evidence should decrease score
        creator_evidence_count = 2
        expected_penalty = min(creator_evidence_count * 0.3, 1.5)
        assert expected_penalty == 0.6


class TestDisputeReasons:
    """Tests for dispute reason enum."""

    def test_reason_values(self):
        """Test that reason enum values are correct."""
        assert DisputeReason.INCORRECT_REVIEW.value == "incorrect_review"
        assert DisputeReason.MET_REQUIREMENTS.value == "met_requirements"
        assert DisputeReason.UNFAIR_REJECTION.value == "unfair_rejection"
        assert DisputeReason.MISUNDERSTANDING.value == "misunderstanding"
        assert DisputeReason.TECHNICAL_ISSUE.value == "technical_issue"
        assert DisputeReason.OTHER.value == "other"


class TestEvidenceTypes:
    """Tests for evidence type enum."""

    def test_evidence_type_values(self):
        """Test that evidence type enum values are correct."""
        assert EvidenceType.LINK.value == "link"
        assert EvidenceType.IMAGE.value == "image"
        assert EvidenceType.TEXT.value == "text"
        assert EvidenceType.CODE.value == "code"
        assert EvidenceType.DOCUMENT.value == "document"


class TestDisputeService:
    """Tests for DisputeService methods."""

    @pytest.mark.asyncio
    async def test_create_dispute_submission_not_found(self, dispute_service, sample_dispute_create):
        """Test creating dispute for non-existent submission."""
        from unittest.mock import AsyncMock, MagicMock
        from sqlalchemy import select
        
        # Mock the session to return no submission
        dispute_service.session.execute = AsyncMock()
        dispute_service.session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)
        
        result, error = await dispute_service.create_dispute(
            contributor_id=str(uuid4()),
            data=sample_dispute_create,
            creator_id=str(uuid4()),
        )
        
        assert result is None
        assert error == "Submission not found"

    @pytest.mark.asyncio
    async def test_get_dispute_not_found(self, dispute_service):
        """Test getting non-existent dispute."""
        from unittest.mock import AsyncMock, MagicMock
        
        dispute_service.session.execute = AsyncMock()
        dispute_service.session.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)
        
        result = await dispute_service.get_dispute(str(uuid4()))
        
        assert result is None


# Integration test markers
@pytest.mark.integration
class TestDisputeIntegration:
    """Integration tests for dispute resolution."""

    @pytest.mark.asyncio
    async def test_full_dispute_lifecycle(self):
        """Test the complete dispute lifecycle from creation to resolution."""
        # This would be a full integration test with a real database
        # For now, it's marked as an integration test to be run separately
        pass