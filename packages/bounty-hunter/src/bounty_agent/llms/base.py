from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(slots=True)
class LLMResponse:
    provider: str
    content: str
    confidence: float
    metadata: dict[str, str]


class LLMClient(Protocol):
    provider_name: str

    def complete(self, prompt: str, *, system_prompt: str | None = None) -> LLMResponse:
        ...
