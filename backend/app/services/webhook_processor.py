"""GitHub webhook processing service.

Handles PR and issue events, updates bounty status, and ensures idempotency.
"""

import hashlib
import json
import logging
import re
from typing import Optional, Dict, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhook_log import WebhookEventLogDB
from app.models.bounty import BountyDB, VALID_STATUSES, BountyStatus, BountyTier
from app.services import bounty_service
from app.services import bounty_lifecycle_service

logger = logging.getLogger(__name__)


class WebhookProcessingError(Exception):
    """Raised when webhook processing fails."""

    pass


class DuplicateDeliveryError(Exception):
    """Raised when a delivery has already been processed."""

    pass


class WebhookProcessor:
    """Processes GitHub webhook events."""

    # Bounty status transitions
    STATUS_TRANSITIONS = {
        "pr_opened": "in_review",
        "pr_merged": "completed",
        "pr_closed": "open",  # PR closed without merge
    }

    def __init__(self, db: AsyncSession):
        """Initialize the instance."""
        self.db = db

    async def check_idempotency(self, delivery_id: str) -> bool:
        """
        Check if a delivery has already been processed.

        Returns True if already processed (should skip), False if new.
        """
        query = select(WebhookEventLogDB).where(
            WebhookEventLogDB.delivery_id == delivery_id
        )
        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()

        return existing is not None

    async def log_event(
        self,
        delivery_id: str,
        event_type: str,
        payload: bytes,
        status: str = "processed",
        error_message: Optional[str] = None,
    ) -> WebhookEventLogDB:
        """Log a webhook event for audit and idempotency."""
        payload_hash = hashlib.sha256(payload).hexdigest()

        log = WebhookEventLogDB(
            delivery_id=delivery_id,
            event_type=event_type,
            payload_hash=payload_hash,
            status=status,
            error_message=error_message,
        )

        self.db.add(log)
        return log

    async def process_pull_request(
        self,
        action: str,
        pr_number: int,
        pr_body: Optional[str],
        repository: str,
        sender: str,
        delivery_id: str,
        payload: bytes,
    ) -> Dict[str, Any]:
        """
        Process a pull_request event.

        Actions handled:
        - opened: Match to bounty via "Closes #N", update status to in_review
        - closed: If merged, update status to completed, trigger payout
        - synchronize: Update existing PR reference

        Args:
            action: PR action (opened, closed, synchronize)
            pr_number: PR number
            pr_body: PR body/description
            repository: Repository full name
            sender: User who triggered the event
            delivery_id: GitHub delivery ID for idempotency

        Returns:
            Dict with processing result.
        """
        # Check idempotency
        if await self.check_idempotency(delivery_id):
            logger.info("Delivery %s already processed, skipping", delivery_id)
            return {"status": "skipped", "reason": "duplicate"}

        result = {"action": action, "pr_number": pr_number}

        try:
            if action == "opened":
                # Parse "Closes #N" or "Fixes #N" from PR body
                bounty_number = self._parse_closes_issue(pr_body)

                if bounty_number:
                    # Update bounty status to in_review
                    updated = await self._update_bounty_status(
                        github_issue_number=bounty_number,
                        github_repo=repository,
                        new_status="under_review",
                    )

                    if updated:
                        result["bounty_updated"] = bounty_number
                        result["new_status"] = "under_review"
                        logger.info(
                            "PR #%d opened, bounty #%d status -> under_review",
                            pr_number,
                            bounty_number,
                        )
                    else:
                        result["bounty_not_found"] = bounty_number
                else:
                    result["no_bounty_reference"] = True

            elif action == "closed":
                # Check if merged
                pr_data = json.loads(payload).get("pull_request", {})
                merged = pr_data.get("merged", False)

                if merged:
                    # Parse bounty reference
                    bounty_number = self._parse_closes_issue(pr_body)

                    if bounty_number:
                        b_id = self._find_bounty_id(bounty_number, repository)
                        if b_id:
                            bounty = bounty_service._bounty_store[b_id]
                            pr_url = pr_data.get("html_url")
                            
                            try:
                                if bounty.tier == BountyTier.T1 and pr_url:
                                    # Find submission for this PR
                                    sub_id = next((s.id for s in bounty.submissions if s.pr_url == pr_url), None)
                                    if sub_id:
                                        bounty_lifecycle_service.handle_t1_auto_win(b_id, sub_id)
                                    else:
                                        # No submission yet (maybe webhook came before job), fallback to just completing
                                        bounty_lifecycle_service.transition_status(b_id, BountyStatus.COMPLETED, actor_id="github_webhook", actor_type="system")
                                else:
                                    bounty_lifecycle_service.transition_status(b_id, BountyStatus.COMPLETED, actor_id="github_webhook", actor_type="system")
                                updated = True
                            except bounty_lifecycle_service.LifecycleError as e:
                                logger.warning("Could not transition bounty %s: %s", b_id, e)
                                updated = False
                        else:
                            updated = False

                        if updated:
                            result["bounty_updated"] = bounty_number
                            result["new_status"] = "completed"
                            result["payout_triggered"] = True
                            logger.info(
                                "PR #%d merged, bounty #%d status -> completed",
                                pr_number,
                                bounty_number,
                            )
                else:
                    result["pr_closed_not_merged"] = True

            elif action == "synchronize":
                # PR updated with new commits
                result["pr_synchronized"] = True

            # Log successful processing
            await self.log_event(
                delivery_id=delivery_id,
                event_type="pull_request",
                payload=payload,
                status="processed",
            )

        except Exception as e:
            logger.error("Error processing PR event: %s", e)
            await self.log_event(
                delivery_id=delivery_id,
                event_type="pull_request",
                payload=payload,
                status="failed",
                error_message=str(e),
            )
            result["error"] = str(e)

        return result

    async def process_issues(
        self,
        action: str,
        issue_number: int,
        issue_title: str,
        issue_body: Optional[str],
        labels: list,
        repository: str,
        sender: str,
        delivery_id: str,
        payload: bytes,
    ) -> Dict[str, Any]:
        """
        Process an issues event.

        Actions handled:
        - labeled: If labeled "bounty", auto-create bounty record
        - closed: Update bounty status
        - opened: Check for bounty label

        Args:
            action: Issue action
            issue_number: Issue number
            issue_title: Issue title
            issue_body: Issue body
            labels: List of label names
            repository: Repository full name
            sender: User who triggered the event
            delivery_id: GitHub delivery ID

        Returns:
            Dict with processing result.
        """
        # Check idempotency
        if await self.check_idempotency(delivery_id):
            logger.info("Delivery %s already processed, skipping", delivery_id)
            return {"status": "skipped", "reason": "duplicate"}

        result = {"action": action, "issue_number": issue_number}

        try:
            label_names = [
                lbl.get("name") if isinstance(lbl, dict) else lbl for lbl in labels
            ]
            has_bounty_label = "bounty" in label_names

            if action == "labeled" and has_bounty_label:
                # Auto-create bounty record
                bounty = await self._create_bounty_from_issue(
                    github_issue_number=issue_number,
                    github_repo=repository,
                    title=issue_title,
                    description=issue_body or "",
                    labels=label_names,
                )

                if bounty:
                    result["bounty_created"] = issue_number
                    logger.info("Bounty created from issue #%d", issue_number)

            elif action == "closed" and has_bounty_label:
                # Update bounty status
                updated = await self._update_bounty_status(
                    github_issue_number=issue_number,
                    github_repo=repository,
                    new_status="completed",
                )

                if updated:
                    result["bounty_completed"] = issue_number

            elif action == "opened" and has_bounty_label:
                # Issue opened with bounty label
                result["bounty_issue_opened"] = issue_number

            # Log successful processing
            await self.log_event(
                delivery_id=delivery_id,
                event_type="issues",
                payload=payload,
                status="processed",
            )

        except Exception as e:
            logger.error("Error processing issues event: %s", e)
            await self.log_event(
                delivery_id=delivery_id,
                event_type="issues",
                payload=payload,
                status="failed",
                error_message=str(e),
            )
            result["error"] = str(e)

        return result

    def _parse_closes_issue(self, body: Optional[str]) -> Optional[int]:
        """
        Parse 'Closes #N' or 'Fixes #N' from PR body.

        Returns the issue number, or None if not found.
        """
        if not body:
            return None

        # Match patterns: "Closes #123", "Fixes #456", "Resolves #789"
        patterns = [
            r"(?i)(?:closes|fixes|resolves|implements)\s*#(\d+)",
            r"(?i)(?:closes|fixes|resolves|implements)\s+https://github\.com/[^/]+/[^/]+/issues/(\d+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, body)
            if match:
                return int(match.group(1))

        return None

    def _find_bounty_id(self, github_issue_number: int, github_repo: str) -> Optional[str]:
        expected_url = f"https://github.com/{github_repo}/issues/{github_issue_number}"
        for b_id, bounty in bounty_service._bounty_store.items():
            if hasattr(bounty, "github_issue_url") and bounty.github_issue_url == expected_url:
                return b_id
        return None

    async def _update_bounty_status(
        self,
        github_issue_number: int,
        github_repo: str,
        new_status: str,
    ) -> bool:
        """
        Update bounty status by GitHub issue reference, using the lifecycle service.

        Returns True if updated, False if not found.
        """
        b_id = self._find_bounty_id(github_issue_number, github_repo)
        
        if not b_id:
            logger.info(
                "Bounty not found for issue #%d in %s", github_issue_number, github_repo
            )
            return False

        try:
            target = BountyStatus(new_status)
            bounty_lifecycle_service.transition_status(
                b_id, target, actor_id="github_webhook", actor_type="system"
            )
            logger.info(
                "Bounty #%d status updated to %s",
                github_issue_number,
                new_status,
            )
            return True
        except ValueError:
            logger.warning("Invalid status: %s", new_status)
            return False
        except bounty_lifecycle_service.LifecycleError as exc:
            logger.warning("Bounty %s state transition failed: %s", b_id, exc)
            return False

    async def _create_bounty_from_issue(
        self,
        github_issue_number: int,
        github_repo: str,
        title: str,
        description: str,
        labels: list,
    ) -> Optional[BountyDB]:
        """
        Create a bounty record from a GitHub issue.

        Returns the created bounty, or None if already exists.
        """
        # Check if bounty already exists
        query = select(BountyDB).where(
            BountyDB.github_issue_number == github_issue_number,
            BountyDB.github_repo == github_repo,
        )

        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            logger.info("Bounty already exists for issue #%d", github_issue_number)
            return None

        # Parse tier from labels
        tier = 1
        for label in labels:
            if label == "tier-2":
                tier = 2
            elif label == "tier-3":
                tier = 3

        # Parse category from labels
        category = "other"
        for label in labels:
            if label in [
                "frontend",
                "backend",
                "smart_contract",
                "documentation",
                "testing",
                "infrastructure",
            ]:
                category = label
                break

        # Create bounty
        bounty = BountyDB(
            title=title,
            description=description,
            tier=tier,
            category=category,
            status="open",
            github_issue_number=github_issue_number,
            github_repo=github_repo,
        )

        self.db.add(bounty)

        return bounty
