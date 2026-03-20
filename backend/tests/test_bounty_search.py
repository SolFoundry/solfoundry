"""Tests for bounty search and filter functionality.

Tests the search service with a PostgreSQL test database that mirrors
the production schema including search vectors and indexes.

Run with: pytest tests/test_bounty_search.py -v
"""

import os
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

from app.models.bounty import BountyDB
from app.database import Base
from app.services.bounty_service import BountySearchService
from app.models.bounty import BountySearchParams


# Test database URL (PostgreSQL required for FTS)
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/solfoundry_test"
)


@pytest_asyncio.fixture
async def db_engine():
    """Create test database engine with production-like schema."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    
    # Create tables and search infrastructure
    async with engine.begin() as conn:
        # Drop existing tables
        await conn.run_sync(Base.metadata.drop_all)
        
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
        
        # Create search trigger function
        await conn.execute(text("""
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
        """))
        
        # Create trigger
        await conn.execute(text("""
            DROP TRIGGER IF EXISTS bounty_search_vector_update ON bounties;
            CREATE TRIGGER bounty_search_vector_update
                BEFORE INSERT OR UPDATE ON bounties
                FOR EACH ROW
                EXECUTE FUNCTION update_bounty_search_vector();
        """))
        
        # Create indexes
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_bounties_search_vector 
            ON bounties USING GIN(search_vector);
        """))
    
    yield engine
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    """Create a test database session."""
    async_session = async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as session:
        yield session


class TestBountySearchService:
    """Tests for BountySearchService."""
    
    @pytest.mark.asyncio
    async def test_search_returns_only_open_bounties_by_default(self, db_session):
        """Test that search defaults to open status."""
        # Create bounties with different statuses
        bounties = [
            BountyDB(title="Open Task", description="D", tier=1, category="backend", status="open", reward_amount=100000.0),
            BountyDB(title="Completed Task", description="D", tier=1, category="backend", status="completed", reward_amount=50000.0),
        ]
        for b in bounties:
            db_session.add(b)
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.search_bounties(BountySearchParams())
        
        assert result.total == 1
        assert result.items[0].title == "Open Task"
    
    @pytest.mark.asyncio
    async def test_search_filter_by_tier(self, db_session):
        """Test tier filtering."""
        bounties = [
            BountyDB(title="T1", description="D", tier=1, category="backend", status="open", reward_amount=50000.0),
            BountyDB(title="T2", description="D", tier=2, category="backend", status="open", reward_amount=500000.0),
        ]
        for b in bounties:
            db_session.add(b)
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.search_bounties(BountySearchParams(tier=1))
        
        assert result.total == 1
        assert result.items[0].tier == 1
    
    @pytest.mark.asyncio
    async def test_search_filter_by_category(self, db_session):
        """Test category filtering."""
        bounties = [
            BountyDB(title="Backend", description="D", tier=1, category="backend", status="open", reward_amount=100000.0),
            BountyDB(title="Frontend", description="D", tier=1, category="frontend", status="open", reward_amount=100000.0),
        ]
        for b in bounties:
            db_session.add(b)
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.search_bounties(BountySearchParams(category="backend"))
        
        assert result.total == 1
        assert result.items[0].category == "backend"
    
    @pytest.mark.asyncio
    async def test_search_filter_by_reward_range(self, db_session):
        """Test reward range filtering."""
        bounties = [
            BountyDB(title="Low", description="D", tier=1, category="backend", status="open", reward_amount=50000.0),
            BountyDB(title="Mid", description="D", tier=1, category="backend", status="open", reward_amount=150000.0),
            BountyDB(title="High", description="D", tier=1, category="backend", status="open", reward_amount=500000.0),
        ]
        for b in bounties:
            db_session.add(b)
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.search_bounties(
            BountySearchParams(reward_min=100000, reward_max=200000)
        )
        
        assert result.total == 1
        assert result.items[0].title == "Mid"
    
    @pytest.mark.asyncio
    async def test_search_filter_by_skills(self, db_session):
        """Test skills filtering."""
        bounties = [
            BountyDB(title="Python Task", description="D", tier=1, category="backend", status="open", reward_amount=100000.0, skills=["python", "fastapi"]),
            BountyDB(title="JS Task", description="D", tier=1, category="frontend", status="open", reward_amount=100000.0, skills=["javascript", "react"]),
        ]
        for b in bounties:
            db_session.add(b)
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.search_bounties(
            BountySearchParams(skills="python")
        )
        
        assert result.total == 1
        assert "python" in result.items[0].skills
    
    @pytest.mark.asyncio
    async def test_search_sort_by_reward_high(self, db_session):
        """Test sorting by reward descending."""
        bounties = [
            BountyDB(title="Low", description="D", tier=1, category="backend", status="open", reward_amount=50000.0),
            BountyDB(title="High", description="D", tier=1, category="backend", status="open", reward_amount=500000.0),
        ]
        for b in bounties:
            db_session.add(b)
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.search_bounties(BountySearchParams(sort="reward_high"))
        
        assert result.items[0].reward_amount > result.items[1].reward_amount
    
    @pytest.mark.asyncio
    async def test_search_pagination(self, db_session):
        """Test pagination."""
        for i in range(25):
            db_session.add(
                BountyDB(title=f"B{i}", description="D", tier=1, category="backend", status="open", reward_amount=100000.0)
            )
        await db_session.commit()
        
        service = BountySearchService(db_session)
        
        # First page
        result1 = await service.search_bounties(BountySearchParams(skip=0, limit=10))
        assert len(result1.items) == 10
        assert result1.skip == 0
        
        # Second page
        result2 = await service.search_bounties(BountySearchParams(skip=10, limit=10))
        assert len(result2.items) == 10
        assert result2.skip == 10
        
        # Total should be consistent
        assert result1.total == 25
        assert result2.total == 25
    
    @pytest.mark.asyncio
    async def test_search_full_text_search(self, db_session):
        """Test full-text search using tsvector."""
        bounties = [
            BountyDB(title="Implement search engine", description="Build full-text search", tier=1, category="backend", status="open", reward_amount=200000.0),
            BountyDB(title="Fix login bug", description="Authentication issue", tier=1, category="frontend", status="open", reward_amount=50000.0),
        ]
        for b in bounties:
            db_session.add(b)
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.search_bounties(BountySearchParams(q="search"))
        
        # Should find the bounty with "search" in title/description
        assert result.total >= 1
    
    @pytest.mark.asyncio
    async def test_search_combined_filters(self, db_session):
        """Test multiple filters combined."""
        bounties = [
            BountyDB(title="Python Backend", description="D", tier=1, category="backend", status="open", reward_amount=150000.0, skills=["python"]),
            BountyDB(title="Python Frontend", description="D", tier=1, category="frontend", status="open", reward_amount=100000.0, skills=["python"]),
            BountyDB(title="Rust Backend", description="D", tier=2, category="backend", status="open", reward_amount=500000.0, skills=["rust"]),
        ]
        for b in bounties:
            db_session.add(b)
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.search_bounties(
            BountySearchParams(tier=1, category="backend", skills="python")
        )
        
        assert result.total == 1
        assert result.items[0].title == "Python Backend"
    
    @pytest.mark.asyncio
    async def test_search_empty_result(self, db_session):
        """Test search with no results."""
        db_session.add(
            BountyDB(title="Task", description="D", tier=1, category="backend", status="open", reward_amount=100000.0)
        )
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.search_bounties(BountySearchParams(q="nonexistentxyz123"))
        
        assert result.total == 0
        assert len(result.items) == 0
    
    @pytest.mark.asyncio
    async def test_search_invalid_tier_raises_error(self, db_session):
        """Test that invalid tier raises ValueError."""
        service = BountySearchService(db_session)
        
        with pytest.raises(ValueError, match="Invalid tier"):
            await service.search_bounties(BountySearchParams(tier=5))
    
    @pytest.mark.asyncio
    async def test_search_invalid_category_raises_error(self, db_session):
        """Test that invalid category raises ValueError."""
        service = BountySearchService(db_session)
        
        with pytest.raises(ValueError, match="Invalid category"):
            await service.search_bounties(BountySearchParams(category="invalid"))
    
    @pytest.mark.asyncio
    async def test_search_negative_reward_raises_error(self, db_session):
        """Test that negative reward raises ValueError."""
        service = BountySearchService(db_session)
        
        with pytest.raises(ValueError, match="cannot be negative"):
            await service.search_bounties(BountySearchParams(reward_min=-100))
    
    @pytest.mark.asyncio
    async def test_search_reward_range_invalid_raises_error(self, db_session):
        """Test that invalid reward range raises ValueError."""
        service = BountySearchService(db_session)
        
        with pytest.raises(ValueError, match="cannot be less than"):
            await service.search_bounties(
                BountySearchParams(reward_min=200, reward_max=100)
            )


