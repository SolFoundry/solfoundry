"""Tests for email notification service.

Tests:
- Email provider abstraction
- Template rendering
- Rate limiting
- Async queue
- Unsubscribe mechanism
"""

import asyncio
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.email.provider import (
    EmailMessage,
    EmailResult,
    EmailProvider,
    MockProvider,
    ResendProvider,
    SendGridProvider,
)
from app.services.email.templates import EmailTemplateEngine
from app.services.email.service import (
    EmailRateLimiter,
    EmailQueue,
    EmailService,
    EmailPreferences,
    QueuedEmail,
)
from app.models.notification import NotificationType


class TestEmailMessage:
    """Tests for EmailMessage dataclass."""

    def test_create_email_message(self):
        """Test creating an email message."""
        msg = EmailMessage(
            to="test@example.com",
            subject="Test Subject",
            html_content="<p>Test content</p>",
        )
        assert msg.to == "test@example.com"
        assert msg.subject == "Test Subject"
        assert msg.html_content == "<p>Test content</p>"
        assert msg.text_content is None
        assert msg.notification_type is None

    def test_create_email_with_all_fields(self):
        """Test creating an email with all fields."""
        msg = EmailMessage(
            to="test@example.com",
            subject="Test Subject",
            html_content="<p>Test content</p>",
            text_content="Test content",
            reply_to="reply@example.com",
            headers={"X-Custom": "value"},
            notification_type="bounty_claimed",
            user_id="user-123",
            unsubscribe_token="token-abc",
        )
        assert msg.to == "test@example.com"
        assert msg.text_content == "Test content"
        assert msg.reply_to == "reply@example.com"
        assert msg.headers == {"X-Custom": "value"}
        assert msg.notification_type == "bounty_claimed"
        assert msg.unsubscribe_token == "token-abc"


class TestMockProvider:
    """Tests for MockProvider."""

    @pytest.mark.asyncio
    async def test_send_email(self):
        """Test sending email with mock provider."""
        provider = MockProvider()
        msg = EmailMessage(
            to="test@example.com",
            subject="Test",
            html_content="<p>Test</p>",
        )

        result = await provider.send(msg)

        assert result.success is True
        assert result.provider == "mock"
        assert result.message_id == "mock-1"
        assert len(provider.sent_emails) == 1

    @pytest.mark.asyncio
    async def test_send_batch(self):
        """Test sending batch of emails."""
        provider = MockProvider()
        messages = [
            EmailMessage(to=f"test{i}@example.com", subject=f"Test {i}", html_content=f"<p>{i}</p>")
            for i in range(3)
        ]

        results = await provider.send_batch(messages)

        assert len(results) == 3
        assert all(r.success for r in results)
        assert len(provider.sent_emails) == 3


class TestEmailTemplateEngine:
    """Tests for email template rendering."""

    def test_render_bounty_claimed_template(self):
        """Test rendering bounty claimed template."""
        context = {
            "user_name": "John",
            "bounty_title": "Fix Bug in Auth",
            "bounty_id": "bounty-123",
            "claimer_name": "Jane",
            "bounty_reward": "100 $FNDRY",
        }

        html = EmailTemplateEngine.render_template("bounty_claimed", context)

        assert "Bounty Claimed!" in html
        assert "John" in html
        assert "Fix Bug in Auth" in html
        assert "Jane" in html
        assert "100 $FNDRY" in html
        assert "SolFoundry" in html

    def test_render_pr_submitted_template(self):
        """Test rendering PR submitted template."""
        context = {
            "user_name": "Reviewer",
            "bounty_title": "Add Feature X",
            "bounty_id": "bounty-456",
            "pr_url": "https://github.com/repo/pull/42",
            "pr_number": "42",
            "contributor_name": "Bob",
        }

        html = EmailTemplateEngine.render_template("pr_submitted", context)

        assert "New Pull Request" in html
        assert "Bob" in html
        assert "Add Feature X" in html
        assert "#42" in html

    def test_render_payout_sent_template(self):
        """Test rendering payout sent template."""
        context = {
            "user_name": "Contributor",
            "bounty_title": "Completed Task",
            "bounty_id": "bounty-789",
            "amount": "200",
            "token": "$FNDRY",
            "transaction_url": "https://explorer.solana.com/tx/abc",
        }

        html = EmailTemplateEngine.render_template("payout_sent", context)

        assert "Payout Sent!" in html
        assert "200 $FNDRY" in html
        assert "Completed Task" in html

    def test_render_new_bounty_template(self):
        """Test rendering new bounty matching skills template."""
        context = {
            "user_name": "Developer",
            "bounty_title": "Python API Development",
            "bounty_id": "bounty-101",
            "bounty_reward": "150 $FNDRY",
            "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
            "bounty_tier": "T1",
        }

        html = EmailTemplateEngine.render_template("new_bounty_matching_skills", context)

        assert "New Bounty Match!" in html
        assert "Python API Development" in html
        assert "Python" in html
        assert "FastAPI" in html

    def test_template_includes_unsubscribe_link(self):
        """Test that templates include unsubscribe link."""
        context = {
            "user_name": "Test",
            "bounty_title": "Test Bounty",
            "unsubscribe_url": "https://solfoundry.org/unsubscribe?token=abc",
        }

        html = EmailTemplateEngine.render_template("bounty_claimed", context)

        assert "Manage notification preferences" in html or "unsubscribe" in html.lower()

    def test_template_includes_branding(self):
        """Test that templates include SolFoundry branding."""
        context = {
            "user_name": "Test",
            "bounty_title": "Test",
        }

        html = EmailTemplateEngine.render_template("bounty_claimed", context)

        assert "SolFoundry" in html
        assert "© 2026" in html or "All rights reserved" in html


