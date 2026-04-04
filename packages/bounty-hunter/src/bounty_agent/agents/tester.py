from __future__ import annotations

from dataclasses import dataclass

from bounty_agent.agents.base import AgentContext, BaseAgent
from bounty_agent.models import AgentRole, AnalysisResult, Bounty, ImplementationArtifact, TestResult
from bounty_agent.utils.testing import TestingHarness


@dataclass(slots=True)
class TesterAgent(BaseAgent):
    harness: TestingHarness

    def __init__(self, harness: TestingHarness) -> None:
        super().__init__(role=AgentRole.TESTER, name="Validation Tester")
        self.harness = harness

    def validate(
        self,
        bounty: Bounty,
        analysis: AnalysisResult,
        implementation: ImplementationArtifact,
        context: AgentContext,
    ) -> TestResult:
        result = self.harness.run_suite(bounty=bounty, analysis=analysis, implementation=implementation)
        context.send_message(
            self.message(
                AgentRole.MASTER,
                "testing_complete",
                f"Validation for bounty {bounty.id} {'passed' if result.passed else 'failed'}.",
            )
        )
        return result
