#!/usr/bin/env python3
"""Tests for the SolFoundry post-bounty GitHub Action."""

import json
import os
import tempfile
import unittest
from unittest.mock import patch, MagicMock


class TestPostBountyAction(unittest.TestCase):
    """Test the post-bounty action logic."""

    def setUp(self):
        # Create a temporary event file
        self.event_dir = tempfile.mkdtemp()
        self.event_path = os.path.join(self.event_dir, "event.json")
        # Store original environ
        self._original_environ = os.environ.copy()

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self._original_environ)

    def _write_event(self, event_data: dict):
        with open(self.event_path, "w") as f:
            json.dump(event_data, f)

    def _set_env(self, **kwargs):
        for k, v in kwargs.items():
            os.environ[k] = str(v)

    def _run_main(self):
        """Execute the post-bounty main function."""
        script_path = os.path.join(os.path.dirname(__file__), "post-bounty.py")
        with open(script_path) as f:
            code = f.read()
        exec(compile(code, script_path, "exec"), {"__name__": "__main__"})

    def test_label_detection_t1(self):
        """Test that a bounty-t1 label is detected and API is called."""
        event = {
            "action": "labeled",
            "issue": {
                "number": 42,
                "title": "Fix login bug",
                "body": "Users can't log in with SSO",
                "html_url": "https://github.com/owner/repo/issues/42",
                "labels": [{"name": "bug"}, {"name": "bounty-t1"}],
            },
        }
        self._write_event(event)
        self._set_env(
            GITHUB_EVENT_PATH=self.event_path,
            GITHUB_EVENT_NAME="issues",
            GITHUB_REPOSITORY="owner/repo",
            GITHUB_OUTPUT=os.path.join(self.event_dir, "output.txt"),
            INPUT_SOLFOUNDRY_API_KEY="test-key-123",
            INPUT_BOUNTY_LABELS="bounty-t1,bounty-t2,bounty-t3",
            INPUT_REWARD_TIER_1="50000",
            INPUT_REWARD_TIER_2="500000",
            INPUT_REWARD_TIER_3="5000000",
        )

        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_response = MagicMock()
            mock_response.read.return_value = json.dumps({"id": "abc-123"}).encode()
            mock_response.__enter__.return_value = mock_response
            mock_urlopen.return_value = mock_response

            self._run_main()

            # Verify API was called
            mock_urlopen.assert_called_once()
            call_args = mock_urlopen.call_args
            request = call_args[0][0]
            body = json.loads(request.data)
            self.assertEqual(body["title"], "Fix login bug")
            self.assertEqual(body["tier"], 1)
            self.assertEqual(body["reward_amount"], 50000)
            self.assertEqual(
                body["github_issue_url"],
                "https://github.com/owner/repo/issues/42",
            )

    def test_label_detection_t2(self):
        """Test that a bounty-t2 label maps to tier 2."""
        event = {
            "action": "opened",
            "issue": {
                "number": 100,
                "title": "Add dark mode support",
                "body": "We need dark mode",
                "html_url": "https://github.com/owner/repo/issues/100",
                "labels": [{"name": "feature"}, {"name": "bounty-t2"}],
            },
        }
        self._write_event(event)
        self._set_env(
            GITHUB_EVENT_PATH=self.event_path,
            GITHUB_EVENT_NAME="issues",
            GITHUB_REPOSITORY="owner/repo",
            GITHUB_OUTPUT=os.path.join(self.event_dir, "output.txt"),
            INPUT_SOLFOUNDRY_API_KEY="test-key-123",
            INPUT_BOUNTY_LABELS="bounty-t1,bounty-t2,bounty-t3",
            INPUT_REWARD_TIER_1="50000",
            INPUT_REWARD_TIER_2="500000",
            INPUT_REWARD_TIER_3="5000000",
        )

        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_response = MagicMock()
            mock_response.read.return_value = json.dumps({"id": "def-456"}).encode()
            mock_response.__enter__.return_value = mock_response
            mock_urlopen.return_value = mock_response

            self._run_main()

            mock_urlopen.assert_called_once()
            request = mock_urlopen.call_args[0][0]
            body = json.loads(request.data)
            self.assertEqual(body["tier"], 2)
            self.assertEqual(body["reward_amount"], 500000)

    def test_no_bounty_label_skips(self):
        """Test that issues without bounty labels do NOT call the API."""
        event = {
            "action": "opened",
            "issue": {
                "number": 200,
                "title": "Regular bug report",
                "body": "Just a regular issue",
                "html_url": "https://github.com/owner/repo/issues/200",
                "labels": [{"name": "bug"}],
            },
        }
        self._write_event(event)
        self._set_env(
            GITHUB_EVENT_PATH=self.event_path,
            GITHUB_EVENT_NAME="issues",
            GITHUB_REPOSITORY="owner/repo",
            GITHUB_OUTPUT=os.path.join(self.event_dir, "output.txt"),
            INPUT_SOLFOUNDRY_API_KEY="test-key-123",
            INPUT_BOUNTY_LABELS="bounty-t1,bounty-t2,bounty-t3",
            INPUT_REWARD_TIER_1="50000",
            INPUT_REWARD_TIER_2="500000",
            INPUT_REWARD_TIER_3="5000000",
        )

        with patch("urllib.request.urlopen") as mock_urlopen:
            self._run_main()
            mock_urlopen.assert_not_called()

    def test_skipped_events(self):
        """Test that non-issue events are skipped."""
        event = {"action": "created", "issue": {"number": 1, "title": "test", "body": "test", "html_url": "http://example.com", "labels": []}}
        self._write_event(event)
        self._set_env(
            GITHUB_EVENT_PATH=self.event_path,
            GITHUB_EVENT_NAME="pull_request",
            GITHUB_REPOSITORY="owner/repo",
            GITHUB_OUTPUT=os.path.join(self.event_dir, "output.txt"),
            INPUT_SOLFOUNDRY_API_KEY="test-key-123",
            INPUT_BOUNTY_LABELS="bounty-t1,bounty-t2,bounty-t3",
            INPUT_REWARD_TIER_1="50000",
            INPUT_REWARD_TIER_2="500000",
            INPUT_REWARD_TIER_3="5000000",
        )

        with patch("urllib.request.urlopen") as mock_urlopen:
            self._run_main()
            mock_urlopen.assert_not_called()

    def test_custom_label_config(self):
        """Test that custom label names work."""
        event = {
            "action": "labeled",
            "issue": {
                "number": 300,
                "title": "Security audit needed",
                "body": "Need to audit the codebase",
                "html_url": "https://github.com/owner/repo/issues/300",
                "labels": [{"name": "security-bounty"}],
            },
        }
        self._write_event(event)
        self._set_env(
            GITHUB_EVENT_PATH=self.event_path,
            GITHUB_EVENT_NAME="issues",
            GITHUB_REPOSITORY="owner/repo",
            GITHUB_OUTPUT=os.path.join(self.event_dir, "output.txt"),
            INPUT_SOLFOUNDRY_API_KEY="test-key-123",
            INPUT_BOUNTY_LABELS="bug-bounty,feature-bounty,security-bounty",
            INPUT_REWARD_TIER_1="100000",
            INPUT_REWARD_TIER_2="1000000",
            INPUT_REWARD_TIER_3="10000000",
        )

        with patch("urllib.request.urlopen") as mock_urlopen:
            mock_response = MagicMock()
            mock_response.read.return_value = json.dumps({"id": "ghi-789"}).encode()
            mock_response.__enter__.return_value = mock_response
            mock_urlopen.return_value = mock_response

            self._run_main()

            mock_urlopen.assert_called_once()
            request = mock_urlopen.call_args[0][0]
            body = json.loads(request.data)
            self.assertEqual(body["tier"], 3)
            self.assertEqual(body["reward_amount"], 10000000)


if __name__ == "__main__":
    unittest.main()