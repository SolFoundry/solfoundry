"""Email notification service with rate limiting and async queue.

Provides:
- Rate limiting (10 emails/hour per user)
- Async email queue
- Unsubscribe mechanism
- Integration with existing notification system
"""

import asyncio
import hashlib
import logging
import os
import secrets
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationType
from app.services.email.provider import (
    EmailMessage,
    EmailProvider,
    EmailResult,
    get_email_provider,
)
from app.services.email.templates import EmailTemplateEngine

logger = logging.getLogger(__name__)

# Configuration
EMAIL_RATE_LIMIT = int(os.getenv("EMAIL_RATE_LIMIT", "10"))  # emails per hour
EMAIL_RATE_WINDOW = int(os.getenv("EMAIL_RATE_WINDOW", "3600"))  # seconds (1 hour)
EMAIL_QUEUE_SIZE = int(os.getenv("EMAIL_QUEUE_SIZE", "1000"))
EMAIL_WORKER_COUNT = int(os.getenv("EMAIL_WORKER_COUNT", "3"))
EMAIL_RETRY_COUNT = int(os.getenv("EMAIL_RETRY_COUNT", "3"))
EMAIL_RETRY_DELAY = int(os.getenv("EMAIL_RETRY_DELAY", "60"))  # seconds


@dataclass
class RateLimitBucket:
    """Token bucket for rate limiting."""

    timestamps: List[float] = field(default_factory=list)

    def add_and_check(self, limit: int, window: float) -> bool:
        """Add a timestamp and check if rate limit exceeded.

        Returns True if allowed, False if rate limited.
        """
        now = time.time()
        # Remove old timestamps outside the window
        self.timestamps = [t for t in self.timestamps if now - t < window]

        if len(self.timestamps) >= limit:
            return False

        self.timestamps.append(now)
        return True


@dataclass
class QueuedEmail:
    """Email queued for async delivery."""

    id: str
    message: EmailMessage
    attempts: int = 0
    max_attempts: int = EMAIL_RETRY_COUNT
    created_at: float = field(default_factory=time.time)
    last_error: Optional[str] = None


class EmailRateLimiter:
    """Rate limiter for email sending."""

    def __init__(self, limit: int = EMAIL_RATE_LIMIT, window: int = EMAIL_RATE_WINDOW):
        """Initialize rate limiter."""
        self.limit = limit
        self.window = window
        self._buckets: Dict[str, RateLimitBucket] = defaultdict(RateLimitBucket)
        self._lock = asyncio.Lock()

    async def check_and_record(self, user_id: str) -> bool:
        """Check if user can send email and record the attempt.

        Args:
            user_id: User identifier (usually email or user UUID).

        Returns:
            True if allowed, False if rate limited.
        """
        async with self._lock:
            return self._buckets[user_id].add_and_check(self.limit, self.window)

    async def get_remaining(self, user_id: str) -> int:
        """Get remaining email quota for user."""
        async with self._lock:
            bucket = self._buckets[user_id]
            now = time.time()
            bucket.timestamps = [t for t in bucket.timestamps if now - t < self.window]
            return max(0, self.limit - len(bucket.timestamps))


