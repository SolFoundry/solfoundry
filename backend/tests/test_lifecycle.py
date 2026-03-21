"""Tests for bounty lifecycle engine (Issue #164)."""
import threading
from datetime import datetime, timedelta, timezone
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.auth import get_current_user
from app.api.lifecycle import router
from app.models.bounty import BountyCreate
from app.models.user import UserResponse
from app.services import bounty_service as BS, lifecycle_service as LS
from app.services.lifecycle_service import (
    BountyNotFoundError, ClaimConflictError, ClaimNotFoundError,
    InvalidTransitionError, LifecycleState, TerminalStateError, TierGateError)

MU = UserResponse(id="u1", github_id="g1", username="tst", email="t@t.com",
    avatar_url="http://x/a.png", wallet_address="tw", wallet_verified=True,
    created_at="2026-03-20T00:00:00Z", updated_at="2026-03-20T00:00:00Z")
async def _mu(): return MU
_app = FastAPI(); _app.include_router(router, prefix="/api")
_app.dependency_overrides[get_current_user] = _mu; C = TestClient(_app)

def _b(t=1):
    return BS.create_bounty(BountyCreate(title="Test bounty", description="Desc",
        tier=t, reward_amount=100.0, required_skills=["python"])).id
@pytest.fixture(autouse=True)
def _c():
    BS._bounty_store.clear(); LS.clear_stores(); yield
    BS._bounty_store.clear(); LS.clear_stores()

def test_full_path():
    b = _b(); assert LS.initialize_bounty(b).new_state == "draft"
    assert LS.open_bounty(b).new_state == "open"
    assert LS.claim_bounty(b, "c1").contributor_id == "c1"
    assert LS.submit_for_review(b, "c1").new_state == "in_review"
    assert LS.complete_bounty(b).new_state == "completed"
    assert LS.pay_bounty(b).new_state == "paid"

def test_t1_open_race():
    b = _b(); LS.initialize_bounty(b); LS.open_bounty(b)
    assert LS.submit_for_review(b, "x").new_state == "in_review"

def test_cancel_and_releases():
    for s in [lambda b: None, lambda b: LS.open_bounty(b),
              lambda b: (LS.open_bounty(b), LS.claim_bounty(b, "c")),
              lambda b: (LS.open_bounty(b), LS.submit_for_review(b, "c"))]:
        b = _b(); LS.initialize_bounty(b); s(b)
        assert LS.cancel_bounty(b).new_state == "cancelled"
    b = _b(); LS.initialize_bounty(b); LS.open_bounty(b)
    LS.claim_bounty(b, "c"); LS.cancel_bounty(b); assert LS.get_claim(b) is None

def test_terminal():
    b = _b(); LS.initialize_bounty(b); LS.open_bounty(b)
    LS.submit_for_review(b, "c"); LS.complete_bounty(b); LS.pay_bounty(b)
    with pytest.raises(TerminalStateError): LS.open_bounty(b)
    with pytest.raises(TerminalStateError): LS.claim_bounty(b, "x")
    b2 = _b(); LS.initialize_bounty(b2); LS.cancel_bounty(b2)
    with pytest.raises(TerminalStateError): LS.open_bounty(b2)
    b3 = _b(); LS.initialize_bounty(b3); LS.open_bounty(b3)
    LS.submit_for_review(b3, "c"); LS.complete_bounty(b3)
    with pytest.raises(InvalidTransitionError): LS.cancel_bounty(b3)

@pytest.mark.parametrize("a,s", [("claim", lambda b: None), ("pay", lambda b: LS.open_bounty(b)),
    ("complete", lambda b: LS.open_bounty(b)), ("review", lambda b: None)])
def test_invalid(a, s):
    b = _b(); LS.initialize_bounty(b); s(b)
    fn = {"claim": lambda: LS.claim_bounty(b, "c"), "pay": lambda: LS.pay_bounty(b),
          "complete": lambda: LS.complete_bounty(b), "review": lambda: LS.submit_for_review(b, "c")}
    with pytest.raises(InvalidTransitionError): fn[a]()

def test_not_found():
    with pytest.raises(BountyNotFoundError): LS.initialize_bounty("x")
    with pytest.raises(BountyNotFoundError): LS.get_lifecycle_state("x")

def test_claims_and_gates():
    b = _b(); LS.initialize_bounty(b); LS.open_bounty(b)
    assert LS.get_claim(b) is None
    assert LS.claim_bounty(b, "c1").deadline > datetime.now(timezone.utc)
    with pytest.raises(ClaimConflictError): LS.claim_bounty(b, "c2")
    with pytest.raises(ClaimNotFoundError): LS.submit_for_review(b, "bad")
    LS.release_claim(b, "c1"); assert LS.get_claim(b) is None
    assert LS.claim_bounty(b, "c2").contributor_id == "c2"
    for t in [2, 3]:
        bt = _b(t); LS.initialize_bounty(bt); LS.open_bounty(bt)
        with pytest.raises(TierGateError): LS.claim_bounty(bt, "x", bounty_tier=t)

def test_deadlines():
    b = _b(); LS.initialize_bounty(b); LS.open_bounty(b); LS.claim_bounty(b, "c")
    with LS._state_lock:
        c = LS._claims[b]; c.claimed_at = datetime.now(timezone.utc) - timedelta(hours=100)
        c.deadline = datetime.now(timezone.utc) - timedelta(hours=1)
    assert LS.enforce_deadlines().claims_released == 1
    assert LS.get_lifecycle_state(b) == LifecycleState.OPEN
    b2 = _b(); LS.initialize_bounty(b2); LS.open_bounty(b2); LS.claim_bounty(b2, "c")
    with LS._state_lock:
        c = LS._claims[b2]; c.claimed_at = datetime.now(timezone.utc) - timedelta(hours=60)
        c.deadline = datetime.now(timezone.utc) + timedelta(hours=12)
    r = LS.enforce_deadlines(); assert r.warnings_issued >= 1 and r.claims_released == 0

