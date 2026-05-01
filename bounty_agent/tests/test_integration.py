"""Integration tests for the full bounty agent pipeline."""
import json
import pytest
from unittest.mock import patch, MagicMock
from main_bounty_agent import AutonomousBountyAgent
from bounty_agent.discovery import BountyIssue
from bounty_agent.planner import Department


class TestIntegrationPipeline:
    """End-to-end integration tests."""

    @patch("bounty_agent.discovery.subprocess.run")
    def test_scan_and_plan(self, mock_run):
        """Test Phase 1 (discover) + Phase 2 (analyze) integration."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps([
                {
                    "repository": {"nameWithOwner": "SolFoundry/solfoundry"},
                    "title": "Bounty: GitHub Action",
                    "number": 855,
                    "labels": [{"name": "bounty"}, {"name": "tier-2"}],
                    "url": "https://github.com/SolFoundry/solfoundry/issues/855"
                },
                {
                    "repository": {"nameWithOwner": "SolFoundry/solfoundry"},
                    "title": "Bounty: Autonomous Agent",
                    "number": 861,
                    "labels": [{"name": "bounty"}, {"name": "tier-3"}],
                    "url": "https://github.com/SolFoundry/solfoundry/issues/861"
                }
            ])
        )
        agent = AutonomousBountyAgent()
        bounties = agent.discover(limit=10)
        assert len(bounties) >= 1

        plans = agent.analyze(bounties)
        assert len(plans) >= 1
        for plan in plans:
            assert len(plan.subtasks) >= 3

    def test_plan_and_execute(self):
        """Test Phase 2 (analyze) + Phase 3 (implement) integration."""
        agent = AutonomousBountyAgent()
        bounty = BountyIssue(
            platform="github", repo="test/repo",
            issue_number=1, title="Integration test bounty",
            reward="500K"
        )
        plan = agent.planner.plan(bounty)
        results = agent.orchestrator.execute_plan(plan)
        assert len(results) >= 3
        for r in results:
            assert r["status"] == "completed"

    def test_full_cycle_dry_run(self):
        """Test full autonomous cycle with mock scanning."""
        agent = AutonomousBountyAgent()
        status = agent.orchestrator.get_team_status()
        assert status["total_agents"] == 51
        assert status["idle"] == 51
        assert status["busy"] == 0

        # Simulate manual bounty injection
        bounty = BountyIssue(
            platform="github", repo="SolFoundry/solfoundry",
            issue_number=861, title="Autonomous Bounty-Hunting Agent",
            reward="1M", labels=["bounty", "tier-3"]
        )
        plan = agent.planner.plan(bounty)
        results = agent.orchestrator.execute_plan(plan)

        assert len(results) > 0
        final_status = agent.orchestrator.get_team_status()
        assert final_status["total_completed"] > 0

    def test_team_status_after_tasks(self):
        """Test team status updates after task assignment/completion."""
        agent = AutonomousBountyAgent()
        initial = agent.orchestrator.get_team_status()
        initial_idle = initial["idle"]

        # Assign some tasks
        agent.orchestrator.assign_task(Department.SECURITY)
        agent.orchestrator.assign_task(Department.RESEARCH)
        agent.orchestrator.assign_task(Department.CODE)

        after = agent.orchestrator.get_team_status()
        assert after["busy"] == 3
        assert after["idle"] == initial_idle - 3
