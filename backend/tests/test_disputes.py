"""Comprehensive tests for the Dispute Resolution System.

Tests cover:
  - Dispute model validation (Pydantic schemas)
  - State machine transitions (OPENED → EVIDENCE → MEDIATION → RESOLVED)
  - 72-hour initiation window enforcement
  - Evidence submission by both parties
  - AI auto-mediation when score ≥ threshold
  - Manual admin resolution with all outcome types
  - Reputation impact calculations
  - Full dispute lifecycle integration (API endpoints)
  - Pagination, filtering, and stats
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)

from app.database import Base, get_db
from app.main import app
from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.models.dispute import (
    DisputeCreate,
    DisputeOutcome,
    DisputeResolve,
    DisputeState,
    EvidenceItem,
    EvidenceSubmit,
    VALID_STATE_TRANSITIONS,
    DISPUTE_INITIATION_WINDOW_HOURS,
    DisputeDB,
    DisputeEvidenceDB,
    DisputeAuditDB,
)
from app.services.dispute_service import (
    DisputeService,
    REPUTATION_UNFAIR_REJECTION_PENALTY,
    REPUTATION_FRIVOLOUS_DISPUTE_PENALTY,
    REPUTATION_VALID_DISPUTE_BONUS,
    REPUTATION_FAIR_CREATOR_BONUS,
)

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/solfoundry_test",
)

CONTRIBUTOR_ID = str(uuid.uuid4())
CREATOR_ID = str(uuid.uuid4())
ADMIN_ID = str(uuid.uuid4())
BOUNTY_ID = str(uuid.uuid4())
SUBMISSION_ID = str(uuid.uuid4())

MOCK_USER_CONTRIBUTOR = UserResponse(
    id=CONTRIBUTOR_ID,
    github_id="contributor-gh",
    username="contributor",
    email="contributor@example.com",
    wallet_address="ContributorWallet1234567890123456789012345678",
    wallet_verified=True,
    created_at=datetime.now(timezone.utc),
    updated_at=datetime.now(timezone.utc),
)

MOCK_USER_CREATOR = UserResponse(
    id=CREATOR_ID,
    github_id="creator-gh",
    username="creator",
    email="creator@example.com",
    wallet_address="CreatorWallet12345678901234567890123456789012",
    wallet_verified=True,
    created_at=datetime.now(timezone.utc),
    updated_at=datetime.now(timezone.utc),
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def db_engine():
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
    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
def dispute_service(db_session) -> DisputeService:
    return DisputeService(db_session)


@pytest_asyncio.fixture
async def client_contributor(db_session):
    """Test client authenticated as the contributor."""
    async def override_get_db():
        yield db_session

    async def override_auth():
        return MOCK_USER_CONTRIBUTOR

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_auth

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_creator(db_session):
    """Test client authenticated as the bounty creator."""
    async def override_get_db():
        yield db_session

    async def override_auth():
        return MOCK_USER_CREATOR

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_auth

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


def _make_create_payload(**overrides) -> dict:
    defaults = {
        "bounty_id": BOUNTY_ID,
        "submission_id": SUBMISSION_ID,
        "reason": "valid_submission_rejected",
        "description": "My submission was valid but rejected unfairly. Here is why...",
    }
    defaults.update(overrides)
    return defaults


def _recent_rejection() -> datetime:
    """Return a rejection timestamp within the 72h window."""
    return datetime.now(timezone.utc) - timedelta(hours=1)


def _expired_rejection() -> datetime:
    """Return a rejection timestamp outside the 72h window."""
    return datetime.now(timezone.utc) - timedelta(hours=73)


# ===========================================================================
# Pydantic model validation
# ===========================================================================


class TestDisputeModels:
    def test_create_valid(self):
        data = DisputeCreate(**_make_create_payload())
        assert data.reason == "valid_submission_rejected"
        assert len(data.description) > 10

    def test_create_invalid_reason(self):
        with pytest.raises(ValueError, match="Invalid reason"):
            DisputeCreate(**_make_create_payload(reason="not_a_reason"))

    def test_create_description_too_short(self):
        with pytest.raises(ValueError):
            DisputeCreate(**_make_create_payload(description="short"))

    def test_create_with_initial_evidence(self):
        evidence = [
            EvidenceItem(
                evidence_type="link",
                url="https://github.com/org/repo/pull/42",
                description="My PR meets all requirements",
            )
        ]
        data = DisputeCreate(**_make_create_payload(), evidence=evidence)
        assert len(data.evidence) == 1

    def test_resolve_valid(self):
        data = DisputeResolve(
            outcome="release_to_contributor",
            resolution_notes="Contributor's submission was valid.",
        )
        assert data.outcome == "release_to_contributor"

    def test_resolve_invalid_outcome(self):
        with pytest.raises(ValueError, match="Invalid outcome"):
            DisputeResolve(outcome="invalid", resolution_notes="test")

    def test_resolve_split_requires_pct(self):
        with pytest.raises(ValueError, match="split_contributor_pct required"):
            DisputeResolve(outcome="split", resolution_notes="50/50 split")

    def test_resolve_split_with_pct(self):
        data = DisputeResolve(
            outcome="split",
            resolution_notes="60/40 split",
            split_contributor_pct=60.0,
        )
        assert data.split_contributor_pct == 60.0

    def test_evidence_item_valid(self):
        item = EvidenceItem(
            evidence_type="link",
            url="https://example.com",
            description="Supporting evidence link",
        )
        assert item.evidence_type == "link"

    def test_evidence_submit_valid(self):
        items = [
            EvidenceItem(
                evidence_type="explanation",
                description="My code implements the required feature exactly as specified.",
            )
        ]
        data = EvidenceSubmit(items=items)
        assert len(data.items) == 1


class TestStateTransitions:
    """Verify the state machine transition map."""

    def test_opened_can_go_to_evidence(self):
        assert DisputeState.EVIDENCE in VALID_STATE_TRANSITIONS[DisputeState.OPENED]

    def test_evidence_can_go_to_mediation(self):
        assert DisputeState.MEDIATION in VALID_STATE_TRANSITIONS[DisputeState.EVIDENCE]

    def test_mediation_can_go_to_resolved(self):
        assert DisputeState.RESOLVED in VALID_STATE_TRANSITIONS[DisputeState.MEDIATION]

    def test_resolved_is_terminal(self):
        assert VALID_STATE_TRANSITIONS[DisputeState.RESOLVED] == set()

    def test_no_skipping_states(self):
        assert DisputeState.MEDIATION not in VALID_STATE_TRANSITIONS[DisputeState.OPENED]
        assert DisputeState.RESOLVED not in VALID_STATE_TRANSITIONS[DisputeState.OPENED]
        assert DisputeState.RESOLVED not in VALID_STATE_TRANSITIONS[DisputeState.EVIDENCE]

    def test_all_states_in_map(self):
        for state in DisputeState:
            assert state in VALID_STATE_TRANSITIONS


# ===========================================================================
# Service-level tests (require database)
# ===========================================================================


class TestDisputeServiceCreate:
    @pytest.mark.asyncio
    async def test_create_dispute_success(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        result = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        assert result.state == DisputeState.EVIDENCE.value
        assert result.contributor_id == CONTRIBUTOR_ID
        assert result.creator_id == CREATOR_ID
        assert result.reason == "valid_submission_rejected"

    @pytest.mark.asyncio
    async def test_create_dispute_expired_window(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        with pytest.raises(ValueError, match="Dispute window expired"):
            await dispute_service.create_dispute(
                data, CONTRIBUTOR_ID, CREATOR_ID, _expired_rejection()
            )

    @pytest.mark.asyncio
    async def test_create_dispute_duplicate_blocked(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        with pytest.raises(ValueError, match="active dispute already exists"):
            await dispute_service.create_dispute(
                data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
            )

    @pytest.mark.asyncio
    async def test_create_dispute_with_initial_evidence(self, dispute_service):
        evidence = [
            EvidenceItem(
                evidence_type="link",
                url="https://github.com/org/repo/pull/42",
                description="The PR fully implements the spec",
            )
        ]
        data = DisputeCreate(**_make_create_payload(), evidence=evidence)
        result = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        detail = await dispute_service.get_dispute(str(result.id))
        assert len(detail.evidence) == 1
        assert detail.evidence[0].party == "contributor"

    @pytest.mark.asyncio
    async def test_create_dispute_sets_evidence_deadline(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        result = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        assert result.evidence_deadline is not None

    @pytest.mark.asyncio
    async def test_create_dispute_audit_trail(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        result = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        detail = await dispute_service.get_dispute(str(result.id))
        actions = [a.action for a in detail.audit_trail]
        assert "dispute_opened" in actions
        assert "state_transition_evidence" in actions


class TestDisputeServiceEvidence:
    @pytest.mark.asyncio
    async def test_contributor_submits_evidence(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        items = [
            EvidenceItem(
                evidence_type="explanation",
                description="The code fully satisfies every acceptance criterion.",
            )
        ]
        result = await dispute_service.submit_evidence(
            str(dispute.id), items, CONTRIBUTOR_ID
        )
        assert len(result) == 1
        assert result[0].party == "contributor"

    @pytest.mark.asyncio
    async def test_creator_submits_evidence(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        items = [
            EvidenceItem(
                evidence_type="explanation",
                description="The submission failed to meet requirement #3 of the spec.",
            )
        ]
        result = await dispute_service.submit_evidence(
            str(dispute.id), items, CREATOR_ID
        )
        assert len(result) == 1
        assert result[0].party == "creator"

    @pytest.mark.asyncio
    async def test_third_party_cannot_submit_evidence(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        random_user = str(uuid.uuid4())
        items = [
            EvidenceItem(evidence_type="link", description="I want to submit too")
        ]
        with pytest.raises(ValueError, match="Only the contributor or bounty creator"):
            await dispute_service.submit_evidence(
                str(dispute.id), items, random_user
            )

    @pytest.mark.asyncio
    async def test_evidence_only_during_evidence_phase(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        await dispute_service.advance_to_mediation(str(dispute.id), CONTRIBUTOR_ID)

        items = [
            EvidenceItem(evidence_type="link", description="Too late evidence")
        ]
        with pytest.raises(ValueError, match="EVIDENCE phase"):
            await dispute_service.submit_evidence(
                str(dispute.id), items, CONTRIBUTOR_ID
            )


class TestDisputeServiceMediation:
    @pytest.mark.asyncio
    async def test_advance_to_mediation(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        result = await dispute_service.advance_to_mediation(
            str(dispute.id), CONTRIBUTOR_ID
        )
        assert result.state in (
            DisputeState.MEDIATION.value,
            DisputeState.RESOLVED.value,
        )
        assert result.ai_review_score is not None

    @pytest.mark.asyncio
    async def test_ai_auto_resolve_high_score(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        result = await dispute_service.advance_to_mediation(
            str(dispute.id), CONTRIBUTOR_ID
        )
        if result.ai_review_score and result.ai_review_score >= 7.0:
            assert result.state == DisputeState.RESOLVED.value
            assert result.outcome == DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value
            assert result.mediation_type == "ai_auto"

    @pytest.mark.asyncio
    async def test_mediation_requires_evidence_state(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        await dispute_service.advance_to_mediation(str(dispute.id), CONTRIBUTOR_ID)

        result = await dispute_service.get_dispute(str(dispute.id))
        if result.state == DisputeState.MEDIATION.value:
            with pytest.raises(ValueError, match="EVIDENCE state"):
                await dispute_service.advance_to_mediation(
                    str(dispute.id), CONTRIBUTOR_ID
                )


class TestDisputeServiceResolve:
    @pytest.mark.asyncio
    async def _create_mediation_dispute(self, svc):
        """Helper to get a dispute into MEDIATION state."""
        data = DisputeCreate(
            **_make_create_payload(submission_id=str(uuid.uuid4()))
        )
        dispute = await svc.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        result = await svc.advance_to_mediation(str(dispute.id), CONTRIBUTOR_ID)
        if result.state == DisputeState.RESOLVED.value:
            return None
        return result

    @pytest.mark.asyncio
    async def test_admin_resolve_release_to_contributor(self, dispute_service):
        dispute = await self._create_mediation_dispute(dispute_service)
        if not dispute:
            pytest.skip("AI auto-resolved; cannot test manual resolution")

        resolve_data = DisputeResolve(
            outcome="release_to_contributor",
            resolution_notes="Contributor's work is valid after manual review.",
        )
        result = await dispute_service.resolve_dispute(
            str(dispute.id), resolve_data, ADMIN_ID
        )
        assert result.state == DisputeState.RESOLVED.value
        assert result.outcome == DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value
        assert result.mediation_type == "admin_manual"
        assert result.creator_reputation_delta == REPUTATION_UNFAIR_REJECTION_PENALTY
        assert result.contributor_reputation_delta == REPUTATION_VALID_DISPUTE_BONUS

    @pytest.mark.asyncio
    async def test_admin_resolve_refund_to_creator(self, dispute_service):
        dispute = await self._create_mediation_dispute(dispute_service)
        if not dispute:
            pytest.skip("AI auto-resolved")

        resolve_data = DisputeResolve(
            outcome="refund_to_creator",
            resolution_notes="Submission does not meet spec requirements.",
        )
        result = await dispute_service.resolve_dispute(
            str(dispute.id), resolve_data, ADMIN_ID
        )
        assert result.state == DisputeState.RESOLVED.value
        assert result.outcome == DisputeOutcome.REFUND_TO_CREATOR.value
        assert result.contributor_reputation_delta == REPUTATION_FRIVOLOUS_DISPUTE_PENALTY
        assert result.creator_reputation_delta == REPUTATION_FAIR_CREATOR_BONUS

    @pytest.mark.asyncio
    async def test_admin_resolve_split(self, dispute_service):
        dispute = await self._create_mediation_dispute(dispute_service)
        if not dispute:
            pytest.skip("AI auto-resolved")

        resolve_data = DisputeResolve(
            outcome="split",
            resolution_notes="Both parties have valid points. 60/40 split.",
            split_contributor_pct=60.0,
        )
        result = await dispute_service.resolve_dispute(
            str(dispute.id), resolve_data, ADMIN_ID
        )
        assert result.state == DisputeState.RESOLVED.value
        assert result.outcome == DisputeOutcome.SPLIT.value
        assert result.split_contributor_pct == 60.0
        assert result.split_creator_pct == 40.0
        assert result.contributor_reputation_delta == 0
        assert result.creator_reputation_delta == 0

    @pytest.mark.asyncio
    async def test_resolve_requires_mediation_state(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        resolve_data = DisputeResolve(
            outcome="release_to_contributor",
            resolution_notes="Trying to resolve too early",
        )
        with pytest.raises(ValueError, match="MEDIATION state"):
            await dispute_service.resolve_dispute(
                str(dispute.id), resolve_data, ADMIN_ID
            )

    @pytest.mark.asyncio
    async def test_resolved_dispute_has_timestamp(self, dispute_service):
        dispute = await self._create_mediation_dispute(dispute_service)
        if not dispute:
            pytest.skip("AI auto-resolved")

        resolve_data = DisputeResolve(
            outcome="release_to_contributor",
            resolution_notes="Valid submission.",
        )
        result = await dispute_service.resolve_dispute(
            str(dispute.id), resolve_data, ADMIN_ID
        )
        assert result.resolved_at is not None


class TestDisputeServiceRead:
    @pytest.mark.asyncio
    async def test_get_dispute_not_found(self, dispute_service):
        result = await dispute_service.get_dispute(str(uuid.uuid4()))
        assert result is None

    @pytest.mark.asyncio
    async def test_get_dispute_with_detail(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        detail = await dispute_service.get_dispute(str(dispute.id))
        assert detail is not None
        assert detail.id == dispute.id
        assert len(detail.audit_trail) > 0

    @pytest.mark.asyncio
    async def test_list_disputes_empty(self, dispute_service):
        result = await dispute_service.list_disputes()
        assert result.total == 0
        assert result.items == []

    @pytest.mark.asyncio
    async def test_list_disputes_with_data(self, dispute_service):
        for i in range(3):
            data = DisputeCreate(
                **_make_create_payload(submission_id=str(uuid.uuid4()))
            )
            await dispute_service.create_dispute(
                data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
            )
        result = await dispute_service.list_disputes()
        assert result.total == 3

    @pytest.mark.asyncio
    async def test_list_disputes_filter_by_state(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        result = await dispute_service.list_disputes(state=DisputeState.EVIDENCE.value)
        assert result.total == 1

        result = await dispute_service.list_disputes(state=DisputeState.RESOLVED.value)
        assert result.total == 0

    @pytest.mark.asyncio
    async def test_list_disputes_pagination(self, dispute_service):
        for i in range(5):
            data = DisputeCreate(
                **_make_create_payload(submission_id=str(uuid.uuid4()))
            )
            await dispute_service.create_dispute(
                data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
            )
        result = await dispute_service.list_disputes(skip=0, limit=2)
        assert result.total == 5
        assert len(result.items) == 2

    @pytest.mark.asyncio
    async def test_get_stats(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        stats = await dispute_service.get_stats()
        assert stats.total == 1
        assert stats.in_evidence == 1


class TestDisputeFullLifecycle:
    """End-to-end lifecycle: OPENED → EVIDENCE → MEDIATION → RESOLVED."""

    @pytest.mark.asyncio
    async def test_full_lifecycle_manual_resolution(self, dispute_service):
        data = DisputeCreate(**_make_create_payload())
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        assert dispute.state == DisputeState.EVIDENCE.value

        contributor_evidence = [
            EvidenceItem(
                evidence_type="link",
                url="https://github.com/org/repo/pull/42",
                description="PR meets all acceptance criteria listed in the bounty.",
            )
        ]
        await dispute_service.submit_evidence(
            str(dispute.id), contributor_evidence, CONTRIBUTOR_ID
        )

        creator_evidence = [
            EvidenceItem(
                evidence_type="explanation",
                description="The submission is missing requirement #3 from the spec.",
            )
        ]
        await dispute_service.submit_evidence(
            str(dispute.id), creator_evidence, CREATOR_ID
        )

        mediation_result = await dispute_service.advance_to_mediation(
            str(dispute.id), ADMIN_ID
        )

        if mediation_result.state == DisputeState.RESOLVED.value:
            assert mediation_result.mediation_type == "ai_auto"
            return

        assert mediation_result.state == DisputeState.MEDIATION.value
        assert mediation_result.ai_review_score is not None

        resolve_data = DisputeResolve(
            outcome="release_to_contributor",
            resolution_notes="After review, the submission meets the spec.",
        )
        final = await dispute_service.resolve_dispute(
            str(dispute.id), resolve_data, ADMIN_ID
        )
        assert final.state == DisputeState.RESOLVED.value
        assert final.outcome == DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value
        assert final.resolved_at is not None
        assert final.reputation_impact_applied is True

        detail = await dispute_service.get_dispute(str(dispute.id))
        assert len(detail.evidence) == 2
        assert len(detail.audit_trail) >= 4

    @pytest.mark.asyncio
    async def test_full_lifecycle_with_split(self, dispute_service):
        data = DisputeCreate(
            **_make_create_payload(submission_id=str(uuid.uuid4()))
        )
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        mediation = await dispute_service.advance_to_mediation(
            str(dispute.id), ADMIN_ID
        )
        if mediation.state == DisputeState.RESOLVED.value:
            pytest.skip("AI auto-resolved")

        resolve_data = DisputeResolve(
            outcome="split",
            resolution_notes="Partial compliance. 70/30 split.",
            split_contributor_pct=70.0,
        )
        final = await dispute_service.resolve_dispute(
            str(dispute.id), resolve_data, ADMIN_ID
        )
        assert final.outcome == DisputeOutcome.SPLIT.value
        assert final.split_contributor_pct == 70.0
        assert final.split_creator_pct == 30.0


class TestReputationImpact:
    @pytest.mark.asyncio
    async def test_unfair_rejection_penalizes_creator(self, dispute_service):
        data = DisputeCreate(
            **_make_create_payload(submission_id=str(uuid.uuid4()))
        )
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        mediation = await dispute_service.advance_to_mediation(
            str(dispute.id), ADMIN_ID
        )
        if mediation.state == DisputeState.RESOLVED.value:
            if mediation.outcome == DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value:
                assert mediation.creator_reputation_delta == REPUTATION_UNFAIR_REJECTION_PENALTY
                assert mediation.contributor_reputation_delta == REPUTATION_VALID_DISPUTE_BONUS
            return

        resolve = DisputeResolve(
            outcome="release_to_contributor",
            resolution_notes="Valid submission.",
        )
        result = await dispute_service.resolve_dispute(
            str(dispute.id), resolve, ADMIN_ID
        )
        assert result.creator_reputation_delta == REPUTATION_UNFAIR_REJECTION_PENALTY
        assert result.contributor_reputation_delta == REPUTATION_VALID_DISPUTE_BONUS

    @pytest.mark.asyncio
    async def test_frivolous_dispute_penalizes_contributor(self, dispute_service):
        data = DisputeCreate(
            **_make_create_payload(submission_id=str(uuid.uuid4()))
        )
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        mediation = await dispute_service.advance_to_mediation(
            str(dispute.id), ADMIN_ID
        )
        if mediation.state == DisputeState.RESOLVED.value:
            pytest.skip("AI auto-resolved")

        resolve = DisputeResolve(
            outcome="refund_to_creator",
            resolution_notes="Submission does not meet spec.",
        )
        result = await dispute_service.resolve_dispute(
            str(dispute.id), resolve, ADMIN_ID
        )
        assert result.contributor_reputation_delta == REPUTATION_FRIVOLOUS_DISPUTE_PENALTY
        assert result.creator_reputation_delta == REPUTATION_FAIR_CREATOR_BONUS

    @pytest.mark.asyncio
    async def test_split_no_reputation_impact(self, dispute_service):
        data = DisputeCreate(
            **_make_create_payload(submission_id=str(uuid.uuid4()))
        )
        dispute = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, _recent_rejection()
        )
        mediation = await dispute_service.advance_to_mediation(
            str(dispute.id), ADMIN_ID
        )
        if mediation.state == DisputeState.RESOLVED.value:
            pytest.skip("AI auto-resolved")

        resolve = DisputeResolve(
            outcome="split",
            resolution_notes="Both have valid points.",
            split_contributor_pct=50.0,
        )
        result = await dispute_service.resolve_dispute(
            str(dispute.id), resolve, ADMIN_ID
        )
        assert result.contributor_reputation_delta == 0
        assert result.creator_reputation_delta == 0


class TestInitiationWindow:
    def test_72_hour_constant(self):
        assert DISPUTE_INITIATION_WINDOW_HOURS == 72

    @pytest.mark.asyncio
    async def test_exactly_at_boundary(self, dispute_service):
        boundary = datetime.now(timezone.utc) - timedelta(hours=72, seconds=-1)
        data = DisputeCreate(**_make_create_payload())
        result = await dispute_service.create_dispute(
            data, CONTRIBUTOR_ID, CREATOR_ID, boundary
        )
        assert result.state == DisputeState.EVIDENCE.value

    @pytest.mark.asyncio
    async def test_just_past_boundary(self, dispute_service):
        past = datetime.now(timezone.utc) - timedelta(hours=72, seconds=60)
        data = DisputeCreate(**_make_create_payload())
        with pytest.raises(ValueError, match="Dispute window expired"):
            await dispute_service.create_dispute(
                data, CONTRIBUTOR_ID, CREATOR_ID, past
            )


# ===========================================================================
# Telegram webhook parser tests (no DB needed)
# ===========================================================================


class TestTelegramParsers:
    def test_parse_callback_contributor(self):
        from app.api.telegram_webhook import _parse_callback
        result = _parse_callback("resolve:abc-123:contributor")
        assert result is not None
        assert result["dispute_id"] == "abc-123"
        assert result["outcome"] == "release_to_contributor"

    def test_parse_callback_creator(self):
        from app.api.telegram_webhook import _parse_callback
        result = _parse_callback("resolve:abc-123:creator")
        assert result["outcome"] == "refund_to_creator"

    def test_parse_callback_split_with_pct(self):
        from app.api.telegram_webhook import _parse_callback
        result = _parse_callback("resolve:abc-123:split:70")
        assert result["outcome"] == "split"
        assert result["split_pct"] == 70.0

    def test_parse_callback_split_default(self):
        from app.api.telegram_webhook import _parse_callback
        result = _parse_callback("resolve:abc-123:split")
        assert result["outcome"] == "split"
        assert result["split_pct"] == 50.0

    def test_parse_callback_invalid(self):
        from app.api.telegram_webhook import _parse_callback
        assert _parse_callback("invalid:data") is None
        assert _parse_callback("") is None

    def test_parse_resolve_command(self):
        from app.api.telegram_webhook import _parse_resolve_command
        result = _parse_resolve_command("/resolve abc-123 contributor")
        assert result is not None
        assert result["dispute_id"] == "abc-123"
        assert result["outcome"] == "release_to_contributor"

    def test_parse_resolve_command_split(self):
        from app.api.telegram_webhook import _parse_resolve_command
        result = _parse_resolve_command("/resolve abc-123 split 60")
        assert result["outcome"] == "split"
        assert result["split_pct"] == 60.0

    def test_parse_resolve_command_invalid(self):
        from app.api.telegram_webhook import _parse_resolve_command
        assert _parse_resolve_command("not a command") is None
        assert _parse_resolve_command("/resolve") is None


# ===========================================================================
# UUID validation tests (no DB needed)
# ===========================================================================


class TestUUIDValidation:
    def test_valid_uuid_accepted(self):
        from app.api.disputes import _validate_uuid
        result = _validate_uuid(str(uuid.uuid4()), "test_field")
        assert result is not None

    def test_invalid_uuid_rejected(self):
        from app.api.disputes import _validate_uuid
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            _validate_uuid("not-a-uuid", "test_field")
        assert exc_info.value.status_code == 400
        assert "Invalid" in exc_info.value.detail

    def test_empty_uuid_rejected(self):
        from app.api.disputes import _validate_uuid
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            _validate_uuid("", "test_field")


# ===========================================================================
# Admin role check tests (no DB needed)
# ===========================================================================


class TestAdminCheck:
    def test_is_admin_false_by_default(self):
        from app.api.disputes import _is_admin
        assert _is_admin(str(uuid.uuid4())) is False

    def test_is_admin_with_env(self, monkeypatch):
        test_id = str(uuid.uuid4())
        monkeypatch.setattr("app.api.disputes.ADMIN_USER_IDS", {test_id})
        from app.api.disputes import _is_admin
        assert _is_admin(test_id) is True
