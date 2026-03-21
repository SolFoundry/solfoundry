"""Seed real contributor data from SolFoundry Phase 1 payout history.

Populates the ``contributors`` table in PostgreSQL with known Phase 1
contributors.  Uses ``contributor_service.upsert_contributor()`` for
idempotent inserts.

Real contributors who completed Phase 1 bounties:
- HuiNeng6: 6 payouts, 1,800,000 $FNDRY
- ItachiDevv: 6 payouts, 1,750,000 $FNDRY
"""

import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from app.services import contributor_service


REAL_CONTRIBUTORS = [
    {
        "username": "HuiNeng6",
        "display_name": "HuiNeng6",
        "avatar_url": "https://avatars.githubusercontent.com/u/HuiNeng6",
        "bio": "Full-stack developer. Python, React, FastAPI, WebSocket, Redis.",
        "skills": [
            "python",
            "fastapi",
            "react",
            "typescript",
            "websocket",
            "redis",
            "postgresql",
        ],
        "badges": ["tier-1", "tier-2", "phase-1-og", "6x-contributor"],
        "total_contributions": 12,
        "total_bounties_completed": 6,
        "total_earnings": Decimal("1800000"),
        "reputation_score": 92.0,
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
        "total_earnings": Decimal("1750000"),
        "reputation_score": 90.0,
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
        "total_earnings": Decimal("0"),
        "reputation_score": 100.0,
    },
]


async def async_seed_leaderboard() -> None:
    """Populate the contributors table with real Phase 1 data.

    Uses upsert logic so this is safe to call multiple times without
    creating duplicates.
    """
    now = datetime.now(timezone.utc)

    for index, contributor_data in enumerate(REAL_CONTRIBUTORS):
        row_data = {
            "id": uuid.uuid4(),
            "username": contributor_data["username"],
            "display_name": contributor_data["display_name"],
            "avatar_url": contributor_data["avatar_url"],
            "bio": contributor_data["bio"],
            "skills": contributor_data["skills"],
            "badges": contributor_data["badges"],
            "total_contributions": contributor_data["total_contributions"],
            "total_bounties_completed": contributor_data["total_bounties_completed"],
            "total_earnings": contributor_data["total_earnings"],
            "reputation_score": contributor_data["reputation_score"],
            "created_at": now - timedelta(days=45 - index * 5),
            "updated_at": now - timedelta(hours=index * 12),
        }
        await contributor_service.upsert_contributor(row_data)

    # Refresh the in-memory cache after seeding
    await contributor_service.refresh_store_cache()

    print(f"[seed] Loaded {len(REAL_CONTRIBUTORS)} contributors to PostgreSQL")


def seed_leaderboard() -> None:
    """Synchronous wrapper for ``async_seed_leaderboard()``.

    Called from ``main.py`` lifespan when GitHub sync fails and we fall
    back to static seed data.
    """
    asyncio.get_event_loop().run_until_complete(async_seed_leaderboard())
