"""Tests for bot/models.py."""
from datetime import datetime, timezone

from bot.models import Bounty, UserFilter


def test_bounty_tier_from_label():
    b = Bounty(
        number=1, title="Test", body="", state="open",
        labels=["bounty-tier-2"], assignee=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        html_url="https://github.com/test",
    )
    assert b.tier == "2"
    assert b.is_open is True


def test_bounty_reward_from_label():
    b = Bounty(
        number=1, title="Test", body="", state="open",
        labels=["bounty-tier-1", "bounty-reward-500"],
        assignee=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        html_url="https://github.com/test",
    )
    assert b.reward == "500 FNDRY"


def test_bounty_bounty_type():
    b = Bounty(
        number=1, title="Test", body="", state="open",
        labels=["bounty-tier-1", "bounty-feature"],
        assignee=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        html_url="https://github.com/test",
    )
    assert b.bounty_type == "feature"


def test_bounty_matches_filter():
    b = Bounty(
        number=1, title="AI API Feature", body="", state="open",
        labels=["bounty-tier-2", "bounty-feature"],
        assignee=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        html_url="https://github.com/test",
    )
    assert b.matches_filter(UserFilter(user_id=1)) is True
    assert b.matches_filter(UserFilter(user_id=1, tiers=["2"])) is True
    assert b.matches_filter(UserFilter(user_id=1, tiers=["1"])) is False
    assert b.matches_filter(UserFilter(user_id=1, types=["feature"])) is True
    assert b.matches_filter(UserFilter(user_id=1, types=["bug"])) is False
    assert b.matches_filter(UserFilter(user_id=1, tiers=["2"], types=["feature"])) is True


def test_user_filter_serialization():
    f = UserFilter(user_id=123, tiers=["2", "3"], types=["bug"], min_reward=500)
    restored = UserFilter.from_dict(f.to_dict())
    assert restored.user_id == 123
    assert restored.tiers == ["2", "3"]
    assert restored.types == ["bug"]
    assert restored.min_reward == 500
