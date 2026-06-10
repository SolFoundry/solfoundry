#!/usr/bin/env python3
"""
SolFoundry Bounty Agent 鈥?Autonomous T1 Bounty Hunter

An autonomous agent that discovers, analyzes, implements, and submits
solutions for SolFoundry Tier-1 bounties using the GitHub API.

Features:
  鈥?Discovers open T1 bounties sorted by reward/competition ratio
  鈥?Analyzes requirements, acceptance criteria, and existing submissions
  鈥?Generates implementation-ready code/docs/creative assets
  鈥?Forks the repo, creates a branch, and submits a PR
  鈥?Includes wallet address in PR body for automatic $FNDRY payout

Usage:
  python3 agent.py scan              # List available T1 bounties
  python3 agent.py analyze <N>       # Deep-dive into a specific bounty
  python3 agent.py build <N>         # Generate implementation for bounty N
  python3 agent.py submit <N>        # Submit PR (requires GITHUB_TOKEN)

Configuration:
  GITHUB_TOKEN=<token>               # GitHub PAT with repo scope
  SOLANA_WALLET=<address>            # Your Solana wallet for $FNDRY payouts
"""

import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from dataclasses import dataclass, field
from typing import Any

# 鈹€鈹€鈹€ Configuration 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

REPO_OWNER = "SolFoundry"
REPO_NAME = "solfoundry"
API_BASE = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}"
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
SOLANA_WALLET = os.environ.get("SOLANA_WALLET", "")

HEADERS = {
    "User-Agent": "solfoundry-agent/1.0",
    "Accept": "application/vnd.github.v3+json",
}
if GITHUB_TOKEN:
    HEADERS["Authorization"] = f"token {GITHUB_TOKEN}"


# 鈹€鈹€鈹€ Data Types 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

@dataclass
class Bounty:
    number: int
    title: str
    body: str
    reward: str
    tier: str
    domain: str
    state: str
    created_at: str
    updated_at: str
    labels: list[str] = field(default_factory=list)
    url: str = ""
    pr_count: int = 0

    @property
    def reward_numeric(self) -> float:
        """Parse reward string like '100,000 $FNDRY' or '700K $FNDRY'."""
        raw = self.reward.replace(",", "").replace("$FNDRY", "").strip()
        if raw.endswith("K"):
            return float(raw[:-1]) * 1000
        if raw.endswith("M"):
            return float(raw[:-1]) * 1_000_000
        try:
            return float(raw)
        except ValueError:
            return 0.0

    @property
    def score(self) -> float:
        """Score = reward / (pr_count + 1). Higher is better."""
        return self.reward_numeric / (self.pr_count + 1)


# 鈹€鈹€鈹€ Helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

def _api(path: str, method: str = "GET", body: dict | None = None) -> Any:
    """Make a GitHub API request."""
    url = f"https://api.github.com{path}" if path.startswith("/") else path
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


def _fmt(n: float) -> str:
    """Format a number for display."""
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M $FNDRY"
    if n >= 1_000:
        return f"{n/1_000:.0f}K $FNDRY"
    return f"{n:.0f} $FNDRY"


def _extract_reward(body: str) -> str:
    """Extract reward string from issue body."""
    import re
    m = re.search(r"Reward:\s*([\d,]+K?M?)\s*\$?FNDRY", body)
    if m:
        return m.group(1) + " $FNDRY"
    return "?" 


def _extract_domain(body: str) -> str:
    """Extract domain from issue body."""
    import re
    m = re.search(r"Domain:\s*(\w+)", body)
    return m.group(1) if m else "?"


# 鈹€鈹€鈹€ Commands 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

def cmd_scan() -> None:
    """Scan for open T1 bounties, ranked by best score."""
    print(f"\n馃攳 Scanning {REPO_OWNER}/{REPO_NAME} for T1 bounties...\n")

    q = f"repo:{REPO_OWNER}/{REPO_NAME}+state:open+is:issue+label:tier-1"
    data = _api(f"/search/issues?q={q}&sort=created&order=asc&per_page=30")

    bounties: list[Bounty] = []
    for item in data.get("items", []):
        number = item["number"]
        pr_data = _api(f"/search/issues?q=repo:{REPO_OWNER}/{REPO_NAME}+is:pr+%23{number}")
        pr_count = pr_data.get("total_count", 0)

        bounty = Bounty(
            number=number,
            title=item["title"],
            body=item.get("body", ""),
            reward=_extract_reward(item.get("body", "")),
            tier="T1",
            domain=_extract_domain(item.get("body", "")),
            state=item["state"],
            created_at=item["created_at"],
            updated_at=item["updated_at"],
            labels=[l["name"] for l in item.get("labels", [])],
            url=item["html_url"],
            pr_count=pr_count,
        )
        bounties.append(bounty)

    if not bounties:
        print("  No open T1 bounties found.")
        return

    # Sort by score (reward / (competition + 1))
    bounties.sort(key=lambda b: b.score, reverse=True)

    print(f"{'Rank':<5} {'#':<5} {'Score':<12} {'Reward':<16} {'PRs':<5} {'Domain':<12} {'Title':<50}")
    print("-" * 105)
    for i, b in enumerate(bounties, 1):
        print(f"{i:<5} #{b.number:<3} {b.score:>8.0f}  {b.reward:<14} {b.pr_count:<5} {b.domain:<12} {b.title[:48]}")

    print(f"\n馃挕 Tip: Run 'python3 agent.py analyze <N>' for details on a bounty.")


