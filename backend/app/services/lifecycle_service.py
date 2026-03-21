"""Bounty lifecycle state machine and claim management (Issue #164).

State machine: draft -> open -> claimed -> in_review -> completed -> paid.
T1 bounties use open-race mode (no claim step); T2/T3 require claim with
a deadline enforced by ``enforce_deadlines``.

PostgreSQL migration path
-------------------------
Replace in-memory stores with async SQLAlchemy repositories:
- ``_bounty_store`` -> ``bounties`` table (already modelled in BountyDB).
- ``_audit_log`` -> ``lifecycle_audit_log`` table:
    id UUID PK, bounty_id FK, from_status TEXT, to_status TEXT,
    triggered_by TEXT, action TEXT, reason TEXT, metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now().
- ``_claims`` -> ``bounty_claims`` table:
    id UUID PK, bounty_id FK UNIQUE, claimed_by TEXT, claimed_at TIMESTAMPTZ,
    deadline TIMESTAMPTZ, estimated_hours INT, released BOOL DEFAULT FALSE,
    released_at TIMESTAMPTZ, warning_sent BOOL DEFAULT FALSE.
- ``_claim_lock`` -> row-level SELECT ... FOR UPDATE on bounty_claims.
"""

import logging
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from app.models.bounty import BountyDB, BountyStatus, BountyTier
from app.models.lifecycle import (
    AuditLogEntry, ClaimRecord, ClaimRequest, LifecycleAction,
    LifecycleNotFoundError, LifecycleValidationError,
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


def _log(
    bounty_id: str,
    from_status: str,
    to_status: str,
    action: str,
    triggered_by: str = "system",
    reason: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> AuditLogEntry:
    """Record an immutable audit log entry for a lifecycle transition."""
    entry = AuditLogEntry(
        bounty_id=bounty_id,
        from_status=from_status,
        to_status=to_status,
        action=action,
        triggered_by=triggered_by,
        reason=reason,
        metadata=metadata or {},
    )
    _audit_log.append(entry)
    return entry


def _check(
    bounty: BountyDB, action: str
) -> tuple[Optional[str], Optional[Exception]]:
    """Validate that *action* is allowed from the bounty's current status.

    Returns (target_status, None) on success or (None, error) on failure.
    """
    mapping = TRANSITIONS.get(action)
    if not mapping:
        return None, LifecycleValidationError("Unknown action")
    target = mapping.get(bounty.status.value)
    if target:
        return target, None
    return None, LifecycleValidationError(
        f"Not allowed from '{bounty.status.value}'"
    )


def _do(
    bounty_id: str,
    action: str,
    triggered_by: str = "system",
    reason: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> tuple[Optional[dict], Optional[Exception]]:
    """Apply a lifecycle transition atomically and record it in the audit log.

    Returns (result_dict, None) on success or (None, error) on failure.
    """
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None, LifecycleNotFoundError("Bounty not found")
    target, error = _check(bounty, action)
    if error:
        return None, error
    previous = bounty.status.value
    bounty.status = BountyStatus(target)
    bounty.updated_at = datetime.now(timezone.utc)
    entry = _log(bounty_id, previous, target, action, triggered_by, reason, metadata)
    return {
        "bounty_id": bounty_id,
        "previous_status": previous,
        "new_status": target,
        "action": action,
        "triggered_by": triggered_by,
        "audit_log_id": entry.id,
    }, None


def create_draft_bounty(data: "BountyCreate") -> tuple[dict, Optional[Exception]]:
    """Create a new bounty in draft status and log the creation event."""
    bounty = BountyDB(
        title=data.title,
        description=data.description,
        tier=data.tier,
        reward_amount=data.reward_amount,
        github_issue_url=data.github_issue_url,
        required_skills=data.required_skills,
        deadline=data.deadline,
        created_by=data.created_by,
        status=BountyStatus.DRAFT,
    )
    _bounty_store[bounty.id] = bounty
    _log(bounty.id, "", "draft", LifecycleAction.CREATE_DRAFT, data.created_by)
    return _to_bounty_response(bounty).model_dump(mode="json"), None


def publish_bounty(
    bounty_id: str, triggered_by: str = "system"
) -> tuple[Optional[dict], Optional[Exception]]:
    """Publish a draft bounty, transitioning it to open status."""
    return _do(bounty_id, LifecycleAction.PUBLISH, triggered_by)


def claim_bounty(
    bounty_id: str, request: ClaimRequest
) -> tuple[Optional[dict], Optional[Exception]]:
    """Claim a T2/T3 bounty with a deadline (atomic via lock).

    T1 bounties use open-race mode and cannot be claimed.
    """
    with _claim_lock:
        bounty = _bounty_store.get(bounty_id)
        if not bounty:
            return None, LifecycleNotFoundError("Bounty not found")
        if bounty.tier == BountyTier.T1:
            return None, LifecycleValidationError(
                "T1 bounties use open-race mode and cannot be claimed"
            )
        if bounty_id in _claims and not _claims[bounty_id].released:
            return None, LifecycleValidationError(
                "Bounty already claimed by " + _claims[bounty_id].claimed_by
            )
        target, error = _check(bounty, LifecycleAction.CLAIM)
        if error:
            return None, error
        now = datetime.now(timezone.utc)
        hours = request.estimated_hours or DEFAULT_CLAIM_DEADLINE_HOURS
        deadline = now + timedelta(hours=hours)
        bounty.status = BountyStatus(target)
        bounty.updated_at = now
        _claims[bounty_id] = ClaimRecord(
            bounty_id=bounty_id,
            claimed_by=request.claimed_by,
            claimed_at=now,
            deadline=deadline,
            estimated_hours=request.estimated_hours,
        )
        _log(
            bounty_id, "open", target, LifecycleAction.CLAIM, request.claimed_by,
            "Claimed", {"deadline": deadline.isoformat(), "estimated_hours": hours},
        )
    return {
        "bounty_id": bounty_id,
        "claimed_by": request.claimed_by,
        "claimed_at": now.isoformat(),
        "deadline": deadline.isoformat(),
        "estimated_hours": request.estimated_hours,
    }, None


def release_claim(
    bounty_id: str, request: ReleaseClaimRequest
) -> tuple[Optional[dict], Optional[Exception]]:
    """Release an active claim so the bounty reopens for others."""
    with _claim_lock:
        bounty = _bounty_store.get(bounty_id)
        if not bounty:
            return None, LifecycleNotFoundError("Bounty not found")
        target, error = _check(bounty, LifecycleAction.RELEASE_CLAIM)
        if error:
            return None, error
        claim = _claims.get(bounty_id)
        if not claim or claim.released:
            return None, LifecycleValidationError(
                "No active claim found for this bounty"
            )
        previous = bounty.status.value
        bounty.status = BountyStatus(target)
        bounty.updated_at = datetime.now(timezone.utc)
        claim.released = True
        claim.released_at = datetime.now(timezone.utc)
        entry = _log(
            bounty_id, previous, target, LifecycleAction.RELEASE_CLAIM,
            request.released_by, request.reason,
        )
    return {
        "bounty_id": bounty_id,
        "previous_status": previous,
        "new_status": target,
        "action": LifecycleAction.RELEASE_CLAIM.value,
        "triggered_by": request.released_by,
        "audit_log_id": entry.id,
    }, None


def submit_for_review(
    bounty_id: str, pr_url: str, submitted_by: str
) -> tuple[Optional[dict], Optional[Exception]]:
    """Move a bounty to in_review after a PR is submitted."""
    return _do(
        bounty_id, LifecycleAction.SUBMIT_FOR_REVIEW, submitted_by,
        None, {"pr_url": pr_url},
    )


def approve_bounty(
    bounty_id: str, triggered_by: str = "system"
) -> tuple[Optional[dict], Optional[Exception]]:
    """Approve an in-review bounty, transitioning to completed."""
    return _do(bounty_id, LifecycleAction.APPROVE, triggered_by)


def reject_bounty(
    bounty_id: str, triggered_by: str = "system", reason: Optional[str] = None
) -> tuple[Optional[dict], Optional[Exception]]:
    """Reject a submission and reopen the bounty for new attempts."""
    with _claim_lock:
        bounty = _bounty_store.get(bounty_id)
        if not bounty:
            return None, LifecycleNotFoundError("Bounty not found")
        target, error = _check(bounty, LifecycleAction.REJECT)
        if error:
            return None, error
        previous = bounty.status.value
        bounty.status = BountyStatus(target)
        bounty.updated_at = datetime.now(timezone.utc)
        if bounty_id in _claims:
            _claims[bounty_id].released = True
        entry = _log(
            bounty_id, previous, target, LifecycleAction.REJECT,
            triggered_by, reason or "Rejected",
        )
    return {
        "bounty_id": bounty_id,
        "previous_status": previous,
        "new_status": target,
        "action": LifecycleAction.REJECT.value,
        "triggered_by": triggered_by,
        "audit_log_id": entry.id,
    }, None


def mark_paid(
    bounty_id: str,
    triggered_by: str = "system",
    transaction_hash: Optional[str] = None,
) -> tuple[Optional[dict], Optional[Exception]]:
    """Mark a completed bounty as paid on-chain."""
    return _do(
        bounty_id, LifecycleAction.MARK_PAID, triggered_by, None,
        {"transaction_hash": transaction_hash} if transaction_hash else {},
    )


def handle_webhook(
    bounty_id: str, request: WebhookTransitionRequest
) -> tuple[Optional[dict], Optional[Exception]]:
    """Handle a PR webhook event and apply the appropriate transition.

    Mapping: opened -> in_review, merged -> completed, closed -> reopen.
    For T1 bounties, a ``merged`` event auto-approves (sets
    ``auto_approved: True`` in metadata) to implement the T1 open-race
    auto-win flow.

    Fallback: ``opened`` falls back to WEBHOOK_UPDATE if the primary
    SUBMIT_FOR_REVIEW action is invalid from the current state.
    ``merged`` and ``closed`` fail immediately if the primary action is
    invalid -- no silent fallback for terminal transitions.
    """
    with _claim_lock:
        bounty = _bounty_store.get(bounty_id)
        if not bounty:
            return None, LifecycleNotFoundError("Bounty not found")
        action_map = {
            "opened": LifecycleAction.SUBMIT_FOR_REVIEW,
            "merged": LifecycleAction.APPROVE,
            "closed": LifecycleAction.REJECT,
        }
        action = action_map.get(request.pr_action)
        if not action:
            return None, LifecycleValidationError("Unsupported action")
        target, error = _check(bounty, action)
        if error:
            if request.pr_action == "opened":
                target, error = _check(bounty, LifecycleAction.WEBHOOK_UPDATE)
                if error:
                    return None, error
            else:
                return None, error
        previous = bounty.status.value
        bounty.status = BountyStatus(target)
        bounty.updated_at = datetime.now(timezone.utc)
        metadata: dict[str, Any] = {
            "pr_url": request.pr_url,
            "pr_action": request.pr_action,
        }
        if request.pr_action == "merged" and bounty.tier == BountyTier.T1:
            metadata["auto_approved"] = True
        entry = _log(
            bounty_id, previous, target, LifecycleAction.WEBHOOK_UPDATE,
            request.sender, "PR " + request.pr_action, metadata,
        )
    return {
        "bounty_id": bounty_id,
        "previous_status": previous,
        "new_status": target,
        "action": LifecycleAction.WEBHOOK_UPDATE.value,
        "triggered_by": request.sender,
        "audit_log_id": entry.id,
    }, None


def enforce_deadlines() -> list[dict[str, Any]]:
    """Enforce claim deadlines: warn at 80 percent elapsed, auto-release at 100 percent.

    Uses the ``warning_sent`` flag on ClaimRecord to avoid duplicate warnings.
    """
    now = datetime.now(timezone.utc)
    results: list[dict[str, Any]] = []
    with _claim_lock:
        for bounty_id, claim in list(_claims.items()):
            if claim.released or not claim.deadline:
                continue
            bounty = _bounty_store.get(bounty_id)
            if not bounty or bounty.status != BountyStatus.CLAIMED:
                continue
            total = (claim.deadline - claim.claimed_at).total_seconds()
            if total <= 0:
                continue
            percent = min(
                ((now - claim.claimed_at).total_seconds() / total) * 100, 100
            )
            if percent >= 100:
                bounty.status = BountyStatus.OPEN
                bounty.updated_at = now
                claim.released = True
                claim.released_at = now
                _log(
                    bounty_id, "claimed", "open",
                    LifecycleAction.AUTO_RELEASE, "system",
                )
                results.append({
                    "bounty_id": bounty_id,
                    "action_taken": "auto_released",
                    "percent_elapsed": 100.0,
                    "claimed_by": claim.claimed_by,
                })
            elif percent >= 80 and not claim.warning_sent:
                claim.warning_sent = True
                _log(
                    bounty_id, "claimed", "claimed",
                    LifecycleAction.DEADLINE_WARNING, "system",
                )
                results.append({
                    "bounty_id": bounty_id,
                    "action_taken": "warning_issued",
                    "percent_elapsed": round(percent, 1),
                    "claimed_by": claim.claimed_by,
                })
    return results


def get_audit_log(bounty_id: str) -> Optional[list[dict]]:
    """Return the audit log for a bounty (newest first), or None if missing."""
    if not _bounty_store.get(bounty_id):
        return None
    return [
        entry.model_dump(mode="json")
        for entry in sorted(
            (e for e in _audit_log if e.bounty_id == bounty_id),
            key=lambda e: e.created_at,
            reverse=True,
        )
    ]


def get_active_claim(bounty_id: str) -> Optional[dict]:
    """Return the active claim for a bounty, or None if bounty is missing."""
    if not _bounty_store.get(bounty_id):
        return None
    claim = _claims.get(bounty_id)
    if claim and not claim.released:
        return {
            "bounty_id": claim.bounty_id,
            "claimed_by": claim.claimed_by,
            "claimed_at": claim.claimed_at.isoformat(),
            "deadline": claim.deadline.isoformat() if claim.deadline else None,
            "estimated_hours": claim.estimated_hours,
        }
    return {"active": False}


def get_lifecycle_summary(bounty_id: str) -> Optional[dict]:
    """Return a lifecycle state summary for a bounty."""
    bounty = _bounty_store.get(bounty_id)
    if not bounty:
        return None
    return {
        "bounty_id": bounty_id,
        "current_status": bounty.status.value,
        "claim": get_active_claim(bounty_id),
        "audit_log_count": sum(1 for e in _audit_log if e.bounty_id == bounty_id),
    }


def dispatch_pr_event(
    bounty_id: str, pr_action: str, pr_url: str, sender: str
) -> tuple[Optional[dict], Optional[Exception]]:
    """Dispatch a PR event from the GitHub webhook handler into the lifecycle engine."""
    request = WebhookTransitionRequest(
        pr_url=pr_url, pr_action=pr_action, sender=sender,
    )
    return handle_webhook(bounty_id, request)
