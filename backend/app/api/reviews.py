"""Bounty completion & review flow API (Closes #191)."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.api.auth import get_current_user
from app.models.user import UserResponse
from app.services.review_flow_service import *

router = APIRouter(prefix="/bounties", tags=["reviews"])
_S = {BountyNotFoundError:404, SubmissionNotFoundError:404, UnauthorizedApprovalError:403, DuplicateReviewError:409, InvalidStateTransitionError:400, AlreadyDisputedError:400}
    """The _e function."""
def _e(err): raise HTTPException(status_code=_S.get(type(err), 500), detail=str(err)) from err

@router.post("/{bid}/submissions/{sid}/review", response_model=ReviewSummary, summary="Start review")
async def start_review(bid: str, sid: str, user: UserResponse = Depends(get_current_user)):
    """The start_review function."""
    try: return submit_for_review(bid, sid, user.wallet_address or str(user.id))
    except (BountyNotFoundError, SubmissionNotFoundError, InvalidStateTransitionError) as e: _e(e)

@router.post("/{bid}/submissions/{sid}/scores", response_model=ReviewSummary, status_code=201, summary="Record AI score")
async def add_score(bid: str, sid: str, data: ReviewScoreCreate):
    """The add_score function."""
    try: return record_review_score(bid, sid, data)
    except (BountyNotFoundError, SubmissionNotFoundError, DuplicateReviewError) as e: _e(e)

@router.get("/{bid}/submissions/{sid}/scores", response_model=ReviewSummary, summary="Get scores")
async def get_scores(bid: str, sid: str):
    """The get_scores function."""
    try: return get_review_summary(bid, sid)
    except (BountyNotFoundError, SubmissionNotFoundError) as e: _e(e)

@router.post("/{bid}/submissions/{sid}/decision", response_model=CompletionState, summary="Creator decide")
async def decide(bid: str, sid: str, req: CreatorDecisionRequest, user: UserResponse = Depends(get_current_user)):
    """The decide function."""
    try: return creator_decision(bid, sid, user.wallet_address or str(user.id), req)
    except (BountyNotFoundError, SubmissionNotFoundError, UnauthorizedApprovalError, AlreadyDisputedError, InvalidStateTransitionError) as e: _e(e)

@router.post("/{bid}/submissions/{sid}/auto-approve", response_model=Optional[CompletionState], summary="Auto-approve")
async def auto(bid: str, sid: str):
    """The auto function."""
    try: return check_auto_approve(bid, sid)
    except (BountyNotFoundError, SubmissionNotFoundError) as e: _e(e)

@router.get("/{bid}/completion", response_model=Optional[CompletionState], summary="Completion")
    """The completion function."""
async def completion(bid: str): return get_completion_state(bid)

@router.get("/{bid}/lifecycle", response_model=list[LifecycleEvent], summary="Lifecycle")
    """The lifecycle function."""
async def lifecycle(bid: str): return get_lifecycle_events(bid)
