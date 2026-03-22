#!/usr/bin/env python3
"""
SolFoundry Telegram Callback Handler.

Polls for callback_query updates from Telegram inline buttons:
- T3 claim approve/deny (t3claim_approve_*, t3claim_deny_*)
- PR review approve/deny (pr_approve_*, pr_deny_*) with escrow lock management

Run as: python3 t3_callback_handler.py [--once]
  --once: process pending callbacks and exit (for cron/manual use)
  default: poll continuously (for long-running service)

Requires env vars:
  SOLFOUNDRY_TELEGRAM_BOT_TOKEN
  SOLFOUNDRY_TELEGRAM_CHAT_ID
  GITHUB_TOKEN (with repo scope for SolFoundry/solfoundry)
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

REPO = "SolFoundry/solfoundry"
BOT_TOKEN = os.environ.get("SOLFOUNDRY_TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.environ.get("SOLFOUNDRY_TELEGRAM_CHAT_ID", "")
GH_TOKEN = os.environ.get("GITHUB_TOKEN", "")

OFFSET_FILE = os.path.expanduser("~/.wirework/t3_callback_offset.txt")


def tg_api(method, payload=None):
    """Call Telegram Bot API."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    if payload:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/json")
    else:
        req = urllib.request.Request(url)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        print(f"Telegram API error {e.code}: {body}")
        return None
    except Exception as e:
        print(f"Telegram API exception: {e}")
        return None


def gh_api(endpoint, method="GET", data=None):
    """Call GitHub API."""
    url = f"https://api.github.com/{endpoint}"
    if data:
        body = json.dumps(data).encode()
    else:
        body = None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"token {GH_TOKEN}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode() if e.fp else ""
        print(f"GitHub API error {e.code}: {body_text[:300]}")
        return None
    except Exception as e:
        print(f"GitHub API exception: {e}")
        return None


def get_offset():
    """Read last processed callback offset."""
    try:
        with open(OFFSET_FILE, "r") as f:
            return int(f.read().strip())
    except (FileNotFoundError, ValueError):
        return 0


def save_offset(offset):
    """Save callback offset."""
    os.makedirs(os.path.dirname(OFFSET_FILE), exist_ok=True)
    with open(OFFSET_FILE, "w") as f:
        f.write(str(offset))


def handle_approve(issue_num, username):
    """Approve a T3 claim: post comment on GitHub + add 'claimed' label."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    comment = (
        f"✅ **Tier 3 Claim Approved** — @{username}\n\n"
        f"Your claim on this T3 bounty has been approved by the project owner.\n\n"
        f"**Rules:**\n"
        f"- ⏰ **14-day deadline** starting now ({now})\n"
        f"- 🎯 AI review score ≥ **7.0/10** required (6.5 with veteran discount)\n"
        f"- 📋 Follow all acceptance criteria in the issue description\n"
        f"- 🔒 One T3 claim at a time — complete or release before claiming another\n\n"
        f"Good luck! 🏭\n\n"
        f"*— SolFoundry Bot 🏭*"
    )

    # Post approval comment
    result = gh_api(f"repos/{REPO}/issues/{issue_num}/comments", "POST", {"body": comment})
    if not result:
        return False, "Failed to post GitHub comment"

    # Add 'claimed' label
    gh_api(f"repos/{REPO}/issues/{issue_num}/labels", "POST", {"labels": ["claimed"]})

    # Try to assign (may fail if user isn't a collaborator — that's OK)
    gh_api(f"repos/{REPO}/issues/{issue_num}/assignees", "POST", {"assignees": [username]})

    return True, f"Approved {username} for T3 #{issue_num}"


def cleanup_lock_comment(issue_num, pr_num):
    """Delete the <!-- escrow-lock-pr-N --> tracking comment from a bounty issue.

    These comments accumulate if not cleaned up and can confuse lock detection.
    """
    comments = gh_api(f"repos/{REPO}/issues/{issue_num}/comments")
    if not comments:
        return
    marker = f"<!-- escrow-lock-pr-{pr_num} -->"
    for comment in comments:
        if marker in (comment.get("body") or ""):
            comment_id = comment.get("id")
            if comment_id:
                gh_api(f"repos/{REPO}/issues/comments/{comment_id}", "DELETE")
                print(f"Deleted lock comment {comment_id} for PR #{pr_num} on issue #{issue_num}")
            return


def get_bounty_issue_from_pr(pr_num):
    """Extract the linked bounty issue number from a PR's title + body."""
    import re
    pr_data = gh_api(f"repos/{REPO}/pulls/{pr_num}")
    if not pr_data:
        return None
    text = (pr_data.get("title", "") + " " + (pr_data.get("body") or ""))
    m = re.search(r"(?:closes|fixes|resolves)\s+#(\d+)", text, re.IGNORECASE)
    return m.group(1) if m else None


