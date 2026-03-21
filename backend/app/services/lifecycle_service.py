"""Thread-safe lifecycle state machine."""
import threading, uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from app.core.audit import audit_event
from app.services import bounty_service as _bs

class LifecycleState(str, Enum):
    """States."""
    DRAFT="draft"; OPEN="open"; CLAIMED="claimed"; IN_REVIEW="in_review"
    COMPLETED="completed"; PAID="paid"; CANCELLED="cancelled"
_S = LifecycleState
D,O,CL,IR,CO,P,CA = _S.DRAFT,_S.OPEN,_S.CLAIMED,_S.IN_REVIEW,_S.COMPLETED,_S.PAID,_S.CANCELLED
TR = {D:{O,CA}, O:{CL,IR,CA}, CL:{IR,O,CA}, IR:{CO,O,CA}, CO:{P}, P:set(), CA:set()}
TE = frozenset({P, CA})

class LifecycleError(Exception):
    """Error."""
    def __init__(s, msg, code="LIFECYCLE_ERROR"): s.message=msg; s.code=code; super().__init__(msg)
class InvalidTransitionError(LifecycleError):
    def __init__(s, c, t): super().__init__(f"{c}->{t}", "INVALID_TRANSITION")
class TerminalStateError(LifecycleError):
    def __init__(s,*a): super().__init__("terminal","TERMINAL_STATE")
class BountyNotFoundError(LifecycleError):
    def __init__(s,*a): super().__init__("not found","BOUNTY_NOT_FOUND")
class ClaimConflictError(LifecycleError):
    def __init__(s,*a): super().__init__("claimed","CLAIM_CONFLICT")
class TierGateError(LifecycleError):
    def __init__(s,r,h): super().__init__(f"need T{r}","TIER_GATE")
class ClaimNotFoundError(LifecycleError):
    def __init__(s,*a): super().__init__("no claim","CLAIM_NOT_FOUND")
class OwnershipError(LifecycleError):
    def __init__(s,*a): super().__init__("not creator","OWNERSHIP_ERROR")

_now = lambda: datetime.now(timezone.utc)
_uid = lambda: Field(default_factory=lambda: str(uuid.uuid4()))
_ts = lambda: Field(default_factory=_now)
class LifecycleEvent(BaseModel):
    """Event."""
    event_id: str = _uid()
    bounty_id: str; event_type: str; actor: str; old_state: str; new_state: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = _ts()
LifecycleEventResponse = LifecycleEvent
class ClaimRecord(BaseModel):
    claim_id: str = _uid()
    bounty_id: str; contributor_id: str
    claimed_at: datetime = _ts()
    deadline: datetime; released_at: Optional[datetime] = None
class DeadlineCheckResponse(BaseModel):
    warnings_issued: int; claims_released: int; details: list[dict] = Field(default_factory=list)
class ClaimResponse(BaseModel):
    claim_id: str; bounty_id: str; contributor_id: str
    claimed_at: datetime; deadline: datetime; state: str

_state_lock = _L = threading.Lock()
_states: dict[str, LifecycleState] = {}
_claims: dict[str, ClaimRecord] = {}
_log: list[LifecycleEvent] = []

def _gs(bid):
    s = _states.get(bid)
    if s is not None: return s
    b = _bs.get_bounty(bid)
    if not b: raise BountyNotFoundError(bid)
    try: m = _S(b.status.value)
    except ValueError: m = O
    _states[bid] = m; return m
def _rec(bid, et, actor, old, new, m=None):
    kw = dict(bounty_id=bid, event_type=et, actor=actor, old_state=old.value, new_state=new.value)
    ev = LifecycleEvent(**kw, metadata=m or {}); _log.append(ev); audit_event("lifecycle_transition", **kw); return ev
def _chk(bid, cur, tgt):
    if cur in TE: raise TerminalStateError(bid, cur.value)
    if tgt not in TR.get(cur, set()): raise InvalidTransitionError(cur.value, tgt.value)
def _mtier(cid):
    try:
        from app.services.reputation_service import _reputation_store as rs, count_tier_completions as ctc, determine_current_tier as dct
        return {"T1":1,"T2":2,"T3":3}.get(dct(ctc(rs.get(cid, []))).value, 1)
    except Exception: return 1
def _own(bid, actor):
    if actor in ("system", "treasury"): return
    b = _bs.get_bounty(bid)
    if not b: raise BountyNotFoundError(bid)
    if b.created_by != "system" and actor != b.created_by: raise OwnershipError(bid, actor)

def initialize_bounty(bid, actor="system"):
    """To DRAFT."""
    with _L:
        if not _bs.get_bounty(bid): raise BountyNotFoundError(bid)
        ex = _states.get(bid)
        if ex is not None: return _rec(bid, "initialize_idempotent", actor, ex, ex)
        _states[bid] = D; return _rec(bid, "initialize", actor, D, D)
def open_bounty(bid, actor="system"):
    """DRAFT to OPEN."""
    with _L:
        c = _gs(bid); _chk(bid, c, O); _states[bid] = O; return _rec(bid, "open", actor, c, O)
