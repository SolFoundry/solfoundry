"""GitHub event receiver for the real-time event indexer.

Processes GitHub webhook payloads (PR events, issue events, review events)
and converts them into normalized indexed events for storage and analytics.

This service works alongside the existing webhook processor (which handles
bounty status transitions) by focusing on event indexing for the analytics
pipeline.  It does NOT duplicate the bounty lifecycle logic.

Architecture:
    GitHub Webhook → WebhookProcessor (bounty logic)
                   → GitHubEventReceiver (indexer ingestion)
"""

import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.models.indexer_event import (
    EventSource,
    IndexedEventCategory,
    IndexedEventCreate,
)

logger = logging.getLogger(__name__)


def process_pull_request_event(
    action: str,
    pr_data: Dict[str, Any],
    repository: str,
    sender: str,
) -> Optional[IndexedEventCreate]:
    """Convert a GitHub pull_request webhook event into an indexed event.

    Maps PR actions to event categories:
    - opened → PR_OPENED
    - closed + merged → PR_MERGED
    - closed + not merged → PR_CLOSED

    Args:
        action: The PR action (opened, closed, synchronize, etc.).
        pr_data: The pull_request object from the webhook payload.
        repository: Full repository name (e.g., 'SolFoundry/solfoundry').
        sender: GitHub username of the actor.

    Returns:
        An IndexedEventCreate if the action is relevant, else None.
    """
    pr_number = pr_data.get("number", 0)
    pr_title = pr_data.get("title", "Unknown PR")
    pr_url = pr_data.get("html_url", "")
    pr_body = pr_data.get("body") or ""
    merged = pr_data.get("merged", False)

    # Extract linked bounty number from PR body
    bounty_number = _extract_bounty_number(pr_body)
    bounty_id = f"gh-{bounty_number}" if bounty_number else None

    if action == "opened":
        return IndexedEventCreate(
            source=EventSource.GITHUB,
            category=IndexedEventCategory.PR_OPENED,
            title=f"PR #{pr_number} opened: {pr_title}",
            description=f"{sender} opened PR #{pr_number} in {repository}",
            contributor_username=sender,
            bounty_id=bounty_id,
            bounty_number=bounty_number,
            github_url=pr_url,
            payload={
                "pr_number": pr_number,
                "repository": repository,
                "action": action,
                "pr_title": pr_title,
            },
        )

    elif action == "closed":
        if merged:
            return IndexedEventCreate(
                source=EventSource.GITHUB,
                category=IndexedEventCategory.PR_MERGED,
                title=f"PR #{pr_number} merged: {pr_title}",
                description=f"{sender}'s PR #{pr_number} was merged in {repository}",
                contributor_username=sender,
                bounty_id=bounty_id,
                bounty_number=bounty_number,
                github_url=pr_url,
                payload={
                    "pr_number": pr_number,
                    "repository": repository,
                    "action": "merged",
                    "pr_title": pr_title,
                    "merged_at": pr_data.get("merged_at"),
                },
            )
        else:
            return IndexedEventCreate(
                source=EventSource.GITHUB,
                category=IndexedEventCategory.PR_CLOSED,
                title=f"PR #{pr_number} closed: {pr_title}",
                description=f"PR #{pr_number} was closed without merge in {repository}",
                contributor_username=sender,
                bounty_id=bounty_id,
                bounty_number=bounty_number,
                github_url=pr_url,
                payload={
                    "pr_number": pr_number,
                    "repository": repository,
                    "action": "closed",
                    "pr_title": pr_title,
                },
            )

    return None


def process_issue_event(
    action: str,
    issue_data: Dict[str, Any],
    repository: str,
    sender: str,
    labels: List[str],
) -> Optional[IndexedEventCreate]:
    """Convert a GitHub issues webhook event into an indexed event.

    Maps issue actions to event categories:
    - opened → ISSUE_OPENED (or BOUNTY_CREATED if has bounty label)
    - closed → ISSUE_CLOSED (or BOUNTY_COMPLETED if has bounty label)
    - labeled → ISSUE_LABELED (or BOUNTY_CREATED if bounty label added)

    Args:
        action: The issue action (opened, closed, labeled, etc.).
        issue_data: The issue object from the webhook payload.
        repository: Full repository name.
        sender: GitHub username of the actor.
        labels: List of label names on the issue.

    Returns:
        An IndexedEventCreate if the action is relevant, else None.
    """
    issue_number = issue_data.get("number", 0)
    issue_title = issue_data.get("title", "Unknown Issue")
    issue_url = issue_data.get("html_url", "")
    is_bounty = "bounty" in [label.lower() for label in labels]

    bounty_id = f"gh-{issue_number}" if is_bounty else None

    # Parse reward amount from title for bounty issues
    reward_amount = _parse_reward_from_title(issue_title) if is_bounty else None

    if action == "opened":
        category = (
            IndexedEventCategory.BOUNTY_CREATED
            if is_bounty
            else IndexedEventCategory.ISSUE_OPENED
        )
        return IndexedEventCreate(
            source=EventSource.GITHUB,
            category=category,
            title=f"{'Bounty' if is_bounty else 'Issue'} #{issue_number}: {issue_title}",
            description=f"{sender} opened {'bounty' if is_bounty else 'issue'} #{issue_number} in {repository}",
            contributor_username=sender,
            bounty_id=bounty_id,
            bounty_number=issue_number,
            github_url=issue_url,
            amount=reward_amount,
            payload={
                "issue_number": issue_number,
                "repository": repository,
                "action": action,
                "labels": labels,
                "is_bounty": is_bounty,
            },
        )

    elif action == "closed":
        category = (
            IndexedEventCategory.BOUNTY_COMPLETED
            if is_bounty
            else IndexedEventCategory.ISSUE_CLOSED
        )
        return IndexedEventCreate(
            source=EventSource.GITHUB,
            category=category,
            title=f"{'Bounty' if is_bounty else 'Issue'} #{issue_number} closed: {issue_title}",
            description=f"{'Bounty' if is_bounty else 'Issue'} #{issue_number} was closed in {repository}",
            contributor_username=sender,
            bounty_id=bounty_id,
            bounty_number=issue_number,
            github_url=issue_url,
            amount=reward_amount,
            payload={
                "issue_number": issue_number,
                "repository": repository,
                "action": action,
                "labels": labels,
                "is_bounty": is_bounty,
            },
        )

    elif action == "labeled" and is_bounty:
        return IndexedEventCreate(
            source=EventSource.GITHUB,
            category=IndexedEventCategory.BOUNTY_CREATED,
            title=f"Bounty #{issue_number} created: {issue_title}",
            description=f"Issue #{issue_number} labeled as bounty in {repository}",
            contributor_username=sender,
            bounty_id=bounty_id,
            bounty_number=issue_number,
            github_url=issue_url,
            amount=reward_amount,
            payload={
                "issue_number": issue_number,
                "repository": repository,
                "action": action,
                "labels": labels,
                "is_bounty": True,
            },
        )

    return None


