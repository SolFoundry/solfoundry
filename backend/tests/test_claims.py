"""Tests for bounty claiming & assignment system (Issue #16)."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.bounties import router as bounties_router
from app.api.claims import router as claims_router
from app.services import bounty_service
from app.services import claim_service

_test_app = FastAPI()
_test_app.include_router(bounties_router)
_test_app.include_router(claims_router)
client = TestClient(_test_app)

VALID_BOUNTY = {
    "title": "Fix smart contract bug",
    "description": "Critical bug in token transfer logic.",
    "tier": 2,
    "reward_amount": 500.0,
    "required_skills": ["solidity", "rust"],
}


@pytest.fixture(autouse=True)
def clear_stores():
    bounty_service._bounty_store.clear()
    claim_service._claim_store.clear()
    yield
    bounty_service._bounty_store.clear()
    claim_service._claim_store.clear()


def _create_bounty() -> dict:
    resp = client.post("/api/bounties", json=VALID_BOUNTY)
    assert resp.status_code == 201
    return resp.json()


class TestClaimBounty:
    def test_claim_open_bounty(self):
        bounty = _create_bounty()
        bid = bounty["id"]
        resp = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "alice"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["bounty_id"] == bid
        assert data["claimant"] == "alice"
        assert data["status"] == "active"
        # Bounty transitions to IN_PROGRESS
        assert client.get(f"/api/bounties/{bid}").json()["status"] == "in_progress"

    def test_claim_nonexistent_bounty(self):
        resp = client.post("/api/bounties/nonexistent/claims", json={"claimant": "alice"})
        assert resp.status_code == 404

    def test_duplicate_claim_rejected(self):
        bounty = _create_bounty()
        bid = bounty["id"]
        assert client.post(f"/api/bounties/{bid}/claims", json={"claimant": "alice"}).status_code == 201
        resp = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "bob"})
        assert resp.status_code == 409

    def test_claim_completed_bounty_rejected(self):
        bounty = _create_bounty()
        bid = bounty["id"]
        client.post(f"/api/bounties/{bid}/claims", json={"claimant": "alice"})
        cid = client.get(f"/api/bounties/{bid}/claims").json()["items"][0]["id"]
        client.post(f"/api/bounties/{bid}/claims/{cid}/approve")
        resp = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "bob"})
        assert resp.status_code == 409


class TestReleaseClaim:
    def test_release_active_claim(self):
        bounty = _create_bounty()
        bid = bounty["id"]
        cid = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "alice"}).json()["id"]
        resp = client.post(f"/api/bounties/{bid}/claims/{cid}/release")
        assert resp.status_code == 200
        assert resp.json()["status"] == "released"
        assert resp.json()["resolved_at"] is not None
        assert client.get(f"/api/bounties/{bid}").json()["status"] == "open"

    def test_release_nonexistent_claim(self):
        bounty = _create_bounty()
        resp = client.post(f"/api/bounties/{bounty['id']}/claims/nonexistent/release")
        assert resp.status_code == 404

    def test_release_already_released(self):
        bounty = _create_bounty()
        bid = bounty["id"]
        cid = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "alice"}).json()["id"]
        client.post(f"/api/bounties/{bid}/claims/{cid}/release")
        resp = client.post(f"/api/bounties/{bid}/claims/{cid}/release")
        assert resp.status_code == 409


class TestApproveClaim:
    def test_approve_active_claim(self):
        bounty = _create_bounty()
        bid = bounty["id"]
        cid = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "alice"}).json()["id"]
        resp = client.post(f"/api/bounties/{bid}/claims/{cid}/approve")
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"
        assert client.get(f"/api/bounties/{bid}").json()["status"] == "completed"


class TestRejectClaim:
    def test_reject_active_claim(self):
        bounty = _create_bounty()
        bid = bounty["id"]
        cid = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "alice"}).json()["id"]
        resp = client.post(f"/api/bounties/{bid}/claims/{cid}/reject")
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"
        assert client.get(f"/api/bounties/{bid}").json()["status"] == "open"


class TestListClaims:
    def test_list_empty(self):
        bounty = _create_bounty()
        resp = client.get(f"/api/bounties/{bounty['id']}/claims")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_list_after_activity(self):
        bounty = _create_bounty()
        bid = bounty["id"]
        cid = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "alice"}).json()["id"]
        client.post(f"/api/bounties/{bid}/claims/{cid}/release")
        client.post(f"/api/bounties/{bid}/claims", json={"claimant": "bob"})
        assert client.get(f"/api/bounties/{bid}/claims").json()["total"] == 2

    def test_list_nonexistent_bounty(self):
        assert client.get("/api/bounties/nonexistent/claims").status_code == 404


class TestReclaim:
    def test_reclaim_after_release(self):
        bounty = _create_bounty()
        bid = bounty["id"]
        cid = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "alice"}).json()["id"]
        client.post(f"/api/bounties/{bid}/claims/{cid}/release")
        resp = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "bob"})
        assert resp.status_code == 201
        assert resp.json()["claimant"] == "bob"

    def test_reclaim_after_reject(self):
        bounty = _create_bounty()
        bid = bounty["id"]
        cid = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "alice"}).json()["id"]
        client.post(f"/api/bounties/{bid}/claims/{cid}/reject")
        resp = client.post(f"/api/bounties/{bid}/claims", json={"claimant": "charlie"})
        assert resp.status_code == 201
        assert resp.json()["claimant"] == "charlie"
