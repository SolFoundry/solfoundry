"""GitHub Issues → Bounty Board sync service.

Fetches bounty-labeled issues from the SolFoundry repo and populates
the in-memory bounty store. Also syncs merged PRs to build the
contributor leaderboard from real data.

Runs on startup and every 5 minutes via BackgroundTasks.
"""

import asyncio
import logging
import os
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

from app.models.bounty import BountyDB, BountyStatus, BountyTier
from app.services.bounty_service import _bounty_store

logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
REPO = os.getenv("GITHUB_REPO", "SolFoundry/solfoundry")
API_BASE = "https://api.github.com"

# Sync interval in seconds
SYNC_INTERVAL = 300  # 5 minutes

# Track sync state
_last_sync: Optional[datetime] = None
_sync_lock = asyncio.Lock()


def _headers() -> dict:
    """Build GitHub API request headers."""
    h = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return h


def _parse_reward_from_title(title: str) -> float:
    """Extract reward amount from issue title like '— 500,000 $FNDRY'."""
    m = re.search(r"([\d,]+)\s*\$FNDRY", title)
    if m:
        return float(m.group(1).replace(",", ""))
    return 0


def _parse_tier_from_labels(labels: list[dict]) -> BountyTier:
    """Extract tier from GitHub labels."""
    for label in labels:
        name = label.get("name", "")
        if name == "tier-3":
            return BountyTier.T3
        elif name == "tier-2":
            return BountyTier.T2
        elif name == "tier-1":
            return BountyTier.T1
    return BountyTier.T1  # default


def _parse_skills_from_labels(labels: list[dict]) -> list[str]:
    """Extract skill tags from GitHub labels (exclude meta labels)."""
    meta_labels = {
        "bounty", "tier-1", "tier-2", "tier-3",
        "good first issue", "help wanted", "bug", "enhancement",
        "duplicate", "invalid", "wontfix", "question",
    }
    # Map label names to display-friendly versions
    display_map = {
        "python": "Python", "typescript": "TypeScript", "react": "React",
        "fastapi": "FastAPI", "solana": "Solana", "rust": "Rust",
        "anchor": "Anchor", "postgresql": "PostgreSQL", "redis": "Redis",
        "websocket": "WebSocket", "devops": "DevOps", "docker": "Docker",
        "frontend": "Frontend", "backend": "Backend", "node.js": "Node.js",
    }
    skills = []
    for label in labels:
        name = label.get("name", "")
        if name.lower() not in meta_labels:
            display = display_map.get(name.lower(), name.capitalize())
            skills.append(display)
    return skills


def _parse_status_from_issue(issue: dict) -> BountyStatus:
    """Determine bounty status from issue state and labels."""
    if issue.get("state") == "closed":
        return BountyStatus.COMPLETED

    # Check for assignee (in-progress)
    if issue.get("assignee") or issue.get("assignees"):
        return BountyStatus.IN_PROGRESS

    # Check labels for status hints
    for label in issue.get("labels", []):
        name = label.get("name", "").lower()
        if name in ("in-progress", "in_progress", "claimed"):
            return BountyStatus.IN_PROGRESS

    return BountyStatus.OPEN


def _clean_description(body: str) -> str:
    """Clean up issue body for display as bounty description."""
    if not body:
        return ""
    # Remove HTML comments
    body = re.sub(r"<!--.*?-->", "", body, flags=re.DOTALL)
    # Collapse excessive newlines
    body = re.sub(r"\n{3,}", "\n\n", body)
    return body.strip()[:2000]  # Cap at 2000 chars


