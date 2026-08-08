"""Base LLM reviewer interface for multi-model code review."""

from abc import ABC, abstractmethod
from typing import Optional

from ..models import DiffFile, Finding, ReviewConfig


class LLMReviewer(ABC):
    """Abstract base class for LLM-based code reviewers."""

    name: str = "base"

    def __init__(self, config: ReviewConfig):
        self.config = config

    @abstractmethod
    async def review(self, files: list[DiffFile], instructions: Optional[str] = None) -> tuple[float, list[Finding]]:
        """Run a review and return a (score, findings) tuple."""
        raise NotImplementedError

    def _build_prompt(self, files: list[DiffFile], instructions: Optional[str]) -> str:
        """Build the prompt sent to the LLM."""
        strictness = self.config.strictness.value
        parts = [
            f"You are a senior code reviewer. Review the following pull request diff with {strictness} strictness.",
            "Return a JSON object with:",
            '  {"score": <0-10>, "findings": [{"severity": "critical|high|medium|low|info", "category": "...", "message": "...", "file": "...", "line": <int>, "suggestion": "..."}]}',
            "Severity mapping: critical=-2.0, high=-1.0, medium=-0.5, low=-0.2, info=-0.1 off a base of 10.0.",
            "",
        ]
        if instructions:
            parts.append(instructions)
            parts.append("")
        for df in files:
            parts.append(f"### File: {df.filename}")
            parts.append("```diff")
            parts.append(df.patch[:4000])
            parts.append("```")
            parts.append("")
        return "\n".join(parts)

    @staticmethod
    def _parse_findings(raw: str) -> list[Finding]:
        """Best-effort parse of an LLM JSON response into Finding objects."""
        import json
        import re

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if not m:
                return []
            try:
                data = json.loads(m.group(0))
            except json.JSONDecodeError:
                return []

        findings = []
        for item in data.get("findings", []):
            if not isinstance(item, dict):
                continue
            severity = str(item.get("severity", "info")).lower()
            findings.append(Finding(
                severity=severity,
                category=str(item.get("category", "llm")),
                message=str(item.get("message", "")),
                file=item.get("file"),
                line=item.get("line"),
                model=self.name,
                suggestion=item.get("suggestion"),
            ))
        return findings

    @staticmethod
    def _score(raw: str) -> float:
        import json
        import re
        try:
            data = json.loads(raw)
            return float(data.get("score", 7.0))
        except (json.JSONDecodeError, TypeError, ValueError):
            m = re.search(r"""["']score["']\s*:\s*([0-9.]+)""", raw)
            if m:
                try:
                    return float(m.group(1))
                except ValueError:
                    return 7.0
            return 7.0