"""SolFoundry Real-time WebSocket Activity Feed.

Backend server using Socket.IO for live bounty postings,
submissions, reviews, and leaderboard changes.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# --- Event Types ---

class EventType(str, Enum):
    BOUNTY_POSTED = "bounty:posted"
    BOUNTY_UPDATED = "bounty:updated"
    BOUNTY_CANCELLED = "bounty:cancelled"
    SUBMISSION_CREATED = "submission:created"
    SUBMISSION_REVIEWED = "submission:reviewed"
    SUBMISSION_MERGED = "submission:merged"
    LEADERBOARD_CHANGED = "leaderboard:changed"
    PAYOUT_SENT = "payout:sent"
    USER_JOINED = "user:joined"
    REVIEW_COMPLETED = "review:completed"


# --- Event Data ---

class ActivityEvent:
    """Represents a single activity event."""

    def __init__(
        self,
        event_type: EventType,
        data: dict,
        actor: Optional[dict] = None,
        target: Optional[dict] = None,
    ):
        self.event_type = event_type
        self.data = data
        self.actor = actor  # Who triggered the event
        self.target = target  # What was affected
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.id = f"{event_type.value}:{int(datetime.now(timezone.utc).timestamp() * 1000)}"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.event_type.value,
            "data": self.data,
            "actor": self.actor,
            "target": self.target,
            "timestamp": self.timestamp,
        }


# --- Connection Manager ---

class ConnectionManager:
    """Manages WebSocket connections and room subscriptions."""

    def __init__(self):
        # sid -> {user_id, rooms, connected_at}
        self.connections: dict[str, dict] = {}
        # room -> set of sids
        self.rooms: dict[str, set[str]] = {
            "bounties": set(),      # Bounty updates
            "submissions": set(),   # Submission updates
            "leaderboard": set(),   # Leaderboard changes
            "payouts": set(),       # Payout notifications
            "all": set(),           # Everything
        }

    def connect(self, sid: str, user_id: Optional[str] = None):
        """Register a new connection."""
        self.connections[sid] = {
            "user_id": user_id,
            "rooms": {"all"},  # Default to 'all' room
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }
        self.rooms["all"].add(sid)
        logger.info(f"Client {sid} connected (user: {user_id})")

    def disconnect(self, sid: str):
        """Remove a connection."""
        if sid in self.connections:
            for room in self.connections[sid]["rooms"]:
                self.rooms.get(room, set()).discard(sid)
            del self.connections[sid]
            logger.info(f"Client {sid} disconnected")

    def join_room(self, sid: str, room: str):
        """Subscribe a connection to a room."""
        if room not in self.rooms:
            self.rooms[room] = set()
        self.rooms[room].add(sid)
        if sid in self.connections:
            self.connections[sid]["rooms"].add(room)
        logger.debug(f"Client {sid} joined room: {room}")

    def leave_room(self, sid: str, room: str):
        """Unsubscribe a connection from a room."""
        self.rooms.get(room, set()).discard(sid)
        if sid in self.connections:
            self.connections[sid]["rooms"].discard(room)

    def get_room_members(self, room: str) -> set[str]:
        """Get all SIDs in a room."""
        return self.rooms.get(room, set())

    @property
    def active_connections(self) -> int:
        return len(self.connections)


# --- Event Bus ---

class EventBus:
    """In-memory event bus for broadcasting activity events."""

    def __init__(self):
        self.history: list[dict] = []
        self.max_history = 100
        self.subscribers: list = []  # Callback functions

    def publish(self, event: ActivityEvent):
        """Publish an event to all subscribers and store in history."""
        event_dict = event.to_dict()

        # Store in history
        self.history.append(event_dict)
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]

        # Notify subscribers
        for callback in self.subscribers:
            try:
                callback(event_dict)
            except Exception as e:
                logger.error(f"Subscriber error: {e}")

        logger.info(f"Event published: {event.event_type.value}")

    def subscribe(self, callback):
        """Register a callback for events."""
        self.subscribers.append(callback)

    def get_history(self, limit: int = 50, event_type: Optional[str] = None) -> list[dict]:
        """Get recent events, optionally filtered by type."""
        events = self.history
        if event_type:
            events = [e for e in events if e["type"] == event_type]
        return events[-limit:]


# --- FastAPI + Socket.IO Integration ---

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse

activity_router = APIRouter()
manager = ConnectionManager()
event_bus = EventBus()


@activity_router.websocket("/ws/activity")
async def websocket_activity(websocket: WebSocket):
    """WebSocket endpoint for real-time activity feed."""
    await websocket.accept()
    sid = id(websocket)  # Simple SID from object id

    manager.connect(sid)

    try:
        # Send recent history on connect
        history = event_bus.get_history(limit=20)
        if history:
            await websocket.send_json({
                "type": "history",
                "events": history,
            })

        # Main message loop
        while True:
            data = await websocket.receive_json()

            msg_type = data.get("type", "")

            if msg_type == "subscribe":
                rooms = data.get("rooms", ["all"])
                for room in rooms:
                    manager.join_room(sid, room)
                await websocket.send_json({
                    "type": "subscribed",
                    "rooms": list(manager.connections.get(sid, {}).get("rooms", set())),
                })

            elif msg_type == "unsubscribe":
                rooms = data.get("rooms", [])
                for room in rooms:
                    manager.leave_room(sid, room)

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(sid)


# --- REST Endpoints ---

@activity_router.get("/api/activity")
async def get_activity_history(
    limit: int = 50,
    event_type: Optional[str] = None,
):
    """Get recent activity events (REST fallback)."""
    events = event_bus.get_history(limit=limit, event_type=event_type)
    return {"events": events, "total": len(events)}


@activity_router.get("/api/activity/stats")
async def get_activity_stats():
    """Get activity feed statistics."""
    return {
        "active_connections": manager.active_connections,
        "rooms": {room: len(members) for room, members in manager.rooms.items()},
        "total_events": len(event_bus.history),
    }


# --- Event Publishers (called internally) ---

async def publish_bounty_posted(bounty_id: int, title: str, tier: str, reward: int, created_by: str):
    """Publish a new bounty event."""
    event = ActivityEvent(
        event_type=EventType.BOUNTY_POSTED,
        data={"bounty_id": bounty_id, "title": title, "tier": tier, "reward": reward},
        actor={"username": created_by},
    )
    event_bus.publish(event)


async def publish_submission_created(submission_id: str, bounty_id: int, submitted_by: str, pr_url: str):
    """Publish a new submission event."""
    event = ActivityEvent(
        event_type=EventType.SUBMISSION_CREATED,
        data={"submission_id": submission_id, "bounty_id": bounty_id, "pr_url": pr_url},
        actor={"username": submitted_by},
    )
    event_bus.publish(event)


async def publish_review_completed(submission_id: str, score: float, passed: bool):
    """Publish a review completion event."""
    event = ActivityEvent(
        event_type=EventType.REVIEW_COMPLETED,
        data={"submission_id": submission_id, "score": score, "passed": passed},
    )
    event_bus.publish(event)


async def publish_leaderboard_change(user_id: str, username: str, new_rank: int, old_rank: int):
    """Publish a leaderboard change event."""
    direction = "up" if new_rank < old_rank else "down" if new_rank > old_rank else "same"
    event = ActivityEvent(
        event_type=EventType.LEADERBOARD_CHANGED,
        data={"new_rank": new_rank, "old_rank": old_rank, "direction": direction},
        actor={"username": username, "user_id": user_id},
    )
    event_bus.publish(event)


async def publish_payout_sent(user_id: str, amount: int, bounty_title: str, tx_url: str):
    """Publish a payout event."""
    event = ActivityEvent(
        event_type=EventType.PAYOUT_SENT,
        data={"amount": amount, "bounty_title": bounty_title, "tx_url": tx_url},
        actor={"username": user_id},
    )
    event_bus.publish(event)
