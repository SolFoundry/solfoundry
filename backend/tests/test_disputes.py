"""Tests for dispute resolution system."""

from datetime import datetime, timezone, timedelta

from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.disputes import router
from app.services import dispute_service
from app.services.bounty_service import _bounty_store
from app.models.bounty import BountyDB, BountyStatus, SubmissionRecord, SubmissionStatus

_a = FastAPI()
_a.include_router(router, prefix="/api")
client = TestClient(_a)

SUBMITTER = "00000000-0000-0000-0000-000000000001"
CREATOR = "00000000-0000-0000-0000-000000000002"
ADMIN = "00000000-0000-0000-0000-000000000003"
OUTSIDER = "00000000-0000-0000-0000-000000000099"

HEADERS_SUBMITTER = {"X-User-ID": SUBMITTER}
HEADERS_ADMIN = {"X-User-ID": ADMIN}
HEADERS_CREATOR = {"X-User-ID": CREATOR}

def _seed_bounty(bounty_id="b1", rejected_by=SUBMITTER, rejected_at=None):
    """Seed the bounty store with a bounty that has a rejected submission."""
    rejected_time = rejected_at or datetime.now(timezone.utc)
    bounty = BountyDB(
        id=bounty_id, title="Test Bounty", reward_amount=100.0,
        created_by=CREATOR, status=BountyStatus.UNDER_REVIEW,
        submissions=[SubmissionRecord(
            id="sub-1", bounty_id=bounty_id, pr_url="https://github.com/test/pr/1",
            submitted_by=rejected_by, status=SubmissionStatus.REJECTED,
            submitted_at=rejected_time,
        )],
    )
    _bounty_store[bounty_id] = bounty
    return bounty

@pytest.fixture(autouse=True)
def reset():
    """Reset all in-memory stores between tests."""
    dispute_service._dispute_store.clear()
    dispute_service._history_store.clear()
    dispute_service._reputation_impacts.clear()
    _bounty_store.clear()
    with patch.object(
        dispute_service, "is_admin", side_effect=lambda uid: uid == ADMIN
    ):
        yield
    dispute_service._dispute_store.clear()
    dispute_service._history_store.clear()
    dispute_service._reputation_impacts.clear()
    _bounty_store.clear()

def _payload(bounty_id="b1", reason="incorrect_review"):
    """Build a dispute creation payload."""
    return {"bounty_id": bounty_id, "reason": reason,
            "description": "The AI review did not correctly evaluate my code.",
            "evidence_links": [{"evidence_type": "link",
             "url": "https://github.com/pr/1", "description": "Rejected PR"}]}

def _create_dispute(bounty_id="b1"):
    """Seed bounty and create a dispute, returning the response JSON."""
    _seed_bounty(bounty_id)
    resp = client.post("/api/disputes", json=_payload(bounty_id), headers=HEADERS_SUBMITTER)
    assert resp.status_code == 201, resp.text
    return resp.json()

def _add_evidence(dispute_id, user=SUBMITTER):
    """Submit evidence to a dispute."""
    return client.post(f"/api/disputes/{dispute_id}/evidence",
        json={"evidence_items": [{"evidence_type": "link",
              "url": "https://example.com/ev", "description": "Evidence"}]},
        headers={"X-User-ID": user})

def _resolve(dispute_id, outcome="split", user=ADMIN):
    """Resolve a dispute as admin."""
    return client.post(f"/api/disputes/{dispute_id}/resolve",
        json={"outcome": outcome, "review_notes": "Admin decision."},
        headers={"X-User-ID": user})

def test_create_success():
    """Authenticated user can create dispute on bounty with rejected submission."""
    d = _create_dispute()
    assert d["status"] == "opened" and d["outcome"] is None
    assert d["submitter_id"] == SUBMITTER and d["creator_id"] == CREATOR

def test_create_uses_authenticated_user():
    """Server derives creator from bounty; submitter from auth header."""
    _seed_bounty("b1")
    resp = client.post("/api/disputes", json=_payload("b1"), headers=HEADERS_SUBMITTER)
    assert resp.status_code == 201
    assert resp.json()["submitter_id"] == SUBMITTER
    assert resp.json()["creator_id"] == CREATOR

def test_create_all_reasons():
    """All valid dispute reasons are accepted."""
    for i, reason in enumerate(["incorrect_review", "plagiarism", "rule_violation",
            "technical_issue", "unfair_competition", "other"]):
        dispute_service._dispute_store.clear()
        _bounty_store.clear()
        _seed_bounty(f"b{i}")
        assert client.post("/api/disputes", json=_payload(f"b{i}", reason),
            headers=HEADERS_SUBMITTER).status_code == 201

def test_create_invalid_reason():
    """Invalid reason is rejected with 422."""
    _seed_bounty("b1")
    assert client.post("/api/disputes", json=_payload(reason="bad"),
        headers=HEADERS_SUBMITTER).status_code == 422

