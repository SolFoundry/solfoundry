"""Comprehensive tests for Bounty CRUD REST API (Issue #3).

Covers: create, list (pagination/filters), get, update (with status transitions),
delete, submit solution, list submissions, and edge cases.
"""

import os; os.environ.setdefault("AUTH_ENABLED", "false")  # noqa: E702
from collections import deque

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.bounties import router as bounties_router
from app.models.bounty import (
    BountyCreate,
    BountyStatus,
    BountyUpdate,
    SubmissionCreate,
    VALID_STATUS_TRANSITIONS,
)
from app.services import bounty_service

# ---------------------------------------------------------------------------
# Test app & client
# ---------------------------------------------------------------------------

_test_app = FastAPI()
_test_app.include_router(bounties_router)


@_test_app.get("/health")
async def health_check():
    return {"status": "ok"}


client = TestClient(_test_app)

# ---------------------------------------------------------------------------
# Fixtures & helpers
# ---------------------------------------------------------------------------

VALID_BOUNTY = {
    "title": "Fix smart contract bug",
    "description": "There is a critical bug in the token transfer logic that needs fixing.",
    "tier": 2,
    "reward_amount": 500.0,
    "required_skills": ["solidity", "rust"],
}


@pytest.fixture(autouse=True)
def clear_store():
    """Ensure each test starts and ends with an empty bounty store."""
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()


def _create_bounty(**overrides) -> dict:
    """Helper: create a bounty via the service and return its dict."""
    payload = {**VALID_BOUNTY, **overrides}
    return bounty_service.create_bounty(BountyCreate(**payload)).model_dump()


def _status_path(start: BountyStatus, end: BountyStatus):
    """BFS through VALID_STATUS_TRANSITIONS to find a path from start to end."""
    if start == end:
        return [start]
    queue = deque([(start, [start])])
    seen = {start}
    while queue:
        current, path = queue.popleft()
        for next_status in VALID_STATUS_TRANSITIONS.get(current, set()):
            if next_status == end:
                return path + [next_status]
            if next_status not in seen:
                seen.add(next_status)
                queue.append((next_status, path + [next_status]))
    return None


# ===========================================================================
# CREATE
# ===========================================================================


