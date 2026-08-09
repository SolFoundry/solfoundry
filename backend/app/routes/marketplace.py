"""API routes for the GitHub Repo Marketplace."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import (
    ContributionCreate, ContributionRead,
    DistributionCreate, DistributionRead,
    FundingGoalCreate, FundingGoalRead,
    RepoListingCreate, RepoListingRead,
)
from app.services.marketplace import MarketplaceService

router = APIRouter(prefix="/marketplace", tags=["marketplace"])


def get_service(db: AsyncSession = Depends(get_db)) -> MarketplaceService:
    return MarketplaceService(db)


# ── Repo Listings ─────────────────────────────────────────────────────────────


@router.get("/repos", response_model=list[RepoListingRead])
async def list_repos(
    language: str | None = Query(None),
    min_stars: int = Query(0, ge=0),
    search: str | None = Query(None),
    sort_by: str = Query("stars", pattern="^(stars|name|created)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    svc: MarketplaceService = Depends(get_service),
):
    return await svc.list_repos(
        language=language, min_stars=min_stars, search=search,
        sort_by=sort_by, limit=limit, offset=offset,
    )


@router.post("/repos", response_model=RepoListingRead, status_code=201)
async def add_repo(data: RepoListingCreate, svc: MarketplaceService = Depends(get_service)):
    return await svc.add_repo(data)


@router.get("/repos/{repo_id}", response_model=RepoListingRead)
async def get_repo(repo_id: uuid.UUID, svc: MarketplaceService = Depends(get_service)):
    repo = await svc.get_repo(repo_id)
    if not repo:
        raise HTTPException(404, detail="Repo listing not found")
    return repo


# ── Funding Goals ─────────────────────────────────────────────────────────────


@router.post("/repos/{repo_id}/goals", response_model=FundingGoalRead, status_code=201)
async def create_goal(
    repo_id: uuid.UUID,
    data: FundingGoalCreate,
    svc: MarketplaceService = Depends(get_service),
):
    return await svc.create_funding_goal(repo_id, data)


@router.get("/repos/{repo_id}/goals", response_model=list[FundingGoalRead])
async def list_goals(
    repo_id: uuid.UUID,
    status: str | None = Query(None),
    svc: MarketplaceService = Depends(get_service),
):
    return await svc.list_funding_goals(repo_id=repo_id, status=status)


@router.get("/goals", response_model=list[FundingGoalRead])
async def list_all_goals(
    status: str | None = Query(None),
    svc: MarketplaceService = Depends(get_service),
):
    return await svc.list_funding_goals(status=status)


@router.get("/stats")
async def get_stats(svc: MarketplaceService = Depends(get_service)):
    return await svc.get_funding_goal_stats()


# ── Contributions ─────────────────────────────────────────────────────────────


@router.post("/goals/{goal_id}/contributions", response_model=ContributionRead, status_code=201)
async def contribute(
    goal_id: uuid.UUID,
    data: ContributionCreate,
    svc: MarketplaceService = Depends(get_service),
):
    return await svc.contribute(goal_id, data)


@router.get("/goals/{goal_id}/contributions", response_model=list[ContributionRead])
async def list_contributions(
    goal_id: uuid.UUID,
    svc: MarketplaceService = Depends(get_service),
):
    return await svc.list_contributions(goal_id)


# ── Distributions (Payments) ──────────────────────────────────────────────────


@router.post("/goals/{goal_id}/distributions", response_model=DistributionRead, status_code=201)
async def create_distribution(
    goal_id: uuid.UUID,
    data: DistributionCreate,
    svc: MarketplaceService = Depends(get_service),
):
    return await svc.create_distribution(goal_id, data)


@router.get("/goals/{goal_id}/distributions", response_model=list[DistributionRead])
async def list_distributions(
    goal_id: uuid.UUID,
    svc: MarketplaceService = Depends(get_service),
):
    return await svc.list_distributions(goal_id)


@router.patch("/distributions/{dist_id}/complete", response_model=DistributionRead)
async def complete_distribution(
    dist_id: uuid.UUID,
    transaction_signature: str,
    svc: MarketplaceService = Depends(get_service),
):
    dist = await svc.complete_distribution(dist_id, transaction_signature)
    if not dist:
        raise HTTPException(404, detail="Distribution not found")
    return dist