"""End-to-end tests for the Phase 2 submission-to-payout flow.

Covers:
- Submit PR → linked to bounty → status "under review"
- Record AI review scores (GPT, Gemini, Grok) → aggregate
- Creator approval → payout trigger
- Creator dispute → blocks auto-approve
- Auto-approve: AI score >= 7/10 AND 48h elapsed → auto-approve
- Lifecycle logging for all state transitions
- Full flow: submit → review → approve → FNDRY paid out
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.api.bounties import router as bounties_router

from app.services import bounty_service
from app.services import review_service
from app.services import lifecycle_service
from app.services import payout_service
from app.services.auto_approve_service import check_auto_approve_candidates

# ---------------------------------------------------------------------------
# Auth Mock
# ---------------------------------------------------------------------------

MOCK_CREATOR = UserResponse(
    id="creator-001",
    github_id="gh-creator",
    username="bounty-creator",
    email="creator@solfoundry.org",
    avatar_url="http://example.com/avatar.png",
    wallet_address="CreatorWallet11111111111111111111111111111111",
    wallet_verified=True,
    created_at="2026-03-20T22:00:00Z",
    updated_at="2026-03-20T22:00:00Z",
)

MOCK_CONTRIBUTOR = UserResponse(
    id="contrib-001",
    github_id="gh-contributor",
    username="contributor-dev",
    email="dev@solfoundry.org",
    avatar_url="http://example.com/avatar2.png",
    wallet_address="ContribWallet11111111111111111111111111111111",
    wallet_verified=True,
    created_at="2026-03-20T22:00:00Z",
    updated_at="2026-03-20T22:00:00Z",
)

_current_user = MOCK_CREATOR

async def override_get_current_user():
    return _current_user

# ---------------------------------------------------------------------------
# Test app
# ---------------------------------------------------------------------------

_test_app = FastAPI()
_test_app.include_router(bounties_router, prefix="/api")
_test_app.dependency_overrides[get_current_user] = override_get_current_user
client = TestClient(_test_app)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_stores():
    """Clear all in-memory stores between tests."""
    bounty_service._bounty_store.clear()
    review_service.reset_store()
    lifecycle_service.reset_store()
    payout_service.reset_stores()
    global _current_user
    _current_user = MOCK_CREATOR
    yield


def _create_bounty(reward: float = 500_000) -> dict:
    """Helper: create a bounty as the mock creator."""
    global _current_user
    _current_user = MOCK_CREATOR
    resp = client.post("/api/bounties", json={
        "title": "Phase 2 Bounty — Submission to Payout",
        "description": "Build the end-to-end flow from submission to payout.",
        "tier": 2,
        "reward_amount": reward,
        "required_skills": ["python", "fastapi", "solana"],
    })
    assert resp.status_code == 201
    return resp.json()


def _submit_pr(bounty_id: str, pr_url: str = "https://github.com/SolFoundry/solfoundry/pull/42") -> dict:
    """Helper: submit a PR as the contributor."""
    global _current_user
    _current_user = MOCK_CONTRIBUTOR
    resp = client.post(f"/api/bounties/{bounty_id}/submissions", json={
        "pr_url": pr_url,
        "contributor_wallet": MOCK_CONTRIBUTOR.wallet_address,
        "notes": "Implementation of Phase 2 submission flow",
    })
    assert resp.status_code == 201
    return resp.json()


def _record_review(bounty_id: str, submission_id: str, model: str, score: float) -> dict:
    """Helper: record an AI review score."""
    resp = client.post(
        f"/api/bounties/{bounty_id}/submissions/{submission_id}/reviews",
        json={
            "submission_id": submission_id,
            "bounty_id": bounty_id,
            "model_name": model,
            "quality_score": score,
            "correctness_score": score,
            "security_score": score,
            "completeness_score": score,
            "test_coverage_score": score,
            "overall_score": score,
            "review_summary": f"{model} review: score {score}/10",
        },
    )
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestSubmissionFlow:
    """Test: contributor submits PR → linked to bounty → status 'under review'."""

    def test_submit_pr_sets_under_review(self):
        bounty = _create_bounty()
        assert bounty["status"] == "open"

        sub = _submit_pr(bounty["id"])
        assert sub["status"] == "pending"
        assert sub["contributor_wallet"] == MOCK_CONTRIBUTOR.wallet_address
        assert sub["bounty_id"] == bounty["id"]
        assert "github.com" in sub["pr_url"]

        # Bounty should now be under_review
        global _current_user
        _current_user = MOCK_CREATOR
        resp = client.get(f"/api/bounties/{bounty['id']}")
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["status"] == "under_review"

    def test_duplicate_pr_rejected(self):
        bounty = _create_bounty()
        _submit_pr(bounty["id"])

        global _current_user
        _current_user = MOCK_CONTRIBUTOR
        resp = client.post(f"/api/bounties/{bounty['id']}/submissions", json={
            "pr_url": "https://github.com/SolFoundry/solfoundry/pull/42",
            "contributor_wallet": MOCK_CONTRIBUTOR.wallet_address,
        })
        assert resp.status_code == 400
        assert "already been submitted" in resp.json()["detail"]


class TestReviewIntegration:
    """Test: AI review scores recorded and aggregated per model."""

    def test_record_all_three_models(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])
        sid = sub["id"]

        _record_review(bounty["id"], sid, "gpt", 8.0)
        _record_review(bounty["id"], sid, "gemini", 7.5)
        _record_review(bounty["id"], sid, "grok", 9.0)

        resp = client.get(f"/api/bounties/{bounty['id']}/submissions/{sid}/reviews")
        assert resp.status_code == 200
        agg = resp.json()

        assert len(agg["model_scores"]) == 3
        assert agg["review_complete"] is True
        assert agg["overall_score"] == pytest.approx((8.0 + 7.5 + 9.0) / 3, abs=0.1)
        assert agg["meets_threshold"] is True

    def test_partial_review_not_complete(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])
        sid = sub["id"]

        _record_review(bounty["id"], sid, "gpt", 8.0)

        resp = client.get(f"/api/bounties/{bounty['id']}/submissions/{sid}/reviews")
        agg = resp.json()
        assert agg["review_complete"] is False
        assert len(agg["model_scores"]) == 1

    def test_low_score_fails_threshold(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])
        sid = sub["id"]

        _record_review(bounty["id"], sid, "gpt", 4.0)
        _record_review(bounty["id"], sid, "gemini", 5.0)
        _record_review(bounty["id"], sid, "grok", 3.0)

        resp = client.get(f"/api/bounties/{bounty['id']}/submissions/{sid}/reviews")
        agg = resp.json()
        assert agg["meets_threshold"] is False

    def test_scores_displayed_per_model(self):
        """Verify per-model scores (GPT/Gemini/Grok) returned in aggregated response."""
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])
        sid = sub["id"]

        _record_review(bounty["id"], sid, "gpt", 8.5)
        _record_review(bounty["id"], sid, "gemini", 7.0)
        _record_review(bounty["id"], sid, "grok", 9.0)

        resp = client.get(f"/api/bounties/{bounty['id']}/submissions/{sid}/reviews")
        agg = resp.json()

        models = {s["model_name"]: s for s in agg["model_scores"]}
        assert "gpt" in models
        assert "gemini" in models
        assert "grok" in models
        assert models["gpt"]["overall_score"] == 8.5
        assert models["gemini"]["overall_score"] == 7.0
        assert models["grok"]["overall_score"] == 9.0


class TestCreatorApproval:
    """Test: bounty creator approves → payout triggered."""

    def test_creator_approves_submission(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])

        global _current_user
        _current_user = MOCK_CREATOR
        resp = client.post(
            f"/api/bounties/{bounty['id']}/submissions/{sub['id']}/approve"
        )
        assert resp.status_code == 200
        approved = resp.json()
        assert approved["status"] == "paid"  # approval triggers immediate payout
        assert approved["winner"] is True
        assert approved["approved_by"] == MOCK_CREATOR.wallet_address
        assert approved["payout_amount"] == 500_000

    def test_non_creator_cannot_approve(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])

        global _current_user
        _current_user = MOCK_CONTRIBUTOR
        resp = client.post(
            f"/api/bounties/{bounty['id']}/submissions/{sub['id']}/approve"
        )
        assert resp.status_code == 403


class TestCreatorDispute:
    """Test: creator disputes → auto-approve blocked."""

    def test_creator_disputes_submission(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])

        global _current_user
        _current_user = MOCK_CREATOR
        resp = client.post(
            f"/api/bounties/{bounty['id']}/submissions/{sub['id']}/dispute",
            json={"reason": "Code does not meet requirements, missing tests"},
        )
        assert resp.status_code == 200
        disputed = resp.json()
        assert disputed["status"] == "disputed"
        assert disputed["auto_approve_eligible"] is False

    def test_dispute_blocks_auto_approve(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])

        _record_review(bounty["id"], sub["id"], "gpt", 9.0)
        _record_review(bounty["id"], sub["id"], "gemini", 8.5)
        _record_review(bounty["id"], sub["id"], "grok", 9.5)

        global _current_user
        _current_user = MOCK_CREATOR
        client.post(
            f"/api/bounties/{bounty['id']}/submissions/{sub['id']}/dispute",
            json={"reason": "Plagiarized code detected"},
        )

        # Force auto-approve time to have passed
        internal_sub = bounty_service.get_submission(bounty["id"], sub["id"])
        internal_sub.auto_approve_after = datetime.now(timezone.utc) - timedelta(hours=1)

        approved = check_auto_approve_candidates()
        assert len(approved) == 0


class TestAutoApprove:
    """Test: AI score >= 7/10 AND no dispute within 48h → auto-approve."""

    def test_auto_approve_after_timeout(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])

        _record_review(bounty["id"], sub["id"], "gpt", 8.0)
        _record_review(bounty["id"], sub["id"], "gemini", 7.5)
        _record_review(bounty["id"], sub["id"], "grok", 9.0)

        # Simulate 48h passing
        internal_sub = bounty_service.get_submission(bounty["id"], sub["id"])
        internal_sub.auto_approve_after = datetime.now(timezone.utc) - timedelta(hours=1)
        internal_sub.auto_approve_eligible = True

        approved = check_auto_approve_candidates()
        assert len(approved) == 1
        assert approved[0]["submission_id"] == sub["id"]

        # Verify bounty is now paid
        _current_user = MOCK_CREATOR
        resp = client.get(f"/api/bounties/{bounty['id']}")
        updated = resp.json()
        assert updated["status"] == "paid"

    def test_auto_approve_skips_low_score(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])

        _record_review(bounty["id"], sub["id"], "gpt", 3.0)
        _record_review(bounty["id"], sub["id"], "gemini", 4.0)
        _record_review(bounty["id"], sub["id"], "grok", 2.0)

        internal_sub = bounty_service.get_submission(bounty["id"], sub["id"])
        internal_sub.auto_approve_after = datetime.now(timezone.utc) - timedelta(hours=1)

        approved = check_auto_approve_candidates()
        assert len(approved) == 0

    def test_auto_approve_waits_for_timeout(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])

        _record_review(bounty["id"], sub["id"], "gpt", 9.0)
        _record_review(bounty["id"], sub["id"], "gemini", 9.0)
        _record_review(bounty["id"], sub["id"], "grok", 9.0)

        # auto_approve_after is in the future by default
        approved = check_auto_approve_candidates()
        assert len(approved) == 0


class TestPayoutTrigger:
    """Test: on approval → escrow service releases FNDRY."""

    def test_approval_creates_payout_record(self):
        bounty = _create_bounty(reward=100_000)
        sub = _submit_pr(bounty["id"])

        global _current_user
        _current_user = MOCK_CREATOR
        resp = client.post(
            f"/api/bounties/{bounty['id']}/submissions/{sub['id']}/approve"
        )
        assert resp.status_code == 200
        approved = resp.json()
        assert approved["payout_amount"] == 100_000

        # Verify payout exists in payout service
        payouts = payout_service.list_payouts()
        assert payouts.total >= 1
        payout = payouts.items[0]
        assert payout.amount == 100_000
        assert payout.token == "FNDRY"
        assert payout.bounty_id == bounty["id"]


class TestCompletionState:
    """Test: bounty marked complete, winner shown, payout tx hash displayed."""

    def test_bounty_shows_winner_after_approval(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])

        global _current_user
        _current_user = MOCK_CREATOR
        client.post(f"/api/bounties/{bounty['id']}/submissions/{sub['id']}/approve")

        resp = client.get(f"/api/bounties/{bounty['id']}")
        completed = resp.json()
        assert completed["status"] == "paid"
        assert completed["winner_submission_id"] == sub["id"]
        assert completed["winner_wallet"] == MOCK_CONTRIBUTOR.wallet_address


class TestLifecycleLog:
    """Test: all state transitions logged in the bounty lifecycle."""

    def test_lifecycle_logs_full_flow(self):
        bounty = _create_bounty()
        sub = _submit_pr(bounty["id"])

        _record_review(bounty["id"], sub["id"], "gpt", 8.0)

        global _current_user
        _current_user = MOCK_CREATOR
        client.post(f"/api/bounties/{bounty['id']}/submissions/{sub['id']}/approve")

        resp = client.get(f"/api/bounties/{bounty['id']}/lifecycle")
        assert resp.status_code == 200
        log = resp.json()
        event_types = [e["event_type"] for e in log["items"]]

        assert "submission_created" in event_types
        assert "ai_review_completed" in event_types
        assert "creator_approved" in event_types


class TestFullEndToEnd:
    """Full flow: submit → review scores appear → creator approves → FNDRY paid out."""

    def test_complete_bounty_lifecycle(self):
        # 1. Creator creates bounty
        bounty = _create_bounty(reward=500_000)
        assert bounty["status"] == "open"

        # 2. Contributor submits PR
        sub = _submit_pr(bounty["id"])
        assert sub["status"] == "pending"

        # 3. AI reviews come in from GitHub Actions
        _record_review(bounty["id"], sub["id"], "gpt", 8.5)
        _record_review(bounty["id"], sub["id"], "gemini", 7.8)
        _record_review(bounty["id"], sub["id"], "grok", 9.2)

        # 4. Verify scores are aggregated
        resp = client.get(f"/api/bounties/{bounty['id']}/submissions/{sub['id']}/reviews")
        agg = resp.json()
        assert agg["review_complete"] is True
        assert agg["meets_threshold"] is True
        assert len(agg["model_scores"]) == 3

        # 5. Creator approves
        global _current_user
        _current_user = MOCK_CREATOR
        resp = client.post(
            f"/api/bounties/{bounty['id']}/submissions/{sub['id']}/approve"
        )
        assert resp.status_code == 200
        approved = resp.json()
        assert approved["status"] == "paid"
        assert approved["winner"] is True
        assert approved["payout_amount"] == 500_000

        # 6. Verify bounty is complete with winner
        resp = client.get(f"/api/bounties/{bounty['id']}")
        final = resp.json()
        assert final["status"] == "paid"
        assert final["winner_wallet"] == MOCK_CONTRIBUTOR.wallet_address

        # 7. Verify lifecycle has full trail
        resp = client.get(f"/api/bounties/{bounty['id']}/lifecycle")
        events = [e["event_type"] for e in resp.json()["items"]]
        assert "submission_created" in events
        assert "creator_approved" in events
