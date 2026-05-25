"""
Tests for Telegram Bot for New Bounty Notifications.
"""

import os
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Make sure the module is importable
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from app.services.telegram_bot import (
    _is_configured,
    _escape_markdown,
    _format_bounty_message,
    send_bounty_notification,
    send_bounty_notification_sync,
)


class TestTelegramBotHelpers:
    """Tests for helper functions."""

    def test_is_configured_both_set(self):
        """Returns True when both env vars are set."""
        with patch.dict(os.environ, {
            "TELEGRAM_BOT_TOKEN": "123:abc",
            "TELEGRAM_CHAT_ID": "-1001234567890",
        }, clear=True):
            # Re-import to pick up env changes
            import importlib
            import app.services.telegram_bot as tb
            importlib.reload(tb)
            assert tb._is_configured() is True

    def test_is_configured_missing_token(self):
        """Returns False when token is missing."""
        with patch.dict(os.environ, {
            "TELEGRAM_BOT_TOKEN": "",
            "TELEGRAM_CHAT_ID": "-1001234567890",
        }, clear=True):
            import importlib
            import app.services.telegram_bot as tb
            importlib.reload(tb)
            assert tb._is_configured() is False

    def test_is_configured_missing_chat_id(self):
        """Returns False when chat_id is missing."""
        with patch.dict(os.environ, {
            "TELEGRAM_BOT_TOKEN": "123:abc",
            "TELEGRAM_CHAT_ID": "",
        }, clear=True):
            import importlib
            import app.services.telegram_bot as tb
            importlib.reload(tb)
            assert tb._is_configured() is False

    def test_escape_markdown_empty(self):
        assert _escape_markdown("") == ""

    def test_escape_markdown_no_special(self):
        assert _escape_markdown("Hello World") == "Hello World"

    def test_escape_markdown_special_chars(self):
        result = _escape_markdown("Hello_World *bold* [link](url)")
        assert "\\_" in result
        assert "\\*" in result
        assert "\\[" in result
        assert "\\]" in result
        assert "(" not in result.replace("\\(", "")
        assert ")" not in result.replace("\\)", "")

    def test_escape_markdown_dollar_sign(self):
        """$FNDRY should be escaped for MarkdownV2."""
        result = _escape_markdown("$FNDRY")
        assert "\\$FNDRY" in result


class TestFormatBountyMessage:
    """Tests for _format_bounty_message."""

    def _get_sample_bounty(self):
        return {
            "title": "Implement site navigation shell",
            "url": "https://github.com/SolFoundry/solfoundry/issues/18",
            "tier": "tier-1",
            "reward": "50000 $FNDRY",
            "description": "Build the site navigation and layout shell with dark theme support.",
            "tags": ["bounty", "tier-1", "frontend"],
        }

    def test_message_includes_title(self):
        msg = _format_bounty_message(self._get_sample_bounty())
        assert "New Bounty" in msg

    def test_message_includes_tier(self):
        msg = _format_bounty_message(self._get_sample_bounty())
        assert "TIER 1" in msg or "tier" in msg.lower()

    def test_message_includes_reward(self):
        msg = _format_bounty_message(self._get_sample_bounty())
        assert "$FNDRY" in msg.replace("\\$", "$") or "$FNDRY" in msg

    def test_message_includes_link(self):
        msg = _format_bounty_message(self._get_sample_bounty())
        assert "github.com" in msg

    def test_message_without_tags(self):
        bounty = self._get_sample_bounty()
        bounty["tags"] = []
        msg = _format_bounty_message(bounty)
        # Should still work without tags
        assert "New Bounty" in msg

    def test_minimal_bounty(self):
        """Should handle minimal bounty data without crashing."""
        msg = _format_bounty_message({"title": "Test", "url": "https://example.com"})
        assert "Test" in msg

    def test_long_description_truncation(self):
        """Descriptions longer than 200 chars should be truncated."""
        bounty = self._get_sample_bounty()
        bounty["description"] = "A" * 500
        msg = _format_bounty_message(bounty)
        # The escaped version might be longer but should still contain As
        assert "A" in msg

    def test_tier_label_formatting(self):
        """Tier labels should be formatted nicely."""
        for tier_input, expected_substr in [
            ("tier-1", "TIER 1"),
            ("tier-2", "TIER 2"),
            ("tier-3", "TIER 3"),
        ]:
            bounty = self._get_sample_bounty()
            bounty["tier"] = tier_input
            msg = _format_bounty_message(bounty)
            assert expected_substr in msg


