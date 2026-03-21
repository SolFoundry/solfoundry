"""Lifecycle engine tests (Issue #164).

Covers: full lifecycle path, T1 open-race, T2/T3 tier gating, claim conflict/
release/ownership, terminal states, invalid transitions, deadline enforcement
(80% warn + 100% release), webhook PR events, audit log + participant access,
idempotent init, thread safety, all API endpoints + error codes, HMAC webhook.
"""
import hashlib, hmac, json, os, threading
from datetime import datetime, timedelta, timezone
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.auth import get_current_user
from app.api.lifecycle import router
from app.models.bounty import BountyCreate
from app.models.user import UserResponse
from app.services import bounty_service as bs, lifecycle_service as ls
State = ls.LifecycleState

_UF = dict(avatar_url="https://x.com/a.png", wallet_verified=True,
           created_at="2026-03-20T00:00:00Z", updated_at="2026-03-20T00:00:00Z")
CREATOR = UserResponse(id="u-creator", github_id="gh-c", username="creator",
                        email="c@t.com", wallet_address="creator-wallet", **_UF)
CONTRIB = UserResponse(id="u-contrib", github_id="gh-b", username="contrib",
                        email="b@t.com", wallet_address="contrib-wallet", **_UF)
async def _auth_creator(): return CREATOR
async def _auth_contrib(): return CONTRIB

app_cr = FastAPI(); app_cr.include_router(router, prefix="/api")
app_cr.dependency_overrides[get_current_user] = _auth_creator
cc = TestClient(app_cr)  # creator client

app_co = FastAPI(); app_co.include_router(router, prefix="/api")
app_co.dependency_overrides[get_current_user] = _auth_contrib
co = TestClient(app_co)  # contributor client

BASE = "/api/lifecycle/"
init = ls.initialize_bounty
open_b = ls.open_bounty
claim = ls.claim_bounty
review = ls.submit_for_review
complete = ls.complete_bounty
pay = ls.pay_bounty
cancel = ls.cancel_bounty
release = ls.release_claim
webhook = ls.handle_pr_event
deadlines = ls.enforce_deadlines

def bounty(tier=1, by="system"):
    """Create a test bounty and return its ID."""
    return bs.create_bounty(BountyCreate(title="Test Bounty", description="Lifecycle test",
        tier=tier, reward_amount=100.0, required_skills=["python"], created_by=by)).id

def init_open(bid, actor="system"):
    """Initialise and open a bounty."""
    init(bid, actor); open_b(bid, actor)

def body(bid, **kw):
    return {"bounty_id": bid, **kw}

@pytest.fixture(autouse=True)
def _clean():
    bs._bounty_store.clear(); ls.clear_stores()
    yield
    bs._bounty_store.clear(); ls.clear_stores()


# -- Full lifecycle path --

def test_full_lifecycle_draft_to_paid():
    """Full happy path: draft -> open -> claimed -> in_review -> completed -> paid."""
    bid = bounty()
    assert init(bid).new_state == "draft"
    assert open_b(bid).new_state == "open"
    assert claim(bid, "c1").contributor_id == "c1"
    assert review(bid, "c1").new_state == "in_review"
    assert complete(bid).new_state == "completed"
    assert pay(bid).new_state == "paid"

def test_t1_open_race():
    """T1 open-race: any contributor submits directly from OPEN without claiming."""
    bid = bounty(); init_open(bid)
    assert review(bid, "anyone").new_state == "in_review"


# -- Cancel + terminal enforcement --

def test_cancel_from_all_non_terminal_states():
    """Cancel is reachable from draft, open, claimed, and in_review."""
    for setup in [lambda b: None, lambda b: open_b(b),
                  lambda b: (open_b(b), claim(b, "c")),
                  lambda b: (open_b(b), review(b, "c"))]:
        bid = bounty(); init(bid); setup(bid)
        assert cancel(bid).new_state == "cancelled"

def test_cancel_releases_active_claim():
    bid = bounty(); init_open(bid); claim(bid, "c1"); cancel(bid)
    assert ls.get_claim(bid) is None

