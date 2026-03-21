# SPDX-License-Identifier: MIT
import asyncio
import json
import logging
import time
from typing import Dict, Set, Optional, Any
from datetime import datetime, timedelta

import redis.asyncio as redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import jwt
from pydantic import BaseModel, ValidationError

from .config import settings
from .auth import get_current_user_from_token

logger = logging.getLogger(__name__)

class WebSocketMessage(BaseModel):
    type: str
    data: Dict[str, Any]
    timestamp: Optional[datetime] = None
    channel: Optional[str] = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, str] = {}  # user_id -> connection_id
        self.connection_channels: Dict[str, Set[str]] = {}  # connection_id -> channels
        self.channel_connections: Dict[str, Set[str]] = {}  # channel -> connection_ids
        self.last_ping: Dict[str, float] = {}
        self.max_connections = settings.WEBSOCKET_MAX_CONNECTIONS or 1000

    async def connect(self, websocket: WebSocket, connection_id: str, user_id: str):
        if len(self.active_connections) >= self.max_connections:
            await websocket.close(code=1008, reason="Max connections reached")
            return False

        await websocket.accept()
        self.active_connections[connection_id] = websocket
        self.user_connections[user_id] = connection_id
        self.connection_channels[connection_id] = set()
        self.last_ping[connection_id] = time.time()

        logger.info(f"WebSocket connected: {connection_id} (user: {user_id})")
        return True

    async def disconnect(self, connection_id: str):
        if connection_id in self.active_connections:
            # Remove from all channels
            if connection_id in self.connection_channels:
                for channel in self.connection_channels[connection_id]:
                    if channel in self.channel_connections:
                        self.channel_connections[channel].discard(connection_id)
                        if not self.channel_connections[channel]:
                            del self.channel_connections[channel]
                del self.connection_channels[connection_id]

            # Remove user mapping
            user_id = None
            for uid, cid in self.user_connections.items():
                if cid == connection_id:
                    user_id = uid
                    break
            if user_id:
                del self.user_connections[user_id]

            del self.active_connections[connection_id]
            self.last_ping.pop(connection_id, None)

            logger.info(f"WebSocket disconnected: {connection_id}")

    async def subscribe_to_channel(self, connection_id: str, channel: str):
        if connection_id not in self.active_connections:
            return False

        self.connection_channels[connection_id].add(channel)
        if channel not in self.channel_connections:
            self.channel_connections[channel] = set()
        self.channel_connections[channel].add(connection_id)

        logger.debug(f"Connection {connection_id} subscribed to {channel}")
        return True

    async def unsubscribe_from_channel(self, connection_id: str, channel: str):
        if connection_id in self.connection_channels:
            self.connection_channels[connection_id].discard(channel)

        if channel in self.channel_connections:
            self.channel_connections[channel].discard(connection_id)
            if not self.channel_connections[channel]:
                del self.channel_connections[channel]

    async def send_personal_message(self, connection_id: str, message: dict):
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            try:
                await websocket.send_json(message)
                return True
            except Exception as e:
                logger.error(f"Failed to send message to {connection_id}: {e}")
                await self.disconnect(connection_id)
        return False

    async def broadcast_to_channel(self, channel: str, message: dict):
        if channel not in self.channel_connections:
            return 0

        sent_count = 0
        dead_connections = []

        for connection_id in self.channel_connections[channel].copy():
            if connection_id in self.active_connections:
                websocket = self.active_connections[connection_id]
                try:
                    await websocket.send_json(message)
                    sent_count += 1
                except Exception as e:
                    logger.error(f"Failed to broadcast to {connection_id}: {e}")
                    dead_connections.append(connection_id)

        # Clean up dead connections
        for connection_id in dead_connections:
            await self.disconnect(connection_id)

        return sent_count

    async def ping_connections(self):
        """Send heartbeat pings to all connections"""
        current_time = time.time()
        dead_connections = []

        for connection_id, websocket in self.active_connections.items():
            try:
                # Check if connection is stale
                if current_time - self.last_ping[connection_id] > 60:  # 60 seconds timeout
                    dead_connections.append(connection_id)
                    continue

                await websocket.send_json({
                    "type": "ping",
                    "timestamp": datetime.utcnow().isoformat()
                })
                self.last_ping[connection_id] = current_time

            except Exception:
                dead_connections.append(connection_id)

        for connection_id in dead_connections:
            await self.disconnect(connection_id)

