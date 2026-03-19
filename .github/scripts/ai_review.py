#!/usr/bin/env python3
"""
SolFoundry AI Code Review Bot
Runs on every PR — reviews code quality, security, and bounty compliance.
Posts review comment on PR + sends summary to Telegram.
"""

import os
import json
import requests
from datetime import datetime
from openai import OpenAI

def get_diff():
    with open("/tmp/pr_diff.txt", "r") as f:
        diff = f.read()
    # Truncate massive diffs to avoid token limits
    if len(diff) > 30000:
        diff = diff[:30000] + "\n\n... [diff truncated — too large for full review]"
    return diff

def run_review(diff: str, pr_title: str, pr_body: str) -> dict:
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    prompt = f"""You are a senior code reviewer for SolFoundry, an AI software factory on Solana.

Review this pull request diff. The PR is a bounty submission from an external contributor.

PR Title: {pr_title}
PR Description: {pr_body or "No description provided."}

Evaluate:
1. **Code Quality** (1-10): Clean code, proper naming, no dead code, follows conventions
2. **Correctness** (1-10): Does it work? Logic errors? Edge cases handled?
3. **Security** (1-10): XSS, injection, exposed secrets, unsafe patterns
4. **Completeness** (1-10): Does it match the bounty spec? Missing features?
5. **Tests** (1-10): Are there tests? Good coverage?

For each category, give a score and brief explanation.

Then provide:
- **Overall verdict**: APPROVE, REQUEST_CHANGES, or REJECT
- **Summary**: 2-3 sentence overview
- **Issues**: List specific problems with file paths and line numbers
- **Suggestions**: Improvements that aren't blockers

Be strict but fair. We pay $FNDRY bounties for quality work only.

DIFF:
```
{diff}
```

Respond in this exact JSON format:
{{
  "quality_score": 7,
  "quality_note": "...",
  "correctness_score": 8,
  "correctness_note": "...",
  "security_score": 9,
  "security_note": "...",
  "completeness_score": 6,
  "completeness_note": "...",
  "tests_score": 3,
  "tests_note": "...",
  "overall_score": 6.6,
  "verdict": "REQUEST_CHANGES",
  "summary": "...",
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1"]
}}"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        response_format={"type": "json_object"}
    )

    return json.loads(response.choices[0].message.content)

def post_pr_comment(review: dict):
    """Post the review as a PR comment."""
    pr_number = os.environ["PR_NUMBER"]
    repo = os.environ.get("GITHUB_REPOSITORY", "SolFoundry/solfoundry")
    token = os.environ["GH_TOKEN"]

    verdict_emoji = {
        "APPROVE": "\u2705",
        "REQUEST_CHANGES": "\u26a0\ufe0f",
        "REJECT": "\u274c"
    }
    emoji = verdict_emoji.get(review["verdict"], "\u2753")

    scores = f"""| Category | Score | Notes |
|----------|-------|-------|
| Code Quality | {review['quality_score']}/10 | {review['quality_note']} |
| Correctness | {review['correctness_score']}/10 | {review['correctness_note']} |
| Security | {review['security_score']}/10 | {review['security_note']} |
| Completeness | {review['completeness_score']}/10 | {review['completeness_note']} |
| Tests | {review['tests_score']}/10 | {review['tests_note']} |"""

    issues_md = "\n".join(f"- {i}" for i in review.get("issues", [])) or "None found."
    suggestions_md = "\n".join(f"- {s}" for s in review.get("suggestions", [])) or "None."

    body = f"""## {emoji} AI Code Review — {review['verdict']}

**Overall Score: {review['overall_score']}/10**

{review['summary']}

### Scores
{scores}

### Issues
{issues_md}

### Suggestions
{suggestions_md}

