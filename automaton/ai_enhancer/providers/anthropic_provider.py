"""Anthropic Claude provider."""

from __future__ import annotations

import json
import os
from typing import Any

from .base import LLMProvider

try:
    from anthropic import AsyncAnthropic
except ImportError:  # pragma: no cover
    AsyncAnthropic = None  # type: ignore[assignment,misc]


class AnthropicProvider(LLMProvider):
    """Claude-based enhancement provider."""

    def __init__(self, model: str = "claude-sonnet-4-20250514", api_key: str | None = None) -> None:
        if AsyncAnthropic is None:
            raise ImportError("anthropic package is required: pip install anthropic")
        self.model = model
        self._client = AsyncAnthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))

    @property
    def name(self) -> str:
        return f"anthropic/{self.model}"

    async def enhance(self, system_prompt: str, user_prompt: str, bounty: dict[str, Any]) -> dict:
        response = await self._client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = response.content[0].text
        # Extract JSON from potential markdown code blocks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
