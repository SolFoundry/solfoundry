"""Unit tests for bounty discovery module."""
import unittest
from bounty_agent.discovery import BountyScanner, BountyIssue, BountyTier, SolFoundryAdapter


class TestBountyIssue(unittest.TestCase):
    def test_creation(self):
        issue = BountyIssue(platform="github", repo="test/repo", issue_number=1, title="Test", reward="100 FNDRY")
        self.assertEqual(issue.platform, "github")

    def test_is_easy(self):
        easy = BountyIssue("p", "r", 1, "t", "100", tier=BountyTier.T3_STANDARD)
        self.assertTrue(easy.is_easy)

    def test_reward_amount(self):
        issue = BountyIssue("p", "r", 1, "t", "1,000,000 FNDRY")
        self.assertEqual(issue.reward_amount, 1000000.0)

    def test_competition_level(self):
        low = BountyIssue("p", "r", 1, "t", "100", existing_prs=0)
        self.assertEqual(low.competition_level, "low")


class TestSolFoundryAdapter(unittest.TestCase):
    def test_platform_name(self):
        self.assertEqual(SolFoundryAdapter().platform_name, "SolFoundry")

    def test_infer_tier(self):
        self.assertEqual(SolFoundryAdapter._infer_tier(["T1"], ""), BountyTier.T1_CRITICAL)


class TestBountyScanner(unittest.TestCase):
    def setUp(self):
        self.scanner = BountyScanner()

    def test_default_adapters(self):
        self.assertIn("solfoundry", self.scanner._adapters)

    def test_prioritize_easy_first(self):
        bounties = [
            BountyIssue("p", "r", 1, "Hard", "1M", tier=BountyTier.T1_CRITICAL),
            BountyIssue("p", "r", 2, "Easy", "100", tier=BountyTier.T3_STANDARD),
        ]
        result = self.scanner.prioritize(bounties, strategy="easy_first")
        self.assertEqual(result[0].tier, BountyTier.T3_STANDARD)

    def test_analyze_competition(self):
        bounty = BountyIssue("p", "r", 1, "t", "100", existing_prs=3)
        analysis = self.scanner.analyze_competition(bounty)
        self.assertEqual(analysis["competition_level"], "high")


if __name__ == "__main__":
    unittest.main()
