"""Tests for the dispute resolution system.

Covers:
- Happy path: initiate, submit evidence, AI mediation, admin resolve
- Edge cases: 72-hour window, duplicate disputes, auth enforcement
- Enum usage: DisputeReason and SubmissionStatus as enum members, not strings
"""

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.bounty import SubmissionStatus
from app.models.dispute import (
    DisputeCreate,
    DisputeOutcome,
    DisputeReason,
    DisputeResolve,
    DisputeStatus,
    EvidenceItem,
)
from app.services import dispute_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db():
    """Return a minimal mock AsyncSession."""
    db = AsyncMock()
    db.execute = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


def _make_dispute(
    status: str = DisputeStatus.PENDING.value,
    outcome: str | None = None,
    submitter_id: str | None = None,
):
    """Build a minimal DisputeDB-like mock."""
    d = MagicMock()
    d.id = uuid.uuid4()
    d.bounty_id = uuid.uuid4()
    d.submitter_id = uuid.UUID(submitter_id) if submitter_id else uuid.uuid4()
    d.reason = DisputeReason.INCORRECT_REVIEW.value
    d.description = "The review was incorrect."
    d.evidence_links = []
    d.status = status
    d.outcome = outcome
    d.reviewer_id = None
    d.review_notes = None
    d.resolution_action = None
    d.created_at = datetime.now(timezone.utc)
    d.updated_at = datetime.now(timezone.utc)
    d.resolved_at = None
    return d


# ---------------------------------------------------------------------------
# initiate_dispute
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_initiate_dispute_happy_path():
    """A new dispute is created when no duplicate exists."""
    db = _make_db()
    submitter_id = str(uuid.uuid4())
    bounty_id = str(uuid.uuid4())

    # No existing open dispute
    db.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)
    db.refresh.side_effect = lambda obj: None

    data = DisputeCreate(
        bounty_id=bounty_id,
        reason=DisputeReason.INCORRECT_REVIEW.value,
        description="The review was unfair and did not follow the rubric.",
    )

    # Patch _to_response so we don't need a real DB refresh
    mock_response = MagicMock()
    with patch.object(dispute_service, "_to_response", return_value=mock_response):
        with patch("app.services.dispute_service.DisputeHistoryDB"):
            response = await dispute_service.initiate_dispute(
                db=db,
                data=data,
                submitter_id=submitter_id,
                submission_rejected_at=None,
            )

    assert response is not None
    db.add.assert_called()
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_initiate_dispute_window_expired():
    """Disputes filed after 72 hours are rejected."""
    db = _make_db()
    submitter_id = str(uuid.uuid4())
    bounty_id = str(uuid.uuid4())

    rejected_at = datetime.now(timezone.utc) - timedelta(hours=73)

    data = DisputeCreate(
        bounty_id=bounty_id,
        reason=DisputeReason.INCORRECT_REVIEW.value,
        description="Filed too late but trying anyway.",
    )

    with pytest.raises(ValueError, match="Dispute window expired"):
        await dispute_service.initiate_dispute(
            db=db,
            data=data,
            submitter_id=submitter_id,
            submission_rejected_at=rejected_at,
        )


@pytest.mark.asyncio
async def test_initiate_dispute_within_window():
    """Disputes filed within 72 hours are accepted."""
    db = _make_db()
    submitter_id = str(uuid.uuid4())
    bounty_id = str(uuid.uuid4())

    rejected_at = datetime.now(timezone.utc) - timedelta(hours=24)

    db.execute.return_value.scalar_one_or_none = MagicMock(return_value=None)

    data = DisputeCreate(
        bounty_id=bounty_id,
        reason=DisputeReason.INCORRECT_REVIEW.value,
        description="Filed within the 72-hour window.",
    )

    db.refresh.side_effect = lambda obj: None

    mock_response = MagicMock()
    with patch.object(dispute_service, "_to_response", return_value=mock_response):
        with patch("app.services.dispute_service.DisputeHistoryDB"):
            response = await dispute_service.initiate_dispute(
                db=db,
                data=data,
                submitter_id=submitter_id,
                submission_rejected_at=rejected_at,
            )

    assert response is not None


