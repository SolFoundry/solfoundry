"""Bounty lifecycle state machine and claim management (Issue #164).

draft -> open -> claimed -> in_review -> completed -> paid.
T1 open-race, T2/T3 claim with deadline, webhooks, audit log.
PostgreSQL migration: lifecycle_audit_log, bounty_claims tables.
"""

import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional
from app.models.bounty import BountyDB, BountyStatus, BountyTier
from app.models.lifecycle import (
    AuditLogEntry, ClaimRecord, ClaimRequest, LifecycleAction,
    ReleaseClaimRequest, WebhookTransitionRequest,
)
from app.services.bounty_service import _bounty_store, _to_bounty_response

logger = logging.getLogger(__name__)
_audit_log: list[AuditLogEntry] = []
_claims: dict[str, ClaimRecord] = {}
_claim_lock = threading.Lock()
DEFAULT_CLAIM_DEADLINE_HOURS = 168

TRANSITIONS: dict[str, dict[str, str]] = {
    LifecycleAction.PUBLISH: {"draft": "open"},
    LifecycleAction.CLAIM: {"open": "claimed"},
    LifecycleAction.RELEASE_CLAIM: {"claimed": "open"},
    LifecycleAction.SUBMIT_FOR_REVIEW: {"claimed": "in_review", "open": "in_review"},
    LifecycleAction.APPROVE: {"in_review": "completed"},
    LifecycleAction.REJECT: {"in_review": "open"},
    LifecycleAction.MARK_PAID: {"completed": "paid"},
    LifecycleAction.AUTO_RELEASE: {"claimed": "open"},
    LifecycleAction.WEBHOOK_UPDATE: {"open": "in_review", "claimed": "in_review"},
}


def _log(bid, fr, to, act, by="system", reason=None, meta=None):
    """Record audit log entry."""
    e = AuditLogEntry(bounty_id=bid, from_status=fr, to_status=to,
                      action=act, triggered_by=by, reason=reason, metadata=meta or {})
    _audit_log.append(e)
    return e


def _check(b, act):
    """Validate transition is allowed from current status."""
    m = TRANSITIONS.get(act)
    if not m:
        return None, "Unknown action"
    t = m.get(b.status.value)
    return (t, None) if t else (None, f"Not allowed from '{b.status.value}'")


def _do(bid, act, by="system", reason=None, meta=None):
    """Apply transition + log. Returns (result_dict, error)."""
    b = _bounty_store.get(bid)
    if not b:
        return None, "Bounty not found"
    t, err = _check(b, act)
    if err:
        return None, err
    prev = b.status.value
    b.status = BountyStatus(t)
    b.updated_at = datetime.now(timezone.utc)
    e = _log(bid, prev, t, act, by, reason, meta)
    return {"bounty_id": bid, "previous_status": prev, "new_status": t,
            "action": act, "triggered_by": by, "audit_log_id": e.id}, None


def create_draft_bounty(data):
    """Create bounty in draft status."""
    b = BountyDB(title=data.title, description=data.description, tier=data.tier,
                 reward_amount=data.reward_amount, github_issue_url=data.github_issue_url,
                 required_skills=data.required_skills, deadline=data.deadline,
                 created_by=data.created_by, status=BountyStatus.DRAFT)
    _bounty_store[b.id] = b
    _log(b.id, "", "draft", LifecycleAction.CREATE_DRAFT, data.created_by)
    return _to_bounty_response(b).model_dump(mode="json"), None


def publish_bounty(bid, by="system"):
    """Publish draft -> open."""
    return _do(bid, LifecycleAction.PUBLISH, by)


def claim_bounty(bid, req):
    """Claim T2/T3 bounty with deadline (atomic via lock)."""
    with _claim_lock:
        b = _bounty_store.get(bid)
        if not b:
            return None, "Bounty not found"
        if b.tier == BountyTier.T1:
            return None, "T1 bounties use open-race mode and cannot be claimed"
        if bid in _claims and not _claims[bid].released:
            return None, "Bounty already claimed by " + _claims[bid].claimed_by
        t, err = _check(b, LifecycleAction.CLAIM)
        if err:
            return None, err
        now = datetime.now(timezone.utc)
        hrs = req.estimated_hours or DEFAULT_CLAIM_DEADLINE_HOURS
        dl = now + timedelta(hours=hrs)
        b.status = BountyStatus(t)
        b.updated_at = now
        _claims[bid] = ClaimRecord(bounty_id=bid, claimed_by=req.claimed_by,
                                   claimed_at=now, deadline=dl, estimated_hours=req.estimated_hours)
        _log(bid, "open", t, LifecycleAction.CLAIM, req.claimed_by, "Claimed",
             {"deadline": dl.isoformat(), "estimated_hours": hrs})
    return {"bounty_id": bid, "claimed_by": req.claimed_by,
            "claimed_at": now.isoformat(), "deadline": dl.isoformat(),
            "estimated_hours": req.estimated_hours}, None


def release_claim(bid, req):
    """Release claim, reopen bounty."""
    b = _bounty_store.get(bid)
    if not b:
        return None, "Bounty not found"
    t, err = _check(b, LifecycleAction.RELEASE_CLAIM)
    if err:
        return None, err
    cl = _claims.get(bid)
    if not cl or cl.released:
        return None, "No active claim found for this bounty"
    prev = b.status.value
    b.status = BountyStatus(t)
    b.updated_at = datetime.now(timezone.utc)
    cl.released = True
    cl.released_at = datetime.now(timezone.utc)
    e = _log(bid, prev, t, LifecycleAction.RELEASE_CLAIM, req.released_by, req.reason)
    return {"bounty_id": bid, "previous_status": prev, "new_status": t,
            "action": LifecycleAction.RELEASE_CLAIM.value,
            "triggered_by": req.released_by, "audit_log_id": e.id}, None


