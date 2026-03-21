"""Bounty lifecycle API endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.services import lifecycle_service as LS
from app.services.lifecycle_service import ClaimResponse, DeadlineCheckResponse, LifecycleEventResponse

router = APIRouter(prefix="/lifecycle", tags=["lifecycle"])
class BidReq(BaseModel): bounty_id: str
class ClaimReq(BaseModel): bounty_id: str; bounty_tier: int = Field(1, ge=1, le=3)
class ReviewReq(BaseModel): bounty_id: str; pr_url: str = ""
class WHReq(BaseModel): bounty_id: str; action: str; pr_url: str = ""; sender: str = ""; merged: bool = False
class StateResp(BaseModel): bounty_id: str; state: str; has_active_claim: bool; claim: Optional[ClaimResponse] = None

_M = {"BOUNTY_NOT_FOUND":404,"CLAIM_NOT_FOUND":404,"TERMINAL_STATE":409,"CLAIM_CONFLICT":409,"TIER_GATE":403}
def _err(e): raise HTTPException(status_code=_M.get(e.code,400), detail={"message":e.message,"code":e.code})
def _a(u): return u.wallet_address or str(u.id)
def _ev(e): return LifecycleEventResponse(**e.model_dump())
def _do(fn, *a):
    try: return fn(*a)
    except LS.LifecycleError as e: _err(e)

@router.post("/initialize", response_model=LifecycleEventResponse)
async def ep_init(r: BidReq, u: UserResponse = Depends(get_current_user)):
    return _ev(_do(LS.initialize_bounty, r.bounty_id, _a(u)))
@router.post("/open", response_model=LifecycleEventResponse)
async def ep_open(r: BidReq, u: UserResponse = Depends(get_current_user)):
    return _ev(_do(LS.open_bounty, r.bounty_id, _a(u)))
@router.post("/claim", response_model=ClaimResponse)
async def ep_claim(r: ClaimReq, u: UserResponse = Depends(get_current_user)):
    cl = _do(LS.claim_bounty, r.bounty_id, _a(u), r.bounty_tier)
    st = LS.get_lifecycle_state(r.bounty_id)
    return ClaimResponse(claim_id=cl.claim_id, bounty_id=cl.bounty_id, contributor_id=cl.contributor_id,
                         claimed_at=cl.claimed_at, deadline=cl.deadline, state=st.value)
@router.post("/release", response_model=LifecycleEventResponse)
async def ep_release(r: BidReq, u: UserResponse = Depends(get_current_user)):
    return _ev(_do(LS.release_claim, r.bounty_id, _a(u), "manual"))
@router.post("/review", response_model=LifecycleEventResponse)
async def ep_review(r: ReviewReq, u: UserResponse = Depends(get_current_user)):
    return _ev(_do(LS.submit_for_review, r.bounty_id, _a(u), r.pr_url))
@router.post("/complete", response_model=LifecycleEventResponse)
async def ep_complete(r: BidReq, u: UserResponse = Depends(get_current_user)):
    return _ev(_do(LS.complete_bounty, r.bounty_id, _a(u)))
@router.post("/pay", response_model=LifecycleEventResponse)
async def ep_pay(r: BidReq, u: UserResponse = Depends(get_current_user)):
    return _ev(_do(LS.pay_bounty, r.bounty_id, _a(u)))
@router.post("/cancel", response_model=LifecycleEventResponse)
async def ep_cancel(r: BidReq, u: UserResponse = Depends(get_current_user)):
    return _ev(_do(LS.cancel_bounty, r.bounty_id, _a(u)))
@router.post("/webhook/pr", response_model=Optional[LifecycleEventResponse])
async def ep_wh(r: WHReq):
    ev = LS.handle_pr_event(r.bounty_id, r.action, r.pr_url, r.sender, r.merged)
    return _ev(ev) if ev else None
@router.post("/deadlines/enforce", response_model=DeadlineCheckResponse)
async def ep_enforce(): return LS.enforce_deadlines()
@router.get("/{bounty_id}/state", response_model=StateResp)
async def ep_state(bounty_id: str):
    st = _do(LS.get_lifecycle_state, bounty_id); cl = LS.get_claim(bounty_id)
    cr = ClaimResponse(claim_id=cl.claim_id, bounty_id=cl.bounty_id, contributor_id=cl.contributor_id,
                       claimed_at=cl.claimed_at, deadline=cl.deadline, state=st.value) if cl else None
    return StateResp(bounty_id=bounty_id, state=st.value, has_active_claim=cl is not None, claim=cr)
@router.get("/{bounty_id}/audit", response_model=list[LifecycleEventResponse])
async def ep_baudit(bounty_id: str, limit: int = Query(50, ge=1, le=200)):
    return [_ev(e) for e in LS.get_audit_log(bounty_id, limit)]
@router.get("/audit", response_model=list[LifecycleEventResponse])
async def ep_gaudit(limit: int = Query(50, ge=1, le=200)):
    return [_ev(e) for e in LS.get_audit_log(limit=limit)]
