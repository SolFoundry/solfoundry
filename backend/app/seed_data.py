"""Seed live bounty data for SolFoundry.

Only seeds currently active bounties. Phase 2 bounties will be added
when they launch as GitHub issues.
"""

import json
import logging
from datetime import datetime, timezone, timedelta

from app.models.bounty_table import BountyDB
from app.models.bounty import BountyStatus, BountyTier
from app.services.bounty_service import _bounty_store

logger = logging.getLogger(__name__)

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
        "category": "content",
        "github_issue": "https://github.com/SolFoundry/solfoundry/issues/93",
        "created_by": "SolFoundry",
        "creator_type": "platform",
        "created_at_offset_hours": 28,
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
        "category": "content",
        "github_issue": "https://github.com/SolFoundry/solfoundry/issues/48",
        "created_by": "SolFoundry",
        "creator_type": "platform",
        "created_at_offset_hours": 35,
        "deadline_hours": 168,
    },
    {
        "title": "Build Smart Search & Discovery for Marketplace",
        "description": (
            "Build smart search and discovery for the marketplace. "
            "Full-text search bar with instant results, skill-based filtering, "
            "recommended-for-you section, advanced filters, sort options, "
            "pagination, and hot bounties section."
        ),
        "tier": BountyTier.T1,
        "reward_amount": 300000,
        "status": BountyStatus.OPEN,
        "skills": ["react", "typescript", "python", "fastapi"],
        "category": "frontend",
        "github_issue": "https://github.com/SolFoundry/solfoundry/issues/97",
        "created_by": "SolFoundry",
        "creator_type": "platform",
        "created_at_offset_hours": 2,
        "deadline_hours": 168,
    },
    {
        "title": "Security Audit — Escrow Token Transfer",
        "description": (
            "Audit the escrow token transfer logic for edge cases. "
            "The program panics on closed accounts. Identify the root cause, "
            "write a reproducer, and submit a fix."
        ),
        "tier": BountyTier.T2,
        "reward_amount": 5000,
        "status": BountyStatus.OPEN,
        "skills": ["rust", "anchor", "solana"],
        "category": "security",
        "github_issue": "https://github.com/SolFoundry/solfoundry/issues/50",
        "created_by": "SolFoundry",
        "creator_type": "platform",
        "created_at_offset_hours": 48,
        "deadline_hours": 336,
    },
    {
        "title": "Staking Dashboard UI",
        "description": (
            "Build a staking dashboard showing total staked, APY, "
            "staking history, and a stake/unstake interface. "
            "Must integrate with Solana wallet adapter."
        ),
        "tier": BountyTier.T2,
        "reward_amount": 3500,
        "status": BountyStatus.IN_PROGRESS,
        "skills": ["react", "typescript", "solana"],
        "category": "frontend",
        "github_issue": "https://github.com/SolFoundry/solfoundry/issues/55",
        "created_by": "community-user",
        "creator_type": "community",
        "created_at_offset_hours": 72,
        "deadline_hours": 336,
    },
    {
        "title": "API Documentation — OpenAPI Spec",
        "description": (
            "Generate comprehensive OpenAPI documentation for all backend endpoints. "
            "Include request/response examples, error codes, and authentication flows."
        ),
        "tier": BountyTier.T1,
        "reward_amount": 200,
        "status": BountyStatus.OPEN,
        "skills": ["typescript", "documentation"],
        "category": "documentation",
        "github_issue": "https://github.com/SolFoundry/solfoundry/issues/60",
        "created_by": "SolFoundry",
        "creator_type": "platform",
        "created_at_offset_hours": 120,
        "deadline_hours": 504,
    },
    {
        "title": "Price Feed Indexer Service",
        "description": (
            "Build a price feed indexer that subscribes to Pyth and Switchboard oracles, "
            "stores historical prices, and exposes a REST API for querying."
        ),
        "tier": BountyTier.T2,
        "reward_amount": 4500,
        "status": BountyStatus.OPEN,
        "skills": ["rust", "node.js", "solana"],
        "category": "backend",
        "github_issue": "https://github.com/SolFoundry/solfoundry/issues/62",
        "created_by": "community-user",
        "creator_type": "community",
        "created_at_offset_hours": 168,
        "deadline_hours": 504,
    },
    {
        "title": "Lending Protocol v2 Security Audit",
        "description": (
            "Full security audit of the lending protocol v2 smart contracts. "
            "Must include: access control review, economic attack vectors, "
            "flash loan analysis, and oracle manipulation scenarios."
        ),
        "tier": BountyTier.T3,
        "reward_amount": 15000,
        "status": BountyStatus.OPEN,
        "skills": ["rust", "anchor", "solana", "security"],
        "category": "security",
        "github_issue": "https://github.com/SolFoundry/solfoundry/issues/70",
        "created_by": "SolFoundry",
        "creator_type": "platform",
        "created_at_offset_hours": 240,
        "deadline_hours": 720,
    },
]


