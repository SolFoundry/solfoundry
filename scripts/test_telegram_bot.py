#!/usr/bin/env python3
"""Tests for Telegram Bot."""

import json
import os
import sys
import tempfile
from pathlib import Path
import importlib.util

SCRIPT_DIR = Path(__file__).resolve().parent

spec = importlib.util.spec_from_file_location("telegram_bot", SCRIPT_DIR / "telegram-bot.py")
bot_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bot_mod)

ChannelSubscription = bot_mod.ChannelSubscription
BotDB = bot_mod.BotDB
format_bounty_message = bot_mod.format_bounty_message
get_bounty_keyboard = bot_mod.get_bounty_keyboard
detect_tier = bot_mod.detect_tier
detect_category = bot_mod.detect_category


def get_test_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    return BotDB(path), path


def test_subscription_crud():
    db, path = get_test_db()

    sub = ChannelSubscription(chat_id="12345", chat_type="private", categories=["backend"], tiers=[1, 2])
    db.add_subscription(sub)

    got = db.get_subscription("12345")
    assert got is not None
    assert got.chat_id == "12345"
    assert got.categories == ["backend"]
    assert got.tiers == [1, 2]
    assert got.active == True

    subs = db.get_active_subscriptions()
    assert len(subs) == 1

    db.unsubscribe("12345")
    subs = db.get_active_subscriptions()
    assert len(subs) == 0

    os.unlink(path)
    print("  [PASS] test_subscription_crud")


def test_posted_bounties():
    db, path = get_test_db()

    assert not db.is_posted(42, "owner/repo", "12345")
    db.record_posted(42, "owner/repo", 999, "12345")
    assert db.is_posted(42, "owner/repo", "12345")
    assert not db.is_posted(43, "owner/repo", "12345")

    os.unlink(path)
    print("  [PASS] test_posted_bounties")


def test_pending_bounties():
    db, path = get_test_db()

    db.add_pending(1, "owner/repo")
    db.add_pending(2, "owner/repo")
    pending = db.get_pending()
    assert len(pending) == 2

    db.clear_pending(1, "owner/repo")
    pending = db.get_pending()
    assert len(pending) == 1

    os.unlink(path)
    print("  [PASS] test_pending_bounties")


def test_detect_tier():
    bounty1 = {"labels": [{"name": "bounty"}, {"name": "tier-1"}]}
    bounty2 = {"labels": [{"name": "bounty"}, {"name": "tier-2"}]}
    bounty3 = {"labels": [{"name": "bounty"}, {"name": "tier-3"}]}
    bounty_no_tier = {"labels": [{"name": "bounty"}]}

    assert detect_tier(bounty1) == 1
    assert detect_tier(bounty2) == 2
    assert detect_tier(bounty3) == 3
    assert detect_tier(bounty_no_tier) == 1

    print("  [PASS] test_detect_tier")


def test_detect_category():
    assert detect_category({"labels": [{"name": "backend"}]}) == "backend"
    assert detect_category({"labels": [{"name": "frontend"}]}) == "frontend"
    assert detect_category({"labels": [{"name": "agent"}]}) == "ai"
    assert detect_category({"labels": []}) == "general"

    print("  [PASS] test_detect_category")


def test_format_bounty_message():
    bounty = {
        "number": 42,
        "title": "Build awesome feature",
        "body": "Description of the bounty with details about what needs to be done",
        "html_url": "https://github.com/SolFoundry/solfoundry/issues/42",
        "labels": [{"name": "bounty"}, {"name": "tier-2"}, {"name": "backend"}],
    }

    msg = format_bounty_message(bounty, "SolFoundry/solfoundry")
    assert "New Tier 2 Bounty" in msg
    assert "Build awesome feature" in msg
    assert "450K $FNDRY" in msg
    assert "backend" in msg
    assert "https://github.com/SolFoundry/solfoundry/issues/42" in msg

    print("  [PASS] test_format_bounty_message")


def test_bounty_keyboard():
    bounty = {"number": 42, "html_url": "https://github.com/org/repo/issues/42"}
    keyboard = get_bounty_keyboard(bounty, "org/repo")

    assert "inline_keyboard" in keyboard
    rows = keyboard["inline_keyboard"]
    assert len(rows) == 2
    assert len(rows[0]) == 2  # View Details + Fork Repo
    assert len(rows[1]) == 2  # Claim + Ask

    # Check callback data
    assert rows[1][0]["callback_data"] == "claim:42"
    assert rows[1][1]["callback_data"] == "ask:42"

    print("  [PASS] test_bounty_keyboard")


def test_format_long_body():
    bounty = {
        "number": 1,
        "title": "Test",
        "body": "A" * 500,
        "html_url": "#",
        "labels": [{"name": "bounty"}, {"name": "tier-1"}],
    }
    msg = format_bounty_message(bounty, "org/repo")
    # Body should be truncated to 200 chars
    assert "A" * 201 not in msg
    assert "..." in msg

    print("  [PASS] test_format_long_body")


def run_all_tests():
    print("Running Telegram Bot tests...\n")

    tests = [
        test_subscription_crud,
        test_posted_bounties,
        test_pending_bounties,
        test_detect_tier,
        test_detect_category,
        test_format_bounty_message,
        test_bounty_keyboard,
        test_format_long_body,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {test.__name__}: {e}")
            failed += 1

    print(f"\nResults: {passed} passed, {failed} failed, {passed + failed} total")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
