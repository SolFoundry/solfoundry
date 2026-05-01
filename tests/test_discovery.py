"""Unit tests for BountyScanner (discovery module)."""
import unittest
from unittest.mock import patch, MagicMock
from bounty_agent.discovery import BountyScanner

class TestBountyScanner(unittest.TestCase):
    def setUp(self):
        self.scanner = BountyScanner(gh_token="test_token")
    
    def test_init_with_token(self):
        self.assertEqual(self.scanner.gh_token, "test_token")
    
    def test_init_without_token(self):
        scanner = BountyScanner(gh_token="")
        self.assertEqual(scanner.gh_token, "")
    
    @patch("bounty_agent.discovery.subprocess.run")
    def test_scan_bounties_returns_list(self, mock_run):
        mock_result = MagicMock()
        mock_result.stdout = '[]'
        mock_run.return_value = mock_result
        result = self.scanner.scan_bounties(repo="test/repo")
        self.assertIsInstance(result, list)
    
    def test_priority_ranking_sorts_by_reward(self):
        bounties = [
            {"number": 1, "title": "Low", "labels": [{"name": "tier-1"}]},
            {"number": 2, "title": "High", "labels": [{"name": "tier-3"}]},
            {"number": 3, "title": "Mid", "labels": [{"name": "tier-2"}]},
        ]
        ranked = self.scanner.rank_by_priority(bounties)
        self.assertEqual(ranked[0]["title"], "High")
    
    def test_filter_by_tier(self):
        bounties = [
            {"number": 1, "labels": [{"name": "tier-1"}]},
            {"number": 2, "labels": [{"name": "tier-3"}]},
        ]
        t3_only = self.scanner.filter_by_tier(bounties, "tier-3")
        self.assertEqual(len(t3_only), 1)
        self.assertEqual(t3_only[0]["number"], 2)

if __name__ == "__main__":
    unittest.main()
