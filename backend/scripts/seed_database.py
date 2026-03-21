#!/usr/bin/env python3
"""Seed script for initial database population (Issue #162).

Seeds bounties, contributors, and leaderboard data into PostgreSQL.
Safe to run multiple times — uses INSERT-or-skip logic to avoid
duplicates.

Usage:
    python scripts/seed_database.py
    # or
    DATABASE_URL=postgresql+asyncpg://... python scripts/seed_database.py
"""

import asyncio
import logging
import os
import sys

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("seed")


async def seed_all() -> dict[str, int]:
    """Seed bounties, contributors, and leaderboard data into PostgreSQL.

    Returns:
        A dict with counts of seeded entities.
    """
    from app.database import init_db

    await init_db()

    # Seed bounties into in-memory store then persist to DB
    from app.seed_data import seed_bounties, LIVE_BOUNTIES
    from app.services.bounty_service import _bounty_store
    from app.services.pg_store import persist_bounty

    seed_bounties()
    bounty_count = 0
    for bounty in _bounty_store.values():
        try:
            await persist_bounty(bounty)
            bounty_count += 1
        except Exception as exc:
            logger.warning("Bounty '%s' seed failed: %s", bounty.title, exc)

    logger.info("Seeded %d bounties", bounty_count)

    # Seed contributors
    from app.seed_leaderboard import seed_leaderboard, REAL_CONTRIBUTORS
    from app.services.contributor_service import _store
    from app.services.pg_store import persist_contributor

    seed_leaderboard()
    contributor_count = 0
    for contributor in _store.values():
        try:
            await persist_contributor(contributor)
            contributor_count += 1
        except Exception as exc:
            logger.warning(
                "Contributor '%s' seed failed: %s",
                contributor.username,
                exc,
            )

    logger.info("Seeded %d contributors", contributor_count)

    from app.database import close_db

    await close_db()

    return {
        "bounties": bounty_count,
        "contributors": contributor_count,
    }


def main() -> None:
    """Entry point for the seed script."""
    logger.info("Starting database seed...")
    result = asyncio.run(seed_all())
    logger.info(
        "Seed complete: %d bounties, %d contributors",
        result["bounties"],
        result["contributors"],
    )


if __name__ == "__main__":
    main()
