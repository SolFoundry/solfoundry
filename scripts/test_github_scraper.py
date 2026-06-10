"""Tests for the GitHub Issue Scraper."""

import json
import os
import unittest
from unittest.mock import patch, MagicMock


class TestGitHubScraper(unittest.TestCase):
    """Test core scraper functionality."""

    def setUp(self):
        os.environ["GITHUB_TOKEN"] = "test_token"
        import importlib
        self.scraper = importlib.import_module("github-scraper")

    def test_estimate_tier_bounty_label(self):
        """Issues with 'bounty' label should be T1."""
        self.assertEqual(self.scraper._estimate_tier(["bug", "bounty"], ""), "T1")

    def test_estimate_tier_expert_label(self):
        """Issues with 'expert' label should be T2."""
        self.assertEqual(self.scraper._estimate_tier(["expert"], ""), "T2")

    def test_estimate_tier_unknown(self):
        """Unknown labels should default to T1."""
        self.assertEqual(self.scraper._estimate_tier(["bug"], ""), "T1")

    def test_estimate_tier_body_expert_keyword(self):
        """Body containing 'complex' should be T2."""
        result = self.scraper._estimate_tier([], "This is a complex multi-step task")
        self.assertEqual(result, "T2")

    def test_estimate_tier_body_easy_keyword(self):
        """Body containing 'quick' should be T1."""
        result = self.scraper._estimate_tier([], "A quick fix")
        self.assertEqual(result, "T1")

    def test_estimate_reward_with_amount(self):
        """Should extract dollar amount from body."""
        result = self.scraper._estimate_reward("T1", [], "Bounty: $500")
        self.assertIn("$500", result)

    def test_estimate_reward_t1_default(self):
        """T1 should have default range."""
        result = self.scraper._estimate_reward("T1", [], "No amount mentioned")
        self.assertIn("100", result)

    def test_estimate_reward_t2_default(self):
        """T2 should have higher default range."""
        result = self.scraper._estimate_reward("T2", [], "No amount mentioned")
        self.assertIn("400", result)

    def test_estimate_reward_t3_default(self):
        """T3 should have highest default range."""
        result = self.scraper._estimate_reward("T3", [], "No amount mentioned")
        self.assertIn("1M", result)

    def test_dedup_key(self):
        """Dedup key should combine repo and issue number."""
        issue = self.scraper.ScrapedIssue(
            repo="owner/repo", number=42, title="Test",
            body="", html_url="", labels=[], state="open",
            created_at="", updated_at="", comments=0,
        )
        self.assertEqual(self.scraper._dedup_key(issue), "owner/repo#42")

    def test_scan_repo_empty_response(self):
        """Should handle empty API response gracefully."""
        with patch.object(self.scraper, "_api", return_value={"items": []}):
            issues = self.scraper.scan_repo("test/repo")
            self.assertEqual(len(issues), 0)

    def test_scan_repo_with_items(self):
        """Should parse API items into ScrapedIssue objects."""
        mock_response = {
            "items": [{
                "number": 1,
                "title": "Test Issue",
                "body": "Fix this bug",
                "html_url": "https://github.com/test/repo/issues/1",
                "labels": [{"name": "bug"}, {"name": "bounty"}],
                "state": "open",
                "created_at": "2026-01-01",
                "updated_at": "2026-06-01",
                "comments": 3,
            }]
        }
        with patch.object(self.scraper, "_api", return_value=mock_response):
            issues = self.scraper.scan_repo("test/repo")
            self.assertEqual(len(issues), 1)
            self.assertEqual(issues[0].number, 1)
            self.assertEqual(issues[0].title, "Test Issue")
            self.assertEqual(issues[0].tier, "T1")  # Has 'bounty' label

    def test_post_bounty_dry_run(self):
        """Dry run should not call the API."""
        issue = self.scraper.ScrapedIssue(
            repo="test/repo", number=1, title="Test",
            body="", html_url="", labels=[], state="open",
            created_at="", updated_at="", comments=0,
        )
        with patch.object(self.scraper, "_api", return_value={}):
            result = self.scraper.post_bounty(issue, "http://api.test", dry_run=True)
            self.assertTrue(result)

    def test_tier_map_completeness(self):
        """All TIER_MAP labels should be lowercase."""
        for label in self.scraper.TIER_MAP:
            self.assertEqual(label, label.lower(), f"Label '{label}' should be lowercase")

    def test_default_repos_not_empty(self):
        """Should have at least one default repo."""
        self.assertGreater(len(self.scraper.DEFAULT_REPOS), 0)


if __name__ == "__main__":
    unittest.main()