def handle_pr_approve(pr_num):
    """Approve a PR submission: merge it and remove escrow lock."""
    # Check PR state first (idempotency — don't double-merge)
    pr_data = gh_api(f"repos/{REPO}/pulls/{pr_num}")
    if pr_data and pr_data.get("merged"):
        return True, f"PR #{pr_num} already merged"
    if pr_data and pr_data.get("state") == "closed":
        return False, f"PR #{pr_num} is already closed"

    # Get issue linkage BEFORE merging (PR data may become stale after merge)
    issue_num = get_bounty_issue_from_pr(pr_num)

    # Merge the PR
    result = gh_api(f"repos/{REPO}/pulls/{pr_num}/merge", "PUT", {
        "merge_method": "squash",
        "commit_title": f"Merge bounty PR #{pr_num}"
    })
    if not result:
        return False, f"Failed to merge PR #{pr_num}"

    # Remove escrow lock from the bounty issue
    if issue_num:
        gh_api(f"repos/{REPO}/issues/{issue_num}/labels/review-passed", "DELETE")
        cleanup_lock_comment(issue_num, pr_num)

    return True, f"PR #{pr_num} merged"


def handle_pr_deny(pr_num):
    """Deny/reject a PR submission: close it and remove escrow lock."""
    # Check PR state first (idempotency — don't double-close)
    pr_data = gh_api(f"repos/{REPO}/pulls/{pr_num}")
    if pr_data and pr_data.get("state") == "closed":
        return True, f"PR #{pr_num} already closed"

    # Post rejection comment
    comment = (
        "❌ **Submission Rejected**\n\n"
        "The project owner has reviewed this submission and decided not to accept it.\n\n"
        "The bounty is now unlocked for other submissions.\n\n"
        "*— SolFoundry Bot 🏭*"
    )
    gh_api(f"repos/{REPO}/issues/{pr_num}/comments", "POST", {"body": comment})

    # Close the PR
    gh_api(f"repos/{REPO}/pulls/{pr_num}", "PATCH", {"state": "closed"})

    # Remove escrow lock from the bounty issue
    issue_num = get_bounty_issue_from_pr(pr_num)
    if issue_num:
        gh_api(f"repos/{REPO}/issues/{issue_num}/labels/review-passed", "DELETE")
        cleanup_lock_comment(issue_num, pr_num)
        # Post unlock comment on the bounty issue
        gh_api(f"repos/{REPO}/issues/{issue_num}/comments", "POST", {
            "body": "🔓 **Escrow unlocked** — submission was rejected. Bounty is open for new submissions.\n\n---\n*SolFoundry Review Bot*"
        })

    return True, f"PR #{pr_num} rejected, escrow unlocked"


def handle_deny(issue_num, username):
    """Deny a T3 claim: post comment on GitHub."""
    comment = (
        f"❌ **Tier 3 Claim Denied** — @{username}\n\n"
        f"The project owner has reviewed your claim and decided not to approve it at this time.\n\n"
        f"**Possible reasons:**\n"
        f"- Proposal doesn't demonstrate sufficient understanding of the requirements\n"
        f"- Another contributor's proposal was selected\n"
        f"- The bounty scope is being revised\n\n"
        f"You're welcome to claim other open bounties or try again with a more detailed proposal.\n\n"
        f"*— SolFoundry Bot 🏭*"
    )

    result = gh_api(f"repos/{REPO}/issues/{issue_num}/comments", "POST", {"body": comment})
    if not result:
        return False, "Failed to post GitHub comment"

    return True, f"Denied {username} for T3 #{issue_num}"


