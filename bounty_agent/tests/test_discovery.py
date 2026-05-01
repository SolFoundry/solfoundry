"""Unit tests for bounty discovery module."""
import json
import pytest
from unittest.mock import patch, MagicMock
from bounty_agent.discovery import BountyScanner, BountyIssue


class TestBountyIssue:
    """Tests for BountyIssue dataclass."""

    def test_creation_defaults(self):
        issue = BountyIssue(
            platform="github", repo="SolFoundry/solfoundry",
            issue_number=855, title="GitHub Action for External Repos",
            reward="500K"
        )
        assert issue.platform == "github"
        assert issue.difficulty == "unknown"
        assert issue.labels == []
        assert issue.url == ""

    def test_is_easy_property(self):
        easy_issue = BountyIssue(
            platform="github", repo="test/repo",
            issue_number=1, title="Fix typo", reward="100",
            difficulty="easy"
        )
        hard_issue = BountyIssue(
            platform="github", repo="test/repo",
            issue_number=2, title="Rewrite engine", reward="1M",
            difficulty="hard"
        )
        assert easy_issue.is_easy is True
        assert hard_issue.is_easy is False


class TestBountyScanner:
    """Tests for BountyScanner."""

    def setup_method(self):
        self.scanner = BountyScanner(gh_token="fake_token")

    def test_scan_github_no_token(self):
        scanner = BountyScanner(gh_token="")
        result = scanner.scan_github(limit=5)
        assert isinstance(result, list)

    @patch("bounty_agent.discovery.subprocess.run")
    def test_scan_github_success(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps([{
                "repository": {"nameWithOwner": "SolFoundry/solfoundry"},
                "title": "Bounty: Add feature X",
                "number": 855,
                "labels": [{"name": "bounty"}, {"name": "tier-2"}],
                "url": "https://github.com/SolFoundry/solfoundry/issues/855"
            }])
        )
        results = self.scanner.scan_github(limit=1)
        assert len(results) == 1
        assert results[0].repo == "SolFoundry/solfoundry"
        assert results[0].issue_number == 855

    @patch("bounty_agent.discovery.subprocess.run")
    def test_scan_github_timeout(self, mock_run):
        mock_run.side_effect = TimeoutError("gh CLI timeout")
        results = self.scanner.scan_github(limit=5)
        assert results == []

    @patch("bounty_agent.discovery.subprocess.run")
    def test_scan_github_error(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stderr="rate limited")
        results = self.scanner.scan_github(limit=5)
        assert results == []

    def test_extract_reward(self):
        assert self.scanner._extract_reward("Bounty worth 500K $FNDRY") == "500K $FNDRY"
        assert self.scanner._extract_reward("No reward here") == "unknown"
        result = self.scanner._extract_reward("Bounty #855 - $250 USD")
        assert "250" in result and "USD" in result

    def test_assess_difficulty(self):
        assert self.scanner._assess_difficulty(["bounty", "tier-1"]) == "easy"
        assert self.scanner._assess_difficulty(["bounty", "tier-2"]) == "medium"
        assert self.scanner._assess_difficulty(["bounty", "tier-3"]) == "hard"
        assert self.scanner._assess_difficulty(["bounty"]) == "unknown"

    def test_prioritize(self):
        bounties = [
            BountyIssue("github", "r1", 1, "Hard task", "1M", ["tier-3"], difficulty="hard"),
            BountyIssue("github", "r2", 2, "Easy fix", "100", ["tier-1"], difficulty="easy"),
            BountyIssue("github", "r3", 3, "Medium", "500K", ["tier-2"], difficulty="medium"),
        ]
        prioritized = self.scanner.prioritize(bounties)
        assert prioritized[0].difficulty == "easy"
        assert prioritized[-1].difficulty == "hard"