class EmailQueue:
    """Async email queue for non-blocking delivery."""

    def __init__(self, max_size: int = EMAIL_QUEUE_SIZE):
        """Initialize email queue."""
        self.max_size = max_size
        self._queue: asyncio.Queue[QueuedEmail] = asyncio.Queue(maxsize=max_size)
        self._pending: Dict[str, QueuedEmail] = {}
        self._workers: List[asyncio.Task] = []
        self._running = False
        self._provider: Optional[EmailProvider] = None
        self._on_complete_callbacks: Dict[str, List[callable]] = defaultdict(list)

    async def start(self, provider: EmailProvider, worker_count: int = EMAIL_WORKER_COUNT):
        """Start worker tasks."""
        if self._running:
            logger.warning("Email queue already running")
            return

        self._provider = provider
        self._running = True

        for i in range(worker_count):
            task = asyncio.create_task(self._worker(i))
            self._workers.append(task)

        logger.info(f"Email queue started with {worker_count} workers")

    async def stop(self):
        """Stop worker tasks."""
        self._running = False

        # Wait for queue to drain
        while not self._queue.empty():
            await asyncio.sleep(0.1)

        # Cancel workers
        for worker in self._workers:
            worker.cancel()

        # Wait for workers to finish
        await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers.clear()

        logger.info("Email queue stopped")

    async def enqueue(
        self,
        message: EmailMessage,
        on_complete: Optional[callable] = None,
    ) -> str:
        """Add email to queue.

        Args:
            message: Email message to send.
            on_complete: Optional callback when email is sent or fails.

        Returns:
            Queue ID for tracking.
        """
        email_id = secrets.token_urlsafe(16)
        queued = QueuedEmail(id=email_id, message=message)

        if on_complete:
            self._on_complete_callbacks[email_id].append(on_complete)

        try:
            await self._queue.put(queued)
            self._pending[email_id] = queued
            logger.debug(f"Email {email_id} queued for {message.to}")
            return email_id
        except asyncio.QueueFull:
            logger.error("Email queue full, dropping email")
            raise RuntimeError("Email queue full")

    async def _worker(self, worker_id: int):
        """Worker coroutine for sending emails."""
        logger.debug(f"Email worker {worker_id} started")

        while self._running:
            try:
                # Get email from queue with timeout
                try:
                    queued = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue

                # Send email
                result = await self._send_with_retry(queued)

                # Call completion callbacks
                callbacks = self._on_complete_callbacks.pop(queued.id, [])
                for callback in callbacks:
                    try:
                        if asyncio.iscoroutinefunction(callback):
                            await callback(result)
                        else:
                            callback(result)
                    except Exception as e:
                        logger.exception(f"Callback error: {e}")

                # Remove from pending
                self._pending.pop(queued.id, None)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Worker {worker_id} error: {e}")
                await asyncio.sleep(1)

        logger.debug(f"Email worker {worker_id} stopped")

    async def _send_with_retry(self, queued: QueuedEmail) -> EmailResult:
        """Send email with retry logic."""
        while queued.attempts < queued.max_attempts:
            queued.attempts += 1

            try:
                result = await self._provider.send(queued.message)
                if result.success:
                    return result

                queued.last_error = result.error
                logger.warning(
                    f"Email {queued.id} attempt {queued.attempts} failed: {result.error}"
                )

                if queued.attempts < queued.max_attempts:
                    await asyncio.sleep(EMAIL_RETRY_DELAY)

            except Exception as e:
                queued.last_error = str(e)
                logger.exception(f"Email {queued.id} attempt {queued.attempts} error")

                if queued.attempts < queued.max_attempts:
                    await asyncio.sleep(EMAIL_RETRY_DELAY)

        return EmailResult(
            success=False,
            error=f"Max retries exceeded: {queued.last_error}",
            provider=self._provider.__class__.__name__,
        )

    @property
    def pending_count(self) -> int:
        """Get number of pending emails."""
        return len(self._pending)

    @property
    def queue_size(self) -> int:
        """Get current queue size."""
        return self._queue.qsize()


class EmailPreferences:
    """Email preference management."""

    # All notification types that can have email preferences
    NOTIFICATION_TYPES = {
        NotificationType.BOUNTY_CLAIMED: "Bounty Claimed",
        NotificationType.PR_SUBMITTED: "PR Submitted",
        NotificationType.REVIEW_COMPLETE: "Review Complete",
        NotificationType.PAYOUT_SENT: "Payout Sent",
        NotificationType.BOUNTY_EXPIRED: "Bounty Expired",
        NotificationType.RANK_CHANGED: "Rank Changed",
        NotificationType.SUBMISSION_RECEIVED: "Submission Received",
        NotificationType.SUBMISSION_APPROVED: "Submission Approved",
        NotificationType.SUBMISSION_REJECTED: "Submission Rejected",
        NotificationType.SUBMISSION_DISPUTED: "Submission Disputed",
        NotificationType.AUTO_APPROVED: "Auto Approved",
        NotificationType.PAYOUT_INITIATED: "Payout Initiated",
        NotificationType.PAYOUT_CONFIRMED: "Payout Confirmed",
        NotificationType.PAYOUT_FAILED: "Payout Failed",
    }

    # New notification type for skill matching (not in NotificationType enum)
    NEW_BOUNTY_MATCHING_SKILLS = "new_bounty_matching_skills"

    @staticmethod
    def generate_unsubscribe_token(user_id: str, notification_type: str, secret: str) -> str:
        """Generate unsubscribe token.

        Args:
            user_id: User UUID.
            notification_type: Type of notification.
            secret: Secret key for signing.

        Returns:
            Unsubscribe token.
        """
        data = f"{user_id}:{notification_type}:{secret}"
        return hashlib.sha256(data.encode()).hexdigest()[:32]

    @staticmethod
    def verify_unsubscribe_token(
        user_id: str, notification_type: str, token: str, secret: str
    ) -> bool:
        """Verify unsubscribe token.

        Args:
            user_id: User UUID.
            notification_type: Type of notification.
            token: Token to verify.
            secret: Secret key used for signing.

        Returns:
            True if valid, False otherwise.
        """
        expected = EmailPreferences.generate_unsubscribe_token(
            user_id, notification_type, secret
        )
        return secrets.compare_digest(token, expected)