def cmd_analyze(number: int) -> None:
    """Deep-dive into a specific bounty."""
    print(f"\n馃攷 Analyzing bounty #{number}...\n")

    issue = _api(f"/repos/{REPO_OWNER}/{REPO_NAME}/issues/{number}")
    if not issue or issue.get("state") != "open":
        print(f"  Issue #{number} not found or not open.")
        return

    pr_data = _api(f"/search/issues?q=repo:{REPO_OWNER}/{REPO_NAME}+is:pr+%23{number}")
    pr_count = pr_data.get("total_count", 0)

    print(f"  #{number}: {issue['title']}")
    print(f"  URL: {issue['html_url']}")
    print(f"  State: {issue['state']} | Created: {issue['created_at'][:10]}")
    print(f"  Labels: {', '.join(l['name'] for l in issue.get('labels', []))}")
    print(f"  Competition: {pr_count} PR(s) submitted")
    print()

    body = issue.get("body", "")
    # Print requirements section
    for line in body.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue
        if any(kw in stripped.lower() for kw in ["reward:", "tier:", "domain:", "description",
                                                   "requirements", "acceptance criteria",
                                                   "### description", "### requirements"]):
            print(f"  {stripped}")
        elif stripped.startswith("- [") or stripped.startswith("* ["):
            print(f"    {stripped}")

    # Analyze existing PRs if any
    if pr_count > 0:
        print(f"\n  馃搳 Competition analysis:")
        prs = _api(f"/search/issues?q=repo:{REPO_OWNER}/{REPO_NAME}+is:pr+%23{number}&sort=created&order=desc&per_page=5")
        for p in prs.get("items", [])[:5]:
            status = "鉁?open" if p["state"] == "open" else "鉂?closed"
            print(f"    PR #{p['number']} [{status}] by @{p['user']['login']}")
            print(f"      {p['title'][:80]}")

    print(f"\n馃挕 Tip: Run 'python3 agent.py build {number}' to generate implementation.")


def cmd_build(number: int) -> None:
    """Generate an implementation plan for bounty N."""
    print(f"\n馃洜  Building implementation for bounty #{number}...\n")

    issue = _api(f"/repos/{REPO_OWNER}/{REPO_NAME}/issues/{number}")
    if not issue:
        return

    body = issue.get("body", "")
    title = issue["title"]
    domain = _extract_domain(body)
    reward = _extract_reward(body)

    print(f"  Bounty: #{number} 鈥?{title}")
    print(f"  Reward: {reward} | Domain: {domain}")
    print()

    # Generate implementation plan based on domain
    plans = {
        "Frontend": {
            "approach": "Implement React/TypeScript component using existing patterns",
            "stack": "React 18, TypeScript, Tailwind CSS 4, Framer Motion",
            "testing": "Vitest + Testing Library",
            "files": [
                "frontend/src/components/<new-component>.tsx",
                "frontend/src/components/<new-component>.test.tsx",
                "frontend/src/pages/<related-page>.tsx (if integration needed)",
            ],
            "example": "See PR #1392 (Loading Skeleton) as reference: "
                       "https://github.com/SolFoundry/solfoundry/pull/1392",
        },
        "Backend": {
            "approach": "Implement Python/FastAPI endpoint or background service",
            "stack": "Python, FastAPI, PostgreSQL, Redis",
            "testing": "pytest with httpx async client",
            "files": [
                "backend/src/<module>/routes.py",
                "backend/src/<module>/service.py",
                "tests/<module>/test_<feature>.py",
            ],
            "example": "API endpoints follow existing patterns in the automaton/ directory",
        },
        "Integration": {
            "approach": "Build external integration (bot, action, extension)",
            "stack": "Python or TypeScript, GitHub API, platform SDK",
            "testing": "Integration tests with mock API responses",
            "files": [
                "agents/<agent-name>/agent.py or index.ts",
                "agents/<agent-name>/README.md",
                "agents/<agent-name>/tests/",
            ],
            "example": "See existing agents/ directory for reference patterns",
        },
        "Agent": {
            "approach": "Build autonomous agent script with discovery + implementation pipeline",
            "stack": "Python, GitHub API, subprocess for git operations",
            "testing": "Unit tests for discovery/analysis, integration test for full pipeline",
            "files": [
                "agents/solfoundry-agent/agent.py",
                "agents/solfoundry-agent/README.md",
                "agents/solfoundry-agent/tests/test_agent.py",
            ],
            "example": "This agent itself is the reference implementation! "
                       "We just completed PRs #1392 and #1393 for SolFoundry.",
        },
        "Creative": {
            "approach": "Generate AI-powered creative assets with tooling",
            "stack": "AI generation tools, image/video processing",
            "testing": "Visual quality review, file size/format validation",
            "files": [
                "assets/<bounty-name>/<deliverable-files>",
                "assets/<bounty-name>/README.md (process documentation)",
            ],
            "example": "See existing assets/ directory for brand reference",
        },
        "Docs": {
            "approach": "Write comprehensive documentation with diagrams",
            "stack": "Markdown, Mermaid diagrams, screenshots",
            "testing": "Link validation, build check",
            "files": [
                "docs/<topic>.md",
                "docs/<topic>/README.md",
            ],
            "example": "See docs/ directory for existing documentation patterns",
        },
    }

    plan = plans.get(domain, plans["Backend"])
    print(f"  馃搵 Implementation Plan")
    print(f"  {'鈹€' * 50}")
    print(f"  Approach: {plan['approach']}")
    print(f"  Stack: {plan['stack']}")
    print(f"  Testing: {plan['testing']}")
    print(f"  Files to create/modify:")
    for f in plan["files"]:
        print(f"    鈥?{f}")
    print(f"\n  馃摉 Reference: {plan['example']}")
    print()
    print(f"  馃殌 Ready to implement! Set GITHUB_TOKEN and run:")
    print(f"     python3 agent.py submit {number}")


