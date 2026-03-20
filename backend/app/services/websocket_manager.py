"""WebSocket connection manager for real-time updates.

This module provides WebSocket connection management with:
- Channel-based subscriptions (bounties, prs, payouts, leaderboard)
- Redis pub/sub for distributed message broadcasting
- Heartbeat/ping-pong for connection health
- JWT authentication
- Per-connection rate limiting

Channels:
    - bounties: New/updated bounties
    - prs: PR submission events
    - payouts: Live payout feed
    - leaderboard: Rank changes

Usage:
    manager = ConnectionManager()
    await manager.connect(websocket, user_id)
    await manager.subscribe(websocket, "bounties")
    await manager.broadcast_event("bounty_claimed", {"bounty_id": 42}, "bounties")
"""

import os
import json
import asyncio
import logging
import time
from typing import Dict, Set, Optional, Any, List
from datetime import datetime, timezone
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict

from fastapi import WebSocket
from pydantic import BaseModel, Field

# Optional Redis support for distributed deployments
try:
    import redis.asyncio as redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)


class Channel(str, Enum):
    """WebSocket channels matching bounty spec."""

    BOUNTIES = "bounties"  # New/updated bounties
    PRS = "prs"  # PR submission events
    PAYOUTS = "payouts"  # Live payout feed
    LEADERBOARD = "leaderboard"  # Rank changes


class EventType(str, Enum):
    """Event types for WebSocket messages.

    Matches bounty spec: {"type": "bounty_claimed", "data": {...}, "timestamp": "..."}
    """

    # Bounty events
    BOUNTY_CREATED = "bounty_created"
    BOUNTY_UPDATED = "bounty_updated"
    BOUNTY_CLAIMED = "bounty_claimed"
    BOUNTY_ASSIGNED = "bounty_assigned"

    # PR events
    PR_SUBMITTED = "pr_submitted"
    PR_STATUS_CHANGED = "pr_status_changed"
    PR_REVIEWED = "pr_reviewed"

    # Payout events
    PAYOUT_INITIATED = "payout_initiated"
    PAYOUT_COMPLETED = "payout_completed"

    # Leaderboard events
    LEADERBOARD_UPDATE = "leaderboard_update"
    RANK_CHANGE = "rank_change"

    # System events
    HEARTBEAT = "heartbeat"
    CONNECTED = "connected"
    SUBSCRIBED = "subscribed"
    UNSUBSCRIBED = "unsubscribed"
    ERROR = "error"


@dataclass
class RateLimit:
    """Rate limiting state for a connection."""

    max_messages: int = 100  # Max messages per minute
    window_seconds: int = 60
    message_times: List[float] = field(default_factory=list)

    def is_allowed(self) -> bool:
        """Check if message is allowed under rate limit."""
        now = time.time()
        # Remove old entries
        self.message_times = [
            t for t in self.message_times if now - t < self.window_seconds
        ]

        if len(self.message_times) >= self.max_messages:
            return False

        self.message_times.append(now)
        return True

    def remaining(self) -> int:
        """Get remaining messages in current window."""
        now = time.time()
        self.message_times = [
            t for t in self.message_times if now - t < self.window_seconds
        ]
        return max(0, self.max_messages - len(self.message_times))


@dataclass
class ConnectionInfo:
    """Information about an active WebSocket connection."""

    websocket: WebSocket
    user_id: str
    subscriptions: Set[str] = field(
        default_factory=set
    )  # Channel names like "bounties", "bounty:42"
    rate_limit: RateLimit = field(default_factory=RateLimit)
    last_ping: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_pong: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_alive: bool = True
    authenticated: bool = False


