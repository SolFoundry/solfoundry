from __future__ import annotations

from dataclasses import dataclass

from .base import LLMClient, LLMResponse


@dataclass(slots=True)
class DeterministicLLM:
    provider_name: str
    specialty: str

    def complete(self, prompt: str, *, system_prompt: str | None = None) -> LLMResponse:
        content = (
            f"{self.provider_name} [{self.specialty}] analyzed the request and produced "
            f"a structured response for: {prompt[:160]}"
        )
        return LLMResponse(
            provider=self.provider_name,
            content=content,
            confidence=0.75,
            metadata={"system_prompt": system_prompt or "", "specialty": self.specialty},
        )


class ClaudeLLM(DeterministicLLM):
    def __init__(self) -> None:
        super().__init__(provider_name="claude", specialty="code analysis and writing")


class CodexLLM(DeterministicLLM):
    def __init__(self) -> None:
        super().__init__(provider_name="codex", specialty="implementation execution")


class GeminiLLM(DeterministicLLM):
    def __init__(self) -> None:
        super().__init__(provider_name="gemini", specialty="requirements analysis")
