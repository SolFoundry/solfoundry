"""Bounty lifecycle engine — thread-safe state machine.
States: draft->open->claimed->in_review->completed->paid. Terminal: paid/cancelled.
_state_lock on ALL writes. PostgreSQL migration: lifecycle_events table.
"""
import threading, uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from app.core.audit import audit_event
from app.services import bounty_service

class LifecycleState(str, Enum):
    """The LifecycleState class."""
    DRAFT="draft"; OPEN="open"; CLAIMED="claimed"; IN_REVIEW="in_review"
    COMPLETED="completed"; PAID="paid"; CANCELLED="cancelled"

_S = LifecycleState
_T = {_S.DRAFT:{_S.OPEN,_S.CANCELLED}, _S.OPEN:{_S.CLAIMED,_S.IN_REVIEW,_S.CANCELLED},
      _S.CLAIMED:{_S.IN_REVIEW,_S.OPEN,_S.CANCELLED}, _S.IN_REVIEW:{_S.COMPLETED,_S.OPEN,_S.CANCELLED},
      _S.COMPLETED:{_S.PAID}, _S.PAID:set(), _S.CANCELLED:set()}
TERMINAL = frozenset({_S.PAID, _S.CANCELLED})

class LifecycleError(Exception):
        """The __init__ function."""
    """The LifecycleError class."""
    def __init__(s, msg, code="LIFECYCLE_ERROR"): s.message=msg; s.code=code; super().__init__(msg)
class InvalidTransitionError(LifecycleError):
        """The __init__ function."""
    """The InvalidTransitionError class."""
    def __init__(s, c, t): super().__init__(f"{c}->{t} invalid. Allowed: {sorted(x.value for x in _T.get(_S(c),set()))}", "INVALID_TRANSITION")
class TerminalStateError(LifecycleError):
        """The __init__ function."""
    """The TerminalStateError class."""
    def __init__(s, b, st): super().__init__(f"'{b}' terminal '{st}'", "TERMINAL_STATE")
class BountyNotFoundError(LifecycleError):
        """The __init__ function."""
    """The BountyNotFoundError class."""
    def __init__(s, b): super().__init__(f"'{b}' not found", "BOUNTY_NOT_FOUND")
class ClaimConflictError(LifecycleError):
        """The __init__ function."""
    """The ClaimConflictError class."""
    def __init__(s, b, w): super().__init__(f"'{b}' claimed by '{w}'", "CLAIM_CONFLICT")
class TierGateError(LifecycleError):
        """The __init__ function."""
    """The TierGateError class."""
    def __init__(s, r, h): super().__init__(f"Requires T{r}; has T{h}", "TIER_GATE")
class ClaimNotFoundError(LifecycleError):
        """The __init__ function."""
    """The ClaimNotFoundError class."""
    def __init__(s, b, c): super().__init__(f"No claim '{b}' for '{c}'", "CLAIM_NOT_FOUND")

class LifecycleEvent(BaseModel):
    """The LifecycleEvent class."""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str; event_type: str; actor: str; old_state: str; new_state: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
class ClaimRecord(BaseModel):
    """The ClaimRecord class."""
    claim_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str; contributor_id: str
    claimed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deadline: datetime; released_at: Optional[datetime] = None
class DeadlineCheckResponse(BaseModel):
    """The DeadlineCheckResponse class."""
    warnings_issued: int; claims_released: int; details: list[dict] = Field(default_factory=list)
LifecycleEventResponse = LifecycleEvent  # same schema, reuse
class ClaimResponse(BaseModel):
    """The ClaimResponse class."""
    claim_id: str; bounty_id: str; contributor_id: str
    claimed_at: datetime; deadline: datetime; state: str

_state_lock = threading.Lock()
_states: dict[str, _S] = {}
_claims: dict[str, ClaimRecord] = {}
_log: list[LifecycleEvent] = []

def _gs(bid):
    """The _gs function."""
    s = _states.get(bid)
    if s: return s
    b = bounty_service.get_bounty(bid)
    if not b: raise BountyNotFoundError(bid)
    try: m = _S(b.status.value)
    except ValueError: m = _S.OPEN
    _states[bid] = m; return m

