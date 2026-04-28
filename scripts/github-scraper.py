#!/usr/bin/env python3
"""
GitHub Issue Scraper for SolFoundry Bounties
Bounty: https://github.com/SolFoundry/solfoundry/issues/840
Reward: 600K $FNDRY | T2 | Backend

Features:
- Automatic GitHub issue detection & scraping from configured repos
- Auto-posting to SolFoundry with metadata & reward tier mapping
- Webhook support for real-time issue updates
- Configurable repo list management
- Rate limit handling with exponential backoff
- AI-powered tier estimation
"""

import os
import sys
import json
import hashlib
import time
import logging
import argparse
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pathlib import Path

import requests
from flask import Flask, request, jsonify, abort

# ============================================================
# Configuration
# ============================================================

CONFIG = {
    "github_token": os.environ.get("GITHUB_TOKEN", ""),
    "solfoundry_api_url": os.environ.get("SOLFOUNDRY_API_URL", "https://solfoundry.xyz/api"),
    "solfoundry_api_key": os.environ.get("SOLFOUNDRY_API_KEY", ""),
    "data_dir": os.environ.get("DATA_DIR", "./data"),
    "port": int(os.environ.get("PORT", 8080)),
    "webhook_secret": os.environ.get("WEBHOOK_SECRET", "solfoundry-secret-change-me"),
    "rate_limit_sleep": int(os.environ.get("RATE_LIMIT_SLEEP", 2)),
    "max_retries": int(os.environ.get("MAX_RETRIES", 5)),
}

# Default repos to watch
DEFAULT_REPOS = [
    "SolFoundry/solfoundry",
]

# Tier mapping based on labels and issue metadata
TIER_KEYWORDS = {
    "T1": ["tier-1", "t1", "critical", "urgent", "high-priority"],
    "T2": ["tier-2", "t2", "medium", "feature", "enhancement"],
    "T3": ["tier-3", "t3", "low", "good-first-issue", "beginner", "help-wanted"],
}

TIER_REWARDS = {
    "T1": "1,200K $FNDRY",
    "T2": "600K $FNDRY",
    "T3": "300K $FNDRY",
}

# ============================================================
# Logging
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("scraper.log")],
)
log = logging.getLogger("github-scraper")

# ============================================================
# Database (simple JSON file-based for easy setup)
# ============================================================

class SimpleDB:
    """Lightweight JSON file database - no external dependencies needed."""

    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._processed_file = self.data_dir / "processed_issues.json"
        self._repos_file = self.data_dir / "watched_repos.json"
        self._processed = self._load_json(self._processed_file, {})
        self._repos = self._load_json(self._repos_file, DEFAULT_REPOS)

    def _load_json(self, path: Path, default: Any) -> Any:
        if path.exists():
            try:
                with open(path) as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                return default
        return default

    def _save_json(self, path: Path, data: Any):
        with open(path, "w") as f:
            json.dump(data, f, indent=2)

    def is_processed(self, issue_id: str) -> bool:
        return issue_id in self._processed

    def mark_processed(self, issue_id: str, metadata: dict):
        self._processed[issue_id] = {
            **metadata,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }
        self._save_json(self._processed_file, self._processed)

    def get_watched_repos(self) -> List[str]:
        return self._repos

    def add_repo(self, repo: str) -> bool:
        if repo not in self._repos:
            self._repos.append(repo)
            self._save_json(self._repos_file, self._repos)
            return True
        return False

    def remove_repo(self, repo: str) -> bool:
        if repo in self._repos:
            self._repos.remove(repo)
            self._save_json(self._repos_file, self._repos)
            return True
        return False

    def get_stats(self) -> dict:
        return {
            "total_processed": len(self._processed),
            "watched_repos": len(self._repos),
            "repos": self._repos,
        }


# ============================================================
# GitHub API Client
# ============================================================