def test_create_short_description():
    """Description shorter than minimum is rejected with 422."""
    _seed_bounty("b1")
    p = _payload(); p["description"] = "Too short"
    assert client.post("/api/disputes", json=p, headers=HEADERS_SUBMITTER).status_code == 422

def test_create_self_dispute():
    """Creator cannot dispute their own bounty."""
    _seed_bounty("b1", rejected_by=CREATOR)
    assert client.post("/api/disputes", json=_payload(), headers=HEADERS_CREATOR).status_code == 400

def test_create_duplicate():
    """Duplicate active dispute for same bounty is rejected."""
    _create_dispute()
    assert client.post("/api/disputes", json=_payload(), headers=HEADERS_SUBMITTER).status_code == 409

def test_create_bounty_not_found():
    """Dispute on non-existent bounty returns 404."""
    assert client.post("/api/disputes", json=_payload("nonexistent"), headers=HEADERS_SUBMITTER).status_code == 404

def test_create_no_rejected_submission():
    """Cannot dispute bounty when user has no rejected submission."""
    _bounty_store["b1"] = BountyDB(id="b1", title="T", reward_amount=100.0,
        created_by=CREATOR, status=BountyStatus.OPEN, submissions=[])
    assert client.post("/api/disputes", json=_payload(), headers=HEADERS_SUBMITTER).status_code == 400

def test_create_72h_window_expired():
    """Dispute filed after 72 hours of rejection is rejected."""
    _seed_bounty("b1", rejected_at=datetime.now(timezone.utc) - timedelta(hours=73))
    resp = client.post("/api/disputes", json=_payload(), headers=HEADERS_SUBMITTER)
    assert resp.status_code == 400 and "72 hours" in resp.json()["detail"]

def test_create_within_72h_window():
    """Dispute filed within 72 hours of rejection succeeds."""
    _seed_bounty("b1", rejected_at=datetime.now(timezone.utc) - timedelta(hours=71))
    assert client.post("/api/disputes", json=_payload(), headers=HEADERS_SUBMITTER).status_code == 201

def test_get_with_history():
    """Participant can get dispute details with audit history."""
    d = _create_dispute()
    resp = client.get(f"/api/disputes/{d['id']}", headers=HEADERS_SUBMITTER)
    assert resp.status_code == 200 and len(resp.json()["history"]) >= 1

def test_get_not_found():
    """Non-existent dispute returns 404."""
    assert client.get("/api/disputes/x", headers=HEADERS_SUBMITTER).status_code == 404

def test_get_forbidden_for_outsider():
    """Outsider cannot view a dispute they are not a party to."""
    d = _create_dispute()
    assert client.get(f"/api/disputes/{d['id']}", headers={"X-User-ID": OUTSIDER}).status_code == 403

def test_get_allowed_for_admin():
    """Admin can view any dispute."""
    d = _create_dispute()
    assert client.get(f"/api/disputes/{d['id']}", headers=HEADERS_ADMIN).status_code == 200

def test_list_filters_by_user():
    """Non-admin users only see disputes they are party to."""
    _create_dispute()
    assert client.get("/api/disputes", headers={"X-User-ID": OUTSIDER}).json()["total"] == 0

def test_list_admin_sees_all():
    """Admin sees all disputes regardless of participation."""
    _create_dispute("a"); _create_dispute("b")
    assert client.get("/api/disputes", headers=HEADERS_ADMIN).json()["total"] == 2

def test_list_filter_status():
    """Status filter works correctly."""
    _create_dispute()
    assert client.get("/api/disputes", params={"status": "opened"}, headers=HEADERS_SUBMITTER).json()["total"] == 1
    assert client.get("/api/disputes", params={"status": "resolved"}, headers=HEADERS_SUBMITTER).json()["total"] == 0

def test_list_filter_bounty():
    """Bounty filter works correctly."""
    _create_dispute("a"); _create_dispute("b")
    d = client.get("/api/disputes", params={"bounty_id": "a"}, headers=HEADERS_SUBMITTER).json()
    assert d["total"] == 1 and d["items"][0]["bounty_id"] == "a"

def test_list_pagination():
    """Pagination works correctly."""
    for i in range(5): _create_dispute(f"b{i}")
    d = client.get("/api/disputes", params={"skip": 2, "limit": 2}, headers=HEADERS_SUBMITTER).json()
    assert d["total"] == 5 and len(d["items"]) == 2

def test_evidence_success():
    """Submitter can submit evidence and status moves to evidence."""
    d = _create_dispute()
    resp = _add_evidence(d["id"])
    assert resp.json()["status"] == "evidence" and len(resp.json()["evidence_links"]) == 2

def test_evidence_creator_can_submit():
    """Creator can also submit evidence."""
    assert _add_evidence(_create_dispute()["id"], user=CREATOR).status_code == 200

def test_evidence_outsider_rejected():
    """Outsider cannot submit evidence."""
    assert _add_evidence(_create_dispute()["id"], user=OUTSIDER).status_code == 403

