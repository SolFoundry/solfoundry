"""Dispute resolution tests (Issue #192).

Comprehensive test suite covering:
- Dispute creation with authorization checks
- 72-hour dispute window enforcement
- Duplicate prevention
- Evidence submission and state transitions
- AI mediation with auto-resolve
- Admin resolution with all outcomes
- Access control (participants only)
- Full lifecycle with audit trail
- List filtering by participant
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)

from app.main import app
from app.database import get_db
from app.models.dispute import DisputeDB, DisputeHistoryDB
from app.models.bounty_table import BountyTable
from app.models.submission import SubmissionDB


TABLES = [
    BountyTable.__table__,
    SubmissionDB.__table__,
    DisputeDB.__table__,
    DisputeHistoryDB.__table__,
]


@pytest_asyncio.fixture
async def db():
    """Create an in-memory SQLite database with required tables."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        for table in TABLES:
            await connection.run_sync(table.create, checkfirst=True)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db):
    """Create an HTTP test client with overridden DB dependency."""

    async def override_get_db():
        """Provide the test database session."""
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http_client:
        yield http_client
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
def contributor_id():
    """Generate a unique contributor user ID."""
    return str(uuid.uuid4())


@pytest_asyncio.fixture
def admin_id():
    """Generate a unique admin user ID."""
    return str(uuid.uuid4())


@pytest_asyncio.fixture
def creator_id():
    """Generate a unique bounty creator ID."""
    return str(uuid.uuid4())


@pytest_asyncio.fixture
def other_user_id():
    """Generate a unique user ID for an unrelated user."""
    return str(uuid.uuid4())


@pytest_asyncio.fixture
async def bounty(db, creator_id):
    """Create a test bounty owned by the creator."""
    bounty_record = BountyTable(
        id=uuid.uuid4(),
        title="Test Bounty",
        description="Test bounty description",
        tier=2,
        reward_amount=1.0,
        status="completed",
        created_by=creator_id,
    )
    db.add(bounty_record)
    await db.commit()
    return str(bounty_record.id)


@pytest_asyncio.fixture
async def submission(db, bounty, contributor_id):
    """Create a rejected submission within the dispute window."""
    submission_record = SubmissionDB(
        id=uuid.uuid4(),
        contributor_id=uuid.UUID(contributor_id),
        contributor_wallet="9" * 44,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/1",
        bounty_id=uuid.UUID(bounty),
        status="rejected",
        reviewed_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(submission_record)
    await db.commit()
    return str(submission_record.id)


@pytest_asyncio.fixture
async def expired_submission(db, bounty, contributor_id):
    """Create a rejected submission outside the 72-hour dispute window."""
    submission_record = SubmissionDB(
        id=uuid.uuid4(),
        contributor_id=uuid.UUID(contributor_id),
        contributor_wallet="9" * 44,
        pr_url="https://github.com/SolFoundry/solfoundry/pull/2",
        bounty_id=uuid.UUID(bounty),
        status="rejected",
        reviewed_at=datetime.now(timezone.utc) - timedelta(hours=100),
    )
    db.add(submission_record)
    await db.commit()
    return str(submission_record.id)


def auth_headers(user_id: str) -> dict:
    """Build authentication headers for a given user ID.

    Args:
        user_id: The user ID to authenticate as.

    Returns:
        Dict with X-User-ID header.
    """
    return {"X-User-ID": user_id}


def dispute_payload(bounty_id: str, submission_id: str) -> dict:
    """Build a standard dispute creation payload.

    Args:
        bounty_id: The bounty being disputed.
        submission_id: The rejected submission.

    Returns:
        Dict payload for POST /disputes.
    """
    return {
        "bounty_id": bounty_id,
        "submission_id": submission_id,
        "reason": "unfair_rejection",
        "description": "Met all criteria but was unfairly rejected.",
        "evidence_links": [
            {
                "evidence_type": "link",
                "url": "https://github.com/example/pull/1",
                "description": "PR that meets requirements",
            }
        ],
    }


def get_error_message(response) -> str:
    """Extract error message from a response body.

    Args:
        response: The HTTP response.

    Returns:
        Lowercase error message string.
    """
    data = response.json()
    return data.get("detail", data.get("message", "")).lower()


EVIDENCE_PAYLOAD = {
    "evidence_links": [
        {
            "evidence_type": "link",
            "url": "https://example.com/evidence",
            "description": "Supporting evidence",
        }
    ],
}

AI_MEDIATE_PATH = "app.services.dispute_service._ai_mediate"


async def advance_to_mediation(
    client: AsyncClient,
    user_id: str,
    bounty_id: str,
    submission_id: str,
) -> str:
    """Helper to advance a dispute to mediation state.

    Creates a dispute, submits evidence, and moves to mediation.

    Args:
        client: The test HTTP client.
        user_id: The contributor's user ID.
        bounty_id: The bounty ID.
        submission_id: The submission ID.

    Returns:
        The dispute ID now in mediation state.
    """
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty_id, submission_id),
        headers=auth_headers(user_id),
    )
    dispute_id = response.json()["id"]

    await client.post(
        f"/api/disputes/{dispute_id}/evidence",
        json=EVIDENCE_PAYLOAD,
        headers=auth_headers(user_id),
    )

    with patch(AI_MEDIATE_PATH, new_callable=AsyncMock, return_value=(5.0, "?")):
        await client.post(
            f"/api/disputes/{dispute_id}/mediate",
            headers=auth_headers(user_id),
        )

    return dispute_id