class WebSocketServer:
    def __init__(self):
        self.manager = ConnectionManager()
        self.redis_client: Optional[redis.Redis] = None
        self.pubsub_task: Optional[asyncio.Task] = None

    async def initialize_redis(self):
        """Initialize Redis connection for pub/sub"""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30
            )
            await self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.redis_client = None

    async def start_pubsub(self):
        """Start Redis pub/sub listener"""
        if not self.redis_client:
            logger.warning("Redis not available, pub/sub disabled")
            return

        try:
            pubsub = self.redis_client.pubsub()
            await pubsub.subscribe(
                "bounty_update",
                "pr_submitted",
                "review_progress",
                "payout_sent",
                "claim_update"
            )

            self.pubsub_task = asyncio.create_task(self._handle_pubsub_messages(pubsub))
            logger.info("Redis pub/sub listener started")

        except Exception as e:
            logger.error(f"Failed to start pub/sub: {e}")

    async def _handle_pubsub_messages(self, pubsub):
        """Handle incoming Redis pub/sub messages"""
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        channel = message["channel"]

                        ws_message = {
                            "type": channel,
                            "data": data,
                            "timestamp": datetime.utcnow().isoformat()
                        }

                        # Broadcast to appropriate channels
                        if channel == "bounty_update" and "bounty_id" in data:
                            await self.manager.broadcast_to_channel(
                                f"bounty_{data['bounty_id']}", ws_message
                            )
                        elif channel == "pr_submitted" and "bounty_id" in data:
                            await self.manager.broadcast_to_channel(
                                f"bounty_{data['bounty_id']}", ws_message
                            )
                        elif channel in ["payout_sent", "claim_update"] and "user_id" in data:
                            # Send to specific user
                            user_id = str(data["user_id"])
                            if user_id in self.manager.user_connections:
                                connection_id = self.manager.user_connections[user_id]
                                await self.manager.send_personal_message(connection_id, ws_message)

                        # Also broadcast to global channel
                        await self.manager.broadcast_to_channel("global", ws_message)

                    except (json.JSONDecodeError, KeyError) as e:
                        logger.error(f"Invalid pub/sub message format: {e}")

        except Exception as e:
            logger.error(f"Pub/sub listener error: {e}")

    async def publish_event(self, event_type: str, data: dict):
        """Publish event to Redis for distribution"""
        if not self.redis_client:
            # Fallback to direct broadcast
            await self._fallback_broadcast(event_type, data)
            return

        try:
            await self.redis_client.publish(event_type, json.dumps(data))
        except Exception as e:
            logger.error(f"Failed to publish to Redis: {e}")
            await self._fallback_broadcast(event_type, data)

    async def _fallback_broadcast(self, event_type: str, data: dict):
        """Direct broadcast when Redis is unavailable"""
        ws_message = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }

        if event_type == "bounty_update" and "bounty_id" in data:
            await self.manager.broadcast_to_channel(f"bounty_{data['bounty_id']}", ws_message)
        elif event_type == "payout_sent" and "user_id" in data:
            user_id = str(data["user_id"])
            if user_id in self.manager.user_connections:
                connection_id = self.manager.user_connections[user_id]
                await self.manager.send_personal_message(connection_id, ws_message)

        await self.manager.broadcast_to_channel("global", ws_message)

# Global server instance
ws_server = WebSocketServer()

