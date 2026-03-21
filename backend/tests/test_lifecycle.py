"""Tests for bounty lifecycle engine (Issue #164)."""

from datetime import datetime, timedelta, timezone
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.lifecycle import router as lr
from app.api.bounties import router as br
from app.auth import get_current_user_id
from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.services import bounty_service as bs, lifecycle_service as ls

MOCK_USER = UserResponse(
    id="test-user-id", github_id="gh-id", username="tester",
    email="t@t.com", avatar_url="http://x.com/a.png",
    wallet_address="test-wallet", wallet_verified=True,
    created_at="2026-01-01T00:00:00Z", updated_at="2026-01-01T00:00:00Z")

a = FastAPI()
a.include_router(br)
a.include_router(lr)
a.dependency_overrides[get_current_user_id] = lambda: "test-user"
a.dependency_overrides[get_current_user] = lambda: MOCK_USER
c = TestClient(a)
B = {"title": "Lifecycle engine", "description": "SM.",
     "tier": 2, "reward_amount": 600.0, "required_skills": ["python"]}


@pytest.fixture(autouse=True)
def _clean():
    bs._bounty_store.clear(); ls._audit_log.clear(); ls._claims.clear()
    yield
    bs._bounty_store.clear(); ls._audit_log.clear(); ls._claims.clear()


def _o(**k): return c.post("/api/bounties", json={**B, **k}).json()
def _d(**k): return c.post("/api/bounties/draft", json={**B, **k}).json()
def _r(bid): return "/api/bounties/" + bid + "/review?pr_url=https://github.com/o/r/pull/1&submitted_by=a"


class TestDraftPublish:
    def test_create_draft(self):
        assert _d()["status"] == "draft"

    def test_draft_audit(self):
        assert any(e["action"] == "create_draft"
                    for e in c.get("/api/bounties/" + _d()["id"] + "/audit-log").json())

    def test_publish(self):
        d = _d()
        assert c.post("/api/bounties/" + d["id"] + "/publish").json()["new_status"] == "open"

    def test_publish_open_fails(self):
        assert c.post("/api/bounties/" + _o()["id"] + "/publish").status_code == 400

    def test_publish_404(self):
        assert c.post("/api/bounties/x/publish").status_code == 404


