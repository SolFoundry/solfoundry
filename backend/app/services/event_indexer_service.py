"""Core event indexer service for persisting and querying platform events.

Provides the central ingestion, storage, and query layer for the real-time
event indexer.  All events (Solana on-chain, GitHub webhooks, system events)
flow through this service before being persisted to PostgreSQL and broadcast
via WebSocket.

Architecture:
    Ingestion → Validation → PostgreSQL INSERT → Redis cache invalidation
                                              → WebSocket broadcast

PostgreSQL is the primary source of truth.  Redis caches hot queries
(leaderboard, recent activity) with TTL-based expiration.

References:
    - SQLAlchemy async: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
    - FastAPI background tasks: https://fastapi.tiangolo.com/tutorial/background-tasks/
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, case, desc, distinct, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session
from app.models.indexer_event import (
    BountyStatsResponse,
    ContributorProfileResponse,
    EventSource,
    IndexedEventCategory,
    IndexedEventCreate,
    IndexedEventDB,
    IndexedEventResponse,
    LeaderboardEntryResponse,
    LeaderboardResponse,
    PaginatedEventResponse,
    PlatformAnalyticsResponse,
)

logger = logging.getLogger(__name__)


class EventIndexerError(Exception):
    """Base exception for event indexer operations."""


class EventNotFoundError(EventIndexerError):
    """Raised when a requested event does not exist."""


class DuplicateEventError(EventIndexerError):
    """Raised when an event with the same transaction hash already exists."""


async def ingest_event(event_data: IndexedEventCreate) -> IndexedEventResponse:
    """Ingest a new event into the indexed events table.

    Validates the event data, persists it to PostgreSQL, and returns
    the created event record.  Also invalidates relevant Redis caches
    and broadcasts via WebSocket.

    Args:
        event_data: Validated event creation schema.

    Returns:
        The created event as an API response model.

    Raises:
        DuplicateEventError: If a transaction hash collision is detected.
        EventIndexerError: If the database insert fails.
    """
    async with get_db_session() as session:
        # Check for duplicate transaction hash if provided
        if event_data.transaction_hash:
            existing = await session.execute(
                select(IndexedEventDB).where(
                    IndexedEventDB.transaction_hash == event_data.transaction_hash
                )
            )
            if existing.scalar_one_or_none():
                raise DuplicateEventError(
                    f"Event with transaction hash {event_data.transaction_hash} "
                    f"already exists"
                )

        event_record = IndexedEventDB(
            id=uuid.uuid4(),
            source=event_data.source.value,
            category=event_data.category.value,
            title=event_data.title,
            description=event_data.description,
            contributor_username=event_data.contributor_username,
            bounty_id=event_data.bounty_id,
            bounty_number=event_data.bounty_number,
            transaction_hash=event_data.transaction_hash,
            github_url=event_data.github_url,
            amount=event_data.amount,
            payload=event_data.payload,
            created_at=datetime.now(timezone.utc),
        )

        session.add(event_record)
        await session.commit()
        await session.refresh(event_record)

        logger.info(
            "Indexed event: source=%s category=%s title=%s",
            event_data.source.value,
            event_data.category.value,
            event_data.title[:80],
        )

        # Invalidate Redis caches for affected keys
        try:
            from app.services.indexer_cache import invalidate_event_caches

            await invalidate_event_caches(
                contributor=event_data.contributor_username,
                bounty_id=event_data.bounty_id,
            )
        except Exception as cache_error:
            logger.warning("Redis cache invalidation failed: %s", cache_error)

        # Broadcast via WebSocket for live feed subscribers
        try:
            from app.services.websocket_manager import manager as ws_manager

            event_dict = _event_to_response(event_record).model_dump(mode="json")
            await ws_manager.emit_event(
                event_type="bounty_update",
                channel="indexer:live",
                payload=event_dict,
            )
        except Exception as ws_error:
            logger.warning("WebSocket broadcast failed: %s", ws_error)

        return _event_to_response(event_record)


async def get_event_by_id(event_id: str) -> IndexedEventResponse:
    """Retrieve a single event by its unique identifier.

    Args:
        event_id: UUID string of the event to retrieve.

    Returns:
        The event as an API response model.

    Raises:
        EventNotFoundError: If no event with the given ID exists.
    """
    async with get_db_session() as session:
        result = await session.execute(
            select(IndexedEventDB).where(
                IndexedEventDB.id == uuid.UUID(event_id)
            )
        )
        event_record = result.scalar_one_or_none()
        if not event_record:
            raise EventNotFoundError(f"Event {event_id} not found")
        return _event_to_response(event_record)


async def query_events(
    source: Optional[str] = None,
    category: Optional[str] = None,
    contributor: Optional[str] = None,
    bounty_id: Optional[str] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 50,
) -> PaginatedEventResponse:
    """Query indexed events with filters and pagination.

    Builds a dynamic SQL query based on the provided filters.  Results
    are ordered by ``created_at`` descending (newest first).

    Args:
        source: Filter by event source (solana, github, system).
        category: Filter by event category.
        contributor: Filter by contributor username.
        bounty_id: Filter by bounty identifier.
        since: Only return events created after this timestamp.
        until: Only return events created before this timestamp.
        page: Page number (1-based).
        page_size: Number of events per page (max 100).

    Returns:
        Paginated event response with total count and navigation metadata.
    """
    page_size = min(page_size, 100)
    offset = (page - 1) * page_size

    async with get_db_session() as session:
        conditions = _build_filter_conditions(
            source=source,
            category=category,
            contributor=contributor,
            bounty_id=bounty_id,
            since=since,
            until=until,
        )

        # Count total matching events
        count_query = select(func.count(IndexedEventDB.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0

        # Fetch page of events
        query = (
            select(IndexedEventDB)
            .order_by(desc(IndexedEventDB.created_at))
            .offset(offset)
            .limit(page_size)
        )
        if conditions:
            query = query.where(and_(*conditions))

        result = await session.execute(query)
        events = result.scalars().all()

        return PaginatedEventResponse(
            items=[_event_to_response(event) for event in events],
            total=total,
            page=page,
            page_size=page_size,
            has_next=(offset + page_size) < total,
        )


async def get_bounty_stats(
    bounty_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> List[BountyStatsResponse]:
    """Aggregate bounty statistics from indexed events.

    Groups events by bounty_id and computes claim counts, completion
    counts, PR counts, average review scores, and total payouts.

    Args:
        bounty_id: Optional filter for a specific bounty.
        page: Page number (1-based).
        page_size: Number of bounties per page.

    Returns:
        List of bounty stats objects with aggregated metrics.
    """
    page_size = min(page_size, 100)
    offset = (page - 1) * page_size

    async with get_db_session() as session:
        # Base query: group by bounty_id
        base_filter = [IndexedEventDB.bounty_id.isnot(None)]
        if bounty_id:
            base_filter.append(IndexedEventDB.bounty_id == bounty_id)

        query = (
            select(
                IndexedEventDB.bounty_id,
                func.min(IndexedEventDB.bounty_number).label("bounty_number"),
                func.min(IndexedEventDB.title).label("title"),
                func.count(
                    case(
                        (
                            IndexedEventDB.category == IndexedEventCategory.BOUNTY_CLAIMED.value,
                            IndexedEventDB.id,
                        ),
                    )
                ).label("total_claims"),
                func.count(
                    case(
                        (
                            IndexedEventDB.category == IndexedEventCategory.BOUNTY_COMPLETED.value,
                            IndexedEventDB.id,
                        ),
                    )
                ).label("total_completions"),
                func.count(
                    case(
                        (
                            IndexedEventDB.category.in_([
                                IndexedEventCategory.PR_OPENED.value,
                                IndexedEventCategory.PR_MERGED.value,
                                IndexedEventCategory.PR_CLOSED.value,
                            ]),
                            IndexedEventDB.id,
                        ),
                    )
                ).label("total_prs"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                IndexedEventDB.category == IndexedEventCategory.PAYOUT_CONFIRMED.value,
                                IndexedEventDB.amount,
                            ),
                            else_=Decimal("0"),
                        )
                    ),
                    Decimal("0"),
                ).label("total_payout"),
                func.min(IndexedEventDB.created_at).label("created_at"),
                func.max(IndexedEventDB.created_at).label("last_activity_at"),
            )
            .where(and_(*base_filter))
            .group_by(IndexedEventDB.bounty_id)
            .order_by(desc(text("last_activity_at")))
            .offset(offset)
            .limit(page_size)
        )

        result = await session.execute(query)
        rows = result.all()

        bounty_stats_list = []
        for row in rows:
            bounty_stats_list.append(
                BountyStatsResponse(
                    bounty_id=row.bounty_id,
                    bounty_number=row.bounty_number,
                    title=row.title or "Unknown Bounty",
                    total_claims=row.total_claims,
                    total_completions=row.total_completions,
                    total_prs=row.total_prs,
                    total_payout=float(row.total_payout or 0),
                    created_at=row.created_at,
                    last_activity_at=row.last_activity_at,
                )
            )

        return bounty_stats_list


async def get_contributor_profile(username: str) -> ContributorProfileResponse:
    """Build an aggregated contributor profile from indexed events.

    Computes total events, PRs opened/merged, bounties completed,
    earnings, and most active event categories for a given contributor.

    Args:
        username: GitHub username of the contributor.

    Returns:
        Contributor profile with aggregated statistics.

    Raises:
        EventNotFoundError: If no events exist for the given contributor.
    """
    async with get_db_session() as session:
        # Check contributor has any events
        count_result = await session.execute(
            select(func.count(IndexedEventDB.id)).where(
                IndexedEventDB.contributor_username == username
            )
        )
        total_events = count_result.scalar() or 0
        if total_events == 0:
            raise EventNotFoundError(
                f"No events found for contributor '{username}'"
            )

        # Aggregate stats
        stats_query = select(
            func.count(
                case(
                    (
                        IndexedEventDB.category == IndexedEventCategory.PR_OPENED.value,
                        IndexedEventDB.id,
                    ),
                )
            ).label("prs_opened"),
            func.count(
                case(
                    (
                        IndexedEventDB.category == IndexedEventCategory.PR_MERGED.value,
                        IndexedEventDB.id,
                    ),
                )
            ).label("prs_merged"),
            func.count(
                case(
                    (
                        IndexedEventDB.category == IndexedEventCategory.BOUNTY_COMPLETED.value,
                        IndexedEventDB.id,
                    ),
                )
            ).label("bounties_completed"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            IndexedEventDB.category == IndexedEventCategory.PAYOUT_CONFIRMED.value,
                            IndexedEventDB.amount,
                        ),
                        else_=Decimal("0"),
                    )
                ),
                Decimal("0"),
            ).label("total_earnings"),
            func.min(IndexedEventDB.created_at).label("first_activity"),
            func.max(IndexedEventDB.created_at).label("last_activity"),
        ).where(IndexedEventDB.contributor_username == username)

        result = await session.execute(stats_query)
        row = result.one()

        # Top categories
        category_query = (
            select(
                IndexedEventDB.category,
                func.count(IndexedEventDB.id).label("event_count"),
            )
            .where(IndexedEventDB.contributor_username == username)
            .group_by(IndexedEventDB.category)
            .order_by(desc(text("event_count")))
            .limit(5)
        )
        category_result = await session.execute(category_query)
        top_categories = [r.category for r in category_result.all()]

        return ContributorProfileResponse(
            username=username,
            total_events=total_events,
            total_prs_opened=row.prs_opened,
            total_prs_merged=row.prs_merged,
            total_bounties_completed=row.bounties_completed,
            total_earnings=float(row.total_earnings or 0),
            first_activity_at=row.first_activity,
            last_activity_at=row.last_activity,
            top_categories=top_categories,
        )


async def get_contributor_profiles(
    page: int = 1,
    page_size: int = 50,
) -> List[ContributorProfileResponse]:
    """List all contributors with aggregated statistics.

    Returns a paginated list of contributor profiles ordered by total
    earnings descending.

    Args:
        page: Page number (1-based).
        page_size: Number of contributors per page.

    Returns:
        List of contributor profile response objects.
    """
    page_size = min(page_size, 100)
    offset = (page - 1) * page_size

    async with get_db_session() as session:
        query = (
            select(
                IndexedEventDB.contributor_username,
                func.count(IndexedEventDB.id).label("total_events"),
                func.count(
                    case(
                        (
                            IndexedEventDB.category == IndexedEventCategory.PR_OPENED.value,
                            IndexedEventDB.id,
                        ),
                    )
                ).label("prs_opened"),
                func.count(
                    case(
                        (
                            IndexedEventDB.category == IndexedEventCategory.PR_MERGED.value,
                            IndexedEventDB.id,
                        ),
                    )
                ).label("prs_merged"),
                func.count(
                    case(
                        (
                            IndexedEventDB.category == IndexedEventCategory.BOUNTY_COMPLETED.value,
                            IndexedEventDB.id,
                        ),
                    )
                ).label("bounties_completed"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                IndexedEventDB.category == IndexedEventCategory.PAYOUT_CONFIRMED.value,
                                IndexedEventDB.amount,
                            ),
                            else_=Decimal("0"),
                        )
                    ),
                    Decimal("0"),
                ).label("total_earnings"),
                func.min(IndexedEventDB.created_at).label("first_activity"),
                func.max(IndexedEventDB.created_at).label("last_activity"),
            )
            .where(IndexedEventDB.contributor_username.isnot(None))
            .group_by(IndexedEventDB.contributor_username)
            .order_by(desc(text("total_earnings")))
            .offset(offset)
            .limit(page_size)
        )

        result = await session.execute(query)
        rows = result.all()

        profiles = []
        for row in rows:
            profiles.append(
                ContributorProfileResponse(
                    username=row.contributor_username,
                    total_events=row.total_events,
                    total_prs_opened=row.prs_opened,
                    total_prs_merged=row.prs_merged,
                    total_bounties_completed=row.bounties_completed,
                    total_earnings=float(row.total_earnings or 0),
                    first_activity_at=row.first_activity,
                    last_activity_at=row.last_activity,
                )
            )

        return profiles


async def get_platform_analytics() -> PlatformAnalyticsResponse:
    """Compute platform-wide analytics from indexed events.

    Aggregates total events, unique bounties and contributors,
    completion rates, average completion times, and payout totals.

    Returns:
        Platform analytics response with all computed metrics.
    """
    async with get_db_session() as session:
        now = datetime.now(timezone.utc)
        day_ago = now - timedelta(hours=24)
        week_ago = now - timedelta(days=7)

        # Total events
        total_result = await session.execute(
            select(func.count(IndexedEventDB.id))
        )
        total_events = total_result.scalar() or 0

        # Unique bounties
        bounties_result = await session.execute(
            select(func.count(distinct(IndexedEventDB.bounty_id))).where(
                IndexedEventDB.bounty_id.isnot(None)
            )
        )
        total_bounties = bounties_result.scalar() or 0

        # Unique contributors
        contributors_result = await session.execute(
            select(
                func.count(distinct(IndexedEventDB.contributor_username))
            ).where(IndexedEventDB.contributor_username.isnot(None))
        )
        total_contributors = contributors_result.scalar() or 0

        # Bounties created vs completed for completion rate
        created_result = await session.execute(
            select(func.count(IndexedEventDB.id)).where(
                IndexedEventDB.category == IndexedEventCategory.BOUNTY_CREATED.value
            )
        )
        bounties_created = created_result.scalar() or 0

        completed_result = await session.execute(
            select(func.count(IndexedEventDB.id)).where(
                IndexedEventDB.category == IndexedEventCategory.BOUNTY_COMPLETED.value
            )
        )
        bounties_completed = completed_result.scalar() or 0

        completion_rate = (
            (bounties_completed / bounties_created * 100.0)
            if bounties_created > 0
            else 0.0
        )

        # Total payout
        payout_result = await session.execute(
            select(func.coalesce(func.sum(IndexedEventDB.amount), Decimal("0"))).where(
                IndexedEventDB.category == IndexedEventCategory.PAYOUT_CONFIRMED.value
            )
        )
        total_payout = float(payout_result.scalar() or 0)

        # Events in last 24h
        events_24h_result = await session.execute(
            select(func.count(IndexedEventDB.id)).where(
                IndexedEventDB.created_at >= day_ago
            )
        )
        events_last_24h = events_24h_result.scalar() or 0

        # Events in last 7d
        events_7d_result = await session.execute(
            select(func.count(IndexedEventDB.id)).where(
                IndexedEventDB.created_at >= week_ago
            )
        )
        events_last_7d = events_7d_result.scalar() or 0

        # Top contributors by earnings
        top_query = (
            select(
                IndexedEventDB.contributor_username,
                func.coalesce(
                    func.sum(
                        case(
                            (
                                IndexedEventDB.category
                                == IndexedEventCategory.PAYOUT_CONFIRMED.value,
                                IndexedEventDB.amount,
                            ),
                            else_=Decimal("0"),
                        )
                    ),
                    Decimal("0"),
                ).label("earnings"),
            )
            .where(IndexedEventDB.contributor_username.isnot(None))
            .group_by(IndexedEventDB.contributor_username)
            .order_by(desc(text("earnings")))
            .limit(10)
        )
        top_result = await session.execute(top_query)
        top_contributors = [
            {"username": row.contributor_username, "earnings": float(row.earnings or 0)}
            for row in top_result.all()
        ]

        # Category breakdown
        category_query = (
            select(
                IndexedEventDB.category,
                func.count(IndexedEventDB.id).label("event_count"),
            )
            .group_by(IndexedEventDB.category)
            .order_by(desc(text("event_count")))
        )
        category_result = await session.execute(category_query)
        category_breakdown = {
            row.category: row.event_count for row in category_result.all()
        }

        return PlatformAnalyticsResponse(
            total_events=total_events,
            total_bounties=total_bounties,
            total_contributors=total_contributors,
            completion_rate=round(completion_rate, 2),
            total_payout=total_payout,
            events_last_24h=events_last_24h,
            events_last_7d=events_last_7d,
            top_contributors=top_contributors,
            category_breakdown=category_breakdown,
        )


async def get_leaderboard(
    sort_by: str = "earnings",
    tier: Optional[int] = None,
    page: int = 1,
    page_size: int = 50,
) -> LeaderboardResponse:
    """Generate a ranked leaderboard from indexed event data.

    Ranks contributors by earnings, bounties completed, or PRs merged.
    Optionally filters by contributor tier.

    Args:
        sort_by: Ranking criterion ('earnings', 'bounties', 'prs').
        tier: Optional tier filter (1, 2, or 3).
        page: Page number (1-based).
        page_size: Number of entries per page.

    Returns:
        Leaderboard response with ranked entries and pagination.
    """
    page_size = min(page_size, 100)
    offset = (page - 1) * page_size

    async with get_db_session() as session:
        # Build base aggregation query
        query = (
            select(
                IndexedEventDB.contributor_username,
                func.count(
                    case(
                        (
                            IndexedEventDB.category == IndexedEventCategory.BOUNTY_COMPLETED.value,
                            IndexedEventDB.id,
                        ),
                    )
                ).label("bounties_completed"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                IndexedEventDB.category
                                == IndexedEventCategory.PAYOUT_CONFIRMED.value,
                                IndexedEventDB.amount,
                            ),
                            else_=Decimal("0"),
                        )
                    ),
                    Decimal("0"),
                ).label("total_earnings"),
                func.count(
                    case(
                        (
                            IndexedEventDB.category == IndexedEventCategory.PR_MERGED.value,
                            IndexedEventDB.id,
                        ),
                    )
                ).label("prs_merged"),
            )
            .where(IndexedEventDB.contributor_username.isnot(None))
            .group_by(IndexedEventDB.contributor_username)
        )

        # Apply sort order
        if sort_by == "bounties":
            query = query.order_by(desc(text("bounties_completed")), desc(text("total_earnings")))
        elif sort_by == "prs":
            query = query.order_by(desc(text("prs_merged")), desc(text("total_earnings")))
        else:
            query = query.order_by(desc(text("total_earnings")), desc(text("bounties_completed")))

        # Count total unique contributors
        count_query = (
            select(func.count(distinct(IndexedEventDB.contributor_username))).where(
                IndexedEventDB.contributor_username.isnot(None)
            )
        )
        count_result = await session.execute(count_query)
        total = count_result.scalar() or 0

        # Apply pagination
        query = query.offset(offset).limit(page_size)

        result = await session.execute(query)
        rows = result.all()

        entries = []
        for index, row in enumerate(rows):
            bounties = row.bounties_completed
            computed_tier = 1
            if bounties >= 10:
                computed_tier = 3
            elif bounties >= 4:
                computed_tier = 2

            # Apply tier filter after computation
            if tier is not None and computed_tier != tier:
                continue

            entries.append(
                LeaderboardEntryResponse(
                    rank=offset + index + 1,
                    username=row.contributor_username,
                    bounties_completed=bounties,
                    total_earnings=float(row.total_earnings or 0),
                    total_prs_merged=row.prs_merged,
                    tier=computed_tier,
                )
            )

        return LeaderboardResponse(
            entries=entries,
            total=total,
            page=page,
            page_size=page_size,
        )


async def reconcile_events() -> Dict[str, int]:
    """Cross-reference on-chain and GitHub data for consistency.

    Identifies events that exist in one source but not the other,
    and logs discrepancies for manual review.  This is a read-only
    audit operation that does not modify any records.

    Returns:
        Dictionary with reconciliation statistics:
        - solana_only: Events only found on-chain.
        - github_only: Events only found on GitHub.
        - matched: Events with matching records in both sources.
        - total_checked: Total events examined.
    """
    async with get_db_session() as session:
        # Count events by source
        source_counts = {}
        for source_value in [EventSource.SOLANA.value, EventSource.GITHUB.value]:
            count_result = await session.execute(
                select(func.count(IndexedEventDB.id)).where(
                    IndexedEventDB.source == source_value
                )
            )
            source_counts[source_value] = count_result.scalar() or 0

        # Find bounties with events from both sources (matched)
        matched_query = (
            select(func.count(distinct(IndexedEventDB.bounty_id)))
            .where(
                and_(
                    IndexedEventDB.bounty_id.isnot(None),
                    IndexedEventDB.source == EventSource.SOLANA.value,
                    IndexedEventDB.bounty_id.in_(
                        select(IndexedEventDB.bounty_id)
                        .where(IndexedEventDB.source == EventSource.GITHUB.value)
                        .where(IndexedEventDB.bounty_id.isnot(None))
                    ),
                )
            )
        )
        matched_result = await session.execute(matched_query)
        matched = matched_result.scalar() or 0

        # Solana-only bounties
        solana_only_query = (
            select(func.count(distinct(IndexedEventDB.bounty_id)))
            .where(
                and_(
                    IndexedEventDB.bounty_id.isnot(None),
                    IndexedEventDB.source == EventSource.SOLANA.value,
                    ~IndexedEventDB.bounty_id.in_(
                        select(IndexedEventDB.bounty_id)
                        .where(IndexedEventDB.source == EventSource.GITHUB.value)
                        .where(IndexedEventDB.bounty_id.isnot(None))
                    ),
                )
            )
        )
        solana_only_result = await session.execute(solana_only_query)
        solana_only = solana_only_result.scalar() or 0

        # GitHub-only bounties
        github_only_query = (
            select(func.count(distinct(IndexedEventDB.bounty_id)))
            .where(
                and_(
                    IndexedEventDB.bounty_id.isnot(None),
                    IndexedEventDB.source == EventSource.GITHUB.value,
                    ~IndexedEventDB.bounty_id.in_(
                        select(IndexedEventDB.bounty_id)
                        .where(IndexedEventDB.source == EventSource.SOLANA.value)
                        .where(IndexedEventDB.bounty_id.isnot(None))
                    ),
                )
            )
        )
        github_only_result = await session.execute(github_only_query)
        github_only = github_only_result.scalar() or 0

        total_checked = source_counts.get(EventSource.SOLANA.value, 0) + source_counts.get(
            EventSource.GITHUB.value, 0
        )

        reconciliation_result = {
            "solana_only": solana_only,
            "github_only": github_only,
            "matched": matched,
            "total_checked": total_checked,
            "solana_events": source_counts.get(EventSource.SOLANA.value, 0),
            "github_events": source_counts.get(EventSource.GITHUB.value, 0),
        }

        logger.info(
            "Reconciliation complete: matched=%d, solana_only=%d, github_only=%d",
            matched,
            solana_only,
            github_only,
        )

        return reconciliation_result


def _build_filter_conditions(
    source: Optional[str] = None,
    category: Optional[str] = None,
    contributor: Optional[str] = None,
    bounty_id: Optional[str] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
) -> list:
    """Build SQLAlchemy filter conditions from query parameters.

    Constructs a list of SQLAlchemy binary expressions used in WHERE
    clauses for event queries.

    Args:
        source: Filter by event source.
        category: Filter by event category.
        contributor: Filter by contributor username.
        bounty_id: Filter by bounty identifier.
        since: Lower bound timestamp (inclusive).
        until: Upper bound timestamp (exclusive).

    Returns:
        List of SQLAlchemy filter conditions.
    """
    conditions = []
    if source:
        conditions.append(IndexedEventDB.source == source)
    if category:
        conditions.append(IndexedEventDB.category == category)
    if contributor:
        conditions.append(IndexedEventDB.contributor_username == contributor)
    if bounty_id:
        conditions.append(IndexedEventDB.bounty_id == bounty_id)
    if since:
        conditions.append(IndexedEventDB.created_at >= since)
    if until:
        conditions.append(IndexedEventDB.created_at < until)
    return conditions


def _event_to_response(event: IndexedEventDB) -> IndexedEventResponse:
    """Convert a database event record to an API response model.

    Args:
        event: SQLAlchemy IndexedEventDB instance.

    Returns:
        Pydantic IndexedEventResponse instance.
    """
    return IndexedEventResponse(
        id=str(event.id),
        source=event.source,
        category=event.category,
        title=event.title,
        description=event.description,
        contributor_username=event.contributor_username,
        bounty_id=event.bounty_id,
        bounty_number=event.bounty_number,
        transaction_hash=event.transaction_hash,
        github_url=event.github_url,
        amount=float(event.amount) if event.amount is not None else None,
        payload=event.payload,
        created_at=event.created_at,
    )
