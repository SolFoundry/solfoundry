import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.api.bounties import router as bounties_router
from app.models.bounty import (
    BountyCreate,
    BountyStatus,
    BountyUpdate,
)
from app.services import bounty_service

# ---------------------------------------------------------------------------
# Auth Mock
# ---------------------------------------------------------------------------

ALICE = UserResponse(
    id="alice-id",
    github_id="alice-github",
    username="alice",
    wallet_address="alice-wallet",
    wallet_verified=True,
    created_at="2026-03-20T22:00:00Z",
    updated_at="2026-03-20T22:00:00Z",
)

BOB = UserResponse(
    id="bob-id",
    github_id="bob-github",
    username="bob",
    wallet_address="bob-wallet",
    wallet_verified=True,
    created_at="2026-03-20T22:00:00Z",
    updated_at="2026-03-20T22:00:00Z",
)

current_mock_user = ALICE

async def override_get_current_user():
    return current_mock_user

_test_app = FastAPI()
_test_app.include_router(bounties_router)
_test_app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(_test_app)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clear_store():
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestBountyDashboard:
    def test_creator_stats(self):
        # Create bounties with various statuses for Alice
        # OPEN (staked)
        bounty_service.create_bounty(BountyCreate(title="Bounty 1", reward_amount=100.0, created_by="alice-wallet"))
        # PAID (paid)
        b2 = bounty_service.create_bounty(BountyCreate(title="Bounty 2", reward_amount=200.0, created_by="alice-wallet"))
        bounty_service.update_bounty(b2.id, BountyUpdate(status=BountyStatus.IN_PROGRESS))
        bounty_service.update_bounty(b2.id, BountyUpdate(status=BountyStatus.COMPLETED))
        bounty_service.update_bounty(b2.id, BountyUpdate(status=BountyStatus.PAID))
        # CANCELLED (refunded)
        b3 = bounty_service.create_bounty(BountyCreate(title="Bounty 3", reward_amount=300.0, created_by="alice-wallet"))
        bounty_service.update_bounty(b3.id, BountyUpdate(status=BountyStatus.CANCELLED))
        
        # Another bounty for Bob (should not be included)
        bounty_service.create_bounty(BountyCreate(title="Bob B1", reward_amount=500.0, created_by="bob-wallet"))

        resp = client.get("/api/bounties/creator/alice-wallet/stats")
        assert resp.status_code == 200
        stats = resp.json()
        assert stats["staked"] == 100.0
        assert stats["paid"] == 200.0
        assert stats["refunded"] == 300.0

    def test_ownership_validation(self):
        global current_mock_user
        # Alice creates a bounty
        current_mock_user = ALICE
        resp = client.post("/api/bounties", json={"title": "Alice Bounty", "reward_amount": 100.0})
        bid = resp.json()["id"]

        # Bob tries to update it -> 403
        current_mock_user = BOB
        resp = client.patch(f"/api/bounties/{bid}", json={"title": "Hacked"})
        assert resp.status_code == 403
        assert "Not authorized" in resp.json()["detail"]

        # Bob tries to delete it -> 403
        resp = client.delete(f"/api/bounties/{bid}")
        assert resp.status_code == 403

        # Bob tries to cancel it -> 403
        resp = client.post(f"/api/bounties/{bid}/cancel")
        assert resp.status_code == 403

        # Alice can update it
        current_mock_user = ALICE
        resp = client.patch(f"/api/bounties/{bid}", json={"title": "Updated by Alice"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated by Alice"

    def test_submission_flow_and_transitions(self):
        global current_mock_user
        # Alice creates a bounty
        current_mock_user = ALICE
        resp = client.post("/api/bounties", json={"title": "Bounty", "reward_amount": 100.0})
        bid = resp.json()["id"]

        # Bob submits a solution
        current_mock_user = BOB
        resp = client.post(f"/api/bounties/{bid}/submit", json={"pr_url": "https://github.com/org/repo/pull/1"})
        assert resp.status_code == 201
        sid = resp.json()["id"]
        assert resp.json()["status"] == "pending"

        # Bob tries to approve his own submission -> 403 (because Alice owns the bounty)
        resp = client.patch(f"/api/bounties/{bid}/submissions/{sid}", json={"status": "approved"})
        assert resp.status_code == 403

        # Alice approves it
        current_mock_user = ALICE
        resp = client.patch(f"/api/bounties/{bid}/submissions/{sid}", json={"status": "approved"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

        # Invalid transition: approved -> pending
        resp = client.patch(f"/api/bounties/{bid}/submissions/{sid}", json={"status": "pending"})
        assert resp.status_code == 400
        assert "Invalid status transition" in resp.json()["detail"]

        # Valid transition: approved -> paid
        resp = client.patch(f"/api/bounties/{bid}/submissions/{sid}", json={"status": "paid"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "paid"

    def test_deterministic_ai_score(self):
        global current_mock_user
        current_mock_user = ALICE
        resp = client.post("/api/bounties", json={"title": "Bounty for Score", "reward_amount": 10.0})
        bid = resp.json()["id"]
        
        current_mock_user = BOB
        url = "https://github.com/org/repo/pull/123"
        resp1 = client.post(f"/api/bounties/{bid}/submit", json={"pr_url": url})
        assert resp1.status_code == 201
        score1 = resp1.json()["ai_score"]
        
        # Another submission with same URL (on different bounty to avoid duplicate check)
        current_mock_user = ALICE
        resp2 = client.post("/api/bounties", json={"title": "Bounty 2 for Score", "reward_amount": 10.0})
        bid2 = resp2.json()["id"]
        
        current_mock_user = BOB
        resp3 = client.post(f"/api/bounties/{bid2}/submit", json={"pr_url": url})
        assert resp3.status_code == 201
        score2 = resp3.json()["ai_score"]
        
        assert score1 == score2
        assert 0 <= score1 <= 100
