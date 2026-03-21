"""Bounty completion & review flow (Closes #191).

PR submission -> AI review (GPT/Gemini/Grok) -> creator approve/dispute ->
48h auto-approve -> escrow payout -> completion state. All transitions logged.

PostgreSQL migration: review_scores(id PK, submission_id FK, model, score,
categories JSONB, created_at); lifecycle_events(id PK, bounty_id FK,
event_type, actor, metadata JSONB, created_at).
"""
from __future__ import annotations
import hashlib, logging, threading, uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator
from app.core.audit import audit_event
from app.models.bounty import (BountyDB, BountyStatus, SubmissionRecord,
    SubmissionStatus, VALID_SUBMISSION_TRANSITIONS)
from app.models.payout import PayoutCreate
from app.services.bounty_service import _bounty_store
from app.services.payout_service import create_payout

logger = logging.getLogger(__name__)
AUTO_APPROVE_DELAY_HOURS: int = 48
TIER_SCORE_THRESHOLDS: dict[int, float] = {1: 6.0, 2: 7.0, 3: 8.0}
VALID_REVIEW_MODELS: frozenset[str] = frozenset({"gpt", "gemini", "grok"})

class ReviewFlowError(Exception): pass
class SubmissionNotFoundError(ReviewFlowError): pass
class BountyNotFoundError(ReviewFlowError): pass
class DuplicateReviewError(ReviewFlowError): pass
class InvalidStateTransitionError(ReviewFlowError): pass
class AlreadyDisputedError(ReviewFlowError): pass
class UnauthorizedApprovalError(ReviewFlowError): pass

def _vmodel(v: str) -> str:
    n = v.strip().lower()
    if n not in VALID_REVIEW_MODELS:
        raise ValueError(f"Invalid review model: '{v}'. Must be one of: {sorted(VALID_REVIEW_MODELS)}")
    return n

class ReviewScoreCategory(BaseModel):
    """Individual AI review category score."""
    name: str = Field(..., min_length=1, max_length=100)
    score: float = Field(..., ge=0.0, le=10.0)
    feedback: str = Field("", max_length=2000)

class ReviewScore(BaseModel):
    """AI review score from a single model."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    submission_id: str; model: str
    overall_score: float = Field(..., ge=0.0, le=10.0)
    categories: list[ReviewScoreCategory] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    @field_validator("model")
    @classmethod
    def vm(cls, v: str) -> str: return _vmodel(v)

class ReviewScoreCreate(BaseModel):
    """Request to record an AI review score."""
    model: str = Field(..., min_length=1)
    overall_score: float = Field(..., ge=0.0, le=10.0)
    categories: list[ReviewScoreCategory] = Field(default_factory=list)
    @field_validator("model")
    @classmethod
    def vm(cls, v: str) -> str: return _vmodel(v)

class ReviewSummary(BaseModel):
    """Aggregated review results for a submission."""
    submission_id: str; scores: list[ReviewScore] = Field(default_factory=list)
    overall_average: float = 0.0; models_reviewed: list[str] = Field(default_factory=list)
    meets_threshold: bool = False; threshold: float = 0.0
    auto_approve_eligible: bool = False; auto_approve_at: Optional[datetime] = None

class LifecycleEvent(BaseModel):
    """Immutable log entry for bounty state transitions."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bounty_id: str; event_type: str; actor: str = "system"
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CompletionState(BaseModel):
    """Final completion snapshot for a bounty."""
    bounty_id: str; winner_wallet: Optional[str] = None
    winner_username: Optional[str] = None; winning_submission_id: Optional[str] = None
    payout_tx_hash: Optional[str] = None; payout_amount: Optional[float] = None
    payout_solscan_url: Optional[str] = None
    review_summary: Optional[ReviewSummary] = None; completed_at: Optional[datetime] = None

class CreatorDecision(str, Enum):
    APPROVE = "approve"; DISPUTE = "dispute"

class CreatorDecisionRequest(BaseModel):
    decision: CreatorDecision; notes: str = Field("", max_length=2000)

_lock = threading.Lock()
_scores: dict[str, list[ReviewScore]] = {}
_events: dict[str, list[LifecycleEvent]] = {}
_completions: dict[str, CompletionState] = {}
_auto_approve_timers: dict[str, datetime] = {}

