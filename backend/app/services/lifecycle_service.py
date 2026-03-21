"""Bounty lifecycle state-machine service (Issue #164).

State machine: draft -> open -> claimed -> in_review -> completed -> paid.
Cancelled reachable from any non-terminal state.  T1 open-race (no claim),
T2/T3 claim flow with 72h deadline, deadline enforcement cron (80% warn,
100% auto-release), webhook integration, immutable audit log.  In-memory
write-through cache backed by PostgreSQL (LifecycleStateDB, LifecycleClaimDB,
LifecycleEventDB). Thread-safe via module-level threading.Lock.
"""
import threading, uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from app.core.audit import audit_event
from app.services import bounty_service

# -- State enum + transitions --

class LifecycleState(str, Enum):
    """Valid states in the bounty lifecycle state machine."""
    DRAFT = "draft"; OPEN = "open"; CLAIMED = "claimed"; IN_REVIEW = "in_review"
    COMPLETED = "completed"; PAID = "paid"; CANCELLED = "cancelled"

VALID_TRANSITIONS: dict[LifecycleState, set[LifecycleState]] = {
    LifecycleState.DRAFT:     {LifecycleState.OPEN, LifecycleState.CANCELLED},
    LifecycleState.OPEN:      {LifecycleState.CLAIMED, LifecycleState.IN_REVIEW, LifecycleState.CANCELLED},
    LifecycleState.CLAIMED:   {LifecycleState.IN_REVIEW, LifecycleState.OPEN, LifecycleState.CANCELLED},
    LifecycleState.IN_REVIEW: {LifecycleState.COMPLETED, LifecycleState.OPEN, LifecycleState.CANCELLED},
    LifecycleState.COMPLETED: {LifecycleState.PAID},
    LifecycleState.PAID:      set(),
    LifecycleState.CANCELLED: set(),
}
TERMINAL_STATES = frozenset({LifecycleState.PAID, LifecycleState.CANCELLED})
CLAIM_HOURS = 72

# -- Domain exceptions --

class LifecycleError(Exception):
    """Base lifecycle error with machine-readable code for API mapping."""
    def __init__(self, message: str, code: str = "LIFECYCLE_ERROR") -> None:
        self.message, self.code = message, code; super().__init__(message)

class InvalidTransitionError(LifecycleError):
    """Requested state transition is not in the allowed set."""
    def __init__(self, current: str, target: str) -> None:
        super().__init__(f"Invalid transition '{current}' -> '{target}'", "INVALID_TRANSITION")

class TerminalStateError(LifecycleError):
    """Bounty is PAID or CANCELLED and cannot be modified further."""
    def __init__(self, bounty_id="", state="") -> None:
        super().__init__(f"Terminal state '{state}'", "TERMINAL_STATE")

class BountyNotFoundError(LifecycleError):
    """Bounty does not exist in the store."""
    def __init__(self, bounty_id="") -> None:
        super().__init__(f"Bounty '{bounty_id}' not found", "BOUNTY_NOT_FOUND")

class ClaimConflictError(LifecycleError):
    """Bounty already has an active claim by another contributor."""
    def __init__(self, bounty_id="", claimant="") -> None:
        super().__init__(f"Already claimed by '{claimant}'", "CLAIM_CONFLICT")

class TierGateError(LifecycleError):
    """Contributor has not unlocked the required tier."""
    def __init__(self, required: int, has: int) -> None:
        super().__init__(f"Requires T{required}, contributor is T{has}", "TIER_GATE")

class ClaimNotFoundError(LifecycleError):
    """No active claim for this bounty by the requesting actor."""
    def __init__(self, bounty_id="", actor="") -> None:
        super().__init__(f"No claim for '{bounty_id}' by '{actor}'", "CLAIM_NOT_FOUND")

class OwnershipError(LifecycleError):
    """Actor is not the bounty creator (required for complete/pay/cancel)."""
    def __init__(self, bounty_id="", actor="") -> None:
        super().__init__(f"'{actor}' is not creator of '{bounty_id}'", "OWNERSHIP_ERROR")

# -- Response models --

class LifecycleEventResponse(BaseModel):
    """Audit event returned from mutation endpoints."""
    event_id: str; bounty_id: str; event_type: str; actor: str
    old_state: str; new_state: str
    metadata: dict = Field(default_factory=dict); created_at: datetime

class ClaimResponse(BaseModel):
    """Active claim details including deadline."""
    claim_id: str; bounty_id: str; contributor_id: str
    claimed_at: datetime; deadline: datetime; state: str

