"""Factory functions for reproducible test data generation.

Provides deterministic builders for every domain entity used by the
end-to-end test suite.  Each factory returns a plain ``dict`` ready to
send as JSON to the API, or a Pydantic model instance when interacting
with services directly.

Design decisions:
- Counters ensure uniqueness without randomness (deterministic).
- Helper ``reset_counters()`` is called in ``conftest.py`` between tests.
- Wallet addresses use valid Solana base-58 format for model validation.
"""

import itertools
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Deterministic counters — reset between tests for reproducibility
# ---------------------------------------------------------------------------

_bounty_counter = itertools.count(1)
_contributor_counter = itertools.count(1)
_submission_counter = itertools.count(1)
_payout_counter = itertools.count(1)
_user_counter = itertools.count(1)

# A valid Solana base-58 address used as default wallet in tests.
DEFAULT_WALLET = "97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF"
# A second valid wallet for multi-contributor scenarios.
SECONDARY_WALLET = "57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp"
# Valid Solana tx signature (64-88 base-58 chars) for payout tests.
VALID_TX_HASH = "5VERnGcJb7fDAj37gQaToQaC8qK9P1DdVJX7wE4ZmBYuFRJdBzjS8x1v3oeRYLN8NhRLBmhqTvK4D3gXAqD1PLW"


def reset_counters() -> None:
    """Reset all factory counters to ensure test isolation.

    Called automatically by the ``clear_stores`` fixture in ``conftest.py``
    so every test begins with a clean sequence.
    """
    global _bounty_counter, _contributor_counter, _submission_counter
    global _payout_counter, _user_counter
    _bounty_counter = itertools.count(1)
    _contributor_counter = itertools.count(1)
    _submission_counter = itertools.count(1)
    _payout_counter = itertools.count(1)
    _user_counter = itertools.count(1)


# ---------------------------------------------------------------------------
# Bounty factories
# ---------------------------------------------------------------------------


