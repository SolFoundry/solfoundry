"""Email notification service for SolFoundry bounty updates."""

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

import httpx

from app.config import settings
from app.email_templates import (
    new_bounty_email,
    bounty_status_email,
    payout_email,
    digest_email,
)

logger = logging.getLogger(__name__)


class NotificationFrequency(str, Enum):
    instant = "instant"
    daily = "daily"
    weekly = "weekly"
    off = "off"


class EmailService:
    """Sends email notifications via SMTP or transactional email API."""

    def __init__(self):
        self.smtp_host = getattr(settings, "SMTP_HOST", "")
        self.smtp_port = int(getattr(settings, "SMTP_PORT", "587"))
        self.smtp_user = getattr(settings, "SMTP_USER", "")
        self.smtp_pass = getattr(settings, "SMTP_PASS", "")
        self.from_email = getattr(settings, "FROM_EMAIL", "noreply@solfoundry.xyz")
        self.api_key = getattr(settings, "EMAIL_API_KEY", "")  # SendGrid/Mailgun

    async def send_email(
        self,
        to: str,
        subject: str,
        html_body: str,
        tracking_id: Optional[str] = None,
    ) -> bool:
        """Send an HTML email. Returns True if successful."""
        try:
            # Use SendGrid API if configured
            if self.api_key:
                async with httpx.AsyncClient() as client:
                    resp = await client.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "personalizations": [{"to": [{"email": to}]}],
                            "from": {"email": self.from_email, "name": "SolFoundry"},
                            "subject": subject,
                            "content": [{"type": "text/html", "value": html_body}],
                            "custom_args": {
                                "tracking_id": tracking_id or "",
                            },
                        },
                    )
                    if resp.status_code in (200, 202):
                        logger.info(f"Email sent to {to} (tracking: {tracking_id})")
                        return True
                    else:
                        logger.error(f"Email API error: {resp.status_code} {resp.text}")
                        return False
            else:
                # Fallback: log email for development
                logger.info(f"[DEV] Email to {to}: {subject}")
                return True

        except Exception as e:
            logger.error(f"Failed to send email to {to}: {e}")
            return False

    async def send_new_bounty_notification(
        self,
        to: str,
        username: str,
        bounty_title: str,
        bounty_tier: str,
        reward: str,
        skills: list[str],
        bounty_url: str,
    ) -> bool:
        """Send new bounty notification email."""
        html = new_bounty_email(username, bounty_title, bounty_tier, reward, skills, bounty_url)
        return await self.send_email(to, f"🔨 New Bounty: {bounty_title}", html)

    async def send_status_update(
        self,
        to: str,
        username: str,
        bounty_title: str,
        status: str,
        details: str,
        bounty_url: str,
    ) -> bool:
        """Send bounty status change email."""
        html = bounty_status_email(username, bounty_title, status, details, bounty_url)
        return await self.send_email(to, f"📋 Update: {bounty_title}", html)

    async def send_payout_notification(
        self,
        to: str,
        username: str,
        bounty_title: str,
        amount: str,
        tx_url: str,
    ) -> bool:
        """Send payout confirmation email."""
        html = payout_email(username, bounty_title, amount, tx_url)
        return await self.send_email(to, f"💰 Payout: {amount} $FNDRY", html)

    async def send_weekly_digest(
        self,
        to: str,
        username: str,
        new_bounties: list[dict],
        completed_bounties: list[dict],
        bounties_url: str,
    ) -> bool:
        """Send weekly digest email."""
        html = digest_email(username, new_bounties, completed_bounties, bounties_url)
        return await self.send_email(to, "📊 SolFoundry Weekly Digest", html)


# Singleton
email_service = EmailService()
