"""Data models shared across the AI Code Review app."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class Finding:
    """A single review finding/issue."""
    severity: Severity
    category: str
    message: str
    file: Optional[str] = None
    line: Optional[int] = None
    model: Optional[str] = None
    suggestion: Optional[str] = None

    def to_line_comment(self) -> dict:
        """Convert to a GitHub review comment payload."""
        comment = {
            "path": self.file or "",
            "line": self.line or 1,
            "side": "RIGHT",
            "body": f"**{self.severity.value.upper()}** · {self.category}

{self.message}"
        }
        if self.suggestion:
            comment["body"] += f"

**Suggestion:** {self.suggestion}"
        return comment


@dataclass
class DiffFile:
    """A parsed diff file for analysis."""
    filename: str
    patch: str
    additions: int = 0
    deletions: int = 0

    @property
    def extension(self) -> str:
        return self.filename.rsplit(".", 1)[-1].lower() if "." in self.filename else ""


@dataclass
class ReviewResult:
    """Aggregated result from all reviewers."""
    score: float
    findings: list[Finding] = field(default_factory=list)
    summary: str = ""
    model_scores: dict[str, float] = field(default_factory=dict)

    @property
    def critical_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == Severity.CRITICAL)

    @property
    def high_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == Severity.HIGH)

    @property
    def medium_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == Severity.MEDIUM)

    @property
    def low_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == Severity.LOW)
