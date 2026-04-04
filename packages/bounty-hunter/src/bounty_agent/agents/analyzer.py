from __future__ import annotations

from dataclasses import dataclass

from bounty_agent.agents.base import AgentContext, BaseAgent
from bounty_agent.llms.registry import LLMRegistry
from bounty_agent.models import AgentRole, AnalysisResult, Bounty, PlanStep


@dataclass(slots=True)
class AnalyzerAgent(BaseAgent):
    llms: LLMRegistry

    def __init__(self, llms: LLMRegistry) -> None:
        super().__init__(role=AgentRole.ANALYZER, name="Requirements Analyzer")
        self.llms = llms

    def analyze(self, bounty: Bounty, context: AgentContext) -> AnalysisResult:
        prompt = (
            f"Analyze bounty {bounty.id}: {bounty.title}. Description: {bounty.description}. "
            f"Acceptance criteria: {', '.join(bounty.acceptance_criteria)}."
        )
        responses = self.llms.consensus(
            prompt,
            providers=["gemini", "claude"],
            system_prompt="Produce actionable requirement analysis, risks, and an execution plan.",
        )
        requirements = bounty.acceptance_criteria or [
            "Implement a complete solution for the requested repository change.",
            "Demonstrate correctness with automated validation.",
        ]
        risks = [
            "Repository context may be incomplete or stale.",
            "Automated tests may miss integration regressions.",
        ]
        plan = [
            PlanStep(
                id="inspect",
                title="Inspect target repository and issue context",
                description="Gather implementation constraints and affected modules.",
                owner=AgentRole.ANALYZER,
                success_criteria=["Affected components identified", "Constraints documented"],
            ),
            PlanStep(
                id="implement",
                title="Implement solution changes",
                description="Apply the code changes required to satisfy bounty acceptance criteria.",
                owner=AgentRole.IMPLEMENTER,
                success_criteria=["All requested changes applied", "Code comments added where needed"],
                dependencies=["inspect"],
            ),
            PlanStep(
                id="validate",
                title="Run validation suite",
                description="Execute tests, linters, and focused regression checks.",
                owner=AgentRole.TESTER,
                success_criteria=["Tests pass", "Results captured"],
                dependencies=["implement"],
            ),
            PlanStep(
                id="submit",
                title="Prepare pull request",
                description="Format branch, title, checklist, and summary for submission.",
                owner=AgentRole.SUBMITTER,
                success_criteria=["PR title/body generated", "Risk notes included"],
                dependencies=["validate"],
            ),
        ]
        confidence = round(sum(item.confidence for item in responses) / len(responses), 2)
        success_prediction = round(min(0.95, confidence + bounty.reward_usd / 20_000), 2)
        summary = " | ".join(response.content for response in responses)
        result = AnalysisResult(
            bounty_id=bounty.id,
            summary=summary,
            requirements=requirements,
            risks=risks,
            implementation_plan=plan,
            confidence_score=confidence,
            success_prediction=success_prediction,
        )
        context.send_message(
            self.message(
                AgentRole.MASTER,
                "analysis_complete",
                f"Analyzed bounty {bounty.id} with confidence {confidence:.2f}.",
                success_prediction=str(success_prediction),
            )
        )
        return result
