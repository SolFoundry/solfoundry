"""Lifecycle API (#164)."""
import hashlib, hmac, json, os
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from app.api.auth import get_current_user
from app.models.user import UserResponse as U
from app.services import lifecycle_service as LS
from app.services.lifecycle_service import ClaimResponse, DeadlineCheckResponse, LifecycleEventResponse as ER

router = APIRouter(prefix="/lifecycle", tags=["lifecycle"])
WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")
AU = Depends(get_current_user)

class BountyRequest(BaseModel):
    bounty_id: str
class ClaimRequest(BaseModel):
    bounty_id: str; bounty_tier: int = Field(1, ge=1, le=3)
class ReviewRequest(BaseModel):
    bounty_id: str; pr_url: str = ""
class WebhookPRRequest(BaseModel):
    bounty_id: str; action: str; pr_url: str = ""; sender: str = ""; merged: bool = False
class StateResponse(BaseModel):
    bounty_id: str; state: str; has_active_claim: bool; claim: Optional[ClaimResponse] = None

_M = {"BOUNTY_NOT_FOUND":404,"CLAIM_NOT_FOUND":404,"TERMINAL_STATE":409,"CLAIM_CONFLICT":409,"TIER_GATE":403,"OWNERSHIP_ERROR":403}
def _a(u): return u.wallet_address or str(u.id)
def _ev(e): return ER(**e.model_dump())
def _do(fn, *a):
    try: return fn(*a)
    except LS.LifecycleError as e: raise HTTPException(_M.get(e.code,400), {"message":e.message,"code":e.code})
def _cr(cl, sv): return ClaimResponse(**{k:v for k,v in cl.model_dump().items() if k in ClaimResponse.model_fields}, state=sv)

@router.post("/initialize", response_model=ER)
async def ep_init(r: BountyRequest, u: U = AU):
    """Init DRAFT."""
    return _ev(_do(LS.initialize_bounty, r.bounty_id, _a(u)))
@router.post("/open", response_model=ER)
async def ep_open(r: BountyRequest, u: U = AU):
    """DRAFT to OPEN."""
    return _ev(_do(LS.open_bounty, r.bounty_id, _a(u)))
@router.post("/claim", response_model=ClaimResponse)
async def ep_claim(r: ClaimRequest, u: U = AU):
    """Claim."""
    cl = _do(LS.claim_bounty, r.bounty_id, _a(u), r.bounty_tier)
    return _cr(cl, LS.get_lifecycle_state(r.bounty_id).value)
@router.post("/release", response_model=ER)
async def ep_release(r: BountyRequest, u: U = AU):
    """Release."""
    return _ev(_do(LS.release_claim, r.bounty_id, _a(u), "manual"))
@router.post("/review", response_model=ER)
async def ep_review(r: ReviewRequest, u: U = AU):
    """Review."""
    return _ev(_do(LS.submit_for_review, r.bounty_id, _a(u), r.pr_url))
@router.post("/complete", response_model=ER)
async def ep_complete(r: BountyRequest, u: U = AU):
    """Complete (creator-only)."""
    return _ev(_do(LS.complete_bounty, r.bounty_id, _a(u)))
@router.post("/pay", response_model=ER)
async def ep_pay(r: BountyRequest, u: U = AU):
    """Pay (creator-only)."""
    return _ev(_do(LS.pay_bounty, r.bounty_id, _a(u)))
@router.post("/cancel", response_model=ER)
async def ep_cancel(r: BountyRequest, u: U = AU):
    """Cancel (creator-only)."""
    return _ev(_do(LS.cancel_bounty, r.bounty_id, _a(u)))
@router.post("/webhook/pr", response_model=Optional[ER])
async def ep_wh(request: Request, sig: Optional[str] = Header(None, alias="X-Hub-Signature-256")):
    """PR webhook (HMAC)."""
    body = await request.body()
    if not WEBHOOK_SECRET: raise HTTPException(503, "No webhook secret")
    if not sig or not sig.startswith("sha256="): raise HTTPException(401, "No signature")
    exp = "sha256=" + hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(exp, sig): raise HTTPException(401, "Bad HMAC")
    d = WebhookPRRequest(**json.loads(body))
    ev = LS.handle_pr_event(d.bounty_id, d.action, d.pr_url, d.sender, d.merged)
    return _ev(ev) if ev else None
@router.post("/deadlines/enforce", response_model=DeadlineCheckResponse)
async def ep_enforce(u: U = AU):
    """Deadlines."""
    return LS.enforce_deadlines()
@router.get("/{bounty_id}/state", response_model=StateResponse)
async def ep_state(bounty_id: str, u: U = AU):
    """State."""
    st = _do(LS.get_lifecycle_state, bounty_id); cl = LS.get_claim(bounty_id)
    return StateResponse(bounty_id=bounty_id, state=st.value, has_active_claim=cl is not None, claim=_cr(cl, st.value) if cl else None)
@router.get("/{bounty_id}/audit", response_model=list[ER])
async def ep_baudit(bounty_id: str, u: U = AU, limit: int = Query(50, ge=1, le=200)):
    """Bounty audit."""
    if not LS.is_bounty_participant(bounty_id, _a(u)): raise HTTPException(403, "Not participant")
    return [_ev(e) for e in LS.get_audit_log(bounty_id, limit)]
@router.get("/audit", response_model=list[ER])
async def ep_gaudit(u: U = AU, limit: int = Query(50, ge=1, le=200)):
    """User audit."""
    return [_ev(e) for e in LS.get_audit_log(limit=limit, actor_filter=_a(u))]