---
*Reviewed by SolFoundry AI Review Bot*
"""

    url = f"https://api.github.com/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    resp = requests.post(url, json={"body": body}, headers=headers)
    print(f"PR comment posted: {resp.status_code}")

def send_telegram(review: dict):
    """Send review summary to SolFoundry Telegram with inline action buttons."""
    bot_token = os.environ.get("SOLFOUNDRY_TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("SOLFOUNDRY_TELEGRAM_CHAT_ID")

    if not bot_token or not chat_id:
        print("Telegram not configured — skipping notification")
        return

    pr_number = os.environ["PR_NUMBER"]
    pr_title = os.environ["PR_TITLE"]
    pr_author = os.environ["PR_AUTHOR"]
    pr_url = os.environ["PR_URL"]

    verdict_emoji = {"APPROVE": "\u2705", "REQUEST_CHANGES": "\u26a0\ufe0f", "REJECT": "\u274c"}
    emoji = verdict_emoji.get(review["verdict"], "\u2753")

    # Build inline keyboard with action buttons
    inline_keyboard = [
        [
            {"text": "\u2705 Approve & Merge", "callback_data": f"pr_approve_{pr_number}"},
            {"text": "\u26a0\ufe0f Request Changes", "callback_data": f"pr_changes_{pr_number}"}
        ],
        [
            {"text": "\u274c Deny & Close", "callback_data": f"pr_deny_{pr_number}"},
            {"text": "\U0001f916 Re-review", "callback_data": f"pr_review_{pr_number}"}
        ],
        [
            {"text": "\U0001f517 View on GitHub", "url": pr_url}
        ]
    ]

    # Top issues (first 3)
    issues_preview = ""
    if review.get("issues"):
        top_issues = review["issues"][:3]
        issues_preview = "\n<b>Issues:</b>\n" + "\n".join(f"  \u2022 {i[:80]}" for i in top_issues)

    msg = f"""{emoji} <b>PR #{pr_number}: {pr_title}</b>
by {pr_author}

<b>Score:</b> {review['overall_score']}/10 — {review['verdict']}
<b>Quality:</b> {review['quality_score']} | <b>Correctness:</b> {review['correctness_score']} | <b>Security:</b> {review['security_score']}
<b>Completeness:</b> {review['completeness_score']} | <b>Tests:</b> {review['tests_score']}

{review['summary']}{issues_preview}"""

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    resp = requests.post(url, json={
        "chat_id": chat_id,
        "text": msg,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
        "reply_markup": {"inline_keyboard": inline_keyboard}
    })
    print(f"Telegram notification: {resp.status_code}")

    # Also save review data for the bot to reference
    import pathlib
    data_dir = pathlib.Path.home() / ".solfoundry" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    state_file = data_dir / "state.json"
    try:
        state = json.loads(state_file.read_text()) if state_file.exists() else {}
        if "pending_prs" not in state:
            state["pending_prs"] = {}
        state["pending_prs"][str(pr_number)] = {
            "title": pr_title,
            "author": pr_author,
            "url": pr_url,
            "score": review["overall_score"],
            "verdict": review["verdict"],
            "reviewed_at": datetime.now().isoformat()
        }
        if "stats" not in state:
            state["stats"] = {}
        state["stats"]["prs_reviewed"] = state["stats"].get("prs_reviewed", 0) + 1
        state_file.write_text(json.dumps(state, indent=2, default=str))
    except Exception as e:
        print(f"State save warning: {e}")

def main():
    print("Starting AI Code Review...")

    diff = get_diff()
    if len(diff.strip()) < 10:
        print("Empty or trivial diff — skipping review")
        return

    pr_title = os.environ.get("PR_TITLE", "Unknown PR")
    pr_body = os.environ.get("PR_BODY", "")

    print(f"Reviewing PR: {pr_title}")
    print(f"Diff size: {len(diff)} chars")

    review = run_review(diff, pr_title, pr_body)
    print(f"Review verdict: {review['verdict']} ({review['overall_score']}/10)")

    post_pr_comment(review)
    send_telegram(review)

    # Set exit code based on verdict
    if review["verdict"] == "REJECT":
        print("::error::PR rejected by AI review")

    print("Review complete!")

if __name__ == "__main__":
    main()
