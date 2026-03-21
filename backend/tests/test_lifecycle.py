"""Lifecycle engine tests (#164)."""
import hashlib, hmac, json, os, threading
from datetime import datetime, timedelta, timezone
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.auth import get_current_user
from app.api.lifecycle import router
from app.models.bounty import BountyCreate
from app.models.user import UserResponse as UR
from app.services import bounty_service as BS, lifecycle_service as LS
LSt = LS.LifecycleState

_D = dict(avatar_url="http://x", wallet_verified=True, created_at="2026-03-20T00:00:00Z", updated_at="2026-03-20T00:00:00Z")
MU = UR(id="u1", github_id="g1", username="t", email="t@t.com", wallet_address="tw", **_D)
MC = UR(id="u2", github_id="g2", username="c", email="c@t.com", wallet_address="cw", **_D)
async def _mu(): return MU
async def _mc(): return MC
_app = FastAPI(); _app.include_router(router, prefix="/api")
_app.dependency_overrides[get_current_user] = _mu; C = TestClient(_app)
_ca = FastAPI(); _ca.include_router(router, prefix="/api")
_ca.dependency_overrides[get_current_user] = _mc; CC = TestClient(_ca)
def _b(t=1, by="system"):
    return BS.create_bounty(BountyCreate(title="Tst", description="Desc", tier=t, reward_amount=100.0, required_skills=["py"], created_by=by)).id
_I, _O, _K, _R = LS.initialize_bounty, LS.open_bounty, LS.claim_bounty, LS.submit_for_review
_CO, _PA, _CA, _RE, _H = LS.complete_bounty, LS.pay_bounty, LS.cancel_bounty, LS.release_claim, LS.handle_pr_event
_GC, _GL, _GA, _IP, _ED = LS.get_claim, LS.get_lifecycle_state, LS.get_audit_log, LS.is_bounty_participant, LS.enforce_deadlines
def _io(b, a="system"): _I(b, a); return _O(b, a)
L = "/api/lifecycle/"
def J(b, **kw): return {"bounty_id": b, **kw}
@pytest.fixture(autouse=True)
def _clean():
    BS._bounty_store.clear(); LS.clear_stores(); yield; BS._bounty_store.clear(); LS.clear_stores()

def test_full_path_and_t1():
    b = _b(); assert _I(b).new_state == "draft"
    assert _O(b).new_state == "open"
    assert _K(b, "c1").contributor_id == "c1"
    assert _R(b, "c1").new_state == "in_review"
    assert _CO(b).new_state == "completed"
    assert _PA(b).new_state == "paid"
    b2 = _b(); _io(b2); assert _R(b2, "x").new_state == "in_review"

def test_cancel_terminal_notfound():
    for s in [lambda b: None, lambda b: _O(b), lambda b: (_O(b), _K(b, "c")), lambda b: (_O(b), _R(b, "c"))]:
        b = _b(); _I(b); s(b); assert _CA(b).new_state == "cancelled"
    b = _b(); _io(b); _K(b, "c"); _CA(b); assert _GC(b) is None
    b = _b(); _io(b); _R(b, "c"); _CO(b); _PA(b)
    with pytest.raises(LS.TerminalStateError): _O(b)
    with pytest.raises(LS.BountyNotFoundError): _I("x")
    with pytest.raises(LS.BountyNotFoundError): _GL("x")

@pytest.mark.parametrize("a,s", [("K", lambda b: None), ("P", lambda b: _O(b)), ("C", lambda b: _O(b)), ("R", lambda b: None)])
def test_invalid(a, s):
    b = _b(); _I(b); s(b)
    fn = {"K": lambda: _K(b, "c"), "P": lambda: _PA(b), "C": lambda: _CO(b), "R": lambda: _R(b, "c")}
    with pytest.raises(LS.InvalidTransitionError): fn[a]()

def test_claims_gates_ownership():
    b = _b(); _io(b)
    assert _K(b, "c1").deadline > datetime.now(timezone.utc)
    with pytest.raises(LS.ClaimConflictError): _K(b, "c2")
    with pytest.raises(LS.ClaimNotFoundError): _R(b, "bad")
    _RE(b, "c1"); assert _GC(b) is None
    assert _K(b, "c2").contributor_id == "c2"
    for t in [2, 3]:
        bt = _b(t); _io(bt)
        with pytest.raises(LS.TierGateError): _K(bt, "x", bounty_tier=t)
    b2 = _b(by="ow"); _io(b2); _R(b2, "c")
    with pytest.raises(LS.OwnershipError): _CO(b2, actor="bad")
    assert _CO(b2, actor="ow").new_state == "completed"
    with pytest.raises(LS.OwnershipError): _PA(b2, actor="bad")
    assert _PA(b2, actor="ow").new_state == "paid"
    b3 = _b(by="ow"); _io(b3)
    with pytest.raises(LS.OwnershipError): _CA(b3, actor="bad")
    assert _CA(b3, actor="ow").new_state == "cancelled"
    b4 = _b(by="ow"); _io(b4); _K(b4, "c")
    with pytest.raises(LS.ClaimNotFoundError): _RE(b4, actor="stranger")
    _RE(b4, actor="c"); _K(b4, "c2")
    _RE(b4, actor="ow"); assert _GC(b4) is None
    b5 = _b(by="someone"); _io(b5); _R(b5, "c")
    assert _CO(b5, actor="system").new_state == "completed"