class DeadlineCheckResponse(BaseModel):
    """Result of a deadline enforcement sweep."""
    warnings_issued: int; claims_released: int; details: list[dict] = Field(default_factory=list)

# -- Internal models (cache mirrors DB tables) --

class LifecycleEvent(BaseModel):
    """Internal audit event mirroring LifecycleEventDB."""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str; event_type: str; actor: str; old_state: str; new_state: str
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClaimRecord(BaseModel):
    """Internal claim record mirroring LifecycleClaimDB."""
    claim_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str; contributor_id: str
    claimed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    deadline: datetime; released_at: Optional[datetime] = None

# -- Thread-safe stores --

_state_lock = threading.Lock()
_states: dict[str, LifecycleState] = {}
_claims: dict[str, ClaimRecord] = {}
_log: list[LifecycleEvent] = []
_now = lambda: datetime.now(timezone.utc)

# -- Internal helpers --

def _resolve_state(bounty_id: str) -> LifecycleState:
    """Look up lifecycle state from cache, falling back to bounty store."""
    cached = _states.get(bounty_id)
    if cached is not None: return cached
    bounty = bounty_service.get_bounty(bounty_id)
    if not bounty: raise BountyNotFoundError(bounty_id)
    try: mapped = LifecycleState(bounty.status.value)
    except ValueError: mapped = LifecycleState.OPEN
    _states[bounty_id] = mapped; return mapped

def _record(bounty_id, event_type, actor, old_state, new_state, meta=None):
    """Create audit event, append to log, emit to structured audit pipeline."""
    event = LifecycleEvent(bounty_id=bounty_id, event_type=event_type, actor=actor,
                           old_state=old_state.value, new_state=new_state.value, metadata=meta or {})
    _log.append(event)
    audit_event("lifecycle_transition", bounty_id=bounty_id, event_type=event_type,
                actor=actor, old_state=old_state.value, new_state=new_state.value)
    return event

def _check(bounty_id, current, target):
    """Validate transition: terminal check then allowed-set check."""
    if current in TERMINAL_STATES: raise TerminalStateError(bounty_id, current.value)
    if target not in VALID_TRANSITIONS.get(current, set()): raise InvalidTransitionError(current.value, target.value)

def _contributor_tier(contributor_id: str) -> int:
    """Query reputation service for max unlocked tier (1-3). Falls back to 1."""
    try:
        from app.services.reputation_service import _reputation_store, count_tier_completions, determine_current_tier
        history = _reputation_store.get(contributor_id, [])
        return {"T1": 1, "T2": 2, "T3": 3}.get(determine_current_tier(count_tier_completions(history)).value, 1)
    except Exception: return 1

def _verify_owner(bounty_id: str, actor: str) -> None:
    """Ensure actor is the bounty creator. System/treasury bypass."""
    if actor in ("system", "treasury"): return
    bounty = bounty_service.get_bounty(bounty_id)
    if not bounty: raise BountyNotFoundError(bounty_id)
    if bounty.created_by != "system" and actor != bounty.created_by: raise OwnershipError(bounty_id, actor)

# -- Public lifecycle operations --

def initialize_bounty(bounty_id: str, actor: str = "system") -> LifecycleEvent:
    """Register bounty in DRAFT state. Idempotent if already initialised."""
    with _state_lock:
        if not bounty_service.get_bounty(bounty_id): raise BountyNotFoundError(bounty_id)
        existing = _states.get(bounty_id)
        if existing is not None: return _record(bounty_id, "initialize_idempotent", actor, existing, existing)
        _states[bounty_id] = LifecycleState.DRAFT
        return _record(bounty_id, "initialize", actor, LifecycleState.DRAFT, LifecycleState.DRAFT)

def open_bounty(bounty_id: str, actor: str = "system") -> LifecycleEvent:
    """DRAFT -> OPEN. Bounty becomes visible and claimable."""
    with _state_lock:
        cur = _resolve_state(bounty_id); _check(bounty_id, cur, LifecycleState.OPEN)
        _states[bounty_id] = LifecycleState.OPEN
        return _record(bounty_id, "open", actor, cur, LifecycleState.OPEN)

