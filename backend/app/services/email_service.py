"""Email notification service.

Provides abstraction for sending HTML emails using providers like Resend.
Includes template rendering and delivery logic.
"""

import logging
import os
from typing import Dict, Any, Optional

import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core import config
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

async def can_send_email(user_id: str) -> bool:
    """Check if user has exceeded their email rate limit (10/hour)."""
    try:
        redis = await get_redis()
        key = f"email_rate_limit:{user_id}"
        count = await redis.get(key)
        if count and int(count) >= 10:
            return False
        return True
    except Exception as e:
        logger.error("Rate limit check failed (defaulting to allow): %s", e)
        return True

async def increment_email_count(user_id: str) -> None:
    """Increment the email count for the user and set TTL of 1 hour if new."""
    try:
        redis = await get_redis()
        key = f"email_rate_limit:{user_id}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 3600)
    except Exception as e:
        logger.error("Failed to increment email count: %s", e)

# Set up Jinja2 environment
template_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
jinja_env = Environment(
    loader=FileSystemLoader(template_dir),
    autoescape=select_autoescape(["html", "xml"]),
)


class EmailProvider:
    """Base class for email providers."""

    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        """Send an email to a recipient."""
        raise NotImplementedError("Subclasses must implement send_email")


class ResendProvider(EmailProvider):
    """Email provider using Resend API."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.api_url = "https://api.resend.com/emails"

    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> bool:
        if not self.api_key:
            logger.warning("Resend API key missing. Email not sent.")
            return False

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "from": config.DEFAULT_FROM_EMAIL,
            "to": to,
            "subject": subject,
            "html": html_content,
        }
        if text_content:
            payload["text"] = text_content

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(self.api_url, json=payload, headers=headers)
                if response.status_code >= 400:
                    logger.error("Failed to send email via Resend: %s", response.text)
                    return False
                return True
        except Exception as e:
            logger.error("Error sending email via Resend: %s", e)
            return False


# Singleton provider instance
resend_provider = ResendProvider(config.RESEND_API_KEY)


async def send_notification_email(
    to: str,
    subject: str,
    template_name: str,
    context: Dict[str, Any],
) -> bool:
    """Render a template and send a notification email."""
    if not config.EMAIL_NOTIFICATIONS_ENABLED:
        logger.info("Email notifications disabled. Skipping.")
        return False

    # For now, simple string formatting, we can use Jinja2 later if needed
    # But a proper HTML template should be used in production
    html_content = _render_template(template_name, context)
    
    return await resend_provider.send_email(to, subject, html_content)


def _render_template(template_name: str, context: Dict[str, Any]) -> str:
    """Render a Jinja2 template with context."""
    # Ensure mandatory fields for base.html exist
    base_url = os.getenv("FRONTEND_URL", "https://solfoundry.org")
    token = context.get("unsubscribe_token", "default")
    
    defaults = {
        "dashboard_url": f"{base_url}/dashboard",
        "unsubscribe_url": f"{base_url}/unsubscribe?token={token}",
        "preferences_url": f"{base_url}/dashboard/settings",
        "subject": context.get("subject", "Notification from SolFoundry"),
    }
    
    full_context = {**defaults, **context}
    
    try:
        template = jinja_env.get_template(f"emails/{template_name}.html")
        return template.render(**full_context)
    except Exception as e:
        logger.error("Failed to render email template %s: %s", template_name, e)
        # Fallback to simple formatting if template fails
        return f"<html><body><h1>{full_context.get('title')}</h1><p>{full_context.get('message')}</p></body></html>"
