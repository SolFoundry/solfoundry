"""Email service for sending notification emails to users.

Provides async email delivery using Resend API with Jinja2 templating.
Handles rate limiting (10 emails/hour per user) and integrates with
the notification system.
"""

import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

import resend
from jinja2 import Environment, FileSystemLoader, select_autoescape
from redis.asyncio import from_url, Redis

from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Configuration
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@solfoundry.org")
APP_URL = os.getenv("APP_URL", "https://solfoundry.org")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


class EmailService:
    """Service for sending transactional emails."""

    def __init__(self, redis_client: Optional[Redis] = None):
        """Initialize email service.

        Args:
            redis_client: Optional Redis client instance. If not provided,
                one will be created from REDIS_URL.
        """
        templates_dir = os.path.join(
            os.path.dirname(__file__), "..", "..", "email_templates"
        )
        self.templates_dir = templates_dir

        self.jinja_env = Environment(
            loader=FileSystemLoader(templates_dir),
            autoescape=select_autoescape(['html', 'xml'])
        )

        # Resend client
        if RESEND_API_KEY:
            resend.api_key = RESEND_API_KEY
        else:
            logger.warning("RESEND_API_KEY not set; email sending is disabled")

        # Redis connection
        self.redis = redis_client or from_url(REDIS_URL, decode_responses=True)

    async def send_notification_email(
        self,
        user_email: str,
        user_id: str,
        notification_type: str,
        context: Dict[str, Any],
        unsubscribe: bool = True,
    ) -> bool:
        """Send a notification email to a user.

        Args:
            user_email: Destination email address.
            user_id: Unique user identifier for rate limiting and preferences.
            notification_type: Type of notification (e.g., 'bounty_claimed').
            context: Template context variables.
            unsubscribe: Whether to include an unsubscribe link.

        Returns:
            True if email was sent or disabled, False if rate limited or opted out.
        """
        # Check user preferences: if user disabled this type, skip
        if await self._is_type_disabled(user_id, notification_type):
            logger.debug("User %s has disabled emails for type %s", user_id, notification_type)
            return False

        # Check rate limit: 10 emails per hour per user
        if not await self._check_rate_limit(user_id):
            logger.info("Rate limit exceeded for user %s sending email", user_id)
            return False

        if not RESEND_API_KEY:
            # Simulate sending in dev
            logger.debug("No RESEND_API_KEY; would send email to %s (type=%s)", user_email, notification_type)
            await self._record_sent_email(user_id)
            return True

        try:
            # Prepare unsubscribe URL if needed
            if unsubscribe:
                unsubscribe_url = self._build_unsubscribe_url(user_id, notification_type)
                context = dict(context)  # shallow copy
                context['unsubscribe_url'] = unsubscribe_url
                context.setdefault('app_url', APP_URL)

            # Render templates
            subject, html_body = self._render(notification_type, context)

            # Send via Resend
            params: resend.Emails.SendParams = {
                "from": DEFAULT_FROM_EMAIL,
                "to": [user_email],
                "subject": subject,
                "html": html_body,
            }

            email = resend.Emails.send(params)
            logger.info("Sent email to %s (type=%s) id=%s", user_email, notification_type, email.get('id'))
            await self._record_sent_email(user_id)
            return True

        except Exception as e:
            logger.error("Failed to send email to %s: %s", user_email, e, exc_info=True)
            return False

    async def _check_rate_limit(self, user_id: str) -> bool:
        """Check if user has exceeded rate limit (10 emails per hour)."""
        key = f"email:rate:{user_id}"
        now = datetime.now(timezone.utc).timestamp()
        hour_ago = now - 3600

        # Remove entries older than 1 hour
        await self.redis.zremrangebyscore(key, 0, hour_ago)
        # Count remaining
        count = await self.redis.zcard(key)
        return count < 10

    async def _record_sent_email(self, user_id: str):
        """Record that an email was sent for rate limiting."""
        key = f"email:rate:{user_id}"
        now = datetime.now(timezone.utc).timestamp()
        # Add member with score = timestamp
        await self.redis.zadd(key, {str(now): now})
        # Set expiry a bit longer than window to auto-clean
        await self.redis.expire(key, 7200)

    def _render(self, template_name: str, context: Dict[str, Any]) -> (str, str):
        """Render subject and HTML body from template.

        Falls back to a simple built-in template if the file is missing.
        """
        # Prepare context with defaults
        ctx = dict(context)
        ctx.setdefault('app_url', APP_URL)

        try:
            template = self.jinja_env.get_template(f"{template_name}.html")
            html = template.render(**ctx)
        except Exception as e:
            logger.warning("Template %s not found or error: %s; using fallback", template_name, e)
            # Simple fallback HTML
            subject = ctx.get('title', template_name.replace('_', ' ').title())
            message = ctx.get('message', '')
            html = f"""<!DOCTYPE html><html><body>
            <h1>{subject}</h1>
            <p>{message}</p>
            <p><a href="{ctx.get('app_url')}">SolFoundry</a></p>
            </body></html>"""

        # Subject: use context title if available, else fallback
        subject = ctx.get('title', template_name.replace('_', ' ').title())
        return subject, html

    def _build_unsubscribe_url(self, user_id: str, notification_type: str) -> str:
        """Build an unsubscribe link that disables a specific notification type."""
        # In production, include a signed token to prevent CSRF
        return f"{APP_URL}/api/notifications/unsubscribe?user_id={user_id}&type={notification_type}"

    async def _is_type_disabled(self, user_id: str, notification_type: str) -> bool:
        """Check if user has disabled this notification type."""
        key = f"email:disabled:{user_id}"
        # Redis set of disabled types
        is_member = await self.redis.sismember(key, notification_type)
        return bool(is_member)

    async def disable_type(self, user_id: str, notification_type: str):
        """Disable a notification type for a user (unsubscribe)."""
        key = f"email:disabled:{user_id}"
        await self.redis.sadd(key, notification_type)

    async def enable_type(self, user_id: str, notification_type: str):
        """Re-enable a notification type for a user."""
        key = f"email:disabled:{user_id}"
        await self.redis.srem(key, notification_type)

    async def get_disabled_types(self, user_id: str) -> List[str]:
        """Get list of disabled notification types for a user."""
        key = f"email:disabled:{user_id}"
        types = await self.redis.smembers(key)
        return list(types)