@pytest.mark.asyncio
async def test_initiate_dispute_duplicate_prevented():
    """Duplicate open disputes for the same bounty/submitter are blocked."""
    db = _make_db()
    submitter_id = str(uuid.uuid4())
    bounty_id = str(uuid.uuid4())

    # Simulate an existing open dispute
    existing = _make_dispute()
    db.execute.return_value.scalar_one_or_none = MagicMock(return_value=existing)

    data = DisputeCreate(
        bounty_id=bounty_id,
        reason=DisputeReason.INCORRECT_REVIEW.value,
        description="Trying to file a duplicate dispute.",
    )

    with pytest.raises(ValueError, match="open dispute already exists"):
        await dispute_service.initiate_dispute(
            db=db,
            data=data,
            submitter_id=submitter_id,
            submission_rejected_at=None,
        )


# ---------------------------------------------------------------------------
# submit_evidence
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_submit_evidence_happy_path():
    """Evidence is appended for the dispute submitter."""
    submitter_id = str(uuid.uuid4())
    dispute = _make_dispute(submitter_id=submitter_id)

    db = _make_db()
    db.refresh.side_effect = lambda obj: None

    items = [EvidenceItem(type="link", url="https://example.com", description="Proof")]

    with patch.object(dispute_service, "_get_dispute_by_id", return_value=dispute):
        with patch("app.services.dispute_service.DisputeHistoryDB"):
            response = await dispute_service.submit_evidence(
                db=db,
                dispute_id=str(dispute.id),
                actor_id=submitter_id,
                items=items,
            )

    assert response is not None
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_submit_evidence_unauthorized():
    """Non-submitters cannot add evidence."""
    submitter_id = str(uuid.uuid4())
    other_user = str(uuid.uuid4())
    dispute = _make_dispute(submitter_id=submitter_id)

    db = _make_db()
    items = [EvidenceItem(type="link", url="https://example.com", description="Nope")]

    with patch.object(dispute_service, "_get_dispute_by_id", return_value=dispute):
        with pytest.raises(PermissionError, match="Only the dispute submitter"):
            await dispute_service.submit_evidence(
                db=db,
                dispute_id=str(dispute.id),
                actor_id=other_user,
                items=items,
            )


@pytest.mark.asyncio
async def test_submit_evidence_already_resolved():
    """Evidence cannot be added to a resolved dispute."""
    submitter_id = str(uuid.uuid4())
    dispute = _make_dispute(
        status=DisputeStatus.RESOLVED.value, submitter_id=submitter_id
    )

    db = _make_db()
    items = [EvidenceItem(type="link", url="https://example.com", description="Late")]

    with patch.object(dispute_service, "_get_dispute_by_id", return_value=dispute):
        with pytest.raises(ValueError, match="resolved or closed"):
            await dispute_service.submit_evidence(
                db=db,
                dispute_id=str(dispute.id),
                actor_id=submitter_id,
                items=items,
            )


# ---------------------------------------------------------------------------
# AI auto-mediation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ai_mediation_above_threshold():
    """A score ≥ 7.0 auto-resolves the dispute in the contributor's favour."""
    dispute = _make_dispute()
    db = _make_db()
    db.refresh.side_effect = lambda obj: None

    with patch.object(dispute_service, "_get_dispute_by_id", return_value=dispute):
        with patch("app.services.dispute_service.DisputeHistoryDB"):
            result = await dispute_service.try_ai_auto_mediation(
                db=db,
                dispute_id=str(dispute.id),
                ai_review_score=8.5,
            )

    assert result is not None
    assert dispute.status == DisputeStatus.RESOLVED.value
    assert dispute.outcome == DisputeOutcome.APPROVED.value


@pytest.mark.asyncio
async def test_ai_mediation_below_threshold():
    """A score < 7.0 does NOT auto-resolve the dispute."""
    dispute = _make_dispute()
    db = _make_db()

    with patch.object(dispute_service, "_get_dispute_by_id", return_value=dispute):
        result = await dispute_service.try_ai_auto_mediation(
            db=db,
            dispute_id=str(dispute.id),
            ai_review_score=5.9,
        )

    assert result is None
    assert dispute.status == DisputeStatus.PENDING.value


