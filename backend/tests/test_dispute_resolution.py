"""Tests for the Dispute Resolution System."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.disputes import router as disputes_router
from app.api.auth import get_current_user_id, get_admin_user_id
from app.models.dispute import DisputeStatus, DisputeOutcome

_test_app = FastAPI()
_test_app.include_router(disputes_router)

def override_get_current_user_id():
    return "user-test-uuid"

def override_get_admin_user_id():
    return "admin-test-uuid"

_test_app.dependency_overrides[get_current_user_id] = override_get_current_user_id
_test_app.dependency_overrides[get_admin_user_id] = override_get_admin_user_id

client = TestClient(_test_app)

def test_create_dispute():
    # Setup step to mock a bounty and rejected submission.
    # Because we're using a mock in memory store, let's just trigger the create endpoint directly.
    # We will need to inject the mock bounty and submission directly to _bounty_store.
    from app.services.bounty_service import _bounty_store
    from app.models.bounty import BountyDB, BountyTier, BountyStatus, SubmissionRecord
    
    b_id = "test-bounty-for-dispute"
    bounty = BountyDB(
        id=b_id,
        title="Test Bounty",
        description="Testing disputes",
        tier=BountyTier.T2,
        reward_amount=100.0,
        status=BountyStatus.COMPLETED
    )
    # The default mock user ID from get_current_user_id in test auth might be "test-user-id"
    # We add a submission for it
    sub = SubmissionRecord(bounty_id=b_id, pr_url="http://github.com", submitted_by="user-test-uuid")
    bounty.submissions.append(sub)
    _bounty_store[b_id] = bounty
    
    payload = {
        "reason": "incorrect_review",
        "description": "I believe this rejection is completely unfair.",
        "evidence_links": [{"type": "screenshot", "description": "look", "url": "http://image.com"}],
        "bounty_id": b_id
    }
    
    response = client.post("/api/disputes", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == DisputeStatus.MEDIATION.value
    # Or MEDIATION since AI mediation is triggered immediately
    assert "id" in data
    
    dispute_id = data["id"]
    
    # Add Evidence
    evidence_payload = [
        {"type": "link", "description": "another link", "url": "http://google.com"}
    ]
    response = client.post(f"/api/disputes/{dispute_id}/evidence", json=evidence_payload)
    assert response.status_code == 200
    
    # Get Dispute Check Details
    response = client.get(f"/api/disputes/{dispute_id}")
    assert response.status_code == 200
    assert len(response.json()["history"]) >= 2
    
    # Admin resolving dispute
    resolve_payload = {
        "outcome": DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value,
        "review_notes": "We are releasing funds because the evidence is solid.",
        "resolution_action": "Funds successfully sent."
    }
    response = client.post(f"/api/disputes/{dispute_id}/resolve", json=resolve_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == DisputeStatus.RESOLVED.value
    assert data["outcome"] == DisputeOutcome.RELEASE_TO_CONTRIBUTOR.value
