#!/usr/bin/env python3
"""GitHub Issue Scraper for SolFoundry Bounties

Scrapes GitHub issues from configured repositories and converts them into
SolFoundry bounty specifications. Supports both polling and webhook modes.

Usage:
    # Scrape issues from configured repos
    python3 scripts/github-scraper.py scrape

    # Scrape specific repo
    python3 scripts/github-scraper.py scrape --repo owner/repo

    # Start webhook server for real-time updates
    python3 scripts/github-scraper.py webhook --port 8080

    # Generate bounty YAML from issues
    python3 scripts/github-scraper.py generate --repo owner/repo --output specs/

    # List configured repos
    python3 scripts/github-scraper.py list

Environment variables:
    GITHUB_TOKEN          - GitHub PAT for API access
    SCRAPER_CONFIG        - Path to config file (default: scraper-config.yaml)
    WEBHOOK_SECRET        - Secret for GitHub webhook validation
    SOLFOUNDRY_API_URL    - SolFoundry API URL for auto-posting (optional)
"""

import argparse
import hashlib
import hmac
import json
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class ScraperConfig:
    """Configuration for the GitHub Issue Scraper."""
    repos: list[str] = field(default_factory=list)  # ["owner/repo", ...]
    labels_filter: list[str] = field(default_factory=lambda: ["bug", "feature", "enhancement"])
    min_reward_tier: int = 1  # Minimum tier to consider
    max_issues_per_repo: int = 20
    poll_interval_seconds: int = 300  # 5 minutes
    github_token: str = ""
    webhook_secret: str = ""
    solfoundry_api_url: str = ""
    output_dir: str = "specs"

    @classmethod
    def from_yaml(cls, path: str) -> "ScraperConfig":
        """Load config from YAML file."""
        import yaml
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

    def to_yaml(self, path: str):
        """Save config to YAML file."""
        import yaml
        with open(path, 'w') as f:
            yaml.dump(asdict(self), f, default_flow_style=False)


@dataclass
class GitHubIssue:
    """A GitHub issue extracted for bounty conversion."""
    number: int
    title: str
    body: str
    repo: str
    url: str
    labels: list[str] = field(default_factory=list)
    author: str = ""
    created_at: str = ""
    updated_at: str = ""
    comments: int = 0
    assignees: list[str] = field(default_factory=list)

    @property
    def id(self) -> str:
        return f"{self.repo}#{self.number}"


@dataclass
class BountySpec:
    """A SolFoundry bounty specification."""
    title: str
    description: str
    tier: int
    reward: int
    category: str
    skills: list[str] = field(default_factory=list)
    github_issue_url: str = ""
    created_by: str = "github-scraper"
    deadline: Optional[str] = None

    def to_yaml(self) -> str:
        """Convert to YAML format for SolFoundry bounty spec."""
        import yaml
        data = asdict(self)
        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}
        return yaml.dump(data, default_flow_style=False)


# ---------------------------------------------------------------------------
# GitHub API client
# ---------------------------------------------------------------------------