def test_terminal_states_reject_transitions():
    """PAID and CANCELLED reject all further mutations."""
    bid = bounty(); init_open(bid); review(bid, "c"); complete(bid); pay(bid)
    with pytest.raises(ls.TerminalStateError): open_b(bid)
    bid2 = bounty(); init_open(bid2); cancel(bid2)
    with pytest.raises(ls.TerminalStateError): open_b(bid2)

def test_bounty_not_found():
    with pytest.raises(ls.BountyNotFoundError): init("nonexistent")
    with pytest.raises(ls.BountyNotFoundError): ls.get_lifecycle_state("nonexistent")

@pytest.mark.parametrize("op,setup", [
    ("claim", []), ("pay", ["open"]), ("complete", ["open"]), ("review", [])])
def test_invalid_transitions(op, setup):
    """Operations that skip intermediate states raise InvalidTransitionError."""
    bid = bounty(); init(bid)
    for step in setup:
        if step == "open": open_b(bid)
    ops = {"claim": lambda: claim(bid, "c"), "pay": lambda: pay(bid),
           "complete": lambda: complete(bid), "review": lambda: review(bid, "c")}
    with pytest.raises(ls.InvalidTransitionError): ops[op]()


# -- Claims, tier gates, ownership --

def test_claim_sets_future_deadline():
    bid = bounty(); init_open(bid)
    assert claim(bid, "c1").deadline > datetime.now(timezone.utc)

def test_claim_conflict():
    bid = bounty(); init_open(bid); claim(bid, "c1")
    with pytest.raises(ls.ClaimConflictError): claim(bid, "c2")

def test_release_by_stranger_forbidden():
    bid = bounty(); init_open(bid); claim(bid, "c1")
    with pytest.raises(ls.ClaimNotFoundError): release(bid, "stranger")

def test_claimant_releases_own_claim():
    bid = bounty(); init_open(bid); claim(bid, "c1"); release(bid, "c1")
    assert ls.get_claim(bid) is None
    assert claim(bid, "c2").contributor_id == "c2"

def test_tier_gates():
    """T2 and T3 bounties reject unqualified contributors."""
    for tier in [2, 3]:
        bid = bounty(tier=tier); init_open(bid)
        with pytest.raises(ls.TierGateError): claim(bid, "newcomer", bounty_tier=tier)

def test_ownership_checks():
    """Complete, pay, and cancel require bounty creator (or system/treasury)."""
    bid = bounty(by="owner"); init_open(bid); review(bid, "c")
    with pytest.raises(ls.OwnershipError): complete(bid, actor="bad")
    assert complete(bid, actor="owner").new_state == "completed"
    with pytest.raises(ls.OwnershipError): pay(bid, actor="bad")
    assert pay(bid, actor="owner").new_state == "paid"
    bid2 = bounty(by="owner"); init_open(bid2)
    with pytest.raises(ls.OwnershipError): cancel(bid2, actor="bad")
    assert cancel(bid2, actor="owner").new_state == "cancelled"

def test_creator_and_system_claim_release():
    """Creator can release any claim; stranger cannot; system bypasses ownership."""
    bid = bounty(by="owner"); init_open(bid); claim(bid, "c1")
    with pytest.raises(ls.ClaimNotFoundError): release(bid, actor="stranger")
    release(bid, actor="c1"); claim(bid, "c2")
    release(bid, actor="owner"); assert ls.get_claim(bid) is None
    bid2 = bounty(by="someone"); init_open(bid2); review(bid2, "c")
    assert complete(bid2, actor="system").new_state == "completed"


# -- Deadline enforcement --

def test_deadline_auto_release():
    bid = bounty(); init_open(bid); claim(bid, "c"); now = datetime.now(timezone.utc)
    with ls._state_lock:
        c = ls._claims[bid]; c.claimed_at = now - timedelta(hours=100); c.deadline = now - timedelta(hours=1)
    assert deadlines().claims_released == 1
    assert ls.get_lifecycle_state(bid) == State.OPEN

