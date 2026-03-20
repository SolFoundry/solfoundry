"""WebSocket connection manager for real-time updates.

This module provides WebSocket connection management with:
- Per-user and per-repository subscriptions
- Redis pub/sub for distributed message broadcasting
- Heartbeat/ping-pong for connection health
- Automatic reconnection support
- Event type filtering

Usage:
    manager = ConnectionManager()
    await manager.connect(websocket, user_id, subscriptions)
    await manager.broadcast_event("pr_status", {"pr_id": 123}, user_id)
"""

import os
import json
import asyncio
import logging
from typing import Dict, Set, Optional, Any
from datetime import datetime, timezone
from enum import Enum
from dataclasses import dataclass, field

from fastapi import WebSocket
from pydantic import BaseModel, Field, ValidationError

# Optional Redis support for distributed deployments
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """Supported WebSocket event types."""
    PR_STATUS_CHANGED = "pr_status_changed"
    NEW_COMMENT = "new_comment"
    REVIEW_COMPLETE = "review_complete"
    PAYOUT_SENT = "payout_sent"
    HEARTBEAT = "heartbeat"
    SUBSCRIPTION_UPDATE = "subscription_update"
    ERROR = "error"


class SubscriptionScope(str, Enum):
    """Subscription scopes for filtering events."""
    USER = "user"       # Events specific to a user
    REPO = "repo"       # Events specific to a repository
    BOUNTY = "bounty"   # Events specific to a bounty
    GLOBAL = "global"   # Global system events


@dataclass
class Subscription:
    """Represents a client's subscription to event channels."""
    scope: SubscriptionScope
    target_id: str  # user_id, repo_id, or bounty_id
    
    def to_channel(self) -> str:
        """Convert subscription to Redis channel name."""
        return f"{self.scope.value}:{self.target_id}"
    
    @classmethod
    def from_string(cls, s: str) -> Optional["Subscription"]:
        """Parse subscription from string format 'scope:target_id'."""
        parts = s.split(":", 1)
        if len(parts) != 2:
            return None
        try:
            scope = SubscriptionScope(parts[0])
            return cls(scope=scope, target_id=parts[1])
        except ValueError:
            return None


@dataclass
class ConnectionInfo:
    """Information about an active WebSocket connection."""
    websocket: WebSocket
    user_id: str
    subscriptions: Set[Subscription] = field(default_factory=set)
    last_ping: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_pong: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_alive: bool = True


class WebSocketMessage(BaseModel):
    """Standard WebSocket message format."""
    event: EventType
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data: Dict[str, Any] = Field(default_factory=dict)
    subscription: Optional[str] = None  # Channel this message came from


class HeartbeatMessage(BaseModel):
    """Heartbeat message for connection health."""
    event: EventType = EventType.HEARTBEAT
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ping_id: str


class ErrorMessage(BaseModel):
    """Error message format."""
    event: EventType = EventType.ERROR
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    error_code: str
    error_message: str
    details: Optional[Dict[str, Any]] = None