def build_bounty_create_payload(
    *,
    title: Optional[str] = None,
    description: Optional[str] = None,
    tier: int = 2,
    reward_amount: float = 500.0,
    required_skills: Optional[List[str]] = None,
    deadline: Optional[str] = None,
    created_by: str = "system",
    github_issue_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a JSON-serializable payload for ``POST /api/bounties``.

    Args:
        title: Bounty title; auto-generated if omitted.
        description: Bounty description; auto-generated if omitted.
        tier: Bounty tier (1, 2, or 3).
        reward_amount: Reward in $FNDRY.
        required_skills: Skill tags; defaults to ``["python", "fastapi"]``.
        deadline: ISO-8601 deadline; omitted by default.
        created_by: Creator identifier.
        github_issue_url: Optional GitHub issue link.

    Returns:
        Dictionary suitable for ``json=`` in httpx/TestClient requests.
    """
    sequence_number = next(_bounty_counter)
    return {
        "title": title or f"E2E Test Bounty #{sequence_number}",
        "description": description or (
            f"End-to-end test bounty number {sequence_number} for validating "
            "the full marketplace lifecycle."
        ),
        "tier": tier,
        "reward_amount": reward_amount,
        "required_skills": required_skills or ["python", "fastapi"],
        "deadline": deadline,
        "created_by": created_by,
        "github_issue_url": github_issue_url,
    }


def build_bounty_update_payload(
    *,
    title: Optional[str] = None,
    description: Optional[str] = None,
    status: Optional[str] = None,
    reward_amount: Optional[float] = None,
) -> Dict[str, Any]:
    """Build a partial-update payload for ``PATCH /api/bounties/{id}``.

    Args:
        title: New title, if updating.
        description: New description, if updating.
        status: New status string (e.g. ``"in_progress"``).
        reward_amount: New reward amount, if updating.

    Returns:
        Dictionary with only the fields that should be changed.
    """
    payload: Dict[str, Any] = {}
    if title is not None:
        payload["title"] = title
    if description is not None:
        payload["description"] = description
    if status is not None:
        payload["status"] = status
    if reward_amount is not None:
        payload["reward_amount"] = reward_amount
    return payload


# ---------------------------------------------------------------------------
# Submission factories
# ---------------------------------------------------------------------------


def build_submission_payload(
    *,
    pr_url: Optional[str] = None,
    submitted_by: Optional[str] = None,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a payload for ``POST /api/bounties/{id}/submit``.

    Args:
        pr_url: GitHub PR URL; auto-generated if omitted.
        submitted_by: Contributor username; auto-generated if omitted.
        notes: Optional submission notes.

    Returns:
        Dictionary for the submission endpoint.
    """
    sequence_number = next(_submission_counter)
    return {
        "pr_url": pr_url or f"https://github.com/SolFoundry/solfoundry/pull/{sequence_number}",
        "submitted_by": submitted_by or f"contributor-{sequence_number}",
        "notes": notes or f"E2E submission #{sequence_number}",
    }


# ---------------------------------------------------------------------------
# Contributor factories
# ---------------------------------------------------------------------------


def build_contributor_create_payload(
    *,
    username: Optional[str] = None,
    display_name: Optional[str] = None,
    skills: Optional[List[str]] = None,
    email: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a payload for ``POST /api/contributors``.

    Args:
        username: Unique username; auto-generated if omitted.
        display_name: Display name; auto-generated if omitted.
        skills: Skill list; defaults to ``["python"]``.
        email: Contact email.

    Returns:
        Dictionary for the contributor creation endpoint.
    """
    sequence_number = next(_contributor_counter)
    return {
        "username": username or f"e2e-contributor-{sequence_number}",
        "display_name": display_name or f"E2E Contributor {sequence_number}",
        "skills": skills or ["python"],
        "email": email or f"e2e-{sequence_number}@test.solfoundry.org",
    }


# ---------------------------------------------------------------------------
# Payout factories
# ---------------------------------------------------------------------------


def build_payout_create_payload(
    *,
    recipient: Optional[str] = None,
    recipient_wallet: Optional[str] = None,
    amount: float = 100.0,
    token: str = "FNDRY",
    bounty_id: Optional[str] = None,
    bounty_title: Optional[str] = None,
    tx_hash: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a payload for ``POST /api/payouts``.

    Args:
        recipient: Recipient username.
        recipient_wallet: Solana wallet address.
        amount: Payout amount (must be > 0).
        token: Token type (``"FNDRY"`` or ``"SOL"``).
        bounty_id: Associated bounty ID.
        bounty_title: Associated bounty title.
        tx_hash: On-chain transaction hash.

    Returns:
        Dictionary for the payout endpoint.
    """
    sequence_number = next(_payout_counter)
    return {
        "recipient": recipient or f"contributor-{sequence_number}",
        "recipient_wallet": recipient_wallet or DEFAULT_WALLET,
        "amount": amount,
        "token": token,
        "bounty_id": bounty_id,
        "bounty_title": bounty_title,
        "tx_hash": tx_hash,
    }


# ---------------------------------------------------------------------------
# User / auth factories
# ---------------------------------------------------------------------------


def build_user_id() -> str:
    """Generate a deterministic UUID for a test user.

    Returns:
        A UUID string usable as a user ID in auth headers.
    """
    return str(uuid.uuid4())


def build_github_user_data(
    *,
    github_id: Optional[str] = None,
    username: Optional[str] = None,
    email: Optional[str] = None,
) -> Dict[str, Any]:
    """Build mock GitHub user data as returned by the GitHub API.

    Args:
        github_id: GitHub numeric ID string.
        username: GitHub username (login).
        email: Email address.

    Returns:
        Dictionary mimicking the GitHub ``/user`` API response shape.
    """
    sequence_number = next(_user_counter)
    return {
        "id": github_id or str(100000 + sequence_number),
        "login": username or f"ghuser-{sequence_number}",
        "email": email or f"ghuser-{sequence_number}@github.com",
        "avatar_url": f"https://avatars.githubusercontent.com/u/{100000 + sequence_number}",
    }


# ---------------------------------------------------------------------------
# Dispute factories
# ---------------------------------------------------------------------------


def build_dispute_create_payload(
    *,
    bounty_id: str,
    reason: str = "incorrect_review",
    description: Optional[str] = None,
    evidence_links: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Build a payload for creating a dispute.

    Args:
        bounty_id: ID of the bounty being disputed.
        reason: Dispute reason from ``DisputeReason`` enum.
        description: Detailed dispute description.
        evidence_links: List of evidence items.

    Returns:
        Dictionary for the dispute creation endpoint.
    """
    return {
        "bounty_id": bounty_id,
        "reason": reason,
        "description": description or (
            "The AI review incorrectly scored this submission. "
            "The solution fully addresses the issue requirements."
        ),
        "evidence_links": evidence_links or [
            {"type": "screenshot", "description": "Test output showing all tests pass"},
        ],
    }


def build_dispute_resolve_payload(
    *,
    outcome: str = "approved",
    review_notes: str = "Dispute upheld after manual review.",
    resolution_action: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a payload for resolving a dispute.

    Args:
        outcome: Resolution outcome (``"approved"``, ``"rejected"``, ``"cancelled"``).
        review_notes: Reviewer's notes explaining the decision.
        resolution_action: Follow-up action to take.

    Returns:
        Dictionary for the dispute resolution endpoint.
    """
    return {
        "outcome": outcome,
        "review_notes": review_notes,
        "resolution_action": resolution_action or "Re-score submission and proceed to payout.",
    }


# ---------------------------------------------------------------------------
# Escrow factories
# ---------------------------------------------------------------------------


def build_escrow_fund_payload(
    *,
    bounty_id: str,
    amount: float = 500.0,
    funder_wallet: str = DEFAULT_WALLET,
) -> Dict[str, Any]:
    """Build a payload for funding a bounty escrow.

    Args:
        bounty_id: ID of the bounty to fund.
        amount: Amount to escrow.
        funder_wallet: Wallet address funding the escrow.

    Returns:
        Dictionary for the escrow funding endpoint.
    """
    return {
        "bounty_id": bounty_id,
        "amount": amount,
        "funder_wallet": funder_wallet,
    }


# ---------------------------------------------------------------------------
# Timestamp helpers
# ---------------------------------------------------------------------------


def future_deadline(*, hours: int = 24) -> str:
    """Return an ISO-8601 timestamp ``hours`` in the future.

    Args:
        hours: Number of hours from now.

    Returns:
        ISO-8601 formatted UTC timestamp string.
    """
    return (datetime.now(timezone.utc) + timedelta(hours=hours)).isoformat()


def past_deadline(*, hours: int = 24) -> str:
    """Return an ISO-8601 timestamp ``hours`` in the past.

    Args:
        hours: Number of hours ago.

    Returns:
        ISO-8601 formatted UTC timestamp string.
    """
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