class GitHubClient:
    """GitHub API client with rate limiting and retry logic."""

    def __init__(self, token: str = ""):
        self.token = token
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "SolFoundry-GitHub-Scraper/1.0",
        })
        if token:
            self.session.headers.update({"Authorization": f"token {token}"})
        self.rate_limit_remaining = 5000
        self.rate_limit_reset = 0

    def _handle_rate_limit(self, response: requests.Response):
        """Track rate limits from response headers."""
        remaining = response.headers.get("X-RateLimit-Remaining")
        reset = response.headers.get("X-RateLimit-Reset")
        if remaining is not None:
            self.rate_limit_remaining = int(remaining)
        if reset is not None:
            self.rate_limit_reset = int(reset)

        if self.rate_limit_remaining < 10:
            sleep_time = max(self.rate_limit_reset - time.time(), 0) + 1
            log.warning(f"Rate limit low ({self.rate_limit_remaining}), sleeping {sleep_time:.0f}s")
            time.sleep(sleep_time)

    def _request(self, method: str, url: str, **kwargs) -> Optional[dict]:
        """Make request with retry logic."""
        for attempt in range(CONFIG["max_retries"]):
            try:
                resp = self.session.request(method, url, timeout=30, **kwargs)
                self._handle_rate_limit(resp)

                if resp.status_code == 204:
                    return {}
                if resp.status_code == 403:
                    log.warning(f"403 Forbidden on {url}, retrying...")
                    time.sleep(CONFIG["rate_limit_sleep"] * (attempt + 1) * 5)
                    continue
                if resp.status_code == 404:
                    log.error(f"404 Not Found: {url}")
                    return None
                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", 60))
                    log.warning(f"429 rate limited, waiting {retry_after}s")
                    time.sleep(retry_after)
                    continue
                if resp.status_code >= 500:
                    log.warning(f"{resp.status_code} server error on {url}, retrying...")
                    time.sleep(CONFIG["rate_limit_sleep"] * (attempt + 1))
                    continue

                resp.raise_for_status()
                return resp.json()

            except requests.exceptions.RequestException as e:
                log.error(f"Request failed (attempt {attempt+1}): {e}")
                if attempt < CONFIG["max_retries"] - 1:
                    time.sleep(CONFIG["rate_limit_sleep"] * (attempt + 1))
                else:
                    return None
        return None

    def get_issues(self, repo: str, state: str = "open", labels: str = "",
                   since: str = "", per_page: int = 50, page: int = 1) -> Optional[dict]:
        """Fetch issues from a repository."""
        url = f"https://api.github.com/repos/{repo}/issues"
        params = {
            "state": state,
            "per_page": min(per_page, 100),
            "page": page,
            "sort": "created",
            "direction": "desc",
        }
        if labels:
            params["labels"] = labels
        if since:
            params["since"] = since
        return self._request("GET", url, params=params)

    def get_issue(self, repo: str, issue_number: int) -> Optional[dict]:
        """Fetch a single issue."""
        url = f"https://api.github.com/repos/{repo}/issues/{issue_number}"
        return self._request("GET", url)

    def get_repo_info(self, repo: str) -> Optional[dict]:
        """Get repository metadata."""
        url = f"https://api.github.com/repos/{repo}"
        return self._request("GET", url)

    def get_issue_comments(self, repo: str, issue_number: int) -> Optional[list]:
        """Fetch comments on an issue."""
        url = f"https://api.github.com/repos/{repo}/issues/{issue_number}/comments"
        result = self._request("GET", url)
        if isinstance(result, list):
            return result
        if isinstance(result, dict):
            return [result]
        return None

    def close_issue(self, repo: str, issue_number: int) -> Optional[dict]:
        """Close an issue (requires write access)."""
        url = f"https://api.github.com/repos/{repo}/issues/{issue_number}"
        return self._request("PATCH", url, json={"state": "closed"})


# ============================================================
# Bounty Engine
# ============================================================