class GitHubClient:
    """Simple GitHub API client using urllib."""

    BASE_URL = "https://api.github.com"

    def __init__(self, token: str = ""):
        self.token = token
        self._rate_limit_remaining = 5000
        self._rate_limit_reset = 0

    def _headers(self) -> dict:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "SolFoundry-Scraper/1.0",
        }
        if self.token:
            headers["Authorization"] = f"token {self.token}"
        return headers

    def _request(self, url: str, method: str = "GET", data: dict = None) -> dict:
        """Make a GitHub API request."""
        # Check rate limit
        if self._rate_limit_remaining < 10:
            wait_time = max(0, self._rate_limit_reset - time.time())
            if wait_time > 0:
                print(f"Rate limit low ({self._rate_limit_remaining}), waiting {wait_time:.0f}s...")
                time.sleep(min(wait_time, 60))

        headers = self._headers()
        body = json.dumps(data).encode() if data else None

        req = urllib.request.Request(url, data=body, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                # Update rate limit
                self._rate_limit_remaining = int(resp.headers.get("X-RateLimit-Remaining", 5000))
                self._rate_limit_reset = int(resp.headers.get("X-RateLimit-Reset", 0))
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 403:
                print(f"Rate limit exceeded. Reset at {self._rate_limit_reset}")
            raise

    def get_issues(self, repo: str, state: str = "open", labels: list[str] = None,
                   per_page: int = 30, since: str = None) -> list[dict]:
        """Get issues from a repository."""
        url = f"{self.BASE_URL}/repos/{repo}/issues?state={state}&per_page={per_page}"
        if labels:
            url += f"&labels={','.join(labels)}"
        if since:
            url += f"&since={since}"

        return self._request(url)

    def get_issue(self, repo: str, issue_number: int) -> dict:
        """Get a single issue."""
        url = f"{self.BASE_URL}/repos/{repo}/issues/{issue_number}"
        return self._request(url)

    def get_repo_info(self, repo: str) -> dict:
        """Get repository information."""
        url = f"{self.BASE_URL}/repos/{repo}"
        return self._request(url)


# ---------------------------------------------------------------------------
# Issue to Bounty converter
# ---------------------------------------------------------------------------

class IssueToBountyConverter:
    """Converts GitHub issues to SolFoundry bounty specifications."""

    # Category mapping from GitHub labels to SolFoundry categories
    CATEGORY_MAP = {
        "bug": "bug-fix",
        "feature": "feature",
        "enhancement": "enhancement",
        "documentation": "docs",
        "performance": "performance",
        "security": "security",
        "testing": "testing",
        "refactor": "refactor",
        "ui": "frontend",
        "ux": "frontend",
        "frontend": "frontend",
        "backend": "backend",
        "api": "backend",
        "database": "backend",
        "devops": "devops",
        "ci": "devops",
        "ml": "ai",
        "ai": "ai",
        "machine-learning": "ai",
        "agent": "ai",
    }

    # Skill detection from labels and content
    SKILL_KEYWORDS = {
        "python": ["python", "py", "django", "flask", "fastapi"],
        "javascript": ["javascript", "js", "node", "react", "vue", "next"],
        "typescript": ["typescript", "ts"],
        "rust": ["rust", "cargo", "anchor"],
        "solidity": ["solidity", "ethereum", "evm", "smart-contract"],
        "solana": ["solana", "web3", "anchor", "spl"],
        "ai": ["ai", "ml", "llm", "gpt", "claude", "agent"],
        "database": ["database", "sql", "postgres", "redis"],
        "devops": ["docker", "k8s", "kubernetes", "ci", "cd"],
        "frontend": ["react", "vue", "css", "html", "ui"],
    }

    def estimate_tier(self, issue: GitHubIssue) -> int:
        """Estimate bounty tier based on issue characteristics."""
        score = 0

        # Label-based scoring
        labels_lower = [l.lower() for l in issue.labels]
        if "bug" in labels_lower:
            score += 1
        if "enhancement" in labels_lower or "feature" in labels_lower:
            score += 2
        if "security" in labels_lower:
            score += 3
        if "agent" in labels_lower or "ai" in labels_lower:
            score += 2

        # Body length (longer = more complex)
        if len(issue.body) > 1000:
            score += 2
        elif len(issue.body) > 500:
            score += 1

        # Comments (more discussion = more complex)
        if issue.comments > 10:
            score += 2
        elif issue.comments > 3:
            score += 1

        # Map score to tier
        if score >= 5:
            return 3
        elif score >= 3:
            return 2
        return 1

    def estimate_reward(self, tier: int) -> int:
        """Estimate reward amount based on tier."""
        rewards = {1: 100000, 2: 450000, 3: 800000}  # $FNDRY amounts
        return rewards.get(tier, 100000)

    def detect_category(self, issue: GitHubIssue) -> str:
        """Detect bounty category from issue labels and content."""
        labels_lower = [l.lower() for l in issue.labels]

        # Check labels first
        for label in labels_lower:
            if label in self.CATEGORY_MAP:
                return self.CATEGORY_MAP[label]

        # Check content
        content_lower = (issue.title + " " + issue.body).lower()
        for keyword, category in [
            ("frontend", "frontend"), ("backend", "backend"),
            ("api", "backend"), ("ui", "frontend"),
            ("ai", "ai"), ("ml", "ai"), ("agent", "ai"),
        ]:
            if keyword in content_lower:
                return category

        return "general"

    def detect_skills(self, issue: GitHubIssue) -> list[str]:
        """Detect required skills from issue content."""
        skills = set()
        content_lower = (issue.title + " " + issue.body).lower()
        labels_lower = [l.lower() for l in issue.labels]

        for skill, keywords in self.SKILL_KEYWORDS.items():
            for kw in keywords:
                if kw in content_lower or kw in labels_lower:
                    skills.add(skill)
                    break

        return list(skills)

    def enhance_description(self, issue: GitHubIssue) -> str:
        """Create enhanced bounty description from issue."""
        parts = [
            f"## Original Issue",
            f"**Repository:** {issue.repo}",
            f"**Issue:** #{issue.number}",
            f"**Author:** {issue.author}",
            f"**Created:** {issue.created_at}",
            f"**URL:** {issue.url}",
            "",
            "## Description",
            issue.body or "No description provided.",
            "",
            "## Requirements",
            "- [ ] Fork the repository",
            "- [ ] Create a feature branch",
            "- [ ] Implement the solution",
            "- [ ] Write tests if applicable",
            "- [ ] Submit a PR referencing this bounty",
            "",
            "## Submission",
            "Submit your PR to the original repository with:",
            "- `Closes #<issue_number>` in the PR description",
            "- Your Solana wallet address for payout",
        ]

        if issue.labels:
            parts.insert(4, f"**Labels:** {', '.join(issue.labels)}")

        return "\n".join(parts)

    def convert(self, issue: GitHubIssue) -> BountySpec:
        """Convert a GitHub issue to a bounty specification."""
        tier = self.estimate_tier(issue)
        return BountySpec(
            title=f"[GitHub] {issue.title}",
            description=self.enhance_description(issue),
            tier=tier,
            reward=self.estimate_reward(tier),
            category=self.detect_category(issue),
            skills=self.detect_skills(issue),
            github_issue_url=issue.url,
            created_by="github-scraper",
        )


# ---------------------------------------------------------------------------
# Webhook handler
# ---------------------------------------------------------------------------

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify GitHub webhook signature."""
    if not secret:
        return True  # Skip verification if no secret configured

    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def handle_webhook(payload: dict, secret: str, converter: IssueToBountyConverter,
                   output_dir: str) -> dict:
    """Handle incoming GitHub webhook."""
    action = payload.get("action")
    issue_data = payload.get("issue")
    repo_data = payload.get("repository")

    if not issue_data or not repo_data:
        return {"status": "ignored", "reason": "not an issue event"}

    # Only process opened/edited/reopened issues
    if action not in ("opened", "edited", "reopened"):
        return {"status": "ignored", "reason": f"action={action}"}

    repo = repo_data.get("full_name", "")
    issue = GitHubIssue(
        number=issue_data["number"],
        title=issue_data["title"],
        body=issue_data.get("body", ""),
        repo=repo,
        url=issue_data["html_url"],
        labels=[l["name"] for l in issue_data.get("labels", [])],
        author=issue_data["user"]["login"],
        created_at=issue_data["created_at"],
        updated_at=issue_data["updated_at"],
        comments=issue_data.get("comments", 0),
        assignees=[a["login"] for a in issue_data.get("assignees", [])],
    )

    # Convert to bounty
    bounty = converter.convert(issue)

    # Save to output directory
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    filename = f"{repo.replace('/', '_')}_issue_{issue.number}.yaml"
    filepath = output_path / filename
    filepath.write_text(bounty.to_yaml())

    return {
        "status": "created",
        "bounty": asdict(bounty),
        "file": str(filepath),
    }


# ---------------------------------------------------------------------------
# CLI commands
# ---------------------------------------------------------------------------

def cmd_scrape(args):
    """Scrape issues from configured repos."""
    config_path = args.config or os.environ.get("SCRAPER_CONFIG", "scraper-config.yaml")

    if not os.path.exists(config_path):
        print(f"Config file not found: {config_path}")
        print("Creating default config...")
        config = ScraperConfig(
            repos=["SolFoundry/solfoundry"],
            github_token=os.environ.get("GITHUB_TOKEN", ""),
        )
        config.to_yaml(config_path)
        print(f"Created {config_path} — edit it to add repos to monitor.")

    config = ScraperConfig.from_yaml(config_path)
    if args.repo:
        config.repos = [args.repo]

    token = args.token or config.github_token or os.environ.get("GITHUB_TOKEN", "")
    client = GitHubClient(token)
    converter = IssueToBountyConverter()

    output_dir = args.output or config.output_dir
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    total_issues = 0
    total_bounties = 0

    for repo in config.repos:
        print(f"\nScraping {repo}...")
        try:
            issues_data = client.get_issues(repo, per_page=config.max_issues_per_repo)
        except Exception as e:
            print(f"  Error fetching issues: {e}")
            continue

        print(f"  Found {len(issues_data)} open issues")

        for issue_data in issues_data:
            total_issues += 1

            # Filter by labels if configured
            issue_labels = [l["name"] for l in issue_data.get("labels", [])]
            if config.labels_filter:
                if not any(l.lower() in [f.lower() for f in config.labels_filter]
                          for l in issue_labels):
                    continue

            issue = GitHubIssue(
                number=issue_data["number"],
                title=issue_data["title"],
                body=issue_data.get("body", ""),
                repo=repo,
                url=issue_data["html_url"],
                labels=issue_labels,
                author=issue_data["user"]["login"],
                created_at=issue_data["created_at"],
                updated_at=issue_data["updated_at"],
                comments=issue_data.get("comments", 0),
            )

            bounty = converter.convert(issue)

            # Skip if below minimum tier
            if bounty.tier < config.min_reward_tier:
                continue

            filename = f"{repo.replace('/', '_')}_issue_{issue.number}.yaml"
            filepath = Path(output_dir) / filename
            filepath.write_text(bounty.to_yaml())

            total_bounties += 1
            print(f"  #{issue.number}: {issue.title[:50]}... → Tier {bounty.tier}")

    print(f"\nDone! Scraped {total_issues} issues, generated {total_bounties} bounty specs.")
    print(f"Output directory: {output_dir}")


def cmd_webhook(args):
    """Start webhook server for real-time updates."""
    try:
        from http.server import HTTPServer, BaseHTTPRequestHandler
    except ImportError:
        print("http.server not available")
        return 1

    config_path = args.config or os.environ.get("SCRAPER_CONFIG", "scraper-config.yaml")
    config = ScraperConfig.from_yaml(config_path) if os.path.exists(config_path) else ScraperConfig()

    secret = args.secret or config.webhook_secret or os.environ.get("WEBHOOK_SECRET", "")
    output_dir = args.output or config.output_dir
    converter = IssueToBountyConverter()

    class WebhookHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            content_length = int(self.headers.get("Content-Length", 0))
            payload = self.rfile.read(content_length)

            # Verify signature
            signature = self.headers.get("X-Hub-Signature-256", "")
            if not verify_webhook_signature(payload, signature, secret):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Invalid signature")
                return

            # Parse JSON
            try:
                data = json.loads(payload)
            except json.JSONDecodeError:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Invalid JSON")
                return

            # Handle webhook
            result = handle_webhook(data, secret, converter, output_dir)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())

        def log_message(self, format, *args):
            print(f"[{datetime.now().isoformat()}] {args[0]}")

    port = args.port or 8080
    server = HTTPServer(("0.0.0.0", port), WebhookHandler)
    print(f"Webhook server listening on port {port}")
    print(f"Configure GitHub webhook to: http://your-server:{port}/")
    print(f"Webhook secret: {'configured' if secret else 'not set'}")
    print("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()

    return 0


def cmd_generate(args):
    """Generate bounty YAML from issues."""
    token = args.token or os.environ.get("GITHUB_TOKEN", "")
    client = GitHubClient(token)
    converter = IssueToBountyConverter()

    if not args.repo:
        print("Error: --repo is required")
        return 1

    output_dir = args.output or "specs"
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    print(f"Fetching issues from {args.repo}...")
    try:
        issues_data = client.get_issues(args.repo, per_page=args.limit or 10)
    except Exception as e:
        print(f"Error: {e}")
        return 1

    print(f"Found {len(issues_data)} issues")

    for issue_data in issues_data:
        issue = GitHubIssue(
            number=issue_data["number"],
            title=issue_data["title"],
            body=issue_data.get("body", ""),
            repo=args.repo,
            url=issue_data["html_url"],
            labels=[l["name"] for l in issue_data.get("labels", [])],
            author=issue_data["user"]["login"],
            created_at=issue_data["created_at"],
            updated_at=issue_data["updated_at"],
            comments=issue_data.get("comments", 0),
        )

        bounty = converter.convert(issue)
        filename = f"{args.repo.replace('/', '_')}_issue_{issue.number}.yaml"
        filepath = Path(output_dir) / filename
        filepath.write_text(bounty.to_yaml())
        print(f"  #{issue.number}: {issue.title[:50]}... → {filepath.name}")

    print(f"\nGenerated {len(issues_data)} bounty specs in {output_dir}/")
    return 0


def cmd_list(args):
    """List configured repos."""
    config_path = args.config or os.environ.get("SCRAPER_CONFIG", "scraper-config.yaml")

    if not os.path.exists(config_path):
        print(f"No config file found at {config_path}")
        return 1

    config = ScraperConfig.from_yaml(config_path)
    print(f"Configured repositories ({len(config.repos)}):")
    for repo in config.repos:
        print(f"  - {repo}")

    print(f"\nLabels filter: {', '.join(config.labels_filter) or 'none'}")
    print(f"Min tier: {config.min_reward_tier}")
    print(f"Output dir: {config.output_dir}")

    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="GitHub Issue Scraper for SolFoundry Bounties",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--config", help="Config file path")
    parser.add_argument("--token", help="GitHub token (or set GITHUB_TOKEN)")

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # scrape command
    scrape_parser = subparsers.add_parser("scrape", help="Scrape issues from repos")
    scrape_parser.add_argument("--repo", help="Specific repo to scrape (owner/repo)")
    scrape_parser.add_argument("--output", help="Output directory for bounty specs")

    # webhook command
    webhook_parser = subparsers.add_parser("webhook", help="Start webhook server")
    webhook_parser.add_argument("--port", type=int, help="Server port (default: 8080)")
    webhook_parser.add_argument("--secret", help="Webhook secret")
    webhook_parser.add_argument("--output", help="Output directory for bounty specs")

    # generate command
    generate_parser = subparsers.add_parser("generate", help="Generate bounty YAML")
    generate_parser.add_argument("--repo", required=True, help="Repository (owner/repo)")
    generate_parser.add_argument("--output", help="Output directory")
    generate_parser.add_argument("--limit", type=int, help="Max issues to process")

    # list command
    list_parser = subparsers.add_parser("list", help="List configured repos")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    commands = {
        "scrape": cmd_scrape,
        "webhook": cmd_webhook,
        "generate": cmd_generate,
        "list": cmd_list,
    }

    return commands[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
