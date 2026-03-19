"""Comprehensive tests for Bounty CRUD REST API (Issue #3)."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.bounties import router as bounties_router
from app.models.bounty import (
    BountyCreate, BountyStatus, BountyTier, BountyUpdate,
    SubmissionCreate, VALID_STATUS_TRANSITIONS,
)
from app.services import bounty_service

_test_app = FastAPI()
_test_app.include_router(bounties_router)

@_test_app.get("/health")
async def health_check():
    return {"status": "ok"}

client = TestClient(_test_app)

VALID_BOUNTY = {
    "title": "Fix smart contract bug",
    "description": "There is a critical bug in the token transfer logic that needs fixing.",
    "tier": 2,
    "reward_amount": 500.0,
    "required_skills": ["solidity", "rust"],
}


@pytest.fixture(autouse=True)
def clear_store():
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()


def _create_bounty(**overrides) -> dict:
    payload = {**VALID_BOUNTY, **overrides}
    return bounty_service.create_bounty(BountyCreate(**payload)).model_dump()


class TestCreateBounty:
    def test_create_success(self):
        r = client.post("/api/bounties", json=VALID_BOUNTY)
        assert r.status_code == 201
        b = r.json()
        assert b["title"] == VALID_BOUNTY["title"]
        assert b["status"] == "open"
        assert b["tier"] == 2
        assert b["reward_amount"] == 500.0
        assert "solidity" in b["required_skills"]
        assert b["submission_count"] == 0

    def test_create_with_all_fields(self):
        payload = {**VALID_BOUNTY, "deadline": "2026-12-31T23:59:59Z", "created_by": "alice"}
        r = client.post("/api/bounties", json=payload)
        assert r.status_code == 201
        assert r.json()["created_by"] == "alice"

    def test_create_minimal(self):
        r = client.post("/api/bounties", json={"title": "Min", "reward_amount": 100.0})
        assert r.status_code == 201

    def test_create_invalid_title_empty(self):
        assert client.post("/api/bounties", json={**VALID_BOUNTY, "title": ""}).status_code == 422

    def test_create_invalid_reward_zero(self):
        assert client.post("/api/bounties", json={**VALID_BOUNTY, "reward_amount": 0}).status_code == 422

    def test_create_invalid_reward_negative(self):
        assert client.post("/api/bounties", json={**VALID_BOUNTY, "reward_amount": -10}).status_code == 422

    def test_create_invalid_tier(self):
        assert client.post("/api/bounties", json={**VALID_BOUNTY, "tier": 99}).status_code == 422

    def test_skills_normalised(self):
        r = client.post("/api/bounties", json={**VALID_BOUNTY, "required_skills": ["Rust", "SOLIDITY"]})
        assert r.status_code == 201
        assert "rust" in r.json()["required_skills"]
        assert "solidity" in r.json()["required_skills"]


class TestListBounties:
    def test_list_empty(self):
        r = client.get("/api/bounties")
        assert r.status_code == 200
        assert r.json()["total"] == 0

    def test_list_with_data(self):
        _create_bounty(title="B1"); _create_bounty(title="B2")
        assert client.get("/api/bounties").json()["total"] == 2

    def test_filter_by_status(self):
        b = _create_bounty(title="A")
        bounty_service.update_bounty(b["id"], BountyUpdate(status=BountyStatus.IN_PROGRESS))
        _create_bounty(title="B")
        assert client.get("/api/bounties?status=open").json()["total"] == 1
        assert client.get("/api/bounties?status=in_progress").json()["total"] == 1

    def test_filter_by_tier(self):
        _create_bounty(tier=1); _create_bounty(tier=2); _create_bounty(tier=3)
        assert client.get("/api/bounties?tier=1").json()["total"] == 1

    def test_filter_by_skills(self):
        _create_bounty(title="R", required_skills=["rust", "wasm"])
        _create_bounty(title="P", required_skills=["python"])
        _create_bounty(title="F", required_skills=["rust", "python"])
        assert client.get("/api/bounties?skills=rust").json()["total"] == 2
        assert client.get("/api/bounties?skills=wasm").json()["total"] == 1

    def test_filter_skills_case_insensitive(self):
        _create_bounty(required_skills=["rust"])
        assert client.get("/api/bounties?skills=RUST").json()["total"] == 1

    def test_pagination(self):
        for i in range(5): _create_bounty(title=f"B{i}")
        r = client.get("/api/bounties?skip=0&limit=2").json()
        assert r["total"] == 5
        assert len(r["items"]) == 2

    def test_combined_filters(self):
        _create_bounty(title="Match", tier=1, required_skills=["rust"])
        _create_bounty(title="Wrong", tier=2, required_skills=["rust"])
        assert client.get("/api/bounties?tier=1&skills=rust").json()["total"] == 1


class TestGetBounty:
    def test_get_success(self):
        b = _create_bounty()
        r = client.get(f"/api/bounties/{b['id']}")
        assert r.status_code == 200
        assert "submissions" in r.json()

    def test_get_not_found(self):
        assert client.get("/api/bounties/nope").status_code == 404

    def test_get_includes_submissions(self):
        b = _create_bounty()
        bounty_service.submit_solution(b["id"], SubmissionCreate(
            pr_url="https://github.com/org/repo/pull/1", submitted_by="alice"))
        r = client.get(f"/api/bounties/{b['id']}")
        assert r.json()["submission_count"] == 1


class TestUpdateBounty:
    def test_update_title(self):
        b = _create_bounty()
        r = client.patch(f"/api/bounties/{b['id']}", json={"title": "New"})
        assert r.status_code == 200
        assert r.json()["title"] == "New"

    def test_update_not_found(self):
        assert client.patch("/api/bounties/nope", json={"title": "X"}).status_code == 404

    def test_status_open_to_in_progress(self):
        b = _create_bounty()
        assert client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"}).status_code == 200

    def test_status_full_lifecycle(self):
        b = _create_bounty()
        for s in ["in_progress", "completed", "paid"]:
            r = client.patch(f"/api/bounties/{b['id']}", json={"status": s})
            assert r.status_code == 200
            assert r.json()["status"] == s

    def test_invalid_open_to_completed(self):
        b = _create_bounty()
        r = client.patch(f"/api/bounties/{b['id']}", json={"status": "completed"})
        assert r.status_code == 400
        assert "Invalid status transition" in r.json()["detail"]

    def test_invalid_open_to_paid(self):
        b = _create_bounty()
        assert client.patch(f"/api/bounties/{b['id']}", json={"status": "paid"}).status_code == 400

    def test_paid_is_terminal(self):
        b = _create_bounty()
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        client.patch(f"/api/bounties/{b['id']}", json={"status": "completed"})
        client.patch(f"/api/bounties/{b['id']}", json={"status": "paid"})
        for s in ["open", "in_progress", "completed"]:
            assert client.patch(f"/api/bounties/{b['id']}", json={"status": s}).status_code == 400

    def test_in_progress_back_to_open(self):
        b = _create_bounty()
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        r = client.patch(f"/api/bounties/{b['id']}", json={"status": "open"})
        assert r.status_code == 200


class TestDeleteBounty:
    def test_delete_success(self):
        b = _create_bounty()
        assert client.delete(f"/api/bounties/{b['id']}").status_code == 204
        assert client.get(f"/api/bounties/{b['id']}").status_code == 404

    def test_delete_not_found(self):
        assert client.delete("/api/bounties/nope").status_code == 404


class TestSubmitSolution:
    def test_submit_success(self):
        b = _create_bounty()
        r = client.post(f"/api/bounties/{b['id']}/submit", json={
            "pr_url": "https://github.com/org/repo/pull/42", "submitted_by": "alice"})
        assert r.status_code == 201
        assert r.json()["pr_url"] == "https://github.com/org/repo/pull/42"
        assert r.json()["bounty_id"] == b["id"]

    def test_submit_with_notes(self):
        b = _create_bounty()
        r = client.post(f"/api/bounties/{b['id']}/submit", json={
            "pr_url": "https://github.com/org/repo/pull/1", "submitted_by": "bob",
            "notes": "Fixed edge case"})
        assert r.status_code == 201
        assert r.json()["notes"] == "Fixed edge case"

    def test_submit_not_found(self):
        r = client.post("/api/bounties/nope/submit", json={
            "pr_url": "https://github.com/org/repo/pull/1", "submitted_by": "alice"})
        assert r.status_code == 404

    def test_submit_invalid_url(self):
        b = _create_bounty()
        r = client.post(f"/api/bounties/{b['id']}/submit", json={
            "pr_url": "not-github", "submitted_by": "alice"})
        assert r.status_code == 422

    def test_submit_duplicate_rejected(self):
        b = _create_bounty()
        url = "https://github.com/org/repo/pull/42"
        client.post(f"/api/bounties/{b['id']}/submit", json={"pr_url": url, "submitted_by": "a"})
        r = client.post(f"/api/bounties/{b['id']}/submit", json={"pr_url": url, "submitted_by": "b"})
        assert r.status_code == 400

    def test_submit_on_completed_rejected(self):
        b = _create_bounty()
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        client.patch(f"/api/bounties/{b['id']}", json={"status": "completed"})
        r = client.post(f"/api/bounties/{b['id']}/submit", json={
            "pr_url": "https://github.com/org/repo/pull/99", "submitted_by": "alice"})
        assert r.status_code == 400

    def test_submit_on_in_progress_accepted(self):
        b = _create_bounty()
        client.patch(f"/api/bounties/{b['id']}", json={"status": "in_progress"})
        r = client.post(f"/api/bounties/{b['id']}/submit", json={
            "pr_url": "https://github.com/org/repo/pull/5", "submitted_by": "alice"})
        assert r.status_code == 201

    def test_multiple_submissions(self):
        b = _create_bounty()
        for i in range(3):
            r = client.post(f"/api/bounties/{b['id']}/submit", json={
                "pr_url": f"https://github.com/org/repo/pull/{i}", "submitted_by": f"u{i}"})
            assert r.status_code == 201
        assert client.get(f"/api/bounties/{b['id']}").json()["submission_count"] == 3


class TestGetSubmissions:
    def test_empty(self):
        b = _create_bounty()
        assert client.get(f"/api/bounties/{b['id']}/submissions").json() == []

    def test_with_data(self):
        b = _create_bounty()
        bounty_service.submit_solution(b["id"], SubmissionCreate(
            pr_url="https://github.com/org/repo/pull/1", submitted_by="alice"))
        assert len(client.get(f"/api/bounties/{b['id']}/submissions").json()) == 1

    def test_not_found(self):
        assert client.get("/api/bounties/nope/submissions").status_code == 404


class TestStatusTransitions:
    def test_transition_map(self):
        assert VALID_STATUS_TRANSITIONS[BountyStatus.OPEN] == {BountyStatus.IN_PROGRESS}
        assert VALID_STATUS_TRANSITIONS[BountyStatus.PAID] == set()

    def test_all_invalid_transitions_rejected(self):
        for current in BountyStatus:
            allowed = VALID_STATUS_TRANSITIONS.get(current, set())
            for target in BountyStatus:
                if target in allowed or target == current:
                    continue
                b = _create_bounty()
                path = _status_path(BountyStatus.OPEN, current)
                if path is None:
                    continue
                for step in path[1:]:
                    assert client.patch(f"/api/bounties/{b['id']}", json={"status": step.value}).status_code == 200
                r = client.patch(f"/api/bounties/{b['id']}", json={"status": target.value})
                assert r.status_code == 400, f"{current.value}->{target.value} should be 400, got {r.status_code}"


def _status_path(start, end):
    if start == end:
        return [start]
    from collections import deque
    q = deque([(start, [start])])
    seen = {start}
    while q:
        cur, path = q.popleft()
        for ns in VALID_STATUS_TRANSITIONS.get(cur, set()):
            if ns == end:
                return path + [ns]
            if ns not in seen:
                seen.add(ns)
                q.append((ns, path + [ns]))
    return None


class TestHealth:
    def test_health(self):
        assert client.get("/health").json()["status"] == "ok"
