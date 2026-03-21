"""Tests for the email notification service."""

import pytest
import asyncio
from src.services.email import (
    EmailService, EmailProvider, _RATE_LIMIT_STORE, _USER_PREFERENCES,
    _UNSUBSCRIBED, _EMAIL_QUEUE, set_preference, unsubscribe_all
)

class MockProvider(EmailProvider):
    """MockProvider."""
    def __init__(self):
        """Initialize the instance."""
        self.calls = []
        self.should_fail = False

    async def send(self, to_address: str, subject: str, html_body: str) -> bool:
        """Send."""
        if self.should_fail:
            raise Exception("Mock provider network error")
        self.calls.append({"to": to_address, "subject": subject, "body": html_body})
        return True

@pytest.fixture
def service():
    # Reset globals
    """Service."""
    _RATE_LIMIT_STORE.clear()
    _USER_PREFERENCES.clear()
    _UNSUBSCRIBED.clear()
    while not _EMAIL_QUEUE.empty():
        _EMAIL_QUEUE.get_nowait()
        
    provider = MockProvider()
    return EmailService(provider=provider), provider

@pytest.mark.asyncio
async def test_successful_email_delivery(service):
    """Test successful email delivery."""
    svc, provider = service
    
    # Direct send test
    result = await svc._process_send("dev@sol.com", "Test", "welcome", {"name": "Alice"}, "system")
    assert result is True
    assert len(provider.calls) == 1
    assert provider.calls[0]["to"] == "dev@sol.com"
    assert "Alice" in provider.calls[0]["body"]
    assert "solfoundry.org/logo.png" in provider.calls[0]["body"]  # check branding

@pytest.mark.asyncio
async def test_bounty_event_template(service):
    """Test bounty event template."""
    svc, provider = service
    ctx = {
        "bounty_title": "Build AI MVP",
        "event_type": "Resolved",
        "message": "The bounty has been closed.",
        "bounty_url": "http://localhost/bounty/1"
    }
    await svc._process_send("dev@sol.com", "Bounty Closed", "bounty_event", ctx, "bounty_event")
    body = provider.calls[0]["body"]
    assert "Build AI MVP" in body
    assert "Resolved" in body
    assert "Background" not in body # random fallback check
    assert 'href="http://localhost/bounty/1"' in body

@pytest.mark.asyncio
async def test_unsubscribe_and_preferences(service):
    """Test unsubscribe and preferences."""
    svc, provider = service
    
    # 1. Test basic unsuball
    unsubscribe_all("angry@user.com")
    res = await svc._process_send("angry@user.com", "Spam", "welcome", {}, "marketing")
    assert res is False
    assert len(provider.calls) == 0
    
    # 2. Test specific pref
    set_preference("picky@user.com", "bounty_event", False)
    res1 = await svc._process_send("picky@user.com", "Update", "welcome", {}, "bounty_event")
    res2 = await svc._process_send("picky@user.com", "Update", "welcome", {}, "system")
    assert res1 is False
    assert res2 is True
    assert len(provider.calls) == 1

@pytest.mark.asyncio
async def test_rate_limiting(service):
    """Test rate limiting."""
    svc, provider = service
    
    # Send 10 emails quickly
    for i in range(10):
        res = await svc._process_send("spammer@sol.com", f"Spam {i}", "welcome", {}, "general")
        assert res is True
        
    # The 11th should be blocked
    res = await svc._process_send("spammer@sol.com", "Spam 11", "welcome", {}, "general")
    assert res is False
    assert len(provider.calls) == 10

@pytest.mark.asyncio
async def test_provider_failure_and_retries(service):
    """Test provider failure and retries."""
    svc, provider = service
    provider.should_fail = True
    
    import backend.src.services.email as email_module
    original_sleep = email_module.asyncio.sleep
    email_module.asyncio.sleep = lambda x: asyncio.sleep(0)  # Mock sleep to be instant
    
    res = await svc._process_send("fail@sol.com", "Fail Test", "welcome", {}, "general")
    assert res is False
    
    email_module.asyncio.sleep = original_sleep  # Restore

@pytest.mark.asyncio
async def test_async_queue_enqueuing():
    """Test async queue enqueuing."""
    svc = EmailService()
    # Puts it in the queue for the background worker
    res = await svc.send_email_async("queue@sol.com", "Subject", "welcome", {}, "general")
    assert res is True
    assert _EMAIL_QUEUE.qsize() == 1
    
    task = await _EMAIL_QUEUE.get()
    assert task["to_address"] == "queue@sol.com"