class TestCreateBounty:
    def test_create_success(self):
        resp = client.post("/api/bounties", json=VALID_BOUNTY)
        assert resp.status_code == 201
        body = resp.json()
        assert body["title"] == VALID_BOUNTY["title"]
        assert body["status"] == "open"
        assert body["tier"] == 2
        assert body["reward_amount"] == 500.0
        assert set(body["required_skills"]) == {"solidity", "rust"}
        assert body["submission_count"] == 0
        assert body["submissions"] == []
        assert "id" in body
        assert "created_at" in body
        assert "updated_at" in body

    def test_create_with_all_fields(self):
        payload = {
            **VALID_BOUNTY,
            "deadline": "2026-12-31T23:59:59Z",
            "created_by": "alice",
            "github_issue_url": "https://github.com/org/repo/issues/42",
        }
        resp = client.post("/api/bounties", json=payload)
        assert resp.status_code == 201
        body = resp.json()
        assert body["created_by"] == "alice"
        assert body["github_issue_url"] == "https://github.com/org/repo/issues/42"
        assert "2026-12-31" in body["deadline"]

    def test_create_minimal(self):
        resp = client.post(
            "/api/bounties", json={"title": "Min bounty", "reward_amount": 1.0}
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["description"] == ""
        assert body["tier"] == 2
        assert body["created_by"] == "system"
        assert body["required_skills"] == []

    def test_create_invalid_title_empty(self):
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "title": ""})
        assert resp.status_code == 422

    def test_create_invalid_title_too_short(self):
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "title": "ab"})
        assert resp.status_code == 422

    def test_create_title_at_max_length(self):
        long_title = "A" * 200
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "title": long_title})
        assert resp.status_code == 201
        assert resp.json()["title"] == long_title

    def test_create_title_over_max_length(self):
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "title": "A" * 201})
        assert resp.status_code == 422

    def test_create_invalid_reward_zero(self):
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "reward_amount": 0})
        assert resp.status_code == 422

    def test_create_invalid_reward_negative(self):
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "reward_amount": -10})
        assert resp.status_code == 422

    def test_create_reward_at_minimum(self):
        resp = client.post(
            "/api/bounties", json={**VALID_BOUNTY, "reward_amount": 0.01}
        )
        assert resp.status_code == 201
        assert resp.json()["reward_amount"] == 0.01

    def test_create_reward_above_max(self):
        resp = client.post(
            "/api/bounties", json={**VALID_BOUNTY, "reward_amount": 1_000_001}
        )
        assert resp.status_code == 422

    def test_create_invalid_tier(self):
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "tier": 99})
        assert resp.status_code == 422

    def test_create_tier_1(self):
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "tier": 1})
        assert resp.status_code == 201
        assert resp.json()["tier"] == 1

    def test_skills_normalised(self):
        resp = client.post(
            "/api/bounties",
            json={
                **VALID_BOUNTY,
                "required_skills": ["Rust", " SOLIDITY ", "  wasm  "],
            },
        )
        assert resp.status_code == 201
        skills = resp.json()["required_skills"]
        assert "rust" in skills
        assert "solidity" in skills
        assert "wasm" in skills

    def test_skills_empty_strings_filtered(self):
        resp = client.post(
            "/api/bounties",
            json={**VALID_BOUNTY, "required_skills": ["", "  ", "rust"]},
        )
        assert resp.status_code == 201
        assert resp.json()["required_skills"] == ["rust"]

    def test_skills_too_many(self):
        resp = client.post(
            "/api/bounties",
            json={**VALID_BOUNTY, "required_skills": [f"skill{i}" for i in range(25)]},
        )
        assert resp.status_code == 422

    def test_skills_invalid_format(self):
        resp = client.post(
            "/api/bounties",
            json={**VALID_BOUNTY, "required_skills": ["valid", "has spaces"]},
        )
        assert resp.status_code == 422

    def test_create_special_characters_in_title(self):
        title = "Fix bug: handle <script>alert(xss)</script> & quotes"
        resp = client.post("/api/bounties", json={**VALID_BOUNTY, "title": title})
        assert resp.status_code == 201
        assert resp.json()["title"] == title

    def test_create_invalid_github_url(self):
        resp = client.post(
            "/api/bounties",
            json={
                **VALID_BOUNTY,
                "github_issue_url": "https://gitlab.com/repo/issues/1",
            },
        )
        assert resp.status_code == 422

    def test_create_returns_unique_ids(self):
        ids = set()
        for _ in range(10):
            resp = client.post("/api/bounties", json=VALID_BOUNTY)
            ids.add(resp.json()["id"])
        assert len(ids) == 10


# ===========================================================================
# LIST
# ===========================================================================