class TestClaim:
    def test_claim_t2(self):
        r = c.post("/api/bounties/" + _o(tier=2)["id"] + "/claim",
                    json={"claimed_by": "a", "estimated_hours": 48})
        assert r.status_code == 201 and r.json()["claimed_by"] == "a"

    def test_t1_rejected(self):
        r = c.post("/api/bounties/" + _o(tier=1)["id"] + "/claim", json={"claimed_by": "a"})
        assert r.status_code == 400 and "open-race" in r.json()["detail"]

    def test_double_claim(self):
        bid = _o(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a"})
        assert c.post("/api/bounties/" + bid + "/claim",
                       json={"claimed_by": "b"}).status_code == 400

    def test_get_claim(self):
        bid = _o(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a"})
        assert c.get("/api/bounties/" + bid + "/claim").json()["claimed_by"] == "a"

    def test_no_claim(self):
        assert c.get("/api/bounties/" + _o(tier=2)["id"] + "/claim").json().get("active") is False


class TestRelease:
    def test_release(self):
        bid = _o(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a"})
        assert c.post("/api/bounties/" + bid + "/release",
                       json={"released_by": "a"}).json()["new_status"] == "open"

    def test_release_unclaimed(self):
        assert c.post("/api/bounties/" + _o(tier=2)["id"] + "/release",
                       json={"released_by": "a"}).status_code == 400

    def test_reclaim(self):
        bid = _o(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a"})
        c.post("/api/bounties/" + bid + "/release", json={"released_by": "a"})
        assert c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "b"}).status_code == 201


class TestReviewApproveReject:
    def test_t1_review(self):
        assert c.post(_r(_o(tier=1)["id"])).json()["new_status"] == "in_review"

    def test_claimed_review(self):
        bid = _o(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a"})
        assert c.post(_r(bid)).json()["new_status"] == "in_review"

    def test_approve(self):
        bid = _o(tier=1)["id"]; c.post(_r(bid))
        assert c.post("/api/bounties/" + bid + "/approve").json()["new_status"] == "completed"

    def test_approve_open_fails(self):
        assert c.post("/api/bounties/" + _o()["id"] + "/approve").status_code == 400

    def test_reject(self):
        bid = _o(tier=1)["id"]; c.post(_r(bid))
        assert c.post("/api/bounties/" + bid + "/reject").json()["new_status"] == "open"


class TestPaid:
    def test_paid(self):
        bid = _o(tier=1)["id"]; c.post(_r(bid)); c.post("/api/bounties/" + bid + "/approve")
        assert c.post("/api/bounties/" + bid + "/paid").json()["new_status"] == "paid"

    def test_paid_open_fails(self):
        assert c.post("/api/bounties/" + _o()["id"] + "/paid").status_code == 400

    def test_paid_terminal(self):
        bid = _o(tier=1)["id"]; c.post(_r(bid))
        c.post("/api/bounties/" + bid + "/approve"); c.post("/api/bounties/" + bid + "/paid")
        assert c.post("/api/bounties/" + bid + "/approve").status_code == 400


class TestCompletedTerminal:
    def test_completed_to_paid(self):
        bid = _o(tier=1)["id"]; c.post(_r(bid)); c.post("/api/bounties/" + bid + "/approve")
        assert c.post("/api/bounties/" + bid + "/paid").json()["new_status"] == "paid"

    def test_completed_no_revert(self):
        bid = _o(tier=1)["id"]; c.post(_r(bid)); c.post("/api/bounties/" + bid + "/approve")
        assert c.post(_r(bid)).status_code == 400


class TestFullLifecycle:
    def test_t2_full(self):
        bid = _d(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/publish")
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a"})
        c.post(_r(bid)); c.post("/api/bounties/" + bid + "/approve")
        assert c.post("/api/bounties/" + bid + "/paid").json()["new_status"] == "paid"

    def test_t1_race(self):
        bid = _o(tier=1)["id"]; c.post(_r(bid)); c.post("/api/bounties/" + bid + "/approve")
        assert c.post("/api/bounties/" + bid + "/paid").status_code == 200


class TestWebhook:
    def test_opened(self):
        r = c.post("/api/bounties/" + _o(tier=1)["id"] + "/webhook-transition",
                    json={"pr_url": "https://github.com/o/r/pull/1", "pr_action": "opened", "sender": "d"})
        assert r.json()["new_status"] == "in_review"

    def test_merged(self):
        bid = _o(tier=1)["id"]
        c.post("/api/bounties/" + bid + "/webhook-transition",
               json={"pr_url": "https://github.com/o/r/pull/1", "pr_action": "opened", "sender": "d"})
        r = c.post("/api/bounties/" + bid + "/webhook-transition",
                    json={"pr_url": "https://github.com/o/r/pull/1", "pr_action": "merged", "sender": "d"})
        assert r.json()["new_status"] == "completed"

    def test_merged_open_fails(self):
        r = c.post("/api/bounties/" + _o(tier=1)["id"] + "/webhook-transition",
                    json={"pr_url": "https://github.com/o/r/pull/1", "pr_action": "merged", "sender": "d"})
        assert r.status_code == 400

    def test_closed_open_fails(self):
        r = c.post("/api/bounties/" + _o(tier=1)["id"] + "/webhook-transition",
                    json={"pr_url": "https://github.com/o/r/pull/1", "pr_action": "closed", "sender": "d"})
        assert r.status_code == 400

    def test_invalid(self):
        assert c.post("/api/bounties/" + _o()["id"] + "/webhook-transition",
                       json={"pr_url": "https://github.com/o/r/pull/1",
                             "pr_action": "invalid", "sender": "d"}).status_code == 422


class TestDeadline:
    def test_empty(self):
        assert c.post("/api/bounties/lifecycle/enforce-deadlines").json() == []

    def test_expired(self):
        bid = _o(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a", "estimated_hours": 1})
        cl = ls._claims[bid]
        cl.claimed_at = datetime.now(timezone.utc) - timedelta(hours=2)
        cl.deadline = datetime.now(timezone.utc) - timedelta(hours=1)
        w = c.post("/api/bounties/lifecycle/enforce-deadlines").json()
        assert len(w) == 1 and w[0]["action_taken"] == "auto_released"

    def test_warning(self):
        bid = _o(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a", "estimated_hours": 10})
        cl = ls._claims[bid]
        cl.claimed_at = datetime.now(timezone.utc) - timedelta(hours=8.5)
        cl.deadline = cl.claimed_at + timedelta(hours=10)
        assert c.post("/api/bounties/lifecycle/enforce-deadlines").json()[0]["action_taken"] == "warning_issued"

    def test_warning_not_repeated(self):
        bid = _o(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a", "estimated_hours": 10})
        cl = ls._claims[bid]
        cl.claimed_at = datetime.now(timezone.utc) - timedelta(hours=8.5)
        cl.deadline = cl.claimed_at + timedelta(hours=10)
        first = c.post("/api/bounties/lifecycle/enforce-deadlines").json()
        assert len(first) == 1 and first[0]["action_taken"] == "warning_issued"
        assert c.post("/api/bounties/lifecycle/enforce-deadlines").json() == []

    def test_within(self):
        bid = _o(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a", "estimated_hours": 168})
        assert c.post("/api/bounties/lifecycle/enforce-deadlines").json() == []


class TestAuditLog:
    def test_records(self):
        bid = _d(tier=2)["id"]
        c.post("/api/bounties/" + bid + "/publish")
        c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "a"})
        acts = [e["action"] for e in c.get("/api/bounties/" + bid + "/audit-log").json()]
        assert "create_draft" in acts and "publish" in acts and "claim" in acts

    def test_empty(self):
        assert c.get("/api/bounties/" + _o()["id"] + "/audit-log").json() == []

    def test_nonexistent_404(self):
        assert c.get("/api/bounties/nonexistent-id/audit-log").status_code == 404


class TestClaim404:
    def test_nonexistent_404(self):
        assert c.get("/api/bounties/nonexistent-id/claim").status_code == 404


class TestEdgeCases:
    def test_blank_claimant(self):
        bid = _o(tier=2)["id"]
        assert c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": ""}).status_code == 422
        assert c.post("/api/bounties/" + bid + "/claim", json={"claimed_by": "   "}).status_code == 422

    def test_bad_url(self):
        assert c.post("/api/bounties/" + _o()["id"] + "/webhook-transition",
                       json={"pr_url": "https://gitlab.com/o/r/1", "pr_action": "opened", "sender": "a"}).status_code == 422

    def test_hours_bounds(self):
        bid1, bid2 = _o(tier=2)["id"], _o(tier=2)["id"]
        assert c.post("/api/bounties/" + bid1 + "/claim",
                       json={"claimed_by": "a", "estimated_hours": 720}).status_code == 201
        assert c.post("/api/bounties/" + bid2 + "/claim",
                       json={"claimed_by": "a", "estimated_hours": 721}).status_code == 422

    def test_summary(self):
        assert c.get("/api/bounties/" + _d()["id"] + "/lifecycle").json()["current_status"] == "draft"
        assert c.get("/api/bounties/x/lifecycle").status_code == 404


class TestDispatch:
    def test_opened(self):
        bid = _o(tier=1)["id"]
        r, e = ls.dispatch_pr_event(bid, "opened", "https://github.com/o/r/pull/1", "bot")
        assert e is None and r["new_status"] == "in_review"

    def test_merged(self):
        bid = _o(tier=1)["id"]
        ls.dispatch_pr_event(bid, "opened", "https://github.com/o/r/pull/1", "bot")
        r, e = ls.dispatch_pr_event(bid, "merged", "https://github.com/o/r/pull/1", "bot")
        assert e is None and r["new_status"] == "completed"
