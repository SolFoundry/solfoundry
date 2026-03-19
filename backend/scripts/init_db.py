"""Database initialization script."""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import init_db, engine, Base
from app.models import User, Notification, Bounty
from sqlalchemy import text


async def main():
    """Initialize database."""
    print("Initializing database...")
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("✓ Tables created")
        
        # Create search index
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_bounties_search_vector 
            ON bounties USING GIN (search_vector)
        """))
        print("✓ Search index created")
        
        # Initialize search vectors
        await conn.execute(text("""
            UPDATE bounties SET search_vector = 
                setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(description, '')), 'B')
            WHERE search_vector IS NULL
        """))
        print("✓ Search vectors initialized")
    
    print("\nDatabase initialization complete! ✅")


if __name__ == "__main__":
    asyncio.run(main())