def _issue_to_bounty(issue: dict) -> BountyDB:
    """Convert a GitHub issue dict to a BountyDB record."""
    title = issue.get("title", "")
    body = issue.get("body", "") or ""
    labels = issue.get("labels", [])
    number = issue.get("number", 0)
    created_at_str = issue.get("created_at", "")
    updated_at_str = issue.get("updated_at", "")

    # Parse created_at
    try:
        created_at = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        created_at = datetime.now(timezone.utc)

    try:
        updated_at = datetime.fromisoformat(updated_at_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        updated_at = created_at

    # Clean title — remove emoji prefix like "🏭 Bounty: "
    clean_title = re.sub(r"^[🏭🔧⚡🎨🛡️🚀💰]*\s*Bounty:\s*", "", title).strip()
    # Also remove trailing reward "— 500,000 $FNDRY"
    clean_title = re.sub(r"\s*—\s*[\d,]+\s*\$FNDRY\s*$", "", clean_title).strip()
    if not clean_title:
        clean_title = title

    reward = _parse_reward_from_title(title)
    tier = _parse_tier_from_labels(labels)
    skills = _parse_skills_from_labels(labels)
    status = _parse_status_from_issue(issue)

    # Use issue number as stable ID so we don't create duplicates
    bounty_id = f"gh-{number}"

    # Build GitHub issue URL
    github_url = f"https://github.com/{REPO}/issues/{number}"

    # Determine deadline (default 14 days from creation for open bounties)
    deadline = created_at + timedelta(days=14) if status == BountyStatus.OPEN else None

    return BountyDB(
        id=bounty_id,
        title=clean_title,
        description=_clean_description(body),
        tier=tier,
        reward_amount=reward,
        status=status,
        github_issue_url=github_url,
        required_skills=skills,
        deadline=deadline,
        created_by="SolFoundry",
        created_at=created_at,
        updated_at=updated_at,
    )


async def fetch_bounty_issues() -> list[dict]:
    """Fetch all bounty-labeled issues from GitHub (paginated)."""
    all_issues = []
    page = 1
    per_page = 100

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            url = f"{API_BASE}/repos/{REPO}/issues"
            params = {
                "labels": "bounty",
                "state": "all",
                "per_page": per_page,
                "page": page,
                "sort": "created",
                "direction": "desc",
            }
            resp = await client.get(url, headers=_headers(), params=params)

            if resp.status_code != 200:
                logger.error(
                    "GitHub API error fetching issues (page %d): %d %s",
                    page, resp.status_code, resp.text[:200],
                )
                break

            issues = resp.json()
            if not issues:
                break

            # Filter out pull requests (GitHub API returns PRs in issues endpoint)
            real_issues = [i for i in issues if "pull_request" not in i]
            all_issues.extend(real_issues)

            if len(issues) < per_page:
                break
            page += 1

    return all_issues


async def fetch_merged_prs() -> list[dict]:
    """Fetch merged PRs to build contributor stats."""
    all_prs = []
    page = 1
    per_page = 100

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            url = f"{API_BASE}/repos/{REPO}/pulls"
            params = {
                "state": "closed",
                "per_page": per_page,
                "page": page,
                "sort": "updated",
                "direction": "desc",
            }
            resp = await client.get(url, headers=_headers(), params=params)

            if resp.status_code != 200:
                logger.error(
                    "GitHub API error fetching PRs (page %d): %d %s",
                    page, resp.status_code, resp.text[:200],
                )
                break

            prs = resp.json()
            if not prs:
                break

            # Only keep merged PRs
            merged = [pr for pr in prs if pr.get("merged_at")]
            all_prs.extend(merged)

            if len(prs) < per_page:
                break
            page += 1

    return all_prs


def _extract_bounty_number_from_pr(pr: dict) -> Optional[int]:
    """Extract linked issue number from PR body (Closes #N)."""
    body = pr.get("body") or ""
    patterns = [
        r"(?i)(?:closes|fixes|resolves|implements)\s*#(\d+)",
        r"(?i)(?:closes|fixes|resolves|implements)\s+https://github\.com/[^/]+/[^/]+/issues/(\d+)",
    ]
    for pattern in patterns:
        m = re.search(pattern, body)
        if m:
            return int(m.group(1))
    return None


async def sync_bounties() -> int:
    """Sync GitHub Issues → in-memory bounty store. Returns count of bounties synced."""
    global _last_sync

    async with _sync_lock:
        logger.info("Starting GitHub → Bounty sync...")

        try:
            issues = await fetch_bounty_issues()
        except Exception as e:
            logger.error("Failed to fetch bounty issues: %s", e)
            return 0

        if not issues:
            logger.warning("No bounty issues found on GitHub")
            return 0

        # Convert issues to bounties
        new_store: dict[str, BountyDB] = {}
        for issue in issues:
            try:
                bounty = _issue_to_bounty(issue)
                new_store[bounty.id] = bounty
            except Exception as e:
                logger.error(
                    "Failed to convert issue #%d: %s",
                    issue.get("number", 0), e,
                )

        # Atomic swap — replace entire store
        _bounty_store.clear()
        _bounty_store.update(new_store)

        _last_sync = datetime.now(timezone.utc)
        logger.info("Synced %d bounties from GitHub Issues", len(new_store))
        return len(new_store)




# ── Known Phase 1 payout data (on-chain payouts, not tracked via labels) ──
# Maps GitHub username → {bounties_completed, total_fndry, skills}
KNOWN_PAYOUTS: dict[str, dict] = {
    "HuiNeng6": {
        "bounties_completed": 12,
        "total_fndry": 1_800_000,
        "skills": ["Python", "FastAPI", "React", "TypeScript", "WebSocket", "Redis", "PostgreSQL"],
        "bio": "Full-stack developer. Python, React, FastAPI, WebSocket, Redis.",
    },
    "ItachiDevv": {
        "bounties_completed": 8,
        "total_fndry": 1_750_000,
        "skills": ["React", "TypeScript", "Tailwind", "Solana", "Frontend"],
        "bio": "Frontend specialist. React, TypeScript, Tailwind, Solana wallet integration.",
    },
    "LaphoqueRC": {
        "bounties_completed": 1,
        "total_fndry": 150_000,
        "skills": ["Frontend", "React", "TypeScript"],
        "bio": "Frontend contributor. Landing page & animations.",
    },
    "zhaog100": {
        "bounties_completed": 1,
        "total_fndry": 150_000,
        "skills": ["Backend", "Python", "FastAPI"],
        "bio": "Backend contributor. API development.",
    },
}


async def sync_contributors() -> int:
    """Sync merged PRs + known payouts → contributor store for leaderboard."""
    from app.models.contributor import ContributorDB as ContribDB
    from app.services.contributor_service import _store
    import uuid

    logger.info("Starting contributor sync...")

    try:
        prs = await fetch_merged_prs()
    except Exception as e:
        logger.error("Failed to fetch merged PRs: %s", e)
        prs = []

    # Aggregate PR counts per author
    author_pr_counts: dict[str, dict] = {}
    for pr in prs:
        author = pr.get("user", {}).get("login", "unknown")
        avatar = pr.get("user", {}).get("avatar_url", "")
        if author.endswith("[bot]") or author in ("dependabot", "github-actions"):
            continue
        if author not in author_pr_counts:
            author_pr_counts[author] = {"avatar_url": avatar, "prs": 0}
        author_pr_counts[author]["prs"] += 1

    # Also check Phase 2 bounty completions (closed issues with merged PRs)
    phase2_earnings: dict[str, float] = {}
    for pr in prs:
        author = pr.get("user", {}).get("login", "unknown")
        linked_issue = _extract_bounty_number_from_pr(pr)
        if linked_issue:
            bounty_id = f"gh-{linked_issue}"
            bounty = _bounty_store.get(bounty_id)
            if bounty and bounty.status == BountyStatus.COMPLETED:
                phase2_earnings[author] = phase2_earnings.get(author, 0) + bounty.reward_amount

    # Build contributor store — merge known payouts with live PR data
    new_store: dict[str, ContribDB] = {}
    now = datetime.now(timezone.utc)

    # All known contributors (from payouts + anyone with merged PRs)
    all_authors = set(KNOWN_PAYOUTS.keys()) | set(author_pr_counts.keys())

    for author in all_authors:
        known = KNOWN_PAYOUTS.get(author, {})
        pr_data = author_pr_counts.get(author, {"avatar_url": "", "prs": 0})

        total_prs = pr_data["prs"]
        bounties = known.get("bounties_completed", total_prs)  # fallback to PR count
        earnings = known.get("total_fndry", 0) + phase2_earnings.get(author, 0)
        skills = known.get("skills", [])
        bio = known.get("bio", f"SolFoundry contributor — {total_prs} merged PRs")
        avatar = pr_data.get("avatar_url") or f"https://avatars.githubusercontent.com/{author}"

        # Compute badges
        badges = []
        if bounties >= 1:
            badges.append("tier-1")
        if bounties >= 4:
            badges.append("tier-2")
        if bounties >= 10:
            badges.append("tier-3")
        if bounties >= 6:
            badges.append(f"{bounties}x-contributor")
        if total_prs >= 5:
            badges.append("phase-1-og")

        # Reputation score
        rep = 0
        rep += min(total_prs * 5, 40)
        rep += min(bounties * 5, 40)
        rep += min(len(skills) * 3, 20)
        rep = min(rep, 100)

        contrib = ContribDB(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, f"solfoundry-{author}"),
            username=author,
            display_name=author,
            avatar_url=avatar,
            bio=bio,
            skills=skills[:10],
            badges=badges,
            total_contributions=total_prs,
            total_bounties_completed=bounties,
            total_earnings=earnings,
            reputation_score=rep,
            created_at=now - timedelta(days=45),
            updated_at=now,
        )
        new_store[str(contrib.id)] = contrib

    # Core team member (doesn't earn bounties)
    core_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, "solfoundry-mtarcure"))
    if core_id in new_store:
        # Update existing entry with core team info
        existing = new_store[core_id]
        existing.display_name = "SolFoundry Core"
        existing.badges = ["core-team", "tier-3", "architect"]
        existing.reputation_score = 100
        existing.total_earnings = 0  # Core team doesn't earn bounties
    else:
        core = ContribDB(
            id=uuid.uuid5(uuid.NAMESPACE_DNS, "solfoundry-mtarcure"),
            username="mtarcure",
            display_name="SolFoundry Core",
            avatar_url="https://avatars.githubusercontent.com/u/mtarcure",
            bio="SolFoundry core team. Architecture, security, DevOps.",
            skills=["Python", "Solana", "Security", "DevOps", "Rust", "Anchor"],
            badges=["core-team", "tier-3", "architect"],
            total_contributions=50,
            total_bounties_completed=15,
            total_earnings=0,
            reputation_score=100,
            created_at=now - timedelta(days=60),
            updated_at=now,
        )
        new_store[str(core.id)] = core

    # Atomic swap
    _store.clear()
    _store.update(new_store)

    logger.info("Synced %d contributors", len(new_store))
    return len(new_store)


