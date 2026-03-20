"""Tests for bounty search and filter functionality.

Tests the search service with in-memory storage.

Run with: pytest tests/test_bounty_search.py -v
"""

import pytest

from app.models.bounty import (
    BountyDB,
    BountyTier,
    BountyStatus,
    BountySearchParams,
)
from app.services import bounty_service


@pytest.fixture(autouse=True)
def clear_store():
    """Clear the bounty store before each test."""
    bounty_service._bounty_store.clear()
    yield
    bounty_service._bounty_store.clear()


class TestBountySearchService:
    """Tests for bounty search functionality."""

    def test_search_returns_only_open_bounties_by_default(self):
        """Test that search defaults to open status."""
        # Create bounties with different statuses
        bounties = [
            BountyDB(title="Open Task", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=100000.0),
            BountyDB(title="Completed Task", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.COMPLETED, reward_amount=50000.0),
        ]
        for b in bounties:
            bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.search_bounties(BountySearchParams())
        
        assert result.total == 1
        assert result.items[0].title == "Open Task"

    def test_search_filter_by_tier(self):
        """Test tier filtering."""
        bounties = [
            BountyDB(title="T1", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=50000.0),
            BountyDB(title="T2", description="D", tier=BountyTier.T2, category="backend", status=BountyStatus.OPEN, reward_amount=500000.0),
        ]
        for b in bounties:
            bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.search_bounties(BountySearchParams(tier=1))
        
        assert result.total == 1
        assert result.items[0].tier == BountyTier.T1

    def test_search_filter_by_category(self):
        """Test category filtering."""
        bounties = [
            BountyDB(title="Backend", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=100000.0),
            BountyDB(title="Frontend", description="D", tier=BountyTier.T1, category="frontend", status=BountyStatus.OPEN, reward_amount=100000.0),
        ]
        for b in bounties:
            bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.search_bounties(BountySearchParams(category="backend"))
        
        assert result.total == 1
        assert result.items[0].category == "backend"

    def test_search_filter_by_reward_range(self):
        """Test reward range filtering."""
        bounties = [
            BountyDB(title="Low", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=50000.0),
            BountyDB(title="Mid", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=150000.0),
            BountyDB(title="High", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=500000.0),
        ]
        for b in bounties:
            bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.search_bounties(
            BountySearchParams(reward_min=100000, reward_max=200000)
        )
        
        assert result.total == 1
        assert result.items[0].title == "Mid"

    def test_search_filter_by_skills(self):
        """Test skills filtering."""
        bounties = [
            BountyDB(title="Python Task", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=100000.0, required_skills=["python", "fastapi"]),
            BountyDB(title="JS Task", description="D", tier=BountyTier.T1, category="frontend", status=BountyStatus.OPEN, reward_amount=100000.0, required_skills=["javascript", "react"]),
        ]
        for b in bounties:
            bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.search_bounties(
            BountySearchParams(skills="python")
        )
        
        assert result.total == 1
        assert "python" in result.items[0].required_skills

    def test_search_sort_by_reward_high(self):
        """Test sorting by reward descending."""
        bounties = [
            BountyDB(title="Low", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=50000.0),
            BountyDB(title="High", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=500000.0),
        ]
        for b in bounties:
            bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.search_bounties(BountySearchParams(sort="reward_high"))
        
        assert result.items[0].reward_amount > result.items[1].reward_amount

    def test_search_pagination(self):
        """Test pagination."""
        for i in range(25):
            b = BountyDB(title=f"B{i}", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=100000.0)
            bounty_service._bounty_store[b.id] = b
        
        # First page
        result1 = bounty_service.search_bounties(BountySearchParams(skip=0, limit=10))
        assert len(result1.items) == 10
        assert result1.skip == 0
        
        # Second page
        result2 = bounty_service.search_bounties(BountySearchParams(skip=10, limit=10))
        assert len(result2.items) == 10
        assert result2.skip == 10
        
        # Total should be consistent
        assert result1.total == 25
        assert result2.total == 25

    def test_search_full_text_search(self):
        """Test full-text search across title and description."""
        bounties = [
            BountyDB(title="Implement search engine", description="Build full-text search", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=200000.0),
            BountyDB(title="Fix login bug", description="Authentication issue", tier=BountyTier.T1, category="frontend", status=BountyStatus.OPEN, reward_amount=50000.0),
        ]
        for b in bounties:
            bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.search_bounties(BountySearchParams(q="search"))
        
        # Should find the bounty with "search" in title/description
        assert result.total >= 1
        assert any("search" in b.title.lower() for b in [bounties[0]])

    def test_search_combined_filters(self):
        """Test multiple filters combined."""
        bounties = [
            BountyDB(title="Python Backend", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=150000.0, required_skills=["python"]),
            BountyDB(title="Python Frontend", description="D", tier=BountyTier.T1, category="frontend", status=BountyStatus.OPEN, reward_amount=100000.0, required_skills=["python"]),
            BountyDB(title="Rust Backend", description="D", tier=BountyTier.T2, category="backend", status=BountyStatus.OPEN, reward_amount=500000.0, required_skills=["rust"]),
        ]
        for b in bounties:
            bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.search_bounties(
            BountySearchParams(tier=1, category="backend", skills="python")
        )
        
        assert result.total == 1
        assert result.items[0].title == "Python Backend"

    def test_search_empty_result(self):
        """Test search with no results."""
        b = BountyDB(title="Task", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=100000.0)
        bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.search_bounties(BountySearchParams(q="nonexistentxyz123"))
        
        assert result.total == 0
        assert len(result.items) == 0

    def test_search_invalid_tier_raises_error(self):
        """Test that invalid tier raises ValueError."""
        with pytest.raises(ValueError, match="Invalid tier"):
            bounty_service.search_bounties(BountySearchParams(tier=5))

    def test_search_invalid_category_raises_error(self):
        """Test that invalid category raises ValueError."""
        with pytest.raises(ValueError, match="Invalid category"):
            bounty_service.search_bounties(BountySearchParams(category="invalid"))

    def test_search_negative_reward_raises_error(self):
        """Test that negative reward raises ValueError."""
        with pytest.raises(ValueError, match="cannot be negative"):
            bounty_service.search_bounties(BountySearchParams(reward_min=-100))

    def test_search_reward_range_invalid_raises_error(self):
        """Test that invalid reward range raises ValueError."""
        with pytest.raises(ValueError, match="cannot be less than"):
            bounty_service.search_bounties(
                BountySearchParams(reward_min=200, reward_max=100)
            )


