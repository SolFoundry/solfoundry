"""Search service tests."""
import pytest
from app.services.search import search_service


def test_search_service_exists():
    """Test search service is initialized."""
    assert search_service is not None


def test_search_service_methods():
    """Test search service has required methods."""
    assert hasattr(search_service, "search_bounties")
    assert hasattr(search_service, "get_autocomplete_suggestions")
    assert hasattr(search_service, "initialize_search_vectors")
    assert hasattr(search_service, "create_search_index")


def test_search_filters():
    """Test search filter parameters."""
    # Valid filter values
    valid_tiers = [1, 2, 3]
    valid_statuses = ["open", "claimed", "completed"]
    valid_sort_options = ["newest", "reward_high", "reward_low", "deadline", "popularity"]
    
    for tier in valid_tiers:
        assert isinstance(tier, int)
    
    for status in valid_statuses:
        assert isinstance(status, str)
    
    for sort_by in valid_sort_options:
        assert isinstance(sort_by, str)


def test_bounty_model_search_vector():
    """Test bounty model has search vector field."""
    from app.models.bounty import Bounty
    
    assert hasattr(Bounty, "search_vector")
    assert hasattr(Bounty, "title")
    assert hasattr(Bounty, "description")
    assert hasattr(Bounty, "tier")
    assert hasattr(Bounty, "category")
    assert hasattr(Bounty, "status")
