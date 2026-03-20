"""WebSocket endpoint for real-time event streaming.

Connect: ws://host/ws?token=<uuid>
Messages: subscribe, unsubscribe, broadcast, pong (JSON)
"""

import asyncio

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.services.websocket_manager import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: str = Query(..., description="Bearer token (UUID user ID)"),
):
    connection_id = await manager.connect(ws, token)
    if connection_id is None:
        return

    heartbeat_task = asyncio.create_task(manager.heartbeat(connection_id))
    try:
        while True:
            raw = await ws.receive_text()
            response = await manager.handle_message(connection_id, raw)
            if response is not None:
                await ws.send_json(response)
    except WebSocketDisconnect:
        pass
    finally:
        heartbeat_task.cancel()
        await manager.disconnect(connection_id)
