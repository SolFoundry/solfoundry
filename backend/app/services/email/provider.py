"""Email provider abstraction layer.

Supports multiple email providers (Resend, SendGrid) with a unified interface.
"""

import abc
import logging
import os
from dataclasses import dataclass
from email.utils import formataddr
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# Configuration
EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "resend").lower()
EMAIL_FROM_ADDRESS = os.getenv("EMAIL_FROM_ADDRESS", "noreply@solfoundry.org")
EMAIL_FROM_NAME = os.getenv("EMAIL_FROM_NAME", "SolFoundry")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")


@dataclass
class EmailMessage:
    """Email message data structure."""

    to: str  # Recipient email
    subject: str
    html_content: str
    text_content: Optional[str] = None
    reply_to: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    # For tracking/unsubscribe
    notification_type: Optional[str] = None
    user_id: Optional[str] = None
    unsubscribe_token: Optional[str] = None


@dataclass
class EmailResult:
    """Result of email sending operation."""

    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    provider: Optional[str] = None


class EmailProvider(abc.ABC):
    """Abstract base class for email providers."""

    @abc.abstractmethod
    async def send(self, message: EmailMessage) -> EmailResult:
        """Send an email message.

        Args:
            message: The email message to send.

        Returns:
            EmailResult with success status and details.
        """
        pass

    @abc.abstractmethod
    async def send_batch(self, messages: List[EmailMessage]) -> List[EmailResult]:
        """Send multiple emails in batch.

        Args:
            messages: List of email messages to send.

        Returns:
            List of EmailResult for each message.
        """
        pass

    def _format_from_address(self) -> str:
        """Format the from address with name."""
        return formataddr((EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS))


class ResendProvider(EmailProvider):
    """Resend email provider implementation."""

    API_URL = "https://api.resend.com/emails"

    def __init__(self, api_key: str = RESEND_API_KEY):
        """Initialize Resend provider."""
        if not api_key:
            raise ValueError("RESEND_API_KEY is required for Resend provider")
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def send(self, message: EmailMessage) -> EmailResult:
        """Send email via Resend API."""
        payload = self._build_payload(message)

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    self.API_URL, headers=self.headers, json=payload
                )

                if response.status_code in (200, 201):
                    data = response.json()
                    return EmailResult(
                        success=True,
                        message_id=data.get("id"),
                        provider="resend",
                    )
                else:
                    error_data = response.json() if response.content else {}
                    error_msg = error_data.get("message", f"HTTP {response.status_code}")
                    logger.error(f"Resend API error: {error_msg}")
                    return EmailResult(
                        success=False,
                        error=error_msg,
                        provider="resend",
                    )
            except httpx.TimeoutException:
                logger.error("Resend API timeout")
                return EmailResult(success=False, error="Request timeout", provider="resend")
            except Exception as e:
                logger.exception(f"Resend API error: {e}")
                return EmailResult(success=False, error=str(e), provider="resend")

    async def send_batch(self, messages: List[EmailMessage]) -> List[EmailResult]:
        """Send multiple emails (sequential to avoid rate limits)."""
        results = []
        for msg in messages:
            result = await self.send(msg)
            results.append(result)
        return results

    def _build_payload(self, message: EmailMessage) -> Dict[str, Any]:
        """Build Resend API payload."""
        payload = {
            "from": self._format_from_address(),
            "to": [message.to],
            "subject": message.subject,
            "html": message.html_content,
        }

        if message.text_content:
            payload["text"] = message.text_content

        if message.reply_to:
            payload["reply_to"] = message.reply_to

        # Add headers for tracking and unsubscribe
        headers = dict(message.headers or {})
        if message.unsubscribe_token:
            # List-Unsubscribe header for email clients
            unsubscribe_url = f"https://solfoundry.org/unsubscribe?token={message.unsubscribe_token}"
            headers["List-Unsubscribe"] = f"<{unsubscribe_url}>"
            headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

        if headers:
            payload["headers"] = headers

        return payload


