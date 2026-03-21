import pytest
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import Bounty, User, Submission, BountyStatus, SubmissionStatus
from backend.services.submission_service import SubmissionService
from backend.services.notification_service import NotificationService
from backend.services.payout_service import PayoutService
from backend.services.ai_review_service import AIReviewService


@pytest.fixture
async def creator_user(db_session: AsyncSession):
    user = User(
        username="bounty_creator",
        wallet_address="9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        email="creator@example.com",
        reputation_score=85
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def contributor_user(db_session: AsyncSession):
    user = User(
        username="contributor_dev",
        wallet_address="7kqL2mX9rRp3vNaQwWg8HjFxZnD4tKsE9uYvC6bT5nPq",
        email="contributor@example.com",
        reputation_score=42
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def active_bounty(db_session: AsyncSession, creator_user: User):
    bounty = Bounty(
        title="Fix API Rate Limiting",
        description="Implement proper rate limiting for public API endpoints",
        reward_amount=500000,
        creator_id=creator_user.id,
        status=BountyStatus.ACTIVE,
        tags=["backend", "api"],
        requirements="Must include tests and documentation",
        escrow_locked=True,
        created_at=datetime.utcnow()
    )
    db_session.add(bounty)
    await db_session.commit()
    await db_session.refresh(bounty)
    return bounty


@pytest.fixture
async def submission_service():
    return SubmissionService()


@pytest.fixture
async def notification_service():
    return NotificationService()


@pytest.fixture
async def payout_service():
    return PayoutService()


@pytest.fixture
async def ai_review_service():
    return AIReviewService()


@pytest.mark.asyncio
async def test_submit_pr_success(
    db_session: AsyncSession,
    active_bounty: Bounty,
    contributor_user: User,
    submission_service: SubmissionService
):
    # Test successful PR submission
    pr_url = "https://github.com/SolFoundry/solfoundry/pull/245"

    with patch.object(submission_service, 'validate_pr_url', return_value=True):
        submission = await submission_service.submit_pr(
            bounty_id=active_bounty.id,
            contributor_id=contributor_user.id,
            pr_url=pr_url,
            notes="Implemented rate limiting with Redis backend"
        )

    assert submission.bounty_id == active_bounty.id
    assert submission.contributor_id == contributor_user.id
    assert submission.pr_url == pr_url
    assert submission.status == SubmissionStatus.UNDER_REVIEW
    assert submission.notes == "Implemented rate limiting with Redis backend"

    # Verify bounty status updated
    await db_session.refresh(active_bounty)
    assert active_bounty.status == BountyStatus.UNDER_REVIEW


@pytest.mark.asyncio
async def test_ai_score_integration(
    db_session: AsyncSession,
    active_bounty: Bounty,
    contributor_user: User,
    ai_review_service: AIReviewService
):
    # Create submission first
    submission = Submission(
        bounty_id=active_bounty.id,
        contributor_id=contributor_user.id,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/246",
        status=SubmissionStatus.UNDER_REVIEW
    )
    db_session.add(submission)
    await db_session.commit()

    # Mock AI review response
    mock_scores = {
        "gpt": 8.5,
        "gemini": 7.8,
        "grok": 8.2,
        "overall": 8.17,
        "feedback": "Good implementation with comprehensive tests"
    }

    with patch.object(ai_review_service, 'get_review_scores', return_value=mock_scores):
        await ai_review_service.process_review(submission.id)

    await db_session.refresh(submission)
    assert submission.ai_score_gpt == 8.5
    assert submission.ai_score_gemini == 7.8
    assert submission.ai_score_grok == 8.2
    assert submission.ai_overall_score == 8.17
    assert submission.ai_feedback == "Good implementation with comprehensive tests"


@pytest.mark.asyncio
async def test_creator_approval(
    db_session: AsyncSession,
    active_bounty: Bounty,
    creator_user: User,
    contributor_user: User,
    submission_service: SubmissionService
):
    # Create reviewed submission
    submission = Submission(
        bounty_id=active_bounty.id,
        contributor_id=contributor_user.id,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/247",
        status=SubmissionStatus.UNDER_REVIEW,
        ai_overall_score=8.5
    )
    db_session.add(submission)
    await db_session.commit()

    # Creator approves submission
    with patch.object(submission_service, 'send_approval_notification') as mock_notify:
        approved_submission = await submission_service.approve_submission(
            submission_id=submission.id,
            approver_id=creator_user.id,
            approval_notes="Excellent work, meets all requirements"
        )

    assert approved_submission.status == SubmissionStatus.APPROVED
    assert approved_submission.approved_by == creator_user.id
    assert approved_submission.approval_notes == "Excellent work, meets all requirements"
    assert approved_submission.approved_at is not None

    mock_notify.assert_called_once()


@pytest.mark.asyncio
async def test_auto_approve_timeout(
    db_session: AsyncSession,
    active_bounty: Bounty,
    contributor_user: User,
    submission_service: SubmissionService
):
    # Create submission that should auto-approve after timeout
    past_time = datetime.utcnow() - timedelta(days=8)  # Beyond 7-day timeout
    submission = Submission(
        bounty_id=active_bounty.id,
        contributor_id=contributor_user.id,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/248",
        status=SubmissionStatus.UNDER_REVIEW,
        ai_overall_score=7.5,
        submitted_at=past_time
    )
    db_session.add(submission)
    await db_session.commit()

    # Run auto-approval check
    with patch('backend.services.submission_service.datetime') as mock_datetime:
        mock_datetime.utcnow.return_value = datetime.utcnow()
        auto_approved = await submission_service.check_auto_approval_timeout()

    await db_session.refresh(submission)
    assert submission.status == SubmissionStatus.APPROVED
    assert submission.auto_approved is True


@pytest.mark.asyncio
async def test_payout_flow(
    db_session: AsyncSession,
    active_bounty: Bounty,
    contributor_user: User,
    payout_service: PayoutService
):
    # Create approved submission
    submission = Submission(
        bounty_id=active_bounty.id,
        contributor_id=contributor_user.id,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/249",
        status=SubmissionStatus.APPROVED,
        ai_overall_score=8.0
    )
    db_session.add(submission)
    await db_session.commit()

    # Mock Solana transaction
    mock_tx_hash = "4kXq9rFpT2nR8vL5mE7sY9wA3bC6dJ1oK8pN2qS5tU7xZ"

    with patch.object(payout_service, 'transfer_escrowed_funds') as mock_transfer:
        mock_transfer.return_value = mock_tx_hash

        payout_result = await payout_service.process_payout(submission.id)

    assert payout_result["success"] is True
    assert payout_result["transaction_hash"] == mock_tx_hash

    await db_session.refresh(submission)
    assert submission.status == SubmissionStatus.PAID
    assert submission.payout_tx_hash == mock_tx_hash

    await db_session.refresh(active_bounty)
    assert active_bounty.status == BountyStatus.COMPLETED


@pytest.mark.asyncio
async def test_notification_flow(
    db_session: AsyncSession,
    active_bounty: Bounty,
    creator_user: User,
    contributor_user: User,
    notification_service: NotificationService
):
    # Test notification sending for various events
    submission = Submission(
        bounty_id=active_bounty.id,
        contributor_id=contributor_user.id,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/250",
        status=SubmissionStatus.UNDER_REVIEW
    )
    db_session.add(submission)
    await db_session.commit()

    with patch.object(notification_service, 'send_email') as mock_email:
        with patch.object(notification_service, 'send_telegram') as mock_telegram:
            # Notify creator of new submission
            await notification_service.notify_submission_received(
                bounty=active_bounty,
                submission=submission,
                creator=creator_user
            )

            # Notify contributor of approval
            await notification_service.notify_submission_approved(
                submission=submission,
                contributor=contributor_user
            )

    assert mock_email.call_count == 2
    assert mock_telegram.call_count == 2


@pytest.mark.asyncio
async def test_dispute_handling(
    db_session: AsyncSession,
    active_bounty: Bounty,
    creator_user: User,
    contributor_user: User,
    submission_service: SubmissionService
):
    # Create submission for dispute
    submission = Submission(
        bounty_id=active_bounty.id,
        contributor_id=contributor_user.id,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/251",
        status=SubmissionStatus.UNDER_REVIEW,
        ai_overall_score=6.5
    )
    db_session.add(submission)
    await db_session.commit()

    # Creator disputes the submission
    disputed_submission = await submission_service.dispute_submission(
        submission_id=submission.id,
        disputer_id=creator_user.id,
        dispute_reason="Does not meet requirements - missing edge case handling"
    )

    assert disputed_submission.status == SubmissionStatus.DISPUTED
    assert disputed_submission.disputed_by == creator_user.id
    assert disputed_submission.dispute_reason == "Does not meet requirements - missing edge case handling"
    assert disputed_submission.disputed_at is not None

    # Verify bounty returns to active status
    await db_session.refresh(active_bounty)
    assert active_bounty.status == BountyStatus.ACTIVE


@pytest.mark.asyncio
async def test_submission_status_transitions(
    db_session: AsyncSession,
    active_bounty: Bounty,
    contributor_user: User,
    submission_service: SubmissionService
):
    # Test valid status transitions
    submission = Submission(
        bounty_id=active_bounty.id,
        contributor_id=contributor_user.id,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/252",
        status=SubmissionStatus.UNDER_REVIEW
    )
    db_session.add(submission)
    await db_session.commit()

    # Valid transitions
    valid_transitions = [
        (SubmissionStatus.UNDER_REVIEW, SubmissionStatus.APPROVED),
        (SubmissionStatus.APPROVED, SubmissionStatus.PAID),
        (SubmissionStatus.UNDER_REVIEW, SubmissionStatus.DISPUTED),
        (SubmissionStatus.DISPUTED, SubmissionStatus.REJECTED)
    ]

    for from_status, to_status in valid_transitions:
        submission.status = from_status
        result = await submission_service.update_submission_status(
            submission_id=submission.id,
            new_status=to_status
        )
        assert result is True

    # Test invalid transition
    submission.status = SubmissionStatus.PAID
    with pytest.raises(ValueError, match="Invalid status transition"):
        await submission_service.update_submission_status(
            submission_id=submission.id,
            new_status=SubmissionStatus.UNDER_REVIEW
        )