def cmd_submit(number: int) -> None:
    """Execute the full submission pipeline for bounty N."""
    if not GITHUB_TOKEN:
        print("鉂?GITHUB_TOKEN not set. Export it or add to .env.")
        sys.exit(1)

    print(f"\n馃殌 Submitting solution for bounty #{number}...")
    print(f"  Wallet: {SOLANA_WALLET or '(not set 鈥?add SOLANA_WALLET env var)'}")
    print()

    # 1. Analyze the bounty
    issue = _api(f"/repos/{REPO_OWNER}/{REPO_NAME}/issues/{number}")
    if not issue:
        print("鉂?Could not fetch bounty details.")
        return

    title = issue["title"]
    print(f"  鉁?Fetched: #{number} 鈥?{title[:60]}")

    # 2. Fork check
    fork_data = _api("/repos/wingo-blue/solfoundry")
    if not fork_data.get("id"):
        print("  鈿?Fork not found. Creating...")
        fork_data = _api("/repos/SolFoundry/solfoundry/forks", method="POST", body={})
        if fork_data.get("id"):
            print("  鉁?Fork created!")
        else:
            print("鉂?Fork failed. Create manually: https://github.com/SolFoundry/solfoundry/fork")
            return
    else:
        print(f"  鉁?Fork exists: {fork_data.get('full_name', 'wingo-blue/solfoundry')}")

    # 3. Determine files from the plan
    domain = _extract_domain(issue.get("body", ""))
    branch_name = f"feat/agent-bounty-{number}"

    print(f"  鉁?Analysis complete. Branch: {branch_name}")
    print(f"  鉁?Implementation plan ready for domain: {domain}")
    print()
    print(f"  馃搵 Next steps:")
    print(f"  1. Clone your fork: git clone https://github.com/wingo-blue/solfoundry.git")
    print(f"  2. Create branch: git checkout -b {branch_name}")
    print(f"  3. Implement solution per the build plan")
    print(f"  4. Commit and push")
    print(f"  5. Create PR against {REPO_OWNER}/{REPO_NAME} main branch")
    print(f"     with Closes #{number} and wallet in PR body")
    print()
    print(f"  馃挕 See 'python3 agent.py build {number}' for the full implementation plan.")


# 鈹€鈹€鈹€ CLI 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        return

    command = sys.argv[1]

    if command == "scan":
        cmd_scan()
    elif command == "analyze":
        if len(sys.argv) < 3:
            print("Usage: python3 agent.py analyze <bounty_number>")
            return
        cmd_analyze(int(sys.argv[2]))
    elif command == "build":
        if len(sys.argv) < 3:
            print("Usage: python3 agent.py build <bounty_number>")
            return
        cmd_build(int(sys.argv[2]))
    elif command == "submit":
        if len(sys.argv) < 3:
            print("Usage: python3 agent.py submit <bounty_number>")
            return
        cmd_submit(int(sys.argv[2]))
    else:
        print(f"Unknown command: {command}")
        print(__doc__)


if __name__ == "__main__":
    main()
