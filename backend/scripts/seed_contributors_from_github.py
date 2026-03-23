"""Seed contributors from GitHub PR history.

Standalone script that fetches merged pull requests from the SolFoundry
repository and populates the ``contributors`` table in PostgreSQL.

Usage:
    export DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost/solfoundry"
    export GITHUB_TOKEN="ghp_..."
    python -m scripts.seed_contributors_from_github

Environment variables:
    DATABASE_URL: PostgreSQL connection string (required).
    GITHUB_TOKEN: GitHub personal access token for API rate limits.
    GITHUB_REPO: Repository slug (default: SolFoundry/solfoundry).
"""

import asyncio
import logging
import os
import re
import sys
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional

import httpx

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s %(message)s",
)
logger = logging.getLogger(__name__)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
REPO = os.getenv("GITHUB_REPO", "SolFoundry/solfoundry")
API_BASE = "https://api.github.com"

# Known Phase 1 payout data (on-chain payouts not tracked via labels)
KNOWN_PAYOUTS: dict[str, dict] = {
    "HuiNeng6": {
        "bounties_completed": 12,
        "total_fndry": 1_800_000,
        "skills": [
            "Python",
            "FastAPI",
            "React",
            "TypeScript",
            "WebSocket",
            "Redis",
            "PostgreSQL",
        ],
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


def _headers() -> dict:
    """Build GitHub API request headers.

    Returns:
        Dictionary of HTTP headers for GitHub API requests.
    """
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return headers


async def fetch_merged_pull_requests() -> list[dict]:
    """Fetch all merged pull requests from the repository.

    Paginates through the GitHub API to collect every merged PR.

    Returns:
        A list of merged PR dicts from the GitHub API.
    """
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
            response = await client.get(url, headers=_headers(), params=params)

            if response.status_code != 200:
                logger.error(
                    "GitHub API error (page %d): %d %s",
                    page,
                    response.status_code,
                    response.text[:200],
                )
                break

            prs = response.json()
            if not prs:
                break

            merged = [pr for pr in prs if pr.get("merged_at")]
            all_prs.extend(merged)
            logger.info(
                "Fetched page %d: %d PRs (%d merged)",
                page,
                len(prs),
                len(merged),
            )

            if len(prs) < per_page:
                break
            page += 1

    logger.info("Total merged PRs fetched: %d", len(all_prs))
    return all_prs


def _extract_bounty_issue_number(pr_body: str) -> Optional[int]:
    """Extract linked issue number from PR body.

    Args:
        pr_body: The PR body markdown text.

    Returns:
        The issue number or ``None`` if not found.
    """
    if not pr_body:
        return None
    patterns = [
        r"(?i)(?:closes|fixes|resolves|implements)\s*#(\d+)",
        r"(?i)(?:closes|fixes|resolves|implements)\s+https://github\.com/[^/]+/[^/]+/issues/(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, pr_body)
        if match:
            return int(match.group(1))
    return None


def _compute_badges(bounties: int, total_prs: int) -> list[str]:
    """Compute contributor badges from stats.

    Args:
        bounties: Number of completed bounties.
        total_prs: Total merged PRs.

    Returns:
        List of badge strings.
    """
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
    return badges


def _compute_reputation(total_prs: int, bounties: int, skill_count: int) -> int:
    """Compute reputation score (0-100).

    Args:
        total_prs: Total merged PRs.
        bounties: Number of completed bounties.
        skill_count: Number of distinct skills.

    Returns:
        An integer reputation score capped at 100.
    """
    score = 0
    score += min(total_prs * 5, 40)
    score += min(bounties * 5, 40)
    score += min(skill_count * 3, 20)
    return min(score, 100)


async def seed_from_github() -> int:
    """Fetch PRs and seed the contributors table.

    Aggregates per-author stats from merged PRs, merges with known
    Phase 1 payout data, and upserts into the database.

    Returns:
        The number of contributors seeded.
    """
    from app.database import init_db
    from app.services import contributor_service

    # Initialize database schema
    await init_db()

    # Fetch merged PRs
    prs = await fetch_merged_pull_requests()

    # Aggregate per-author stats
    author_stats: dict[str, dict] = {}
    for pr in prs:
        author = pr.get("user", {}).get("login", "unknown")
        avatar = pr.get("user", {}).get("avatar_url", "")

        if author.endswith("[bot]") or author in ("dependabot", "github-actions"):
            continue

        if author not in author_stats:
            author_stats[author] = {
                "avatar_url": avatar,
                "total_prs": 0,
                "bounty_prs": 0,
            }

        author_stats[author]["total_prs"] += 1

        # Check if PR is linked to a bounty issue
        issue_number = _extract_bounty_issue_number(pr.get("body", ""))
        if issue_number is not None:
            author_stats[author]["bounty_prs"] += 1

    # Merge with known payouts and upsert
    now = datetime.now(timezone.utc)
    all_authors = set(KNOWN_PAYOUTS.keys()) | set(author_stats.keys())
    seeded_count = 0

    for author in sorted(all_authors):
        known = KNOWN_PAYOUTS.get(author, {})
        stats = author_stats.get(author, {"avatar_url": "", "total_prs": 0})

        total_prs = stats["total_prs"]
        bounties = known.get("bounties_completed", total_prs)
        earnings = known.get("total_fndry", 0)
        skills = known.get("skills", [])
        bio = known.get("bio", f"SolFoundry contributor -- {total_prs} merged PRs")
        avatar = (
            stats.get("avatar_url") or f"https://avatars.githubusercontent.com/{author}"
        )
        badges = _compute_badges(bounties, total_prs)
        reputation = _compute_reputation(total_prs, bounties, len(skills))

        row_data = {
            "id": uuid.uuid5(uuid.NAMESPACE_DNS, f"solfoundry-{author}"),
            "username": author,
            "display_name": author,
            "avatar_url": avatar,
            "bio": bio,
            "skills": skills[:10],
            "badges": badges,
            "total_contributions": total_prs,
            "total_bounties_completed": bounties,
            "total_earnings": Decimal(str(earnings)),
            "reputation_score": float(reputation),
            "created_at": now - timedelta(days=45),
            "updated_at": now,
        }

        await contributor_service.upsert_contributor(row_data)
        seeded_count += 1
        logger.info(
            "Upserted %s: %d PRs, %d bounties, %s $FNDRY",
            author,
            total_prs,
            bounties,
            earnings,
        )

    # Refresh in-memory cache
    await contributor_service.refresh_store_cache()

    logger.info("Seeded %d contributors from GitHub PR history", seeded_count)
    return seeded_count


if __name__ == "__main__":
    count = asyncio.run(seed_from_github())
    print(f"Done: seeded {count} contributors")