def test_deadline_warning_at_80_percent():
    bid = bounty(); init_open(bid); claim(bid, "c"); now = datetime.now(timezone.utc)
    with ls._state_lock:
        c = ls._claims[bid]; c.claimed_at = now - timedelta(hours=60); c.deadline = now + timedelta(hours=12)
    result = deadlines()
    assert result.warnings_issued >= 1 and result.claims_released == 0


# -- Webhook PR events --

def test_webhook_pr_opened():
    bid = bounty(); init_open(bid)
    assert webhook(bid, "opened", "url", "dev").new_state == "in_review"

def test_webhook_pr_merged():
    bid = bounty(); init_open(bid)
    webhook(bid, "opened", "url", "dev")
    assert webhook(bid, "closed", "url", "dev", merged=True).new_state == "completed"

def test_webhook_pr_closed_no_merge():
    bid = bounty(); init_open(bid); review(bid, "dev")
    assert webhook(bid, "closed", "url", "dev").new_state == "open"

def test_webhook_terminal_and_not_found():
    bid = bounty(); init(bid); cancel(bid)
    assert webhook(bid, "opened", "url", "dev") is None
    assert webhook("nonexistent", "opened", "url", "dev") is None

def test_webhook_sender_mismatch_on_claimed():
    """PR by non-claimant on claimed bounty is ignored; claimant proceeds."""
    bid = bounty(); init_open(bid); claim(bid, "c1")
    assert webhook(bid, "opened", "url", "wrong") is None
    assert webhook(bid, "opened", "url", "c1").new_state == "in_review"


# -- Audit log and participation --

def test_audit_log():
    bid = bounty(); init_open(bid); cancel(bid)
    log = ls.get_audit_log(bounty_id=bid)
    assert {"initialize", "open", "cancel"} <= {e.event_type for e in log}
    assert len(ls.get_audit_log(bounty_id=bid, limit=2)) == 2
    bid2 = bounty(); init(bid2)
    assert {bid, bid2} <= {e.bounty_id for e in ls.get_audit_log()}

def test_audit_actor_filter():
    bid = bounty(); init(bid, actor="admin"); open_b(bid); claim(bid, "c")
    assert all(e.actor == "c" for e in ls.get_audit_log(actor_filter="c"))

def test_participant_check():
    bid = bounty(by="owner"); init_open(bid, "owner"); claim(bid, "c")
    assert ls.is_bounty_participant(bid, "owner") and ls.is_bounty_participant(bid, "c")
    assert not ls.is_bounty_participant(bid, "stranger")

def test_idempotent_init():
    bid = bounty(); init(bid)
    assert init(bid).event_type == "initialize_idempotent"


# -- Thread safety --

def test_concurrent_claims():
    """Of 5 concurrent claim attempts, exactly 1 succeeds."""
    bid = bounty(); init_open(bid)
    results = {"ok": 0, "fail": 0}; lock = threading.Lock()
    def attempt(i):
        try: claim(bid, f"c{i}"); lock.acquire(); results["ok"] += 1; lock.release()
        except (ls.ClaimConflictError, ls.InvalidTransitionError): lock.acquire(); results["fail"] += 1; lock.release()
    threads = [threading.Thread(target=attempt, args=(i,)) for i in range(5)]
    for t in threads: t.start()
    for t in threads: t.join()
    assert results["ok"] == 1 and results["fail"] == 4


# -- API: full endpoint coverage --

def test_api_full_lifecycle():
    bid = bounty(); init(bid); P, G = cc.post, cc.get
    assert P(BASE + "open", json=body(bid)).json()["new_state"] == "open"
    r = P(BASE + "claim", json=body(bid, bounty_tier=1))
    assert r.status_code == 200 and r.json()["state"] == "claimed"
    assert P(BASE + "release", json=body(bid)).json()["new_state"] == "open"
    assert P(BASE + "review", json=body(bid, pr_url="u")).json()["new_state"] == "in_review"
    assert P(BASE + "complete", json=body(bid)).json()["new_state"] == "completed"
    assert P(BASE + "pay", json=body(bid)).json()["new_state"] == "paid"

