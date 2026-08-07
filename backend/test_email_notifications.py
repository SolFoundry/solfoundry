"""Tests for the email notification system."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.email_service import EmailService
from app.email_templates import (
    bounty_status_email,
    digest_email,
    new_bounty_email,
    payout_email,
)
from app.models.email import (
    NotificationFrequency,
    NotificationType,
    PreferenceUpdate,
    SendNotificationRequest,
)
from app.services.notify import notify_bounty_event
from app.services.preference_store import PreferenceStore


class TestEmailTemplates:
    """Verify each template renders valid HTML and contains expected content."""

    def test_new_bounty_email(self):
        html = new_bounty_email(
            username="testuser",
            bounty_title="Build a FastAPI Backend",
            bounty_tier="T2",
            reward="100K FNDRY",
            skills=["Python", "FastAPI"],
            bounty_url="https://solfoundry.xyz/bounties/1",
        )
        assert "testuser" in html
        assert "Build a FastAPI Backend" in html
        assert "100K FNDRY" in html
        assert "T2" in html
        assert "Python" in html
        assert "FastAPI" in html
        assert "https://solfoundry.xyz/bounties/1" in html
        assert html.startswith("<!DOCTYPE html>")

    def test_bounty_status_email(self):
        html = bounty_status_email(
            username="testuser",
            bounty_title="Build a FastAPI Backend",
            status="approved",
            details="Your submission has been approved by the reviewer.",
            bounty_url="https://solfoundry.xyz/bounties/1",
        )
        assert "testuser" in html
        assert "Approved" in html or "approved" in html

    def test_payout_email(self):
        html = payout_email(
            username="testuser",
            bounty_title="Build a FastAPI Backend",
            amount="100K FNDRY",
            tx_url="https://explorer.solana.com/tx/abc123",
        )
        assert "testuser" in html
        assert "100K FNDRY" in html
        assert "abc123" in html

    def test_digest_email(self):
        html = digest_email(
            username="testuser",
            new_bounties=[{"title": "Bounty A", "tier": "T1", "reward": "10K", "url": "https://solfoundry.xyz/bounties/a"}],
            completed_bounties=[{"title": "Bounty B", "reward": "20K", "url": "https://solfoundry.xyz/bounties/b"}],
            bounties_url="https://solfoundry.xyz/bounties",
        )
        assert "testuser" in html
        assert "Bounty A" in html
        assert "Bounty B" in html
        assert "weekly" in html or "Weekly" in html


class TestEmailService:
    """Verify the email service handles SendGrid success and failure."""

    @pytest.mark.asyncio
    async def test_dev_mode_logs(self):
        """Without SENDGRID_API_KEY, the service should log and return True."""
        svc = EmailService()
        # Force api_key to empty
        svc.api_key = ""
        assert svc.enabled is False
        ok = await svc.send_email(to="test@example.com", subject="Test", html_body="<p>hi</p>")
        assert ok is True

    @pytest.mark.asyncio
    async def test_sendgrid_success(self):
        svc = EmailService()
        svc.api_key = "test-key"
        assert svc.enabled is True

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock()
            mock_post.return_value.status_code = 202
            mock_client.return_value.__aenter__.return_value.post = mock_post

            ok = await svc.send_email(to="test@example.com", subject="Test", html_body="<p>hi</p>")
            assert ok is True
            mock_post.assert_called_once()

    @pytest.mark.asyncio
    async def test_sendgrid_failure(self):
        svc = EmailService()
        svc.api_key = "test-key"

        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock()
            mock_post.return_value.status_code = 401
            mock_client.return_value.__aenter__.return_value.post = mock_post

            ok = await svc.send_email(to="test@example.com", subject="Test", html_body="<p>hi</p>")
            assert ok is False


class TestPreferenceStore:
    """Verify the persistent preference store."""

    def test_default_preference(self, tmp_path):
        store = PreferenceStore(path=str(tmp_path / "prefs.json"))
        pref = store.get("user_1")
        assert pref["frequency"] == "instant"
        assert pref["notify_new_bounty"] is True
        assert pref["notify_status_update"] is True
        assert pref["notify_payout"] is True

    def test_upsert_and_retrieve(self, tmp_path):
        store = PreferenceStore(path=str(tmp_path / "prefs.json"))
        update = PreferenceUpdate(
            email="test@example.com",
            frequency=NotificationFrequency.daily,
            notify_new_bounty=True,
            notify_status_update=False,
            notify_payout=True,
            digest_day="mon",
        )
        stored = store.upsert("user_1", update)
        assert stored["email"] == "test@example.com"
        assert stored["frequency"] == "daily"

        # Verify persistence by loading a new store from the same file
        store2 = PreferenceStore(path=str(tmp_path / "prefs.json"))
        pref = store2.get("user_1")
        assert pref["email"] == "test@example.com"
        assert pref["frequency"] == "daily"
        assert pref["notify_status_update"] is False

    def test_subscribers_for(self, tmp_path):
        store = PreferenceStore(path=str(tmp_path / "prefs.json"))
        user1 = PreferenceUpdate(email="a@example.com", frequency=NotificationFrequency.instant)
        user2 = PreferenceUpdate(email="b@example.com", frequency=NotificationFrequency.instant, notify_new_bounty=False)
        store.upsert("user_a", user1)
        store.upsert("user_b", user2)

        subs = store.subscribers_for("new_bounty")
        emails = [s["email"] for s in subs]
        assert "a@example.com" in emails
        assert "b@example.com" not in emails  # opted out

    def test_email_for_none(self, tmp_path):
        store = PreferenceStore(path=str(tmp_path / "prefs.json"))
        assert store.email_for("nonexistent") is None

    def test_email_for(self, tmp_path):
        store = PreferenceStore(path=str(tmp_path / "prefs.json"))
        store.upsert("user_1", PreferenceUpdate(email="test@example.com"))
        assert store.email_for("user_1") == "test@example.com"


class TestNotifyService:
    """Verify the notification orchestration layer."""

    @pytest.mark.asyncio
    async def test_unknown_event_type(self, tmp_path):
        store = PreferenceStore(path=str(tmp_path / "prefs.json"))
        store.upsert("user_1", PreferenceUpdate(email="test@example.com"))

        sent = await notify_bounty_event(event_type="unknown", bounty_title="test", specific_user_id="user_1")
        assert sent == 0

    @pytest.mark.asyncio
    async def test_skips_user_without_email(self, tmp_path):
        store = PreferenceStore(path=str(tmp_path / "prefs.json"))
        store.upsert("user_1", PreferenceUpdate(email="x@example.com"))
        # Clear the email in the stored data to simulate unset email
        store._data["user_1"]["email"] = ""
        store._flush()

        sent = await notify_bounty_event(event_type="new_bounty", bounty_title="test", specific_user_id="user_1")
        assert sent == 0


class TestSendNotificationRequest:
    def test_defaults(self):
        req = SendNotificationRequest(to="test@example.com")
        assert req.notification_type == NotificationType.new_bounty
        assert req.username == "there"
        assert req.bounty_title == "Test Bounty"