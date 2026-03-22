"""Events API router — queryable real-time event index.

Exposes paginated, filterable access to the unified event store.
Supports filters by event_type, source, bounty_id, contributor_id, and time range.
Sorting by timestamp (asc/desc). Results include total count for pagination.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.database import get_db
from app.models.event_index import EventDB

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/events", tags=["events"])


class EventResponse(BaseModel):
    """Single event response."""
    event_id: str
    event_type: str
    source: str
    channel: Optional[str] = None
    timestamp: datetime
    payload: dict
    bounty_id: Optional[str] = None
    contributor_id: Optional[str] = None
    tx_hash: Optional[str] = None
    block_slot: Optional[int] = None


class EventListResponse(BaseModel):
    """Paginated event list."""
    events: List[EventResponse]
    total: int
    page: int
    limit: int
    has_more: bool


@router.get("", response_model=EventListResponse)
async def list_events(
    event_type: Optional[str] = Query(None, description="Filter by event type (exact match)"),
    source: Optional[str] = Query(None, description="Filter by source: 'solana' or 'github'"),
    bounty_id: Optional[str] = Query(None, description="Filter by bounty UUID"),
    contributor_id: Optional[str] = Query(None, description="Filter by contributor wallet/username"),
    tx_hash: Optional[str] = Query(None, description="Filter by Solana transaction signature"),
    since: Optional[datetime] = Query(None, description="Inclusive start timestamp"),
    until: Optional[datetime] = Query(None, description="Exclusive end timestamp"),
    sort: str = Query("desc", regex="^(asc|desc)$", description="Sort order"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> EventListResponse:
    """Query events with flexible filters.

    Uses Redis caching for frequently-accessed recent pages (TTL 30s).
    Cache key includes all query parameters.

    Args:
        event_type: Exact event type string.
        source: 'solana' or 'github'.
        bounty_id: UUID of linked bounty.
        contributor_id: Wallet address or username.
        tx_hash: Solana tx signature.
        since: Start timestamp (inclusive).
        until: End timestamp (exclusive).
        sort: 'asc' or 'desc' by timestamp.
        page: 1-indexed page number.
        limit: Items per page (max 200).
        db: Database session.

    Returns:
        Paginated event list with total count and has_more flag.
    """
    # Build cache key from query params
    cache_key = f"events:{event_type}:{source}:{bounty_id}:{contributor_id}:{tx_hash}:{since}:{until}:{sort}:{page}:{limit}"
    
    # Try cache first (30s TTL for fast scrolling)
    try:
        redis = await get_redis()
        cached_raw = await redis.get(cache_key)
        if cached_raw:
            cached = json.loads(cached_raw)
            return EventListResponse(**cached)
    except Exception as e:
        logger.warning("Redis cache get failed: %s", e)

    # Build query
    stmt = select(EventDB)
    count_stmt = select(func.count()).select_from(EventDB)

    # Apply filters
    if event_type:
        stmt = stmt.where(EventDB.event_type == event_type)
        count_stmt = count_stmt.where(EventDB.event_type == event_type)
    if source:
        stmt = stmt.where(EventDB.source == source)
        count_stmt = count_stmt.where(EventDB.source == source)
    if bounty_id:
        stmt = stmt.where(EventDB.bounty_id == bounty_id)
        count_stmt = count_stmt.where(EventDB.bounty_id == bounty_id)
    if contributor_id:
        stmt = stmt.where(EventDB.contributor_id == contributor_id)
        count_stmt = count_stmt.where(EventDB.contributor_id == contributor_id)
    if tx_hash:
        stmt = stmt.where(EventDB.tx_hash == tx_hash)
        count_stmt = count_stmt.where(EventDB.tx_hash == tx_hash)
    if since:
        stmt = stmt.where(EventDB.timestamp >= since)
        count_stmt = count_stmt.where(EventDB.timestamp >= since)
    if until:
        stmt = stmt.where(EventDB.timestamp < until)
        count_stmt = count_stmt.where(EventDB.timestamp < until)

    # Sorting
    order_clause = desc if sort == "desc" else asc
    stmt = stmt.order_by(order_clause(EventDB.timestamp))

    # Pagination
    offset = (page - 1) * limit
    stmt = stmt.offset(offset).limit(limit)

    # Execute
    total = await db.scalar(count_stmt)
    if total is None:
        total = 0

    rows = (await db.execute(stmt)).scalars().all()

    events = [
        EventResponse(
            event_id=str(row.id),
            event_type=row.event_type,
            source=row.source,
            channel=row.channel,
            timestamp=row.timestamp,
            payload=row.payload,
            bounty_id=str(row.bounty_id) if row.bounty_id else None,
            contributor_id=row.contributor_id,
            tx_hash=row.tx_hash,
            block_slot=row.block_slot,
        )
        for row in rows
    ]

    response = EventListResponse(
        events=events,
        total=total,
        page=page,
        limit=limit,
        has_more=offset + len(events) < total,
    )

    # Cache result (30s)
    try:
        redis = await get_redis()
        await redis.setex(
            cache_key, 30, json.dumps(response.model_dump(mode="json"), default=str)
        )
    except Exception as e:
        logger.warning("Redis cache set failed: %s", e)

    return response


@router.get("/types", response_model=List[str])
async def list_event_types() -> List[str]:
    """Return all distinct event types present in the database."""
    cache_key = "event_types"
    try:
        redis = await get_redis()
        cached_raw = await redis.get(cache_key)
        if cached_raw:
            return json.loads(cached_raw)
    except Exception as e:
        logger.warning("Redis get failed: %s", e)

    from app.database import get_db_session
    async with get_db_session() as db:
        from sqlalchemy import select, distinct
        stmt = select(distinct(EventDB.event_type)).order_by(EventDB.event_type)
        result = (await db.execute(stmt)).scalars().all()
        types = list(result)
        try:
            redis = await get_redis()
            await redis.setex(cache_key, 60, json.dumps(types))
        except Exception as e:
            logger.warning("Redis set failed: %s", e)
        return types


@router.get("/sources", response_model=List[str])
async def list_sources() -> List[str]:
    """Return all distinct sources (e.g., 'solana', 'github')."""
    cache_key = "event_sources"
    try:
        redis = await get_redis()
        cached_raw = await redis.get(cache_key)
        if cached_raw:
            return json.loads(cached_raw)
    except Exception as e:
        logger.warning("Redis get failed: %s", e)

    from app.database import get_db_session
    async with get_db_session() as db:
        from sqlalchemy import select, distinct
        stmt = select(distinct(EventDB.source)).order_by(EventDB.source)
        result = (await db.execute(stmt)).scalars().all()
        sources = list(result)
        try:
            redis = await get_redis()
            await redis.setex(cache_key, 60, json.dumps(sources))
        except Exception as e:
            logger.warning("Redis set failed: %s", e)
        return sources
