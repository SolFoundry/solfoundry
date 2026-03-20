"""WebSocket endpoint for real-time event streaming.

Connect: ws://host/ws?token=<uuid>
Messages: subscribe, unsubscribe, broadcast, pong (JSON)
"""

import asyncio

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from app.services.websocket_manager import manager

router = APIRouter(tags=["websocket"])


@router.get(
    "/ws/info",
    summary="WebSocket protocol reference",
    description="""
Documentation for the SolFoundry real-time WebSocket API.

**Connection URL:**
```
wss://api.solfoundry.org/ws?token=<user-uuid>
```

The token is your user UUID (the `id` field in the user profile from `/auth/me`).
The connection is closed with code **4001** if the token is invalid.

---

### Client → Server messages

All messages are JSON objects.

#### subscribe
Subscribe to a named channel to receive real-time events:
```json
{ "type": "subscribe", "channel": "bounty:abc123", "token": "<user-uuid>" }
```
- `channel` (string, required) — channel name
- `token` (string, required) — user UUID for re-authentication

#### unsubscribe
```json
{ "type": "unsubscribe", "channel": "bounty:abc123" }
```

#### broadcast
Publish data to all subscribers on a channel:
```json
{ "type": "broadcast", "channel": "bounty:abc123", "data": { "event": "status_changed", "status": "in_progress" }, "token": "<user-uuid>" }
```

#### pong
Heartbeat reply (send in response to server `ping`):
```json
{ "type": "pong" }
```

---

### Server → Client messages

#### ping
Server heartbeat every 30 seconds:
```json
{ "type": "ping" }
```
Reply with `{ "type": "pong" }` to keep the connection alive.

#### subscribed
```json
{ "type": "subscribed", "channel": "bounty:abc123" }
```

#### unsubscribed
```json
{ "type": "unsubscribed", "channel": "bounty:abc123" }
```

#### broadcasted
Acknowledgement sent to the broadcaster:
```json
{ "type": "broadcasted", "channel": "bounty:abc123", "recipients": 3 }
```

#### error
```json
{ "type": "error", "detail": "rate limit exceeded" }
```

---

### Channel naming conventions

| Channel | Purpose |
|---------|---------|
| `bounty:<id>` | Status changes, new submissions, payout confirmation for a specific bounty |
| `user:<id>` | Personal notifications: payout sent, rank changed, PR reviewed |
| `global` | Platform-wide announcements |

---

### Rate limits

100 messages per 60-second window per connection.
Exceeding the limit returns `{ "type": "error", "detail": "rate limit exceeded" }`.

---

### Heartbeat

The server sends a `ping` every 30 seconds. If no `pong` is received within the
next interval, the connection is closed. Clients should always reply to `ping`.
""",
    responses={
        200: {
            "description": "WebSocket protocol documentation",
            "content": {
                "application/json": {
                    "example": {
                        "endpoint": "wss://api.solfoundry.org/ws?token=<user-uuid>",
                        "protocol": "JSON over WebSocket",
                        "heartbeat_interval_seconds": 30,
                        "rate_limit": "100 messages / 60 seconds",
                        "close_codes": {
                            "4001": "Invalid or missing authentication token",
                            "1001": "Server shutting down",
                        },
                        "client_message_types": ["subscribe", "unsubscribe", "broadcast", "pong"],
                        "server_message_types": ["ping", "subscribed", "unsubscribed", "broadcasted", "error"],
                        "channel_examples": {
                            "bounty_updates": "bounty:<bounty_id>",
                            "user_notifications": "user:<user_id>",
                            "platform": "global",
                        },
                    }
                }
            },
        }
    },
)
async def websocket_info():
    """Return WebSocket connection parameters and protocol reference."""
    from app.services.websocket_manager import HEARTBEAT_INTERVAL, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW
    return JSONResponse({
        "endpoint": "/ws?token=<user-uuid>",
        "protocol": "JSON over WebSocket",
        "heartbeat_interval_seconds": HEARTBEAT_INTERVAL,
        "rate_limit": f"{RATE_LIMIT_MAX} messages / {RATE_LIMIT_WINDOW} seconds",
        "close_codes": {
            "4001": "Invalid or missing authentication token",
            "1001": "Server shutting down",
        },
        "client_message_types": ["subscribe", "unsubscribe", "broadcast", "pong"],
        "server_message_types": ["ping", "subscribed", "unsubscribed", "broadcasted", "error"],
        "channel_examples": {
            "bounty_updates": "bounty:<bounty_id>",
            "user_notifications": "user:<user_id>",
            "platform": "global",
        },
        "examples": {
            "subscribe": {"type": "subscribe", "channel": "bounty:abc123", "token": "<user-uuid>"},
            "unsubscribe": {"type": "unsubscribe", "channel": "bounty:abc123"},
            "broadcast": {"type": "broadcast", "channel": "bounty:abc123", "data": {"event": "status_changed"}, "token": "<user-uuid>"},
            "pong": {"type": "pong"},
        },
    })


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: str = Query(
        ...,
        description=(
            "User UUID for authentication. "
            "Obtain from the `id` field in `GET /auth/me`. "
            "Connection is rejected with close code 4001 if invalid."
        ),
    ),
):
    """
    WebSocket endpoint for real-time event streaming.

    **Connection:** `ws://host/ws?token=<user-uuid>`

    After connecting, send `subscribe` messages to join channels and receive
    real-time events. The server sends a `ping` every 30 seconds — reply with `pong`.

    See `GET /ws/info` for the full protocol reference.
    """
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
