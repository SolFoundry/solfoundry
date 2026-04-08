"""Abstract base for LLM providers (re-exported from package)."""

from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    """Interface every LLM provider must implement."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name."""

    @abstractmethod
    async def enhance(self, system_prompt: str, user_prompt: str, bounty: dict[str, Any]) -> dict:
        """Run enhancement and return structured JSON dict."""