class TestListBounties:
    def test_list_empty(self):
        resp = client.get("/api/bounties")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["items"] == []
        assert body["skip"] == 0
        assert body["limit"] == 20

    def test_list_with_data(self):
        _create_bounty(title="Bnt 1")
        _create_bounty(title="Bnt 2")
        body = client.get("/api/bounties").json()
        assert body["total"] == 2
        assert len(body["items"]) == 2

    def test_list_item_shape(self):
        _create_bounty()
        item = client.get("/api/bounties").json()["items"][0]
        expected_keys = {
            "id",
            "title",
            "tier",
            "reward_amount",
            "status",
            "required_skills",
            "github_issue_url",
            "deadline",
            "created_by",
            "creator_wallet",
            "creator_type",
            "submission_count",
            "created_at",
        }
        assert set(item.keys()) == expected_keys

    def test_filter_by_status(self):
        b = _create_bounty(title="Alpha")
        bounty_service.update_bounty(
            b["id"], BountyUpdate(status=BountyStatus.IN_PROGRESS)
        )
        _create_bounty(title="Beta")
        assert client.get("/api/bounties?status=open").json()["total"] == 1
        assert client.get("/api/bounties?status=in_progress").json()["total"] == 1
        assert client.get("/api/bounties?status=completed").json()["total"] == 0

    def test_filter_by_tier(self):
        _create_bounty(tier=1)
        _create_bounty(tier=2)
        _create_bounty(tier=3)
        assert client.get("/api/bounties?tier=1").json()["total"] == 1
        assert client.get("/api/bounties?tier=2").json()["total"] == 1
        assert client.get("/api/bounties?tier=3").json()["total"] == 1

    def test_filter_by_skills(self):
        _create_bounty(title="Rust wasm project", required_skills=["rust", "wasm"])
        _create_bounty(title="Python project", required_skills=["python"])
        _create_bounty(title="Rust python mix", required_skills=["rust", "python"])
        assert client.get("/api/bounties?skills=rust").json()["total"] == 2
        assert client.get("/api/bounties?skills=wasm").json()["total"] == 1
        assert client.get("/api/bounties?skills=python").json()["total"] == 2

    def test_filter_skills_case_insensitive(self):
        _create_bounty(required_skills=["rust"])
        assert client.get("/api/bounties?skills=RUST").json()["total"] == 1

    def test_filter_skills_nonexistent(self):
        _create_bounty(required_skills=["rust"])
        assert client.get("/api/bounties?skills=java").json()["total"] == 0

    def test_pagination_basic(self):
        for i in range(5):
            _create_bounty(title=f"Bounty {i}")
        body = client.get("/api/bounties?skip=0&limit=2").json()
        assert body["total"] == 5
        assert len(body["items"]) == 2

    def test_pagination_skip_beyond_total(self):
        _create_bounty()
        _create_bounty()
        body = client.get("/api/bounties?skip=100&limit=10").json()
        assert body["total"] == 2
        assert body["items"] == []

    def test_pagination_limit_exceeds_remaining(self):
        for i in range(3):
            _create_bounty(title=f"Bounty item {i}")
        body = client.get("/api/bounties?skip=1&limit=100").json()
        assert body["total"] == 3
        assert len(body["items"]) == 2

    def test_combined_filters(self):
        _create_bounty(title="Match", tier=1, required_skills=["rust"])
        _create_bounty(title="Wrong tier", tier=2, required_skills=["rust"])
        _create_bounty(title="Wrong skill", tier=1, required_skills=["python"])
        assert client.get("/api/bounties?tier=1&skills=rust").json()["total"] == 1

    def test_limit_max_100(self):
        resp = client.get("/api/bounties?limit=101")
        assert resp.status_code == 422

    def test_skip_negative(self):
        resp = client.get("/api/bounties?skip=-1")
        assert resp.status_code == 422

    def test_limit_zero(self):
        resp = client.get("/api/bounties?limit=0")
        assert resp.status_code == 422


# ===========================================================================
# GET SINGLE
# ===========================================================================