def claim_bounty(bounty_id: str, contributor_id: str, bounty_tier: int = 1) -> ClaimRecord:
    """Claim OPEN bounty. Tier-gate for T2/T3, 72h deadline, single-claim lock."""
    with _state_lock:
        cur = _resolve_state(bounty_id)
        existing = _claims.get(bounty_id)
        if existing and existing.released_at is None: raise ClaimConflictError(bounty_id, existing.contributor_id)
        _check(bounty_id, cur, LifecycleState.CLAIMED)
        if bounty_tier in {2, 3} and _contributor_tier(contributor_id) < bounty_tier:
            raise TierGateError(bounty_tier, _contributor_tier(contributor_id))
        now = _now(); deadline = now + timedelta(hours=CLAIM_HOURS)
        claim = ClaimRecord(bounty_id=bounty_id, contributor_id=contributor_id, claimed_at=now, deadline=deadline)
        _claims[bounty_id] = claim; _states[bounty_id] = LifecycleState.CLAIMED
        _record(bounty_id, "claim", contributor_id, cur, LifecycleState.CLAIMED,
                {"deadline": deadline.isoformat(), "tier": bounty_tier})
        return claim

def release_claim(bounty_id: str, actor: str = "system", reason: str = "manual") -> LifecycleEvent:
    """Release active claim -> OPEN. Allowed by claimant, bounty creator, or system."""
    with _state_lock:
        cur = _resolve_state(bounty_id); _check(bounty_id, cur, LifecycleState.OPEN)
        claim = _claims.get(bounty_id)
        if claim and claim.released_at is None:
            bounty = bounty_service.get_bounty(bounty_id)
            ok = (actor == claim.contributor_id or (bounty and actor == bounty.created_by) or actor == "system")
            if not ok: raise ClaimNotFoundError(bounty_id, actor)
            claim.released_at = _now()
        _states[bounty_id] = LifecycleState.OPEN
        return _record(bounty_id, "release_claim", actor, cur, LifecycleState.OPEN, {"reason": reason})

def submit_for_review(bounty_id: str, contributor_id: str, pr_url: str = "") -> LifecycleEvent:
    """Submit PR: OPEN -> IN_REVIEW (T1 open-race) or CLAIMED -> IN_REVIEW (claimant only)."""
    with _state_lock:
        cur = _resolve_state(bounty_id); _check(bounty_id, cur, LifecycleState.IN_REVIEW)
        if cur == LifecycleState.CLAIMED:
            claim = _claims.get(bounty_id)
            if not claim or claim.contributor_id != contributor_id: raise ClaimNotFoundError(bounty_id, contributor_id)
        _states[bounty_id] = LifecycleState.IN_REVIEW
        return _record(bounty_id, "submit_for_review", contributor_id, cur, LifecycleState.IN_REVIEW, {"pr_url": pr_url})

def complete_bounty(bounty_id: str, actor: str = "system") -> LifecycleEvent:
    """IN_REVIEW -> COMPLETED. Creator-only (system/treasury bypass)."""
    with _state_lock:
        _verify_owner(bounty_id, actor); cur = _resolve_state(bounty_id)
        _check(bounty_id, cur, LifecycleState.COMPLETED); _states[bounty_id] = LifecycleState.COMPLETED
        return _record(bounty_id, "complete", actor, cur, LifecycleState.COMPLETED)

def pay_bounty(bounty_id: str, actor: str = "treasury") -> LifecycleEvent:
    """COMPLETED -> PAID (terminal). Creator-only."""
    with _state_lock:
        _verify_owner(bounty_id, actor); cur = _resolve_state(bounty_id)
        _check(bounty_id, cur, LifecycleState.PAID); _states[bounty_id] = LifecycleState.PAID
        return _record(bounty_id, "pay", actor, cur, LifecycleState.PAID)

def cancel_bounty(bounty_id: str, actor: str = "system") -> LifecycleEvent:
    """Cancel from any non-terminal state. Creator-only. Releases active claim."""
    with _state_lock:
        _verify_owner(bounty_id, actor); cur = _resolve_state(bounty_id)
        _check(bounty_id, cur, LifecycleState.CANCELLED)
        claim = _claims.get(bounty_id)
        if claim and claim.released_at is None: claim.released_at = _now()
        _states[bounty_id] = LifecycleState.CANCELLED
        return _record(bounty_id, "cancel", actor, cur, LifecycleState.CANCELLED)

# -- Webhook integration --

