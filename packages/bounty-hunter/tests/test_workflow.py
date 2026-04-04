from __future__ import annotations

import unittest

from bounty_agent.models import Bounty, DiscoveryCriteria, TaskStatus
from bounty_agent.utils.formatting import sanitize_branch_name
from bounty_agent.workflows.bounty_hunt import BountyHuntingWorkflow


class WorkflowTests(unittest.TestCase):
    def setUp(self) -> None:
        self.workflow = BountyHuntingWorkflow.build_default()
        self.marketplace = [
            Bounty(
                id="861",
                title="Autonomous Bounty Hunter",
                description="Build a multi-agent system to discover and solve software bounties.",
                repository="https://github.com/example/repo",
                languages=["python", "typescript"],
                tags=["agents", "automation"],
                reward_usd=1_000_000,
                difficulty="high",
                acceptance_criteria=[
                    "Multi-LLM agent orchestration with planning",
                    "Automated solution implementation and testing",
                    "Autonomous PR submission with proper formatting",
                ],
            ),
            Bounty(
                id="100",
                title="Small docs cleanup",
                description="Update typo in README.",
                repository="https://github.com/example/repo2",
                languages=["markdown"],
                tags=["docs"],
                reward_usd=100,
                difficulty="low",
            ),
        ]

    def test_full_workflow_generates_pr_for_selected_bounty(self) -> None:
        reports = self.workflow.run(
            self.marketplace,
            DiscoveryCriteria(min_reward_usd=500, preferred_languages=["python"]),
        )
        selected = next(report for report in reports if report.bounty.id == "861")
        rejected = next(report for report in reports if report.bounty.id == "100")

        self.assertTrue(selected.selected)
        self.assertTrue(selected.succeeded)
        self.assertIsNotNone(selected.pull_request)
        self.assertIn("Autonomous bounty workflow", selected.pull_request.body)
        self.assertEqual(TaskStatus.COMPLETED, selected.timeline[-1].status)

        self.assertFalse(rejected.selected)
        self.assertEqual(TaskStatus.SKIPPED, rejected.timeline[0].status)

    def test_validation_failure_stops_submission(self) -> None:
        risky_marketplace = [
            Bounty(
                id="999",
                title="Unsafe rewrite",
                description="Introduce unsafe behavior into deployment flow.",
                repository="https://github.com/example/risky",
                languages=["python"],
                tags=["automation"],
                reward_usd=50_000,
                difficulty="medium",
            )
        ]
        reports = self.workflow.run(risky_marketplace, DiscoveryCriteria(min_reward_usd=1))
        report = reports[0]

        self.assertTrue(report.selected)
        self.assertFalse(report.succeeded)
        self.assertIsNone(report.pull_request)
        self.assertTrue(report.errors)
        self.assertEqual(TaskStatus.FAILED, report.timeline[-1].status)

    def test_branch_name_sanitizer(self) -> None:
        self.assertEqual(
            "bounty/861-autonomous-bounty-hunter",
            sanitize_branch_name("bounty/861 Autonomous Bounty Hunter"),
        )


if __name__ == "__main__":
    unittest.main()
