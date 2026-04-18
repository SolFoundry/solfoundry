#!/usr/bin/env python3
"""Tests for Email Notification System."""

import json
import os
import sys
import tempfile
from pathlib import Path
import importlib.util

SCRIPT_DIR = Path(__file__).resolve().parent

spec = importlib.util.spec_from_file_location("email_notifier", SCRIPT_DIR / "email-notifier.py")
notifier_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notifier_mod)

Subscription = notifier_mod.Subscription
EmailRecord = notifier_mod.EmailRecord
DigestEntry = notifier_mod.DigestEntry
NotifierDB = notifier_mod.NotifierDB
EmailSender = notifier_mod.EmailSender
NotificationManager = notifier_mod.NotificationManager
verify_webhook_signature = notifier_mod.verify_webhook_signature
render_new_bounty_email = notifier_mod.render_new_bounty_email
render_digest_email = notifier_mod.render_digest_email
render_completion_email = notifier_mod.render_completion_email


def get_test_db():
    """Create a temporary test database."""
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    return NotifierDB(path), path


def test_subscription_crud():
    """Test subscription create, read, update."""
    db, path = get_test_db()

    # Create
    sub = Subscription(email="test@example.com", categories=["backend"], tiers=[1, 2], frequency="daily")
    db.add_subscription(sub)

    # Read
    got = db.get_subscription("test@example.com")
    assert got is not None
    assert got.email == "test@example.com"
    assert got.categories == ["backend"]
    assert got.tiers == [1, 2]
    assert got.frequency == "daily"
    assert got.active == True

    # Update
    db.update_subscription("test@example.com", frequency="weekly", active=True)
    got = db.get_subscription("test@example.com")
    assert got.frequency == "weekly"

    # List
    subs = db.list_subscriptions(active_only=True)
    assert len(subs) == 1

    # Unsubscribe
    db.unsubscribe("test@example.com")
    got = db.get_subscription("test@example.com")
    assert got.active == False

    # Should not appear in active list
    subs = db.list_subscriptions(active_only=True)
    assert len(subs) == 0

    os.unlink(path)
    print("  [PASS] test_subscription_crud")


def test_email_record():
    """Test email recording and status updates."""
    db, path = get_test_db()

    record = EmailRecord(
        to_email="user@example.com",
        subject="Test notification",
        notification_type="new_bounty",
        bounty_issue=123,
        bounty_repo="SolFoundry/solfoundry",
    )

    db.record_email(record)
    stats = db.get_delivery_stats()
    assert stats["total"] == 1
    assert stats["queued"] == 1

    os.unlink(path)
    print("  [PASS] test_email_record")


def test_digest_entries():
    """Test digest batching."""
    db, path = get_test_db()

    entry1 = DigestEntry(title="Bounty 1", url="https://example.com/1", tier=1, event_type="new")
    entry2 = DigestEntry(title="Bounty 2", url="https://example.com/2", tier=2, event_type="new")

    db.add_to_digest("user@example.com", entry1, "daily")
    db.add_to_digest("user@example.com", entry2, "daily")

    digests = db.get_pending_digests("daily")
    assert len(digests) == 1
    assert digests[0][0] == "user@example.com"
    assert len(digests[0][1]) == 2

    # Should be cleared after fetch
    digests = db.get_pending_digests("daily")
    assert len(digests) == 0

    os.unlink(path)
    print("  [PASS] test_digest_entries")


def test_webhook_signature():
    """Test webhook signature verification."""
    import hmac
    import hashlib

    secret = "my-secret"
    payload = b'{"action": "opened"}'

    valid = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    assert verify_webhook_signature(payload, valid, secret) == True
    assert verify_webhook_signature(payload, "sha256=bad", secret) == False
    assert verify_webhook_signature(payload, "", "") == True

    print("  [PASS] test_webhook_signature")


