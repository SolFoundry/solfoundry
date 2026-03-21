"""Email notification service.

Handles asynchronous dispatch of transactional emails via Resend/SendGrid APIs.
Includes retry logic, Jinja-like template rendering, async queueing,
rate limiting, user preferences, and unsubscribe mechanics.
"""
import os
import asyncio
import time
import httpx
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# --- Mock Database for Rate Limits & Preferences ---
# In a real app, these would be Redis and PostgreSQL.
# Limit: 10 emails per hour per user
_RATE_LIMIT_STORE: Dict[str, List[float]] = {}
_USER_PREFERENCES: Dict[str, Dict[str, bool]] = {}  # user_email -> {notification_type: enabled}
_UNSUBSCRIBED: Dict[str, bool] = {} # user_email -> fully unsubscribed?

# --- Async Queue ---
_EMAIL_QUEUE = asyncio.Queue()

class EmailProvider:
    """Abstract interface for email providers."""
    async def send(self, to_address: str, subject: str, html_body: str) -> bool:
        """Send."""
        raise NotImplementedError

class ResendProvider(EmailProvider):
    """ResendProvider."""
    def __init__(self, api_key: str):
        """Initialize the instance."""
        self.api_key = api_key
        self.base_url = "https://api.resend.com/emails"

    async def send(self, to_address: str, subject: str, html_body: str) -> bool:
        """Send."""
        if not self.api_key:
            raise ValueError("Email provider API key is not configured.")
            
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.base_url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "from": "SolFoundry <noreply@solfoundry.org>",
                        "to": [to_address],
                        "subject": subject,
                        "html": html_body
                    },
                    timeout=5.0
                )
                response.raise_for_status()
                return True
            except httpx.HTTPStatusError as e:
                logger.error(f"Resend API error: {e.response.text}")
                raise
            except httpx.RequestError as e:
                logger.error(f"Network error communicating with Resend: {e}")
                raise

class EmailService:
    """EmailService."""
    def __init__(self, provider: EmailProvider = None):
        """Initialize the instance."""
        api_key = os.environ.get("RESEND_API_KEY", "dummy_key_for_test")
        self.provider = provider or ResendProvider(api_key=api_key)
        
    def _check_rate_limit(self, email: str) -> bool:
        """Check if user has exceeded 10 emails per 3600 seconds."""
        now = time.time()
        timestamps = _RATE_LIMIT_STORE.get(email, [])
        # Keep only timestamps in the last hour
        timestamps = [t for t in timestamps if now - t < 3600]
        if len(timestamps) >= 10:
            return False
        
        timestamps.append(now)
        _RATE_LIMIT_STORE[email] = timestamps
        return True

    def _can_send(self, email: str, notification_type: str) -> bool:
        """Can send."""
        if _UNSUBSCRIBED.get(email, False):
            return False
        prefs = _USER_PREFERENCES.get(email, {})
        # Default to True if preference not explicitly disabled
        return prefs.get(notification_type, True)
        
    def render_template(self, template_name: str, context: Dict[str, Any]) -> str:
        """Render branded HTML templates."""
        brand_header = """
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <img src="https://solfoundry.org/logo.png" alt="SolFoundry Logo" style="max-height: 50px;" />
        </div>
        """
        brand_footer = f"""
        <div style="margin-top: 20px; font-size: 12px; color: #888;">
            <p>You received this because you are part of SolFoundry.</p>
            <p><a href="https://solfoundry.org/unsubscribe?email={context.get('email', '')}&type={context.get('notification_type', 'general')}">Unsubscribe</a></p>
        </div>
        """

        body = ""
        if template_name == "bounty_event":
            body = f"""
            <h2>Bounty Update: {context.get('bounty_title', 'Unknown')}</h2>
            <p>Event: <strong>{context.get('event_type', 'Status Changed')}</strong></p>
            <p>{context.get('message', '')}</p>
            <a href="{context.get('bounty_url', '#')}" style="padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">View Bounty</a>
            """
        elif template_name == "welcome":
            body = f"""
            <h2>Welcome to SolFoundry, {context.get('name', 'Developer')}!</h2>
            <p>Start building the future on Solana.</p>
            """
        else:
            body = f"<p>{context.get('message', 'Notification')}</p>"

        return f"<html><body>{brand_header}<div style='padding: 20px;'>{body}</div>{brand_footer}</body></html>"

    async def _process_send(self, to_address: str, subject: str, template_name: str, context: Dict[str, Any], notification_type: str):
        """Process send."""
        if not self._can_send(to_address, notification_type):
            logger.info(f"Skipping email to {to_address} due to preferences.")
            return False

        if not self._check_rate_limit(to_address):
            logger.warning(f"Rate limit exceeded for {to_address}.")
            return False

        context['email'] = to_address
        context['notification_type'] = notification_type
        html_body = self.render_template(template_name, context)

        # Retry logic
        retries = 3
        for attempt in range(retries):
            try:
                await self.provider.send(to_address, subject, html_body)
                return True
            except Exception as e:
                logger.error(f"Email sending failed (attempt {attempt+1}/{retries}): {e}")
                if attempt == retries - 1:
                    logger.error(f"Final failure sending email to {to_address}")
                    return False
                await asyncio.sleep(2 ** attempt)
        return False

    async def send_email_async(self, to_address: str, subject: str, template_name: str, context: Dict[str, Any], notification_type: str = "general") -> bool:
        """Queue an email for background sending."""
        await _EMAIL_QUEUE.put({
            "to_address": to_address,
            "subject": subject,
            "template_name": template_name,
            "context": context,
            "notification_type": notification_type
        })
        return True

async def email_worker(service: EmailService):
    """Background worker to process the async queue."""
    while True:
        task = await _EMAIL_QUEUE.get()
        try:
            await service._process_send(**task)
        except Exception as e:
            logger.error(f"Worker error: {e}")
        finally:
            _EMAIL_QUEUE.task_done()

def start_email_worker(app_loop: asyncio.AbstractEventLoop):
    """Start email worker."""
    service = EmailService()
    app_loop.create_task(email_worker(service))

# Helper to manage preferences
def set_preference(email: str, notification_type: str, enabled: bool):
    """Set preference."""
    if email not in _USER_PREFERENCES:
        _USER_PREFERENCES[email] = {}
    _USER_PREFERENCES[email][notification_type] = enabled

def unsubscribe_all(email: str):
    """Unsubscribe all."""
    _UNSUBSCRIBED[email] = True
