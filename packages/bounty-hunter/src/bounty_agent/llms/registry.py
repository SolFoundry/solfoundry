from __future__ import annotations

from dataclasses import dataclass, field

from .base import LLMClient, LLMResponse


@dataclass(slots=True)
class LLMRegistry:
    providers: dict[str, LLMClient] = field(default_factory=dict)

    def register(self, client: LLMClient) -> None:
        self.providers[client.provider_name] = client

    def get(self, provider_name: str) -> LLMClient:
        return self.providers[provider_name]

    def consensus(self, prompt: str, *, providers: list[str], system_prompt: str | None = None) -> list[LLMResponse]:
        return [
            self.get(provider_name).complete(prompt, system_prompt=system_prompt)
            for provider_name in providers
        ]
