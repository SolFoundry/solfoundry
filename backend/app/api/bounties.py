"""Bounty CRUD, claiming & submission API router."""

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from app.models.bounty import (
    BountyCreate, BountyListResponse, BountyResponse, BountyStatus, BountyTier,
    BountyUpdate, ClaimCreate, ClaimResponse, SubmissionCreate, SubmissionResponse,
)
from app.services import bounty_service
from app.services.bounty_service import check_expired_claims

router = APIRouter(prefix="/api/bounties", tags=["bounties"])


async def _run_deadline_check() -> None:
    check_expired_claims()


# Static routes first to avoid path conflicts with /{bounty_id}

@router.post("/admin/check-deadlines", response_model=list[ClaimResponse], summary="Trigger deadline check")
async def trigger_deadline_check():
    return check_expired_claims()


@router.get("/contributors/{contributor_id}/claims", response_model=list[ClaimResponse])
async def get_contributor_claims(contributor_id: str):
    return bounty_service.get_contributor_claims(contributor_id)


@router.post("", response_model=BountyResponse, status_code=201, summary="Create a new bounty")
async def create_bounty(data: BountyCreate):
    return bounty_service.create_bounty(data)


@router.get("", response_model=BountyListResponse, summary="List bounties")
async def list_bounties(
    status: Optional[BountyStatus] = Query(None),
    tier: Optional[BountyTier] = Query(None),
    skills: Optional[str] = Query(None, description="Comma-separated skill filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    background_tasks: BackgroundTasks = None,
):
    if background_tasks:
        background_tasks.add_task(_run_deadline_check)
    skill_list = [s.strip().lower() for s in skills.split(",") if s.strip()] if skills else None
    return bounty_service.list_bounties(status=status, tier=tier, skills=skill_list, skip=skip, limit=limit)


@router.get("/{bounty_id}", response_model=BountyResponse, summary="Get a single bounty")
async def get_bounty(bounty_id: str):
    b = bounty_service.get_bounty(bounty_id)
    if not b:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return b


@router.patch("/{bounty_id}", response_model=BountyResponse, summary="Update a bounty")
async def update_bounty(bounty_id: str, data: BountyUpdate):
    result, error = bounty_service.update_bounty(bounty_id, data)
    if error:
        if "not found" in error.lower():
            raise HTTPException(status_code=404, detail=error)
        raise HTTPException(status_code=400, detail=error)
    return result


@router.delete("/{bounty_id}", status_code=204, summary="Delete a bounty")
async def delete_bounty(bounty_id: str):
    if not bounty_service.delete_bounty(bounty_id):
        raise HTTPException(status_code=404, detail="Bounty not found")


@router.post("/{bounty_id}/submit", response_model=SubmissionResponse, status_code=201, summary="Submit a solution")
async def submit_solution(bounty_id: str, data: SubmissionCreate):
    sub, error = bounty_service.submit_solution(bounty_id, data)
    if error:
        if "not found" in error.lower():
            raise HTTPException(status_code=404, detail=error)
        raise HTTPException(status_code=400, detail=error)
    return sub


@router.get("/{bounty_id}/submissions", response_model=list[SubmissionResponse])
async def get_submissions(bounty_id: str):
    subs = bounty_service.get_submissions(bounty_id)
    if subs is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return subs


@router.post("/{bounty_id}/claim", response_model=ClaimResponse, status_code=201, summary="Claim a bounty")
async def claim_bounty(bounty_id: str, data: ClaimCreate):
    from app.services import contributor_service
    contributor = contributor_service.get_contributor(data.contributor_id)
    if not contributor:
        raise HTTPException(status_code=404, detail="Contributor not found")
    claim, error = bounty_service.claim_bounty(
        bounty_id=bounty_id, contributor_id=data.contributor_id,
        contributor_reputation=contributor.stats.reputation_score,
        application_text=data.application_text)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return claim


@router.post("/{bounty_id}/unclaim", response_model=ClaimResponse)
async def unclaim_bounty(bounty_id: str, data: ClaimCreate):
    claim, error = bounty_service.unclaim_bounty(bounty_id=bounty_id, contributor_id=data.contributor_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return claim


@router.post("/{bounty_id}/claims/{claim_id}/approve", response_model=ClaimResponse)
async def approve_claim(bounty_id: str, claim_id: str):
    claim, error = bounty_service.approve_claim(bounty_id, claim_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return claim


@router.post("/{bounty_id}/claims/{claim_id}/reject", response_model=ClaimResponse)
async def reject_claim(bounty_id: str, claim_id: str):
    claim, error = bounty_service.reject_claim(bounty_id, claim_id)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return claim


@router.get("/{bounty_id}/claims", response_model=list[ClaimResponse])
async def get_claim_history(bounty_id: str):
    history = bounty_service.get_claim_history(bounty_id)
    if history is None:
        raise HTTPException(status_code=404, detail="Bounty not found")
    return history
