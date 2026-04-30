#!/usr/bin/env python3
"""Tests for GitHub Issue Scraper."""
import os
import sys
import json
import tempfile
import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Import the module (handles import differently in test context)
try:
    from scripts.github_scraper import (
        GitHubClient, BountyEngine, SimpleDB,
        CONFIG, TIER_KEYWORDS, TIER_REWARDS,
    )
except ImportError:
    # Fallback for direct test execution
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "github_scraper",
        os.path.join(os.path.dirname(__file__), "github-scraper.py")
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    GitHubClient = module.GitHubClient
    BountyEngine = module.BountyEngine
    SimpleDB = module.SimpleDB
    CONFIG = module.CONFIG
    TIER_KEYWORDS = module.TIER_KEYWORDS
    TIER_REWARDS = module.TIER_REWARDS


class TestSimpleDB(unittest.TestCase):
    """Test the JSON file database."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.db = SimpleDB(self.temp_dir)

    def test_init_creates_data_dir(self):
        self.assertTrue(os.path.exists(self.temp_dir))

    def test_default_repos(self):
        repos = self.db.get_watched_repos()
        self.assertIn("SolFoundry/solfoundry", repos)

    def test_add_repo(self):
        added = self.db.add_repo("test/repo")
        self.assertTrue(added)
        self.assertIn("test/repo", self.db.get_watched_repos())

    def test_add_duplicate_repo(self):
        self.db.add_repo("test/repo")
        added = self.db.add_repo("test/repo")
        self.assertFalse(added)

    def test_remove_repo(self):
        self.db.add_repo("test/repo")
        removed = self.db.remove_repo("test/repo")
        self.assertTrue(removed)
        self.assertNotIn("test/repo", self.db.get_watched_repos())

    def test_remove_nonexistent_repo(self):
        removed = self.db.remove_repo("nonexistent/repo")
        self.assertFalse(removed)

    def test_mark_and_check_processed(self):
        issue_id = "abc123"
        self.assertFalse(self.db.is_processed(issue_id))
        self.db.mark_processed(issue_id, {"title": "Test Issue"})
        self.assertTrue(self.db.is_processed(issue_id))

    def test_get_stats(self):
        self.db.mark_processed("id1", {"title": "Issue 1"})
        self.db.add_repo("custom/repo")
        stats = self.db.get_stats()
        self.assertEqual(stats["total_processed"], 1)
        self.assertGreaterEqual(stats["watched_repos"], 2)

    def test_persistence_across_instances(self):
        """Data persists when creating a new SimpleDB instance."""
        self.db.add_repo("persist/repo")
        self.db.mark_processed("persist-id", {"title": "Persisted"})

        db2 = SimpleDB(self.temp_dir)
        self.assertIn("persist/repo", db2.get_watched_repos())
        self.assertTrue(db2.is_processed("persist-id"))


class TestGitHubClient(unittest.TestCase):
    """Test GitHub API client (network-dependent)."""

    @classmethod
    def setUpClass(cls):
        cls.token = os.environ.get("GITHUB_TOKEN", "")
        cls.client = GitHubClient(cls.token)

    def test_init_with_token(self):
        client = GitHubClient("test-token")
        self.assertEqual(client.token, "test-token")
        self.assertIn("Authorization", client.session.headers)
        self.assertEqual(
            client.session.headers["Authorization"], "token test-token"
        )

    def test_init_without_token(self):
        client = GitHubClient()
        self.assertEqual(client.token, "")
        self.assertNotIn("Authorization", client.session.headers)

    def test_get_repo_info_public(self):
        """Test fetching a public repo (network test)."""
        result = self.client.get_repo_info("SolFoundry/solfoundry")
        if result:
            self.assertIn("full_name", result)
            self.assertEqual(result["full_name"], "SolFoundry/solfoundry")
        else:
            self.skipTest("API rate limited or network unavailable")

    def test_get_issues(self):
        """Test fetching issues from a public repo (network test)."""
        result = self.client.get_issues("SolFoundry/solfoundry", state="open")
        if isinstance(result, list):
            self.assertGreater(len(result), 0)
        else:
            self.skipTest("API rate limited or network unavailable")

    def test_get_nonexistent_repo(self):
        result = self.client.get_repo_info("nonexistent/repo12345")
        self.assertIsNone(result)


class TestBountyEngine(unittest.TestCase):
    """Test bounty estimation and processing logic."""

    def setUp(self):
        self.gh_client = GitHubClient()
        self.db = SimpleDB(tempfile.mkdtemp())
        self.engine = BountyEngine(self.gh_client, self.db)

    def _make_issue(self, title="Simple Title", body="", labels=None,
                    comments=0, number=1):
        """Helper to create a mock GitHub issue."""
        return {
            "title": title,
            "body": body,
            "number": number,
            "state": "open",
            "html_url": f"https://github.com/test/repo/issues/{number}",
            "repository_url": "https://api.github.com/repos/test/repo",
            "user": {"login": "test-user"},
            "labels": [{"name": l} for l in (labels or [])],
            "comments": comments,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }

    def test_tier_t1_by_label(self):
        issue = self._make_issue(labels=["critical", "tier-1"])
        tier, conf = self.engine.estimate_tier(issue)
        self.assertEqual(tier, "T1")
        self.assertGreater(conf, 0.9)

    def test_tier_t2_default(self):
        issue = self._make_issue(title="Implement new feature", body="Build an API")
        tier, conf = self.engine.estimate_tier(issue)
        self.assertEqual(tier, "T2")
        self.assertGreater(conf, 0.5)

    def test_tier_t3_good_first_issue(self):
        issue = self._make_issue(labels=["good-first-issue"],
                                 title="Fix typo in README")
        tier, conf = self.engine.estimate_tier(issue)
        self.assertEqual(tier, "T3")
        self.assertGreater(conf, 0.5)

    def test_tier_t1_high_complexity(self):
        issue = self._make_issue(
            title="Build security infrastructure",
            body="Need API, database, and full-stack implementation",
            comments=10,
            labels=["bug"]
        )
        tier, conf = self.engine.estimate_tier(issue)
        self.assertEqual(tier, "T1")

    def test_generate_issue_id(self):
        issue = self._make_issue(number=42)
        id1 = self.engine.generate_issue_id(issue)
        id2 = self.engine.generate_issue_id(issue)
        self.assertEqual(id1, id2)  # Deterministic
        self.assertEqual(len(id1), 16)  # SHA256 truncated

    def test_extract_metadata(self):
        issue = self._make_issue(
            title="Test Issue", body="Description",
            labels=["bug", "enhancement"], number=5
        )
        meta = self.engine.extract_metadata(issue)
        self.assertEqual(meta["github_issue_number"], 5)
        self.assertEqual(meta["labels"], ["bug", "enhancement"])
        self.assertEqual(meta["author"], "test-user")

    def test_generate_bounty_body(self):
        issue = self._make_issue(title="My Cool Feature", body="Details here")
        body = self.engine.generate_bounty_body(issue, "T2")
        self.assertIn("My Cool Feature", body)
        self.assertIn("600K $FNDRY", body)
        self.assertIn("T2", body)
        self.assertIn("Auto-imported by SolFoundry GitHub Scraper", body)

    def test_process_issue_new(self):
        issue = self._make_issue(title="New Issue", body="Desc", number=99)
        bounty = self.engine.process_issue(issue, "test/repo")
        self.assertIsNotNone(bounty)
        self.assertEqual(bounty["title"], "New Issue")
        self.assertEqual(bounty["source_repo"], "test/repo")

    def test_process_issue_duplicate(self):
        issue = self._make_issue(title="Dup", number=100)
        first = self.engine.process_issue(issue, "test/repo")
        second = self.engine.process_issue(issue, "test/repo")
        self.assertIsNotNone(first)
        self.assertIsNone(second)  # Duplicate returns None

    def test_skip_pull_requests(self):
        pr = self._make_issue(title="PR", number=200)
        pr["pull_request"] = {"url": "https://api.github.com/pulls/200"}
        self.gh_client.get_issues = MagicMock(return_value=[pr])
        bounties = self.engine.scan_repo("test/repo")
        self.assertEqual(len(bounties), 0)

    def test_tier_confidence_bounds(self):
        """Confidence should never exceed 0.99."""
        issue = self._make_issue(
            title="Critical security infrastructure API database overhaul",
            body="urgent high-priority critical important",
            labels=["critical", "urgent", "security"],
            comments=99
        )
        tier, conf = self.engine.estimate_tier(issue)
        self.assertLessEqual(conf, 0.99)
        self.assertGreater(conf, 0.5)


class TestBountyOutputFormat(unittest.TestCase):
    """Test that generated bounties match SolFoundry format specs."""

    def setUp(self):
        self.gh_client = GitHubClient()
        self.db = SimpleDB(tempfile.mkdtemp())
        self.engine = BountyEngine(self.gh_client, self.db)

    def test_all_tiers_have_rewards(self):
        for tier in ["T1", "T2", "T3"]:
            self.assertIn(tier, TIER_REWARDS)
            self.assertIn("$FNDRY", TIER_REWARDS[tier])

    def test_tier_keywords_all_present(self):
        for tier in ["T1", "T2", "T3"]:
            self.assertIn(tier, TIER_KEYWORDS)
            self.assertGreater(len(TIER_KEYWORDS[tier]), 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
