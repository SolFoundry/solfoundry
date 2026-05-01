"""Unit tests for PR submitter module."""
import pytest
from unittest.mock import patch, MagicMock
from bounty_agent.submitter import PRSubmitter


class TestPRSubmitter:
    """Tests for PRSubmitter."""

    def setup_method(self):
        self.submitter = PRSubmitter()

    @patch("bounty_agent.submitter.subprocess.run")
    def test_submit_pr_success(self, mock_run):
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="https://github.com/SolFoundry/solfoundry/pull/123"
        )
        result = self.submitter.submit_pr(
            repo="SolFoundry/solfoundry",
            branch="feat/new-feature",
            title="feat: new feature",
            body="Description"
        )
        assert result is not None
        assert "pull/123" in result

    @patch("bounty_agent.submitter.subprocess.run")
    def test_submit_pr_failure(self, mock_run):
        mock_run.return_value = MagicMock(returncode=1, stderr="error")
        result = self.submitter.submit_pr(
            repo="test/repo", branch="main",
            title="test", body="test"
        )
        assert result is None

    @patch("bounty_agent.submitter.subprocess.run")
    def test_submit_pr_timeout(self, mock_run):
        mock_run.side_effect = TimeoutError("timeout")
        result = self.submitter.submit_pr(
            repo="test/repo", branch="main",
            title="test", body="test"
        )
        assert result is None

    def test_format_pr_body(self):
        body = PRSubmitter.format_pr_body(
            bounty_issue=855,
            approach="Multi-agent architecture with 51 agents",
            implementation="Discovery → Planning → Execution → Submission pipeline",
            testing="Unit tests + integration tests + dry-run demo"
        )
        assert "#855" in body
        assert "Multi-LLM Review" in body
        assert "51 agents" in body
