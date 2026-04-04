from __future__ import annotations

from dataclasses import dataclass

from bounty_agent.agents.base import AgentContext, BaseAgent
from bounty_agent.models import (
    AgentRole,
    AnalysisResult,
    Bounty,
    ImplementationArtifact,
    PullRequestDraft,
    TestResult,
)
from bounty_agent.utils.formatting import format_pr_body, sanitize_branch_name


@dataclass(slots=True)
class SubmitterAgent(BaseAgent):
    def __init__(self) -> None:
        super().__init__(role=AgentRole.SUBMITTER, name="PR Submitter")

    def draft_pr(
        self,
        bounty: Bounty,
        analysis: AnalysisResult,
        implementation: ImplementationArtifact,
        testing: TestResult,
        context: AgentContext,
    ) -> PullRequestDraft:
        branch_name = sanitize_branch_name(f"bounty/{bounty.id}-{bounty.title}")
        title = f"[Bounty #{bounty.id}] {bounty.title}"
        checklist = [
            "Acceptance criteria verified",
            "Automated tests passed",
            "Risk assessment documented",
        ]
        body = format_pr_body(
            bounty=bounty,
            analysis=analysis,
            implementation=implementation,
            testing=testing,
            checklist=checklist,
        )
        draft = PullRequestDraft(
            title=title,
            body=body,
            branch_name=branch_name,
            labels=["bounty", "autonomous-agent", "ready-for-review"],
            checklist=checklist,
        )
        context.send_message(
            self.message(
                AgentRole.MASTER,
                "pr_ready",
                f"Draft PR prepared for bounty {bounty.id} on branch {branch_name}.",
            )
        )
        return draft