# ---------------------------------------------------------------------------
# Admin resolve
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resolve_dispute_manual():
    """Admin can manually resolve an open dispute."""
    admin_id = str(uuid.uuid4())
    dispute = _make_dispute()
    db = _make_db()
    db.refresh.side_effect = lambda obj: None

    resolution = DisputeResolve(
        outcome=DisputeOutcome.APPROVED.value,
        review_notes="Contributor's implementation was valid.",
    )

    with patch.object(dispute_service, "_get_dispute_by_id", return_value=dispute):
        with patch("app.services.dispute_service.DisputeHistoryDB"):
            result = await dispute_service.resolve_dispute(
                db=db,
                dispute_id=str(dispute.id),
                resolution=resolution,
                admin_id=admin_id,
            )

    assert result is not None
    assert dispute.status == DisputeStatus.RESOLVED.value
    assert dispute.outcome == DisputeOutcome.APPROVED.value
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_resolve_dispute_already_resolved():
    """Resolving an already-resolved dispute raises ValueError."""
    admin_id = str(uuid.uuid4())
    dispute = _make_dispute(status=DisputeStatus.RESOLVED.value)
    db = _make_db()

    resolution = DisputeResolve(
        outcome=DisputeOutcome.REJECTED.value,
        review_notes="Frivolous dispute.",
    )

    with patch.object(dispute_service, "_get_dispute_by_id", return_value=dispute):
        with pytest.raises(ValueError, match="already resolved"):
            await dispute_service.resolve_dispute(
                db=db,
                dispute_id=str(dispute.id),
                resolution=resolution,
                admin_id=admin_id,
            )


@pytest.mark.asyncio
async def test_resolve_dispute_not_found():
    """Resolving a non-existent dispute raises ValueError."""
    admin_id = str(uuid.uuid4())
    db = _make_db()

    resolution = DisputeResolve(
        outcome=DisputeOutcome.REJECTED.value,
        review_notes="Dispute not found.",
    )

    with patch.object(dispute_service, "_get_dispute_by_id", return_value=None):
        with pytest.raises(ValueError, match="not found"):
            await dispute_service.resolve_dispute(
                db=db,
                dispute_id=str(uuid.uuid4()),
                resolution=resolution,
                admin_id=admin_id,
            )


# ---------------------------------------------------------------------------
# Enum correctness sanity checks
# ---------------------------------------------------------------------------


def test_submission_status_enum_values():
    """SubmissionStatus enum members match expected string values."""
    assert SubmissionStatus.REJECTED.value == "rejected"
    assert SubmissionStatus.PENDING.value == "pending"
    assert SubmissionStatus.APPROVED.value == "approved"


def test_dispute_reason_enum_members():
    """DisputeReason enum has the expected members."""
    assert DisputeReason.INCORRECT_REVIEW.value == "incorrect_review"
    assert DisputeReason.PLAGIARISM.value == "plagiarism"
    assert DisputeReason.RULE_VIOLATION.value == "rule_violation"
    assert DisputeReason.UNFAIR_COMPETITION.value == "unfair_competition"


def test_dispute_create_requires_description():
    """DisputeCreate rejects descriptions that are too short."""
    with pytest.raises(Exception):
        DisputeCreate(
            bounty_id=str(uuid.uuid4()),
            reason=DisputeReason.INCORRECT_REVIEW.value,
            description="short",  # min_length=10
        )


def test_dispute_create_valid():
    """DisputeCreate accepts valid payloads."""
    data = DisputeCreate(
        bounty_id=str(uuid.uuid4()),
        reason=DisputeReason.INCORRECT_REVIEW.value,
        description="This review was clearly incorrect and biased.",
    )
    assert data.reason == DisputeReason.INCORRECT_REVIEW.value


def test_dispute_resolve_valid():
    """DisputeResolve accepts valid outcome strings."""
    r = DisputeResolve(
        outcome=DisputeOutcome.APPROVED.value,
        review_notes="The contributor's work was valid.",
    )
    assert r.outcome == DisputeOutcome.APPROVED.value


def test_dispute_resolve_invalid_outcome():
    """DisputeResolve rejects unknown outcome strings."""
    with pytest.raises(Exception):
        DisputeResolve(
            outcome="invalid_outcome",
            review_notes="This should fail validation.",
        )
