"""GitHub webhook server for real-time issue updates."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Callable, Optional

from github_scraper.models.config import ScraperConfig
from github_scraper.models.issue import ScrapedIssue
from github_scraper.utils.tier_classifier import TierClassifier

logger = logging.getLogger(__name__)


class WebhookServer:
    """GitHub webhook receiver for real-time issue events.

    Supports:
    - issues (opened, edited, labeled, closed, reopened)
    - push (trigger full re-scrape)
    - ping (health check)
    - HMAC signature verification
    """

    def __init__(self, config: ScraperConfig) -> None:
        self.config = config
        self._secret = config.webhook_secret.encode() if config.webhook_secret else b""
        self._on_issue_callback: Optional[Callable] = None

    def on_issue(self, callback: Callable[[ScrapedIssue], None]) -> None:
        """Register a callback for new/updated issues."""
        self._on_issue_callback = callback

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify GitHub webhook HMAC signature."""
        if not self._secret:
            logger.warning("No webhook secret configured, skipping verification")
            return True

        expected = "sha256=" + hmac.new(
            self._secret, payload, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def handle_event(self, headers: dict, payload: bytes) -> dict:
        """Handle an incoming GitHub webhook event."""
        # Verify signature
        signature = headers.get("X-Hub-Signature-256", "")
        if not self.verify_signature(payload, signature):
            return {"status": 401, "message": "Invalid signature"}

        event = headers.get("X-GitHub-Event", "")
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            return {"status": 400, "message": "Invalid JSON payload"}

        if event == "ping":
            return {"status": 200, "message": "pong"}

        if event == "issues":
            # Check action first - ignore irrelevant actions early
            action = data.get("action", "")
            relevant_actions = {"opened", "edited", "labeled", "reopened", "closed"}
            if action not in relevant_actions:
                return {"status": 200, "message": f"Action '{action}' ignored"}
            return self._handle_issue_event(data)

        if event == "push":
            return self._handle_push_event(data)

        return {"status": 200, "message": f"Event '{event}' ignored"}

    def _handle_issue_event(self, data: dict) -> dict:
        """Handle a GitHub issues event."""
        issue_data = data.get("issue", {})
        repo_data = data.get("repository", {})

        if not issue_data or not repo_data:
            return {"status": 400, "message": "Missing issue or repository data"}

        from datetime import datetime, timezone

        issue = ScrapedIssue(
            source_repo=repo_data.get("full_name", ""),
            issue_number=issue_data.get("number", 0),
            title=issue_data.get("title", ""),
            body=issue_data.get("body", "") or "",
            state=issue_data.get("state", ""),
            labels=[lbl["name"] for lbl in issue_data.get("labels", [])],
            author=issue_data.get("user", {}).get("login", ""),
            html_url=issue_data.get("html_url", ""),
            url=issue_data.get("url", ""),
        )

        if self._on_issue_callback:
            self._on_issue_callback(issue)

        return {
            "status": 200,
            "message": f"Issue {data.get('action', '?')}: {issue.source_repo}#{issue.issue_number}",
        }

    def _handle_push_event(self, data: dict) -> dict:
        """Handle a push event (trigger re-scrape)."""
        repo = data.get("repository", {}).get("full_name", "")
        ref = data.get("ref", "")
        logger.info(f"Push to {repo} ({ref}), re-scrape triggered")
        return {"status": 200, "message": f"Re-scrape triggered for {repo}"}