def _rec(bid, et, actor, old, new, meta=None):
    """The _rec function."""
    ev = LifecycleEvent(bounty_id=bid, event_type=et, actor=actor,
        old_state=old.value, new_state=new.value, metadata=meta or {})
    _log.append(ev)
    audit_event("lifecycle_transition", bounty_id=bid, event_type=et,
        actor=actor, old_state=old.value, new_state=new.value)
    return ev

def _chk(bid, cur, tgt):
    """The _chk function."""
    if cur in TERMINAL: raise TerminalStateError(bid, cur.value)
    if tgt not in _T.get(cur, set()): raise InvalidTransitionError(cur.value, tgt.value)

def _mtier(cid):
    """The _mtier function."""
    try:
        from app.services.reputation_service import _reputation_store, count_tier_completions, determine_current_tier
        h = _reputation_store.get(cid, [])
        return {"T1":1,"T2":2,"T3":3}.get(determine_current_tier(count_tier_completions(h)).value, 1)
    except Exception: return 1

def initialize_bounty(bid, actor="system"):
    """The initialize_bounty function."""
    with _state_lock:
        if not bounty_service.get_bounty(bid): raise BountyNotFoundError(bid)
        ex = _states.get(bid)
        if ex is not None: return _rec(bid, "initialize_idempotent", actor, ex, ex)
        _states[bid] = _S.DRAFT; return _rec(bid, "initialize", actor, _S.DRAFT, _S.DRAFT)

def open_bounty(bid, actor="system"):
    """The open_bounty function."""
    with _state_lock:
        c = _gs(bid); _chk(bid, c, _S.OPEN); _states[bid] = _S.OPEN
        return _rec(bid, "open", actor, c, _S.OPEN)

def claim_bounty(bid, cid, bounty_tier=1):
    """The claim_bounty function."""
    with _state_lock:
        cur = _gs(bid); ec = _claims.get(bid)
        if ec and ec.released_at is None: raise ClaimConflictError(bid, ec.contributor_id)
        _chk(bid, cur, _S.CLAIMED)
        if bounty_tier in {2,3}:
            mx = _mtier(cid)
            if mx < bounty_tier: raise TierGateError(bounty_tier, mx)
        now = datetime.now(timezone.utc); dl = now + timedelta(hours=72)
        cr = ClaimRecord(bounty_id=bid, contributor_id=cid, claimed_at=now, deadline=dl)
        _claims[bid] = cr; _states[bid] = _S.CLAIMED
        _rec(bid, "claim", cid, cur, _S.CLAIMED, {"deadline": dl.isoformat(), "tier": bounty_tier})
        return cr

def release_claim(bid, actor="system", reason="manual"):
    """The release_claim function."""
    with _state_lock:
        cur = _gs(bid); _chk(bid, cur, _S.OPEN)
        c = _claims.get(bid)
        if c: c.released_at = datetime.now(timezone.utc)
        _states[bid] = _S.OPEN; return _rec(bid, "release_claim", actor, cur, _S.OPEN, {"reason": reason})

def submit_for_review(bid, cid, pr_url=""):
    """The submit_for_review function."""
    with _state_lock:
        cur = _gs(bid); _chk(bid, cur, _S.IN_REVIEW)
        if cur == _S.CLAIMED:
            c = _claims.get(bid)
            if not c or c.contributor_id != cid: raise ClaimNotFoundError(bid, cid)
        _states[bid] = _S.IN_REVIEW
        return _rec(bid, "submit_for_review", cid, cur, _S.IN_REVIEW, {"pr_url": pr_url})

def complete_bounty(bid, actor="system"):
    """The complete_bounty function."""
    with _state_lock:
        cur = _gs(bid); _chk(bid, cur, _S.COMPLETED); _states[bid] = _S.COMPLETED
        return _rec(bid, "complete", actor, cur, _S.COMPLETED)