class WebSocketMessage(BaseModel):
    """Standard WebSocket message format matching bounty spec.

    Format: {"type": "event_type", "data": {...}, "timestamp": "..."}
    """

    type: EventType
    data: Dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class HeartbeatMessage(BaseModel):
    """Heartbeat message for connection health."""

    type: EventType = EventType.HEARTBEAT
    ping_id: str
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ErrorMessage(BaseModel):
    """Error message format."""

    type: EventType = EventType.ERROR
    error_code: str
    error_message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class ConnectionManager:
    """
    Manages WebSocket connections with Redis pub/sub support.

    Features:
    - Per-user connection tracking
    - Channel-based subscriptions (bounties, prs, payouts, leaderboard)
    - Specific bounty subscription: {"subscribe": "bounty:42"}
    - Redis pub/sub for distributed deployments
    - JWT authentication
    - Per-connection rate limiting
    - Automatic heartbeat/ping-pong

    Example:
        manager = ConnectionManager()

        # In WebSocket endpoint
        await manager.connect(websocket, user_id="user_123")
        await manager.subscribe(websocket, "bounties")
        await manager.subscribe(websocket, "bounty:42")  # Specific bounty

        # Broadcast event
        await manager.broadcast_event(
            event_type=EventType.BOUNTY_CLAIMED,
            data={"bounty_id": 42, "user_id": "user_456"},
            channel="bounties"
        )
    """

    # Heartbeat configuration
    HEARTBEAT_INTERVAL = 30  # seconds
    HEARTBEAT_TIMEOUT = 10  # seconds to wait for pong

    # Rate limiting defaults
    DEFAULT_RATE_LIMIT = 100  # messages per minute
    DEFAULT_RATE_WINDOW = 60  # seconds

    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize the connection manager.

        Args:
            redis_url: Optional Redis URL for pub/sub. If not provided,
                      runs in single-instance mode (no cross-instance messaging).
        """
        # Active connections: user_id -> set of ConnectionInfo
        self._connections: Dict[str, Set[ConnectionInfo]] = {}

        # WebSocket to user mapping for quick lookup
        self._ws_to_user: Dict[WebSocket, str] = {}

        # WebSocket to ConnectionInfo mapping
        self._ws_to_info: Dict[WebSocket, ConnectionInfo] = {}

        # Channel to subscribers mapping
        self._channel_subscribers: Dict[str, Set[WebSocket]] = defaultdict(set)

        # Redis client (optional)
        self._redis: Optional[redis.Redis] = None
        self._redis_url = redis_url or os.getenv("REDIS_URL")
        self._pubsub: Optional[redis.client.PubSub] = None
        self._redis_task: Optional[asyncio.Task] = None

        # Heartbeat task
        self._heartbeat_task: Optional[asyncio.Task] = None

    async def initialize(self) -> None:
        """Initialize Redis connection and start background tasks."""
        if REDIS_AVAILABLE and self._redis_url:
            try:
                self._redis = redis.from_url(self._redis_url, decode_responses=True)
                self._pubsub = self._redis.pubsub()
                await self._pubsub.subscribe("websocket_events")
                self._redis_task = asyncio.create_task(self._redis_listener())
                logger.info(f"WebSocket manager connected to Redis: {self._redis_url}")
            except Exception as e:
                logger.warning(
                    f"Failed to connect to Redis: {e}. Running in single-instance mode."
                )
                self._redis = None

        # Start heartbeat task
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        logger.info("WebSocket manager initialized")

    async def shutdown(self) -> None:
        """Clean up resources on shutdown."""
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

        if self._redis_task:
            self._redis_task.cancel()
            try:
                await self._redis_task
            except asyncio.CancelledError:
                pass

        if self._pubsub:
            await self._pubsub.unsubscribe()
            await self._pubsub.close()

        if self._redis:
            await self._redis.close()

        # Close all WebSocket connections
        for ws_list in list(self._connections.values()):
            for info in ws_list:
                try:
                    await info.websocket.close(code=1001, reason="Server shutdown")
                except Exception:
                    pass

        self._connections.clear()
        self._ws_to_user.clear()
        self._ws_to_info.clear()
        self._channel_subscribers.clear()
        logger.info("WebSocket manager shutdown complete")

    async def connect(
        self, websocket: WebSocket, user_id: str, authenticated: bool = False
    ) -> ConnectionInfo:
        """
        Accept a new WebSocket connection.

        Args:
            websocket: The WebSocket connection
            user_id: The authenticated user's ID
            authenticated: Whether the user has been authenticated via JWT

        Returns:
            ConnectionInfo for the new connection
        """
        await websocket.accept()

        info = ConnectionInfo(
            websocket=websocket,
            user_id=user_id,
            authenticated=authenticated,
            rate_limit=RateLimit(
                max_messages=self.DEFAULT_RATE_LIMIT,
                window_seconds=self.DEFAULT_RATE_WINDOW,
            ),
        )

        # Add to connections
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(info)

        # Add to lookup maps
        self._ws_to_user[websocket] = user_id
        self._ws_to_info[websocket] = info

        logger.info(
            f"WebSocket connected: user={user_id}, authenticated={authenticated}, total_connections={len(self._ws_to_user)}"
        )

        return info

    async def disconnect(self, websocket: WebSocket) -> None:
        """
        Handle WebSocket disconnection.

        Args:
            websocket: The WebSocket to disconnect
        """
        user_id = self._ws_to_user.pop(websocket, None)
        info = self._ws_to_info.pop(websocket, None)

        if user_id and info:
            if user_id in self._connections:
                self._connections[user_id].discard(info)
                if not self._connections[user_id]:
                    del self._connections[user_id]

            # Remove from all channel subscriptions
            for channel in info.subscriptions:
                self._channel_subscribers[channel].discard(websocket)

            # Unsubscribe from Redis channels
            if self._redis:
                for channel in info.subscriptions:
                    try:
                        await self._pubsub.unsubscribe(channel)
                    except Exception as e:
                        logger.warning(f"Failed to unsubscribe from {channel}: {e}")

        logger.info(
            f"WebSocket disconnected: user={user_id}, remaining={len(self._ws_to_user)}"
        )

    def check_rate_limit(self, websocket: WebSocket) -> bool:
        """
        Check if a message is allowed under rate limiting.

        Args:
            websocket: The WebSocket connection

        Returns:
            True if message is allowed, False if rate limited
        """
        info = self._ws_to_info.get(websocket)
        if not info:
            return False
        return info.rate_limit.is_allowed()

    def get_rate_limit_remaining(self, websocket: WebSocket) -> int:
        """Get remaining messages for rate limit."""
        info = self._ws_to_info.get(websocket)
        if not info:
            return 0
        return info.rate_limit.remaining()

    async def subscribe(self, websocket: WebSocket, channel: str) -> bool:
        """
        Subscribe a connection to a channel.

        Args:
            websocket: The WebSocket connection
            channel: Channel name (e.g., "bounties", "bounty:42")

        Returns:
            True if subscription was added, False if connection not found
        """
        info = self._ws_to_info.get(websocket)
        if not info:
            return False

        info.subscriptions.add(channel)
        self._channel_subscribers[channel].add(websocket)

        # Subscribe to Redis channel if available
        if self._redis:
            try:
                await self._pubsub.subscribe(channel)
                logger.debug(f"Subscribed to Redis channel: {channel}")
            except Exception as e:
                logger.warning(f"Failed to subscribe to Redis: {e}")

        return True

    async def unsubscribe(self, websocket: WebSocket, channel: str) -> bool:
        """
        Unsubscribe a connection from a channel.

        Args:
            websocket: The WebSocket connection
            channel: Channel name

        Returns:
            True if subscription was removed, False if not found
        """
        info = self._ws_to_info.get(websocket)
        if not info:
            return False

        if channel in info.subscriptions:
            info.subscriptions.remove(channel)
            self._channel_subscribers[channel].discard(websocket)

            # Unsubscribe from Redis if no other connections need it
            if self._redis and channel not in self._channel_subscribers:
                try:
                    await self._pubsub.unsubscribe(channel)
                except Exception as e:
                    logger.warning(f"Failed to unsubscribe from Redis: {e}")

        return True

    def parse_subscription(self, subscription_str: str) -> Optional[tuple]:
        """
        Parse subscription string like "bounty:42" or "bounties".

        Returns:
            Tuple of (channel_type, target_id) or None if invalid
        """
        parts = subscription_str.split(":", 1)

        if len(parts) == 1:
            # Simple channel like "bounties"
            channel = parts[0].lower()
            try:
                Channel(channel)
                return (channel, None)
            except ValueError:
                return None
        else:
            # Specific subscription like "bounty:42"
            channel_type = parts[0].lower()
            target_id = parts[1]

            # Validate channel type
            valid_prefixes = ["bounty", "pr", "user"]
            if channel_type in valid_prefixes:
                return (channel_type, target_id)

            # Also accept main channels
            try:
                Channel(channel_type)
                return (channel_type, target_id)
            except ValueError:
                return None

    async def send_personal_message(
        self, websocket: WebSocket, event_type: EventType, data: Dict[str, Any]
    ) -> bool:
        """
        Send a message to a specific WebSocket connection.

        Args:
            websocket: The target WebSocket
            event_type: Type of event
            data: Event payload

        Returns:
            True if sent successfully, False otherwise
        """
        message = WebSocketMessage(type=event_type, data=data)
        try:
            await websocket.send_json(message.model_dump(mode="json"))
            return True
        except Exception as e:
            logger.warning(f"Failed to send message: {e}")
            return False

    async def broadcast_to_user(
        self,
        user_id: str,
        event_type: EventType,
        data: Dict[str, Any],
        exclude: Optional[WebSocket] = None,
    ) -> int:
        """
        Broadcast a message to all connections of a specific user.

        Args:
            user_id: Target user ID
            event_type: Type of event
            data: Event payload
            exclude: Optional WebSocket to exclude from broadcast

        Returns:
            Number of connections the message was sent to
        """
        connections = self._connections.get(user_id, set())
        message = WebSocketMessage(type=event_type, data=data)

        sent_count = 0
        for info in connections:
            if exclude and info.websocket == exclude:
                continue
            try:
                await info.websocket.send_json(message.model_dump(mode="json"))
                sent_count += 1
            except Exception as e:
                logger.warning(f"Failed to broadcast to user {user_id}: {e}")
                info.is_alive = False

        return sent_count

    async def broadcast_event(
        self,
        event_type: EventType,
        data: Dict[str, Any],
        channel: str,
        exclude: Optional[WebSocket] = None,
    ) -> int:
        """
        Broadcast an event to all subscribers of a channel.

        Args:
            event_type: Type of event
            data: Event payload
            channel: Channel name (e.g., "bounties", "bounty:42")
            exclude: Optional WebSocket to exclude

        Returns:
            Number of connections the message was sent to
        """
        message = WebSocketMessage(type=event_type, data=data)

        # Publish to Redis for distributed delivery
        if self._redis:
            try:
                await self._redis.publish(
                    channel, json.dumps(message.model_dump(mode="json"))
                )
            except Exception as e:
                logger.warning(f"Failed to publish to Redis: {e}")

        # Send to local subscribers
        sent_count = 0
        subscribers = self._channel_subscribers.get(channel, set())

        for websocket in subscribers:
            if exclude and websocket == exclude:
                continue

            info = self._ws_to_info.get(websocket)
            if not info or not info.is_alive:
                continue

            try:
                await websocket.send_json(message.model_dump(mode="json"))
                sent_count += 1
            except Exception as e:
                logger.warning(f"Failed to send to subscriber: {e}")
                info.is_alive = False

        return sent_count

    async def _redis_listener(self) -> None:
        """Listen for Redis pub/sub messages and forward to local connections."""
        if not self._pubsub:
            return

        try:
            async for message in self._pubsub.listen():
                if message["type"] != "message":
                    continue

                try:
                    channel = message.get("channel", "")
                    msg_data = json.loads(message["data"])

                    # Forward to local subscribers
                    subscribers = self._channel_subscribers.get(channel, set())
                    for websocket in subscribers:
                        info = self._ws_to_info.get(websocket)
                        if info and info.is_alive:
                            try:
                                await websocket.send_json(msg_data)
                            except Exception:
                                info.is_alive = False

                except json.JSONDecodeError:
                    logger.warning("Invalid JSON in Redis message")

        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Redis listener error: {e}")

    async def _heartbeat_loop(self) -> None:
        """Send periodic heartbeats and check connection health."""
        while True:
            try:
                await asyncio.sleep(self.HEARTBEAT_INTERVAL)

                now = datetime.now(timezone.utc)

                # Check all connections
                for info in list(self._ws_to_info.values()):
                    # Check if connection timed out
                    time_since_pong = (now - info.last_pong).total_seconds()
                    if time_since_pong > self.HEARTBEAT_INTERVAL * 3:
                        logger.info(f"Connection timeout: user={info.user_id}")
                        info.is_alive = False
                        try:
                            await info.websocket.close(
                                code=1001, reason="Heartbeat timeout"
                            )
                        except Exception:
                            pass
                        continue

                    # Send ping
                    if info.is_alive:
                        ping_id = f"ping_{now.timestamp()}"
                        try:
                            await info.websocket.send_json(
                                HeartbeatMessage(ping_id=ping_id).model_dump(
                                    mode="json"
                                )
                            )
                            info.last_ping = now
                        except Exception:
                            info.is_alive = False

                # Clean up dead connections
                dead_sockets = [
                    ws for ws, info in self._ws_to_info.items() if not info.is_alive
                ]
                for ws in dead_sockets:
                    await self.disconnect(ws)

            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Heartbeat loop error: {e}")

    def handle_pong(self, websocket: WebSocket) -> None:
        """Update last pong time for a connection."""
        info = self._ws_to_info.get(websocket)
        if info:
            info.last_pong = datetime.now(timezone.utc)

    def get_connection_count(self) -> int:
        """Get total number of active connections."""
        return len(self._ws_to_user)

    def get_user_connection_count(self, user_id: str) -> int:
        """Get number of connections for a specific user."""
        return len(self._connections.get(user_id, set()))

    def get_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        return {
            "total_connections": len(self._ws_to_user),
            "unique_users": len(self._connections),
            "redis_enabled": self._redis is not None,
            "subscriptions": sum(
                len(info.subscriptions) for info in self._ws_to_info.values()
            ),
            "channels": list(self._channel_subscribers.keys()),
        }


# Global connection manager instance
manager = ConnectionManager()