def _compute_badges(stats: dict) -> list[str]:
    """Compute contributor badges from stats."""
    badges = []
    bounties = stats["bounty_prs"]

    if bounties >= 1:
        badges.append("tier-1")
    if bounties >= 4:
        badges.append("tier-2")
    if bounties >= 10:
        badges.append("tier-3")
    if bounties >= 6:
        badges.append(f"{bounties}x-contributor")
    if stats["total_prs"] >= 5:
        badges.append("phase-1-og")

    return badges


def _compute_reputation(stats: dict) -> int:
    """Compute reputation score (0-100) from contribution stats."""
    score = 0
    score += min(stats["total_prs"] * 5, 40)       # Up to 40 pts for PRs
    score += min(stats["bounty_prs"] * 10, 40)      # Up to 40 pts for bounties
    score += min(len(stats["skills"]) * 2, 20)      # Up to 20 pts for skill breadth
    return min(score, 100)


async def sync_all() -> dict:
    """Run full sync — bounties + contributors."""
    bounty_count = await sync_bounties()
    contributor_count = await sync_contributors()
    return {
        "bounties": bounty_count,
        "contributors": contributor_count,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }


async def periodic_sync():
    """Background task that syncs every SYNC_INTERVAL seconds."""
    while True:
        try:
            await sync_all()
        except Exception as e:
            logger.error("Periodic sync failed: %s", e)
        await asyncio.sleep(SYNC_INTERVAL)


def get_last_sync() -> Optional[datetime]:
    """Return the timestamp of the last successful sync."""
    return _last_sync
