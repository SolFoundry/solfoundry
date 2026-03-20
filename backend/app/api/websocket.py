"""WebSocket API endpoints for real-time updates.

This module provides WebSocket endpoints for real-time event streaming:
- Bounty status changes (new, updated, claimed)
- PR submission events
- Payout notifications
- Leaderboard updates

Endpoints:
    WS /ws - Main WebSocket connection endpoint

Message Format (matching bounty spec):
    Incoming:
        {"subscribe": "bounties"}                    # Subscribe to all bounties
        {"subscribe": "bounty:42"}                   # Subscribe to specific bounty
        {"unsubscribe": "bounties"}                  # Unsubscribe from channel
        {"type": "pong", "ping_id": "ping_123456"}   # Pong response to heartbeat
        {"type": "ping"}                             # Client-initiated ping

    Outgoing (matching bounty spec):
        {"type": "bounty_claimed", "data": {...}, "timestamp": "2024-01-01T00:00:00Z"}
        {"type": "heartbeat", "ping_id": "...", "timestamp": "..."}
        {"type": "error", "error_code": "...", "error_message": "..."}

Channels:
    - bounties: New/updated bounties
    - prs: PR submission events
    - payouts: Live payout feed
    - leaderboard: Rank changes
    - bounty:42: Specific bounty updates
"""

import logging
import json
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status

