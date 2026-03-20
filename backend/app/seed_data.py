"""Seed live bounty data for SolFoundry.

Only seeds currently active bounties. Phase 2 bounties will be added
when they launch as GitHub issues.
"""

from datetime import datetime, timezone, timedelta
from app.models.bounty import BountyDB, BountyStatus, BountyTier, SubmissionRecord
from app.services.bounty_service import _bounty_store


# Only the two currently live bounties
LIVE_BOUNTIES = [
    {
        "title": "Best X/Twitter Post About SolFoundry",
        "description": (
            "Content bounty — create an X/Twitter post (tweet or thread) about SolFoundry. "
            "Must explain what SolFoundry is, be original, and get engagement. "
            "Tag @foundrysol and include the repo link. Best post wins. "
            "Judged on: clarity (30%), creativity (25%), engagement (25%), accuracy (20%). "
            "No AI slop. No fake engagement."
        ),
        "tier": BountyTier.T1,
        "reward_amount": 500000,
        "status": BountyStatus.OPEN,
        "skills": ["content", "twitter", "marketing"],
        "github_issue": "https://github.com/SolFoundry/solfoundry/issues/93",
        "created_by": "SolFoundry",
        "created_at_offset_hours": 28,  # ~28 hours ago from issue creation
        "deadline_hours": 24,
    },
    {
        "title": "Star Reward Program — First 100 Stars Get 10,000 $FNDRY",
        "description": (
            "Star this repository and comment with your Solana wallet address to earn 10,000 $FNDRY. "
            "One reward per GitHub account. Must be a real account (no bots). "
            "Solana wallet only. First 100 valid claims get rewarded."
        ),
        "tier": BountyTier.T1,
        "reward_amount": 10000,
        "status": BountyStatus.OPEN,
        "skills": ["community", "github"],
        "github_issue": "https://github.com/SolFoundry/solfoundry/issues/48",
        "created_by": "SolFoundry",
        "created_at_offset_hours": 35,  # ~35 hours ago
        "deadline_hours": 168,  # 7 days
    },
]


def seed_bounties():
    """Populate the in-memory bounty store with live bounties only."""
    _bounty_store.clear()

    now = datetime.now(timezone.utc)

    for b in LIVE_BOUNTIES:
        created_at = now - timedelta(hours=b["created_at_offset_hours"])
        deadline = created_at + timedelta(hours=b["deadline_hours"])
        bounty = BountyDB(
            title=b["title"],
            description=b["description"],
            tier=b["tier"],
            reward_amount=b["reward_amount"],
            status=b["status"],
            required_skills=b["skills"],
            github_issue_url=b.get("github_issue"),
            created_by=b["created_by"],
            created_at=created_at,
            updated_at=created_at,
            deadline=deadline,
        )
        _bounty_store[bounty.id] = bounty

    print(f"[seed] Loaded {len(LIVE_BOUNTIES)} live bounties")
