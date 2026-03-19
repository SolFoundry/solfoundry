"""Leaderboard API router."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models.leaderboard import SortField, TimeFilter
from app.services.leaderboard_service import get_contributor_detail, get_leaderboard

router = APIRouter()


def _get_db():
    """Placeholder dependency — replace with real DB session factory."""
    raise HTTPException(status_code=503, detail="Database not configured yet")


@router.get("/leaderboard", response_model_exclude_none=True)
async def list_leaderboard(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: SortField = SortField.rank,
    time_filter: TimeFilter = TimeFilter.all_time,
):
    """
    List contributors on the leaderboard.

    Supports pagination, sorting by rank/contributions/earnings,
    and time filtering (weekly, monthly, all-time).
    """
    # When real DB is wired up, inject session:
    # from app.database import get_db
    # result = get_leaderboard(db, page=page, limit=limit, sort=sort, time_filter=time_filter)

    # Return empty response structure for now (ready for DB integration)
    return {
        "items": [],
        "total": 0,
        "page": page,
        "limit": limit,
        "pages": 0,
    }


@router.get("/leaderboard/{contributor_id}")
async def get_contributor(contributor_id: int):
    """
    Get detailed information about a specific contributor, including
    their recent contributions.
    """
    # When real DB is wired up:
    # contributor = get_contributor_detail(db, contributor_id)
    # if not contributor:
    #     raise HTTPException(status_code=404, detail="Contributor not found")
    # return contributor

    raise HTTPException(status_code=503, detail="Database not configured yet")
