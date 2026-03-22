"""REST API endpoints for the real-time event indexer and analytics.

Provides paginated, filterable access to indexed events, bounty stats,
contributor profiles, platform analytics, and a ranked leaderboard.
All endpoints follow the ``/api/v1/`` versioned prefix.

Endpoints:
    GET  /api/v1/events          — Paginated event feed with filters
    GET  /api/v1/events/{id}     — Single event by ID
    GET  /api/v1/bounties        — Bounty listing with stats
    GET  /api/v1/contributors    — Contributor profiles with stats
    GET  /api/v1/contributors/{username} — Single contributor profile
    GET  /api/v1/analytics       — Platform-wide metrics
    GET  /api/v1/leaderboard     — Ranked contributors
    POST /api/v1/events/ingest   — Manual event ingestion (admin)
    GET  /api/v1/reconciliation  — Data consistency check
    GET  /api/v1/health          — Indexer health status

Rate limiting is handled by the global middleware stack.  API key
authentication is enforced on mutation endpoints (ingest).
"""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.auth import get_current_user_id
from app.models.indexer_event import (
    BountyStatsResponse,
    ContributorProfileResponse,
    IndexedEventCategory,
    IndexedEventCreate,
    IndexedEventResponse,
    LeaderboardResponse,
    PaginatedEventResponse,
    PlatformAnalyticsResponse,
)
from app.services import event_indexer_service
from app.services.event_indexer_service import (
    DuplicateEventError,
    EventIndexerError,
    EventNotFoundError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["indexer"])


# ---------------------------------------------------------------------------
# Response models for OpenAPI documentation
# ---------------------------------------------------------------------------


class IndexerHealthResponse(BaseModel):
    """Health status of the event indexer subsystem.

    Attributes:
        status: Overall health status (healthy, degraded, unhealthy).
        total_events: Total number of indexed events.
        last_solana_event_at: Timestamp of most recent Solana event.
        last_github_event_at: Timestamp of most recent GitHub event.
        database: Database connection status.
        cache: Redis cache connection status.
    """

    status: str
    total_events: int = 0
    last_solana_event_at: Optional[datetime] = None
    last_github_event_at: Optional[datetime] = None
    database: str = "unknown"
    cache: str = "unknown"


class ReconciliationResponse(BaseModel):
    """Result of cross-source data reconciliation.

    Attributes:
        solana_only: Events only found on-chain.
        github_only: Events only found on GitHub.
        matched: Events with matching records in both sources.
        total_checked: Total events examined.
        solana_events: Total Solana events.
        github_events: Total GitHub events.
    """

    solana_only: int = 0
    github_only: int = 0
    matched: int = 0
    total_checked: int = 0
    solana_events: int = 0
    github_events: int = 0


class IngestResponse(BaseModel):
    """Response from the manual event ingestion endpoint.

    Attributes:
        event: The ingested event data.
        message: Confirmation message.
    """

    event: IndexedEventResponse
    message: str


# ---------------------------------------------------------------------------
# Event endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/events",
    response_model=PaginatedEventResponse,
    summary="List indexed events",
    description="Paginated event feed with optional filters by source, category, contributor, bounty, and time range.",
)
async def list_events(
    source: Optional[str] = Query(
        None,
        description="Filter by event source: solana, github, system",
    ),
    category: Optional[str] = Query(
        None,
        description="Filter by event category (e.g., pr_opened, bounty_completed)",
    ),
    contributor: Optional[str] = Query(
        None,
        description="Filter by contributor GitHub username",
    ),
    bounty_id: Optional[str] = Query(
        None,
        description="Filter by bounty identifier (e.g., gh-601)",
    ),
    since: Optional[str] = Query(
        None,
        description="ISO-8601 timestamp lower bound (inclusive)",
    ),
    until: Optional[str] = Query(
        None,
        description="ISO-8601 timestamp upper bound (exclusive)",
    ),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
) -> PaginatedEventResponse:
    """Return a paginated list of indexed events.

    Supports filtering by source (solana/github), event category,
    contributor username, bounty ID, and time range.  Results are
    ordered by creation time descending (newest first).

    Args:
        source: Optional event source filter.
        category: Optional event category filter.
        contributor: Optional contributor username filter.
        bounty_id: Optional bounty ID filter.
        since: Optional ISO-8601 lower bound timestamp.
        until: Optional ISO-8601 upper bound timestamp.
        page: Page number (default 1).
        page_size: Items per page (default 50, max 100).

    Returns:
        Paginated event response with items, total count, and navigation.
    """
    since_dt = _parse_timestamp(since) if since else None
    until_dt = _parse_timestamp(until) if until else None

    try:
        return await event_indexer_service.query_events(
            source=source,
            category=category,
            contributor=contributor,
            bounty_id=bounty_id,
            since=since_dt,
            until=until_dt,
            page=page,
            page_size=page_size,
        )
    except Exception as error:
        logger.error("Failed to query events: %s", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to query events",
        )