# FastAPI app setup
app = FastAPI(title="SolFoundry WebSocket Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    await ws_server.initialize_redis()
    await ws_server.start_pubsub()

    # Start heartbeat task
    async def heartbeat_task():
        while True:
            await asyncio.sleep(30)
            await ws_server.manager.ping_connections()

    asyncio.create_task(heartbeat_task())

@app.on_event("shutdown")
async def shutdown_event():
    if ws_server.pubsub_task:
        ws_server.pubsub_task.cancel()
    if ws_server.redis_client:
        await ws_server.redis_client.close()

def verify_jwt_token(token: str) -> Optional[dict]:
    """Verify JWT token and return user data"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    channels: str = Query(default="global")
):
    # Verify JWT token
    user_data = verify_jwt_token(token)
    if not user_data:
        await websocket.close(code=1008, reason="Invalid token")
        return

    user_id = str(user_data.get("sub"))
    connection_id = f"{user_id}_{int(time.time())}"

    # Connect to WebSocket
    connected = await ws_server.manager.connect(websocket, connection_id, user_id)
    if not connected:
        return

    # Subscribe to requested channels
    channel_list = [ch.strip() for ch in channels.split(",") if ch.strip()]
    for channel in channel_list:
        await ws_server.manager.subscribe_to_channel(connection_id, channel)

    # Send welcome message
    await ws_server.manager.send_personal_message(connection_id, {
        "type": "connected",
        "data": {
            "connection_id": connection_id,
            "channels": channel_list,
            "user_id": user_id
        },
        "timestamp": datetime.utcnow().isoformat()
    })

    try:
        while True:
            # Listen for client messages
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                message_type = message.get("type")

                if message_type == "pong":
                    # Update last ping time
                    ws_server.manager.last_ping[connection_id] = time.time()

                elif message_type == "subscribe":
                    # Subscribe to additional channels
                    channel = message.get("channel")
                    if channel:
                        await ws_server.manager.subscribe_to_channel(connection_id, channel)
                        await ws_server.manager.send_personal_message(connection_id, {
                            "type": "subscribed",
                            "data": {"channel": channel},
                            "timestamp": datetime.utcnow().isoformat()
                        })

                elif message_type == "unsubscribe":
                    # Unsubscribe from channel
                    channel = message.get("channel")
                    if channel:
                        await ws_server.manager.unsubscribe_from_channel(connection_id, channel)
                        await ws_server.manager.send_personal_message(connection_id, {
                            "type": "unsubscribed",
                            "data": {"channel": channel},
                            "timestamp": datetime.utcnow().isoformat()
                        })

            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON from {connection_id}")

    except WebSocketDisconnect:
        await ws_server.manager.disconnect(connection_id)
    except Exception as e:
        logger.error(f"WebSocket error for {connection_id}: {e}")
        await ws_server.manager.disconnect(connection_id)

@app.get("/ws/status")
async def websocket_status():
    """Get WebSocket server status"""
    return {
        "active_connections": len(ws_server.manager.active_connections),
        "channels": list(ws_server.manager.channel_connections.keys()),
        "redis_connected": ws_server.redis_client is not None,
        "max_connections": ws_server.manager.max_connections
    }

@app.post("/ws/broadcast")
async def broadcast_event(
    event_type: str,
    data: dict,
    channel: str = "global"
):
    """Broadcast event to WebSocket clients (internal API)"""
    await ws_server.publish_event(event_type, data)
    return {"status": "broadcasted", "type": event_type, "channel": channel}

# Helper functions for other modules to use
async def broadcast_bounty_update(bounty_id: int, bounty_data: dict):
    """Broadcast bounty update event"""
    await ws_server.publish_event("bounty_update", {
        "bounty_id": bounty_id,
        **bounty_data
    })

async def broadcast_pr_submitted(bounty_id: int, pr_data: dict):
    """Broadcast PR submission event"""
    await ws_server.publish_event("pr_submitted", {
        "bounty_id": bounty_id,
        **pr_data
    })

async def broadcast_review_progress(pr_id: int, review_data: dict):
    """Broadcast review progress event"""
    await ws_server.publish_event("review_progress", {
        "pr_id": pr_id,
        **review_data
    })

async def broadcast_payout_sent(user_id: int, payout_data: dict):
    """Broadcast payout event"""
    await ws_server.publish_event("payout_sent", {
        "user_id": user_id,
        **payout_data
    })

async def broadcast_claim_update(user_id: int, claim_data: dict):
    """Broadcast claim update event"""
    await ws_server.publish_event("claim_update", {
        "user_id": user_id,
        **claim_data
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