from app.services.websocket_manager import (
    manager,
    EventType,
    ErrorMessage,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


# Incoming message schemas
class SubscribeMessage:
    """Client subscription request."""

    def __init__(self, channel: str):
        self.channel = channel


class UnsubscribeMessage:
    """Client unsubscription request."""

    def __init__(self, channel: str):
        self.channel = channel


class PongMessage:
    """Client pong response to heartbeat."""

    def __init__(self, ping_id: str):
        self.ping_id = ping_id


class PingMessage:
    """Client-initiated ping for connection testing."""

    pass


async def parse_client_message(data: str) -> Optional[object]:
    """Parse incoming WebSocket message.

    Supports both formats:
    - Simple: {"subscribe": "bounty:42"}
    - Legacy: {"type": "subscribe", "channel": "bounties"}
    """
    try:
        raw = json.loads(data)

        # Simple format: {"subscribe": "channel"} or {"unsubscribe": "channel"}
        if "subscribe" in raw:
            return SubscribeMessage(channel=raw["subscribe"])
        elif "unsubscribe" in raw:
            return UnsubscribeMessage(channel=raw["unsubscribe"])

        # Legacy format with type field
        msg_type = raw.get("type", "").lower()

        if msg_type == "subscribe":
            channel = raw.get("channel") or raw.get("scope", "")
            if raw.get("target_id"):
                channel = f"{channel}:{raw['target_id']}"
            return SubscribeMessage(channel=channel)
        elif msg_type == "unsubscribe":
            channel = raw.get("channel") or raw.get("scope", "")
            if raw.get("target_id"):
                channel = f"{channel}:{raw['target_id']}"
            return UnsubscribeMessage(channel=channel)
        elif msg_type == "pong":
            return PongMessage(ping_id=raw.get("ping_id", ""))
        elif msg_type == "ping":
            return PingMessage()
        else:
            logger.warning(f"Unknown message type: {msg_type}")
            return None

    except json.JSONDecodeError:
        logger.warning("Invalid JSON received")
        return None
    except Exception as e:
        logger.warning(f"Message parse error: {e}")
        return None


async def send_error(
    websocket: WebSocket,
    error_code: str,
    error_message: str,
    details: Optional[dict] = None,
) -> None:
    """Send an error message to the client."""
    error = ErrorMessage(
        error_code=error_code, error_message=error_message, details=details
    )
    await websocket.send_json(error.model_dump(mode="json"))


async def authenticate_user(
    token: Optional[str], user_id: Optional[str]
) -> Optional[str]:
    """
    Authenticate user via JWT token.

    Args:
        token: JWT token from query param or first message
        user_id: Optional user_id for backward compatibility

    Returns:
        Authenticated user_id or None if authentication fails
    """
    if not token:
        # Allow unauthenticated connections for public channels
        return user_id or f"anonymous_{datetime.now(timezone.utc).timestamp()}"

    try:
        from app.services.auth_service import (
            decode_token,
            InvalidTokenError,
            TokenExpiredError,
        )

        validated_user_id = decode_token(token)
        return validated_user_id
    except (InvalidTokenError, TokenExpiredError) as e:
        logger.warning(f"Authentication failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return None


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    """
    Main WebSocket endpoint for real-time updates.

    Authentication:
        - JWT token in query param: ws://api.solfoundry.org/ws?token=xxx
        - Or first message: {"type": "auth", "token": "xxx"}

    Connection Flow:
        1. Client connects with optional JWT token
        2. Server accepts connection and sends confirmation
        3. Client subscribes to channels
        4. Server sends events matching subscriptions
        5. Server sends periodic heartbeats
        6. Client responds with pong

    Channels:
        - bounties: All bounty updates
        - bounty:42: Specific bounty #42
        - prs: All PR events
        - payouts: All payout events
        - leaderboard: Rank changes

    Example:
        const ws = new WebSocket("ws://localhost:8000/ws?token=xxx");
        ws.send(JSON.stringify({subscribe: "bounties"}));
        ws.send(JSON.stringify({subscribe: "bounty:42"}));
    """
    # Authenticate user
    user_id = await authenticate_user(token, None)
    authenticated = token is not None and user_id is not None

    if token and not authenticated:
        # Invalid token - reject connection
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token"
        )
        return

    # Connect to the manager
    await manager.connect(
        websocket, user_id or "anonymous", authenticated=authenticated
    )

    # Send connection confirmation (matching bounty spec format)
    await websocket.send_json(
        {
            "type": "connected",
            "data": {
                "user_id": user_id,
                "message": "Connected to SolFoundry real-time updates",
                "authenticated": authenticated,
                "channels": ["bounties", "prs", "payouts", "leaderboard"],
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )

    logger.info(
        f"WebSocket client connected: user={user_id}, authenticated={authenticated}"
    )

    try:
        while True:
            # Check rate limit
            if not manager.check_rate_limit(websocket):
                await send_error(
                    websocket,
                    error_code="RATE_LIMITED",
                    error_message="Too many messages. Please slow down.",
                    details={"remaining": manager.get_rate_limit_remaining(websocket)},
                )
                continue

            # Receive and process messages from client
            data = await websocket.receive_text()
            message = await parse_client_message(data)

            if message is None:
                await send_error(
                    websocket,
                    error_code="INVALID_MESSAGE",
                    error_message="Could not parse message",
                )
                continue

            if isinstance(message, SubscribeMessage):
                # Parse subscription
                parsed = manager.parse_subscription(message.channel)

                if not parsed:
                    await send_error(
                        websocket,
                        error_code="INVALID_CHANNEL",
                        error_message=f"Invalid channel: {message.channel}",
                        details={
                            "valid_channels": [
                                "bounties",
                                "prs",
                                "payouts",
                                "leaderboard",
                                "bounty:ID",
                            ]
                        },
                    )
                    continue

                channel_type, target_id = parsed
                channel = message.channel.lower()

                # Subscribe
                success = await manager.subscribe(websocket, channel)
                if success:
                    await websocket.send_json(
                        {
                            "type": "subscribed",
                            "data": {"channel": channel},
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                    logger.debug(f"User {user_id} subscribed to {channel}")
                else:
                    await send_error(
                        websocket,
                        error_code="SUBSCRIPTION_FAILED",
                        error_message="Failed to subscribe",
                    )

            elif isinstance(message, UnsubscribeMessage):
                channel = message.channel.lower()

                success = await manager.unsubscribe(websocket, channel)
                if success:
                    await websocket.send_json(
                        {
                            "type": "unsubscribed",
                            "data": {"channel": channel},
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )

            elif isinstance(message, PongMessage):
                # Update last pong time
                manager.handle_pong(websocket)
                logger.debug(f"Received pong from user {user_id}")

            elif isinstance(message, PingMessage):
                # Respond to client ping
                await websocket.send_json(
                    {
                        "type": "pong",
                        "data": {},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: user={user_id}")
    except Exception as e:
        logger.error(f"WebSocket error: user={user_id}, error={e}")
    finally:
        await manager.disconnect(websocket)


# HTTP endpoint for connection stats (useful for monitoring)
@router.get("/ws/stats")
async def get_websocket_stats():
    """
    Get WebSocket connection statistics.

    Returns:
        - total_connections: Total active WebSocket connections
        - unique_users: Number of unique users connected
        - redis_enabled: Whether Redis pub/sub is enabled
        - subscriptions: Total number of active subscriptions
        - channels: Active channels
    """
    return manager.get_stats()


# Helper functions for other modules to broadcast events
async def broadcast_bounty_event(
    event_type: EventType, bounty_id: int, data: dict, broadcast_all: bool = True
) -> int:
    """
    Broadcast a bounty event.

    Args:
        event_type: Type of bounty event
        bounty_id: Bounty ID
        data: Event data
        broadcast_all: Also broadcast to "bounties" channel

    Returns:
        Number of clients notified
    """
    count = 0

    # Broadcast to specific bounty channel
    count += await manager.broadcast_event(
        event_type=event_type, data=data, channel=f"bounty:{bounty_id}"
    )

    # Also broadcast to general bounties channel
    if broadcast_all:
        count += await manager.broadcast_event(
            event_type=event_type, data=data, channel="bounties"
        )

    return count


async def broadcast_pr_event(
    event_type: EventType, pr_id: int, data: dict, user_id: Optional[str] = None
) -> int:
    """
    Broadcast a PR event.

    Args:
        event_type: Type of PR event
        pr_id: PR ID
        data: Event data
        user_id: Optional user for direct notification

    Returns:
        Number of clients notified
    """
    count = 0

    # Broadcast to PRs channel
    count += await manager.broadcast_event(
        event_type=event_type, data=data, channel="prs"
    )

    # Also send to specific user if provided
    if user_id:
        count += await manager.broadcast_to_user(
            user_id=user_id, event_type=event_type, data=data
        )

    return count


async def broadcast_payout_event(
    event_type: EventType, payout_id: str, data: dict, user_id: Optional[str] = None
) -> int:
    """
    Broadcast a payout event.

    Args:
        event_type: Type of payout event
        payout_id: Payout ID
        data: Event data
        user_id: Optional user for direct notification

    Returns:
        Number of clients notified
    """
    count = 0

    # Broadcast to payouts channel
    count += await manager.broadcast_event(
        event_type=event_type, data=data, channel="payouts"
    )

    # Also send to specific user if provided
    if user_id:
        count += await manager.broadcast_to_user(
            user_id=user_id, event_type=event_type, data=data
        )

    return count


async def broadcast_leaderboard_event(event_type: EventType, data: dict) -> int:
    """
    Broadcast a leaderboard event.

    Args:
        event_type: Type of event
        data: Event data

    Returns:
        Number of clients notified
    """
    return await manager.broadcast_event(
        event_type=event_type, data=data, channel="leaderboard"
    )
