from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class AgentRole(str, Enum):
    MASTER = "master"
    FINDER = "finder"
    ANALYZER = "analyzer"
    IMPLEMENTER = "implementer"
    TESTER = "tester"
    SUBMITTER = "submitter"


class TaskStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass(slots=True)
class Bounty:
    id: str
    title: str
    description: str
    repository: str
    languages: list[str]
    tags: list[str]
    reward_usd: int
    deadline: str | None = None
    difficulty: str = "medium"
    constraints: list[str] = field(default_factory=list)
    acceptance_criteria: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class DiscoveryCriteria:
    min_reward_usd: int = 1_000
    preferred_languages: list[str] = field(default_factory=list)
    excluded_tags: list[str] = field(default_factory=list)
    max_difficulty: str | None = None


@dataclass(slots=True)
class ExecutionTask:
    name: str
    owner: AgentRole
    description: str
    status: TaskStatus = TaskStatus.PENDING
    output: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass(slots=True)
class AgentMessage:
    sender: AgentRole
    recipient: AgentRole
    subject: str
    body: str
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class PlanStep:
    id: str
    title: str
    description: str
    owner: AgentRole
    success_criteria: list[str]
    dependencies: list[str] = field(default_factory=list)


@dataclass(slots=True)
class AnalysisResult:
    bounty_id: str
    summary: str
    requirements: list[str]
    risks: list[str]
    implementation_plan: list[PlanStep]
    confidence_score: float
    success_prediction: float


@dataclass(slots=True)
class ImplementationArtifact:
    summary: str
    files_changed: dict[str, str]
    commands_run: list[str]
    notes: list[str]


@dataclass(slots=True)
class TestResult:
    passed: bool
    summary: str
    commands: list[str]
    outputs: list[str]
    coverage_notes: list[str] = field(default_factory=list)


@dataclass(slots=True)
class PullRequestDraft:
    title: str
    body: str
    branch_name: str
    labels: list[str]
    checklist: list[str]


@dataclass(slots=True)
class ExecutionReport:
    bounty: Bounty
    selected: bool
    score: float
    analysis: AnalysisResult | None = None
    implementation: ImplementationArtifact | None = None
    testing: TestResult | None = None
    pull_request: PullRequestDraft | None = None
    timeline: list[ExecutionTask] = field(default_factory=list)
    messages: list[AgentMessage] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def succeeded(self) -> bool:
        return (
            self.selected
            and self.analysis is not None
            and self.implementation is not None
            and self.testing is not None
            and self.testing.passed
            and self.pull_request is not None
            and not self.errors
        )
