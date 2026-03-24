"""WebSocket manager with JWT auth, heartbeat, rate limiting, and Redis-first pub/sub.

Adds JWT auth (UUID fallback), max-connection limits, typed event
emission, and in-memory event buffer for the polling fallback endpoint.
PostgreSQL migration path: websocket_connections table (connection_id PK,
user_id FK, connected_at TIMESTAMPTZ, channels TEXT[]).
"""

import asyncio
import collections
import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Deque, Dict, List, Optional, Protocol, Set

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL = int(os.getenv("WS_HEARTBEAT_INTERVAL", "30"))
RATE_LIMIT_WINDOW = int(os.getenv("WS_RATE_LIMIT_WINDOW", "60"))
RATE_LIMIT_MAX = int(os.getenv("WS_RATE_LIMIT_MAX", "100"))
MAX_CONNECTIONS = int(os.getenv("WS_MAX_CONNECTIONS", "1000"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
EVENT_BUFFER_SIZE = int(os.getenv("WS_EVENT_BUFFER_SIZE", "200"))


class PubSubAdapter(Protocol):
    """Protocol defining the pub/sub adapter interface for WebSocket fan-out."""

    async def publish(self, channel: str, message: str) -> None:
        """Publish a message to the given channel."""
        ...

    async def subscribe(self, channel: str) -> None:
        """Subscribe to messages on the given channel."""
        ...

    async def unsubscribe(self, channel: str) -> None:
        """Unsubscribe from the given channel."""
        ...

    async def listen(self) -> None:
        """Listen for incoming messages and dispatch them."""
        ...

    async def close(self) -> None:
        """Close the pub/sub connection and release resources."""
        ...


class RedisPubSubAdapter:
    """Redis-backed pub/sub for horizontal scaling (default)."""

    def __init__(self, redis_url: str, manager: "WebSocketManager") -> None:
        """Initialize the instance."""
        self._redis_url = redis_url
        self._manager = manager
        self._redis = None
        self._pubsub = None
        self._channels: Set[str] = set()
        self._listener_task: Optional[asyncio.Task] = None

    async def _connect(self):
        """Establish connection to the Redis server."""
        if self._redis is not None:
            return
        try:
            import redis.asyncio as aioredis
        except ImportError:
            raise RuntimeError(
                "redis package required for default pub/sub. pip install redis"
            )
        self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
        self._pubsub = self._redis.pubsub()

    async def publish(self, channel: str, message: str) -> None:
        """Publish a message to a channel."""
        await self._connect()
        assert self._redis is not None
        await self._redis.publish(channel, message)

    async def subscribe(self, channel: str) -> None:
        """Subscribe to a channel for messages."""
        await self._connect()
        assert self._pubsub is not None
        await self._pubsub.subscribe(channel)
        self._channels.add(channel)
        if self._listener_task is None or self._listener_task.done():
            self._listener_task = asyncio.create_task(self.listen())

    async def unsubscribe(self, channel: str) -> None:
        """Unsubscribe a connection from a channel."""
        if self._pubsub and channel in self._channels:
            await self._pubsub.unsubscribe(channel)
            self._channels.discard(channel)

    async def listen(self) -> None:
        """Listen for messages on subscribed channels."""
        assert self._pubsub is not None
        try:
            async for raw in self._pubsub.listen():
                if raw and raw.get("type") == "message":
                    await self._manager.dispatch_local(raw["channel"], raw["data"])
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Redis listener error")

    async def close(self) -> None:
        """Close the connection and release resources."""
        if self._listener_task:
            self._listener_task.cancel()
        if self._pubsub:
            await self._pubsub.unsubscribe()
            await self._pubsub.close()
        if self._redis:
            await self._redis.close()


class InMemoryPubSubAdapter:
    """In-memory fan-out fallback for single-process dev environments."""

    def __init__(self, manager: "WebSocketManager") -> None:
        """Initialize the instance."""
        self._manager = manager

    async def publish(self, channel: str, message: str) -> None:
        """Publish a message to a channel."""
        await self._manager.dispatch_local(channel, message)

    async def subscribe(self, channel: str) -> None:
        """Subscribe to a channel for messages."""
        pass

    async def unsubscribe(self, channel: str) -> None:
        """Unsubscribe a connection from a channel."""
        pass

    async def listen(self) -> None:
        """Listen for messages on subscribed channels."""
        pass

    async def close(self) -> None:
        """Close the connection and release resources."""
        pass


@dataclass
class _RateBucket:
    """Token bucket for per-user rate limiting."""

    timestamps: list = field(default_factory=list)


@dataclass
class _Connection:
    """Authenticated WebSocket connection state."""

    ws: WebSocket
    user_id: str
    channels: Set[str] = field(default_factory=set)


class WebSocketManager:
    """Coordinates WS connections with auth, heartbeat, rate-limit, pub/sub."""

    def __init__(self, adapter: Optional[PubSubAdapter] = None) -> None:
        """Initialize the instance."""
        self._connections: Dict[str, _Connection] = {}
        self._subscriptions: Dict[str, Set[str]] = {}
        self._rate_buckets: Dict[str, _RateBucket] = {}
        self._adapter = adapter
        self._event_buffer: Dict[str, Deque[Dict[str, Any]]] = {}

    # -- lifecycle --

    async def init(self) -> None:
        """Try Redis first; fall back to in-memory if unreachable."""
        if self._adapter is not None:
            return
        try:
            adapter = RedisPubSubAdapter(REDIS_URL, self)
            await adapter._connect()
            self._adapter = adapter
            logger.info("WebSocket pub/sub: Redis (%s)", REDIS_URL)
        except Exception:
            logger.warning(
                "Redis unavailable at %s, using in-memory pub/sub", REDIS_URL
            )
            self._adapter = InMemoryPubSubAdapter(self)

    async def shutdown(self) -> None:
        """Gracefully close all connections and resources."""
        for conn in list(self._connections.values()):
            try:
                await conn.ws.close(code=1001)
            except Exception:
                pass
        self._connections.clear()
        self._subscriptions.clear()
        self._event_buffer.clear()
        if self._adapter:
            await self._adapter.close()

    # -- auth --

    @staticmethod
    async def authenticate(token: Optional[str]) -> Optional[str]:
        """Validate bearer token (JWT or UUID), return user_id or None.

        Tries JWT decoding first via auth_service, then falls back to
        raw UUID acceptance for backward compatibility.
        """
        if not token:
            return None
        # Try JWT access token first
        try:
            from app.services.auth_service import decode_token

            return decode_token(token, "access")
        except Exception:
            pass
        # Fallback: accept raw UUID tokens
        import uuid as _uuid

        try:
            _uuid.UUID(token)
            return token
        except (ValueError, TypeError):
            return None

    # -- rate limiting --

    def _check_rate_limit(self, user_id: str) -> bool:
        """Check if the user exceeded the rate limit."""
        now = time.monotonic()
        bucket = self._rate_buckets.setdefault(user_id, _RateBucket())
        bucket.timestamps = [
            t for t in bucket.timestamps if now - t < RATE_LIMIT_WINDOW
        ]
        if len(bucket.timestamps) >= RATE_LIMIT_MAX:
            return False
        bucket.timestamps.append(now)
        return True

    # -- heartbeat --

    async def heartbeat(self, connection_id: str) -> None:
        """Server-side ping every HEARTBEAT_INTERVAL seconds."""
        try:
            while connection_id in self._connections:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                conn = self._connections.get(connection_id)
                if conn is None or conn.ws.client_state != WebSocketState.CONNECTED:
                    break
                try:
                    await conn.ws.send_json({"type": "ping"})
                except Exception:
                    break
        except asyncio.CancelledError:
            pass
        finally:
            await self.disconnect(connection_id)

    # -- connect / disconnect --

    async def connect(self, ws: WebSocket, token: Optional[str]) -> Optional[str]:
        """Accept WS after auth. Returns connection_id or None.

        Enforces MAX_CONNECTIONS limit (close code 4002 when full).
        """
        user_id = await self.authenticate(token)
        if user_id is None:
            await ws.close(code=4001)
            return None
        if len(self._connections) >= MAX_CONNECTIONS:
            await ws.close(code=4002)
            return None
        await ws.accept()
        import uuid as _uuid

        connection_id = str(_uuid.uuid4())
        self._connections[connection_id] = _Connection(ws=ws, user_id=user_id)
        logger.info("WS connected: user=%s cid=%s", user_id, connection_id)
        return connection_id

    async def disconnect(self, connection_id: str) -> None:
        """Remove a connection and clean up subscriptions."""
        conn = self._connections.pop(connection_id, None)
        if conn is None:
            return
        for ch in list(conn.channels):
            subs = self._subscriptions.get(ch)
            if subs:
                subs.discard(connection_id)
                if not subs:
                    del self._subscriptions[ch]
                    if self._adapter:
                        await self._adapter.unsubscribe(ch)
        logger.info("WS disconnected: cid=%s", connection_id)

    # -- subscribe / unsubscribe --

    async def subscribe(
        self, connection_id: str, channel: str, token: Optional[str] = None
    ) -> bool:
        """Subscribe to channel. Re-authenticates token to enforce trust boundary."""
        conn = self._connections.get(connection_id)
        if conn is None:
            return False
        if token is not None:
            uid = await self.authenticate(token)
            if uid is None or uid != conn.user_id:
                return False
        conn.channels.add(channel)
        self._subscriptions.setdefault(channel, set()).add(connection_id)
        if self._adapter:
            await self._adapter.subscribe(channel)
        return True

    async def unsubscribe(self, connection_id: str, channel: str) -> None:
        """Unsubscribe a connection from a channel."""
        conn = self._connections.get(connection_id)
        if conn is None:
            return
        conn.channels.discard(channel)
        subs = self._subscriptions.get(channel)
        if subs:
            subs.discard(connection_id)
            if not subs:
                del self._subscriptions[channel]
                if self._adapter:
                    await self._adapter.unsubscribe(channel)

    # -- broadcast --

    async def broadcast(
        self,
        channel: str,
        data: dict,
        *,
        token: Optional[str] = None,
        sender_user_id: Optional[str] = None,
    ) -> int:
        """Publish data to channel subscribers. Auth enforced if token given."""
        if token is not None:
            uid = await self.authenticate(token)
            if uid is None:
                return 0
        elif sender_user_id is None:
            return 0
        message = json.dumps({"channel": channel, "data": data})
        if self._adapter:
            await self._adapter.publish(channel, message)
            return len(self._subscriptions.get(channel, set()))
        return await self.dispatch_local(channel, message)

    async def dispatch_local(self, channel: str, raw_message: str) -> int:
        """Deliver to local subscribers using asyncio.gather (non-blocking)."""
        subs = self._subscriptions.get(channel, set())
        if not subs:
            return 0

        async def _send(cid: str) -> bool:
            """Send a message to a single connection."""
            conn = self._connections.get(cid)
            if conn is None:
                return False
            try:
                await conn.ws.send_text(raw_message)
                return True
            except Exception:
                await self.disconnect(cid)
                return False

        results = await asyncio.gather(
            *(_send(cid) for cid in list(subs)), return_exceptions=True
        )
        return sum(1 for r in results if r is True)

    # -- message handler --

    async def handle_message(self, connection_id: str, raw: str) -> Optional[dict]:
        """Parse and dispatch an inbound client message."""
        conn = self._connections.get(connection_id)
        if conn is None:
            return {"type": "error", "detail": "unknown connection"}
        if not self._check_rate_limit(conn.user_id):
            return {"type": "error", "detail": "rate limit exceeded"}
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            return {"type": "error", "detail": "invalid JSON"}

        msg_type = msg.get("type")
        token = msg.get("token")

        if msg_type == "pong":
            return None

        if msg_type == "subscribe":
            channel = msg.get("channel")
            if not channel or not isinstance(channel, str):
                return {"type": "error", "detail": "channel required"}
            ok = await self.subscribe(connection_id, channel, token=token)
            if not ok:
                return {"type": "error", "detail": "subscribe failed (auth)"}
            return {"type": "subscribed", "channel": channel}

        if msg_type == "unsubscribe":
            channel = msg.get("channel")
            if channel:
                await self.unsubscribe(connection_id, channel)
            return {"type": "unsubscribed", "channel": channel}

        if msg_type == "broadcast":
            channel = msg.get("channel")
            data = msg.get("data", {})
            if not channel:
                return {"type": "error", "detail": "channel required"}
            n = await self.broadcast(
                channel, data, token=token, sender_user_id=conn.user_id
            )
            return {"type": "broadcasted", "channel": channel, "recipients": n}

        return {"type": "error", "detail": f"unknown message type: {msg_type}"}

    # -- typed event emission --

    async def emit_event(
        self,
        event_type: str,
        channel: str,
        payload: Dict[str, Any],
    ) -> int:
        """Emit a validated typed event to a channel and buffer it.

        Args:
            event_type: One of the EventType enum values.
            channel: Target pub/sub channel.
            payload: Event-specific data dict.

        Returns:
            Number of local subscribers that received the event.
        """
        from app.models.event import EventType as ET, create_event

        envelope = create_event(ET(event_type), channel, payload)
        event_dict = envelope.model_dump(mode="json")

        buffer = self._event_buffer.setdefault(
            channel, collections.deque(maxlen=EVENT_BUFFER_SIZE)
        )
        buffer.append(event_dict)

        return await self.broadcast(channel, event_dict, sender_user_id="system")

    def get_buffered_events(
        self,
        channel: str,
        since: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Retrieve buffered events for polling fallback.

        Args:
            channel: The channel to read events from.
            since: Optional UTC cutoff timestamp.
            limit: Maximum number of events to return.

        Returns:
            List of event dicts, oldest first.
        """
        buffer = self._event_buffer.get(channel, collections.deque())
        events = list(buffer)
        if since is not None:
            since_str = since.isoformat()
            events = [e for e in events if e.get("timestamp", "") > since_str]
        return events[-limit:]

    def get_connection_count(self) -> int:
        """Return total number of active WebSocket connections."""
        return len(self._connections)

    def get_channel_subscriber_count(self, channel: str) -> int:
        """Return number of subscribers for a specific channel."""
        return len(self._subscriptions.get(channel, set()))

    def get_connection_info(self) -> Dict[str, Any]:
        """Return summary statistics about current WebSocket state."""
        channel_counts = {
            channel: len(subs) for channel, subs in self._subscriptions.items()
        }
        return {
            "active_connections": len(self._connections),
            "max_connections": MAX_CONNECTIONS,
            "total_channels": len(self._subscriptions),
            "channels": channel_counts,
        }


manager = WebSocketManager()
