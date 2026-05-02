"""Integration tests for TeamOrchestrator."""
import unittest
from unittest.mock import patch
from bounty_agent.orchestrator import TeamOrchestrator
from bounty_agent.discovery import BountyIssue, BountyTier


class TestOrchestratorIntegration(unittest.TestCase):
    @patch("bounty_agent.discovery.BountyScanner.scan_all")
    @patch("bounty_agent.discovery.BountyScanner.get_bounty_detail")
    def test_full_pipeline(self, mock_detail, mock_scan):
        mock_bounty = BountyIssue("p", "r", 861, "Test", "1M FNDRY", tier=BountyTier.T3_STANDARD)
        mock_scan.return_value = [mock_bounty]
        mock_detail.return_value = mock_bounty
        orch = TeamOrchestrator()
        state = orch.start_mission("861")
        state = orch.run_pipeline(state)
        self.assertTrue(state.is_complete)

    def test_agent_init(self):
        orch = TeamOrchestrator()
        self.assertEqual(orch.get_team_status()["total_agents"], 19)


if __name__ == "__main__":
    unittest.main()
