#!/usr/bin/env python3
"""
GitHub Issue Scraper for SolFoundry

Automatically discovers GitHub issues from configured repositories, classifies
them by potential reward tier, and posts them as SolFoundry bounties with
appropriate metadata. Supports webhook mode for real-time updates.

Usage:
  python3 github-scraper.py scan                  # Scan configured repos
  python3 github-scraper.py scan --dry-run        # Preview only, no posting
  python3 github-scraper.py webhook               # Start webhook server
  python3 github-scraper.py list-repos            # Show configured repos

Configuration:
  GITHUB_TOKEN=***   # GitHub PAT with repo scope
  SOLFOUNDRY_API_URL=<url>                        # SolFoundry API endpoint
"""

import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

# 鈹€鈹€鈹€ Configuration 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
SOLFOUNDRY_API_URL = os.environ.get("SOLFOUNDRY_API_URL", "http://localhost:8000")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
WEBHOOK_PORT = int(os.environ.get("WEBHOOK_PORT", "8080"))

HEADERS = {
    "User-Agent": "solfoundry-scraper/1.0",
    "Accept": "application/vnd.github.v3+json",
}
if GITHUB_TOKEN:
    HEADERS["Authorization"] = f"token {GITHUB_TOKEN}"

# Default repos to scan
DEFAULT_REPOS = [
    "claude-builders-bounty/claude-builders-bounty",
    "warpspeedopen-source/warpspeed-bounties",
    "PlatformNetwork/bounty-challenge",
    "SecureBananaLabs/bug-bounty",
]

# Label 鈫?tier mapping
TIER_MAP = {
    "bounty": "T1",
    "paid": "T1",
    "good-first-issue": "T1",
    "help-wanted": "T1",
    "expert": "T2",
    "feature": "T2",
    "enhancement": "T2",
}

# 鈹€鈹€鈹€ Data Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

@dataclass
class ScrapedIssue:
    repo: str
    number: int
    title: str
    body: str
    html_url: str
    labels: list[str]
    state: str
    created_at: str
    updated_at: str
    comments: int
    tier: str = "T1"
    reward_estimate: str = "?"


# 鈹€鈹€鈹€ Helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

def _api(url: str, method: str = "GET", body: dict | None = None) -> Any:
    """Make a GitHub API request."""
    req = urllib.request.Request(url, method=method, headers=HEADERS)
    if body is not None:
        req.data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode()
            return json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        print(f"  鈿?API error {e.code}: {e.read().decode()[:200]}")
        return {}
    except Exception as e:
        print(f"  鈿?Request failed: {e}")
        return {}


def _estimate_tier(labels: list[str], body: str) -> str:
    """Estimate bounty tier based on labels and issue content."""
    label_lower = [l.lower().replace(" ", "-") for l in labels]
    for label, tier in TIER_MAP.items():
        if any(label in l for l in label_lower):
            return tier
    # Keyword-based fallback
    body_lower = body.lower()
    if any(kw in body_lower for kw in ["expert", "complex", "multi-step"]):
        return "T2"
    if any(kw in body_lower for kw in ["simple", "quick", "easy", "beginner"]):
        return "T1"
    return "T1"


def _estimate_reward(tier: str, labels: list[str], body: str) -> str:
    """Estimate potential reward based on tier and content."""
    # Check if bounty amount is mentioned in issue
    m = re.search(r'\$?(\d[\d,]*)\s*(USD|USDT|\$FNDRY)?', body)
    if m:
        return m.group(0)
    base = {"T1": "100-250K", "T2": "400-700K", "T3": "1M+"}
    return base.get(tier, "?")

def _dedup_key(issue: ScrapedIssue) -> str:
    """Generate a unique key for deduplication."""
    return f"{issue.repo}#{issue.number}"


# 鈹€鈹€鈹€ Scraping 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