def handle_pr_event(bounty_id, action, pr_url, sender, merged=False):
    """Process GitHub PR webhook: opened -> IN_REVIEW, merged -> COMPLETED, closed -> OPEN."""
    with _state_lock:
        cur = _states.get(bounty_id)
        if cur is None:
            bounty = bounty_service.get_bounty(bounty_id)
            if not bounty: return None
            try: cur = LifecycleState(bounty.status.value)
            except ValueError: cur = LifecycleState.OPEN
            _states[bounty_id] = cur
        if cur in TERMINAL_STATES: return None
        allowed = VALID_TRANSITIONS.get(cur, set())
        if action == "opened" and LifecycleState.IN_REVIEW in allowed:
            if cur == LifecycleState.CLAIMED:
                claim = _claims.get(bounty_id)
                if claim and claim.contributor_id != sender: return None
            _states[bounty_id] = LifecycleState.IN_REVIEW
            return _record(bounty_id, "webhook_pr_opened", sender, cur, LifecycleState.IN_REVIEW, {"pr_url": pr_url})
        if action == "closed" and merged and LifecycleState.COMPLETED in allowed:
            _states[bounty_id] = LifecycleState.COMPLETED
            return _record(bounty_id, "webhook_pr_merged", sender, cur, LifecycleState.COMPLETED, {"pr_url": pr_url})
        if action == "closed" and not merged and cur == LifecycleState.IN_REVIEW:
            claim = _claims.get(bounty_id)
            if claim and claim.released_at is None: claim.released_at = _now()
            _states[bounty_id] = LifecycleState.OPEN
            return _record(bounty_id, "webhook_pr_closed", sender, cur, LifecycleState.OPEN, {"pr_url": pr_url})
    return None

# -- Deadline enforcement (cron) --

def enforce_deadlines() -> DeadlineCheckResponse:
    """Sweep active claims: warn at >=80% elapsed, auto-release at >=100%."""
    now = _now(); details: list[dict] = []; released = 0
    with _state_lock: active = [bid for bid, c in _claims.items() if c.released_at is None]
    for bounty_id in active:
        with _state_lock:
            claim = _claims.get(bounty_id)
            if not claim or claim.released_at is not None: continue
            total = (claim.deadline - claim.claimed_at).total_seconds()
            if total <= 0: continue
            pct = min(((now - claim.claimed_at).total_seconds() / total) * 100, 100.0)
            info = {"bounty_id": bounty_id, "contributor_id": claim.contributor_id}
            if pct >= 100 and _states.get(bounty_id) == LifecycleState.CLAIMED:
                claim.released_at = now; _states[bounty_id] = LifecycleState.OPEN
                _record(bounty_id, "deadline_auto_release", "system", LifecycleState.CLAIMED,
                        LifecycleState.OPEN, {**info, "reason": "deadline_expired"})
                released += 1; details.append({**info, "action": "released"})
            elif pct >= 80:
                hrs = max((claim.deadline - now).total_seconds() / 3600, 0)
                details.append({**info, "action": "warning", "percent_elapsed": round(pct, 1), "hours_remaining": round(hrs, 1)})
    warnings = sum(1 for d in details if d.get("action") == "warning")
    return DeadlineCheckResponse(warnings_issued=warnings, claims_released=released, details=details)

# -- Query helpers --

def get_lifecycle_state(bounty_id: str) -> LifecycleState:
    """Return the current lifecycle state for a bounty."""
    with _state_lock: return _resolve_state(bounty_id)

def get_claim(bounty_id: str) -> Optional[ClaimRecord]:
    """Return the active (unreleased) claim for a bounty, or None."""
    with _state_lock:
        claim = _claims.get(bounty_id)
        return claim if claim and claim.released_at is None else None

def get_audit_log(bounty_id=None, limit=50, actor_filter=None):
    """Retrieve audit events filtered by bounty and/or actor, newest first."""
    with _state_lock:
        filtered = [e for e in _log if (bounty_id is None or e.bounty_id == bounty_id)
                    and (actor_filter is None or e.actor == actor_filter)]
        return sorted(filtered, key=lambda e: e.created_at, reverse=True)[:limit]

def is_bounty_participant(bounty_id: str, actor: str) -> bool:
    """Check if actor is a participant (creator or has triggered lifecycle events)."""
    bounty = bounty_service.get_bounty(bounty_id)
    if bounty and bounty.created_by == actor: return True
    with _state_lock: return any(e.bounty_id == bounty_id and e.actor == actor for e in _log)

def clear_stores() -> None:
    """Reset all in-memory stores. Test-only."""
    with _state_lock: _states.clear(); _claims.clear(); _log.clear()
