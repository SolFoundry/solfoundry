#!/usr/bin/env python3
"""Telegram Bot for SolFoundry Bounty Notifications.

Posts new bounties to a Telegram channel with inline keyboard buttons for
quick bounty details. Supports user subscription management per bounty type.

Usage:
    # Start the bot (polling mode)
    python3 scripts/telegram-bot.py run

    # Start webhook server
    python3 scripts/telegram-bot.py webhook --port 8082

    # Post a specific bounty to channel
    python3 scripts/telegram-bot.py post --repo owner/repo --issue 123

    # Manage subscriptions
    python3 scripts/telegram-bot.py subscribe --chat-id 123456 --categories backend,ai

    # List active subscriptions
    python3 scripts/telegram-bot.py list

Environment variables:
    TELEGRAM_BOT_TOKEN  - Telegram bot token from @BotFather (required)
    TELEGRAM_CHANNEL    - Channel username or ID for bounty posts
    GITHUB_TOKEN        - GitHub PAT for API access
    WEBHOOK_SECRET      - Secret for webhook validation
"""

import argparse
import hashlib
import hmac
import json
import os
import sqlite3
import sys
import time
import urllib.request
import urllib.error
from contextlib import contextmanager
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class ChannelSubscription:
    """User/channel subscription for bounty notifications."""
    chat_id: str
    chat_type: str = "private"  # private, group, channel
    categories: list[str] = field(default_factory=list)  # empty = all
    tiers: list[int] = field(default_factory=lambda: [1, 2, 3])
    active: bool = True
    created_at: str = ""

@dataclass
class PostedBounty:
    """Record of a posted bounty."""
    issue_number: int
    repo: str
    message_id: int
    chat_id: str
    posted_at: str = ""


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

class BotDB:
    """SQLite database for the Telegram bot."""

    def __init__(self, db_path: str = "telegram-bot.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS subscriptions (
                    chat_id TEXT PRIMARY KEY,
                    chat_type TEXT DEFAULT 'private',
                    categories TEXT DEFAULT '[]',
                    tiers TEXT DEFAULT '[1,2,3]',
                    active INTEGER DEFAULT 1,
                    created_at TEXT
                );

                CREATE TABLE IF NOT EXISTS posted_bounties (
                    issue_number INTEGER,
                    repo TEXT,
                    message_id INTEGER,
                    chat_id TEXT,
                    posted_at TEXT,
                    PRIMARY KEY (issue_number, repo, chat_id)
                );

                CREATE TABLE IF NOT EXISTS pending_bounties (
                    issue_number INTEGER,
                    repo TEXT,
                    created_at TEXT,
                    PRIMARY KEY (issue_number, repo)
                );
            """)

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def add_subscription(self, sub: ChannelSubscription):
        sub.created_at = sub.created_at or datetime.now(timezone.utc).isoformat()
        with self._conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO subscriptions (chat_id, chat_type, categories, tiers, active, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (sub.chat_id, sub.chat_type, json.dumps(sub.categories),
                  json.dumps(sub.tiers), int(sub.active), sub.created_at))

    def get_subscription(self, chat_id: str) -> Optional[ChannelSubscription]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM subscriptions WHERE chat_id = ?", (chat_id,)).fetchone()
            if not row:
                return None
            return ChannelSubscription(
                chat_id=row["chat_id"], chat_type=row["chat_type"],
                categories=json.loads(row["categories"]),
                tiers=json.loads(row["tiers"]),
                active=bool(row["active"]), created_at=row["created_at"],
            )

    def get_active_subscriptions(self) -> list[ChannelSubscription]:
        with self._conn() as conn:
            rows = conn.execute("SELECT * FROM subscriptions WHERE active = 1").fetchall()
            return [
                ChannelSubscription(
                    chat_id=r["chat_id"], chat_type=r["chat_type"],
                    categories=json.loads(r["categories"]),
                    tiers=json.loads(r["tiers"]),
                    active=True, created_at=r["created_at"],
                )
                for r in rows
            ]

    def unsubscribe(self, chat_id: str) -> bool:
        with self._conn() as conn:
            cursor = conn.execute("UPDATE subscriptions SET active = 0 WHERE chat_id = ?", (chat_id,))
            return cursor.rowcount > 0

    def record_posted(self, issue: int, repo: str, msg_id: int, chat_id: str):
        with self._conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO posted_bounties (issue_number, repo, message_id, chat_id, posted_at)
                VALUES (?, ?, ?, ?, ?)
            """, (issue, repo, msg_id, chat_id, datetime.now(timezone.utc).isoformat()))

    def is_posted(self, issue: int, repo: str, chat_id: str) -> bool:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT 1 FROM posted_bounties WHERE issue_number = ? AND repo = ? AND chat_id = ?",
                (issue, repo, chat_id),
            ).fetchone()
            return row is not None

    def add_pending(self, issue: int, repo: str):
        with self._conn() as conn:
            conn.execute("""
                INSERT OR IGNORE INTO pending_bounties (issue_number, repo, created_at)
                VALUES (?, ?, ?)
            """, (issue, repo, datetime.now(timezone.utc).isoformat()))

    def get_pending(self) -> list[tuple[int, str]]:
        with self._conn() as conn:
            rows = conn.execute("SELECT issue_number, repo FROM pending_bounties").fetchall()
            return [(r["issue_number"], r["repo"]) for r in rows]

    def clear_pending(self, issue: int, repo: str):
        with self._conn() as conn:
            conn.execute("DELETE FROM pending_bounties WHERE issue_number = ? AND repo = ?", (issue, repo))


