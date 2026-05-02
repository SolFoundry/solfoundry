"""State persistence for bounty missions."""

import json
import os
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum
from datetime import datetime

logger = logging.getLogger("bounty_agent.state")


class MissionStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class AgentEvent:
    agent_id: str
    event_type: str
    message: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MissionState:
    mission_id: str
    bounty_id: str
    status: MissionStatus = MissionStatus.PENDING
    current_stage: str = "discover"
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    events: List[AgentEvent] = field(default_factory=list)
    is_complete: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class StateStore:
    """File-based state persistence for missions."""

    def __init__(self, state_dir: str = ".bounty_state"):
        self.state_dir = state_dir
        os.makedirs(state_dir, exist_ok=True)

    def save(self, state: MissionState):
        path = os.path.join(self.state_dir, f"{state.mission_id}.json")
        with open(path, "w") as f:
            json.dump(state.to_dict(), f, indent=2, default=str)

    def load(self, mission_id: str) -> Optional[MissionState]:
        path = os.path.join(self.state_dir, f"{mission_id}.json")
        if not os.path.exists(path):
            return None
        with open(path) as f:
            data = json.load(f)
        return MissionState(**{k: v for k, v in data.items() if k in MissionState.__dataclass_fields__})

    def list_missions(self) -> List[str]:
        return [f.replace(".json", "") for f in os.listdir(self.state_dir) if f.endswith(".json")]
