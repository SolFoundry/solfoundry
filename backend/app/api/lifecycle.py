"""Bounty lifecycle API router (Issue #164).

Endpoints: draft/publish, claim/release, review, approve/reject,
paid, webhook, deadline enforcement, audit log.
All mutation endpoints require authentication (including webhook-transition).

PostgreSQL migration path: endpoints back onto lifecycle_audit_log and
bounty_claims tables.  In-memory stores are the MVP implementation;
swap ``_bounty_store``, ``_audit_log``, and ``_claims`` for async
SQLAlchemy repositories when PostgreSQL is available.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth import get_current_user_id
from app.models.bounty import BountyCreate
from app.models.lifecycle import (
    ClaimRequest, LifecycleNotFoundError, LifecycleValidationError,
    ReleaseClaimRequest, WebhookTransitionRequest,
)
from app.services import lifecycle_service as svc

router = APIRouter(prefix="/api/bounties", tags=["lifecycle"])


def _ok(result: tuple) -> dict:
    """Unpack a (data, error) service tuple; raise typed HTTP errors.

    Uses LifecycleNotFoundError for 404 and LifecycleValidationError for
    400 instead of fragile string matching.
    """
    data, error = result
    if error:
        raise HTTPException(
            status_code=404 if isinstance(error, LifecycleNotFoundError) else 400,
            detail=str(error),
        )
    return data


@router.post("/draft", status_code=201)
async def create_draft(data: BountyCreate, user_id: str = Depends(get_current_user_id)):
    """Create a bounty in draft status."""
    return _ok(svc.create_draft_bounty(data))


@router.post("/{bid}/publish")
async def publish(bid: str, triggered_by: str = Query("system", min_length=1),
                  user_id: str = Depends(get_current_user_id)):
    """Publish a draft bounty, transitioning it to open status."""
    return _ok(svc.publish_bounty(bid, triggered_by))


@router.post("/{bid}/claim", status_code=201)
async def claim(bid: str, data: ClaimRequest, user_id: str = Depends(get_current_user_id)):
    """Claim a T2/T3 bounty with an optional time estimate."""
    return _ok(svc.claim_bounty(bid, data))


@router.post("/{bid}/release")
async def release(bid: str, data: ReleaseClaimRequest,
                  user_id: str = Depends(get_current_user_id)):
    """Release an active claim so others can pick up the bounty."""
    return _ok(svc.release_claim(bid, data))


@router.post("/{bid}/review")
async def review(bid: str, pr_url: str = Query(..., min_length=1),
                 submitted_by: str = Query(..., min_length=1),
                 user_id: str = Depends(get_current_user_id)):
    """Submit a bounty for multi-LLM review.

    Note: pr_url is validated for non-empty here; the service layer
    performs full GitHub URL validation via the WebhookTransitionRequest
    model when the URL is persisted or forwarded.
    """
    return _ok(svc.submit_for_review(bid, pr_url, submitted_by))


@router.post("/{bid}/approve")
async def approve(bid: str, triggered_by: str = Query("system", min_length=1),
                  user_id: str = Depends(get_current_user_id)):
    """Approve an in-review bounty, moving it to completed."""
    return _ok(svc.approve_bounty(bid, triggered_by))


@router.post("/{bid}/reject")
async def reject(bid: str, triggered_by: str = Query("system", min_length=1),
                 reason: Optional[str] = Query(None, max_length=500),
                 user_id: str = Depends(get_current_user_id)):
    """Reject a submission and reopen the bounty."""
    return _ok(svc.reject_bounty(bid, triggered_by, reason))


@router.post("/{bid}/paid")
async def paid(bid: str, triggered_by: str = Query("system", min_length=1),
               transaction_hash: Optional[str] = Query(None),
               user_id: str = Depends(get_current_user_id)):
    """Mark a completed bounty as paid on-chain."""
    return _ok(svc.mark_paid(bid, triggered_by, transaction_hash))


@router.post("/{bid}/webhook-transition")
async def webhook(bid: str, data: WebhookTransitionRequest,
                  user_id: str = Depends(get_current_user_id)):
    """Handle a PR webhook event (opened/merged/closed).

    Requires authentication to prevent unauthenticated state mutations.
    The internal GitHub webhook handler (webhooks/github.py) calls the
    service layer directly via ``dispatch_pr_event``, bypassing this
    endpoint entirely.
    """
    return _ok(svc.handle_webhook(bid, data))


@router.post("/lifecycle/enforce-deadlines")
async def enforce_deadlines(user_id: str = Depends(get_current_user_id)):
    """Warn claimants at 80 percent elapsed, auto-release at 100 percent."""
    return svc.enforce_deadlines()


@router.get("/{bid}/audit-log")
async def audit_log(bid: str):
    """Return the full audit log for a bounty (newest first)."""
    result = svc.get_audit_log(bid)
    if result is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result


@router.get("/{bid}/claim")
async def active_claim(bid: str):
    """Return the active claim for a bounty, or 404 if bounty missing."""
    result = svc.get_active_claim(bid)
    if result is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result


@router.get("/{bid}/lifecycle")
async def lifecycle_summary(bid: str):
    """Return a lifecycle state summary for a bounty."""
    result = svc.get_lifecycle_summary(bid)
    if not result:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return result
