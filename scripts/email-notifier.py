#!/usr/bin/env python3
"""Email Notification System for SolFoundry Bounty Updates.

Sends email notifications when bounties matching user interests are posted,
updated, or completed. Supports digest batching and user preference management.

Usage:
    # Send notification for a new bounty
    python3 scripts/email-notifier.py notify --type new_bounty --repo owner/repo --issue 123

    # Send daily digest
    python3 scripts/email-notifier.py digest --frequency daily

    # Manage subscriptions
    python3 scripts/email-notifier.py subscribe --email user@example.com --categories backend,ai
    python3 scripts/email-notifier.py unsubscribe --email user@example.com
    python3 scripts/email-notifier.py list-subscriptions

    # Webhook listener for real-time notifications
    python3 scripts/email-notifier.py webhook --port 8081

    # Track email delivery
    python3 scripts/email-notifier.py track --message-id abc123

Environment variables:
    SMTP_HOST           - SMTP server hostname (default: smtp.gmail.com)
    SMTP_PORT           - SMTP server port (default: 587)
    SMTP_USER           - SMTP username/email
    SMTP_PASSWORD       - SMTP password or app key
    SMTP_FROM           - From email address
    SMTP_USE_TLS        - Use TLS (default: true)
    GITHUB_TOKEN        - GitHub PAT for API access
    WEBHOOK_SECRET      - Secret for GitHub webhook validation
    NOTIFIER_DB_PATH    - Path to SQLite database (default: notifier.db)
"""

import argparse
import hashlib
import hmac
import json
import os
import smtplib
import sqlite3
import sys
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional
import urllib.request

# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class Subscription:
    """User subscription preferences."""
    id: str = ""
    email: str = ""
    name: str = ""
    categories: list[str] = field(default_factory=list)  # backend, frontend, ai, etc.
    tiers: list[int] = field(default_factory=lambda: [1, 2, 3])
    frequency: str = "instant"  # instant, daily, weekly
    min_reward: int = 0
    active: bool = True
    created_at: str = ""
    updated_at: str = ""

@dataclass
class EmailRecord:
    """Record of a sent email."""
    id: str = ""
    message_id: str = ""
    to_email: str = ""
    subject: str = ""
    notification_type: str = ""  # new_bounty, update, completion, digest
    bounty_issue: int = 0
    bounty_repo: str = ""
    status: str = "queued"  # queued, sent, failed, bounced
    error_message: str = ""
    created_at: str = ""
    sent_at: str = ""
    opened_at: str = ""

@dataclass
class DigestEntry:
    """A single entry in a digest email."""
    title: str = ""
    url: str = ""
    tier: int = 1
    category: str = ""
    reward: int = 0
    event_type: str = ""  # new, updated, completed


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