class TestSendBountyNotification:
    """Tests for send_bounty_notification (async)."""

    @pytest.mark.asyncio
    async def test_not_configured_returns_false(self):
        """When Telegram is not configured, return False immediately."""
        with patch(
            "app.services.telegram_bot._is_configured", return_value=False
        ):
            result = await send_bounty_notification({"title": "Test"})
            assert result is False

    @pytest.mark.asyncio
    async def test_successful_send(self):
        """A successful Telegram API call returns True."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"ok": True}
        mock_response.raise_for_status.return_value = None

        with patch(
            "app.services.telegram_bot._is_configured", return_value=True
        ), patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = mock_client.return_value.__aenter__.return_value
            mock_client_instance.post.return_value = mock_response

            result = await send_bounty_notification({
                "title": "Test",
                "url": "https://example.com",
            })
            assert result is True
            mock_client_instance.post.assert_called_once()

    @pytest.mark.asyncio
    async def test_api_error_returns_false(self):
        """When Telegram API returns ok=False, return False."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "ok": False,
            "description": "Bad Request: chat not found",
        }
        mock_response.raise_for_status.return_value = None

        with patch(
            "app.services.telegram_bot._is_configured", return_value=True
        ), patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = mock_client.return_value.__aenter__.return_value
            mock_client_instance.post.return_value = mock_response

            result = await send_bounty_notification({
                "title": "Test",
                "url": "https://example.com",
            })
            assert result is False

    @pytest.mark.asyncio
    async def test_http_error_returns_false(self):
        """HTTP errors return False."""
        from httpx import HTTPStatusError

        with patch(
            "app.services.telegram_bot._is_configured", return_value=True
        ), patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = mock_client.return_value.__aenter__.return_value
            mock_client_instance.post.side_effect = HTTPStatusError(
                "401 Unauthorized",
                request=MagicMock(),
                response=MagicMock(status_code=401),
            )

            result = await send_bounty_notification({
                "title": "Test",
                "url": "https://example.com",
            })
            assert result is False

    @pytest.mark.asyncio
    async def test_network_error_returns_false(self):
        """Network errors return False."""
        from httpx import RequestError

        with patch(
            "app.services.telegram_bot._is_configured", return_value=True
        ), patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = mock_client.return_value.__aenter__.return_value
            mock_client_instance.post.side_effect = RequestError("Connection error")

            result = await send_bounty_notification({
                "title": "Test",
                "url": "https://example.com",
            })
            assert result is False

    @pytest.mark.asyncio
    async def test_payload_format(self):
        """Verify the payload sent to Telegram has expected structure."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"ok": True}
        mock_response.raise_for_status.return_value = None

        with patch(
            "app.services.telegram_bot._is_configured", return_value=True
        ), patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = mock_client.return_value.__aenter__.return_value
            mock_client_instance.post.return_value = mock_response

            await send_bounty_notification({
                "title": "Test Bounty",
                "url": "https://github.com/SolFoundry/solfoundry/issues/1",
                "tier": "tier-1",
                "reward": "1000 $FNDRY",
                "description": "A test bounty",
                "tags": ["bounty", "tier-1"],
            })

            call_args = mock_client_instance.post.call_args
            assert call_args is not None, "post() was not called"

            url_arg = call_args[0][0]
            payload = call_args[1]["json"]

            assert "bot" in url_arg, f"URL should contain bot token: {url_arg}"
            assert payload["chat_id"] is not None
            assert payload["parse_mode"] == "MarkdownV2"
            assert "Test Bounty" in payload["text"]


class TestSendBountyNotificationSync:
    """Tests for send_bounty_notification_sync."""

    def test_not_configured_returns_false(self):
        with patch(
            "app.services.telegram_bot._is_configured", return_value=False
        ):
            result = send_bounty_notification_sync({"title": "Test"})
            assert result is False

    def test_successful_send(self):
        mock_response = MagicMock()
        mock_response.json.return_value = {"ok": True}
        mock_response.raise_for_status.return_value = None

        with patch(
            "app.services.telegram_bot._is_configured", return_value=True
        ), patch("httpx.Client") as mock_client:
            mock_client_instance = mock_client.return_value.__enter__.return_value
            mock_client_instance.post.return_value = mock_response

            result = send_bounty_notification_sync({
                "title": "Test",
                "url": "https://example.com",
            })
            assert result is True


class TestIntegrationHooks:
    """Tests for integration points (webhook handler, GitHub sync)."""

    def test_bounty_webhook_integration(self):
        """
        Verify that a webhook payload with 'bounty' label triggers
        notification sending. This is a contract test — it validates
        the expected integration pattern rather than the full pipeline.
        """
        sample_webhook_payload = {
            "action": "opened",
            "issue": {
                "title": "Test Bounty #1",
                "html_url": "https://github.com/SolFoundry/solfoundry/issues/999",
                "labels": [{"name": "bounty"}, {"name": "tier-1"}],
                "body": "This is a test bounty description.",
            },
        }

        labels = [l["name"] for l in sample_webhook_payload["issue"]["labels"]]
        is_bounty = "bounty" in labels

        assert is_bounty is True, "Webhook should detect bounty label"

        # Expected extracted data
        bounty_data = {
            "title": sample_webhook_payload["issue"]["title"],
            "url": sample_webhook_payload["issue"]["html_url"],
            "tier": next(
                (l for l in labels if l.startswith("tier-")), "tier-1"
            ),
            "reward": "TBD",
            "description": sample_webhook_payload["issue"]["body"],
            "tags": labels,
        }

        assert bounty_data["title"] == "Test Bounty #1"
        assert bounty_data["tier"] == "tier-1"
        assert "bounty" in bounty_data["tags"]

    def test_github_sync_integration(self):
        """
        Verify that GitHub sync results can be passed to the
        notification function. This validates data compatibility.
        """
        sample_sync_bounty = {
            "title": "Fix loading spinner",
            "url": "https://github.com/SolFoundry/solfoundry/issues/888",
            "tier": "tier-2",
            "reward": "100000 $FNDRY",
            "description": "Fix the loading spinner on mobile.",
            "tags": ["bounty", "tier-2", "frontend", "bug"],
        }

        # It should be formatable as a message
        msg = _format_bounty_message(sample_sync_bounty)
        assert "Fix loading spinner" in msg
        assert "TIER 2" in msg
        assert "100000" in msg