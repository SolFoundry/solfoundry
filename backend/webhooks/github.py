import logging
from typing import Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from backend.bounty_lifecycle import BountyLifecycleEngine
from backend.database import get_db
from backend.models import Bounty, Submission

logger = logging.getLogger(__name__)


class GitHubWebhookHandler:
    def __init__(self):
        self.lifecycle_engine = BountyLifecycleEngine()

    async def handle_pull_request_event(self, payload: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Handle GitHub pull request webhook events with bounty lifecycle integration"""
        action = payload.get("action")
        pr_data = payload.get("pull_request", {})
        pr_number = pr_data.get("number")
        pr_title = pr_data.get("title", "")
        pr_body = pr_data.get("body", "")
        pr_author = pr_data.get("user", {}).get("login", "")

        logger.info(f"Processing PR #{pr_number} action: {action}")

        # Extract bounty issue reference from PR body
        bounty_id = self._extract_bounty_reference(pr_body)
        if not bounty_id:
            logger.debug(f"No bounty reference found in PR #{pr_number}")
            return {"status": "no_bounty_reference"}

        try:
            if action == "opened":
                await self._handle_pr_opened(bounty_id, pr_number, pr_author, pr_title, db)
                # Fallback to existing WEBHOOK_UPDATE for opened events
                return await self._legacy_webhook_update(payload, db)

            elif action == "closed" and pr_data.get("merged"):
                return await self._handle_pr_merged(bounty_id, pr_number, pr_author, db)

            elif action == "closed" and not pr_data.get("merged"):
                return await self._handle_pr_closed(bounty_id, pr_number, pr_author, db)

            else:
                logger.debug(f"Unhandled PR action: {action}")
                return {"status": "ignored"}

        except Exception as e:
            logger.error(f"Error processing PR webhook: {e}")
            return {"status": "error", "message": str(e)}

    async def _handle_pr_opened(self, bounty_id: int, pr_number: int, author: str, title: str, db: Session):
        """Handle PR opened - submit for review"""
        logger.info(f"Submitting bounty {bounty_id} for review (PR #{pr_number})")

        try:
            result = await self.lifecycle_engine.submit_for_review(
                bounty_id=bounty_id,
                submission_data={
                    "github_pr_number": pr_number,
                    "author": author,
                    "title": title,
                    "submitted_at": datetime.utcnow()
                },
                db=db
            )
            logger.info(f"Successfully submitted bounty {bounty_id} for review")
            return result

        except Exception as e:
            logger.error(f"Failed to submit bounty {bounty_id} for review: {e}")
            raise

    async def _handle_pr_merged(self, bounty_id: int, pr_number: int, author: str, db: Session) -> Dict[str, Any]:
        """Handle PR merged - auto-approve for T1 bounties with score >= 6.0"""
        logger.info(f"Processing merged PR #{pr_number} for bounty {bounty_id}")

        bounty = db.query(Bounty).filter(Bounty.id == bounty_id).first()
        if not bounty:
            logger.warning(f"Bounty {bounty_id} not found")
            return {"status": "bounty_not_found"}

        # Get submission for this PR
        submission = db.query(Submission).filter(
            Submission.bounty_id == bounty_id,
            Submission.github_pr_number == pr_number
        ).first()

        if not submission:
            logger.warning(f"No submission found for PR #{pr_number}")
            return {"status": "submission_not_found"}

        # Check if T1 bounty and score qualifies for auto-win
        is_tier1 = bounty.tier == "T1"
        score = getattr(submission, 'review_score', 0.0)
        auto_approve = is_tier1 and score >= 6.0

        if auto_approve:
            logger.info(f"Auto-approving T1 bounty {bounty_id} with score {score}")
            try:
                result = await self.lifecycle_engine.approve_submission(
                    bounty_id=bounty_id,
                    submission_id=submission.id,
                    reviewer="system",
                    db=db
                )
                return {"status": "auto_approved", "result": result}

            except Exception as e:
                logger.error(f"Failed to auto-approve submission: {e}")
                return {"status": "approval_failed", "error": str(e)}
        else:
            logger.info(f"Merged PR #{pr_number} - manual review required (T{bounty.tier}, score: {score})")
            return {"status": "merged_pending_review", "tier": bounty.tier, "score": score}

    async def _handle_pr_closed(self, bounty_id: int, pr_number: int, author: str, db: Session) -> Dict[str, Any]:
        """Handle PR closed without merge - reject submission"""
        logger.info(f"Processing closed PR #{pr_number} for bounty {bounty_id}")

        submission = db.query(Submission).filter(
            Submission.bounty_id == bounty_id,
            Submission.github_pr_number == pr_number
        ).first()

        if not submission:
            logger.warning(f"No submission found for closed PR #{pr_number}")
            return {"status": "submission_not_found"}

        try:
            result = await self.lifecycle_engine.reject_submission(
                bounty_id=bounty_id,
                submission_id=submission.id,
                reason="PR closed without merge",
                db=db
            )
            logger.info(f"Rejected submission for closed PR #{pr_number}")
            return {"status": "rejected", "result": result}

        except Exception as e:
            logger.error(f"Failed to reject submission: {e}")
            return {"status": "rejection_failed", "error": str(e)}

    def _extract_bounty_reference(self, pr_body: str) -> Optional[int]:
        """Extract bounty ID from PR body using 'Closes #N' pattern"""
        if not pr_body:
            return None

        import re
        # Match "Closes #123" pattern (case insensitive)
        match = re.search(r'closes\s+#(\d+)', pr_body, re.IGNORECASE)
        if match:
            return int(match.group(1))

        return None

    async def _legacy_webhook_update(self, payload: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Fallback to existing WEBHOOK_UPDATE functionality for opened events"""
        logger.debug("Executing legacy webhook update for opened PR")

        # Preserve existing webhook functionality
        pr_data = payload.get("pull_request", {})

        update_data = {
            "webhook_type": "pull_request",
            "action": payload.get("action"),
            "pr_number": pr_data.get("number"),
            "pr_title": pr_data.get("title"),
            "pr_author": pr_data.get("user", {}).get("login"),
            "pr_url": pr_data.get("html_url"),
            "processed_at": datetime.utcnow()
        }

        logger.info(f"Legacy webhook update processed: {update_data}")
        return {"status": "legacy_processed", "data": update_data}

    async def handle_issues_event(self, payload: Dict[str, Any], db: Session) -> Dict[str, Any]:
        """Handle GitHub issues webhook events"""
        action = payload.get("action")
        issue_data = payload.get("issue", {})

        logger.debug(f"Processing issue #{issue_data.get('number')} action: {action}")

        # For now, just log issue events - can extend for bounty creation/updates
        return {"status": "issue_logged", "action": action}
