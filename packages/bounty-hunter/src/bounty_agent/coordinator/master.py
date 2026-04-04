from __future__ import annotations

from dataclasses import dataclass

from bounty_agent.agents.analyzer import AnalyzerAgent
from bounty_agent.agents.base import AgentContext
from bounty_agent.agents.finder import FinderAgent
from bounty_agent.agents.implementer import ImplementerAgent
from bounty_agent.agents.submitter import SubmitterAgent
from bounty_agent.agents.tester import TesterAgent
from bounty_agent.models import Bounty, DiscoveryCriteria, ExecutionReport, ExecutionTask, TaskStatus
from bounty_agent.utils.recovery import build_recovery_plan


@dataclass(slots=True)
class MasterCoordinator:
    finder: FinderAgent
    analyzer: AnalyzerAgent
    implementer: ImplementerAgent
    tester: TesterAgent
    submitter: SubmitterAgent

    def execute(self, marketplace: list[Bounty], criteria: DiscoveryCriteria) -> list[ExecutionReport]:
        context = AgentContext(shared_state={"criteria": criteria})
        reports: list[ExecutionReport] = []
        candidates = self.finder.discover(marketplace, criteria, context)

        for bounty in marketplace:
            report = ExecutionReport(
                bounty=bounty,
                selected=bounty in candidates,
                score=self._score_bounty(bounty),
                messages=context.messages,
            )
            reports.append(report)

        for report in reports:
            if not report.selected:
                report.timeline.append(
                    ExecutionTask(
                        name="discovery",
                        owner=self.finder.role,
                        description="Bounty filtered out during discovery.",
                        status=TaskStatus.SKIPPED,
                    )
                )
                continue

            try:
                report.timeline.append(
                    ExecutionTask(
                        name="analysis",
                        owner=self.analyzer.role,
                        description="Analyze requirements and create execution plan.",
                        status=TaskStatus.IN_PROGRESS,
                    )
                )
                report.analysis = self.analyzer.analyze(report.bounty, context)
                report.timeline[-1].status = TaskStatus.COMPLETED

                report.timeline.append(
                    ExecutionTask(
                        name="implementation",
                        owner=self.implementer.role,
                        description="Implement the planned solution.",
                        status=TaskStatus.IN_PROGRESS,
                    )
                )
                report.implementation = self.implementer.implement(report.bounty, report.analysis, context)
                report.timeline[-1].status = TaskStatus.COMPLETED

                report.timeline.append(
                    ExecutionTask(
                        name="testing",
                        owner=self.tester.role,
                        description="Run automated validation.",
                        status=TaskStatus.IN_PROGRESS,
                    )
                )
                report.testing = self.tester.validate(
                    report.bounty,
                    report.analysis,
                    report.implementation,
                    context,
                )
                report.timeline[-1].status = (
                    TaskStatus.COMPLETED if report.testing.passed else TaskStatus.FAILED
                )
                if not report.testing.passed:
                    raise RuntimeError(report.testing.summary)

                report.timeline.append(
                    ExecutionTask(
                        name="submission",
                        owner=self.submitter.role,
                        description="Prepare pull request for submission.",
                        status=TaskStatus.IN_PROGRESS,
                    )
                )
                report.pull_request = self.submitter.draft_pr(
                    report.bounty,
                    report.analysis,
                    report.implementation,
                    report.testing,
                    context,
                )
                report.timeline[-1].status = TaskStatus.COMPLETED
                report.messages = list(context.messages)
            except Exception as exc:  # pragma: no cover - protected by tests via behavior
                report.errors.append(str(exc))
                if report.timeline:
                    report.timeline[-1].status = TaskStatus.FAILED
                    report.timeline[-1].error = str(exc)
                report.messages = list(context.messages)
                report.bounty.metadata["recovery_plan"] = build_recovery_plan(report)

        return sorted(reports, key=lambda item: item.score, reverse=True)

    @staticmethod
    def _score_bounty(bounty: Bounty) -> float:
        reward_component = min(10.0, bounty.reward_usd / 1_000)
        difficulty_penalty = {"low": 0.5, "medium": 1.0, "high": 1.5, "expert": 2.0}[bounty.difficulty]
        language_bonus = min(2.0, len(bounty.languages) * 0.25)
        return round(reward_component + language_bonus - difficulty_penalty, 2)