def process_review_event(
    action: str,
    review_data: Dict[str, Any],
    pr_data: Dict[str, Any],
    repository: str,
    sender: str,
) -> Optional[IndexedEventCreate]:
    """Convert a GitHub pull_request_review webhook event into an indexed event.

    Args:
        action: The review action (submitted, edited, dismissed).
        review_data: The review object from the webhook payload.
        pr_data: The pull_request object from the webhook payload.
        repository: Full repository name.
        sender: GitHub username of the reviewer.

    Returns:
        An IndexedEventCreate if the review was submitted, else None.
    """
    if action != "submitted":
        return None

    pr_number = pr_data.get("number", 0)
    pr_title = pr_data.get("title", "Unknown PR")
    review_state = review_data.get("state", "commented")
    review_url = review_data.get("html_url", "")
    pr_body = pr_data.get("body") or ""

    bounty_number = _extract_bounty_number(pr_body)
    bounty_id = f"gh-{bounty_number}" if bounty_number else None

    return IndexedEventCreate(
        source=EventSource.GITHUB,
        category=IndexedEventCategory.REVIEW_SUBMITTED,
        title=f"Review on PR #{pr_number}: {review_state}",
        description=f"{sender} submitted a {review_state} review on PR #{pr_number} ({pr_title})",
        contributor_username=sender,
        bounty_id=bounty_id,
        bounty_number=bounty_number,
        github_url=review_url,
        payload={
            "pr_number": pr_number,
            "repository": repository,
            "review_state": review_state,
            "reviewer": sender,
        },
    )


def process_issue_comment_event(
    action: str,
    comment_data: Dict[str, Any],
    issue_data: Dict[str, Any],
    repository: str,
    sender: str,
) -> Optional[IndexedEventCreate]:
    """Convert issue comment events into indexed claim events.

    Detects bounty claim comments (containing 'claiming') and
    converts them into BOUNTY_CLAIMED events.

    Args:
        action: The comment action (created, edited, deleted).
        comment_data: The comment object from the webhook payload.
        issue_data: The issue object from the webhook payload.
        repository: Full repository name.
        sender: GitHub username of the commenter.

    Returns:
        An IndexedEventCreate if a claim is detected, else None.
    """
    if action != "created":
        return None

    comment_body = (comment_data.get("body") or "").lower().strip()
    issue_number = issue_data.get("number", 0)
    issue_title = issue_data.get("title", "Unknown Issue")
    labels = [
        label.get("name", "").lower()
        for label in issue_data.get("labels", [])
    ]

    if "bounty" not in labels:
        return None

    # Detect claiming comments
    if "claiming" in comment_body or "claim" == comment_body:
        return IndexedEventCreate(
            source=EventSource.GITHUB,
            category=IndexedEventCategory.BOUNTY_CLAIMED,
            title=f"Bounty #{issue_number} claimed by {sender}",
            description=f"{sender} claimed bounty #{issue_number}: {issue_title}",
            contributor_username=sender,
            bounty_id=f"gh-{issue_number}",
            bounty_number=issue_number,
            github_url=comment_data.get("html_url", ""),
            payload={
                "issue_number": issue_number,
                "repository": repository,
                "comment_body": comment_body[:200],
                "claimer": sender,
            },
        )

    return None


def _extract_bounty_number(text: str) -> Optional[int]:
    """Extract the linked bounty issue number from PR body text.

    Searches for patterns like 'Closes #123', 'Fixes #456', or
    'Resolves #789' in the text.

    Args:
        text: The PR body or description text to search.

    Returns:
        The extracted issue number, or None if not found.
    """
    if not text:
        return None

    patterns = [
        r"(?i)(?:closes|fixes|resolves|implements)\s*#(\d+)",
        r"(?i)(?:closes|fixes|resolves|implements)\s+https://github\.com/[^/]+/[^/]+/issues/(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return int(match.group(1))
    return None


def _parse_reward_from_title(title: str) -> Optional[Decimal]:
    """Extract the reward amount from a bounty issue title.

    Parses patterns like '500,000 $FNDRY' from the issue title.

    Args:
        title: The issue title string.

    Returns:
        The reward amount as Decimal, or None if not found.
    """
    match = re.search(r"([\d,]+)\s*\$FNDRY", title)
    if match:
        return Decimal(match.group(1).replace(",", ""))
    return None