@router.get(
    "/events/{event_id}",
    response_model=IndexedEventResponse,
    summary="Get event by ID",
    description="Retrieve a single indexed event by its unique identifier.",
)
async def get_event(event_id: str) -> IndexedEventResponse:
    """Retrieve a single indexed event by its UUID.

    Args:
        event_id: The UUID of the event to retrieve.

    Returns:
        The event data.

    Raises:
        HTTPException: 404 if the event is not found.
    """
    try:
        return await event_indexer_service.get_event_by_id(event_id)
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )
    except Exception as error:
        logger.error("Failed to get event %s: %s", event_id, error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve event",
        )


# ---------------------------------------------------------------------------
# Bounty stats endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/bounties",
    response_model=List[BountyStatsResponse],
    summary="Bounty listing with stats",
    description="Bounty listing with aggregated statistics (claims, completions, avg review score).",
)
async def list_bounty_stats(
    bounty_id: Optional[str] = Query(
        None, description="Filter by specific bounty ID"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
) -> List[BountyStatsResponse]:
    """Return bounty listings with aggregated statistics.

    Computes claims, completions, PR counts, and payout totals
    for each bounty from indexed event data.

    Args:
        bounty_id: Optional filter for a specific bounty.
        page: Page number (default 1).
        page_size: Items per page (default 50).

    Returns:
        List of bounty stats with aggregated metrics.
    """
    try:
        return await event_indexer_service.get_bounty_stats(
            bounty_id=bounty_id,
            page=page,
            page_size=page_size,
        )
    except Exception as error:
        logger.error("Failed to get bounty stats: %s", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve bounty statistics",
        )


# ---------------------------------------------------------------------------
# Contributor endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/contributors",
    response_model=List[ContributorProfileResponse],
    summary="Contributor profiles with stats",
    description="List contributor profiles with aggregated statistics from indexed events.",
)
async def list_contributors(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
) -> List[ContributorProfileResponse]:
    """Return contributor profiles with aggregated event statistics.

    Computes PRs opened/merged, bounties completed, earnings, and
    activity timestamps from indexed events.

    Args:
        page: Page number (default 1).
        page_size: Items per page (default 50).

    Returns:
        List of contributor profiles with aggregated stats.
    """
    try:
        return await event_indexer_service.get_contributor_profiles(
            page=page,
            page_size=page_size,
        )
    except Exception as error:
        logger.error("Failed to list contributors: %s", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve contributor profiles",
        )


@router.get(
    "/contributors/{username}",
    response_model=ContributorProfileResponse,
    summary="Contributor profile",
    description="Get a single contributor profile with aggregated statistics.",
)
async def get_contributor(username: str) -> ContributorProfileResponse:
    """Retrieve a contributor's aggregated profile from indexed events.

    Args:
        username: GitHub username of the contributor.

    Returns:
        Contributor profile with aggregated statistics.

    Raises:
        HTTPException: 404 if no events exist for the contributor.
    """
    # Try cache first
    try:
        from app.services.indexer_cache import (
            get_cached_contributor_profile,
            set_cached_contributor_profile,
        )

        cached = await get_cached_contributor_profile(username)
        if cached:
            return ContributorProfileResponse(**cached)
    except Exception:
        pass

    try:
        profile = await event_indexer_service.get_contributor_profile(username)

        # Cache the result
        try:
            from app.services.indexer_cache import set_cached_contributor_profile

            await set_cached_contributor_profile(
                username, profile.model_dump(mode="json")
            )
        except Exception:
            pass

        return profile
    except EventNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No events found for contributor '{username}'",
        )
    except Exception as error:
        logger.error("Failed to get contributor %s: %s", username, error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve contributor profile",
        )