def seed_bounties():
    """Populate the in-memory bounty store with live bounties."""
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


async def seed_bounties_to_db():
    """Sync in-memory bounties into the database for full-text search."""
    try:
        from sqlalchemy import text as sql_text
        from app.database import get_db_session

        async with get_db_session() as session:
            # Check if the bounties table exists and is accessible
            try:
                await session.execute(sql_text("SELECT 1 FROM bounties LIMIT 0"))
            except Exception:
                logger.info("[seed] Bounties table not available, skipping DB sync")
                return

            now = datetime.now(timezone.utc)
            inserted = 0
            skipped = 0
            for b_data in LIVE_BOUNTIES:
                try:
                    created_at = now - timedelta(
                        hours=b_data["created_at_offset_hours"]
                    )
                    deadline = created_at + timedelta(hours=b_data["deadline_hours"])

                    existing = await session.execute(
                        sql_text("SELECT id FROM bounties WHERE title = :title"),
                        {"title": b_data["title"]},
                    )
                    if existing.first():
                        skipped += 1
                        continue

                    await session.execute(
                        sql_text("""
                            INSERT INTO bounties (
                                title, description, tier, reward_amount, status,
                                category, creator_type, skills, github_issue_url,
                                created_by, submission_count, popularity,
                                created_at, updated_at, deadline
                            ) VALUES (
                                :title, :description, :tier, :reward_amount, :status,
                                :category, :creator_type, :skills::jsonb, :github_issue_url,
                                :created_by, 0, 0,
                                :created_at, :updated_at, :deadline
                            )
                        """),
                        {
                            "title": b_data["title"],
                            "description": b_data["description"],
                            "tier": b_data["tier"].value,
                            "reward_amount": b_data["reward_amount"],
                            "status": b_data["status"].value,
                            "category": b_data.get("category"),
                            "creator_type": b_data.get("creator_type", "platform"),
                            "skills": json.dumps(b_data["skills"]),
                            "github_issue_url": b_data.get("github_issue"),
                            "created_by": b_data["created_by"],
                            "created_at": created_at,
                            "updated_at": created_at,
                            "deadline": deadline,
                        },
                    )
                    inserted += 1
                except Exception as e:
                    logger.warning(
                        "[seed] Failed to insert bounty '%s': %s",
                        b_data.get("title", "unknown"),
                        e,
                    )

            await session.commit()
            logger.info(
                "[seed] Synced bounties to database: %d inserted, %d skipped",
                inserted,
                skipped,
            )

            # Apply search trigger if not already present
            try:
                await session.execute(
                    sql_text("""
                        CREATE OR REPLACE FUNCTION update_bounty_search_vector()
                        RETURNS TRIGGER AS $$
                        BEGIN
                            NEW.search_vector := to_tsvector('english',
                                coalesce(NEW.title, '') || ' ' ||
                                coalesce(NEW.description, '')
                            );
                            RETURN NEW;
                        END;
                        $$ LANGUAGE plpgsql;
                    """)
                )
                await session.execute(
                    sql_text("""
                        DROP TRIGGER IF EXISTS bounty_search_vector_update ON bounties;
                        CREATE TRIGGER bounty_search_vector_update
                            BEFORE INSERT OR UPDATE ON bounties
                            FOR EACH ROW
                            EXECUTE FUNCTION update_bounty_search_vector();
                    """)
                )
                await session.execute(
                    sql_text("""
                        UPDATE bounties SET search_vector = to_tsvector('english',
                            coalesce(title, '') || ' ' || coalesce(description, '')
                        )
                    """)
                )
                await session.commit()
                logger.info("[seed] Applied search vector trigger")
            except Exception as e:
                await session.rollback()
                logger.debug("[seed] Search trigger setup failed: %s", e)

    except Exception as e:
        logger.warning("[seed] DB sync skipped: %s", e)