def pay_bounty(bid, actor="treasury"):
    """The pay_bounty function."""
    with _state_lock:
        cur = _gs(bid); _chk(bid, cur, _S.PAID); _states[bid] = _S.PAID
        return _rec(bid, "pay", actor, cur, _S.PAID)

def cancel_bounty(bid, actor="system"):
    """The cancel_bounty function."""
    with _state_lock:
        cur = _gs(bid); _chk(bid, cur, _S.CANCELLED)
        c = _claims.get(bid)
        if c and c.released_at is None: c.released_at = datetime.now(timezone.utc)
        _states[bid] = _S.CANCELLED; return _rec(bid, "cancel", actor, cur, _S.CANCELLED)

def handle_pr_event(bid, action, pr_url, sender, merged=False):
    """The handle_pr_event function."""
    with _state_lock:
        st = _states.get(bid)
        if st is None:
            b = bounty_service.get_bounty(bid)
            if not b: return None
            try: st = _S(b.status.value)
            except ValueError: st = _S.OPEN
            _states[bid] = st
        if st in TERMINAL: return None
        ok = _T.get(st, set())
        if action == "opened" and _S.IN_REVIEW in ok:
            if st == _S.CLAIMED:
                c = _claims.get(bid)
                if c and c.contributor_id != sender: return None
            _states[bid] = _S.IN_REVIEW
            return _rec(bid, "webhook_pr_opened", sender, st, _S.IN_REVIEW, {"pr_url": pr_url})
        if action == "closed" and merged and _S.COMPLETED in ok:
            _states[bid] = _S.COMPLETED
            return _rec(bid, "webhook_pr_merged", sender, st, _S.COMPLETED, {"pr_url": pr_url})
        if action == "closed" and not merged and st == _S.IN_REVIEW:
            c = _claims.get(bid)
            if c and c.released_at is None: c.released_at = datetime.now(timezone.utc)
            _states[bid] = _S.OPEN
            return _rec(bid, "webhook_pr_closed", sender, st, _S.OPEN, {"pr_url": pr_url})
    return None

def enforce_deadlines():
    """The enforce_deadlines function."""
    now = datetime.now(timezone.utc); w = []; rel = 0
    with _state_lock: bids = [b for b, c in _claims.items() if c.released_at is None]
    for bid in bids:
        with _state_lock:
            c = _claims.get(bid)
            if not c or c.released_at: continue
            tot = (c.deadline - c.claimed_at).total_seconds()
            if tot <= 0: continue
            pct = min(((now - c.claimed_at).total_seconds() / tot) * 100, 100.0)
            if pct >= 100 and _states.get(bid) == _S.CLAIMED:
                c.released_at = now; old = _states[bid]; _states[bid] = _S.OPEN
                _rec(bid, "deadline_auto_release", "system", old, _S.OPEN,
                     {"contributor_id": c.contributor_id, "reason": "deadline_expired"})
                rel += 1; w.append({"bounty_id":bid,"action":"released","contributor_id":c.contributor_id})
            elif pct >= 80:
                hrs = max((c.deadline - now).total_seconds() / 3600, 0)
                w.append({"bounty_id":bid,"action":"warning","contributor_id":c.contributor_id,
                          "percent_elapsed":round(pct,1),"hours_remaining":round(hrs,1)})
    return DeadlineCheckResponse(warnings_issued=sum(1 for x in w if x.get("action")=="warning"),
                                  claims_released=rel, details=w)

def get_lifecycle_state(bid):
    """The get_lifecycle_state function."""
    with _state_lock: return _gs(bid)

def get_claim(bid):
    """The get_claim function."""
    with _state_lock:
        c = _claims.get(bid); return c if c and c.released_at is None else None

def get_audit_log(bounty_id=None, limit=50):
    """The get_audit_log function."""
    with _state_lock:
        f = [e for e in _log if bounty_id is None or e.bounty_id == bounty_id]
        return sorted(f, key=lambda e: e.created_at, reverse=True)[:limit]

def clear_stores():
    """The clear_stores function."""
    with _state_lock: _states.clear(); _claims.clear(); _log.clear()
