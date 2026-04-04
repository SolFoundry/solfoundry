from __future__ import annotations

from dataclasses import dataclass

from bounty_agent.agents.analyzer import AnalyzerAgent
from bounty_agent.agents.finder import FinderAgent
from bounty_agent.agents.implementer import ImplementerAgent
from bounty_agent.agents.submitter import SubmitterAgent
from bounty_agent.agents.tester import TesterAgent
from bounty_agent.coordinator.master import MasterCoordinator
from bounty_agent.llms.providers import ClaudeLLM, CodexLLM, GeminiLLM
from bounty_agent.llms.registry import LLMRegistry
from bounty_agent.models import Bounty, DiscoveryCriteria, ExecutionReport
from bounty_agent.utils.testing import TestingHarness


@dataclass(slots=True)
class BountyHuntingWorkflow:
    coordinator: MasterCoordinator

    @classmethod
    def build_default(cls) -> "BountyHuntingWorkflow":
        registry = LLMRegistry()
        registry.register(ClaudeLLM())
        registry.register(CodexLLM())
        registry.register(GeminiLLM())
        coordinator = MasterCoordinator(
            finder=FinderAgent(),
            analyzer=AnalyzerAgent(registry),
            implementer=ImplementerAgent(registry),
            tester=TesterAgent(TestingHarness()),
            submitter=SubmitterAgent(),
        )
        return cls(coordinator=coordinator)

    def run(self, marketplace: list[Bounty], criteria: DiscoveryCriteria) -> list[ExecutionReport]:
        return self.coordinator.execute(marketplace=marketplace, criteria=criteria)
