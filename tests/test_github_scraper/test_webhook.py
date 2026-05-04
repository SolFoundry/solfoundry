"""Tests for the WebhookServer."""

import hmac
import hashlib
import json

from github_scraper.models.config import ScraperConfig
from github_scraper.services.webhook import WebhookServer


class TestWebhookServer:
    def setup_method(self):
        self.config = ScraperConfig(webhook_secret="test_secret")
        self.server = WebhookServer(self.config)
        self.received_issues = []
        self.server.on_issue(lambda issue: self.received_issues.append(issue))

    def _make_headers(self, event: str, payload: bytes) -> dict:
        sig = "sha256=" + hmac.new(
            b"test_secret", payload, hashlib.sha256
        ).hexdigest()
        return {
            "X-GitHub-Event": event,
            "X-Hub-Signature-256": sig,
        }

    def test_ping_event(self):
        payload = json.dumps({"zen": "test"}).encode()
        resp = self.server.handle_event(
            self._make_headers("ping", payload),
            payload,
        )
        assert resp["status"] == 200
        assert resp["message"] == "pong"

    def test_issues_opened_event(self):
        payload = {
            "action": "opened",
            "issue": {
                "number": 42,
                "title": "Test Bounty",
                "body": "Fix the thing",
                "state": "open",
                "labels": [{"name": "bounty"}],
                "user": {"login": "testuser"},
                "html_url": "https://github.com/test/repo/issues/42",
                "url": "https://api.github.com/repos/test/repo/issues/42",
            },
            "repository": {"full_name": "test/repo"},
        }
        body = json.dumps(payload).encode()
        resp = self.server.handle_event(self._make_headers("issues", body), body)
        assert resp["status"] == 200
        assert len(self.received_issues) == 1
        assert self.received_issues[0].title == "Test Bounty"

    def test_invalid_signature(self):
        resp = self.server.handle_event(
            {"X-GitHub-Event": "issues", "X-Hub-Signature-256": "sha256=invalid"},
            b'{"action": "opened"}',
        )
        assert resp["status"] == 401

    def test_ignored_action(self):
        payload = {"action": "assigned", "issue": {}, "repository": {}}
        body = json.dumps(payload).encode()
        resp = self.server.handle_event(
            self._make_headers("issues", body),
            body,
        )
        assert resp["status"] == 200
        assert "ignored" in resp["message"]

    def test_push_event(self):
        payload = {"ref": "refs/heads/main", "repository": {"full_name": "test/repo"}}
        body = json.dumps(payload).encode()
        resp = self.server.handle_event(self._make_headers("push", body), body)
        assert resp["status"] == 200
        assert "Re-scrape" in resp["message"]

    def test_no_secret_skips_verification(self):
        """When no webhook secret is configured, signature verification is skipped."""
        config = ScraperConfig(webhook_secret="")
        server = WebhookServer(config)
        resp = server.handle_event(
            {"X-GitHub-Event": "ping"},
            json.dumps({"zen": "test"}).encode(),
        )
        assert resp["status"] == 200