# ---------------------------------------------------------------------------
# Telegram API
# ---------------------------------------------------------------------------

class TelegramAPI:
    """Simple Telegram Bot API client."""

    BASE_URL = "https://api.telegram.org"

    def __init__(self, token: str):
        self.token = token

    def _request(self, method: str, data: dict = None) -> dict:
        url = f"{self.BASE_URL}/bot{self.token}/{method}"
        headers = {"Content-Type": "application/json"}
        body = json.dumps(data).encode() if data else None

        req = urllib.request.Request(url, data=body, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            return {"ok": False, "error": str(e)}

    def send_message(self, chat_id: str, text: str, parse_mode: str = "HTML",
                     reply_markup: dict = None) -> dict:
        data = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
        if reply_markup:
            data["reply_markup"] = reply_markup
        return self._request("sendMessage", data)

    def edit_message_text(self, chat_id: str, message_id: int, text: str,
                          parse_mode: str = "HTML", reply_markup: dict = None) -> dict:
        data = {"chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": parse_mode}
        if reply_markup:
            data["reply_markup"] = reply_markup
        return self._request("editMessageText", data)

    def answer_callback_query(self, callback_query_id: str, text: str = "",
                               show_alert: bool = False) -> dict:
        data = {"callback_query_id": callback_query_id, "text": text, "show_alert": show_alert}
        return self._request("answerCallbackQuery", data)

    def set_webhook(self, url: str, secret: str = "") -> dict:
        data = {"url": url}
        if secret:
            data["secret_token"] = secret
        return self._request("setWebhook", data)

    def get_me(self) -> dict:
        return self._request("getMe")


# ---------------------------------------------------------------------------
# Bounty formatter
# ---------------------------------------------------------------------------

def detect_tier(bounty: dict) -> int:
    for l in bounty.get("labels", []):
        name = l.get("name", "") if isinstance(l, dict) else str(l)
        if name.startswith("tier-"):
            try:
                return int(name.split("-")[1])
            except (IndexError, ValueError):
                pass
    return 1

def detect_category(bounty: dict) -> str:
    cat_map = {"frontend": "frontend", "backend": "backend", "agent": "ai",
               "integration": "integration", "creative": "creative"}
    for l in bounty.get("labels", []):
        name = l.get("name", "") if isinstance(l, dict) else str(l)
        if name in cat_map:
            return cat_map[name]
    return "general"

def format_bounty_message(bounty: dict, repo: str) -> str:
    """Format a bounty as a Telegram message."""
    tier = detect_tier(bounty)
    category = detect_category(bounty)
    tier_emoji = {1: "🥉", 2: "🥈", 3: "🥇"}.get(tier, "🏷️")
    rewards = {1: "100K", 2: "450K", 3: "800K"}
    reward = rewards.get(tier, "TBD")

    labels = []
    for l in bounty.get("labels", []):
        name = l.get("name", "") if isinstance(l, dict) else str(l)
        if name not in ("bounty", f"tier-{tier}"):
            labels.append(name)

    body_preview = (bounty.get("body") or "")[:200].replace("<", "&lt;").replace(">", "&gt;")
    if len(bounty.get("body", "")) > 200:
        body_preview += "..."

    msg = f"""{tier_emoji} <b>New {f'Tier {tier}'} Bounty</b>

<b>{bounty.get('title', 'Untitled')}</b>

💰 <b>Reward:</b> {reward} $FNDRY
📁 <b>Category:</b> {category}
🏷️ <b>Labels:</b> {', '.join(labels) if labels else 'none'}

{body_preview}

<a href="{bounty.get('html_url', '#')}">View on GitHub →</a>"""
    return msg

def get_bounty_keyboard(bounty: dict, repo: str) -> dict:
    """Create inline keyboard for bounty actions."""
    return {
        "inline_keyboard": [
            [
                {"text": "📋 View Details", "url": bounty.get("html_url", "#")},
                {"text": "🍴 Fork Repo", "url": f"https://github.com/{repo}/fork"},
            ],
            [
                {"text": "✅ Claim Bounty", "callback_data": f"claim:{bounty.get('number', 0)}"},
                {"text": "❓ Ask Question", "callback_data": f"ask:{bounty.get('number', 0)}"},
            ],
        ]
    }


# ---------------------------------------------------------------------------
# Bot logic
# ---------------------------------------------------------------------------

class SolFoundryBot:
    """Main bot logic."""

    def __init__(self, token: str, channel: str = "", github_token: str = ""):
        self.api = TelegramAPI(token)
        self.channel = channel
        self.github_token = github_token
        self.db = BotDB()

    def post_bounty(self, bounty: dict, repo: str):
        """Post a bounty to the channel and subscribed users."""
        msg_text = format_bounty_message(bounty, repo)
        keyboard = get_bounty_keyboard(bounty, repo)

        # Post to main channel
        if self.channel and not self.db.is_posted(bounty["number"], repo, self.channel):
            result = self.api.send_message(self.channel, msg_text, reply_markup=keyboard)
            if result.get("ok"):
                msg_id = result["result"]["message_id"]
                self.db.record_posted(bounty["number"], repo, msg_id, self.channel)
                print(f"  Posted to channel: message #{msg_id}")

        # Post to subscribed users
        subs = self.db.get_active_subscriptions()
        bounty_category = detect_category(bounty)
        bounty_tier = detect_tier(bounty)

        for sub in subs:
            if self.db.is_posted(bounty["number"], repo, sub.chat_id):
                continue

            # Check filters
            if sub.categories and bounty_category not in sub.categories:
                continue
            if bounty_tier not in sub.tiers:
                continue

            result = self.api.send_message(sub.chat_id, msg_text, reply_markup=keyboard)
            if result.get("ok"):
                msg_id = result["result"]["message_id"]
                self.db.record_posted(bounty["number"], repo, msg_id, sub.chat_id)
                print(f"  Sent to {sub.chat_id}: message #{msg_id}")

    def process_callback(self, callback_query: dict):
        """Handle inline button callbacks."""
        data = callback_query.get("data", "")
        query_id = callback_query["id"]

        if data.startswith("claim:"):
            issue_num = data.split(":")[1]
            self.api.answer_callback_query(
                query_id,
                f"To claim #{issue_num}, fork the repo and submit a PR with 'Closes #{issue_num}' in the description.",
                show_alert=True,
            )
        elif data.startswith("ask:"):
            issue_num = data.split(":")[1]
            self.api.answer_callback_query(
                query_id,
                f"Comment on the GitHub issue #{issue_num} to ask questions.",
                show_alert=True,
            )

    def handle_update(self, update: dict):
        """Process a Telegram update."""
        # Handle callback queries (inline button presses)
        if "callback_query" in update:
            self.process_callback(update["callback_query"])
            return

        message = update.get("message", {})
        if not message:
            return

        chat_id = str(message["chat"]["id"])
        chat_type = message["chat"]["type"]
        text = message.get("text", "")

        # Handle /start command
        if text == "/start":
            self.api.send_message(chat_id,
                "🏗️ <b>SolFoundry Bounty Bot</b>\n\n"
                "Commands:\n"
                "/subscribe - Subscribe to bounty notifications\n"
                "/unsubscribe - Unsubscribe\n"
                "/status - Check subscription status\n"
                "/help - Show this message"
            )
            return

        # Handle /subscribe command
        if text.startswith("/subscribe"):
            args = text.split()[1:] if len(text.split()) > 1 else []
            categories = []
            tiers = [1, 2, 3]

            for arg in args:
                if arg.startswith("cat:"):
                    categories = arg[4:].split(",")
                elif arg.startswith("tier:"):
                    tiers = [int(t) for t in arg[5:].split(",")]

            sub = ChannelSubscription(
                chat_id=chat_id, chat_type=chat_type,
                categories=categories, tiers=tiers,
            )
            self.db.add_subscription(sub)

            cats = ", ".join(categories) if categories else "all"
            self.api.send_message(chat_id,
                f"✅ Subscribed!\n\n"
                f"Categories: {cats}\n"
                f"Tiers: {', '.join(f'T{t}' for t in tiers)}\n\n"
                f"You'll receive notifications for new bounties."
            )
            return

        # Handle /unsubscribe command
        if text == "/unsubscribe":
            self.db.unsubscribe(chat_id)
            self.api.send_message(chat_id, "❌ Unsubscribed from bounty notifications.")
            return

        # Handle /status command
        if text == "/status":
            sub = self.db.get_subscription(chat_id)
            if sub and sub.active:
                cats = ", ".join(sub.categories) if sub.categories else "all"
                self.api.send_message(chat_id,
                    f"📊 <b>Subscription Status</b>\n\n"
                    f"Active: ✅\n"
                    f"Categories: {cats}\n"
                    f"Tiers: {', '.join(f'T{t}' for t in sub.tiers)}"
                )
            else:
                self.api.send_message(chat_id, "Not subscribed. Use /subscribe to start.")

        # Handle /help command
        if text == "/help":
            self.api.send_message(chat_id,
                "🏗️ <b>SolFoundry Bounty Bot</b>\n\n"
                "Commands:\n"
                "/subscribe [cat:backend,ai] [tier:1,2] - Subscribe\n"
                "/unsubscribe - Unsubscribe\n"
                "/status - Check status\n\n"
                "You'll get inline buttons on each bounty to:\n"
                "• View details on GitHub\n"
                "• Fork the repo\n"
                "• Claim the bounty\n"
                "• Ask questions"
            )

    def run_polling(self):
        """Run bot in polling mode."""
        print("Starting Telegram bot (polling mode)...")
        me = self.api.get_me()
        if me.get("ok"):
            print(f"Bot: @{me['result']['username']}")

        offset = 0
        while True:
            try:
                url = f"https://api.telegram.org/bot{self.token}/getUpdates?offset={offset}&timeout=30"
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=35) as resp:
                    data = json.loads(resp.read())

                if data.get("ok"):
                    for update in data.get("result", []):
                        offset = update["update_id"] + 1
                        self.handle_update(update)

            except KeyboardInterrupt:
                print("\nStopping bot...")
                break
            except Exception as e:
                print(f"Error: {e}")
                time.sleep(5)

    def fetch_and_post(self, repo: str, limit: int = 5):
        """Fetch recent bounties and post them."""
        url = f"https://api.github.com/repos/{repo}/issues?labels=bounty&state=open&per_page={limit}&sort=created&direction=desc"
        headers = {"Accept": "application/vnd.github.v3+json"}
        if self.github_token:
            headers["Authorization"] = f"token {self.github_token}"

        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            issues = json.loads(resp.read())

        print(f"Found {len(issues)} open bounties in {repo}")

        for issue in issues:
            if "pull_request" in issue:
                continue
            self.post_bounty(issue, repo)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_run(args):
    """Run bot in polling mode."""
    token = args.token or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        print("Error: TELEGRAM_BOT_TOKEN not set")
        return 1

    channel = args.channel or os.environ.get("TELEGRAM_CHANNEL", "")
    github_token = os.environ.get("GITHUB_TOKEN", "")

    bot = SolFoundryBot(token, channel, github_token)
    bot.run_polling()
    return 0


