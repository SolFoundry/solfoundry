"""Integration tests for TeamOrchestrator (full pipeline)."""

import unittest
from unittest.mock import patch, MagicMock
from bounty_agent.orchestrator import (
    TeamOrchestrator,
    MissionStage,
    MissionState,
    AgentStatus,
)
from bounty_agent.discovery import BountyIssue, BountyTier, BountyStatus


class TestOrchestratorIntegration(unittest.TestCase):
    """Integration tests for the full bounty pipeline."""

    def _create_mock_bounty(self):
        """Create a mock bounty for testing."""
        return BountyIssue(
            platform="SolFoundry",
            repo="SolFoundry/solfoundry",
            issue_number=861,
            title="[T3] Autonomous Bounty-Hunting Agent 1M $FNDRY",
            reward="1000000 FNDRY",
            tier=BountyTier.T3_STANDARD,
            status=BountyStatus.OPEN,
            labels=["bounty", "T3", "agent"],
            url="https://github.com/SolFoundry/solfoundry/issues/861",
            difficulty="easy",
        )

    @patch("bounty_agent.discovery.BountyScanner")
    def test_full_pipeline_discover_to_complete(self, MockScannerClass):
        """Test full pipeline from discover to completion."""
        mock_bounty = self._create_mock_bounty()
        mock_scanner = MagicMock()
        mock_scanner.scan_all.return_value = [mock_bounty]
        mock_scanner.prioritize.return_value = [mock_bounty]
        mock_scanner.get_bounty_detail.return_value = mock_bounty
        MockScannerClass.return_value = mock_scanner

        orch = TeamOrchestrator()
        state = orch.start_mission("861")
        state = orch.run_pipeline(state)
        self.assertTrue(state.is_complete)
        self.assertFalse(state.is_failed)
        self.assertEqual(
            len(state.stage_results),
            5,
            "All 5 stages should have results",
        )

    @patch("bounty_agent.discovery.BountyScanner")
    def test_discover_stage_produces_results(self, MockScannerClass):
        """Test that discover stage finds bounties."""
        mock_bounty = self._create_mock_bounty()
        mock_scanner = MagicMock()
        mock_scanner.scan_all.return_value = [mock_bounty]
        mock_scanner.prioritize.return_value = [mock_bounty]
        mock_scanner.get_bounty_detail.return_value = mock_bounty
        MockScannerClass.return_value = mock_scanner

        orch = TeamOrchestrator()
        state = orch.start_mission("861")
        result = orch.run_stage(state, MissionStage.DISCOVER)
        self.assertEqual(result.status, "success")
        self.assertIn("total_discovered", result.output)

    def test_agent_initialization(self):
        """Test orchestrator initializes agents correctly."""
        orch = TeamOrchestrator()
        status = orch.get_team_status()
        self.assertEqual(status["total_agents"], 19)
        self.assertIn("by_department", status)
        self.assertEqual(status["idle"], 19)

    def test_mission_state_tracking(self):
        """Test mission state is properly tracked."""
        orch = TeamOrchestrator()
        state = orch.start_mission("861")
        self.assertTrue(state.is_active)
        self.assertEqual(state.bounty_id, "861")
        self.assertEqual(state.current_stage, MissionStage.DISCOVER)

    def test_get_active_missions(self):
        """Test active mission tracking."""
        orch = TeamOrchestrator()
        state = orch.start_mission("861")
        active = orch.get_active_missions()
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0].mission_id, state.mission_id)


if __name__ == "__main__":
    unittest.main()