def test_webhooks():
    b = _b(); LS.initialize_bounty(b); LS.open_bounty(b)
    assert LS.handle_pr_event(b, "opened", "u", "d").new_state == "in_review"
    assert LS.handle_pr_event(b, "closed", "u", "d", merged=True).new_state == "completed"
    b2 = _b(); LS.initialize_bounty(b2); LS.open_bounty(b2); LS.submit_for_review(b2, "d")
    assert LS.handle_pr_event(b2, "closed", "u", "d").new_state == "open"
    b3 = _b(); LS.initialize_bounty(b3); LS.cancel_bounty(b3)
    assert LS.handle_pr_event(b3, "opened", "u", "d") is None
    assert LS.handle_pr_event("x", "opened", "u", "d") is None
    b4 = _b(); LS.initialize_bounty(b4); LS.open_bounty(b4); LS.claim_bounty(b4, "c1")
    assert LS.handle_pr_event(b4, "opened", "u", "wrong") is None
    assert LS.handle_pr_event(b4, "opened", "u", "c1").new_state == "in_review"

def test_audit():
    b = _b(); LS.initialize_bounty(b); LS.open_bounty(b); LS.cancel_bounty(b)
    log = LS.get_audit_log(bounty_id=b)
    assert len(log) >= 3 and {"initialize","open","cancel"} <= {e.event_type for e in log}
    assert log[0].created_at >= log[-1].created_at
    assert len(LS.get_audit_log(bounty_id=b, limit=2)) == 2
    b2 = _b(); LS.initialize_bounty(b2)
    assert {b, b2} <= {e.bounty_id for e in LS.get_audit_log()}

def test_idempotent():
    b = _b(); LS.initialize_bounty(b)
    assert LS.initialize_bounty(b).event_type == "initialize_idempotent"

def test_thread_safety():
    b = _b(); LS.initialize_bounty(b); LS.open_bounty(b)
    r = {"ok":0,"f":0}; lk = threading.Lock()
    def go(i):
        try: LS.claim_bounty(b, f"c{i}"); lk.acquire(); r["ok"]+=1; lk.release()
        except (ClaimConflictError, InvalidTransitionError): lk.acquire(); r["f"]+=1; lk.release()
    ts = [threading.Thread(target=go, args=(i,)) for i in range(5)]
    for t in ts: t.start()
    for t in ts: t.join()
    assert r["ok"] == 1 and r["f"] == 4

def test_api_flow():
    b = _b(); LS.initialize_bounty(b)
    assert C.post("/api/lifecycle/open", json={"bounty_id": b}).json()["new_state"] == "open"
    r = C.post("/api/lifecycle/claim", json={"bounty_id": b, "bounty_tier": 1})
    assert r.status_code == 200 and r.json()["state"] == "claimed"
    assert C.post("/api/lifecycle/release", json={"bounty_id": b}).json()["new_state"] == "open"
    assert C.post("/api/lifecycle/review", json={"bounty_id": b, "pr_url": "u"}).json()["new_state"] == "in_review"
    assert C.post("/api/lifecycle/complete", json={"bounty_id": b}).json()["new_state"] == "completed"
    assert C.post("/api/lifecycle/pay", json={"bounty_id": b}).json()["new_state"] == "paid"

def test_api_state_audit_errors():
    b = _b(); LS.initialize_bounty(b); LS.open_bounty(b)
    r = C.get(f"/api/lifecycle/{b}/state").json()
    assert r["state"] == "open" and not r["has_active_claim"]
    LS.claim_bounty(b, "c1"); r = C.get(f"/api/lifecycle/{b}/state").json()
    assert r["has_active_claim"] and r["claim"]["contributor_id"] == "c1"
    assert len(C.get(f"/api/lifecycle/{b}/audit").json()) >= 3
    assert len(C.get("/api/lifecycle/audit").json()) >= 3
    assert C.post("/api/lifecycle/initialize", json={"bounty_id": "x"}).status_code == 404
    b2 = _b(); LS.initialize_bounty(b2); LS.cancel_bounty(b2)
    assert C.post("/api/lifecycle/open", json={"bounty_id": b2}).status_code == 409
    b3 = _b(); LS.initialize_bounty(b3); LS.open_bounty(b3)
    assert C.post("/api/lifecycle/pay", json={"bounty_id": b3}).status_code == 400
    b4 = _b(2); LS.initialize_bounty(b4); LS.open_bounty(b4)
    assert C.post("/api/lifecycle/claim", json={"bounty_id": b4, "bounty_tier": 2}).status_code == 403
    LS.claim_bounty(b3, "other")
    assert C.post("/api/lifecycle/claim", json={"bounty_id": b3, "bounty_tier": 1}).status_code == 409

def test_api_wh_cron():
    b = _b(); LS.initialize_bounty(b); LS.open_bounty(b)
    assert C.post("/api/lifecycle/webhook/pr", json={
        "bounty_id": b, "action": "opened", "pr_url": "u", "sender": "d", "merged": False}).status_code == 200
    assert C.post("/api/lifecycle/deadlines/enforce").status_code == 200
