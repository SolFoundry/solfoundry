"""Email notification service for SolFoundry.

This module provides email delivery capabilities with:
- Provider abstraction (Resend/SendGrid)
- HTML templates with SolFoundry branding
- Rate limiting (10 emails/hour per user)
- Async queue for non-blocking delivery
- Unsubscribe mechanism
"""

from app.services.email.provider import EmailProvider, get_email_provider
from app.services.email.service import EmailService, get_email_service
from app.services.email.templates import EmailTemplateEngine

__all__ = [
    "EmailProvider",
    "EmailService",
    "EmailTemplateEngine",
    "get_email_provider",
    "get_email_service",
]