def test_deadlines():
    b = _b(); _io(b); _K(b, "c"); n = datetime.now(timezone.utc)
    with LS._state_lock:
        c = LS._claims[b]; c.claimed_at = n - timedelta(hours=100); c.deadline = n - timedelta(hours=1)
    assert _ED().claims_released == 1; assert _GL(b) == LSt.OPEN
    b2 = _b(); _io(b2); _K(b2, "c")
    with LS._state_lock:
        c = LS._claims[b2]; c.claimed_at = n - timedelta(hours=60); c.deadline = n + timedelta(hours=12)
    r = _ED(); assert r.warnings_issued >= 1 and r.claims_released == 0

def test_webhooks():
    b = _b(); _io(b)
    assert _H(b, "opened", "u", "d").new_state == "in_review"
    assert _H(b, "closed", "u", "d", merged=True).new_state == "completed"
    b2 = _b(); _io(b2); _R(b2, "d")
    assert _H(b2, "closed", "u", "d").new_state == "open"
    b3 = _b(); _I(b3); _CA(b3)
    assert _H(b3, "opened", "u", "d") is None
    assert _H("x", "opened", "u", "d") is None
    b4 = _b(); _io(b4); _K(b4, "c1")
    assert _H(b4, "opened", "u", "wrong") is None
    assert _H(b4, "opened", "u", "c1").new_state == "in_review"

def test_audit_and_threads():
    b = _b(); _io(b); _CA(b)
    log = _GA(bounty_id=b)
    assert len(log) >= 3 and {"initialize","open","cancel"} <= {e.event_type for e in log}
    assert len(_GA(bounty_id=b, limit=2)) == 2
    b2 = _b(); _I(b2); assert {b, b2} <= {e.bounty_id for e in _GA()}
    b3 = _b(); _I(b3, actor="a"); _O(b3); _K(b3, "c")
    assert all(e.actor == "c" for e in _GA(actor_filter="c"))
    b4 = _b(by="ow"); _io(b4, "ow"); _K(b4, "c")
    assert _IP(b4, "ow") and _IP(b4, "c")
    assert not _IP(b4, "stranger")
    assert _I(b).event_type == "initialize_idempotent"
    bt = _b(); _io(bt); r = {"ok":0,"f":0}; lk = threading.Lock()
    def go(i):
        try: _K(bt, f"c{i}"); lk.acquire(); r["ok"]+=1; lk.release()
        except (LS.ClaimConflictError, LS.InvalidTransitionError): lk.acquire(); r["f"]+=1; lk.release()
    ts = [threading.Thread(target=go, args=(i,)) for i in range(5)]
    for t in ts: t.start()
    for t in ts: t.join()
    assert r["ok"] == 1 and r["f"] == 4

def test_api_flow():
    b = _b(); _I(b); P = C.post; G = C.get
    assert P(L+"open", json=J(b)).json()["new_state"] == "open"
    r = P(L+"claim", json=J(b, bounty_tier=1)); assert r.status_code == 200 and r.json()["state"] == "claimed"
    assert P(L+"release", json=J(b)).json()["new_state"] == "open"
    assert P(L+"review", json=J(b, pr_url="u")).json()["new_state"] == "in_review"
    assert P(L+"complete", json=J(b)).json()["new_state"] == "completed"
    assert P(L+"pay", json=J(b)).json()["new_state"] == "paid"
    b2 = _b(); _io(b2); r = G(f"{L}{b2}/state").json()
    assert r["state"] == "open" and not r["has_active_claim"]
    _K(b2, "c1"); r = G(f"{L}{b2}/state").json()
    assert r["has_active_claim"] and r["claim"]["contributor_id"] == "c1"
    assert P(L+"initialize", json=J("x")).status_code == 404
    b3 = _b(); _I(b3); _CA(b3)
    assert P(L+"open", json=J(b3)).status_code == 409
    b4 = _b(); _io(b4); assert P(L+"pay", json=J(b4)).status_code == 400
    b5 = _b(2); _io(b5); assert P(L+"claim", json=J(b5, bounty_tier=2)).status_code == 403
    b6 = _b(by="cw"); _io(b6); _R(b6, "tw")
    assert P(L+"complete", json=J(b6)).status_code == 403
    assert CC.post(L+"complete", json=J(b6)).status_code == 200
    b7 = _b(); _io(b7)
    assert P(L+"webhook/pr", json=J(b7, action="opened", pr_url="u", sender="d", merged=False)).status_code in (401, 503)
    b8 = _b(); _io(b8, "tw"); assert G(f"{L}{b8}/audit").status_code == 200
    r = G(L+"audit"); assert r.status_code == 200
    for e in r.json(): assert e["actor"] == "tw"
    assert P(L+"deadlines/enforce").status_code == 200

def test_api_webhook_hmac():
    b = _b(); _io(b); os.environ["GITHUB_WEBHOOK_SECRET"] = "s"
    import importlib; from app.api import lifecycle as lm; importlib.reload(lm)
    app = FastAPI(); app.include_router(lm.router, prefix="/api"); tc = TestClient(app)
    p = json.dumps(J(b, action="opened", pr_url="u", sender="d", merged=False)).encode()
    sig = "sha256=" + hmac.new(b"s", p, hashlib.sha256).hexdigest()
    assert tc.post(L+"webhook/pr", content=p, headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig}).status_code == 200
    os.environ.pop("GITHUB_WEBHOOK_SECRET", None); importlib.reload(lm)
