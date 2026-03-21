"""Bounty Lifecycle API (Issue #164).

REST endpoints for lifecycle: initialise, open, claim, review, complete, pay,
cancel + GitHub PR webhook (HMAC) + deadline cron + scoped audit logs.
All mutations require authentication via get_current_user dependency.
"""
import hashlib, hmac, json, os
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.services import lifecycle_service as ls
from app.services.lifecycle_service import ClaimResponse, DeadlineCheckResponse, LifecycleEventResponse

router = APIRouter(prefix="/lifecycle", tags=["lifecycle"])
WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")
auth = Depends(get_current_user)

# -- Request / response schemas --

class BountyIdRequest(BaseModel):
    """Request targeting a bounty by ID."""
    bounty_id: str

class ClaimRequest(BaseModel):
    """Request to claim a bounty, with tier for gate enforcement."""
    bounty_id: str; bounty_tier: int = Field(1, ge=1, le=3)

class ReviewRequest(BaseModel):
    """Request to submit a PR for review."""
    bounty_id: str; pr_url: str = ""

class WebhookPRPayload(BaseModel):
    """GitHub pull_request webhook fields needed by lifecycle engine."""
    bounty_id: str; action: str; pr_url: str = ""; sender: str = ""; merged: bool = False

class BountyStateResponse(BaseModel):
    """Current lifecycle state and optional active claim."""
    bounty_id: str; state: str; has_active_claim: bool; claim: Optional[ClaimResponse] = None

# -- Helpers --

STATUS_MAP = {"BOUNTY_NOT_FOUND": 404, "CLAIM_NOT_FOUND": 404, "TERMINAL_STATE": 409,
              "CLAIM_CONFLICT": 409, "INVALID_TRANSITION": 400, "TIER_GATE": 403, "OWNERSHIP_ERROR": 403}

def _actor(user: UserResponse) -> str:
    """Extract stable actor identity: prefer wallet, fallback to user id."""
    return user.wallet_address or str(user.id)

def _resp(event: ls.LifecycleEvent) -> LifecycleEventResponse:
    """Convert internal event to API response model."""
    return LifecycleEventResponse(**event.model_dump())

def _run(operation, *args):
    """Call lifecycle operation, mapping LifecycleError to HTTPException."""
    try: return operation(*args)
    except ls.LifecycleError as e: raise HTTPException(STATUS_MAP.get(e.code, 400), {"message": e.message, "code": e.code})

def _claim_resp(claim: ls.ClaimRecord, state: str) -> ClaimResponse:
    """Build ClaimResponse from internal record."""
    return ClaimResponse(claim_id=claim.claim_id, bounty_id=claim.bounty_id,
                         contributor_id=claim.contributor_id, claimed_at=claim.claimed_at,
                         deadline=claim.deadline, state=state)

# -- Lifecycle mutations (all require auth) --

@router.post("/initialize", response_model=LifecycleEventResponse)
async def initialize_bounty(req: BountyIdRequest, user: UserResponse = auth):
    """Register bounty in DRAFT state. Idempotent on repeated calls."""
    return _resp(_run(ls.initialize_bounty, req.bounty_id, _actor(user)))

@router.post("/open", response_model=LifecycleEventResponse)
async def open_bounty(req: BountyIdRequest, user: UserResponse = auth):
    """DRAFT -> OPEN. Bounty becomes visible and claimable."""
    return _resp(_run(ls.open_bounty, req.bounty_id, _actor(user)))

@router.post("/claim", response_model=ClaimResponse)
async def claim_bounty(req: ClaimRequest, user: UserResponse = auth):
    """Claim open bounty. 72h deadline, tier-gate for T2/T3, single-claim lock."""
    claim = _run(ls.claim_bounty, req.bounty_id, _actor(user), req.bounty_tier)
    return _claim_resp(claim, ls.get_lifecycle_state(req.bounty_id).value)

@router.post("/release", response_model=LifecycleEventResponse)
async def release_claim(req: BountyIdRequest, user: UserResponse = auth):
    """Release active claim -> OPEN. Allowed by claimant, creator, or system."""
    return _resp(_run(ls.release_claim, req.bounty_id, _actor(user), "manual"))