def scan_repo(repo: str, max_issues: int = 20) -> list[ScrapedIssue]:
    """Scrape open issues from a GitHub repository."""
    print(f"  Scanning {repo}...")
    q = f"repo:{repo}+state:open+is:issue"
    data = _api(
        f"https://api.github.com/search/issues?q={q}&sort=updated&order=desc&per_page={max_issues}"
    )
    issues: list[ScrapedIssue] = []
    for item in data.get("items", []):
        labels = [l["name"] for l in item.get("labels", [])]
        issue = ScrapedIssue(
            repo=repo,
            number=item["number"],
            title=item["title"],
            body=item.get("body", "") or "",
            html_url=item["html_url"],
            labels=labels,
            state=item["state"],
            created_at=item["created_at"],
            updated_at=item["updated_at"],
            comments=item.get("comments", 0),
            tier=_estimate_tier(labels, item.get("body", "") or ""),
            reward_estimate=_estimate_reward(
                _estimate_tier(labels, item.get("body", "") or ""),
                labels,
                item.get("body", "") or "",
            ),
        )
        issues.append(issue)
    print(f"    Found {len(issues)} open issues")
    return issues


def scan_all(repos: list[str] | None = None, dry_run: bool = False) -> list[ScrapedIssue]:
    """Scan all configured repos."""
    if repos is None:
        repos = DEFAULT_REPOS
    all_issues: list[ScrapedIssue] = []
    seen = set()
    for repo in repos:
        issues = scan_repo(repo)
        for issue in issues:
            key = _dedup_key(issue)
            if key not in seen:
                seen.add(key)
                all_issues.append(issue)
    return all_issues


# 鈹€鈹€鈹€ Posting 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

def post_bounty(issue: ScrapedIssue, solfoundry_api: str, dry_run: bool = False) -> bool:
    """Post a scraped issue as a SolFoundry bounty."""
    if dry_run:
        print(f"  [DRY RUN] Would post: {issue.repo}#{issue.number} ({issue.title[:50]})")
        return True

    payload = {
        "title": issue.title,
        "description": issue.body[:2000] if issue.body else "",
        "source_url": issue.html_url,
        "source_repo": issue.repo,
        "source_issue": issue.number,
        "tier": issue.tier,
        "labels": issue.labels,
        "reward_estimate": issue.reward_estimate,
    }

    url = f"{solfoundry_api}/api/bounties/import"
    try:
        data = _api(url, method="POST", body=payload)
        if data:
            print(f"  鉁?Posted: {issue.repo}#{issue.number} 鈫?{issue.tier} ({issue.reward_estimate})")
            return True
        else:
            print(f"  鉂?Failed to post: {issue.repo}#{issue.number}")
            return False
    except Exception as e:
        print(f"  鉂?Error posting: {e}")
        return False


# 鈹€鈹€鈹€ Webhook Server 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

def start_webhook() -> None:
    """Start a simple HTTP server to receive GitHub webhooks."""
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class WebhookHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            signature = self.headers.get("X-Hub-Signature-256", "")

            # Verify webhook secret
            if WEBHOOK_SECRET:
                expected = "sha256=" + hmac.new(
                    WEBHOOK_SECRET.encode(),
                    body,
                    hashlib.sha256,
                ).hexdigest()
                if not hmac.compare_digest(signature, expected):
                    self.send_response(403)
                    self.end_headers()
                    self.wfile.write(b"Invalid signature")
                    return

            event = self.headers.get("X-GitHub-Event", "unknown")
            payload = json.loads(body.decode())

            if event == "issues" and payload.get("action") in ("opened", "reopened"):
                issue_data = payload.get("issue", {})
                repo_data = payload.get("repository", {})
                repo_full = repo_data.get("full_name", "unknown/unknown")

                issue = ScrapedIssue(
                    repo=repo_full,
                    number=issue_data["number"],
                    title=issue_data["title"],
                    body=issue_data.get("body", "") or "",
                    html_url=issue_data["html_url"],
                    labels=[l["name"] for l in issue_data.get("labels", [])],
                    state=issue_data["state"],
                    created_at=issue_data.get("created_at", ""),
                    updated_at=issue_data.get("updated_at", ""),
                    comments=issue_data.get("comments", 0),
                    tier=_estimate_tier(
                        [l["name"] for l in issue_data.get("labels", [])],
                        issue_data.get("body", "") or "",
                    ),
                )

                print(f"  馃敂 New issue: {repo_full}#{issue.number} - {issue.title[:60]}")
                post_bounty(issue, SOLFOUNDRY_API_URL)

            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")

        def log_message(self, format, *args):
            print(f"  [webhook] {args[0] if args else ''}")

        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"SolFoundry GitHub Issue Scraper Webhook running")

    server = HTTPServer(("0.0.0.0", WEBHOOK_PORT), WebhookHandler)
    print(f"  馃寪 Webhook server listening on port {WEBHOOK_PORT}")
    print(f"  Configure GitHub webhook: https://github.com/your-repo/settings/hooks")
    print(f"    Payload URL: http://<your-server>:{WEBHOOK_PORT}")
    print(f"    Content type: application/json")
    print(f"    Secret: {WEBHOOK_SECRET or '(not set)'}")
    print(f"    Events: Issues")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Shutting down...")
        server.server_close()