def test_api_state_query():
    bid = bounty(); init_open(bid)
    r = cc.get(f"{BASE}{bid}/state").json()
    assert r["state"] == "open" and not r["has_active_claim"]
    claim(bid, "c1"); r = cc.get(f"{BASE}{bid}/state").json()
    assert r["has_active_claim"] and r["claim"]["contributor_id"] == "c1"

def test_api_error_codes():
    """404 not found, 409 terminal, 400 invalid, 403 tier gate."""
    assert cc.post(BASE + "initialize", json=body("x")).status_code == 404
    bid = bounty(); init(bid); cancel(bid)
    assert cc.post(BASE + "open", json=body(bid)).status_code == 409
    bid2 = bounty(); init_open(bid2)
    assert cc.post(BASE + "pay", json=body(bid2)).status_code == 400
    bid3 = bounty(tier=2); init_open(bid3)
    assert cc.post(BASE + "claim", json=body(bid3, bounty_tier=2)).status_code == 403

def test_api_ownership():
    """Non-creator blocked; actual creator succeeds."""
    bid = bounty(by="contrib-wallet"); init_open(bid); review(bid, "creator-wallet")
    assert cc.post(BASE + "complete", json=body(bid)).status_code == 403
    assert co.post(BASE + "complete", json=body(bid)).status_code == 200

def test_api_webhook_rejects_without_secret():
    bid = bounty(); init_open(bid)
    assert cc.post(BASE + "webhook/pr", json=body(bid, action="opened", pr_url="u", sender="d", merged=False)).status_code in (401, 503)

def test_api_audit():
    bid = bounty(); init_open(bid, "creator-wallet")
    assert cc.get(f"{BASE}{bid}/audit").status_code == 200
    r = cc.get(BASE + "audit"); assert r.status_code == 200
    for e in r.json(): assert e["actor"] == "creator-wallet"

def test_api_deadline_enforcement():
    assert cc.post(BASE + "deadlines/enforce").status_code == 200


# -- HMAC webhook verification --

def test_webhook_valid_hmac():
    bid = bounty(); init_open(bid)
    os.environ["GITHUB_WEBHOOK_SECRET"] = "s"
    import importlib; from app.api import lifecycle as lm; importlib.reload(lm)
    app = FastAPI(); app.include_router(lm.router, prefix="/api"); tc = TestClient(app)
    p = json.dumps(body(bid, action="opened", pr_url="u", sender="d", merged=False)).encode()
    sig = "sha256=" + hmac.new(b"s", p, hashlib.sha256).hexdigest()
    assert tc.post(BASE + "webhook/pr", content=p, headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig}).status_code == 200
    os.environ.pop("GITHUB_WEBHOOK_SECRET", None); importlib.reload(lm)

def test_webhook_bad_hmac():
    bid = bounty(); init_open(bid)
    os.environ["GITHUB_WEBHOOK_SECRET"] = "s"
    import importlib; from app.api import lifecycle as lm; importlib.reload(lm)
    app = FastAPI(); app.include_router(lm.router, prefix="/api"); tc = TestClient(app)
    p = json.dumps(body(bid, action="opened", pr_url="u", sender="d", merged=False)).encode()
    bad_sig = "sha256=" + hmac.new(b"wrong", p, hashlib.sha256).hexdigest()
    assert tc.post(BASE + "webhook/pr", content=p, headers={"Content-Type": "application/json", "X-Hub-Signature-256": bad_sig}).status_code == 401
    os.environ.pop("GITHUB_WEBHOOK_SECRET", None); importlib.reload(lm)

def test_webhook_missing_signature():
    bid = bounty(); init_open(bid)
    os.environ["GITHUB_WEBHOOK_SECRET"] = "s"
    import importlib; from app.api import lifecycle as lm; importlib.reload(lm)
    app = FastAPI(); app.include_router(lm.router, prefix="/api"); tc = TestClient(app)
    p = json.dumps(body(bid, action="opened", pr_url="u", sender="d", merged=False)).encode()
    assert tc.post(BASE + "webhook/pr", content=p, headers={"Content-Type": "application/json"}).status_code == 401
    os.environ.pop("GITHUB_WEBHOOK_SECRET", None); importlib.reload(lm)
