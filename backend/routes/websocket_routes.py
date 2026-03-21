from typing import Dict, Set, Optional
import json
import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.websockets import WebSocketState
import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models.user import User
from backend.services.redis_service import RedisService
from backend.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_connections: Dict[str, WebSocket] = {}
        self.connection_metadata: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: str):
        await websocket.accept()

        if room_id not in self.active_connections:
            self.active_connections[room_id] = set()

        self.active_connections[room_id].add(websocket)
        self.user_connections[user_id] = websocket
        self.connection_metadata[websocket] = {
            "user_id": user_id,
            "room_id": room_id,
            "connected_at": datetime.utcnow(),
            "last_heartbeat": datetime.utcnow()
        }

        logger.info(f"User {user_id} connected to room {room_id}")

    def disconnect(self, websocket: WebSocket):
        metadata = self.connection_metadata.get(websocket, {})
        room_id = metadata.get("room_id")
        user_id = metadata.get("user_id")

        if room_id and websocket in self.active_connections.get(room_id, set()):
            self.active_connections[room_id].discard(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

        if user_id and self.user_connections.get(user_id) == websocket:
            del self.user_connections[user_id]

        if websocket in self.connection_metadata:
            del self.connection_metadata[websocket]

        logger.info(f"User {user_id} disconnected from room {room_id}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    async def broadcast_to_room(self, message: str, room_id: str):
        if room_id not in self.active_connections:
            return

        disconnected = []
        for websocket in self.active_connections[room_id].copy():
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_text(message)
                else:
                    disconnected.append(websocket)
            except Exception as e:
                logger.error(f"Error broadcasting to room {room_id}: {e}")
                disconnected.append(websocket)

        for ws in disconnected:
            self.disconnect(ws)

    async def broadcast_to_user(self, message: str, user_id: str):
        websocket = self.user_connections.get(user_id)
        if websocket:
            await self.send_personal_message(message, websocket)

    def get_room_count(self, room_id: str) -> int:
        return len(self.active_connections.get(room_id, set()))

    def get_total_connections(self) -> int:
        return sum(len(connections) for connections in self.active_connections.values())


manager = ConnectionManager()


async def verify_token(token: str, db: AsyncSession) -> Optional[User]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except jwt.JWTError:
        return None

    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    return user


@router.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
    db: AsyncSession = None
):
    if db is None:
        async for session in get_db():
            db = session
            break

    user = await verify_token(token, db)
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return

    if manager.get_total_connections() >= 1000:
        await websocket.close(code=4002, reason="Max connections reached")
        return

    await manager.connect(websocket, room_id, str(user.id))

    redis_service = RedisService()
    await redis_service.subscribe_to_room(room_id)

    try:
        while True:
            try:
                message = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                data = json.loads(message)

                if data.get("type") == "heartbeat":
                    metadata = manager.connection_metadata.get(websocket, {})
                    metadata["last_heartbeat"] = datetime.utcnow()

                    response = {
                        "type": "heartbeat_ack",
                        "timestamp": datetime.utcnow().isoformat(),
                        "room_connections": manager.get_room_count(room_id)
                    }
                    await manager.send_personal_message(json.dumps(response), websocket)

                elif data.get("type") == "subscribe":
                    target_room = data.get("room_id", room_id)
                    await redis_service.subscribe_to_room(target_room)

                    response = {
                        "type": "subscription_ack",
                        "room_id": target_room,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    await manager.send_personal_message(json.dumps(response), websocket)

            except asyncio.TimeoutError:
                heartbeat_msg = {
                    "type": "ping",
                    "timestamp": datetime.utcnow().isoformat()
                }
                await manager.send_personal_message(json.dumps(heartbeat_msg), websocket)

            except json.JSONDecodeError:
                error_msg = {
                    "type": "error",
                    "message": "Invalid JSON format",
                    "timestamp": datetime.utcnow().isoformat()
                }
                await manager.send_personal_message(json.dumps(error_msg), websocket)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user.id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user.id}: {e}")
    finally:
        manager.disconnect(websocket)
        await redis_service.unsubscribe_from_room(room_id)


@router.get("/ws/stats")
async def websocket_stats():
    return {
        "total_connections": manager.get_total_connections(),
        "active_rooms": len(manager.active_connections),
        "rooms": {
            room_id: len(connections)
            for room_id, connections in manager.active_connections.items()
        }
    }


async def handle_redis_message(message: dict):
    event_type = message.get("type")
    room_id = message.get("room_id")

    if not room_id:
        return

    event_data = {
        "type": event_type,
        "room_id": room_id,
        "data": message.get("data", {}),
        "timestamp": datetime.utcnow().isoformat()
    }

    await manager.broadcast_to_room(json.dumps(event_data), room_id)

    if event_type == "payout_sent" and message.get("user_id"):
        user_notification = {
            "type": "personal_payout",
            "amount": message.get("data", {}).get("amount"),
            "bounty_id": message.get("data", {}).get("bounty_id"),
            "timestamp": datetime.utcnow().isoformat()
        }
        await manager.broadcast_to_user(json.dumps(user_notification), message["user_id"])


async def send_bounty_update(bounty_id: str, update_data: dict):
    redis_service = RedisService()
    message = {
        "type": "bounty_update",
        "room_id": f"bounty_{bounty_id}",
        "data": update_data
    }
    await redis_service.publish_to_room(f"bounty_{bounty_id}", message)


async def send_pr_submitted(bounty_id: str, pr_data: dict):
    redis_service = RedisService()
    message = {
        "type": "pr_submitted",
        "room_id": f"bounty_{bounty_id}",
        "data": pr_data
    }
    await redis_service.publish_to_room(f"bounty_{bounty_id}", message)


async def send_review_progress(bounty_id: str, review_data: dict):
    redis_service = RedisService()
    message = {
        "type": "review_progress",
        "room_id": f"bounty_{bounty_id}",
        "data": review_data
    }
    await redis_service.publish_to_room(f"bounty_{bounty_id}", message)


async def send_claim_update(bounty_id: str, claim_data: dict):
    redis_service = RedisService()
    message = {
        "type": "claim_update",
        "room_id": f"bounty_{bounty_id}",
        "data": claim_data
    }
    await redis_service.publish_to_room(f"bounty_{bounty_id}", message)
