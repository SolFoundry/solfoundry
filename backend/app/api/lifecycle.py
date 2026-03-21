"""Bounty lifecycle API router (Issue #164).

Endpoints: draft/publish, claim/release, review, approve/reject,
paid, webhook, deadline enforcement, audit log.
All mutation endpoints require authentication (including webhook-transition).
PostgreSQL migration: in-memory stores are MVP; swap for async SQLAlchemy.
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


def _ok(r):
    """Unpack (data, error); raise typed HTTP errors (NotFound->404, Validation->400)."""
    d, e = r
    if e:
        raise HTTPException(
            status_code=404 if isinstance(e, LifecycleNotFoundError) else 400,
            detail=str(e))
    return d


@router.post("/draft", status_code=201)
async def create_draft(data: BountyCreate, u: str = Depends(get_current_user_id)):
    """Create bounty in draft status."""
    return _ok(svc.create_draft_bounty(data))


@router.post("/{bid}/publish")
async def publish(bid: str, triggered_by: str = Query("system", min_length=1),
                  u: str = Depends(get_current_user_id)):
    """Publish draft -> open."""
    return _ok(svc.publish_bounty(bid, triggered_by))


@router.post("/{bid}/claim", status_code=201)
async def claim(bid: str, data: ClaimRequest, u: str = Depends(get_current_user_id)):
    """Claim T2/T3 bounty."""
    return _ok(svc.claim_bounty(bid, data))


@router.post("/{bid}/release")
async def release(bid: str, data: ReleaseClaimRequest,
                  u: str = Depends(get_current_user_id)):
    """Release claim."""
    return _ok(svc.release_claim(bid, data))


@router.post("/{bid}/review")
async def review(bid: str, pr_url: str = Query(..., min_length=1),
                 submitted_by: str = Query(..., min_length=1),
                 u: str = Depends(get_current_user_id)):
    """Submit for review. pr_url validated non-empty here; service validates full URL."""
    return _ok(svc.submit_for_review(bid, pr_url, submitted_by))


@router.post("/{bid}/approve")
async def approve(bid: str, triggered_by: str = Query("system", min_length=1),
                  u: str = Depends(get_current_user_id)):
    """Approve -> completed."""
    return _ok(svc.approve_bounty(bid, triggered_by))


@router.post("/{bid}/reject")
async def reject(bid: str, triggered_by: str = Query("system", min_length=1),
                 reason: Optional[str] = Query(None, max_length=500),
                 u: str = Depends(get_current_user_id)):
    """Reject, reopen bounty."""
    return _ok(svc.reject_bounty(bid, triggered_by, reason))


@router.post("/{bid}/paid")
async def paid(bid: str, triggered_by: str = Query("system", min_length=1),
               transaction_hash: Optional[str] = Query(None),
               u: str = Depends(get_current_user_id)):
    """Mark as paid."""
    return _ok(svc.mark_paid(bid, triggered_by, transaction_hash))


@router.post("/{bid}/webhook-transition")
async def webhook(bid: str, data: WebhookTransitionRequest,
                  u: str = Depends(get_current_user_id)):
    """Handle PR webhook (auth required; internal handler uses dispatch_pr_event)."""
    return _ok(svc.handle_webhook(bid, data))


@router.post("/lifecycle/enforce-deadlines")
async def enforce_deadlines(u: str = Depends(get_current_user_id)):
    """Warn at 80%, release at 100%."""
    return svc.enforce_deadlines()


@router.get("/{bid}/audit-log")
async def audit_log(bid: str):
    """Get audit log. Returns 404 if bounty missing."""
    r = svc.get_audit_log(bid)
    if r is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return r


@router.get("/{bid}/claim")
async def active_claim(bid: str):
    """Get active claim. Returns 404 if bounty missing."""
    r = svc.get_active_claim(bid)
    if r is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return r


@router.get("/{bid}/lifecycle")
async def lifecycle_summary(bid: str):
    """Lifecycle summary."""
    r = svc.get_lifecycle_summary(bid)
    if not r:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return r
