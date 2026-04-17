"""GitHub webhook handler — validates HMAC and processes events."""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Optional

from app.models import GitHubIssue, RepoConfig, WebhookEvent

logger = logging.getLogger(__name__)


class WebhookHandler:
    """Handles incoming GitHub webhook events."""

    def __init__(self, webhook_secret: str = ""):
        self.webhook_secret = webhook_secret

    def verify_signature(self, payload: bytes, signature: str) -> bool:
        """Verify the HMAC-SHA256 signature of a GitHub webhook payload.

        GitHub sends the signature in the X-Hub-Signature-256 header as
        `sha256=<hex_digest>`.
        """
        if not self.webhook_secret:
            logger.warning("No webhook secret configured — skipping verification")
            return True

        if not signature:
            return False

        expected = "sha256=" + hmac.new(
            self.webhook_secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected, signature)

    def parse_event(self, payload: dict) -> Optional[WebhookEvent]:
        """Parse a GitHub webhook payload into a WebhookEvent.

        Handles: issues, label, milestone events.
        """
        action = payload.get("action", "")
        repository = payload.get("repository", {})
        repo_owner = repository.get("owner", {}).get("login", "")
        repo_name = repository.get("name", "")

        if not repo_owner or not repo_name:
            logger.warning("Webhook missing repository info")
            return None

        issue_data = payload.get("issue")
        issue: Optional[GitHubIssue] = None

        if issue_data and "pull_request" not in issue_data:
            labels = [
                lbl.get("name", "") if isinstance(lbl, dict) else str(lbl)
                for lbl in issue_data.get("labels", [])
            ]
            issue = GitHubIssue(
                number=issue_data["number"],
                title=issue_data.get("title", ""),
                body=issue_data.get("body") or "",
                state=issue_data.get("state", "open"),
                labels=labels,
                html_url=issue_data.get("html_url", ""),
                created_at=issue_data.get("created_at", ""),
                updated_at=issue_data.get("updated_at", ""),
                milestone=(
                    issue_data.get("milestone", {}).get("title")
                    if issue_data.get("milestone")
                    else None
                ),
                assignees=[
                    a.get("login", "")
                    for a in issue_data.get("assignees", [])
                ],
            )

        return WebhookEvent(
            action=action,
            repo_owner=repo_owner,
            repo_name=repo_name,
            issue=issue,
        )