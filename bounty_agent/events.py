"""Event bus for pipeline observability and agent coordination."""

import logging
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

logger = logging.getLogger("bounty_agent.events")


class EventType(Enum):
    MISSION_STARTED = "mission_started"
    MISSION_COMPLETED = "mission_completed"
    MISSION_FAILED = "mission_failed"
    STAGE_STARTED = "stage_started"
    STAGE_COMPLETED = "stage_completed"
    AGENT_ASSIGNED = "agent_assigned"
    AGENT_COMPLETED = "agent_completed"
    AGENT_ERROR = "agent_error"
    BOUNTY_DISCOVERED = "bounty_discovered"
    PR_SUBMITTED = "pr_submitted"


class AgentRole(Enum):
    ORCHESTRATOR = "orchestrator"
    SCANNER = "scanner"
    PLANNER = "planner"
    CODER = "coder"
    TESTER = "tester"
    SUBMITTER = "submitter"
    REVIEWER = "reviewer"


@dataclass
class PipelineEvent:
    event_type: EventType
    agent_role: AgentRole
    mission_id: str
    message: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type.value,
            "agent_role": self.agent_role.value,
            "mission_id": self.mission_id,
            "message": self.message,
            "metadata": self.metadata,
            "timestamp": self.timestamp,
        }


# Module-level singleton
_event_bus: Optional["EventBus"] = None


def get_event_bus() -> "EventBus":
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus


class EventBus:
    """Central event bus for pipeline observability.

    Supports synchronous event handlers and event history for replay/debugging.
    """

    def __init__(self, max_history: int = 1000):
        self._handlers: List[Callable[[PipelineEvent], None]] = []
        self._history: List[PipelineEvent] = []
        self._max_history = max_history

    def subscribe(self, handler: Callable[[PipelineEvent], None]):
        self._handlers.append(handler)

    def unsubscribe(self, handler: Callable[[PipelineEvent], None]):
        self._handlers = [h for h in self._handlers if h != handler]

    def emit(self, event: PipelineEvent):
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]
        for handler in self._handlers:
            try:
                handler(event)
            except Exception as exc:
                logger.warning("Event handler error: %s", exc)

    def get_history(self, limit: int = 100, event_type: Optional[EventType] = None) -> List[PipelineEvent]:
        events = self._history
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return events[-limit:]

    def clear_history(self):
        self._history.clear()
