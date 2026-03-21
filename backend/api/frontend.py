from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional
import logging
from backend.services.api_client import APIClientService
from backend.core.auth import get_current_user
from backend.schemas.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/frontend", tags=["frontend"])


@router.get("/bounties")
async def get_bounties(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    api_client: APIClientService = Depends(),
):
    """Get bounties for frontend display with filtering"""
    try:
        filters = {}
        if status:
            filters["status"] = status
        if difficulty:
            filters["difficulty"] = difficulty
        if tags:
            filters["tags"] = tags.split(",")

        bounties = await api_client.get_bounties(
            skip=skip,
            limit=limit,
            filters=filters
        )

        return {
            "bounties": bounties,
            "total": len(bounties),
            "page": skip // limit + 1,
            "has_more": len(bounties) == limit
        }
    except Exception as e:
        logger.error(f"Error fetching bounties: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch bounties")


@router.get("/leaderboard")
async def get_leaderboard(
    timeframe: str = Query("all", regex="^(week|month|all)$"),
    limit: int = Query(20, ge=1, le=100),
    api_client: APIClientService = Depends(),
):
    """Get contributor leaderboard data"""
    try:
        leaderboard_data = await api_client.get_leaderboard(
            timeframe=timeframe,
            limit=limit
        )

        return {
            "leaderboard": leaderboard_data,
            "timeframe": timeframe,
            "updated_at": leaderboard_data[0].get("updated_at") if leaderboard_data else None
        }
    except Exception as e:
        logger.error(f"Error fetching leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch leaderboard")


@router.get("/tokenomics")
async def get_tokenomics_data(
    api_client: APIClientService = Depends(),
):
    """Get tokenomics and treasury data"""
    try:
        treasury_data = await api_client.get_treasury_stats()
        token_stats = await api_client.get_token_stats()

        return {
            "treasury": treasury_data,
            "token_stats": token_stats,
            "total_supply": token_stats.get("total_supply", 0),
            "circulating_supply": token_stats.get("circulating_supply", 0),
            "market_cap": token_stats.get("market_cap", 0),
            "price_usd": token_stats.get("price_usd", 0),
            "volume_24h": token_stats.get("volume_24h", 0)
        }
    except Exception as e:
        logger.error(f"Error fetching tokenomics: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch tokenomics data")


@router.get("/contributor/{wallet_address}")
async def get_contributor_profile(
    wallet_address: str,
    api_client: APIClientService = Depends(),
):
    """Get contributor profile data"""
    try:
        profile = await api_client.get_contributor_profile(wallet_address)
        bounties = await api_client.get_contributor_bounties(wallet_address)
        stats = await api_client.get_contributor_stats(wallet_address)

        return {
            "profile": profile,
            "bounties": bounties,
            "stats": stats,
            "total_earned": stats.get("total_earnings", 0),
            "bounties_completed": stats.get("completed_count", 0),
            "reputation_score": stats.get("reputation", 0)
        }
    except Exception as e:
        logger.error(f"Error fetching contributor profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch contributor profile")


@router.get("/dashboard")
async def get_dashboard_data(
    current_user: User = Depends(get_current_user),
    api_client: APIClientService = Depends(),
):
    """Get dashboard data for authenticated user"""
    try:
        user_stats = await api_client.get_user_stats(current_user.wallet_address)
        active_bounties = await api_client.get_user_bounties(
            current_user.wallet_address,
            status="active"
        )
        recent_activities = await api_client.get_user_activities(
            current_user.wallet_address,
            limit=10
        )

        return {
            "user_stats": user_stats,
            "active_bounties": active_bounties,
            "recent_activities": recent_activities,
            "notifications_count": len([a for a in recent_activities if not a.get("read", True)])
        }
    except Exception as e:
        logger.error(f"Error fetching dashboard data: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard data")


@router.get("/bounty/{bounty_id}")
async def get_bounty_details(
    bounty_id: int,
    api_client: APIClientService = Depends(),
):
    """Get detailed bounty information"""
    try:
        bounty = await api_client.get_bounty(bounty_id)
        submissions = await api_client.get_bounty_submissions(bounty_id)
        comments = await api_client.get_bounty_comments(bounty_id)

        return {
            "bounty": bounty,
            "submissions": submissions,
            "comments": comments,
            "submission_count": len(submissions)
        }
    except Exception as e:
        logger.error(f"Error fetching bounty details: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch bounty details")


@router.get("/search")
async def search_content(
    q: str = Query(..., min_length=2),
    type: str = Query("all", regex="^(bounties|contributors|all)$"),
    limit: int = Query(20, ge=1, le=50),
    api_client: APIClientService = Depends(),
):
    """Search bounties and contributors"""
    try:
        results = await api_client.search(
            query=q,
            search_type=type,
            limit=limit
        )

        return {
            "results": results,
            "query": q,
            "type": type,
            "total_found": len(results)
        }
    except Exception as e:
        logger.error(f"Error performing search: {e}")
        raise HTTPException(status_code=500, detail="Search failed")


@router.get("/stats/platform")
async def get_platform_stats(
    api_client: APIClientService = Depends(),
):
    """Get overall platform statistics"""
    try:
        stats = await api_client.get_platform_stats()

        return {
            "total_bounties": stats.get("total_bounties", 0),
            "total_contributors": stats.get("total_contributors", 0),
            "total_rewards_paid": stats.get("total_rewards", 0),
            "active_bounties": stats.get("active_bounties", 0),
            "completion_rate": stats.get("completion_rate", 0),
            "avg_completion_time": stats.get("avg_completion_days", 0)
        }
    except Exception as e:
        logger.error(f"Error fetching platform stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch platform statistics")
