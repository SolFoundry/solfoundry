"""WebSocket live feed for real-time event streaming with subscription filters.

Provides a dedicated WebSocket endpoint for the event indexer that supports
topic-based subscriptions.  Clients can subscribe to specific event sources,
categories, contributors, or bounties to receive filtered live updates.

Connection:
    ws://host/ws/indexer?token=<jwt_or_uuid>

Message protocol:
    Client → Server:
        {"type": "subscribe", "filters": {"source": "github", "category": "pr_merged"}}
        {"type": "unsubscribe"}
        {"type": "pong"}

    Server → Client:
        {"type": "event", "data": {<IndexedEventResponse>}}
        {"type": "subscribed", "filters": {<active_filters>}}
        {"type": "unsubscribed"}
        {"type": "ping"}
        {"type": "error", "detail": "..."}

Architecture:
    The indexer WebSocket piggybacks on the existing WebSocketManager's
    pub/sub infrastructure.  When an event is ingested, it is broadcast
    to the ``indexer:live`` channel.  This endpoint filters events based
    on each client's subscription before forwarding.
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Set

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.websocket_manager import manager as ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["indexer-websocket"])

# Store active subscription filters per connection
_connection_filters: Dict[str, Dict[str, Optional[str]]] = {}


@dataclass
class SubscriptionFilter:
    """Subscription filter for a WebSocket connection.

    Clients can specify any combination of filters.  Events that
    match ALL specified filters are forwarded to the client.
    Unspecified filters match everything (wildcard).

    Attributes:
        source: Filter by event source (solana, github, system).
        category: Filter by event category.
        contributor: Filter by contributor username.
        bounty_id: Filter by bounty identifier.
    """

    source: Optional[str] = None
    category: Optional[str] = None
    contributor: Optional[str] = None
    bounty_id: Optional[str] = None

    def matches(self, event_data: Dict[str, Any]) -> bool:
        """Check if an event matches this subscription filter.

        An event matches if it satisfies ALL specified filter criteria.
        Unset filters (None) match any value.

        Args:
            event_data: The event payload dictionary to check.

        Returns:
            True if the event matches all active filters.
        """
        if self.source and event_data.get("source") != self.source:
            return False
        if self.category and event_data.get("category") != self.category:
            return False
        if self.contributor and event_data.get("contributor_username") != self.contributor:
            return False
        if self.bounty_id and event_data.get("bounty_id") != self.bounty_id:
            return False
        return True


# Connection state: maps connection_id → SubscriptionFilter
_subscriptions: Dict[str, SubscriptionFilter] = {}


@router.websocket("/ws/indexer")
async def indexer_websocket_endpoint(
    ws: WebSocket,
    token: str = Query(..., description="Bearer token (JWT or UUID)"),
) -> None:
    """WebSocket endpoint for real-time event streaming with filters.

    Authenticates the connection, subscribes to the indexer live channel,
    and forwards matching events based on the client's subscription
    filters.

    The connection lifecycle:
    1. Authenticate via token parameter.
    2. Subscribe to ``indexer:live`` channel.
    3. Client sends filter configuration.
    4. Server forwards matching events.
    5. Heartbeat pings every 30 seconds.

    Args:
        ws: The WebSocket connection.
        token: Authentication token (JWT or UUID).
    """
    connection_id = await ws_manager.connect(ws, token)
    if connection_id is None:
        return

    # Default: receive all events (no filter)
    _subscriptions[connection_id] = SubscriptionFilter()

    # Subscribe to the indexer live channel
    await ws_manager.subscribe(connection_id, "indexer:live")

    # Start heartbeat
    heartbeat_task = asyncio.create_task(
        _heartbeat_loop(ws, connection_id)
    )

    try:
        while True:
            raw = await ws.receive_text()
            response = await _handle_indexer_message(connection_id, raw)
            if response is not None:
                await ws.send_json(response)
    except WebSocketDisconnect:
        logger.info("Indexer WS disconnected: cid=%s", connection_id)
    except Exception as error:
        logger.error("Indexer WS error: cid=%s error=%s", connection_id, error)
    finally:
        heartbeat_task.cancel()
        _subscriptions.pop(connection_id, None)
        await ws_manager.disconnect(connection_id)


async def _handle_indexer_message(
    connection_id: str,
    raw: str,
) -> Optional[Dict[str, Any]]:
    """Parse and handle an inbound message from an indexer WebSocket client.

    Supported message types:
    - subscribe: Set subscription filters for this connection.
    - unsubscribe: Clear all subscription filters.
    - pong: Heartbeat acknowledgement (no response).

    Args:
        connection_id: The WebSocket connection identifier.
        raw: Raw JSON message string from the client.

    Returns:
        Response dictionary to send back, or None for no response.
    """
    try:
        message = json.loads(raw)
    except json.JSONDecodeError:
        return {"type": "error", "detail": "Invalid JSON"}

    message_type = message.get("type")

    if message_type == "pong":
        return None

    if message_type == "subscribe":
        filters = message.get("filters", {})
        subscription = SubscriptionFilter(
            source=filters.get("source"),
            category=filters.get("category"),
            contributor=filters.get("contributor"),
            bounty_id=filters.get("bounty_id"),
        )
        _subscriptions[connection_id] = subscription

        logger.info(
            "Indexer WS subscribe: cid=%s filters=%s",
            connection_id,
            {
                "source": subscription.source,
                "category": subscription.category,
                "contributor": subscription.contributor,
                "bounty_id": subscription.bounty_id,
            },
        )

        return {
            "type": "subscribed",
            "filters": {
                "source": subscription.source,
                "category": subscription.category,
                "contributor": subscription.contributor,
                "bounty_id": subscription.bounty_id,
            },
        }

    if message_type == "unsubscribe":
        _subscriptions[connection_id] = SubscriptionFilter()
        return {"type": "unsubscribed"}

    return {"type": "error", "detail": f"Unknown message type: {message_type}"}


async def _heartbeat_loop(ws: WebSocket, connection_id: str) -> None:
    """Send periodic ping messages to keep the connection alive.

    Args:
        ws: The WebSocket connection.
        connection_id: The connection identifier for tracking.
    """
    try:
        while connection_id in _subscriptions:
            await asyncio.sleep(30)
            try:
                await ws.send_json({"type": "ping"})
            except Exception:
                break
    except asyncio.CancelledError:
        pass


async def broadcast_to_indexer_subscribers(
    event_data: Dict[str, Any],
) -> int:
    """Broadcast an event to all indexer WebSocket subscribers.

    Filters the event against each connection's subscription and
    only sends to matching clients.

    Args:
        event_data: The event data dictionary to broadcast.

    Returns:
        Number of clients that received the event.
    """
    sent_count = 0

    for connection_id, subscription in list(_subscriptions.items()):
        if not subscription.matches(event_data):
            continue

        conn = ws_manager._connections.get(connection_id)
        if conn is None:
            _subscriptions.pop(connection_id, None)
            continue

        try:
            await conn.ws.send_json({
                "type": "event",
                "data": event_data,
            })
            sent_count += 1
        except Exception:
            _subscriptions.pop(connection_id, None)
            await ws_manager.disconnect(connection_id)

    return sent_count


def get_active_subscriptions_count() -> int:
    """Return the number of active indexer WebSocket subscriptions.

    Returns:
        Count of active subscription connections.
    """
    return len(_subscriptions)


def get_subscription_info() -> Dict[str, Any]:
    """Return summary information about active indexer subscriptions.

    Returns:
        Dictionary with subscription statistics and filter breakdowns.
    """
    source_filters: Dict[str, int] = {}
    category_filters: Dict[str, int] = {}
    unfiltered = 0

    for subscription in _subscriptions.values():
        if subscription.source:
            source_filters[subscription.source] = (
                source_filters.get(subscription.source, 0) + 1
            )
        if subscription.category:
            category_filters[subscription.category] = (
                category_filters.get(subscription.category, 0) + 1
            )
        if (
            not subscription.source
            and not subscription.category
            and not subscription.contributor
            and not subscription.bounty_id
        ):
            unfiltered += 1

    return {
        "total_subscriptions": len(_subscriptions),
        "unfiltered": unfiltered,
        "source_filters": source_filters,
        "category_filters": category_filters,
    }
