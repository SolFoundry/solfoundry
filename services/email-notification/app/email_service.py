"""Email delivery service with SMTP, bounce handling, and rate limiting."""

import logging
import re
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from jinja2 import Template

from .config import settings
from .models import DeliveryStatus, EmailNotification, EventType
from .templates import EMAIL_TEMPLATES

logger = logging.getLogger(__name__)


class EmailService:
    """Handles construction and delivery of email notifications."""

    def __init__(self):
        self._smtp = None
        self._sent_count_minute = 0
        self._sent_count_hour = 0
        self._minute_start = datetime.utcnow()
        self._hour_start = datetime.utcnow()

    def _check_rate_limit(self) -> bool:
        """Check if we're within rate limits."""
        now = datetime.utcnow()

        # Reset minute counter
        if (now - self._minute_start).total_seconds() >= 60:
            self._sent_count_minute = 0
            self._minute_start = now

        # Reset hour counter
        if (now - self._hour_start).total_seconds() >= 3600:
            self._sent_count_hour = 0
            self._hour_start = now

        return (
            self._sent_count_minute < settings.max_emails_per_minute
            and self._sent_count_hour < settings.max_emails_per_hour
        )

    def _connect_smtp(self) -> smtplib.SMTP:
        """Establish SMTP connection."""
        if settings.smtp_host == "localhost" and settings.smtp_port == 587:
            # Use aiohttp or mock for testing
            pass

        smtp = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30)
        smtp.ehlo()

        if settings.smtp_use_tls:
            smtp.starttls()
            smtp.ehlo()

        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)

        return smtp

    def _build_message(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        plain_body: Optional[str] = None,
    ) -> MIMEMultipart:
        """Build a MIME multipart email message."""
        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.email_from_name} <{settings.email_from}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg["X-SolFoundry"] = "email-notification"
        msg["List-Unsubscribe"] = f"<mailto:unsubscribe@{settings.email_from.split('@')[1]}>"

        # Plain text fallback
        if plain_body:
            msg.attach(MIMEText(plain_body, "plain"))

        # HTML version
        msg.attach(MIMEText(html_body, "html"))

        return msg

    def render_template(
        self,
        event_type: str,
        template_vars: dict,
        is_digest: bool = False,
    ) -> tuple[str, str]:
        """Render an email template with Jinja2 variables.

        Returns:
            Tuple of (subject, html_body)
        """
        template_key = "digest" if is_digest else event_type
        template_config = EMAIL_TEMPLATES.get(template_key)

        if not template_config:
            raise ValueError(f"Unknown template: {event_type}")

        subject = Template(template_config["subject"]).render(**template_vars)
        html_body = Template(template_config["html"]).render(**template_vars)

        return subject, html_body

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        plain_body: Optional[str] = None,
    ) -> DeliveryStatus:
        """Send a single email via SMTP.

        Args:
            to_email: Recipient email address
            subject: Email subject line
            html_body: HTML email body
            plain_body: Optional plain text fallback

        Returns:
            DeliveryStatus with result
        """
        if not self._check_rate_limit():
            logger.warning("Rate limit exceeded, skipping email to %s", to_email)
            return DeliveryStatus(
                notification_id="",
                status="failed",
                error="Rate limit exceeded",
            )

        if not self._is_valid_email(to_email):
            logger.warning("Invalid email address: %s", to_email)
            return DeliveryStatus(
                notification_id="",
                status="failed",
                error=f"Invalid email: {to_email}",
            )

        try:
            msg = self._build_message(to_email, subject, html_body, plain_body)

            smtp = self._connect_smtp()
            smtp.sendmail(settings.email_from, [to_email], msg.as_string())
            smtp.quit()

            self._sent_count_minute += 1
            self._sent_count_hour += 1

            logger.info("Email sent to %s: %s", to_email, subject)
            return DeliveryStatus(
                notification_id="",
                status="sent",
                sent_at=datetime.utcnow(),
            )

        except smtplib.SMTPRecipientsRefused as e:
            logger.error("Bounce detected for %s: %s", to_email, e)
            return DeliveryStatus(
                notification_id="",
                status="bounced",
                error=str(e),
            )

        except (smtplib.SMTPException, ConnectionError, TimeoutError) as e:
            logger.error("SMTP error sending to %s: %s", to_email, e)
            return DeliveryStatus(
                notification_id="",
                status="failed",
                error=str(e),
            )

    def send_bounty_notification(
        self,
        to_email: str,
        event_type: str,
        template_vars: dict,
    ) -> DeliveryStatus:
        """Render and send a bounty notification email.

        Args:
            to_email: Recipient email
            event_type: One of 'bounty_posted', 'bounty_updated', 'bounty_completed'
            template_vars: Template variables (bounty_title, reward, tier, etc.)

        Returns:
            DeliveryStatus
        """
        # Add common variables
        template_vars.setdefault(
            "preferences_url",
            f"https://solfoundry.org/settings/notifications",
        )
        template_vars.setdefault(
            "unsubscribe_url",
            f"https://solfoundry.org/settings/notifications?unsubscribe=1",
        )

        subject, html_body = self.render_template(event_type, template_vars)
        plain_body = self._strip_html(html_body)

        return self.send_email(to_email, subject, html_body, plain_body)

    def send_digest(
        self,
        to_email: str,
        events: list[dict],
        frequency: str,
        digest_date: str,
    ) -> DeliveryStatus:
        """Send a daily or weekly digest email.

        Args:
            to_email: Recipient email
            events: List of event dicts with bounty_title, event_type, etc.
            frequency: 'daily' or 'weekly'
            digest_date: Date string for the digest

        Returns:
            DeliveryStatus
        """
        new_count = sum(1 for e in events if e.get("event_type") == "bounty_posted")
        updated_count = sum(1 for e in events if e.get("event_type") == "bounty_updated")
        completed_count = sum(1 for e in events if e.get("event_type") == "bounty_completed")

        template_vars = {
            "events": events,
            "frequency": frequency,
            "digest_date": digest_date,
            "new_count": new_count,
            "updated_count": updated_count,
            "completed_count": completed_count,
            "preferences_url": "https://solfoundry.org/settings/notifications",
            "unsubscribe_url": "https://solfoundry.org/settings/notifications?unsubscribe=1",
        }

        subject, html_body = self.render_template("digest", template_vars, is_digest=True)
        plain_body = self._strip_html(html_body)

        return self.send_email(to_email, subject, html_body, plain_body)

    @staticmethod
    def _is_valid_email(email: str) -> bool:
        """Basic email validation."""
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return bool(re.match(pattern, email))

    @staticmethod
    def _strip_html(html: str) -> str:
        """Strip HTML tags for plain text fallback."""
        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text).strip()
        return text[:500]  # Truncate for plain text


# Singleton instance
email_service = EmailService()