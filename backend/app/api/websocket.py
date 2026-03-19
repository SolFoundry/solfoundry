"""WebSocket API routes."""
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from app.websocket import manager
from app.middleware.auth import get_current_user
from app.models.user import User
import redis.asyncio as redis
from app.config import settings
import json
import asyncio

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    current_user: User = Depends(get_current_user),
):
    """WebSocket endpoint for real-time notifications."""
    await manager.connect(websocket, current_user.id)
    
    # Subscribe to Redis pub/sub for this user
    r = redis.from_url(settings.REDIS_URL)
    pubsub = r.pubsub()
    await pubsub.subscribe(f"user:{current_user.id}:notifications")
    
    try:
        while True:
            # Listen for Redis messages
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            
            if message:
                # Forward to WebSocket client
                await manager.send_personal_message(
                    {
                        "type": "notification",
                        "data": json.loads(message["data"]),
                    },
                    current_user.id,
                )
            
            # Check if WebSocket is still alive
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=0.1)
            except asyncio.TimeoutError:
                pass
            except WebSocketDisconnect:
                break
    
    finally:
        await pubsub.unsubscribe(f"user:{current_user.id}:notifications")
        await pubsub.close()
        manager.disconnect(websocket, current_user.id)
