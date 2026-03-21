import asyncio
from backend.app.db import SessionLocal
from backend.app.models.database import Bounty
from sqlalchemy import select

async def seed_data():
    async with SessionLocal() as session:
        # 1. Check if data already exists to avoid UniqueConstraint errors
        result = await session.execute(select(Bounty).limit(1))
        if result.scalar_one_or_none():
            print("✨ Data already exists, skipping seed.")
            return

        # 2. Define the T1 Bounties
        initial_bounties = [
            Bounty(issue_number=48, title="Star Reward Program", reward_amount=10000, tier="T1", status="open"),
            Bounty(issue_number=93, title="Best X/Twitter Post", reward_amount=500000, tier="T1", status="open"),
            Bounty(issue_number=11, title="GitHub OAuth System", reward_amount=200000, tier="T1", status="open"),
        ]
        
        # 3. Add and explicitly commit
        session.add_all(initial_bounties)
        await session.commit()  # <--- CRITICAL STEP
        print("✅ Database successfully committed to PostgreSQL!")

if __name__ == "__main__":
    asyncio.run(seed_data())