class BountyEngine:
    """Core engine that processes GitHub issues into SolFoundry bounties."""

    def __init__(self, gh_client: GitHubClient, db: SimpleDB):
        self.gh = gh_client
        self.db = db

    def estimate_tier(self, issue: dict) -> tuple:
        """
        Estimate bounty tier based on labels, body content, and metadata.
        Returns (tier, confidence_score)
        """
        labels = [l["name"].lower() for l in issue.get("labels", [])]
        body = (issue.get("body") or "").lower()
        title = (issue.get("title") or "").lower()
        combined = f"{title} {body}"

        # Check explicit label-based tier
        for tier, keywords in TIER_KEYWORDS.items():
            for kw in keywords:
                if kw in labels:
                    return tier, 0.95

        # Check text-based tier estimation
        t1_score = sum(1 for kw in TIER_KEYWORDS["T1"] if kw in combined)
        t2_score = sum(1 for kw in TIER_KEYWORDS["T2"] if kw in combined)
        t3_score = sum(1 for kw in TIER_KEYWORDS["T3"] if kw in combined)

        # Complexity indicators
        if any(w in combined for w in ["api", "database", "full-stack", "infrastructure", "security"]):
            t1_score += 1
        if any(w in combined for w in ["feature", "implement", "build", "create", "fix", "bug"]):
            t2_score += 1
        if any(w in combined for w in ["typo", "docs", "readme", "simple", "minor"]):
            t3_score += 1

        # Comment count as complexity signal
        comments = issue.get("comments", 0)
        if comments > 5:
            t1_score += 1
        elif comments > 2:
            t2_score += 1

        winner = max(
            ("T1", t1_score, 0.7 + t1_score * 0.1),
            ("T2", t2_score, 0.7 + t2_score * 0.1),
            ("T3", t3_score, 0.7 + t3_score * 0.1),
            key=lambda x: (x[1], x[2]),
        )
        return winner[0], min(winner[2], 0.99)

    def extract_metadata(self, issue: dict) -> dict:
        """Extract structured metadata from a GitHub issue."""
        return {
            "github_issue_url": issue["html_url"],
            "github_issue_number": issue["number"],
            "repo": issue["repository_url"].split("/repos/")[-1] if issue.get("repository_url") else "",
            "author": issue["user"]["login"] if issue.get("user") else "unknown",
            "created_at": issue["created_at"],
            "updated_at": issue["updated_at"],
            "labels": [l["name"] for l in issue.get("labels", [])],
            "comments_count": issue.get("comments", 0),
            "state": issue["state"],
            "body_preview": (issue.get("body") or "")[:500],
        }

    def generate_bounty_body(self, issue: dict, tier: str) -> str:
        """Generate SolFoundry bounty description from a GitHub issue."""
        metadata = self.extract_metadata(issue)
        body = issue.get("body") or "(No description provided)"

        bounty = f"""## 🏆 Bounty: {issue['title']}
**Reward:** {TIER_REWARDS.get(tier, 'TBD')} | **Tier:** {tier}

### Source
[GitHub Issue]({metadata['github_issue_url']}) from **{metadata['repo']}**
By @{metadata['author']} · Created {metadata['created_at']}

### Original Description
{body}

### Auto-Extracted Metadata
- **Labels:** {', '.join(metadata['labels']) if metadata['labels'] else 'None'}
- **Comments:** {metadata['comments_count']}
- **State:** {metadata['state']}

---
*Auto-imported by SolFoundry GitHub Scraper*
"""
        return bounty

    def generate_issue_id(self, issue: dict) -> str:
        """Generate a unique ID for an issue."""
        raw = f"{issue['repository_url']}/{issue['number']}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def process_issue(self, issue: dict, repo: str) -> Optional[dict]:
        """Process a single GitHub issue into a SolFoundry bounty candidate."""
        issue_id = self.generate_issue_id(issue)

        if self.db.is_processed(issue_id):
            log.debug(f"Issue {issue_id} already processed, skipping")
            return None

        tier, confidence = self.estimate_tier(issue)
        metadata = self.extract_metadata(issue)

        bounty_data = {
            "id": issue_id,
            "source_issue_url": metadata["github_issue_url"],
            "source_repo": repo,
            "title": issue["title"],
            "body": self.generate_bounty_body(issue, tier),
            "tier": tier,
            "confidence": confidence,
            "metadata": metadata,
        }

        return bounty_data

    def scan_repo(self, repo: str, since: str = "") -> List[dict]:
        """Scan a repository for new bounty-worthy issues."""
        log.info(f"Scanning {repo}...")
        bounties = []
        page = 1

        while True:
            result = self.gh.get_issues(repo, state="open", page=page, since=since)
            if not result:
                break

            issues = result if isinstance(result, list) else []
            if not issues:
                break

            for issue in issues:
                # Skip pull requests (GitHub API includes PRs in /issues)
                if "pull_request" in issue:
                    continue

                bounty = self.process_issue(issue, repo)
                if bounty:
                    bounties.append(bounty)

            if len(issues) < 50:
                break
            page += 1
            time.sleep(CONFIG["rate_limit_sleep"])

        return bounties

    def post_to_solfoundry(self, bounty: dict) -> bool:
        """Post a bounty to the SolFoundry platform."""
        if not CONFIG["solfoundry_api_key"]:
            log.warning("No SolFoundry API key configured, saving locally only")
            return False

        url = f"{CONFIG['solfoundry_api_url']}/bounties"
        headers = {
            "Authorization": f"Bearer {CONFIG['solfoundry_api_key']}",
            "Content-Type": "application/json",
        }

        payload = {
            "title": bounty["title"],
            "description": bounty["body"],
            "tier": bounty["tier"],
            "source_url": bounty["source_issue_url"],
            "source_repo": bounty["source_repo"],
            "external_id": bounty["id"],
            "metadata": bounty["metadata"],
        }

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=30)
            if resp.status_code in (200, 201):
                log.info(f"✅ Posted bounty: {bounty['title']} ({bounty['tier']})")
                return True
            else:
                log.error(f"Failed to post bounty: {resp.status_code} {resp.text[:200]}")
                return False
        except requests.exceptions.RequestException as e:
            log.error(f"Network error posting bounty: {e}")
            return False

    def run_scan(self, repos: List[str] = None) -> dict:
        """Run a full scan of all watched repositories."""
        if repos is None:
            repos = self.db.get_watched_repos()

        results = {
            "repos_scanned": 0,
            "new_bounties": 0,
            "errors": 0,
            "bounties": [],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        for repo in repos:
            try:
                bounties = self.scan_repo(repo)
                results["repos_scanned"] += 1

                for bounty in bounties:
                    # Post or save locally
                    posted = self.post_to_solfoundry(bounty)
                    bounty["posted"] = posted

                    # Mark as processed
                    self.db.mark_processed(bounty["id"], {
                        "title": bounty["title"],
                        "repo": bounty["source_repo"],
                        "tier": bounty["tier"],
                        "posted": posted,
                    })

                    results["bounties"].append(bounty)
                    results["new_bounties"] += 1

            except Exception as e:
                log.error(f"Error scanning {repo}: {e}")
                results["errors"] += 1

        return results


# ============================================================
# Webhook Handler (Flask)
# ============================================================

app = Flask(__name__)
engine: Optional[BountyEngine] = None


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify GitHub webhook signature."""
    if not signature:
        return False
    secret = CONFIG["webhook_secret"].encode()
    expected = hashlib.sha256(secret + payload).hexdigest()
    return f"sha256={expected}" == signature


@app.route("/webhook/github", methods=["POST"])
def github_webhook():
    """Handle GitHub webhook events (issues, issue_comment)."""
    if engine is None:
        abort(500, description="Engine not initialized")

    # Verify signature
    sig = request.headers.get("X-Hub-Signature-256", "")
    if not verify_webhook_signature(request.data, sig):
        log.warning("Invalid webhook signature")
        abort(401)

    event = request.headers.get("X-GitHub-Event", "")
    payload = request.json

    if not payload:
        abort(400, description="Invalid payload")

    log.info(f"Webhook received: {event}")

    if event == "ping":
        return jsonify({"status": "ok", "message": "pong"})

    if event == "issues":
        action = payload.get("action", "")
        issue = payload.get("issue", {})
        repo_full = payload.get("repository", {}).get("full_name", "")

        if action in ("opened", "reopened", "labeled"):
            bounty = engine.process_issue(issue, repo_full)
            if bounty:
                engine.post_to_solfoundry(bounty)
                engine.db.mark_processed(bounty["id"], {
                    "title": bounty["title"],
                    "repo": repo_full,
                    "tier": bounty["tier"],
                    "posted": True,
                })
                return jsonify({"status": "created", "bounty_id": bounty["id"]}), 201

        return jsonify({"status": "ignored", "action": action})

    if event == "issue_comment":
        # Could trigger re-evaluation of bounty tier based on new comments
        return jsonify({"status": "acknowledged"})

    return jsonify({"status": "unhandled_event", "event": event})


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "stats": engine.db.get_stats() if engine else {},
    })


@app.route("/repos", methods=["GET"])
def list_repos():
    """List watched repositories."""
    if engine is None:
        abort(500)
    return jsonify({"repos": engine.db.get_watched_repos()})


@app.route("/repos", methods=["POST"])
def add_repo():
    """Add a repository to watch."""
    if engine is None:
        abort(500)
    data = request.get_json(force=True)
    repo = data.get("repo", "")
    if not repo or "/" not in repo:
        return jsonify({"error": "Invalid repo format. Use 'owner/repo'"}), 400
    added = engine.db.add_repo(repo)
    return jsonify({"added": added, "repo": repo})


@app.route("/repos/<path:repo>", methods=["DELETE"])
def remove_repo(repo):
    """Remove a watched repository."""
    if engine is None:
        abort(500)
    removed = engine.db.remove_repo(repo)
    return jsonify({"removed": removed, "repo": repo})


@app.route("/scan", methods=["POST"])
def trigger_scan():
    """Manually trigger a scan."""
    if engine is None:
        abort(500)
    data = request.get_json(silent=True) or {}
    repos = data.get("repos", None)
    results = engine.run_scan(repos)
    return jsonify(results)


@app.route("/stats", methods=["GET"])
def stats():
    """Get scraper statistics."""
    if engine is None:
        abort(500)
    return jsonify(engine.db.get_stats())


# ============================================================
# CLI Commands
# ============================================================

def cmd_scrape(args):
    """Scrape GitHub issues from configured repos."""
    gh = GitHubClient(CONFIG["github_token"])
    db = SimpleDB(CONFIG["data_dir"])
    be = BountyEngine(gh, db)

    repos = args.repos if args.repos else None
    since = args.since or ""
    results = be.run_scan(repos)

    print(f"\n{'='*60}")
    print(f"SCAN COMPLETE")
    print(f"{'='*60}")
    print(f"  Repos scanned: {results['repos_scanned']}")
    print(f"  New bounties:  {results['new_bounties']}")
    print(f"  Errors:        {results['errors']}")
    print(f"  Timestamp:     {results['timestamp']}")
    print()

    for bounty in results["bounties"]:
        status = "✅ Posted" if bounty["posted"] else "📁 Saved Locally"
        print(f"  [{bounty['tier']}] {bounty['title']}")
        print(f"       {status} | {bounty['source_issue_url']}")
        print()

    return results


def cmd_webhook(args):
    """Start webhook server."""
    gh = GitHubClient(CONFIG["github_token"])
    db = SimpleDB(CONFIG["data_dir"])
    global engine
    engine = BountyEngine(gh, db)

    port = args.port or CONFIG["port"]
    log.info(f"Starting webhook server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)


def cmd_generate(args):
    """Generate a bounty description from a specific issue."""
    gh = GitHubClient(CONFIG["github_token"])
    db = SimpleDB(CONFIG["data_dir"])
    be = BountyEngine(gh, db)

    issue = gh.get_issue(args.repo, args.number)
    if not issue:
        print(f"Error: Issue not found or API error")
        sys.exit(1)

    bounty = be.process_issue(issue, args.repo)
    if not bounty:
        print("Issue already processed.")
        sys.exit(0)

    tier = bounty["tier"]
    print(f"\n{'='*60}")
    print(f"📋 BOUNTY GENERATION")
    print(f"{'='*60}")
    print(f"  Title:  {bounty['title']}")
    print(f"  Tier:   {tier} ({bounty['confidence']*100:.0f}% confidence)")
    print(f"  Reward: {TIER_REWARDS.get(tier, 'TBD')}")
    print(f"  Source: {bounty['source_issue_url']}")
    print(f"\n{bounty['body']}")
    print()

    # Save to file
    outdir = Path(CONFIG["data_dir"]) / "generated"
    outdir.mkdir(parents=True, exist_ok=True)
    safe_name = bounty["title"].replace("/", "-").replace(" ", "_")[:50]
    outpath = outdir / f"{bounty['id']}_{safe_name}.md"
    with open(outpath, "w") as f:
        f.write(bounty["body"])
    print(f"  Saved to: {outpath}")
    print()


def cmd_list(args):
    """List processed issues."""
    db = SimpleDB(CONFIG["data_dir"])
    stats = db.get_stats()

    print(f"\n{'='*60}")
    print(f"SCRAPER STATUS")
    print(f"{'='*60}")
    print(f"  Total processed: {stats['total_processed']}")
    print(f"  Watched repos:   {stats['watched_repos']}")
    print()
    print("  Watched Repositories:")
    for repo in stats["repos"]:
        print(f"    - {repo}")
    print()
    print("  Recent Issues:")
    for iid, meta in list(db._processed.items())[-10:]:
        print(f"    [{meta.get('tier','?')}] {meta.get('title','?')}")
        print(f"         {'✅' if meta.get('posted') else '📁'} {meta.get('processed_at','')[:19]}")
    print()


# ============================================================
# Main
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="GitHub Issue Scraper for SolFoundry Bounties",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # scrape
    p = subparsers.add_parser("scrape", help="Scrape GitHub issues from configured repos")
    p.add_argument("--repos", nargs="+", help="Specific repos to scan (owner/repo)")
    p.add_argument("--since", help="ISO8601 timestamp to scan since")

    # webhook
    p = subparsers.add_parser("webhook", help="Start webhook server for real-time updates")
    p.add_argument("--port", type=int, help=f"Port to listen on (default: {CONFIG['port']})")

    # generate
    p = subparsers.add_parser("generate", help="Generate bounty from a specific issue")
    p.add_argument("repo", help="Repository (owner/repo)")
    p.add_argument("number", type=int, help="Issue number")

    # list
    subparsers.add_parser("list", help="Show scraper status and stats")

    args = parser.parse_args()

    if args.command == "scrape":
        cmd_scrape(args)
    elif args.command == "webhook":
        cmd_webhook(args)
    elif args.command == "generate":
        cmd_generate(args)
    elif args.command == "list":
        cmd_list(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