def submit_for_review(bid, pr_url, by):
    """Move bounty to in_review."""
    return _do(bid, LifecycleAction.SUBMIT_FOR_REVIEW, by, None, {"pr_url": pr_url})


def approve_bounty(bid, by="system"):
    """Approve in-review -> completed."""
    return _do(bid, LifecycleAction.APPROVE, by)


def reject_bounty(bid, by="system", reason=None):
    """Reject submission, reopen."""
    b = _bounty_store.get(bid)
    if not b:
        return None, "Bounty not found"
    t, err = _check(b, LifecycleAction.REJECT)
    if err:
        return None, err
    prev = b.status.value
    b.status = BountyStatus(t)
    b.updated_at = datetime.now(timezone.utc)
    if bid in _claims:
        _claims[bid].released = True
    e = _log(bid, prev, t, LifecycleAction.REJECT, by, reason or "Rejected")
    return {"bounty_id": bid, "previous_status": prev, "new_status": t,
            "action": LifecycleAction.REJECT.value,
            "triggered_by": by, "audit_log_id": e.id}, None


def mark_paid(bid, by="system", tx_hash=None):
    """Mark completed bounty as paid."""
    return _do(bid, LifecycleAction.MARK_PAID, by, None,
               {"transaction_hash": tx_hash} if tx_hash else {})


def handle_webhook(bid, req):
    """PR webhook: opened->review, merged->completed, closed->reopen.

    Fallback to WEBHOOK_UPDATE only for 'opened'; merged/closed fail
    immediately if primary action is invalid from current state.
    """
    b = _bounty_store.get(bid)
    if not b:
        return None, "Bounty not found"
    amap = {"opened": LifecycleAction.SUBMIT_FOR_REVIEW,
            "merged": LifecycleAction.APPROVE, "closed": LifecycleAction.REJECT}
    act = amap.get(req.pr_action)
    if not act:
        return None, "Unsupported action"
    t, err = _check(b, act)
    if err:
        if req.pr_action == "opened":
            t, err = _check(b, LifecycleAction.WEBHOOK_UPDATE)
            if err:
                return None, err
        else:
            return None, err
    prev = b.status.value
    b.status = BountyStatus(t)
    b.updated_at = datetime.now(timezone.utc)
    meta = {"pr_url": req.pr_url, "pr_action": req.pr_action}
    if req.pr_action == "merged" and b.tier == BountyTier.T1:
        meta["auto_approved"] = True
    e = _log(bid, prev, t, LifecycleAction.WEBHOOK_UPDATE, req.sender,
             "PR " + req.pr_action, meta)
    return {"bounty_id": bid, "previous_status": prev, "new_status": t,
            "action": LifecycleAction.WEBHOOK_UPDATE.value,
            "triggered_by": req.sender, "audit_log_id": e.id}, None


def enforce_deadlines():
    """Warn at 80% elapsed, auto-release at 100%. Uses warning_sent flag."""
    now = datetime.now(timezone.utc)
    out = []
    for bid, cl in list(_claims.items()):
        if cl.released or not cl.deadline:
            continue
        b = _bounty_store.get(bid)
        if not b or b.status != BountyStatus.CLAIMED:
            continue
        total = (cl.deadline - cl.claimed_at).total_seconds()
        if total <= 0:
            continue
        pct = min(((now - cl.claimed_at).total_seconds() / total) * 100, 100)
        if pct >= 100:
            b.status = BountyStatus.OPEN
            b.updated_at = now
            cl.released = True
            cl.released_at = now
            _log(bid, "claimed", "open", LifecycleAction.AUTO_RELEASE, "system")
            out.append({"bounty_id": bid, "action_taken": "auto_released",
                        "percent_elapsed": 100.0, "claimed_by": cl.claimed_by})
        elif pct >= 80 and not cl.warning_sent:
            cl.warning_sent = True
            _log(bid, "claimed", "claimed", LifecycleAction.DEADLINE_WARNING, "system")
            out.append({"bounty_id": bid, "action_taken": "warning_issued",
                        "percent_elapsed": round(pct, 1), "claimed_by": cl.claimed_by})
    return out


def get_audit_log(bid):
    """Audit log for bounty (newest first). Returns None if bounty missing."""
    if not _bounty_store.get(bid):
        return None
    return [e.model_dump(mode="json") for e in
            sorted((e for e in _audit_log if e.bounty_id == bid),
                   key=lambda e: e.created_at, reverse=True)]


def get_active_claim(bid):
    """Active claim for bounty. Returns None if bounty missing."""
    if not _bounty_store.get(bid):
        return None
    cl = _claims.get(bid)
    if cl and not cl.released:
        return {"bounty_id": cl.bounty_id, "claimed_by": cl.claimed_by,
                "claimed_at": cl.claimed_at.isoformat(),
                "deadline": cl.deadline.isoformat() if cl.deadline else None,
                "estimated_hours": cl.estimated_hours}
    return {"active": False}


def get_lifecycle_summary(bid):
    """Lifecycle state summary for a bounty."""
    b = _bounty_store.get(bid)
    if not b:
        return None
    return {"bounty_id": bid, "current_status": b.status.value,
            "claim": get_active_claim(bid),
            "audit_log_count": sum(1 for e in _audit_log if e.bounty_id == bid)}


def dispatch_pr_event(bid, pr_action, pr_url, sender):
    """Dispatch PR event from existing GitHub webhook handler."""
    req = WebhookTransitionRequest(pr_url=pr_url, pr_action=pr_action, sender=sender)
    return handle_webhook(bid, req)
