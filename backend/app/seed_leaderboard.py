"""Seed real contributor data from SolFoundry Phase 1 payout history.

Real contributors who completed Phase 1 bounties:
- HuiNeng6: 6 payouts, 1,800,000 $FNDRY
- ItachiDevv: 6 payouts, 1,750,000 $FNDRY
"""

import uuid
from datetime import datetime, timezone, timedelta

from app.models.contributor import ContributorDB
from app.services.contributor_service import _store


REAL_CONTRIBUTORS = [
    {
        "username": "HuiNeng6",
        "display_name": "HuiNeng6",
        "avatar_url": "https://avatars.githubusercontent.com/u/HuiNeng6",
        "bio": "Full-stack developer. Python, React, FastAPI, WebSocket, Redis.",
        "skills": ["python", "fastapi", "react", "typescript", "websocket", "redis", "postgresql"],
        "badges": ["tier-1", "tier-2", "phase-1-og", "6x-contributor"],
        "total_contributions": 12,
        "total_bounties_completed": 6,
        "total_earnings": 1800000,
        "reputation_score": 92,
        "wallet": "HuiNeng6_wallet",
    },
    {
        "username": "ItachiDevv",
        "display_name": "ItachiDevv",
        "avatar_url": "https://avatars.githubusercontent.com/u/ItachiDevv",
        "bio": "Frontend specialist. React, TypeScript, Tailwind, Solana wallet integration.",
        "skills": ["react", "typescript", "tailwind", "solana", "jwt", "responsive"],
        "badges": ["tier-1", "tier-2", "phase-1-og", "6x-contributor"],
        "total_contributions": 10,
        "total_bounties_completed": 6,
        "total_earnings": 1750000,
        "reputation_score": 90,
        "wallet": "ItachiDevv_wallet",
    },
    {
        "username": "mtarcure",
        "display_name": "SolFoundry Core",
        "avatar_url": "https://avatars.githubusercontent.com/u/mtarcure",
        "bio": "SolFoundry core team. Architecture, security, DevOps.",
        "skills": ["python", "solana", "security", "devops", "rust", "anchor"],
        "badges": ["core-team", "tier-3", "architect"],
        "total_contributions": 50,
        "total_bounties_completed": 15,
        "total_earnings": 0,  # Core team doesn't earn bounties
        "reputation_score": 100,
        "wallet": "core_wallet",
    },
]


def seed_leaderboard():
    """Populate the in-memory contributor store with real Phase 1 data."""
    _store.clear()

    now = datetime.now(timezone.utc)

    for i, c in enumerate(REAL_CONTRIBUTORS):
        contributor = ContributorDB(
            id=uuid.uuid4(),
            username=c["username"],
            display_name=c["display_name"],
            avatar_url=c["avatar_url"],
            bio=c["bio"],
            skills=c["skills"],
            badges=c["badges"],
            total_contributions=c["total_contributions"],
            total_bounties_completed=c["total_bounties_completed"],
            total_earnings=c["total_earnings"],
            reputation_score=c["reputation_score"],
            created_at=now - timedelta(days=45 - i * 5),
            updated_at=now - timedelta(hours=i * 12),
        )
        _store[str(contributor.id)] = contributor

    print(f"[seed] Loaded {len(REAL_CONTRIBUTORS)} contributors")