class TestBountyAutocomplete:
    """Tests for autocomplete functionality."""

    def test_autocomplete_returns_titles(self):
        """Test autocomplete returns matching titles."""
        b = BountyDB(title="Search Engine Implementation", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=100000.0)
        bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.get_autocomplete_suggestions("search")
        
        assert len(result.suggestions) > 0
        assert any(s.type == "title" for s in result.suggestions)

    def test_autocomplete_returns_skills(self):
        """Test autocomplete returns matching skills."""
        b = BountyDB(title="Task", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=100000.0, required_skills=["postgresql", "python"])
        bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.get_autocomplete_suggestions("post")
        
        assert len(result.suggestions) > 0
        assert any(s.text == "postgresql" for s in result.suggestions)

    def test_autocomplete_minimum_query_length(self):
        """Test autocomplete requires minimum 2 characters."""
        b = BountyDB(title="Search Task", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=100000.0)
        bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.get_autocomplete_suggestions("s")
        
        assert len(result.suggestions) == 0

    def test_autocomplete_limits_results(self):
        """Test autocomplete respects limit."""
        for i in range(20):
            b = BountyDB(title=f"Search Task {i}", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=100000.0)
            bounty_service._bounty_store[b.id] = b
        
        result = bounty_service.get_autocomplete_suggestions("search", limit=5)
        
        assert len(result.suggestions) <= 5

    def test_autocomplete_only_searches_open_bounties(self):
        """Test autocomplete only returns suggestions from open bounties."""
        b1 = BountyDB(title="Open Task", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.OPEN, reward_amount=100000.0)
        b2 = BountyDB(title="Completed Task", description="D", tier=BountyTier.T1, category="backend", status=BountyStatus.COMPLETED, reward_amount=100000.0)
        bounty_service._bounty_store[b1.id] = b1
        bounty_service._bounty_store[b2.id] = b2
        
        result = bounty_service.get_autocomplete_suggestions("task")
        
        # Should only return the open task
        assert all(s.text != "Completed Task" for s in result.suggestions)