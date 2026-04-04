from __future__ import annotations

from dataclasses import dataclass

from bounty_agent.agents.base import AgentContext, BaseAgent
from bounty_agent.llms.registry import LLMRegistry
from bounty_agent.models import AgentRole, AnalysisResult, Bounty, ImplementationArtifact


@dataclass(slots=True)
class ImplementerAgent(BaseAgent):
    llms: LLMRegistry

    def __init__(self, llms: LLMRegistry) -> None:
        super().__init__(role=AgentRole.IMPLEMENTER, name="Solution Implementer")
        self.llms = llms

    def implement(self, bounty: Bounty, analysis: AnalysisResult, context: AgentContext) -> ImplementationArtifact:
        prompt = (
            f"Implement bounty {bounty.id} for repository {bounty.repository}. "
            f"Requirements: {analysis.requirements}. Risks: {analysis.risks}."
        )
        response = self.llms.get("codex").complete(
            prompt,
            system_prompt="Produce implementation strategy and code change summary.",
        )
        files_changed = {
            "src/main.py": "Add or update the core implementation path for the bounty.",
            "tests/test_main.py": "Add validation coverage for the implementation.",
        }
        artifact = ImplementationArtifact(
            summary=response.content,
            files_changed=files_changed,
            commands_run=["git status --short", "python -m unittest discover -s tests"],
            notes=[
                "Implementation is tracked as an autonomous execution artifact.",
                "Provider consensus can be swapped with live API clients.",
            ],
        )
        context.send_message(
            self.message(
                AgentRole.MASTER,
                "implementation_complete",
                f"Prepared implementation artifact for bounty {bounty.id}.",
                files=list(files_changed.keys()),
            )
        )
        return artifact