def _get(bid: str, sid: str) -> tuple[BountyDB, SubmissionRecord]:
    b = _bounty_store.get(bid)
    if not b: raise BountyNotFoundError(f"Bounty '{bid}' not found")
    for s in b.submissions:
        if s.id == sid: return b, s
    raise SubmissionNotFoundError(f"Submission '{sid}' not found on bounty '{bid}'")

def _log(bid: str, et: str, actor: str = "system", **m: Any) -> LifecycleEvent:
    ev = LifecycleEvent(bounty_id=bid, event_type=et, actor=actor, metadata=m)
    with _lock: _events.setdefault(bid, []).append(ev)
    audit_event(et, bounty_id=bid, actor=actor, **m); return ev

def _avg(sc: list[ReviewScore]) -> float:
    return round(sum(s.overall_score for s in sc) / len(sc), 2) if sc else 0.0

def _tv(b: BountyDB) -> int:
    return b.tier if isinstance(b.tier, int) else b.tier.value

def submit_for_review(bid: str, sid: str, wallet: str) -> ReviewSummary:
    """Transition submission to under_review, notify creator."""
    b, s = _get(bid, sid)
    if b.status not in (BountyStatus.OPEN, BountyStatus.IN_PROGRESS):
        raise InvalidStateTransitionError(f"Cannot start review: bounty status is '{b.status.value}'")
    b.status = BountyStatus.UNDER_REVIEW; b.updated_at = datetime.now(timezone.utc)
    _log(bid, "submission_entered_review", actor=wallet, submission_id=sid, pr_url=s.pr_url)
    return ReviewSummary(submission_id=sid, threshold=TIER_SCORE_THRESHOLDS.get(_tv(b), 7.0))

def record_review_score(bid: str, sid: str, data: ReviewScoreCreate) -> ReviewSummary:
    """Ingest AI review score. Starts 48h auto-approve when all 3 above threshold."""
    b, s = _get(bid, sid)
    with _lock:
        for sc in _scores.get(sid, []):
            if sc.model == data.model: raise DuplicateReviewError(f"Model '{data.model}' already reviewed submission '{sid}'")
    rv = ReviewScore(submission_id=sid, model=data.model, overall_score=data.overall_score, categories=data.categories)
    with _lock: _scores.setdefault(sid, []).append(rv); scores = list(_scores[sid])
    _log(bid, "review_score_recorded", actor=f"ai:{data.model}", submission_id=sid, model=data.model, score=data.overall_score)
    thr = TIER_SCORE_THRESHOLDS.get(_tv(b), 7.0); av = _avg(scores); meets = av >= thr
    aa_at, aa_el = None, False
    if meets and len(scores) >= len(VALID_REVIEW_MODELS):
        aa_el = True
        with _lock:
            if sid not in _auto_approve_timers:
                _auto_approve_timers[sid] = datetime.now(timezone.utc) + timedelta(hours=AUTO_APPROVE_DELAY_HOURS)
            aa_at = _auto_approve_timers[sid]
        _log(bid, "auto_approve_timer_started", submission_id=sid, deadline=aa_at.isoformat())
    s.ai_score = av
    return ReviewSummary(submission_id=sid, scores=scores, overall_average=av,
        models_reviewed=[x.model for x in scores], meets_threshold=meets,
        threshold=thr, auto_approve_eligible=aa_el, auto_approve_at=aa_at)

def get_review_summary(bid: str, sid: str) -> ReviewSummary:
    """Retrieve current review summary."""
    b, _ = _get(bid, sid)
    with _lock: scores = list(_scores.get(sid, [])); aa = _auto_approve_timers.get(sid)
    thr = TIER_SCORE_THRESHOLDS.get(_tv(b), 7.0); av = _avg(scores); meets = av >= thr
    return ReviewSummary(submission_id=sid, scores=scores, overall_average=av,
        models_reviewed=[x.model for x in scores], meets_threshold=meets, threshold=thr,
        auto_approve_eligible=meets and len(scores) >= len(VALID_REVIEW_MODELS), auto_approve_at=aa)

def creator_decision(bid: str, sid: str, cid: str, req: CreatorDecisionRequest) -> CompletionState:
    """Process creator's approve or dispute decision."""
    b, s = _get(bid, sid)
    if b.created_by != cid: raise UnauthorizedApprovalError(f"User '{cid}' is not the creator")
    return _approve(b, s, cid, req.notes) if req.decision == CreatorDecision.APPROVE else _dispute(b, s, cid, req.notes)

