# SPDX-License-Identifier: MIT

from typing import Optional, Dict, List, Any
import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models.submission import Submission, SubmissionStatus
from app.models.bounty import Bounty, BountyStatus
from app.models.escrow import Escrow, EscrowStatus
from app.services.github_service import GitHubService
from app.services.notification_service import NotificationService
from app.services.escrow_service import EscrowService
from app.core.config import settings

logger = logging.getLogger(__name__)


class SubmissionService:
    def __init__(self):
        self.github_service = GitHubService()
        self.notification_service = NotificationService()
        self.escrow_service = EscrowService()

    async def submit_pr(
        self,
        bounty_id: int,
        pr_url: str,
        contributor_wallet: str,
        contributor_id: int
    ) -> Dict[str, Any]:
        """Submit a PR for bounty completion review"""

        async with get_db_session() as db:
            # Validate bounty exists and is open
            bounty_result = await db.execute(
                select(Bounty).where(Bounty.id == bounty_id)
            )
            bounty = bounty_result.scalar_one_or_none()

            if not bounty:
                raise ValueError(f"Bounty {bounty_id} not found")

            if bounty.status != BountyStatus.OPEN:
                raise ValueError(f"Bounty {bounty_id} is not open for submissions")

            # Check for existing submissions from this contributor
            existing_result = await db.execute(
                select(Submission).where(
                    Submission.bounty_id == bounty_id,
                    Submission.contributor_id == contributor_id
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                raise ValueError("You have already submitted to this bounty")

            # Validate PR URL format
            if not self._validate_pr_url(pr_url):
                raise ValueError("Invalid PR URL format")

            # Extract repo info for GitHub API calls
            repo_info = self._extract_repo_info(pr_url)

            # Verify PR exists and get basic info
            pr_data = await self.github_service.get_pr_info(
                repo_info["owner"],
                repo_info["repo"],
                repo_info["pr_number"]
            )

            if not pr_data:
                raise ValueError("PR not found or not accessible")

            # Create submission record
            submission = Submission(
                bounty_id=bounty_id,
                contributor_id=contributor_id,
                contributor_wallet=contributor_wallet,
                pr_url=pr_url,
                pr_title=pr_data.get("title", ""),
                status=SubmissionStatus.UNDER_REVIEW,
                submitted_at=datetime.now(timezone.utc)
            )

            db.add(submission)
            await db.commit()
            await db.refresh(submission)

            # Update bounty status to under review
            await db.execute(
                update(Bounty)
                .where(Bounty.id == bounty_id)
                .values(status=BountyStatus.UNDER_REVIEW)
            )
            await db.commit()

            # Start async AI score fetching
            asyncio.create_task(self._fetch_scores_async(submission.id))

            # Notify bounty creator
            await self.notification_service.notify_submission_received(
                bounty.creator_id, bounty_id, submission.id
            )

            return {
                "submission_id": submission.id,
                "status": submission.status.value,
                "message": "Submission received and under AI review"
            }

    async def fetch_ai_scores(self, submission_id: int) -> Optional[Dict[str, Any]]:
        """Fetch AI review scores from GitHub Actions"""

        async with get_db_session() as db:
            submission_result = await db.execute(
                select(Submission).where(Submission.id == submission_id)
            )
            submission = submission_result.scalar_one_or_none()

            if not submission:
                return None

            repo_info = self._extract_repo_info(submission.pr_url)

            # Get workflow runs for the PR
            scores = await self.github_service.get_ai_review_scores(
                repo_info["owner"],
                repo_info["repo"],
                repo_info["pr_number"]
            )

            if scores:
                # Update submission with scores
                await db.execute(
                    update(Submission)
                    .where(Submission.id == submission_id)
                    .values(
                        gpt_score=scores.get("gpt_score"),
                        gemini_score=scores.get("gemini_score"),
                        grok_score=scores.get("grok_score"),
                        overall_score=scores.get("overall_score"),
                        review_comments=scores.get("comments", ""),
                        scores_updated_at=datetime.now(timezone.utc)
                    )
                )
                await db.commit()

                # Check for auto-approval
                await self.auto_approve_check(submission_id)

            return scores

    async def auto_approve_check(self, submission_id: int) -> bool:
        """Check if submission qualifies for auto-approval"""

        async with get_db_session() as db:
            submission_result = await db.execute(
                select(Submission).where(Submission.id == submission_id)
            )
            submission = submission_result.scalar_one_or_none()

            if not submission or not submission.overall_score:
                return False

            # Auto-approve threshold from config
            threshold = getattr(settings, 'AUTO_APPROVE_THRESHOLD', 8.0)

            if submission.overall_score >= threshold:
                await db.execute(
                    update(Submission)
                    .where(Submission.id == submission_id)
                    .values(
                        status=SubmissionStatus.APPROVED,
                        approved_at=datetime.now(timezone.utc),
                        auto_approved=True
                    )
                )
                await db.commit()

                # Process payout immediately
                await self.process_payout(submission_id)

                return True

            # Notify creator for manual review if score is good but not auto-approve
            elif submission.overall_score >= 6.0:
                bounty_result = await db.execute(
                    select(Bounty).where(Bounty.id == submission.bounty_id)
                )
                bounty = bounty_result.scalar_one()

                await self.notification_service.notify_review_ready(
                    bounty.creator_id, submission.bounty_id, submission_id
                )

            return False

    async def process_payout(self, submission_id: int) -> Dict[str, Any]:
        """Process payout for approved submission"""

        async with get_db_session() as db:
            submission_result = await db.execute(
                select(Submission).where(Submission.id == submission_id)
            )
            submission = submission_result.scalar_one_or_none()

            if not submission:
                raise ValueError(f"Submission {submission_id} not found")

            if submission.status != SubmissionStatus.APPROVED:
                raise ValueError("Submission not approved for payout")

            # Get bounty and escrow info
            bounty_result = await db.execute(
                select(Bounty).where(Bounty.id == submission.bounty_id)
            )
            bounty = bounty_result.scalar_one()

            escrow_result = await db.execute(
                select(Escrow).where(Escrow.bounty_id == bounty.id)
            )
            escrow = escrow_result.scalar_one_or_none()

            if not escrow or escrow.status != EscrowStatus.LOCKED:
                raise ValueError("No locked escrow found for bounty")

            try:
                # Release escrow to contributor
                tx_signature = await self.escrow_service.release_escrow(
                    escrow.escrow_address,
                    submission.contributor_wallet,
                    bounty.reward_amount
                )

                # Update submission and bounty status
                await db.execute(
                    update(Submission)
                    .where(Submission.id == submission_id)
                    .values(
                        status=SubmissionStatus.PAID,
                        payout_tx=tx_signature,
                        paid_at=datetime.now(timezone.utc)
                    )
                )

                await db.execute(
                    update(Bounty)
                    .where(Bounty.id == bounty.id)
                    .values(status=BountyStatus.COMPLETED)
                )

                await db.execute(
                    update(Escrow)
                    .where(Escrow.id == escrow.id)
                    .values(
                        status=EscrowStatus.RELEASED,
                        release_tx=tx_signature,
                        released_at=datetime.now(timezone.utc)
                    )
                )

                await db.commit()

                # Notify stakeholders
                await self.notify_stakeholders(submission_id, "payout_complete")

                return {
                    "success": True,
                    "tx_signature": tx_signature,
                    "amount": bounty.reward_amount,
                    "recipient": submission.contributor_wallet
                }

            except Exception as e:
                logger.error(f"Payout failed for submission {submission_id}: {str(e)}")
                await db.rollback()
                raise e

    async def notify_stakeholders(self, submission_id: int, event_type: str):
        """Send notifications to relevant stakeholders"""

        async with get_db_session() as db:
            submission_result = await db.execute(
                select(Submission).where(Submission.id == submission_id)
            )
            submission = submission_result.scalar_one_or_none()

            if not submission:
                return

            bounty_result = await db.execute(
                select(Bounty).where(Bounty.id == submission.bounty_id)
            )
            bounty = bounty_result.scalar_one()

            if event_type == "payout_complete":
                # Notify contributor about successful payout
                await self.notification_service.notify_payout_success(
                    submission.contributor_id,
                    bounty.id,
                    bounty.reward_amount,
                    submission.payout_tx
                )

                # Notify bounty creator about completion
                await self.notification_service.notify_bounty_completed(
                    bounty.creator_id,
                    bounty.id,
                    submission.contributor_id
                )

            elif event_type == "review_dispute":
                await self.notification_service.notify_review_disputed(
                    submission.contributor_id,
                    bounty.id,
                    submission.id
                )

    async def _fetch_scores_async(self, submission_id: int):
        """Background task to fetch AI scores with retries"""
        max_retries = 5
        retry_delay = 30  # seconds

        for attempt in range(max_retries):
            try:
                await asyncio.sleep(retry_delay * (attempt + 1))
                scores = await self.fetch_ai_scores(submission_id)
                if scores:
                    logger.info(f"Successfully fetched AI scores for submission {submission_id}")
                    return
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1} failed to fetch scores: {str(e)}")

        logger.error(f"Failed to fetch AI scores for submission {submission_id} after {max_retries} attempts")

    def _validate_pr_url(self, pr_url: str) -> bool:
        """Validate PR URL format"""
        import re
        pattern = r"https://github\.com/[\w\-\.]+/[\w\-\.]+/pull/\d+"
        return bool(re.match(pattern, pr_url))

    def _extract_repo_info(self, pr_url: str) -> Dict[str, str]:
        """Extract repository information from PR URL"""
        import re
        pattern = r"https://github\.com/([\w\-\.]+)/([\w\-\.]+)/pull/(\d+)"
        match = re.match(pattern, pr_url)

        if not match:
            raise ValueError("Invalid PR URL format")

        return {
            "owner": match.group(1),
            "repo": match.group(2),
            "pr_number": int(match.group(3))
        }

    async def get_submission_status(self, submission_id: int) -> Optional[Dict[str, Any]]:
        """Get current submission status and details"""

        async with get_db_session() as db:
            submission_result = await db.execute(
                select(Submission).where(Submission.id == submission_id)
            )
            submission = submission_result.scalar_one_or_none()

            if not submission:
                return None

            return {
                "id": submission.id,
                "status": submission.status.value,
                "pr_url": submission.pr_url,
                "pr_title": submission.pr_title,
                "gpt_score": submission.gpt_score,
                "gemini_score": submission.gemini_score,
                "grok_score": submission.grok_score,
                "overall_score": submission.overall_score,
                "review_comments": submission.review_comments,
                "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
                "approved_at": submission.approved_at.isoformat() if submission.approved_at else None,
                "paid_at": submission.paid_at.isoformat() if submission.paid_at else None,
                "payout_tx": submission.payout_tx,
                "auto_approved": submission.auto_approved
            }
