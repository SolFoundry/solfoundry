"""
Tests for bounty notification webhook integration.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.services.bounty_notifier import (
    extract_reward_from_body,
    extract_tier_from_labels,
    handle_bounty_webhook,
)


class TestExtractReward:
    """Tests for reward extraction from issue body."""

    def test_empty_body(self):
        assert extract_reward_from_body("") == "TBD"
        assert extract_reward_from_body(None) == "TBD"

    def test_reward_with_fndry(self):
        body = "## Reward\n50000 $FNDRY\n\nThis is a test bounty."
        assert extract_reward_from_body(body) == "50000 $FNDRY"

    def test_reward_with_usdc(self):
        body = "Reward: $1,000 USDC\n\nCreate a Telegram bot."
        assert extract_reward_from_body(body) == "1000 USDC"

    def test_reward_with_amount_only(self):
        body = "Payout: 100000"
        result = extract_reward_from_body(body)
        assert "100000" in result

    def test_reward_case_insensitive(self):
        body = "REWARD: 25000 FNDRY"
        assert extract_reward_from_body(body) == "25000 FNDRY"

    def test_no_reward_info(self):
        body = "This is a simple bounty without reward info."
        assert extract_reward_from_body(body) == "TBD"

    def test_prize_keyword(self):
        body = "Prize: 75000 $FNDRY"
        assert extract_reward_from_body(body) == "75000 $FNDRY"

    def test_comma_separated_amount(self):
        body = "Reward: 1,000,000 FNDRY"
        assert extract_reward_from_body(body) == "1000000 FNDRY"


class TestExtractTier:
    """Tests for tier extraction from labels."""

    def test_tier_1(self):
        assert extract_tier_from_labels(["bounty", "tier-1", "frontend"]) == "tier-1"

    def test_tier_2(self):
        assert extract_tier_from_labels(["bounty", "tier-2"]) == "tier-2"

    def test_tier_3(self):
        assert extract_tier_from_labels(["tier-3", "bounty"]) == "tier-3"

    def test_default_tier_when_missing(self):
        assert extract_tier_from_labels(["bounty", "frontend"]) == "tier-1"

    def test_empty_labels(self):
        assert extract_tier_from_labels([]) == "tier-1"

    def test_first_tier_wins(self):
        assert (
            extract_tier_from_labels(["tier-2", "bounty", "tier-3", "frontend"])
            == "tier-2"
        )


class TestHandleBountyWebhook:
    """Tests for handle_bounty_webhook integration."""

    def _make_issue(self, labels=None, title="Test Bounty", body="Reward: 50000 $FNDRY"):
        return {
            "title": title,
            "html_url": f"https://github.com/SolFoundry/solfoundry/issues/1",
            "labels": [{"name": l} for l in (labels or ["bounty", "tier-1"])],
            "body": body,
            "user": {"login": "test-user"},
        }

    @pytest.mark.asyncio
    async def test_sends_notification_for_bounty_issue(self):
        """Should call send_bounty_notification for issues with bounty label."""
        issue = self._make_issue()

        with patch(
            "app.services.bounty_notifier.send_bounty_notification",
            new_callable=AsyncMock,
            return_value=True,
        ) as mock_send:
            result = await handle_bounty_webhook(issue)
            assert result is True
            mock_send.assert_called_once()
            call_kwargs = mock_send.call_args[0][0]
            assert call_kwargs["title"] == "Test Bounty"
            assert call_kwargs["tier"] == "tier-1"
            assert "bounty" in call_kwargs["tags"]

    @pytest.mark.asyncio
    async def test_skips_non_bounty_issue(self):
        """Should skip notification for issues without bounty label."""
        issue = self._make_issue(labels=["bug", "frontend"])

        with patch(
            "app.services.bounty_notifier.send_bounty_notification",
            new_callable=AsyncMock,
        ) as mock_send:
            result = await handle_bounty_webhook(issue)
            assert result is False
            mock_send.assert_not_called()

    @pytest.mark.asyncio
    async def test_extracts_reward_correctly(self):
        """Should extract reward from issue body."""
        issue = self._make_issue(body="## Reward\n100000 $FNDRY")

        with patch(
            "app.services.bounty_notifier.send_bounty_notification",
            new_callable=AsyncMock,
            return_value=True,
        ) as mock_send:
            await handle_bounty_webhook(issue)
            call_kwargs = mock_send.call_args[0][0]
            assert call_kwargs["reward"] == "100000 $FNDRY"

    @pytest.mark.asyncio
    async def test_handles_minimal_issue(self):
        """Should handle issues with minimal data."""
        issue = {"title": "Minimal", "html_url": "https://example.com"}

        with patch(
            "app.services.bounty_notifier.send_bounty_notification",
            new_callable=AsyncMock,
            return_value=True,
        ) as mock_send:
            result = await handle_bounty_webhook(issue)
            # No labels means no "bounty" label -> skip
            assert result is False
            mock_send.assert_not_called()