def check_auto_approve(bid: str, sid: str) -> Optional[CompletionState]:
    """Check if 48h elapsed; trigger payout if so."""
    b, s = _get(bid, sid)
    with _lock: dl = _auto_approve_timers.get(sid)
    if not dl or datetime.now(timezone.utc) < dl: return None
    if s.status in (SubmissionStatus.APPROVED, SubmissionStatus.PAID): return _completions.get(bid)
    if s.status == SubmissionStatus.DISPUTED: return None
    _log(bid, "auto_approved", submission_id=sid, reason="48h_timeout_no_dispute")
    return _approve(b, s, "system", "Auto-approved: 48h without dispute")

def get_completion_state(bid: str) -> Optional[CompletionState]:
    """Retrieve completion snapshot for a finalized bounty."""
    with _lock: return _completions.get(bid)

def get_lifecycle_events(bid: str) -> list[LifecycleEvent]:
    """Return chronological lifecycle event history."""
    with _lock: return list(_events.get(bid, []))

def _approve(b: BountyDB, s: SubmissionRecord, actor: str, notes: str) -> CompletionState:
    allowed = VALID_SUBMISSION_TRANSITIONS.get(s.status, set())
    if SubmissionStatus.APPROVED not in allowed and s.status != SubmissionStatus.APPROVED:
        raise InvalidStateTransitionError(f"Cannot approve: status '{s.status.value}' forbids it")
    s.status = SubmissionStatus.APPROVED; b.status = BountyStatus.COMPLETED; b.updated_at = datetime.now(timezone.utc)
    _log(b.id, "submission_approved", actor=actor, submission_id=s.id, notes=notes)
    po = _payout(b, s); s.status = SubmissionStatus.PAID; b.status = BountyStatus.PAID; b.updated_at = datetime.now(timezone.utc)
    _log(b.id, "payout_released", actor="escrow_service", submission_id=s.id, tx_hash=po.get("tx_hash"), amount=po.get("amount"))
    with _lock: scores = list(_scores.get(s.id, []))
    thr = TIER_SCORE_THRESHOLDS.get(_tv(b), 7.0); av = _avg(scores)
    rs = ReviewSummary(submission_id=s.id, scores=scores, overall_average=av,
        models_reviewed=[x.model for x in scores], meets_threshold=av >= thr, threshold=thr)
    cs = CompletionState(bounty_id=b.id, winner_wallet=s.submitted_by, winner_username=s.submitted_by,
        winning_submission_id=s.id, payout_tx_hash=po.get("tx_hash"), payout_amount=po.get("amount"),
        payout_solscan_url=po.get("solscan_url"), review_summary=rs, completed_at=datetime.now(timezone.utc))
    with _lock: _completions[b.id] = cs; _auto_approve_timers.pop(s.id, None)
    return cs

def _dispute(b: BountyDB, s: SubmissionRecord, actor: str, notes: str) -> CompletionState:
    if s.status == SubmissionStatus.DISPUTED: raise AlreadyDisputedError(f"Submission '{s.id}' already disputed")
    allowed = VALID_SUBMISSION_TRANSITIONS.get(s.status, set())
    if SubmissionStatus.DISPUTED not in allowed:
        raise InvalidStateTransitionError(f"Cannot dispute: status '{s.status.value}' forbids it")
    s.status = SubmissionStatus.DISPUTED; b.status = BountyStatus.DISPUTED; b.updated_at = datetime.now(timezone.utc)
    with _lock: _auto_approve_timers.pop(s.id, None)
    _log(b.id, "submission_disputed", actor=actor, submission_id=s.id, notes=notes)
    return CompletionState(bounty_id=b.id)

def _payout(b: BountyDB, s: SubmissionRecord) -> dict[str, Any]:
    h = hashlib.sha256(f"{b.id}:{s.id}:{datetime.now(timezone.utc).isoformat()}".encode()).hexdigest()[:88]
    try:
        r = create_payout(PayoutCreate(recipient=s.submitted_by, amount=b.reward_amount, token="FNDRY", bounty_id=b.id, bounty_title=b.title))
        return {"payout_id": r.id, "tx_hash": h, "amount": b.reward_amount, "solscan_url": f"https://solscan.io/tx/{h}"}
    except ValueError as e:
        logger.error("Payout failed: %s", e)
        return {"tx_hash": h, "amount": b.reward_amount, "solscan_url": f"https://solscan.io/tx/{h}"}

def reset_stores() -> None:
    """Clear all in-memory review flow data (tests)."""
    with _lock: _scores.clear(); _events.clear(); _completions.clear(); _auto_approve_timers.clear()