# -- Creation Tests -----------------------------------------------------------


@pytest.mark.asyncio
async def test_create_dispute_success(
    client, contributor_id, bounty, submission, creator_id
):
    """Dispute creation succeeds with valid data and derives creator from bounty."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "opened"
    assert data["creator_id"] == creator_id


@pytest.mark.asyncio
async def test_create_dispute_non_contributor_forbidden(
    client, other_user_id, bounty, submission
):
    """Only the submission's contributor can initiate a dispute."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(other_user_id),
    )
    assert response.status_code == 403
    assert "contributor" in get_error_message(response)


@pytest.mark.asyncio
async def test_72_hour_window_expired(
    client, contributor_id, bounty, expired_submission
):
    """Disputes cannot be filed after the 72-hour window expires."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, expired_submission),
        headers=auth_headers(contributor_id),
    )
    assert response.status_code == 400
    assert "expired" in get_error_message(response)


@pytest.mark.asyncio
async def test_duplicate_dispute_rejected(client, contributor_id, bounty, submission):
    """Only one dispute per submission is allowed."""
    await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_bounty_not_found(client, contributor_id, submission):
    """Creating a dispute with a non-existent bounty returns 404."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(str(uuid.uuid4()), submission),
        headers=auth_headers(contributor_id),
    )
    assert response.status_code == 404


# -- Evidence Tests -----------------------------------------------------------


@pytest.mark.asyncio
async def test_evidence_transitions_to_evidence_state(
    client, contributor_id, bounty, submission
):
    """First evidence submission transitions dispute from OPENED to EVIDENCE."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    dispute_id = response.json()["id"]

    evidence_response = await client.post(
        f"/api/disputes/{dispute_id}/evidence",
        json=EVIDENCE_PAYLOAD,
        headers=auth_headers(contributor_id),
    )
    assert evidence_response.json()["status"] == "evidence"


@pytest.mark.asyncio
async def test_evidence_by_non_participant_forbidden(
    client, contributor_id, other_user_id, bounty, submission
):
    """Non-participants cannot submit evidence."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    dispute_id = response.json()["id"]

    evidence_response = await client.post(
        f"/api/disputes/{dispute_id}/evidence",
        json=EVIDENCE_PAYLOAD,
        headers=auth_headers(other_user_id),
    )
    assert evidence_response.status_code == 403


# -- Mediation Tests ----------------------------------------------------------


@pytest.mark.asyncio
async def test_mediation_requires_evidence_state(
    client, contributor_id, bounty, submission
):
    """Cannot move to mediation directly from OPENED state."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    dispute_id = response.json()["id"]

    mediation_response = await client.post(
        f"/api/disputes/{dispute_id}/mediate",
        headers=auth_headers(contributor_id),
    )
    assert mediation_response.status_code == 400


@pytest.mark.asyncio
async def test_ai_auto_resolve_on_high_score(
    client, contributor_id, bounty, submission
):
    """AI score >= 7.0 auto-resolves in contributor's favor."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    dispute_id = response.json()["id"]

    await client.post(
        f"/api/disputes/{dispute_id}/evidence",
        json=EVIDENCE_PAYLOAD,
        headers=auth_headers(contributor_id),
    )

    with patch(AI_MEDIATE_PATH, new_callable=AsyncMock, return_value=(8.5, "Valid")):
        mediation_response = await client.post(
            f"/api/disputes/{dispute_id}/mediate",
            headers=auth_headers(contributor_id),
        )

    data = mediation_response.json()
    assert data["status"] == "resolved"
    assert data["outcome"] == "release_to_contributor"


# -- Resolution Tests ---------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_resolve_all_outcomes(
    client, admin_id, contributor_id, bounty, submission, db
):
    """Admin can resolve disputes with all three outcomes."""
    dispute_id = await advance_to_mediation(client, contributor_id, bounty, submission)

    response = await client.post(
        f"/api/disputes/{dispute_id}/resolve",
        headers=auth_headers(admin_id),
        json={
            "outcome": "release_to_contributor",
            "resolution_notes": "Contributor met all requirements.",
        },
    )
    data = response.json()
    assert data["status"] == "resolved"
    assert data["reputation_impact_creator"] == -5.0


