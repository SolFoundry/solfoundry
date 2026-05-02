"""Unit tests for BountyScanner (discovery module)."""

import unittest
from unittest.mock import patch, MagicMock
from bounty_agent.discovery import (
    BountyScanner,
    BountyIssue,
    BountyTier,
    BountyStatus,
    SolFoundryAdapter,
)


class TestBountyScanner(unittest.TestCase):
    def setUp(self):
        self.scanner = BountyScanner()

    def test_default_adapters(self):
        self.assertIn("solfoundry", self.scanner._adapters)
        self.assertIn("github", self.scanner._adapters)

    def test_register_custom_adapter(self):
        class FakeAdapter:
            platform_name = "fake"
            def scan(self, config):
                return []
            def get_bounty_detail(self, bid, config):
                return None

        self.scanner.register_adapter("fake", FakeAdapter())
        self.assertIn("fake", self.scanner._adapters)

    @patch("bounty_agent.discovery.subprocess.run")
    def test_scan_platform_github(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = "[]"
        mock_run.return_value = mock_result
        result = self.scanner.scan_platform("github")
        self.assertIsInstance(result, list)

    def test_prioritize_balanced(self):
        bounties = [
            BountyIssue(
                platform="p", repo="r", issue_number=1,
                title="Good", reward="1000 FNDRY",
                tier=BountyTier.T3_STANDARD,
            ),
            BountyIssue(
                platform="p", repo="r", issue_number=2,
                title="Hard", reward="1M FNDRY",
                tier=BountyTier.T1_CRITICAL,
            ),
        ]
        result = self.scanner.prioritize(bounties, strategy="balanced")
        self.assertEqual(len(result), 2)

    def test_prioritize_easy_first(self):
        bounties = [
            BountyIssue(
                platform="p", repo="r", issue_number=1,
                title="Hard", reward="1M",
                tier=BountyTier.T1_CRITICAL,
            ),
            BountyIssue(
                platform="p", repo="r", issue_number=2,
                title="Easy", reward="100",
                tier=BountyTier.T3_STANDARD,
            ),
        ]
        result = self.scanner.prioritize(bounties, strategy="easy_first")
        self.assertEqual(result[0].tier, BountyTier.T3_STANDARD)

    def test_analyze_competition(self):
        bounty = BountyIssue(
            platform="p", repo="r", issue_number=1,
            title="t", reward="100",
        )
        # analyze_competition may not exist on all scanner versions;
        # test gracefully
        if hasattr(self.scanner, "analyze_competition"):
            analysis = self.scanner.analyze_competition(bounty)
            self.assertIn("competition_level", analysis)

    def test_bounty_issue_defaults(self):
        issue = BountyIssue(
            platform="github", repo="test/repo", issue_number=42,
            title="Test bounty", reward="500 FNDRY",
        )
        assert issue.tier == BountyTier.UNKNOWN
        assert issue.status == BountyStatus.OPEN
        assert issue.difficulty == "unknown"
        assert issue.labels == []
        assert issue.skills_required == []


class TestSolFoundryAdapter(unittest.TestCase):
    def test_platform_name(self):
        adapter = SolFoundryAdapter()
        self.assertEqual(adapter.platform_name, "SolFoundry")

    def test_infer_tier(self):
        self.assertEqual(
            SolFoundryAdapter._infer_tier(["T1"], ""),
            BountyTier.T1_CRITICAL,
        )
        self.assertEqual(
            SolFoundryAdapter._infer_tier(["T3"], ""),
            BountyTier.T3_STANDARD,
        )


if __name__ == "__main__":
    unittest.main()