class NotifierDB:
    """SQLite database for email notifications."""

    def __init__(self, db_path: str = "notifier.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize database schema."""
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    name TEXT DEFAULT '',
                    categories TEXT DEFAULT '[]',
                    tiers TEXT DEFAULT '[1,2,3]',
                    frequency TEXT DEFAULT 'instant',
                    min_reward INTEGER DEFAULT 0,
                    active INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);
                CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(active);

                CREATE TABLE IF NOT EXISTS email_records (
                    id TEXT PRIMARY KEY,
                    message_id TEXT DEFAULT '',
                    to_email TEXT NOT NULL,
                    subject TEXT NOT NULL,
                    notification_type TEXT NOT NULL,
                    bounty_issue INTEGER DEFAULT 0,
                    bounty_repo TEXT DEFAULT '',
                    status TEXT DEFAULT 'queued',
                    error_message TEXT DEFAULT '',
                    created_at TEXT NOT NULL,
                    sent_at TEXT DEFAULT '',
                    opened_at TEXT DEFAULT ''
                );

                CREATE INDEX IF NOT EXISTS idx_email_records_status ON email_records(status);
                CREATE INDEX IF NOT EXISTS idx_email_records_to ON email_records(to_email);

                CREATE TABLE IF NOT EXISTS pending_digests (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    entries TEXT DEFAULT '[]',
                    frequency TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_pending_digests_email ON pending_digests(email);
            """)

    @contextmanager
    def _conn(self):
        """Context manager for database connection."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    # --- Subscriptions ---

    def add_subscription(self, sub: Subscription) -> str:
        """Add a new subscription. Returns subscription ID."""
        if not sub.id:
            sub.id = str(uuid.uuid4())[:8]
        now = datetime.now(timezone.utc).isoformat()
        sub.created_at = now
        sub.updated_at = now

        with self._conn() as conn:
            conn.execute("""
                INSERT INTO subscriptions (id, email, name, categories, tiers, frequency,
                    min_reward, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (sub.id, sub.email, sub.name, json.dumps(sub.categories),
                  json.dumps(sub.tiers), sub.frequency, sub.min_reward,
                  int(sub.active), sub.created_at, sub.updated_at))

        return sub.id

    def get_subscription(self, email: str) -> Optional[Subscription]:
        """Get subscription by email."""
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM subscriptions WHERE email = ?", (email,)).fetchone()
            if not row:
                return None
            return self._row_to_sub(row)

    def list_subscriptions(self, active_only: bool = True) -> list[Subscription]:
        """List all subscriptions."""
        with self._conn() as conn:
            query = "SELECT * FROM subscriptions"
            if active_only:
                query += " WHERE active = 1"
            rows = conn.execute(query).fetchall()
            return [self._row_to_sub(r) for r in rows]

    def update_subscription(self, email: str, **kwargs) -> bool:
        """Update subscription fields."""
        allowed = {"name", "categories", "tiers", "frequency", "min_reward", "active"}
        updates = []
        values = []
        for k, v in kwargs.items():
            if k in allowed:
                if isinstance(v, list):
                    v = json.dumps(v)
                updates.append(f"{k} = ?")
                values.append(v)

        if not updates:
            return False

        updates.append("updated_at = ?")
        values.append(datetime.now(timezone.utc).isoformat())
        values.append(email)

        with self._conn() as conn:
            cursor = conn.execute(
                f"UPDATE subscriptions SET {', '.join(updates)} WHERE email = ?",
                values,
            )
            return cursor.rowcount > 0

    def unsubscribe(self, email: str) -> bool:
        """Deactivate a subscription."""
        return self.update_subscription(email, active=False)

    def _row_to_sub(self, row) -> Subscription:
        return Subscription(
            id=row["id"],
            email=row["email"],
            name=row["name"],
            categories=json.loads(row["categories"]),
            tiers=json.loads(row["tiers"]),
            frequency=row["frequency"],
            min_reward=row["min_reward"],
            active=bool(row["active"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    # --- Email records ---

    def record_email(self, record: EmailRecord) -> str:
        """Record a sent email."""
        if not record.id:
            record.id = str(uuid.uuid4())[:8]
        record.created_at = datetime.now(timezone.utc).isoformat()

        with self._conn() as conn:
            conn.execute("""
                INSERT INTO email_records (id, message_id, to_email, subject,
                    notification_type, bounty_issue, bounty_repo, status,
                    error_message, created_at, sent_at, opened_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (record.id, record.message_id, record.to_email, record.subject,
                  record.notification_type, record.bounty_issue, record.bounty_repo,
                  record.status, record.error_message, record.created_at,
                  record.sent_at, record.opened_at))

        return record.id

    def update_email_status(self, message_id: str, status: str, error: str = "") -> bool:
        """Update email delivery status."""
        with self._conn() as conn:
            updates = ["status = ?"]
            values = [status]
            if error:
                updates.append("error_message = ?")
                values.append(error)
            if status == "sent":
                updates.append("sent_at = ?")
                values.append(datetime.now(timezone.utc).isoformat())

            values.append(message_id)
            cursor = conn.execute(
                f"UPDATE email_records SET {', '.join(updates)} WHERE message_id = ?",
                values,
            )
            return cursor.rowcount > 0

    def get_delivery_stats(self) -> dict:
        """Get email delivery statistics."""
        with self._conn() as conn:
            total = conn.execute("SELECT COUNT(*) FROM email_records").fetchone()[0]
            sent = conn.execute("SELECT COUNT(*) FROM email_records WHERE status = 'sent'").fetchone()[0]
            failed = conn.execute("SELECT COUNT(*) FROM email_records WHERE status = 'failed'").fetchone()[0]
            queued = conn.execute("SELECT COUNT(*) FROM email_records WHERE status = 'queued'").fetchone()[0]
            bounced = conn.execute("SELECT COUNT(*) FROM email_records WHERE status = 'bounced'").fetchone()[0]

        return {"total": total, "sent": sent, "failed": failed, "queued": queued, "bounced": bounced}

    # --- Pending digests ---

    def add_to_digest(self, email: str, entry: DigestEntry, frequency: str):
        """Add an entry to pending digest."""
        entry_id = str(uuid.uuid4())[:8]
        now = datetime.now(timezone.utc).isoformat()

        with self._conn() as conn:
            # Check for existing pending digest for this email
            row = conn.execute(
                "SELECT id, entries FROM pending_digests WHERE email = ? AND frequency = ?",
                (email, frequency),
            ).fetchone()

            if row:
                entries = json.loads(row["entries"])
                entries.append(asdict(entry))
                conn.execute(
                    "UPDATE pending_digests SET entries = ? WHERE id = ?",
                    (json.dumps(entries), row["id"]),
                )
            else:
                conn.execute("""
                    INSERT INTO pending_digests (id, email, entries, frequency, created_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (entry_id, email, json.dumps([asdict(entry)]), frequency, now))

    def get_pending_digests(self, frequency: str) -> list[tuple[str, list[dict]]]:
        """Get pending digests for a frequency."""
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT email, entries FROM pending_digests WHERE frequency = ?",
                (frequency,),
            ).fetchall()

        result = []
        for row in rows:
            entries = json.loads(row["entries"])
            result.append((row["email"], entries))

        # Clear pending digests
        with self._conn() as conn:
            conn.execute("DELETE FROM pending_digests WHERE frequency = ?", (frequency,))

        return result


# ---------------------------------------------------------------------------
# Email templates
# ---------------------------------------------------------------------------

def render_new_bounty_email(bounty: dict, repo: str) -> tuple[str, str]:
    """Render email for a new bounty notification."""
    tier_colors = {1: "#6c757d", 2: "#ffc107", 3: "#dc3545"}
    tier_labels = {1: "T1 - Open Race", 2: "T2 - Claim Required", 3: "T3 - High Complexity"}

    # Detect tier from labels
    tier = 1
    for l in bounty.get("labels", []):
        name = l.get("name", "") if isinstance(l, dict) else str(l)
        if name.startswith("tier-"):
            try:
                tier = int(name.split("-")[1])
            except (IndexError, ValueError):
                pass
    tier_color = tier_colors.get(tier, "#6c757d")
    tier_label = tier_labels.get(tier, "T1")

    subject = f"[SolFoundry] New {tier_label}: {bounty['title'][:60]}"

    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 20px;">
    <h1 style="margin: 0 0 8px 0; font-size: 20px;">🏗️ New Bounty Available</h1>
    <p style="margin: 0; opacity: 0.9; font-size: 14px;">SolFoundry · {repo}</p>
</div>

<div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
    <h2 style="margin: 0 0 12px 0; font-size: 18px;">{bounty['title']}</h2>
    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <span style="background: {tier_color}; color: white; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600;">{tier_label}</span>
        <span style="background: #28a745; color: white; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 600;">{bounty.get('reward', 'TBD')} $FNDRY</span>
    </div>
    <p style="color: #495057; line-height: 1.6; font-size: 14px;">{bounty.get('body', '')[:300]}{'...' if len(bounty.get('body', '')) > 300 else ''}</p>
</div>

<div style="text-align: center; margin: 24px 0;">
    <a href="{bounty.get('html_url', '#')}" style="background: #667eea; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
        View Bounty →
    </a>
</div>

<div style="border-top: 1px solid #dee2e6; padding-top: 16px; color: #6c757d; font-size: 12px; text-align: center;">
    <p>You received this because you're subscribed to SolFoundry bounty notifications.</p>
    <p><a href="{{{{unsubscribe_url}}}}" style="color: #6c757d;">Unsubscribe</a> · <a href="{{{{preferences_url}}}}" style="color: #6c757d;">Manage Preferences</a></p>
</div>

</body>
</html>
"""
    return subject, html


def render_completion_email(bounty: dict, repo: str, pr_url: str) -> tuple[str, str]:
    """Render email for bounty completion."""
    subject = f"[SolFoundry] Bounty Completed: {bounty['title'][:50]}"

    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

<div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 20px;">
    <h1 style="margin: 0 0 8px 0; font-size: 20px;">🎉 Bounty Completed!</h1>
    <p style="margin: 0; opacity: 0.9; font-size: 14px;">SolFoundry · {repo}</p>
</div>

<div style="background: #f8f9fa; border-radius: 8px; padding: 20px;">
    <h2 style="margin: 0 0 12px 0; font-size: 18px;">{bounty['title']}</h2>
    <p style="color: #495057;">This bounty has been completed and merged!</p>
    <a href="{pr_url}" style="color: #667eea;">View merged PR →</a>
</div>

</body>
</html>
"""
    return subject, html


def render_digest_email(entries: list[dict], frequency: str) -> tuple[str, str]:
    """Render digest email with multiple bounty updates."""
    count = len(entries)
    subject = f"[SolFoundry] {frequency.title()} Digest: {count} new bounties"

    entries_html = ""
    for e in entries[:10]:  # Cap at 10 entries
        tier_colors = {1: "#6c757d", 2: "#ffc107", 3: "#dc3545"}
        tier = e.get("tier", 1)
        entries_html += f"""
        <div style="border-left: 3px solid {tier_colors.get(tier, '#6c757d')}; padding: 12px; margin-bottom: 12px; background: white; border-radius: 0 8px 8px 0;">
            <strong>{e.get('title', 'Untitled')}</strong><br>
            <span style="color: #6c757d; font-size: 13px;">T{tier} · {e.get('category', 'general')} · {e.get('reward', 'TBD')} $FNDRY</span><br>
            <a href="{e.get('url', '#')}" style="color: #667eea; font-size: 13px;">View →</a>
        </div>
        """

    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 20px;">
    <h1 style="margin: 0 0 8px 0; font-size: 20px;">📬 {frequency.title()} Bounty Digest</h1>
    <p style="margin: 0; opacity: 0.9; font-size: 14px;">{count} new bounties</p>
</div>

<div style="background: #f8f9fa; border-radius: 8px; padding: 20px;">
    {entries_html}
</div>

<div style="text-align: center; margin: 24px 0;">
    <a href="https://github.com/SolFoundry/solfoundry/issues?q=label%3Abounty" style="background: #667eea; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Browse All Bounties →
    </a>
</div>

</body>
</html>
"""
    return subject, html


# ---------------------------------------------------------------------------
# Email sender
# ---------------------------------------------------------------------------

class EmailSender:
    """SMTP email sender."""

    def __init__(self, host: str = "", port: int = 587, user: str = "",
                 password: str = "", from_addr: str = "", use_tls: bool = True):
        self.host = host or os.environ.get("SMTP_HOST", "smtp.gmail.com")
        self.port = port or int(os.environ.get("SMTP_PORT", "587"))
        self.user = user or os.environ.get("SMTP_USER", "")
        self.password = password or os.environ.get("SMTP_PASSWORD", "")
        self.from_addr = from_addr or os.environ.get("SMTP_FROM", self.user)
        self.use_tls = use_tls

    @property
    def is_configured(self) -> bool:
        return bool(self.host and self.user and self.password)

    def send(self, to_email: str, subject: str, html_body: str,
             text_body: str = "") -> tuple[bool, str, str]:
        """Send an email. Returns (success, message_id, error_message)."""
        if not self.is_configured:
            return False, "", "SMTP not configured"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = self.from_addr
        msg["To"] = to_email
        msg["Message-ID"] = f"<{uuid.uuid4()}@solfoundry.org>"

        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        try:
            if self.use_tls:
                server = smtplib.SMTP(self.host, self.port)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(self.host, self.port)

            server.login(self.user, self.password)
            server.send_message(msg)
            server.quit()

            message_id = msg["Message-ID"]
            return True, message_id, ""

        except Exception as e:
            return False, "", str(e)


# ---------------------------------------------------------------------------
# Notification manager
# ---------------------------------------------------------------------------

class NotificationManager:
    """Manages email notifications for bounty events."""

    def __init__(self, db: NotifierDB, sender: EmailSender):
        self.db = db
        self.sender = sender

    def notify_new_bounty(self, bounty: dict, repo: str):
        """Send notifications for a new bounty."""
        subject, html = render_new_bounty_email(bounty, repo)

        # Get matching subscriptions
        subs = self._matching_subscriptions(bounty)

        for sub in subs:
            if sub.frequency == "instant":
                self._send_email(sub.email, subject, html, "new_bounty",
                               bounty.get("number", 0), repo)
            else:
                # Queue for digest
                entry = DigestEntry(
                    title=bounty.get("title", ""),
                    url=bounty.get("html_url", ""),
                    tier=bounty.get("tier", 1),
                    category=bounty.get("category", ""),
                    reward=bounty.get("reward", 0),
                    event_type="new",
                )
                self.db.add_to_digest(sub.email, entry, sub.frequency)

    def notify_completion(self, bounty: dict, repo: str, pr_url: str):
        """Send notifications for bounty completion."""
        subject, html = render_completion_email(bounty, repo, pr_url)
        subs = self._matching_subscriptions(bounty)

        for sub in subs:
            if sub.frequency == "instant":
                self._send_email(sub.email, subject, html, "completion",
                               bounty.get("number", 0), repo)

    def send_digest(self, frequency: str):
        """Send pending digest emails."""
        digests = self.db.get_pending_digests(frequency)

        for email, entries in digests:
            subject, html = render_digest_email(entries, frequency)
            self._send_email(email, subject, html, "digest", 0, "")

    def _matching_subscriptions(self, bounty: dict) -> list[Subscription]:
        """Find subscriptions matching a bounty."""
        subs = self.db.list_subscriptions(active_only=True)
        matching = []

        bounty_categories = bounty.get("labels", [])
        if isinstance(bounty_categories, list):
            bounty_categories = [l if isinstance(l, str) else l.get("name", "") for l in bounty_categories]

        bounty_tier = self._detect_tier(bounty)

        for sub in subs:
            # Check tier filter
            if bounty_tier not in sub.tiers:
                continue

            # Check category filter
            if sub.categories:
                bounty_cats = set(bounty_categories)
                if not bounty_cats.intersection(set(sub.categories)):
                    continue

            # Check min reward
            if sub.min_reward > 0:
                reward = self._detect_reward(bounty, bounty_tier)
                if reward < sub.min_reward:
                    continue

            matching.append(sub)

        return matching

    def _detect_tier(self, bounty: dict) -> int:
        """Detect bounty tier from labels."""
        tier = 1
        for l in bounty.get("labels", []):
            if isinstance(l, dict):
                name = l.get("name", "")
            else:
                name = str(l)
            if name.startswith("tier-"):
                try:
                    tier = int(name.split("-")[1])
                except (IndexError, ValueError):
                    pass
        return tier

    def _detect_reward(self, bounty: dict, tier: int) -> int:
        """Detect reward amount."""
        rewards = {1: 100000, 2: 450000, 3: 800000}
        return rewards.get(tier, 100000)

    def _send_email(self, to_email: str, subject: str, html: str,
                    notification_type: str, issue: int, repo: str):
        """Send email and record result."""
        record = EmailRecord(
            to_email=to_email,
            subject=subject,
            notification_type=notification_type,
            bounty_issue=issue,
            bounty_repo=repo,
        )

        success, message_id, error = self.sender.send(to_email, subject, html)

        record.message_id = message_id
        if success:
            record.status = "sent"
            record.sent_at = datetime.now(timezone.utc).isoformat()
        else:
            record.status = "failed"
            record.error_message = error

        self.db.record_email(record)


# ---------------------------------------------------------------------------
# GitHub webhook handler
# ---------------------------------------------------------------------------

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify GitHub webhook signature."""
    if not secret:
        return True
    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def handle_github_webhook(payload: dict, manager: NotificationManager, repo: str):
    """Handle incoming GitHub webhook event."""
    action = payload.get("action")
    issue = payload.get("issue")

    if not issue:
        return

    # Skip PRs
    if "pull_request" in issue:
        return

    # Check for bounty label
    labels = [l.get("name", "") if isinstance(l, dict) else l for l in issue.get("labels", [])]
    if "bounty" not in labels:
        return

    if action in ("opened", "reopened"):
        manager.notify_new_bounty(issue, repo)
    elif action == "closed":
        pr_url = ""
        if "pull_request" in payload:
            pr_url = payload["pull_request"].get("html_url", "")
        manager.notify_completion(issue, repo, pr_url)


# ---------------------------------------------------------------------------
# CLI commands
# ---------------------------------------------------------------------------

def cmd_notify(args):
    """Send notification for a bounty event."""
    db = NotifierDB(args.db)
    sender = EmailSender()
    manager = NotificationManager(db, sender)

    # Build bounty dict from args or fetch from GitHub
    if args.repo and args.issue:
        token = os.environ.get("GITHUB_TOKEN", "")
        url = f"https://api.github.com/repos/{args.repo}/issues/{args.issue}"
        headers = {"Accept": "application/vnd.github.v3+json"}
        if token:
            headers["Authorization"] = f"token {token}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            bounty = json.loads(resp.read())
        repo = args.repo
    else:
        bounty = {
            "number": int(args.issue or 0),
            "title": args.title or "Test Bounty",
            "body": args.body or "",
            "html_url": args.url or "#",
            "labels": [{"name": l.strip()} for l in (args.labels or "").split(",") if l.strip()],
        }
        repo = args.repo or "SolFoundry/solfoundry"

    if args.type == "completion":
        manager.notify_completion(bounty, repo, args.pr_url or "")
    else:
        manager.notify_new_bounty(bounty, repo)

    stats = db.get_delivery_stats()
    print(f"Notification sent. Delivery stats: {stats}")
    return 0


def cmd_digest(args):
    """Send digest emails."""
    db = NotifierDB(args.db)
    sender = EmailSender()
    manager = NotificationManager(db, sender)

    manager.send_digest(args.frequency)
    print(f"Digest sent for frequency: {args.frequency}")
    return 0


def cmd_subscribe(args):
    """Manage subscriptions."""
    db = NotifierDB(args.db)

    if args.email:
        categories = [c.strip() for c in (args.categories or "").split(",") if c.strip()]
        tiers = [int(t) for t in (args.tiers or "1,2,3").split(",")]

        existing = db.get_subscription(args.email)
        if existing:
            db.update_subscription(args.email,
                categories=categories, tiers=tiers,
                frequency=args.frequency or "instant",
                min_reward=int(args.min_reward or 0), active=True)
            print(f"Updated subscription for {args.email}")
        else:
            sub = Subscription(
                email=args.email, name=args.name or "",
                categories=categories, tiers=tiers,
                frequency=args.frequency or "instant",
                min_reward=int(args.min_reward or 0),
            )
            db.add_subscription(sub)
            print(f"Created subscription for {args.email}")

        print(f"  Categories: {categories or 'all'}")
        print(f"  Tiers: {tiers}")
        print(f"  Frequency: {args.frequency or 'instant'}")

    return 0


def cmd_list_subscriptions(args):
    """List all subscriptions."""
    db = NotifierDB(args.db)
    subs = db.list_subscriptions(active_only=not args.all)

    print(f"{'EMAIL':<30} {'FREQUENCY':<10} {'CATEGORIES':<20} {'TIERS':<10} {'ACTIVE'}")
    print("-" * 85)
    for sub in subs:
        cats = ",".join(sub.categories) if sub.categories else "all"
        tiers = ",".join(str(t) for t in sub.tiers)
        print(f"{sub.email:<30} {sub.frequency:<10} {cats:<20} {tiers:<10} {'✓' if sub.active else '✗'}")

    stats = db.get_delivery_stats()
    print(f"\nDelivery stats: {stats}")
    return 0


def cmd_unsubscribe(args):
    """Unsubscribe an email."""
    db = NotifierDB(args.db)
    if db.unsubscribe(args.email):
        print(f"Unsubscribed: {args.email}")
    else:
        print(f"Not found: {args.email}")
    return 0


def cmd_webhook(args):
    """Start webhook listener."""
    try:
        from http.server import HTTPServer, BaseHTTPRequestHandler
    except ImportError:
        print("http.server not available")
        return 1

    db = NotifierDB(args.db)
    sender = EmailSender()
    manager = NotificationManager(db, sender)
    secret = args.secret or os.environ.get("WEBHOOK_SECRET", "")

    class WebhookHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            content_length = int(self.headers.get("Content-Length", 0))
            payload_bytes = self.rfile.read(content_length)

            # Verify signature
            signature = self.headers.get("X-Hub-Signature-256", "")
            if not verify_webhook_signature(payload_bytes, signature, secret):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Invalid signature")
                return

            try:
                payload = json.loads(payload_bytes)
            except json.JSONDecodeError:
                self.send_response(400)
                self.end_headers()
                return

            repo = payload.get("repository", {}).get("full_name", "SolFoundry/solfoundry")
            handle_github_webhook(payload, manager, repo)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode())

        def log_message(self, format, *args):
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]}")

    port = args.port or 8081
    server = HTTPServer(("0.0.0.0", port), WebhookHandler)
    print(f"Email notification webhook listening on port {port}")
    print(f"Configure GitHub webhook to: http://your-server:{port}/")
    print("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()

    return 0


def cmd_track(args):
    """Track email delivery status."""
    db = NotifierDB(args.db)

    if args.message_id:
        # Look up specific message
        with db._conn() as conn:
            row = conn.execute(
                "SELECT * FROM email_records WHERE message_id = ?",
                (args.message_id,),
            ).fetchone()
            if row:
                print(f"Message: {row['message_id']}")
                print(f"  To: {row['to_email']}")
                print(f"  Subject: {row['subject']}")
                print(f"  Status: {row['status']}")
                print(f"  Sent: {row['sent_at'] or 'not yet'}")
                print(f"  Error: {row['error_message'] or 'none'}")
            else:
                print(f"Not found: {args.message_id}")

    stats = db.get_delivery_stats()
    print(f"\nDelivery stats:")
    for k, v in stats.items():
        print(f"  {k}: {v}")

    return 0


def cmd_stats(args):
    """Show notification statistics."""
    db = NotifierDB(args.db)

    subs = db.list_subscriptions(active_only=True)
    stats = db.get_delivery_stats()

    print("=== Email Notification Statistics ===\n")
    print(f"Active subscriptions: {len(subs)}")

    # Frequency breakdown
    freq_counts = {}
    for sub in subs:
        freq_counts[sub.frequency] = freq_counts.get(sub.frequency, 0) + 1
    print(f"\nBy frequency:")
    for freq, count in sorted(freq_counts.items()):
        print(f"  {freq}: {count}")

    print(f"\nDelivery stats:")
    for k, v in stats.items():
        print(f"  {k}: {v}")

    if stats["total"] > 0:
        success_rate = stats["sent"] / stats["total"] * 100
        print(f"\nSuccess rate: {success_rate:.1f}%")

    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Email Notification System for SolFoundry Bounty Updates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--db", default="notifier.db", help="Database path")

    subparsers = parser.add_subparsers(dest="command")

    # notify
    p = subparsers.add_parser("notify", help="Send notification for a bounty event")
    p.add_argument("--type", default="new_bounty", choices=["new_bounty", "update", "completion"],
                   help="Notification type")
    p.add_argument("--repo", help="Repository (owner/repo)")
    p.add_argument("--issue", help="Issue number")
    p.add_argument("--title", help="Bounty title")
    p.add_argument("--body", help="Bounty description")
    p.add_argument("--url", help="Bounty URL")
    p.add_argument("--labels", help="Comma-separated labels")
    p.add_argument("--pr-url", help="PR URL for completion notifications")

    # digest
    p = subparsers.add_parser("digest", help="Send digest emails")
    p.add_argument("--frequency", default="daily", choices=["daily", "weekly"])

    # subscribe
    p = subparsers.add_parser("subscribe", help="Add or update subscription")
    p.add_argument("--email", help="Email address")
    p.add_argument("--name", help="Subscriber name")
    p.add_argument("--categories", help="Comma-separated categories (backend,frontend,ai)")
    p.add_argument("--tiers", help="Comma-separated tiers (1,2,3)")
    p.add_argument("--frequency", default="instant", choices=["instant", "daily", "weekly"])
    p.add_argument("--min-reward", help="Minimum reward amount")

    # unsubscribe
    p = subparsers.add_parser("unsubscribe", help="Unsubscribe an email")
    p.add_argument("--email", required=True)

    # list-subscriptions
    p = subparsers.add_parser("list-subscriptions", help="List all subscriptions")
    p.add_argument("--all", action="store_true", help="Include inactive")

    # webhook
    p = subparsers.add_parser("webhook", help="Start webhook listener")
    p.add_argument("--port", type=int, default=8081)
    p.add_argument("--secret", help="Webhook secret")

    # track
    p = subparsers.add_parser("track", help="Track email delivery")
    p.add_argument("--message-id", help="Specific message ID")

    # stats
    subparsers.add_parser("stats", help="Show statistics")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    commands = {
        "notify": cmd_notify,
        "digest": cmd_digest,
        "subscribe": cmd_subscribe,
        "unsubscribe": cmd_unsubscribe,
        "list-subscriptions": cmd_list_subscriptions,
        "webhook": cmd_webhook,
        "track": cmd_track,
        "stats": cmd_stats,
    }

    return commands[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