@router.post("/review", response_model=LifecycleEventResponse)
async def submit_for_review(req: ReviewRequest, user: UserResponse = auth):
    """Submit PR -> IN_REVIEW. T1 open-race or claimant-only for claimed bounties."""
    return _resp(_run(ls.submit_for_review, req.bounty_id, _actor(user), req.pr_url))

@router.post("/complete", response_model=LifecycleEventResponse)
async def complete_bounty(req: BountyIdRequest, user: UserResponse = auth):
    """IN_REVIEW -> COMPLETED. Creator-only (system/treasury bypass)."""
    return _resp(_run(ls.complete_bounty, req.bounty_id, _actor(user)))

@router.post("/pay", response_model=LifecycleEventResponse)
async def pay_bounty(req: BountyIdRequest, user: UserResponse = auth):
    """COMPLETED -> PAID (terminal). Creator-only."""
    return _resp(_run(ls.pay_bounty, req.bounty_id, _actor(user)))

@router.post("/cancel", response_model=LifecycleEventResponse)
async def cancel_bounty(req: BountyIdRequest, user: UserResponse = auth):
    """Cancel from any non-terminal state. Creator-only. Releases active claim."""
    return _resp(_run(ls.cancel_bounty, req.bounty_id, _actor(user)))

# -- Webhook (HMAC-SHA256, no JWT) --

@router.post("/webhook/pr", response_model=Optional[LifecycleEventResponse])
async def handle_webhook_pr(request: Request, sig: Optional[str] = Header(None, alias="X-Hub-Signature-256")):
    """GitHub PR webhook with HMAC verification. Fail-closed if no secret configured."""
    raw = await request.body()
    if not WEBHOOK_SECRET: raise HTTPException(503, "Webhook secret not configured")
    if not sig or not sig.startswith("sha256="): raise HTTPException(401, "Missing X-Hub-Signature-256")
    expected = "sha256=" + hmac.new(WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig): raise HTTPException(401, "HMAC verification failed")
    p = WebhookPRPayload(**json.loads(raw))
    ev = ls.handle_pr_event(p.bounty_id, p.action, p.pr_url, p.sender, p.merged)
    return _resp(ev) if ev else None

# -- Deadline enforcement --

@router.post("/deadlines/enforce", response_model=DeadlineCheckResponse)
async def enforce_deadlines(user: UserResponse = auth):
    """Sweep active claims: warn >=80%, auto-release >=100%. Cron-friendly."""
    return ls.enforce_deadlines()

# -- Query endpoints --

@router.get("/{bounty_id}/state", response_model=BountyStateResponse)
async def get_bounty_state(bounty_id: str, user: UserResponse = auth):
    """Query current lifecycle state and active claim for a bounty."""
    cur = _run(ls.get_lifecycle_state, bounty_id); active = ls.get_claim(bounty_id)
    return BountyStateResponse(bounty_id=bounty_id, state=cur.value,
        has_active_claim=active is not None, claim=_claim_resp(active, cur.value) if active else None)

@router.get("/{bounty_id}/audit", response_model=list[LifecycleEventResponse])
async def get_bounty_audit(bounty_id: str, user: UserResponse = auth, limit: int = Query(50, ge=1, le=200)):
    """Bounty-scoped audit log. Restricted to participants (creator or event actors)."""
    if not ls.is_bounty_participant(bounty_id, _actor(user)):
        raise HTTPException(403, "Only bounty participants can view the audit log")
    return [_resp(e) for e in ls.get_audit_log(bounty_id=bounty_id, limit=limit)]

@router.get("/audit", response_model=list[LifecycleEventResponse])
async def get_user_audit(user: UserResponse = auth, limit: int = Query(50, ge=1, le=200)):
    """User-scoped audit log showing only the authenticated user's own events."""
    return [_resp(e) for e in ls.get_audit_log(limit=limit, actor_filter=_actor(user))]