def process_callback(callback):
    """Process a single callback_query."""
    callback_id = callback.get("id")
    data = callback.get("data", "")
    message = callback.get("message", {})
    from_user = callback.get("from", {}).get("id")

    # Only allow the owner (matching CHAT_ID) to approve/deny
    if str(from_user) != str(CHAT_ID):
        tg_api("answerCallbackQuery", {
            "callback_query_id": callback_id,
            "text": "⛔ Only the project owner can approve/deny claims.",
            "show_alert": True
        })
        return

    # Parse callback data: t3claim_approve_ISSUE_USER or t3claim_deny_ISSUE_USER
    if data.startswith("t3claim_approve_"):
        parts = data.replace("t3claim_approve_", "").split("_", 1)
        if len(parts) == 2:
            issue_num, username = parts
            success, msg = handle_approve(issue_num, username)
            action = "approved"
        else:
            tg_api("answerCallbackQuery", {
                "callback_query_id": callback_id,
                "text": "❌ Invalid callback data format",
                "show_alert": True
            })
            return

    elif data.startswith("t3claim_deny_"):
        parts = data.replace("t3claim_deny_", "").split("_", 1)
        if len(parts) == 2:
            issue_num, username = parts
            success, msg = handle_deny(issue_num, username)
            action = "denied"
        else:
            tg_api("answerCallbackQuery", {
                "callback_query_id": callback_id,
                "text": "❌ Invalid callback data format",
                "show_alert": True
            })
            return
    elif data.startswith("pr_approve_"):
        pr_num = data.replace("pr_approve_", "")
        success, msg = handle_pr_approve(pr_num)
        action = "approved"

    elif data.startswith("pr_deny_"):
        pr_num = data.replace("pr_deny_", "")
        success, msg = handle_pr_deny(pr_num)
        action = "rejected"

    else:
        # Unknown callback, ignore
        tg_api("answerCallbackQuery", {"callback_query_id": callback_id})
        return

    # Answer the callback
    if success:
        # Build response text based on callback type
        if data.startswith("t3claim_"):
            answer_text = f"✅ Claim {action} for @{username} on #{issue_num}"
        else:
            answer_text = f"✅ PR {action}: {msg}"

        tg_api("answerCallbackQuery", {
            "callback_query_id": callback_id,
            "text": answer_text,
            "show_alert": False
        })

        # Edit the original message to show the decision
        if message.get("message_id"):
            original_text = message.get("text", "")
            new_text = (
                f"{original_text}\n\n"
                f"{'✅' if action in ('approved',) else '❌'} "
                f"<b>Decision: {action.upper()}</b> by owner"
            )
            tg_api("editMessageText", {
                "chat_id": CHAT_ID,
                "message_id": message["message_id"],
                "text": new_text,
                "parse_mode": "HTML",
                "reply_markup": json.dumps({"inline_keyboard": []})  # Remove buttons
            })
    else:
        tg_api("answerCallbackQuery", {
            "callback_query_id": callback_id,
            "text": f"❌ Failed: {msg}",
            "show_alert": True
        })

    print(f"[{datetime.now().isoformat()}] {msg}")


def poll_once():
    """Poll for callback queries once."""
    offset = get_offset()
    params = {"offset": offset, "timeout": 0, "allowed_updates": ["callback_query"]}
    result = tg_api("getUpdates", params)

    if not result or not result.get("ok"):
        return 0

    updates = result.get("result", [])
    processed = 0

    for update in updates:
        update_id = update.get("update_id", 0)
        callback = update.get("callback_query")

        if callback:
            cb_data = callback.get("data", "")
            if cb_data.startswith("t3claim_") or cb_data.startswith("pr_approve_") or cb_data.startswith("pr_deny_"):
                process_callback(callback)
                processed += 1

        # Always advance offset
        save_offset(update_id + 1)

    return processed


def main():
    if not BOT_TOKEN:
        print("ERROR: SOLFOUNDRY_TELEGRAM_BOT_TOKEN not set")
        sys.exit(1)
    if not GH_TOKEN:
        print("ERROR: GITHUB_TOKEN not set")
        sys.exit(1)

    once = "--once" in sys.argv

    if once:
        count = poll_once()
        print(f"Processed {count} callback(s)")
    else:
        print("SolFoundry callback handler started — polling for T3 claims + PR approvals...")
        while True:
            try:
                poll_once()
            except KeyboardInterrupt:
                print("\nStopped.")
                break
            except Exception as e:
                print(f"Error: {e}")
            time.sleep(3)


if __name__ == "__main__":
    main()