class TestGetBounty:
    def test_get_success(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.get(f"/api/bounties/{bid}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == bid
        assert body["title"] == VALID_BOUNTY["title"]
        assert "submissions" in body
        assert "submission_count" in body

    def test_get_not_found(self):
        resp = client.get("/api/bounties/nonexistent-id")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_get_includes_submissions(self):
        b = _create_bounty()
        bid = b["id"]
        bounty_service.submit_solution(
            bid,
            SubmissionCreate(
                pr_url="https://github.com/org/repo/pull/1", submitted_by="alice"
            ),
        )
        body = client.get(f"/api/bounties/{bid}").json()
        assert body["submission_count"] == 1
        assert len(body["submissions"]) == 1
        assert body["submissions"][0]["submitted_by"] == "alice"

    def test_get_response_shape(self):
        b = _create_bounty()
        bid = b["id"]
        body = client.get(f"/api/bounties/{bid}").json()
        expected_keys = {
            "id",
            "title",
            "description",
            "tier",
            "reward_amount",
            "status",
            "github_issue_url",
            "required_skills",
            "deadline",
            "created_by",
            "creator_wallet",
            "creator_type",
            "submissions",
            "submission_count",
            "created_at",
            "updated_at",
        }
        assert set(body.keys()) == expected_keys


# ===========================================================================
# UPDATE
# ===========================================================================


class TestUpdateBounty:
    def test_update_title(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(f"/api/bounties/{bid}", json={"title": "New title"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "New title"

    def test_update_description(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(f"/api/bounties/{bid}", json={"description": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["description"] == "Updated"

    def test_update_reward_amount(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(f"/api/bounties/{bid}", json={"reward_amount": 999.99})
        assert resp.status_code == 200
        assert resp.json()["reward_amount"] == 999.99

    def test_update_multiple_fields(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(
            f"/api/bounties/{bid}",
            json={
                "title": "Updated title",
                "description": "New desc",
                "reward_amount": 123.0,
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["title"] == "Updated title"
        assert body["description"] == "New desc"
        assert body["reward_amount"] == 123.0

    def test_update_not_found(self):
        resp = client.patch("/api/bounties/nope", json={"title": "Anything"})
        assert resp.status_code == 404

    def test_update_invalid_title_too_short(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(f"/api/bounties/{bid}", json={"title": "ab"})
        assert resp.status_code == 422

    def test_update_invalid_reward(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(f"/api/bounties/{bid}", json={"reward_amount": -5})
        assert resp.status_code == 422

    def test_update_preserves_unset_fields(self):
        b = _create_bounty()
        bid = b["id"]
        original_desc = b["description"]
        resp = client.patch(f"/api/bounties/{bid}", json={"title": "Changed title"})
        assert resp.status_code == 200
        assert resp.json()["description"] == original_desc

    def test_update_skills_normalised(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(
            f"/api/bounties/{bid}", json={"required_skills": ["python", "go"]}
        )
        assert resp.status_code == 200
        assert set(resp.json()["required_skills"]) == {"python", "go"}

    def test_update_updates_timestamp(self):
        b = _create_bounty()
        bid = b["id"]
        original_updated = b["updated_at"]
        resp = client.patch(f"/api/bounties/{bid}", json={"title": "New name"})
        # Both are ISO strings from model_dump / JSON response; lexicographic compare works
        new_updated = resp.json()["updated_at"]
        assert str(new_updated) >= str(original_updated)

    # --- Status transitions ---

    def test_status_open_to_in_progress(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(f"/api/bounties/{bid}", json={"status": "in_progress"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    def test_status_full_lifecycle(self):
        b = _create_bounty()
        bid = b["id"]
        for status in ["in_progress", "completed", "paid"]:
            resp = client.patch(f"/api/bounties/{bid}", json={"status": status})
            assert resp.status_code == 200
            assert resp.json()["status"] == status

    def test_invalid_open_to_completed(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(f"/api/bounties/{bid}", json={"status": "completed"})
        assert resp.status_code == 400
        assert "Invalid status transition" in resp.json()["detail"]

    def test_invalid_open_to_paid(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(f"/api/bounties/{bid}", json={"status": "paid"})
        assert resp.status_code == 400

    def test_paid_is_terminal(self):
        b = _create_bounty()
        bid = b["id"]
        client.patch(f"/api/bounties/{bid}", json={"status": "in_progress"})
        client.patch(f"/api/bounties/{bid}", json={"status": "completed"})
        client.patch(f"/api/bounties/{bid}", json={"status": "paid"})
        for status in ["open", "in_progress", "completed"]:
            resp = client.patch(f"/api/bounties/{bid}", json={"status": status})
            assert resp.status_code == 400

    def test_in_progress_back_to_open(self):
        b = _create_bounty()
        bid = b["id"]
        client.patch(f"/api/bounties/{bid}", json={"status": "in_progress"})
        resp = client.patch(f"/api/bounties/{bid}", json={"status": "open"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "open"

    def test_completed_back_to_in_progress(self):
        b = _create_bounty()
        bid = b["id"]
        client.patch(f"/api/bounties/{bid}", json={"status": "in_progress"})
        client.patch(f"/api/bounties/{bid}", json={"status": "completed"})
        resp = client.patch(f"/api/bounties/{bid}", json={"status": "in_progress"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    def test_invalid_status_value(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.patch(f"/api/bounties/{bid}", json={"status": "invalid"})
        assert resp.status_code == 422


# ===========================================================================
# STATUS TRANSITION EXHAUSTIVE CHECK
# ===========================================================================


class TestStatusTransitions:
    """Exhaustively verify every invalid status transition is rejected."""

    def test_transition_map_integrity(self):
        assert VALID_STATUS_TRANSITIONS[BountyStatus.OPEN] == {BountyStatus.IN_PROGRESS}
        assert VALID_STATUS_TRANSITIONS[BountyStatus.PAID] == set()
        for s in BountyStatus:
            assert s in VALID_STATUS_TRANSITIONS

    def test_all_invalid_transitions_rejected(self):
        """For every (current, target) pair NOT in the allowed map, confirm 400."""
        for current in BountyStatus:
            allowed = VALID_STATUS_TRANSITIONS.get(current, set())
            for target in BountyStatus:
                if target in allowed or target == current:
                    continue
                b = _create_bounty()
                bid = b["id"]
                path = _status_path(BountyStatus.OPEN, current)
                if path is None:
                    continue
                for step in path[1:]:
                    resp = client.patch(
                        f"/api/bounties/{bid}", json={"status": step.value}
                    )
                    assert resp.status_code == 200
                resp = client.patch(
                    f"/api/bounties/{bid}", json={"status": target.value}
                )
                assert resp.status_code == 400, (
                    f"{current.value} -> {target.value} should be rejected, "
                    f"got {resp.status_code}"
                )


# ===========================================================================
# DELETE
# ===========================================================================


class TestDeleteBounty:
    def test_delete_success(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.delete(f"/api/bounties/{bid}")
        assert resp.status_code == 204
        assert client.get(f"/api/bounties/{bid}").status_code == 404

    def test_delete_not_found(self):
        assert client.delete("/api/bounties/nope").status_code == 404

    def test_delete_idempotent(self):
        b = _create_bounty()
        bid = b["id"]
        assert client.delete(f"/api/bounties/{bid}").status_code == 204
        assert client.delete(f"/api/bounties/{bid}").status_code == 404

    def test_delete_removes_from_list(self):
        b1 = _create_bounty(title="Stay bounty")
        b2 = _create_bounty(title="Remove bounty")
        bid2 = b2["id"]
        client.delete(f"/api/bounties/{bid2}")
        body = client.get("/api/bounties").json()
        assert body["total"] == 1
        assert body["items"][0]["id"] == b1["id"]

    def test_delete_does_not_affect_other_bounties(self):
        b1 = _create_bounty(title="Keep this")
        b2 = _create_bounty(title="Delete this")
        bid1 = b1["id"]
        bid2 = b2["id"]
        client.delete(f"/api/bounties/{bid2}")
        resp = client.get(f"/api/bounties/{bid1}")
        assert resp.status_code == 200
        assert resp.json()["title"] == "Keep this"


# ===========================================================================
# SUBMIT SOLUTION
# ===========================================================================


class TestSubmitSolution:
    def test_submit_success(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.post(
            f"/api/bounties/{bid}/submit",
            json={
                "pr_url": "https://github.com/org/repo/pull/42",
                "submitted_by": "alice",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["pr_url"] == "https://github.com/org/repo/pull/42"
        assert body["bounty_id"] == bid
        assert body["submitted_by"] == "alice"
        assert body["notes"] is None
        assert "id" in body
        assert "submitted_at" in body

    def test_submit_with_notes(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.post(
            f"/api/bounties/{bid}/submit",
            json={
                "pr_url": "https://github.com/org/repo/pull/1",
                "submitted_by": "bob",
                "notes": "Fixed edge case in token transfer",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["notes"] == "Fixed edge case in token transfer"

    def test_submit_bounty_not_found(self):
        resp = client.post(
            "/api/bounties/nonexistent/submit",
            json={
                "pr_url": "https://github.com/org/repo/pull/1",
                "submitted_by": "alice",
            },
        )
        assert resp.status_code == 404

    def test_submit_invalid_pr_url(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.post(
            f"/api/bounties/{bid}/submit",
            json={"pr_url": "not-a-github-url", "submitted_by": "alice"},
        )
        assert resp.status_code == 422

    def test_submit_empty_pr_url(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.post(
            f"/api/bounties/{bid}/submit",
            json={"pr_url": "", "submitted_by": "alice"},
        )
        assert resp.status_code == 422

    def test_submit_empty_submitted_by(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.post(
            f"/api/bounties/{bid}/submit",
            json={"pr_url": "https://github.com/org/repo/pull/1", "submitted_by": ""},
        )
        assert resp.status_code == 422

    def test_submit_duplicate_rejected(self):
        b = _create_bounty()
        bid = b["id"]
        url = "https://github.com/org/repo/pull/42"
        client.post(
            f"/api/bounties/{bid}/submit", json={"pr_url": url, "submitted_by": "alice"}
        )
        resp = client.post(
            f"/api/bounties/{bid}/submit", json={"pr_url": url, "submitted_by": "bob"}
        )
        assert resp.status_code == 400
        assert "already been submitted" in resp.json()["detail"]

    def test_submit_on_completed_bounty_rejected(self):
        b = _create_bounty()
        bid = b["id"]
        client.patch(f"/api/bounties/{bid}", json={"status": "in_progress"})
        client.patch(f"/api/bounties/{bid}", json={"status": "completed"})
        resp = client.post(
            f"/api/bounties/{bid}/submit",
            json={
                "pr_url": "https://github.com/org/repo/pull/99",
                "submitted_by": "alice",
            },
        )
        assert resp.status_code == 400
        assert "not accepting" in resp.json()["detail"]

    def test_submit_on_paid_bounty_rejected(self):
        b = _create_bounty()
        bid = b["id"]
        client.patch(f"/api/bounties/{bid}", json={"status": "in_progress"})
        client.patch(f"/api/bounties/{bid}", json={"status": "completed"})
        client.patch(f"/api/bounties/{bid}", json={"status": "paid"})
        resp = client.post(
            f"/api/bounties/{bid}/submit",
            json={
                "pr_url": "https://github.com/org/repo/pull/99",
                "submitted_by": "alice",
            },
        )
        assert resp.status_code == 400

    def test_submit_on_in_progress_accepted(self):
        b = _create_bounty()
        bid = b["id"]
        client.patch(f"/api/bounties/{bid}", json={"status": "in_progress"})
        resp = client.post(
            f"/api/bounties/{bid}/submit",
            json={
                "pr_url": "https://github.com/org/repo/pull/5",
                "submitted_by": "alice",
            },
        )
        assert resp.status_code == 201

    def test_multiple_submissions(self):
        b = _create_bounty()
        bid = b["id"]
        for i in range(3):
            resp = client.post(
                f"/api/bounties/{bid}/submit",
                json={
                    "pr_url": f"https://github.com/org/repo/pull/{i}",
                    "submitted_by": f"user{i}",
                },
            )
            assert resp.status_code == 201
        body = client.get(f"/api/bounties/{bid}").json()
        assert body["submission_count"] == 3
        assert len(body["submissions"]) == 3

    def test_same_pr_different_bounties_accepted(self):
        b1 = _create_bounty(title="First bounty")
        b2 = _create_bounty(title="Second bounty")
        bid1 = b1["id"]
        bid2 = b2["id"]
        url = "https://github.com/org/repo/pull/42"
        r1 = client.post(
            f"/api/bounties/{bid1}/submit",
            json={"pr_url": url, "submitted_by": "alice"},
        )
        r2 = client.post(
            f"/api/bounties/{bid2}/submit",
            json={"pr_url": url, "submitted_by": "alice"},
        )
        assert r1.status_code == 201
        assert r2.status_code == 201


# ===========================================================================
# GET SUBMISSIONS
# ===========================================================================


class TestGetSubmissions:
    def test_empty_submissions(self):
        b = _create_bounty()
        bid = b["id"]
        resp = client.get(f"/api/bounties/{bid}/submissions")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_with_data(self):
        b = _create_bounty()
        bid = b["id"]
        bounty_service.submit_solution(
            bid,
            SubmissionCreate(
                pr_url="https://github.com/org/repo/pull/1", submitted_by="alice"
            ),
        )
        bounty_service.submit_solution(
            bid,
            SubmissionCreate(
                pr_url="https://github.com/org/repo/pull/2", submitted_by="bob"
            ),
        )
        resp = client.get(f"/api/bounties/{bid}/submissions")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_not_found(self):
        resp = client.get("/api/bounties/nope/submissions")
        assert resp.status_code == 404

    def test_submission_response_shape(self):
        b = _create_bounty()
        bid = b["id"]
        bounty_service.submit_solution(
            bid,
            SubmissionCreate(
                pr_url="https://github.com/org/repo/pull/1",
                submitted_by="alice",
                notes="Test notes",
            ),
        )
        sub = client.get(f"/api/bounties/{bid}/submissions").json()[0]
        expected_keys = {
            "id",
            "bounty_id",
            "pr_url",
            "submitted_by",
            "notes",
            "submitted_at",
        }
        assert set(sub.keys()) == expected_keys


# ===========================================================================
# HEALTH CHECK (integration sanity)
# ===========================================================================


class TestHealth:
    def test_health(self):
        assert client.get("/health").json() == {"status": "ok"}