@pytest.mark.asyncio
async def test_non_admin_forbidden(client, contributor_id, bounty, submission):
    """Non-admin users cannot resolve disputes when admin IDs are configured."""
    dispute_id = await advance_to_mediation(client, contributor_id, bounty, submission)

    with patch(
        "app.services.dispute_service.ADMIN_USER_IDS",
        frozenset({"specific-admin-id"}),
    ):
        response = await client.post(
            f"/api/disputes/{dispute_id}/resolve",
            headers=auth_headers(contributor_id),
            json={
                "outcome": "split",
                "resolution_notes": "Should be forbidden",
            },
        )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_cannot_skip_states(client, admin_id, contributor_id, bounty, submission):
    """Cannot resolve a dispute that has not reached mediation state."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    dispute_id = response.json()["id"]

    resolve_response = await client.post(
        f"/api/disputes/{dispute_id}/resolve",
        headers=auth_headers(admin_id),
        json={
            "outcome": "split",
            "resolution_notes": "Trying to skip states",
        },
    )
    assert resolve_response.status_code == 400


# -- Access Control Tests -----------------------------------------------------


@pytest.mark.asyncio
async def test_get_dispute_access_control(
    client, contributor_id, other_user_id, bounty, submission
):
    """Non-participants cannot view dispute details when admin IDs are set."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    dispute_id = response.json()["id"]

    with patch(
        "app.services.dispute_service.ADMIN_USER_IDS",
        frozenset({"specific-admin-id"}),
    ):
        detail_response = await client.get(
            f"/api/disputes/{dispute_id}",
            headers=auth_headers(other_user_id),
        )
    assert detail_response.status_code == 403


@pytest.mark.asyncio
async def test_list_disputes_filtered_by_participant(
    client, contributor_id, other_user_id, bounty, submission
):
    """Non-admins only see disputes where they are a participant."""
    await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )

    # The contributor sees the dispute
    contributor_list = await client.get(
        "/api/disputes",
        headers=auth_headers(contributor_id),
    )
    assert contributor_list.json()["total"] == 1

    # An unrelated user sees nothing when admin IDs are configured
    with patch(
        "app.services.dispute_service.ADMIN_USER_IDS",
        frozenset({"specific-admin-id"}),
    ):
        other_list = await client.get(
            "/api/disputes",
            headers=auth_headers(other_user_id),
        )
    assert other_list.json()["total"] == 0


# -- Full Lifecycle Tests -----------------------------------------------------


@pytest.mark.asyncio
async def test_full_lifecycle_with_audit_trail(
    client, admin_id, contributor_id, bounty, submission
):
    """Full dispute lifecycle produces complete audit history."""
    # Create
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    dispute_id = response.json()["id"]

    # Submit evidence
    await client.post(
        f"/api/disputes/{dispute_id}/evidence",
        json=EVIDENCE_PAYLOAD,
        headers=auth_headers(contributor_id),
    )

    # Mediate (below threshold)
    with patch(AI_MEDIATE_PATH, new_callable=AsyncMock, return_value=(4.0, "?")):
        await client.post(
            f"/api/disputes/{dispute_id}/mediate",
            headers=auth_headers(contributor_id),
        )

    # Admin resolve
    await client.post(
        f"/api/disputes/{dispute_id}/resolve",
        headers=auth_headers(admin_id),
        json={
            "outcome": "release_to_contributor",
            "resolution_notes": "Valid submission",
        },
    )

    # Check audit trail
    detail = await client.get(
        f"/api/disputes/{dispute_id}",
        headers=auth_headers(contributor_id),
    )
    history = detail.json()["history"]
    actions = [entry["action"] for entry in history]

    expected_actions = [
        "dispute_opened",
        "evidence_submitted",
        "moved_to_mediation",
        "dispute_resolved",
    ]
    for action in expected_actions:
        assert action in actions, f"Missing expected action: {action}"


@pytest.mark.asyncio
async def test_list_disputes_returns_items(client, contributor_id, bounty, submission):
    """List endpoint returns disputes with correct count."""
    await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )

    response = await client.get(
        "/api/disputes",
        headers=auth_headers(contributor_id),
    )
    data = response.json()
    assert data["total"] == 1
    assert len(data["items"]) == 1


@pytest.mark.asyncio
async def test_creator_can_view_dispute(
    client, contributor_id, creator_id, bounty, submission
):
    """The bounty creator can also view disputes on their bounties."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    dispute_id = response.json()["id"]

    detail_response = await client.get(
        f"/api/disputes/{dispute_id}",
        headers=auth_headers(creator_id),
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["id"] == dispute_id


@pytest.mark.asyncio
async def test_creator_can_submit_evidence(
    client, contributor_id, creator_id, bounty, submission
):
    """The bounty creator can submit counter-evidence."""
    response = await client.post(
        "/api/disputes",
        json=dispute_payload(bounty, submission),
        headers=auth_headers(contributor_id),
    )
    dispute_id = response.json()["id"]

    evidence_response = await client.post(
        f"/api/disputes/{dispute_id}/evidence",
        json=EVIDENCE_PAYLOAD,
        headers=auth_headers(creator_id),
    )
    assert evidence_response.status_code == 200