# 鈹€鈹€鈹€ CLI 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

def cmd_scan(dry_run: bool = False) -> None:
    """Scan all configured repos."""
    print(f"\n馃攳 Scanning configured repositories...\n")
    repos = DEFAULT_REPOS
    issues = scan_all(repos, dry_run=dry_run)

    if not issues:
        print("\n  No issues found.")
        return

    # Group by tier
    tiers: dict[str, list[ScrapedIssue]] = {}
    for issue in issues:
        tiers.setdefault(issue.tier, []).append(issue)

    print(f"\n{'鈹€' * 60}")
    print(f"  Total: {len(issues)} issues from {len(repos)} repos\n")

    for tier in sorted(tiers.keys()):
        tier_issues = tiers[tier]
        print(f"  [{tier}] {len(tier_issues)} issues:")
        for issue in tier_issues:
            est = f"[{issue.reward_estimate}]" if issue.reward_estimate != "?" else ""
            print(f"    鈥?{issue.repo}#{issue.number} {est}")
            print(f"      {issue.title[:70]}")
        print()

    if dry_run:
        print(f"  馃挕 Run without --dry-run to post to SolFoundry API.\n")
    else:
        print(f"  馃挕 Use --dry-run to preview without posting.\n")


def cmd_post(dry_run: bool = False) -> None:
    """Scan and post to SolFoundry."""
    print(f"\n馃殌 Scanning and posting to SolFoundry...\n")
    repos = DEFAULT_REPOS
    issues = scan_all(repos, dry_run=dry_run)

    if not issues:
        print("\n  No issues found.")
        return

    print(f"\n  Posting {len(issues)} issues to {SOLFOUNDRY_API_URL}...\n")
    success = 0
    for issue in issues:
        if post_bounty(issue, SOLFOUNDRY_API_URL, dry_run=dry_run):
            success += 1

    print(f"\n  鉁?{success}/{len(issues)} posted successfully")
    if dry_run:
        print(f"  馃挕 Run without --dry-run to actually post.")


def cmd_webhook() -> None:
    """Start webhook server."""
    print(f"\n馃寪 Starting webhook server...\n")
    start_webhook()


def cmd_list_repos() -> None:
    """Show configured repos."""
    print(f"\n馃搵 Configured repositories:\n")
    for repo in DEFAULT_REPOS:
        data = _api(f"https://api.github.com/repos/{repo}")
        desc = (data.get("description") or "no description")[:80]
        stars = data.get("stargazers_count", "?")
        print(f"  鈥?{repo}")
        print(f"    猸?{stars} | {desc}")
    print()


# 鈹€鈹€鈹€ Main 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        return

    command = sys.argv[1]
    dry_run = "--dry-run" in sys.argv

    if command == "scan":
        cmd_scan(dry_run=dry_run)
    elif command == "post":
        cmd_post(dry_run=dry_run)
    elif command == "webhook":
        cmd_webhook()
    elif command == "list-repos":
        cmd_list_repos()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)


if __name__ == "__main__":
    main()
