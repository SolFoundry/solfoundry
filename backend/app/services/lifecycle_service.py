"""Bounty lifecycle logging service.

Provides an in-memory audit trail of all state transitions for bounties
and submissions. Every status change, review event, approval, and payout
is recorded for full traceability.
"""

from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.core.audit import audit_event
from app.models.lifecycle import (
    LifecycleEventType,
    LifecycleLogEntry,
    LifecycleLogResponse,
)

_lock = threading.Lock()

# bounty_id -> [LifecycleLogEntry, ...]
_lifecycle_store: dict[str, list[LifecycleLogEntry]] = {}


def log_event(
    bounty_id: str,
    event_type: LifecycleEventType,
    *,
    submission_id: Optional[str] = None,
    previous_state: Optional[str] = None,
    new_state: Optional[str] = None,
    actor_id: Optional[str] = None,
    actor_type: str = "system",
    details: Optional[dict] = None,
) -> LifecycleLogEntry:
    """Record a lifecycle event for a bounty."""
    entry = LifecycleLogEntry(
        id=str(uuid.uuid4()),
        bounty_id=bounty_id,
        submission_id=submission_id,
        event_type=event_type.value,
        previous_state=previous_state,
        new_state=new_state,
        actor_id=actor_id,
        actor_type=actor_type,
        details=details,
        created_at=datetime.now(timezone.utc),
    )

    with _lock:
        if bounty_id not in _lifecycle_store:
            _lifecycle_store[bounty_id] = []
        _lifecycle_store[bounty_id].append(entry)

    audit_event(
        "lifecycle_event",
        bounty_id=bounty_id,
        event_type=event_type.value,
        submission_id=submission_id,
        previous_state=previous_state,
        new_state=new_state,
    )

    return entry


def get_lifecycle_log(bounty_id: str) -> LifecycleLogResponse:
    """Retrieve the full lifecycle log for a bounty."""
    with _lock:
        entries = _lifecycle_store.get(bounty_id, [])
        sorted_entries = sorted(entries, key=lambda e: e.created_at, reverse=True)

    return LifecycleLogResponse(
        items=sorted_entries,
        total=len(sorted_entries),
        bounty_id=bounty_id,
    )


def reset_store() -> None:
    """Clear all in-memory data. Used by tests."""
    with _lock:
        _lifecycle_store.clear()
