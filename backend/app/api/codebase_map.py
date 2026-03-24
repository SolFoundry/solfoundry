"""Codebase map API router — serves interactive repository visualization data.

Provides endpoints for fetching the codebase tree structure, dependency graph,
bounty associations, and summary statistics. The data powers the frontend
interactive codebase map visualization.

Endpoints:
    GET /api/codebase/map — Full codebase map with tree, dependencies, and stats
    POST /api/codebase/map/refresh — Force-refresh cached map data (auth required)
"""

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user_id
from app.services.codebase_map_service import generate_codebase_map, invalidate_cache

router = APIRouter(prefix="/api/codebase", tags=["codebase-map"])


@router.get(
    "/map",
    summary="Get interactive codebase map data",
    description=(
        "Returns the full repository tree structure with metadata including "
        "bounty associations, dependency arrows between modules, recent PR activity, "
        "and test coverage indicators. Data is cached for 5 minutes."
    ),
)
async def get_codebase_map() -> dict:
    """Fetch the complete codebase map for frontend visualization.

    Returns the hierarchical tree structure of the repository with metadata
    for each file and directory including bounty associations, modification
    recency, and test coverage status. Also includes module dependency edges
    and summary statistics.

    Returns:
        dict: Complete codebase map data structure with:
            - tree: Hierarchical file/directory tree with metadata
            - dependencies: Module-level dependency edges
            - summary: Aggregate statistics (file count, modules, active bounties)
            - pull_requests: Recent PR activity
            - generated_at: ISO timestamp of data generation

    Raises:
        HTTPException: 503 if GitHub API is unreachable.
    """
    try:
        result = await generate_codebase_map()
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to generate codebase map: {str(error)}",
        )

    if not result.get("tree"):
        raise HTTPException(
            status_code=503,
            detail="Codebase map data is unavailable — GitHub API may be unreachable",
        )

    return result


@router.post(
    "/map/refresh",
    summary="Force-refresh codebase map cache",
    description=(
        "Invalidates the cached codebase map and generates fresh data from "
        "the GitHub API. Requires authentication. Use sparingly to avoid "
        "GitHub API rate limits."
    ),
)
async def refresh_codebase_map(
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """Force-refresh the codebase map cache and return fresh data.

    Requires authentication to prevent abuse. Invalidates the current cache
    and regenerates the map from the GitHub API.

    Args:
        user_id: The authenticated user ID from the auth dependency.

    Returns:
        dict: Freshly generated codebase map data structure.

    Raises:
        HTTPException: 401 if not authenticated, 503 if GitHub API fails.
    """
    invalidate_cache()

    try:
        result = await generate_codebase_map()
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to refresh codebase map: {str(error)}",
        )

    return result