def cmd_post(args):
    """Post a specific bounty."""
    token = args.token or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        print("Error: TELEGRAM_BOT_TOKEN not set")
        return 1

    channel = args.channel or os.environ.get("TELEGRAM_CHANNEL", "")
    github_token = os.environ.get("GITHUB_TOKEN", "")

    bot = SolFoundryBot(token, channel, github_token)

    if args.repo and args.issue:
        url = f"https://api.github.com/repos/{args.repo}/issues/{args.issue}"
        headers = {"Accept": "application/vnd.github.v3+json"}
        if github_token:
            headers["Authorization"] = f"token {github_token}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            bounty = json.loads(resp.read())
        bot.post_bounty(bounty, args.repo)
    else:
        bot.fetch_and_post(args.repo or "SolFoundry/solfoundry", int(args.limit or 5))

    return 0


def cmd_subscribe(args):
    """Add subscription."""
    db = BotDB()
    categories = [c.strip() for c in (args.categories or "").split(",") if c.strip()]
    tiers = [int(t) for t in (args.tiers or "1,2,3").split(",")]

    sub = ChannelSubscription(
        chat_id=args.chat_id,
        chat_type="private",
        categories=categories,
        tiers=tiers,
    )
    db.add_subscription(sub)
    print(f"Subscribed chat {args.chat_id}")
    return 0


