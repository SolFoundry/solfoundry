"""WebSocket endpoint and polling-fallback REST API for real-time events.

Connect: ws://host/ws?token=<jwt_or_uuid>
Polling: GET /api/events/{channel}?since=ISO8601&limit=50
Status:  GET /api/events/status
Types:   GET /api/events/types
"""

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.models.event import EventType
from app.services.websocket_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: str = Query(..., description="Bearer token (JWT or UUID)"),
) -> None:
    """Accept a WebSocket connection, authenticate, and route messages."""
    connection_id = await manager.connect(ws, token)
    if connection_id is None:
        return
    heartbeat_task = asyncio.create_task(manager.heartbeat(connection_id))
    try:
        while True:
            raw = await ws.receive_text()
            response = await manager.handle_message(connection_id, raw)
            if response is not None:
                await ws.send_json(response)
    except WebSocketDisconnect:
        pass
    finally:
        heartbeat_task.cancel()
        await manager.disconnect(connection_id)


# -- Response models --

class EventListResponse(BaseModel):
    """Paginated list of buffered events for a channel."""
    events: List[Dict[str, Any]]
    channel: str
    count: int


class ConnectionStatusResponse(BaseModel):
    """WebSocket connection statistics."""
    active_connections: int
    max_connections: int
    total_channels: int
    channels: Dict[str, int]


class EventTypesResponse(BaseModel):
    """Supported event types with descriptions."""
    event_types: List[str]
    description: Dict[str, str]


# -- Static routes before dynamic {channel} route --

@router.get("/api/events/status", response_model=ConnectionStatusResponse)
async def get_connection_status() -> ConnectionStatusResponse:
    """Return current WebSocket connection statistics."""
    return ConnectionStatusResponse(**manager.get_connection_info())


@router.get("/api/events/types", response_model=EventTypesResponse)
async def get_event_types() -> EventTypesResponse:
    """Return all supported event types."""
    descriptions = {
        EventType.BOUNTY_UPDATE.value: "Bounty lifecycle state changes",
        EventType.PR_SUBMITTED.value: "New PR submitted against a bounty",
        EventType.REVIEW_PROGRESS.value: "AI review pipeline progress",
        EventType.PAYOUT_SENT.value: "On-chain $FNDRY payout confirmed",
        EventType.CLAIM_UPDATE.value: "Bounty claim lifecycle changes",
    }
    return EventTypesResponse(
        event_types=[t.value for t in EventType],
        description=descriptions,
    )


@router.get("/api/events/{channel}", response_model=EventListResponse)
async def get_channel_events(
    channel: str,
    since: Optional[str] = Query(None, description="ISO-8601 UTC cutoff"),
    limit: int = Query(50, ge=1, le=200),
) -> EventListResponse:
    """Polling fallback — fetch recent buffered events for a channel.

    Clients that cannot maintain a WebSocket should poll this endpoint
    at 5-30 s intervals, passing the timestamp of the last received
    event as the ``since`` parameter.
    """
    since_dt: Optional[datetime] = None
    if since is not None:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, "Invalid 'since' — must be ISO-8601")
    events = manager.get_buffered_events(channel, since=since_dt, limit=limit)
    return EventListResponse(events=events, channel=channel, count=len(events))
