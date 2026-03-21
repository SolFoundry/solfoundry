import json
import asyncio
from typing import Dict, Any, Optional, List, Set
from datetime import datetime
from enum import Enum
import redis.asyncio as redis
import logging

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """WebSocket event types for real-time updates."""
    BOUNTY_UPDATE = "bounty_update"
    PR_SUBMITTED = "pr_submitted"
    REVIEW_PROGRESS = "review_progress"
    PAYOUT_SENT = "payout_sent"
    CLAIM_UPDATE = "claim_update"
    CONNECTION_ACK = "connection_ack"
    HEARTBEAT = "heartbeat"


class EventPriority(str, Enum):
    """Event priority levels for routing and delivery."""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class WebSocketEvent:
    """WebSocket event structure with metadata and payload."""

    def __init__(
        self,
        event_type: EventType,
        data: Dict[str, Any],
        bounty_id: Optional[str] = None,
        user_id: Optional[str] = None,
        priority: EventPriority = EventPriority.NORMAL,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.event_type = event_type
        self.data = data
        self.bounty_id = bounty_id
        self.user_id = user_id
        self.priority = priority
        self.metadata = metadata or {}
        self.timestamp = datetime.utcnow().isoformat()
        self.event_id = self._generate_event_id()

    def _generate_event_id(self) -> str:
        """Generate unique event ID for tracking."""
        import uuid
        return f"{self.event_type}_{uuid.uuid4().hex[:8]}"

    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary for JSON serialization."""
        return {
            "event_id": self.event_id,
            "type": self.event_type,
            "data": self.data,
            "bounty_id": self.bounty_id,
            "user_id": self.user_id,
            "priority": self.priority,
            "timestamp": self.timestamp,
            "metadata": self.metadata
        }

    def to_json(self) -> str:
        """Serialize event to JSON string."""
        return json.dumps(self.to_dict(), default=str)

    @classmethod
    def from_json(cls, json_str: str) -> "WebSocketEvent":
        """Deserialize event from JSON string."""
        data = json.loads(json_str)
        event = cls(
            event_type=EventType(data["type"]),
            data=data["data"],
            bounty_id=data.get("bounty_id"),
            user_id=data.get("user_id"),
            priority=EventPriority(data.get("priority", EventPriority.NORMAL)),
            metadata=data.get("metadata", {})
        )
        event.event_id = data.get("event_id", event.event_id)
        event.timestamp = data.get("timestamp", event.timestamp)
        return event


class RedisEventPublisher:
    """Redis publisher for broadcasting WebSocket events."""

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self._channels = {
            "global": "websocket:events:global",
            "bounty": "websocket:events:bounty:",
            "user": "websocket:events:user:"
        }

    async def connect(self):
        """Connect to Redis server."""
        try:
            self.redis_client = redis.from_url(self.redis_url)
            await self.redis_client.ping()
            logger.info("Connected to Redis for event publishing")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    async def disconnect(self):
        """Disconnect from Redis server."""
        if self.redis_client:
            await self.redis_client.aclose()
            logger.info("Disconnected from Redis")

    async def publish_event(self, event: WebSocketEvent, channels: Optional[List[str]] = None):
        """Publish event to specified channels or auto-route based on event data."""
        if not self.redis_client:
            raise RuntimeError("Redis client not connected")

        if channels is None:
            channels = self._get_event_channels(event)

        event_json = event.to_json()

        for channel in channels:
            try:
                await self.redis_client.publish(channel, event_json)
                logger.debug(f"Published event {event.event_id} to channel {channel}")
            except Exception as e:
                logger.error(f"Failed to publish event to channel {channel}: {e}")

    def _get_event_channels(self, event: WebSocketEvent) -> List[str]:
        """Determine target channels based on event properties."""
        channels = [self._channels["global"]]

        if event.bounty_id:
            channels.append(f"{self._channels['bounty']}{event.bounty_id}")

        if event.user_id:
            channels.append(f"{self._channels['user']}{event.user_id}")

        return channels

    async def publish_bounty_update(self, bounty_id: str, status: str, data: Dict[str, Any]):
        """Publish bounty status update event."""
        event = WebSocketEvent(
            event_type=EventType.BOUNTY_UPDATE,
            data={
                "status": status,
                "bounty_id": bounty_id,
                **data
            },
            bounty_id=bounty_id,
            priority=EventPriority.HIGH
        )
        await self.publish_event(event)

    async def publish_pr_submission(self, bounty_id: str, pr_data: Dict[str, Any], user_id: str):
        """Publish PR submission event."""
        event = WebSocketEvent(
            event_type=EventType.PR_SUBMITTED,
            data={
                "bounty_id": bounty_id,
                "pr_url": pr_data.get("url"),
                "pr_title": pr_data.get("title"),
                "author": pr_data.get("author"),
                **pr_data
            },
            bounty_id=bounty_id,
            user_id=user_id,
            priority=EventPriority.HIGH
        )
        await self.publish_event(event)

    async def publish_review_progress(self, bounty_id: str, review_data: Dict[str, Any]):
        """Publish review progress event."""
        event = WebSocketEvent(
            event_type=EventType.REVIEW_PROGRESS,
            data={
                "bounty_id": bounty_id,
                **review_data
            },
            bounty_id=bounty_id,
            priority=EventPriority.NORMAL
        )
        await self.publish_event(event)

    async def publish_payout_sent(self, bounty_id: str, payout_data: Dict[str, Any], user_id: str):
        """Publish payout sent event."""
        event = WebSocketEvent(
            event_type=EventType.PAYOUT_SENT,
            data={
                "bounty_id": bounty_id,
                "amount": payout_data.get("amount"),
                "token": payout_data.get("token"),
                "tx_hash": payout_data.get("tx_hash"),
                **payout_data
            },
            bounty_id=bounty_id,
            user_id=user_id,
            priority=EventPriority.CRITICAL
        )
        await self.publish_event(event)

    async def publish_claim_update(self, bounty_id: str, claim_data: Dict[str, Any]):
        """Publish claim status update event."""
        event = WebSocketEvent(
            event_type=EventType.CLAIM_UPDATE,
            data={
                "bounty_id": bounty_id,
                **claim_data
            },
            bounty_id=bounty_id,
            priority=EventPriority.HIGH
        )
        await self.publish_event(event)


class RedisEventSubscriber:
    """Redis subscriber for receiving WebSocket events."""

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub: Optional[redis.client.PubSub] = None
        self._subscribed_channels: Set[str] = set()
        self._event_handlers: Dict[str, callable] = {}
        self._running = False

    async def connect(self):
        """Connect to Redis server and initialize pubsub."""
        try:
            self.redis_client = redis.from_url(self.redis_url)
            await self.redis_client.ping()
            self.pubsub = self.redis_client.pubsub()
            logger.info("Connected to Redis for event subscription")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    async def disconnect(self):
        """Disconnect from Redis server."""
        self._running = False
        if self.pubsub:
            await self.pubsub.aclose()
        if self.redis_client:
            await self.redis_client.aclose()
        logger.info("Disconnected from Redis subscriber")

    async def subscribe_to_channel(self, channel: str, handler: callable):
        """Subscribe to a specific channel with event handler."""
        if not self.pubsub:
            raise RuntimeError("Redis pubsub not initialized")

        await self.pubsub.subscribe(channel)
        self._subscribed_channels.add(channel)
        self._event_handlers[channel] = handler
        logger.info(f"Subscribed to channel: {channel}")

    async def subscribe_to_bounty(self, bounty_id: str, handler: callable):
        """Subscribe to bounty-specific events."""
        channel = f"websocket:events:bounty:{bounty_id}"
        await self.subscribe_to_channel(channel, handler)

    async def subscribe_to_user(self, user_id: str, handler: callable):
        """Subscribe to user-specific events."""
        channel = f"websocket:events:user:{user_id}"
        await self.subscribe_to_channel(channel, handler)

    async def subscribe_to_global(self, handler: callable):
        """Subscribe to global events."""
        channel = "websocket:events:global"
        await self.subscribe_to_channel(channel, handler)

    async def start_listening(self):
        """Start listening for events on subscribed channels."""
        if not self.pubsub:
            raise RuntimeError("Redis pubsub not initialized")

        self._running = True
        logger.info("Started listening for Redis events")

        try:
            async for message in self.pubsub.listen():
                if not self._running:
                    break

                if message["type"] == "message":
                    await self._handle_message(message)
        except Exception as e:
            logger.error(f"Error in event listener: {e}")
        finally:
            self._running = False

    async def _handle_message(self, message):
        """Handle received Redis message."""
        try:
            channel = message["channel"].decode("utf-8")
            data = message["data"].decode("utf-8")

            event = WebSocketEvent.from_json(data)
            handler = self._event_handlers.get(channel)

            if handler:
                await handler(event)
            else:
                logger.warning(f"No handler found for channel: {channel}")

        except Exception as e:
            logger.error(f"Error handling message: {e}")


class EventFormatter:
    """Utility class for formatting WebSocket events for different clients."""

    @staticmethod
    def format_for_client(event: WebSocketEvent, client_permissions: Optional[Dict] = None) -> Dict[str, Any]:
        """Format event data for client consumption with permission filtering."""
        formatted = event.to_dict()

        if client_permissions:
            formatted = EventFormatter._apply_permissions(formatted, client_permissions)

        return formatted

    @staticmethod
    def _apply_permissions(event_data: Dict[str, Any], permissions: Dict) -> Dict[str, Any]:
        """Apply permission filtering to event data."""
        if not permissions.get("view_sensitive_data", True):
            sensitive_fields = ["tx_hash", "private_data", "internal_notes"]
            for field in sensitive_fields:
                if field in event_data.get("data", {}):
                    event_data["data"].pop(field)

        return event_data

    @staticmethod
    def create_connection_ack(connection_id: str, channels: List[str]) -> WebSocketEvent:
        """Create connection acknowledgment event."""
        return WebSocketEvent(
            event_type=EventType.CONNECTION_ACK,
            data={
                "connection_id": connection_id,
                "subscribed_channels": channels,
                "server_time": datetime.utcnow().isoformat()
            },
            priority=EventPriority.HIGH
        )

    @staticmethod
    def create_heartbeat() -> WebSocketEvent:
        """Create heartbeat event."""
        return WebSocketEvent(
            event_type=EventType.HEARTBEAT,
            data={
                "server_time": datetime.utcnow().isoformat()
            },
            priority=EventPriority.LOW
        )


class EventBroadcaster:
    """High-level event broadcasting service combining publisher and subscriber."""

    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.publisher = RedisEventPublisher(redis_url)
        self.subscriber = RedisEventSubscriber(redis_url)
        self._active_connections: Dict[str, Any] = {}

    async def start(self):
        """Start the event broadcaster."""
        await self.publisher.connect()
        await self.subscriber.connect()
        logger.info("Event broadcaster started")

    async def stop(self):
        """Stop the event broadcaster."""
        await self.publisher.disconnect()
        await self.subscriber.disconnect()
        logger.info("Event broadcaster stopped")

    async def broadcast_to_bounty(self, bounty_id: str, event_type: EventType, data: Dict[str, Any]):
        """Broadcast event to all subscribers of a specific bounty."""
        event = WebSocketEvent(
            event_type=event_type,
            data=data,
            bounty_id=bounty_id
        )
        await self.publisher.publish_event(event)

    async def broadcast_to_user(self, user_id: str, event_type: EventType, data: Dict[str, Any]):
        """Broadcast event to a specific user."""
        event = WebSocketEvent(
            event_type=event_type,
            data=data,
            user_id=user_id
        )
        await self.publisher.publish_event(event)

    async def broadcast_global(self, event_type: EventType, data: Dict[str, Any]):
        """Broadcast event to all connected clients."""
        event = WebSocketEvent(
            event_type=event_type,
            data=data
        )
        await self.publisher.publish_event(event)

    def register_connection(self, connection_id: str, connection_data: Dict[str, Any]):
        """Register a new WebSocket connection."""
        self._active_connections[connection_id] = connection_data
        logger.info(f"Registered connection: {connection_id}")

    def unregister_connection(self, connection_id: str):
        """Unregister a WebSocket connection."""
        if connection_id in self._active_connections:
            del self._active_connections[connection_id]
            logger.info(f"Unregistered connection: {connection_id}")

    def get_active_connections(self) -> Dict[str, Any]:
        """Get all active connections."""
        return self._active_connections.copy()
