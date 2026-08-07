"""Email notification service for SolFoundry bounty updates.

Sends notifications via SendGrid when configured, otherwise falls back to
logging the outbound email (development mode). Uses httpx (already a
backend dependency) for the SendGrid REST API.
"""

from __future__ import annotations

import logging
import os
from typing import Optional, Sequence

import httpx

from app.email_templates import (
    bounty_status_email,
    digest_email,
    new_bounty_email,
    payout_email,
)

logger = logging.getLogger(__name__)

SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send"


class EmailService:
    """Sends HTML email via SendGrid (or logs in dev mode)."""

    def __init__(self) -> None:
        self.from_email = os.getenv("FROM_EMAIL", "noreply@solfoundry.xyz")
        self.api_key = os.getenv("SENDGRID_API_KEY", "")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def send_email(
        self,
        to: str,
        subject: str,
        html_body: str,
        tracking_id: Optional[str] = None,
    ) -> bool:
        """Deliver an HTML email. Returns True on success (or dev-mode log)."""
        if not self.enabled:
            logger.info("[DEV] email to=%s subject=%s", to, subject)
            return True

        payload = {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": self.from_email, "name": "SolFoundry"},
            "subject": subject,
            "content": [{"type": "text/html", "value": html_body}],
        }
        if tracking_id:
            payload["custom_args"] = {"tracking_id": tracking_id}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    SENDGRID_API_URL,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
            if resp.status_code in (200, 202):
                logger.info("sent email to=%s tracking=%s", to, tracking_id)
                return True
            logger.error(
                "sendgrid error status=%s body=%s", resp.status_code, resp.text
            )
            return False
        except httpx.HTTPError as exc:
            logger.error("failed to send email to=%s: %s", to, exc)
            return False

    async def send_new_bounty_notification(
        self,
        to: str,
        username: str,
        bounty_title: str,
        bounty_tier: str,
        reward: str,
        skills: Sequence[str],
        bounty_url: str,
        tracking_id: Optional[str] = None,
    ) -> bool:
        html = new_bounty_email(username, bounty_title, bounty_tier, reward, skills, bounty_url)
        return await self.send_email(
            to, f"🔨 New Bounty: {bounty_title}", html, tracking_id=tracking_id
        )

    async def send_status_update(
        self,
        to: str,
        username: str,
        bounty_title: str,
        status: str,
        details: str,
        bounty_url: str,
        tracking_id: Optional[str] = None,
    ) -> bool:
        html = bounty_status_email(username, bounty_title, status, details, bounty_url)
        return await self.send_email(
            to, f"📋 Update: {bounty_title}", html, tracking_id=tracking_id
        )

    async def send_payout_notification(
        self,
        to: str,
        username: str,
        bounty_title: str,
        amount: str,
        tx_url: str,
        tracking_id: Optional[str] = None,
    ) -> bool:
        html = payout_email(username, bounty_title, amount, tx_url)
        return await self.send_email(
            to, f"💰 Payout: {amount}", html, tracking_id=tracking_id
        )

    async def send_weekly_digest(
        self,
        to: str,
        username: str,
        new_bounties: Sequence[dict],
        completed_bounties: Sequence[dict],
        bounties_url: str,
        digest_type: str = "weekly",
        tracking_id: Optional[str] = None,
    ) -> bool:
        html = digest_email(username, new_bounties, completed_bounties, bounties_url, digest_type)
        return await self.send_email(
            to, f"📊 {digest_type.title()} Digest", html, tracking_id=tracking_id
        )


email_service = EmailService()