class TestBountyAutocomplete:
    """Tests for autocomplete functionality."""
    
    @pytest.mark.asyncio
    async def test_autocomplete_returns_titles(self, db_session):
        """Test autocomplete returns matching titles."""
        db_session.add(
            BountyDB(title="Search Engine Implementation", description="D", tier=1, category="backend", status="open", reward_amount=100000.0)
        )
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.get_autocomplete_suggestions("search")
        
        assert len(result.suggestions) > 0
        assert any(s.type == "title" for s in result.suggestions)
    
    @pytest.mark.asyncio
    async def test_autocomplete_returns_skills(self, db_session):
        """Test autocomplete returns matching skills."""
        db_session.add(
            BountyDB(title="Task", description="D", tier=1, category="backend", status="open", reward_amount=100000.0, skills=["postgresql", "python"])
        )
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.get_autocomplete_suggestions("post")
        
        assert len(result.suggestions) > 0
        assert any(s.text == "postgresql" for s in result.suggestions)
    
    @pytest.mark.asyncio
    async def test_autocomplete_minimum_query_length(self, db_session):
        """Test autocomplete requires minimum 2 characters."""
        db_session.add(
            BountyDB(title="Search Task", description="D", tier=1, category="backend", status="open", reward_amount=100000.0)
        )
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.get_autocomplete_suggestions("s")
        
        assert len(result.suggestions) == 0
    
    @pytest.mark.asyncio
    async def test_autocomplete_limits_results(self, db_session):
        """Test autocomplete respects limit."""
        for i in range(20):
            db_session.add(
                BountyDB(title=f"Search Task {i}", description="D", tier=1, category="backend", status="open", reward_amount=100000.0)
            )
        await db_session.commit()
        
        service = BountySearchService(db_session)
        result = await service.get_autocomplete_suggestions("search", limit=5)
        
        assert len(result.suggestions) <= 5