def test_new_bounty_email_template():
    """Test new bounty email rendering."""
    bounty = {
        "number": 42,
        "title": "Build awesome feature",
        "body": "Description of the bounty",
        "html_url": "https://github.com/SolFoundry/solfoundry/issues/42",
        "labels": [{"name": "bounty"}, {"name": "tier-2"}],
    }

    subject, html = render_new_bounty_email(bounty, "SolFoundry/solfoundry")
    assert "New" in subject
    assert "Build awesome feature" in subject
    assert "Build awesome feature" in html
    assert "https://github.com/SolFoundry/solfoundry/issues/42" in html
    assert "T2" in html

    print("  [PASS] test_new_bounty_email_template")


def test_completion_email_template():
    """Test completion email rendering."""
    bounty = {"title": "Completed bounty", "html_url": "#"}
    subject, html = render_completion_email(bounty, "owner/repo", "https://github.com/pull/1")
    assert "Completed" in subject
    assert "🎉" in html

    print("  [PASS] test_completion_email_template")


def test_digest_email_template():
    """Test digest email rendering."""
    entries = [
        {"title": "Bounty 1", "url": "#1", "tier": 1, "category": "backend", "reward": 100000},
        {"title": "Bounty 2", "url": "#2", "tier": 2, "category": "frontend", "reward": 450000},
    ]
    subject, html = render_digest_email(entries, "daily")
    assert "Digest" in subject
    assert "2 new bounties" in html

    print("  [PASS] test_digest_email_template")


def test_email_sender_not_configured():
    """Test sender reports not configured when no SMTP settings."""
    sender = EmailSender()
    assert sender.is_configured == False
    success, msg_id, error = sender.send("test@example.com", "Subject", "<p>Body</p>")
    assert success == False
    assert "not configured" in error.lower()

    print("  [PASS] test_email_sender_not_configured")


def test_matching_subscriptions():
    """Test subscription matching logic."""
    db, path = get_test_db()

    # Add subscriptions with different filters
    db.add_subscription(Subscription(
        email="backend@example.com", categories=["backend"], tiers=[1, 2, 3], frequency="instant"
    ))
    db.add_subscription(Subscription(
        email="ai@example.com", categories=["ai"], tiers=[2, 3], frequency="instant"
    ))
    db.add_subscription(Subscription(
        email="all@example.com", categories=[], tiers=[1, 2, 3], frequency="instant"
    ))

    sender = EmailSender()
    manager = NotificationManager(db, sender)

    # Backend bounty should match backend@ and all@
    backend_bounty = {
        "number": 1, "title": "Backend task", "body": "Fix API",
        "html_url": "#", "labels": [{"name": "backend"}, {"name": "tier-2"}],
    }
    subs = manager._matching_subscriptions(backend_bounty)
    emails = {s.email for s in subs}
    assert "backend@example.com" in emails
    assert "all@example.com" in emails
    assert "ai@example.com" not in emails

    os.unlink(path)
    print("  [PASS] test_matching_subscriptions")


def test_stats():
    """Test delivery statistics."""
    db, path = get_test_db()

    db.record_email(EmailRecord(to_email="a@b.com", subject="s", notification_type="new_bounty", status="sent"))
    db.record_email(EmailRecord(to_email="b@b.com", subject="s", notification_type="new_bounty", status="failed"))
    db.record_email(EmailRecord(to_email="c@b.com", subject="s", notification_type="new_bounty", status="queued"))

    stats = db.get_delivery_stats()
    assert stats["sent"] == 1
    assert stats["failed"] == 1
    assert stats["queued"] == 1

    os.unlink(path)
    print("  [PASS] test_stats")


def run_all_tests():
    """Run all tests."""
    print("Running Email Notification System tests...\n")

    tests = [
        test_subscription_crud,
        test_email_record,
        test_digest_entries,
        test_webhook_signature,
        test_new_bounty_email_template,
        test_completion_email_template,
        test_digest_email_template,
        test_email_sender_not_configured,
        test_matching_subscriptions,
        test_stats,
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
