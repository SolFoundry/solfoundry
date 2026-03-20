"""WebSocket manager with auth, heartbeat, rate limiting, and Redis-first pub/sub."""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Dict, Optional, Protocol, Set

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL = int(os.getenv("WS_HEARTBEAT_INTERVAL", "30"))
RATE_LIMIT_WINDOW = int(os.getenv("WS_RATE_LIMIT_WINDOW", "60"))
RATE_LIMIT_MAX = int(os.getenv("WS_RATE_LIMIT_MAX", "100"))
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


class PubSubAdapter(Protocol):
    async def publish(self, channel: str, message: str) -> None: ...
    async def subscribe(self, channel: str) -> None: ...
    async def unsubscribe(self, channel: str) -> None: ...
    async def listen(self) -> None: ...
    async def close(self) -> None: ...


class RedisPubSubAdapter:
    """Redis-backed pub/sub for horizontal scaling (default)."""

    def __init__(self, redis_url: str, manager: "WebSocketManager") -> None:
        self._redis_url = redis_url
        self._manager = manager
        self._redis = None
        self._pubsub = None
        self._channels: Set[str] = set()
        self._listener_task: Optional[asyncio.Task] = None

    async def _connect(self):
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
        await self._connect()
        assert self._redis is not None
        await self._redis.publish(channel, message)

    async def subscribe(self, channel: str) -> None:
        await self._connect()
        assert self._pubsub is not None
        await self._pubsub.subscribe(channel)
        self._channels.add(channel)
        if self._listener_task is None or self._listener_task.done():
            self._listener_task = asyncio.create_task(self.listen())

    async def unsubscribe(self, channel: str) -> None:
        if self._pubsub and channel in self._channels:
            await self._pubsub.unsubscribe(channel)
            self._channels.discard(channel)

    async def listen(self) -> None:
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
        self._manager = manager

    async def publish(self, channel: str, message: str) -> None:
        await self._manager.dispatch_local(channel, message)

    async def subscribe(self, channel: str) -> None:
        pass

    async def unsubscribe(self, channel: str) -> None:
        pass

    async def listen(self) -> None:
        pass

    async def close(self) -> None:
        pass


@dataclass
class _RateBucket:
    timestamps: list = field(default_factory=list)


@dataclass
class _Connection:
    ws: WebSocket
    user_id: str
    channels: Set[str] = field(default_factory=set)


class WebSocketManager:
    """Coordinates WS connections with auth, heartbeat, rate-limit, pub/sub."""

    def __init__(self, adapter: Optional[PubSubAdapter] = None) -> None:
        self._connections: Dict[str, _Connection] = {}
        self._subscriptions: Dict[str, Set[str]] = {}
        self._rate_buckets: Dict[str, _RateBucket] = {}
        self._adapter = adapter

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
            logger.warning("Redis unavailable at %s, using in-memory pub/sub", REDIS_URL)
            self._adapter = InMemoryPubSubAdapter(self)

    async def shutdown(self) -> None:
        for conn in list(self._connections.values()):
            try:
                await conn.ws.close(code=1001)
            except Exception:
                pass
        self._connections.clear()
        self._subscriptions.clear()
        if self._adapter:
            await self._adapter.close()

    # -- auth --

    @staticmethod
    async def authenticate(token: Optional[str]) -> Optional[str]:
        """Validate bearer token (UUID), return user_id or None."""
        if not token:
            return None
        import uuid as _uuid
        try:
            _uuid.UUID(token)
            return token
        except (ValueError, TypeError):
            return None

    # -- rate limiting --

    def _check_rate_limit(self, user_id: str) -> bool:
        now = time.monotonic()
        bucket = self._rate_buckets.setdefault(user_id, _RateBucket())
        bucket.timestamps = [t for t in bucket.timestamps if now - t < RATE_LIMIT_WINDOW]
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
        """Accept WS after auth. Returns connection_id or None."""
        user_id = await self.authenticate(token)
        if user_id is None:
            await ws.close(code=4001)
            return None
        await ws.accept()
        import uuid as _uuid
        connection_id = str(_uuid.uuid4())
        self._connections[connection_id] = _Connection(ws=ws, user_id=user_id)
        logger.info("WS connected: user=%s cid=%s", user_id, connection_id)
        return connection_id

    async def disconnect(self, connection_id: str) -> None:
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

    async def subscribe(self, connection_id: str, channel: str, token: Optional[str] = None) -> bool:
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

    async def broadcast(self, channel: str, data: dict, *, token: Optional[str] = None,
                        sender_user_id: Optional[str] = None) -> int:
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
            conn = self._connections.get(cid)
            if conn is None:
                return False
            try:
                await conn.ws.send_text(raw_message)
                return True
            except Exception:
                await self.disconnect(cid)
                return False

        results = await asyncio.gather(*(_send(cid) for cid in list(subs)), return_exceptions=True)
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
            n = await self.broadcast(channel, data, token=token, sender_user_id=conn.user_id)
            return {"type": "broadcasted", "channel": channel, "recipients": n}

        return {"type": "error", "detail": f"unknown message type: {msg_type}"}


manager = WebSocketManager()
