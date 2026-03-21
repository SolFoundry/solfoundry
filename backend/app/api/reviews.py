"""Review flow API (Closes #191)."""
from typing import Optional
from fastapi import APIRouter,Depends,HTTPException
from app.api.auth import get_current_user_id
from app.services.review_flow_service import *
router=APIRouter(prefix="/bounties",tags=["reviews"])
_M={BountyNotFoundError:404,SubmissionNotFoundError:404,UnauthorizedApprovalError:403,DuplicateReviewError:409,InvalidStateTransitionError:400,AlreadyDisputedError:400,InsufficientReviewError:400}
def _e(e):
    """HTTP err."""
    raise HTTPException(status_code=_M.get(type(e),500),detail=str(e))from e
_A=ReviewFlowError
@router.post("/{bid}/submissions/{sid}/review",response_model=ReviewSummary)
async def start_review(bid:str,sid:str,u:str=Depends(get_current_user_id)):
    """Submit."""
    try:return submit_for_review(bid,sid,u)
    except _A as e:_e(e)
@router.post("/{bid}/submissions/{sid}/scores",response_model=ReviewSummary,status_code=201)
async def add_score(bid:str,sid:str,d:ReviewScoreCreate,u:str=Depends(get_current_user_id)):
    """Score."""
    try:return record_review_score(bid,sid,d)
    except _A as e:_e(e)
@router.post("/{bid}/submissions/{sid}/decision",response_model=CompletionState)
async def decide(bid:str,sid:str,r:CreatorDecisionRequest,u:str=Depends(get_current_user_id)):
    """Decide."""
    try:return creator_decision(bid,sid,u,r)
    except _A as e:_e(e)
@router.post("/{bid}/submissions/{sid}/auto-approve",response_model=Optional[CompletionState])
async def auto_approve(bid:str,sid:str,u:str=Depends(get_current_user_id)):
    """Auto-approve."""
    try:return check_auto_approve(bid,sid)
    except _A as e:_e(e)
@router.get("/{bid}/submissions/{sid}/scores",response_model=ReviewSummary)
async def get_scores(bid:str,sid:str):
    """Scores."""
    try:return get_review_summary(bid,sid)
    except _A as e:_e(e)
@router.get("/{bid}/completion",response_model=Optional[CompletionState])
async def completion(bid:str):
    """Completion."""
    return get_completion_state(bid)
@router.get("/{bid}/lifecycle",response_model=list[LifecycleEvent])
async def lifecycle(bid:str):
    """Events."""
    return get_lifecycle_events(bid)