class SendGridProvider(EmailProvider):
    """SendGrid email provider implementation."""

    API_URL = "https://api.sendgrid.com/v3/mail/send"

    def __init__(self, api_key: str = SENDGRID_API_KEY):
        """Initialize SendGrid provider."""
        if not api_key:
            raise ValueError("SENDGRID_API_KEY is required for SendGrid provider")
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def send(self, message: EmailMessage) -> EmailResult:
        """Send email via SendGrid API."""
        payload = self._build_payload(message)

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    self.API_URL, headers=self.headers, json=payload
                )

                if response.status_code == 202:
                    message_id = response.headers.get("X-Message-Id")
                    return EmailResult(
                        success=True,
                        message_id=message_id,
                        provider="sendgrid",
                    )
                else:
                    error_data = response.json() if response.content else {}
                    error_msg = error_data.get("message", {}).get("value", f"HTTP {response.status_code}")
                    logger.error(f"SendGrid API error: {error_msg}")
                    return EmailResult(
                        success=False,
                        error=error_msg,
                        provider="sendgrid",
                    )
            except httpx.TimeoutException:
                logger.error("SendGrid API timeout")
                return EmailResult(success=False, error="Request timeout", provider="sendgrid")
            except Exception as e:
                logger.exception(f"SendGrid API error: {e}")
                return EmailResult(success=False, error=str(e), provider="sendgrid")

    async def send_batch(self, messages: List[EmailMessage]) -> List[EmailResult]:
        """Send multiple emails (sequential to avoid rate limits)."""
        results = []
        for msg in messages:
            result = await self.send(msg)
            results.append(result)
        return results

    def _build_payload(self, message: EmailMessage) -> Dict[str, Any]:
        """Build SendGrid API payload."""
        content = [{"type": "text/html", "value": message.html_content}]
        if message.text_content:
            content.insert(0, {"type": "text/plain", "value": message.text_content})

        payload = {
            "personalizations": [
                {
                    "to": [{"email": message.to}],
                }
            ],
            "from": {"email": EMAIL_FROM_ADDRESS, "name": EMAIL_FROM_NAME},
            "subject": message.subject,
            "content": content,
        }

        # Add custom headers
        headers = dict(message.headers or {})
        if message.unsubscribe_token:
            unsubscribe_url = f"https://solfoundry.org/unsubscribe?token={message.unsubscribe_token}"
            headers["List-Unsubscribe"] = f"<{unsubscribe_url}>"
            headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

        if headers:
            payload["headers"] = headers

        return payload


class MockProvider(EmailProvider):
    """Mock email provider for development/testing."""

    def __init__(self):
        """Initialize mock provider."""
        self.sent_emails: List[EmailMessage] = []

    async def send(self, message: EmailMessage) -> EmailResult:
        """Mock send - stores email in memory."""
        self.sent_emails.append(message)
        logger.info(f"[MOCK EMAIL] To: {message.to}, Subject: {message.subject}")
        return EmailResult(
            success=True,
            message_id=f"mock-{len(self.sent_emails)}",
            provider="mock",
        )

    async def send_batch(self, messages: List[EmailMessage]) -> List[EmailResult]:
        """Mock batch send."""
        return [await self.send(msg) for msg in messages]


def get_email_provider() -> EmailProvider:
    """Get configured email provider instance.

    Returns:
        EmailProvider instance based on EMAIL_PROVIDER env var.
    """
    if EMAIL_PROVIDER == "resend":
        if not RESEND_API_KEY:
            logger.warning("RESEND_API_KEY not set, using mock provider")
            return MockProvider()
        return ResendProvider()
    elif EMAIL_PROVIDER == "sendgrid":
        if not SENDGRID_API_KEY:
            logger.warning("SENDGRID_API_KEY not set, using mock provider")
            return MockProvider()
        return SendGridProvider()
    else:
        logger.warning(f"Unknown email provider: {EMAIL_PROVIDER}, using mock provider")
        return MockProvider()