def test_evidence_not_found():
    """Evidence on non-existent dispute returns 404."""
    assert client.post("/api/disputes/x/evidence", json={"evidence_items": [
        {"evidence_type": "link", "url": "https://example.com", "description": "y"}]},
        headers=HEADERS_SUBMITTER).status_code == 404

def test_evidence_max_items_exceeded():
    """Submitting more than 10 evidence items returns 422."""
    d = _create_dispute()
    items = [
        {"evidence_type": "link", "url": f"https://example.com/ev{i}",
         "description": f"Evidence item {i}"}
        for i in range(11)
    ]
    resp = client.post(f'/api/disputes/{d['id']}/evidence',
        json={"evidence_items": items}, headers=HEADERS_SUBMITTER)
    assert resp.status_code == 422

def test_resolve_non_admin_forbidden():
    """Non-admin user gets 403 when trying to resolve."""
    d = _create_dispute(); _add_evidence(d["id"])
    assert _resolve(d["id"], user=SUBMITTER).status_code == 403

def test_resolve_all_outcomes():
    """Admin can resolve with all valid outcomes."""
    for outcome in ("contributor_wins", "creator_wins", "split"):
        dispute_service._dispute_store.clear(); dispute_service._history_store.clear()
        _bounty_store.clear()
        d = _create_dispute(); _add_evidence(d["id"])
        resp = _resolve(d["id"], outcome=outcome, user=ADMIN)
        assert resp.status_code == 200 and resp.json()["status"] == "resolved"

def test_resolve_wrong_state():
    """Cannot resolve dispute still in opened state."""
    d = _create_dispute()
    assert _resolve(d["id"]).status_code == 400

def test_resolve_ai_auto_resolve():
    """AI mediation auto-resolves when evidence score meets threshold."""
    d = _create_dispute()
    for _ in range(4): _add_evidence(d["id"])
    resp = _resolve(d["id"], outcome="split", user=ADMIN)
    assert resp.json()["status"] == "resolved" and resp.json()["ai_review_score"] is not None

def test_resolve_no_client_ai_score():
    """The /mediate endpoint no longer exists."""
    d = _create_dispute(); _add_evidence(d["id"])
    resp = client.post(f"/api/disputes/{d['id']}/mediate",
        params={"ai_review_score": 9.0}, headers=HEADERS_ADMIN)
    assert resp.status_code in (404, 405)

def test_stats():
    """Stats endpoint returns correct counts."""
    _create_dispute("a"); _create_dispute("b")
    d = client.get("/api/disputes/stats", headers=HEADERS_SUBMITTER).json()
    assert d["total_disputes"] == 2 and d["opened_disputes"] == 2

def test_reputation_on_contributor_wins():
    """Reputation impact recorded when dispute resolves for contributor."""
    d = _create_dispute(); _add_evidence(d["id"])
    _resolve(d["id"], outcome="contributor_wins")
    impacts = dispute_service.get_reputation_impacts(CREATOR)
    assert len(impacts) >= 1 and impacts[0]["impact_type"] == "unfair_rejection"

def test_reputation_on_creator_wins():
    """Reputation impact recorded when dispute resolves for creator."""
    d = _create_dispute(); _add_evidence(d["id"])
    _resolve(d["id"], outcome="creator_wins")
    impacts = dispute_service.get_reputation_impacts(SUBMITTER)
    assert len(impacts) >= 1 and impacts[0]["impact_type"] == "frivolous_dispute"

def test_evidence_link_requires_url():
    """Link evidence with no URL is rejected."""
    _seed_bounty("b1")
    p = _payload(); p["evidence_links"] = [{"evidence_type": "link", "description": "Missing URL"}]
    assert client.post("/api/disputes", json=p, headers=HEADERS_SUBMITTER).status_code == 422

def test_evidence_link_requires_http_scheme():
    """Link evidence with non-http URL is rejected."""
    _seed_bounty("b1")
    p = _payload(); p["evidence_links"] = [{"evidence_type": "link", "url": "ftp://bad.com/f", "description": "Bad"}]
    assert client.post("/api/disputes", json=p, headers=HEADERS_SUBMITTER).status_code == 422

def test_bounty_id_empty_rejected():
    """Empty bounty_id is rejected by the validator."""
    _seed_bounty("b1")
    p = _payload(); p["bounty_id"] = "   "
    assert client.post("/api/disputes", json=p, headers=HEADERS_SUBMITTER).status_code == 422

def test_full_lifecycle():
    """End-to-end: create -> evidence -> resolve with admin."""
    d = _create_dispute()
    assert d["status"] == "opened"
    assert _add_evidence(d["id"]).json()["status"] == "evidence"
    data = _resolve(d["id"], outcome="split").json()
    assert data["status"] == "resolved" and data["outcome"] == "split"
    assert len(client.get(f"/api/disputes/{d['id']}", headers=HEADERS_SUBMITTER).json()["history"]) >= 3