def cmd_list(args):
    """List subscriptions."""
    db = BotDB()
    subs = db.get_active_subscriptions()
    print(f"Active subscriptions ({len(subs)}):")
    for sub in subs:
        cats = ", ".join(sub.categories) if sub.categories else "all"
        print(f"  {sub.chat_id} [{sub.chat_type}] tiers={sub.tiers} cats={cats}")
    return 0


def main():
    parser = argparse.ArgumentParser(description="Telegram Bot for SolFoundry Bounty Notifications")
    parser.add_argument("--token", help="Telegram bot token")
    parser.add_argument("--channel", help="Channel username or ID")

    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("run", help="Run bot in polling mode")
    subparsers.add_parser("webhook", help="Start webhook server")

    p = subparsers.add_parser("post", help="Post bounties")
    p.add_argument("--repo", help="Repository")
    p.add_argument("--issue", help="Specific issue number")
    p.add_argument("--limit", default="5", help="Max bounties to post")

    p = subparsers.add_parser("subscribe", help="Add subscription")
    p.add_argument("--chat-id", required=True)
    p.add_argument("--categories", help="Comma-separated categories")
    p.add_argument("--tiers", help="Comma-separated tiers")

    p = subparsers.add_parser("unsubscribe", help="Remove subscription")
    p.add_argument("--chat-id", required=True)

    subparsers.add_parser("list", help="List subscriptions")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    if args.command == "run":
        return cmd_run(args)
    elif args.command == "post":
        return cmd_post(args)
    elif args.command == "subscribe":
        return cmd_subscribe(args)
    elif args.command == "unsubscribe":
        db = BotDB()
        if db.unsubscribe(args.chat_id):
            print(f"Unsubscribed {args.chat_id}")
        else:
            print(f"Not found: {args.chat_id}")
        return 0
    elif args.command == "list":
        return cmd_list(args)
    else:
        print(f"Unknown command: {args.command}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
