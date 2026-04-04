from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from bounty_agent.models import AgentMessage, AgentRole


@dataclass(slots=True)
class AgentContext:
    shared_state: dict[str, Any] = field(default_factory=dict)
    messages: list[AgentMessage] = field(default_factory=list)

    def send_message(self, message: AgentMessage) -> None:
        self.messages.append(message)


@dataclass(slots=True)
class BaseAgent:
    role: AgentRole
    name: str

    def message(self, recipient: AgentRole, subject: str, body: str, **payload: Any) -> AgentMessage:
        return AgentMessage(
            sender=self.role,
            recipient=recipient,
            subject=subject,
            body=body,
            payload=payload,
        )
