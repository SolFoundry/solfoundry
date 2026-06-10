"""Tests for the SolFoundry Bounty Agent."""

import json
import unittest
from unittest.mock import patch, MagicMock


class TestBountyAgent(unittest.TestCase):
    """Test core agent functionality without making API calls."""

    def setUp(self):
        """Import agent module (after mocking environment)."""
        import importlib, os
        os.environ["GITHUB_TOKEN"] = "test_token"
        os.environ["SOLANA_WALLET"] = "test_wallet"
        self.agent = importlib.import_module("agent")

    def test_extract_reward_full(self):
        """Extract reward from a full format string."""
        body = "**Reward:** 100,000 $FNDRY | **Tier:** T1"
        self.assertEqual(self.agent._extract_reward(body), "100,000 $FNDRY")

    def test_extract_reward_k_format(self):
        """Extract reward from K-format string."""
        body = "**Reward:** 700K $FNDRY | **Tier:** T2"
        self.assertEqual(self.agent._extract_reward(body), "700K $FNDRY")

    def test_extract_reward_empty(self):
        """Return '?' when no reward found."""
        self.assertEqual(self.agent._extract_reward("No reward here"), "?")

    def test_extract_domain_frontend(self):
        """Extract domain from body."""
        body = "**Reward:** 100K $FNDRY | **Domain:** Frontend"
        self.assertEqual(self.agent._extract_domain(body), "Frontend")

    def test_extract_domain_backend(self):
        """Extract backend domain."""
        body = "**Reward:** 200K $FNDRY | **Domain:** Backend"
        self.assertEqual(self.agent._extract_domain(body), "Backend")

    def test_extract_domain_empty(self):
        """Return '?' when no domain found."""
        self.assertEqual(self.agent._extract_domain("No domain here"), "?")

    def test_reward_numeric_simple(self):
        """Parse simple numeric reward."""
        bounty = self.agent.Bounty(
            number=1, title="Test", body="", reward="100,000 $FNDRY",
            tier="T1", domain="Frontend", state="open",
            created_at="", updated_at="",
        )
        self.assertEqual(bounty.reward_numeric, 100000.0)

    def test_reward_numeric_k(self):
        """Parse K-suffixed reward."""
        bounty = self.agent.Bounty(
            number=2, title="Test 2", body="", reward="700K $FNDRY",
            tier="T2", domain="Agent", state="open",
            created_at="", updated_at="",
        )
        self.assertEqual(bounty.reward_numeric, 700000.0)

    def test_score_calculation(self):
        """Score = reward / (pr_count + 1)."""
        bounty = self.agent.Bounty(
            number=3, title="Test 3", body="", reward="100,000 $FNDRY",
            tier="T1", domain="Frontend", state="open",
            created_at="", updated_at="", pr_count=4,
        )
        # 100000 / (4 + 1) = 20000
        self.assertEqual(bounty.score, 20000.0)

    def test_score_no_competition(self):
        """Score with zero PRs."""
        bounty = self.agent.Bounty(
            number=4, title="Test 4", body="", reward="50,000 $FNDRY",
            tier="T1", domain="Docs", state="open",
            created_at="", updated_at="", pr_count=0,
        )
        # 50000 / (0 + 1) = 50000
        self.assertEqual(bounty.score, 50000.0)

    def test_fmt_large(self):
        """Format large numbers."""
        self.assertIn("1.5M", self.agent._fmt(1500000))

    def test_fmt_k(self):
        """Format K numbers."""
        self.assertIn("700K", self.agent._fmt(700000))

    def test_fmt_small(self):
        """Format small numbers."""
        self.assertIn("500", self.agent._fmt(500))

    def test_bounty_sorting(self):
        """Bounties should sort by score descending."""
        b1 = self.agent.Bounty(
            number=5, title="Low", body="", reward="50,000 $FNDRY",
            tier="T1", domain="Frontend", state="open",
            created_at="", updated_at="", pr_count=10,
        )
        b2 = self.agent.Bounty(
            number=6, title="High", body="", reward="100,000 $FNDRY",
            tier="T1", domain="Frontend", state="open",
            created_at="", updated_at="", pr_count=1,
        )
        bounties = [b1, b2]
        bounties.sort(key=lambda b: b.score, reverse=True)
        self.assertEqual(bounties[0].number, 6)  # Higher score first
        self.assertEqual(bounties[1].number, 5)

    def test_bounty_str(self):
        """Bounty string representation includes key fields."""
        bounty = self.agent.Bounty(
            number=7, title="Test Bounty", body="", reward="100K $FNDRY",
            tier="T1", domain="Backend", state="open",
            created_at="2026-01-01", updated_at="",
            pr_count=3,
        )
        self.assertIn("Test Bounty", str(bounty))
        self.assertIn("100K", str(bounty) or str(bounty.__dict__))


if __name__ == "__main__":
    unittest.main()
