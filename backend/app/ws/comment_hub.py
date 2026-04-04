"""Broadcast bounty comment events to subscribed WebSocket clients."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import WebSocket


class CommentConnectionHub:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, bounty_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms.setdefault(bounty_id, set()).add(ws)

    async def disconnect(self, bounty_id: str, ws: WebSocket) -> None:
        async with self._lock:
            room = self._rooms.get(bounty_id)
            if not room:
                return
            room.discard(ws)
            if not room:
                del self._rooms[bounty_id]

    async def broadcast(self, bounty_id: str, message: dict[str, Any]) -> None:
        async with self._lock:
            room = set(self._rooms.get(bounty_id, ()))
        if not room:
            return
        payload = json.dumps(message, default=str)
        dead: list[WebSocket] = []
        for ws in room:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                r = self._rooms.get(bounty_id)
                if r:
                    for ws in dead:
                        r.discard(ws)


_hub: CommentConnectionHub | None = None


def get_comment_hub() -> CommentConnectionHub:
    global _hub
    if _hub is None:
        _hub = CommentConnectionHub()
    return _hub
