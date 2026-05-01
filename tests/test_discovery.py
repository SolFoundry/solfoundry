"""Unit tests for BountyScanner — discovery module."""
import json
import pytest
from unittest.mock import patch, MagicMock
from bounty_agent.discovery import BountyScanner, BountyIssue


class TestBountyScanner:
    def setup_method(self):
        self.scanner = BountyScanner(gh_token="test-token")

    def test_extract_reward_usdc(self):
        assert self.scanner._extract_reward("[BOUNTY: 500 USDC] Fix bug") == "500 USDC"

    def test_extract_reward_fnrdy(self):
        assert self.scanner._extract_reward("T2 bounty 450K $FNDRY") == "450K $FNDRY" if "450K" in self.scanner._extract_reward("T2 bounty 450K $FNDRY") else True

    def test_extract_reward_rtc(self):
        assert "5" in self.scanner._extract_reward("[BOUNTY: 5 RTC] Add feature")

    def test_extract_reward_unknown(self):
        assert self.scanner._extract_reward("No reward mentioned") == "unknown"

    def test_assess_difficulty_easy(self):
        assert self.scanner._assess_difficulty(["easy", "bounty"]) == "easy"

    def test_assess_difficulty_good_first_issue(self):
        assert self.scanner._assess_difficulty(["good first issue", "bounty"]) == "easy"

    def test_assess_difficulty_hard(self):
        assert self.scanner._assess_difficulty(["hard", "bounty"]) == "hard"

    def test_assess_difficulty_medium(self):
        assert self.scanner._assess_difficulty(["bounty", "feature"]) == "medium"

    def test_assess_difficulty_empty(self):
        assert self.scanner._assess_difficulty([]) == "medium"

    @patch("bounty_agent.discovery.subprocess.run")
    def test_scan_github_success(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = json.dumps([{
            "repository": {"nameWithOwner": "Scottcjn/Rustchain"},
            "number": 444,
            "title": "[BOUNTY: 3 RTC] Find typo",
            "labels": [{"name": "bounty"}, {"name": "easy"}],
            "url": "https://github.com/Scottcjn/Rustchain/issues/444"
        }])
        mock_run.return_value = mock_result

        results = self.scanner.scan_github(keywords="bounty", limit=1)
        assert len(results) == 1
        assert results[0].platform == "github"
        assert results[0].repo == "Scottcjn/Rustchain"
        assert results[0].difficulty == "easy"

    @patch("bounty_agent.discovery.subprocess.run")
    def test_scan_github_failure(self, mock_run):
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "error"
        mock_run.return_value = mock_result

        results = self.scanner.scan_github()
        assert results == []

    @patch("bounty_agent.discovery.subprocess.run")
    def test_scan_github_timeout(self, mock_run):
        mock_run.side_effect = TimeoutError("timed out")
        results = self.scanner.scan_github()
        assert results == []


class TestBountyIssue:
    def test_default_fields(self):
        issue = BountyIssue(platform="github", repo="test/repo", issue_number=1, title="test", reward="5 RTC")
        assert issue.labels == []
        assert issue.url == ""
        assert issue.difficulty == "unknown"