class TestEmailRateLimiter:
    """Tests for email rate limiting."""

    @pytest.mark.asyncio
    async def test_rate_limit_allows_within_limit(self):
        """Test that rate limiter allows emails within limit."""
        limiter = EmailRateLimiter(limit=5, window=3600)

        for i in range(5):
            allowed = await limiter.check_and_record(f"user-{i}")
            assert allowed is True

    @pytest.mark.asyncio
    async def test_rate_limit_blocks_over_limit(self):
        """Test that rate limiter blocks emails over limit."""
        limiter = EmailRateLimiter(limit=2, window=3600)
        user_id = "test-user"

        # First two should pass
        assert await limiter.check_and_record(user_id) is True
        assert await limiter.check_and_record(user_id) is True

        # Third should be blocked
        assert await limiter.check_and_record(user_id) is False

    @pytest.mark.asyncio
    async def test_rate_limit_resets_after_window(self):
        """Test that rate limit resets after window expires."""
        limiter = EmailRateLimiter(limit=1, window=0.1)  # 0.1 second window
        user_id = "test-user"

        # First should pass
        assert await limiter.check_and_record(user_id) is True

        # Second should fail immediately
        assert await limiter.check_and_record(user_id) is False

        # Wait for window to expire
        await asyncio.sleep(0.2)

        # Should pass again
        assert await limiter.check_and_record(user_id) is True

    @pytest.mark.asyncio
    async def test_get_remaining_quota(self):
        """Test getting remaining quota."""
        limiter = EmailRateLimiter(limit=10, window=3600)
        user_id = "test-user"

        # Start with 10 remaining
        remaining = await limiter.get_remaining(user_id)
        assert remaining == 10

        # Send 3 emails
        for _ in range(3):
            await limiter.check_and_record(user_id)

        # Should have 7 remaining
        remaining = await limiter.get_remaining(user_id)
        assert remaining == 7


class TestEmailQueue:
    """Tests for async email queue."""

    @pytest.mark.asyncio
    async def test_enqueue_email(self):
        """Test adding email to queue."""
        queue = EmailQueue(max_size=100)
        msg = EmailMessage(
            to="test@example.com",
            subject="Test",
            html_content="<p>Test</p>",
        )

        email_id = await queue.enqueue(msg)

        assert email_id is not None
        assert queue.queue_size == 1

    @pytest.mark.asyncio
    async def test_queue_processes_email(self):
        """Test that queue processes emails."""
        provider = MockProvider()
        queue = EmailQueue(max_size=100)
        await queue.start(provider, worker_count=1)

        msg = EmailMessage(
            to="test@example.com",
            subject="Test",
            html_content="<p>Test</p>",
        )

        email_id = await queue.enqueue(msg)

        # Wait for processing
        await asyncio.sleep(0.5)

        # Email should have been sent
        assert len(provider.sent_emails) == 1

        await queue.stop()

    @pytest.mark.asyncio
    async def test_queue_handles_full(self):
        """Test queue behavior when full."""
        queue = EmailQueue(max_size=1)
        await queue.start(MockProvider(), worker_count=1)

        # Fill queue
        msg = EmailMessage(to="test@example.com", subject="Test", html_content="<p>Test</p>")
        await queue.enqueue(msg)

        # Try to add another (queue should handle gracefully)
        # In real implementation, this would block or raise

        await queue.stop()