# ---------------------------------------------------------------------------
# Analytics endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/analytics",
    response_model=PlatformAnalyticsResponse,
    summary="Platform-wide metrics",
    description="Platform-wide metrics including completion rate, avg time, payout totals.",
)
async def get_analytics() -> PlatformAnalyticsResponse:
    """Return platform-wide analytics computed from indexed events.

    Aggregates total events, bounty completion rates, payout totals,
    and activity trends.  Results are cached in Redis for 120 seconds.

    Returns:
        Platform analytics response with computed metrics.
    """
    # Try cache first
    try:
        from app.services.indexer_cache import (
            get_cached_analytics,
            set_cached_analytics,
        )

        cached = await get_cached_analytics()
        if cached:
            return PlatformAnalyticsResponse(**cached)
    except Exception:
        pass

    try:
        analytics = await event_indexer_service.get_platform_analytics()

        # Cache the result
        try:
            from app.services.indexer_cache import set_cached_analytics

            await set_cached_analytics(analytics.model_dump(mode="json"))
        except Exception:
            pass

        return analytics
    except Exception as error:
        logger.error("Failed to compute analytics: %s", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compute platform analytics",
        )


# ---------------------------------------------------------------------------
# Leaderboard endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/leaderboard",
    response_model=LeaderboardResponse,
    summary="Ranked contributors",
    description="Ranked contributors by tier, score, completions.",
)
async def get_leaderboard(
    sort_by: str = Query(
        "earnings",
        description="Sort by: earnings, bounties, prs",
    ),
    tier: Optional[int] = Query(
        None, ge=1, le=3, description="Filter by tier (1, 2, or 3)"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
) -> LeaderboardResponse:
    """Return a ranked leaderboard of contributors.

    Rankings are computed from indexed event data.  Supports sorting
    by earnings, bounties completed, or PRs merged.  Results are
    cached in Redis for 60 seconds.

    Args:
        sort_by: Ranking criterion (earnings, bounties, prs).
        tier: Optional tier filter.
        page: Page number (default 1).
        page_size: Items per page (default 50).

    Returns:
        Leaderboard response with ranked entries.
    """
    # Try cache first
    try:
        from app.services.indexer_cache import (
            get_cached_leaderboard,
            set_cached_leaderboard,
        )

        cached = await get_cached_leaderboard(sort_by, tier, page, page_size)
        if cached:
            return LeaderboardResponse(**cached)
    except Exception:
        pass

    try:
        leaderboard = await event_indexer_service.get_leaderboard(
            sort_by=sort_by,
            tier=tier,
            page=page,
            page_size=page_size,
        )

        # Cache the result
        try:
            from app.services.indexer_cache import set_cached_leaderboard

            await set_cached_leaderboard(
                leaderboard.model_dump(mode="json"),
                sort_by,
                tier,
                page,
                page_size,
            )
        except Exception:
            pass

        return leaderboard
    except Exception as error:
        logger.error("Failed to compute leaderboard: %s", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compute leaderboard",
        )


# ---------------------------------------------------------------------------
# Admin endpoints (auth required)
# ---------------------------------------------------------------------------


@router.post(
    "/events/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest event manually",
    description="Manually ingest an event into the indexer (admin only).",
)
async def ingest_event(
    event_data: IndexedEventCreate,
    user_id: str = Depends(get_current_user_id),
) -> IngestResponse:
    """Manually ingest an event into the indexer.

    Requires authentication.  Used for backfilling historical data
    or injecting system events that aren't captured by automatic
    ingestion pipelines.

    Args:
        event_data: The event data to ingest.
        user_id: The authenticated user ID (from auth dependency).

    Returns:
        The ingested event and a confirmation message.

    Raises:
        HTTPException: 409 if a duplicate transaction hash is detected.
        HTTPException: 500 if ingestion fails.
    """
    try:
        event = await event_indexer_service.ingest_event(event_data)
        return IngestResponse(
            event=event,
            message="Event ingested successfully",
        )
    except DuplicateEventError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )
    except EventIndexerError as error:
        logger.error("Event ingestion failed: %s", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to ingest event",
        )


