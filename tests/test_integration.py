"""Integration tests for TeamOrchestrator (full pipeline)."""
import unittest
from unittest.mock import patch
from bounty_agent.orchestrator import TeamOrchestrator

class TestTeamOrchestratorIntegration(unittest.TestCase):
    @patch("bounty_agent.discovery.BountyScanner.scan_bounties")
    @patch("bounty_agent.planner.BountyPlanner.decompose")
    @patch("bounty_agent.submitter.PRSubmitter.submit_pr")
    def test_full_pipeline_discover_to_submit(self, mock_submit, mock_decompose, mock_scan):
        # Mock discovery
        mock_scan.return_value = [
            {"number": 1, "title": "Test Bounty", "labels": [{"name": "tier-2"}]}
        ]
        # Mock planning
        mock_decompose.return_value = [
            {"title": "Implement feature", "department": "implementation"}
        ]
        # Mock submission
        mock_submit.return_value = {"pr_number": 42, "status": "created"}
        
        agent = TeamOrchestrator(gh_token="test_token")
        result = agent.run(repo="test/repo", max_bounties=1)
        
        self.assertIsNotNone(result)
        mock_scan.assert_called_once()
        mock_submit.assert_called_once()
    
    def test_agent_initialization(self):
        agent = TeamOrchestrator(gh_token="test_token")
        self.assertIsNotNone(agent.scanner)
        self.assertIsNotNone(agent.planner)
        self.assertIsNotNone(agent.submitter)

if __name__ == "__main__":
    unittest.main()