def claim_bounty(bid, cid, bounty_tier=1):
    """Claim."""
    with _L:
        cur = _gs(bid); ec = _claims.get(bid)
        if ec and ec.released_at is None: raise ClaimConflictError(bid, ec.contributor_id)
        _chk(bid, cur, CL)
        if bounty_tier in {2,3} and _mtier(cid) < bounty_tier: raise TierGateError(bounty_tier, _mtier(cid))
        now = _now(); dl = now + timedelta(hours=72)
        cr = ClaimRecord(bounty_id=bid, contributor_id=cid, claimed_at=now, deadline=dl)
        _claims[bid] = cr; _states[bid] = CL
        _rec(bid, "claim", cid, cur, CL, {"deadline": dl.isoformat(), "tier": bounty_tier}); return cr
def release_claim(bid, actor="system", reason="manual"):
    """Release."""
    with _L:
        cur = _gs(bid); _chk(bid, cur, O); cl = _claims.get(bid)
        if cl and cl.released_at is None:
            cr = _bs.get_bounty(bid)
            if actor not in ("system", cl.contributor_id) and (not cr or actor != cr.created_by): raise ClaimNotFoundError(bid, actor)
            cl.released_at = _now()
        _states[bid] = O; return _rec(bid, "release_claim", actor, cur, O, {"reason": reason})
def submit_for_review(bid, cid, pr_url=""):
    """To IN_REVIEW."""
    with _L:
        cur = _gs(bid); _chk(bid, cur, IR)
        if cur == CL:
            cl = _claims.get(bid)
            if not cl or cl.contributor_id != cid: raise ClaimNotFoundError(bid, cid)
        _states[bid] = IR; return _rec(bid, "submit_for_review", cid, cur, IR, {"pr_url": pr_url})
def complete_bounty(bid, actor="system"):
    """Complete (creator-only)."""
    with _L:
        _own(bid, actor); cur = _gs(bid); _chk(bid, cur, CO)
        _states[bid] = CO; return _rec(bid, "complete", actor, cur, CO)
def pay_bounty(bid, actor="treasury"):
    """Pay (creator-only)."""
    with _L:
        _own(bid, actor); cur = _gs(bid); _chk(bid, cur, P)
        _states[bid] = P; return _rec(bid, "pay", actor, cur, P)
def cancel_bounty(bid, actor="system"):
    """Cancel (creator-only)."""
    with _L:
        _own(bid, actor); cur = _gs(bid); _chk(bid, cur, CA)
        cl = _claims.get(bid)
        if cl and cl.released_at is None: cl.released_at = _now()
        _states[bid] = CA; return _rec(bid, "cancel", actor, cur, CA)
def handle_pr_event(bid, action, pr_url, sender, merged=False):
    """PR webhook."""
    with _L:
        st = _states.get(bid)
        if st is None:
            b = _bs.get_bounty(bid)
            if not b: return None
            try: st = _S(b.status.value)
            except ValueError: st = O
            _states[bid] = st
        if st in TE: return None
        ok = TR.get(st, set())
        if action == "opened" and IR in ok:
            if st == CL:
                cl = _claims.get(bid)
                if cl and cl.contributor_id != sender: return None
            _states[bid] = IR; return _rec(bid, "webhook_pr_opened", sender, st, IR, {"pr_url": pr_url})
        if action == "closed" and merged and CO in ok:
            _states[bid] = CO; return _rec(bid, "webhook_pr_merged", sender, st, CO, {"pr_url": pr_url})
        if action == "closed" and not merged and st == IR:
            cl = _claims.get(bid)
            if cl and cl.released_at is None: cl.released_at = _now()
            _states[bid] = O; return _rec(bid, "webhook_pr_closed", sender, st, O, {"pr_url": pr_url})
    return None
def enforce_deadlines():
    """Deadlines."""
    now = _now(); w = []; rel = 0
    with _L: bids = [b for b, c in _claims.items() if c.released_at is None]
    for bid in bids:
        with _L:
            c = _claims.get(bid)
            if not c or c.released_at: continue
            tot = (c.deadline - c.claimed_at).total_seconds()
            if tot <= 0: continue
            pct = min(((now - c.claimed_at).total_seconds() / tot) * 100, 100.0); cid = c.contributor_id
            d = {"bounty_id":bid,"contributor_id":cid}
            if pct >= 100 and _states.get(bid) == CL:
                c.released_at = now; _states[bid] = O
                _rec(bid, "deadline_auto_release", "system", CL, O, {**d, "reason": "deadline_expired"})
                rel += 1; w.append({**d, "action":"released"})
            elif pct >= 80:
                hrs = max((c.deadline - now).total_seconds() / 3600, 0)
                w.append({**d, "action":"warning", "pct":round(pct,1), "hrs":round(hrs,1)})
    return DeadlineCheckResponse(warnings_issued=sum(1 for x in w if x.get("action")=="warning"), claims_released=rel, details=w)
def get_lifecycle_state(bid):
    """Current state."""
    with _L: return _gs(bid)
def get_claim(bid):
    """Active claim."""
    c = _claims.get(bid)
    with _L: return c if c and c.released_at is None else None
def get_audit_log(bounty_id=None, limit=50, actor_filter=None):
    """Audit log."""
    with _L: return sorted([e for e in _log if (not bounty_id or e.bounty_id == bounty_id) and (not actor_filter or e.actor == actor_filter)], key=lambda e: e.created_at, reverse=True)[:limit]
def is_bounty_participant(bid, actor):
    """Participant."""
    b = _bs.get_bounty(bid)
    if b and b.created_by == actor: return True
    with _L: return any(e.bounty_id == bid and e.actor == actor for e in _log)
def clear_stores():
    """Reset."""
    with _L: _states.clear(); _claims.clear(); _log.clear()