# ---------------------------------------------------------------------------
# Reconciliation endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/reconciliation",
    response_model=ReconciliationResponse,
    summary="Data reconciliation",
    description="Cross-reference on-chain and GitHub data for consistency.",
)
async def get_reconciliation(
    user_id: str = Depends(get_current_user_id),
) -> ReconciliationResponse:
    """Run a data reconciliation check between sources.

    Compares on-chain Solana events with GitHub events to identify
    discrepancies.  Requires authentication.

    Args:
        user_id: The authenticated user ID (from auth dependency).

    Returns:
        Reconciliation statistics showing matched and unmatched events.
    """
    try:
        result = await event_indexer_service.reconcile_events()
        return ReconciliationResponse(**result)
    except Exception as error:
        logger.error("Reconciliation failed: %s", error)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to run reconciliation",
        )


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------


@router.get(
    "/health",
    response_model=IndexerHealthResponse,
    summary="Indexer health",
    description="Health check for the event indexer subsystem.",
)
async def indexer_health() -> IndexerHealthResponse:
    """Return the health status of the event indexer subsystem.

    Checks database connectivity, Redis availability, and reports
    the most recent events from each source.

    Returns:
        Health status with component details.
    """
    database_status = "unknown"
    cache_status = "unknown"
    total_events = 0
    last_solana = None
    last_github = None

    # Check database
    try:
        from app.database import get_db_session
        from sqlalchemy import func, select, desc
        from app.models.indexer_event import IndexedEventDB

        async with get_db_session() as session:
            # Total events count
            count_result = await session.execute(
                select(func.count(IndexedEventDB.id))
            )
            total_events = count_result.scalar() or 0

            # Last Solana event
            solana_result = await session.execute(
                select(IndexedEventDB.created_at)
                .where(IndexedEventDB.source == "solana")
                .order_by(desc(IndexedEventDB.created_at))
                .limit(1)
            )
            row = solana_result.scalar_one_or_none()
            last_solana = row if row else None

            # Last GitHub event
            github_result = await session.execute(
                select(IndexedEventDB.created_at)
                .where(IndexedEventDB.source == "github")
                .order_by(desc(IndexedEventDB.created_at))
                .limit(1)
            )
            row = github_result.scalar_one_or_none()
            last_github = row if row else None

            database_status = "connected"
    except Exception as error:
        logger.warning("Indexer health: database check failed: %s", error)
        database_status = "disconnected"

    # Check Redis
    try:
        from app.core.redis import get_redis

        redis_client = await get_redis()
        await redis_client.ping()
        cache_status = "connected"
    except Exception:
        cache_status = "disconnected"

    overall = "healthy" if database_status == "connected" else "degraded"
    if database_status == "disconnected" and cache_status == "disconnected":
        overall = "unhealthy"

    return IndexerHealthResponse(
        status=overall,
        total_events=total_events,
        last_solana_event_at=last_solana,
        last_github_event_at=last_github,
        database=database_status,
        cache=cache_status,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_timestamp(value: str) -> datetime:
    """Parse an ISO-8601 timestamp string into a datetime object.

    Handles both 'Z' suffix and explicit timezone offsets.

    Args:
        value: ISO-8601 timestamp string.

    Returns:
        Timezone-aware datetime object.

    Raises:
        HTTPException: 400 if the timestamp format is invalid.
    """
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid timestamp format: '{value}'. Use ISO-8601.",
        )
