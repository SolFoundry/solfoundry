"""Unit tests for email notification service."""

import pytest
from app.services.email_service import (
    _check_rate_limit,
    _is_valid_email,
    _render_template,
    EmailPayload,
    EmailTemplateContext,
)
from app.models.notification import NotificationType


class TestRateLimiting:
    def test_allows_under_limit(self):
        uid = "test-rate-uid-1"
        for _ in range(10):
            assert _check_rate_limit(uid) is True

    def test_blocks_over_limit(self):
        uid = "test-rate-uid-2"
        for _ in range(10):
            _check_rate_limit(uid)
        assert _check_rate_limit(uid) is False


class TestEmailValidation:
    def test_valid_emails(self):
        assert _is_valid_email("user@example.com") is True
        assert _is_valid_email("user+tag@sub.example.co") is True

    def test_invalid_emails(self):
        assert _is_valid_email("") is False
        assert _is_valid_email("no-at") is False
        assert _is_valid_email("@no-local.com") is False


class TestTemplateRendering:
    def test_bounty_claimed_template(self):
        ctx = EmailTemplateContext(user_name="alice", bounty_title="Build API Rate Limiter")
        subject, html = _render_template(
            NotificationType.BOUNTY_CLAIMED.value, ctx,
            cta_url="https://solfoundry.org/bounties/123",
        )
        assert "Build API Rate Limiter" in subject
        assert "alice" in html
        assert "Unsubscribe" in html

    def test_payout_template(self):
        ctx = EmailTemplateContext(
            payout_amount="75,000",
            tx_hash="0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
            bounty_title="Markdown Renderer",
        )
        subject, html = _render_template(
            NotificationType.PAYOUT_CONFIRMED.value, ctx,
            cta_url="https://solfoundry.org",
        )
        assert "75,000" in subject
        assert "0xabcd1234" in html

    def test_review_complete_high_score(self):
        ctx = EmailTemplateContext(bounty_title="Footer Component", ai_score="8.5")
        subject, html = _render_template(
            NotificationType.REVIEW_COMPLETE.value, ctx,
            cta_url="https://solfoundry.org/bounties/339",
        )
        assert "8.5" in html
        assert "payout is on its way" in html

    def test_review_complete_low_score(self):
        ctx = EmailTemplateContext(bounty_title="Footer Component", ai_score="3.2")
        _, html = _render_template(
            NotificationType.REVIEW_COMPLETE.value, ctx,
            cta_url="https://solfoundry.org/bounties/339",
        )
        assert "review feedback" in html

    def test_empty_content_handled(self):
        ctx = EmailTemplateContext()
        subject, html = _render_template(
            NotificationType.BOUNTY_CLAIMED.value, ctx,
            cta_url="https://solfoundry.org",
        )
        assert "Bounty" in subject
        assert html


class TestEmailPayload:
    def test_payload_validates(self):
        payload = EmailPayload(
            to_email="test@example.com",
            subject="Test Subject",
            html_body="<p>Test</p>",
            notification_type=NotificationType.BOUNTY_CLAIMED.value,
            user_id="test-user",
        )
        assert payload.to_email == "test@example.com"

    def test_payload_with_extra_data(self):
        payload = EmailPayload(
            to_email="test@example.com", subject="Test", html_body="",
            notification_type=NotificationType.PAYOUT_CONFIRMED.value,
            user_id="test-user", bounty_id="bounty-123",
            extra_data={"payout_amount": "50000", "tx_hash": "0xdeadbeef"},
        )
        assert payload.extra_data["payout_amount"] == "50000"