class ConnectionManager:
    """
    Manages WebSocket connections with Redis pub/sub support.
    
    Features:
    - Per-user connection tracking
    - Subscription management (user, repo, bounty scopes)
    - Redis pub/sub for distributed deployments
    - Automatic heartbeat/ping-pong
    - Graceful reconnection support
    
    Example:
        manager = ConnectionManager()
        
        # In WebSocket endpoint
        await manager.connect(websocket, user_id="user_123")
        await manager.subscribe(websocket, Subscription(SubscriptionScope.REPO, "repo_456"))
        
        # Broadcast event
        await manager.broadcast_event(
            event_type=EventType.PR_STATUS_CHANGED,
            data={"pr_id": "pr_789", "status": "merged"},
            scope=SubscriptionScope.REPO,
            target_id="repo_456"
        )
    """
    
    # Heartbeat configuration
    HEARTBEAT_INTERVAL = 30  # seconds
    HEARTBEAT_TIMEOUT = 10   # seconds to wait for pong
    
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
                logger.warning(f"Failed to connect to Redis: {e}. Running in single-instance mode.")
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
        logger.info("WebSocket manager shutdown complete")
    
    async def connect(self, websocket: WebSocket, user_id: str) -> ConnectionInfo:
        """
        Accept a new WebSocket connection.
        
        Args:
            websocket: The WebSocket connection
            user_id: The authenticated user's ID
            
        Returns:
            ConnectionInfo for the new connection
        """
        await websocket.accept()
        
        info = ConnectionInfo(websocket=websocket, user_id=user_id)
        
        # Add to connections
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(info)
        
        # Add to lookup maps
        self._ws_to_user[websocket] = user_id
        self._ws_to_info[websocket] = info
        
        logger.info(f"WebSocket connected: user={user_id}, total_connections={len(self._ws_to_user)}")
        
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
            
            # Unsubscribe from Redis channels
            if self._redis:
                for sub in info.subscriptions:
                    try:
                        channel = sub.to_channel()
                        await self._pubsub.unsubscribe(channel)
                    except Exception as e:
                        logger.warning(f"Failed to unsubscribe from {channel}: {e}")
        
        logger.info(f"WebSocket disconnected: user={user_id}, remaining={len(self._ws_to_user)}")
    
    async def subscribe(
        self, 
        websocket: WebSocket, 
        subscription: Subscription
    ) -> bool:
        """
        Subscribe a connection to an event channel.
        
        Args:
            websocket: The WebSocket connection
            subscription: The subscription to add
            
        Returns:
            True if subscription was added, False if connection not found
        """
        info = self._ws_to_info.get(websocket)
        if not info:
            return False
        
        info.subscriptions.add(subscription)
        
        # Subscribe to Redis channel if available
        if self._redis:
            try:
                channel = subscription.to_channel()
                await self._pubsub.subscribe(channel)
                logger.debug(f"Subscribed to Redis channel: {channel}")
            except Exception as e:
                logger.warning(f"Failed to subscribe to Redis: {e}")
        
        return True
    
    async def unsubscribe(
        self, 
        websocket: WebSocket, 
        subscription: Subscription
    ) -> bool:
        """
        Unsubscribe a connection from an event channel.
        
        Args:
            websocket: The WebSocket connection
            subscription: The subscription to remove
            
        Returns:
            True if subscription was removed, False if not found
        """
        info = self._ws_to_info.get(websocket)
        if not info:
            return False
        
        if subscription in info.subscriptions:
            info.subscriptions.remove(subscription)
            
            # Unsubscribe from Redis if no other connections need it
            if self._redis:
                channel = subscription.to_channel()
                other_connections_need = any(
                    subscription in other_info.subscriptions
                    for other_info in self._ws_to_info.values()
                    if other_info != info
                )
                if not other_connections_need:
                    try:
                        await self._pubsub.unsubscribe(channel)
                    except Exception as e:
                        logger.warning(f"Failed to unsubscribe from Redis: {e}")
        
        return True
    
    async def send_personal_message(
        self, 
        websocket: WebSocket, 
        event_type: EventType,
        data: Dict[str, Any]
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
        message = WebSocketMessage(event=event_type, data=data)
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
        exclude: Optional[WebSocket] = None
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
        message = WebSocketMessage(event=event_type, data=data)
        
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
        scope: SubscriptionScope,
        target_id: str,
        exclude: Optional[WebSocket] = None
    ) -> int:
        """
        Broadcast an event to all subscribers of a channel.
        
        Args:
            event_type: Type of event (PR status, comment, etc.)
            data: Event payload
            scope: Subscription scope (user, repo, bounty)
            target_id: Target ID for the scope
            exclude: Optional WebSocket to exclude
            
        Returns:
            Number of connections the message was sent to
        """
        subscription = Subscription(scope=scope, target_id=target_id)
        channel = subscription.to_channel()
        
        message = WebSocketMessage(
            event=event_type, 
            data=data, 
            subscription=channel
        )
        
        # Publish to Redis for distributed delivery
        if self._redis:
            try:
                await self._redis.publish(
                    "websocket_events",
                    json.dumps({
                        "channel": channel,
                        "message": message.model_dump(mode="json")
                    })
                )
            except Exception as e:
                logger.warning(f"Failed to publish to Redis: {e}")
        
        # Send to local subscribers
        sent_count = 0
        for info in self._ws_to_info.values():
            if exclude and info.websocket == exclude:
                continue
            if subscription in info.subscriptions:
                try:
                    await info.websocket.send_json(message.model_dump(mode="json"))
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
                    data = json.loads(message["data"])
                    channel = data.get("channel", "")
                    msg = data.get("message", {})
                    
                    # Parse subscription from channel
                    subscription = Subscription.from_string(channel)
                    if not subscription:
                        continue
                    
                    # Forward to local subscribers
                    for info in self._ws_to_info.values():
                        if subscription in info.subscriptions:
                            try:
                                await info.websocket.send_json(msg)
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
                            await info.websocket.close(code=1001, reason="Heartbeat timeout")
                        except Exception:
                            pass
                        continue
                    
                    # Send ping
                    if info.is_alive:
                        ping_id = f"ping_{now.timestamp()}"
                        try:
                            await info.websocket.send_json(
                                HeartbeatMessage(ping_id=ping_id).model_dump(mode="json")
                            )
                            info.last_ping = now
                        except Exception:
                            info.is_alive = False
                
                # Clean up dead connections
                dead_sockets = [
                    ws for ws, info in self._ws_to_info.items() 
                    if not info.is_alive
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
            )
        }


# Global connection manager instance
manager = ConnectionManager()