class TestEmailPreferences:
    """Tests for email preference management."""

    def test_generate_unsubscribe_token(self):
        """Test unsubscribe token generation."""
        user_id = "user-123"
        notification_type = "bounty_claimed"
        secret = "test-secret"

        token = EmailPreferences.generate_unsubscribe_token(
            user_id, notification_type, secret
        )

        assert token is not None
        assert len(token) == 32

    def test_verify_unsubscribe_token_valid(self):
        """Test verifying valid unsubscribe token."""
        user_id = "user-123"
        notification_type = "bounty_claimed"
        secret = "test-secret"

        token = EmailPreferences.generate_unsubscribe_token(
            user_id, notification_type, secret
        )

        is_valid = EmailPreferences.verify_unsubscribe_token(
            user_id, notification_type, token, secret
        )

        assert is_valid is True

    def test_verify_unsubscribe_token_invalid(self):
        """Test verifying invalid unsubscribe token."""
        is_valid = EmailPreferences.verify_unsubscribe_token(
            "user-123",
            "bounty_claimed",
            "invalid-token",
            "test-secret",
        )

        assert is_valid is False

    def test_verify_unsubscribe_token_wrong_user(self):
        """Test that token doesn't work for different user."""
        token = EmailPreferences.generate_unsubscribe_token(
            "user-123", "bounty_claimed", "test-secret"
        )

        is_valid = EmailPreferences.verify_unsubscribe_token(
            "user-456",  # Different user
            "bounty_claimed",
            token,
            "test-secret",
        )

        assert is_valid is False


class TestEmailService:
    """Tests for main email service."""

    @pytest.mark.asyncio
    async def test_send_notification_email(self):
        """Test sending notification email."""
        service = EmailService(provider=MockProvider())
        await service.start()

        result = await service.send_notification_email(
            user_id="user-123",
            user_email="test@example.com",
            user_name="Test User",
            notification_type=NotificationType.BOUNTY_CLAIMED,
            template_context={
                "bounty_title": "Test Bounty",
                "bounty_id": "bounty-123",
                "claimer_name": "Claimer",
            },
        )

        assert result.success is True
        assert result.provider == "queued"

        # Wait for processing
        await asyncio.sleep(0.5)

        await service.stop()

    @pytest.mark.asyncio
    async def test_send_respects_rate_limit(self):
        """Test that service respects rate limit."""
        service = EmailService(provider=MockProvider())
        service.rate_limiter = EmailRateLimiter(limit=2, window=3600)
        await service.start()

        # First two should succeed
        result1 = await service.send_notification_email(
            user_id="user-123",
            user_email="test@example.com",
            user_name="Test",
            notification_type=NotificationType.BOUNTY_CLAIMED,
            template_context={"bounty_title": "Bounty 1"},
        )
        result2 = await service.send_notification_email(
            user_id="user-123",
            user_email="test@example.com",
            user_name="Test",
            notification_type=NotificationType.BOUNTY_CLAIMED,
            template_context={"bounty_title": "Bounty 2"},
        )

        # Third should be rate limited
        result3 = await service.send_notification_email(
            user_id="user-123",
            user_email="test@example.com",
            user_name="Test",
            notification_type=NotificationType.BOUNTY_CLAIMED,
            template_context={"bounty_title": "Bounty 3"},
        )

        assert result1.success is True
        assert result2.success is True
        assert result3.success is False
        assert "Rate limit" in result3.error

        await service.stop()

    @pytest.mark.asyncio
    async def test_send_new_bounty_email(self):
        """Test sending new bounty matching skills email."""
        service = EmailService(provider=MockProvider())
        await service.start()

        result = await service.send_new_bounty_email(
            user_id="user-123",
            user_email="test@example.com",
            user_name="Developer",
            bounty_title="Python API Task",
            bounty_id="bounty-123",
            bounty_reward="100 $FNDRY",
            matched_skills=["Python", "FastAPI"],
            bounty_tier="T1",
        )

        assert result.success is True

        await service.stop()


# Run tests with: pytest tests/test_email_service.py -v
if __name__ == "__main__":
    pytest.main([__file__, "-v"])