class EmailService:
    """Main email notification service."""

    def __init__(
        self,
        provider: Optional[EmailProvider] = None,
        db: Optional[AsyncSession] = None,
        secret_key: Optional[str] = None,
    ):
        """Initialize email service.

        Args:
            provider: Email provider instance.
            db: Database session for preferences.
            secret_key: Secret key for tokens (uses SECRET_KEY env var if not provided).
        """
        self.provider = provider or get_email_provider()
        self.db = db
        self.secret_key = secret_key or os.getenv("SECRET_KEY", "change-me-in-production")
        self.rate_limiter = EmailRateLimiter()
        self.queue = EmailQueue()
        self.template_engine = EmailTemplateEngine()
        self._started = False

    async def start(self):
        """Start the email service (queue workers)."""
        if self._started:
            return
        await self.queue.start(self.provider)
        self._started = True
        logger.info("Email service started")

    async def stop(self):
        """Stop the email service."""
        await self.queue.stop()
        self._started = False
        logger.info("Email service stopped")

    async def send_notification_email(
        self,
        user_id: str,
        user_email: str,
        user_name: str,
        notification_type: NotificationType,
        template_context: Dict[str, Any],
        skip_rate_limit: bool = False,
    ) -> EmailResult:
        """Send a notification email.

        Args:
            user_id: User UUID.
            user_email: User email address.
            user_name: User display name.
            notification_type: Type of notification.
            template_context: Variables for email template.
            skip_rate_limit: Skip rate limit check (for system emails).

        Returns:
            EmailResult with send status.
        """
        # Check rate limit
        if not skip_rate_limit:
            allowed = await self.rate_limiter.check_and_record(user_id)
            if not allowed:
                logger.warning(f"Rate limit exceeded for user {user_id}")
                return EmailResult(
                    success=False,
                    error="Rate limit exceeded (10 emails/hour)",
                )

        # Generate unsubscribe token
        unsubscribe_token = EmailPreferences.generate_unsubscribe_token(
            user_id, notification_type.value, self.secret_key
        )

        # Prepare template context
        context = {
            **template_context,
            "user_name": user_name,
            "unsubscribe_url": f"{os.getenv('FRONTEND_URL', 'https://solfoundry.org')}/unsubscribe?token={unsubscribe_token}&type={notification_type.value}",
        }

        # Render email
        template_name = notification_type.value
        if template_name not in [
            "bounty_claimed",
            "pr_submitted",
            "review_complete",
            "payout_sent",
        ]:
            # Use generic template for unknown types
            template_name = "new_bounty_matching_skills"

        html_content = self.template_engine.render_template(template_name, context)

        # Create email message
        message = EmailMessage(
            to=user_email,
            subject=self._get_subject(notification_type, context),
            html_content=html_content,
            text_content=self._generate_text_version(context),
            notification_type=notification_type.value,
            user_id=user_id,
            unsubscribe_token=unsubscribe_token,
        )

        # Queue for async delivery
        email_id = await self.queue.enqueue(message)

        return EmailResult(
            success=True,
            message_id=email_id,
            provider="queued",
        )

    async def send_new_bounty_email(
        self,
        user_id: str,
        user_email: str,
        user_name: str,
        bounty_title: str,
        bounty_id: str,
        bounty_reward: str,
        matched_skills: List[str],
        bounty_tier: str = "",
    ) -> EmailResult:
        """Send new bounty matching skills notification.

        Args:
            user_id: User UUID.
            user_email: User email address.
            user_name: User display name.
            bounty_title: Bounty title.
            bounty_id: Bounty UUID.
            bounty_reward: Reward amount.
            matched_skills: List of matched skills.
            bounty_tier: Bounty tier (T1, T2, T3).

        Returns:
            EmailResult with send status.
        """
        # Check rate limit
        allowed = await self.rate_limiter.check_and_record(user_id)
        if not allowed:
            logger.warning(f"Rate limit exceeded for user {user_id}")
            return EmailResult(
                success=False,
                error="Rate limit exceeded (10 emails/hour)",
            )

        # Generate unsubscribe token
        unsubscribe_token = EmailPreferences.generate_unsubscribe_token(
            user_id, EmailPreferences.NEW_BOUNTY_MATCHING_SKILLS, self.secret_key
        )

        # Prepare template context
        context = {
            "user_name": user_name,
            "bounty_title": bounty_title,
            "bounty_id": bounty_id,
            "bounty_reward": bounty_reward,
            "matched_skills": matched_skills,
            "bounty_tier": bounty_tier,
            "unsubscribe_url": f"{os.getenv('FRONTEND_URL', 'https://solfoundry.org')}/unsubscribe?token={unsubscribe_token}&type={EmailPreferences.NEW_BOUNTY_MATCHING_SKILLS}",
        }

        # Render email
        html_content = self.template_engine.render_template(
            "new_bounty_matching_skills", context
        )

        # Create email message
        message = EmailMessage(
            to=user_email,
            subject=f"🎯 New Bounty Match: {bounty_title}",
            html_content=html_content,
            text_content=self._generate_text_version(context),
            notification_type=EmailPreferences.NEW_BOUNTY_MATCHING_SKILLS,
            user_id=user_id,
            unsubscribe_token=unsubscribe_token,
        )

        # Queue for async delivery
        email_id = await self.queue.enqueue(message)

        return EmailResult(
            success=True,
            message_id=email_id,
            provider="queued",
        )

    def _get_subject(self, notification_type: NotificationType, context: Dict) -> str:
        """Generate email subject line."""
        subjects = {
            NotificationType.BOUNTY_CLAIMED: f"🎉 Bounty Claimed: {context.get('bounty_title', '')}",
            NotificationType.PR_SUBMITTED: f"🔀 New PR: {context.get('bounty_title', '')}",
            NotificationType.REVIEW_COMPLETE: f"📝 Review Complete: {context.get('bounty_title', '')}",
            NotificationType.PAYOUT_SENT: f"💰 Payout Sent: {context.get('amount', '')} {context.get('token', '$FNDRY')}",
            NotificationType.BOUNTY_EXPIRED: f"⏰ Bounty Expired: {context.get('bounty_title', '')}",
            NotificationType.RANK_CHANGED: f"📊 Rank Updated: {context.get('new_rank', '')}",
            NotificationType.SUBMISSION_RECEIVED: "📥 Submission Received",
            NotificationType.SUBMISSION_APPROVED: "✅ Submission Approved",
            NotificationType.SUBMISSION_REJECTED: "❌ Submission Rejected",
            NotificationType.SUBMISSION_DISPUTED: "⚠️ Submission Disputed",
            NotificationType.AUTO_APPROVED: "✅ Auto-Approved",
            NotificationType.PAYOUT_INITIATED: f"💸 Payout Initiated: {context.get('amount', '')}",
            NotificationType.PAYOUT_CONFIRMED: f"✅ Payout Confirmed: {context.get('amount', '')}",
            NotificationType.PAYOUT_FAILED: "❌ Payout Failed",
        }
        return subjects.get(notification_type, "SolFoundry Notification")

    def _generate_text_version(self, context: Dict) -> str:
        """Generate plain text version of email."""
        bounty_title = context.get("bounty_title", "")
        user_name = context.get("user_name", "Contributor")
        base_url = os.getenv("FRONTEND_URL", "https://solfoundry.org")

        return f"""
Hi {user_name},

You have a new notification from SolFoundry.

{bounty_title}

Visit {base_url} to view details.

---
You're receiving this email because you're a SolFoundry contributor.
Manage preferences: {base_url}/settings/notifications
""".strip()


# Global email service instance
_email_service: Optional[EmailService] = None


async def get_email_service() -> EmailService:
    """Get or create the global email service instance."""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
        await _email_service.start()
    return _email_service


async def shutdown_email_service():
    """Shutdown the email service."""
    global _email_service
    if _email_service:
        await _email_service.stop()
        _email_service = None